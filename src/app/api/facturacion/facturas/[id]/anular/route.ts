import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { INVENTORY_SYSTEM_CODES, generarCodigoMovimiento, ensureEmpresaCodigoSistemaProvisioned } from "@/lib/inventory/inventoryConstants";
import { calcularNuevoPMP } from "@/lib/inventory/inventoryMovementService";

export const dynamic = "force-dynamic";

const BILLING_ADVISORY_LOCK_ID = 7005;

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AnularFacturaBody {
  motivo_anulacion_factura_id?: number | string;
  motivo?: string;
  observacion?: string;
  destino_producto?: "DISPONIBLE" | "DAÑADO" | "DEFECTUOSO" | "CUARENTENA" | string;
  usuario_autorizacion_id?: number | string;
}

export async function POST(request: NextRequest, context: RouteParams) {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id || !session.usuario_id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
      { status: 401 }
    );
  }

  const perms = await getModulePermissions("FACTURACION", session.usuario_id);
  if (!perms.puede_eliminar && !perms.puede_inactivar && !perms.puede_editar) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "No tienes permisos para anular facturas en el sistema." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const facturaId = parseInt(id, 10);
  if (isNaN(facturaId) || facturaId <= 0) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de factura no válido." },
      { status: 400 }
    );
  }

  let body: AnularFacturaBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "El cuerpo de la petición debe ser un objeto JSON válido." },
      { status: 400 }
    );
  }

  const empresaId = session.empresa_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 0. Concurrencia segura: Advisory Lock a nivel de transacción
    await client.query("SELECT pg_advisory_xact_lock($1)", [BILLING_ADVISORY_LOCK_ID]);

    // 1. Consultar columnas reales de admin.facturas para tolerancia de esquema
    const facColsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas'`
    );
    const facCols = new Set((facColsRes.rows || []).map(r => String(r.column_name).toLowerCase()));

    // 2. Bloquear fila de factura con FOR UPDATE para concurrencia estricta
    const facSql = `
      SELECT
        f.factura_id,
        f.codigo_factura,
        ${facCols.has("numero_factura") ? "f.numero_factura" : "f.codigo_factura AS numero_factura"},
        f.estado,
        f.tipo_factura_id,
        f.orden_trabajo_id,
        tf.codigo AS tipo_factura_codigo
      FROM admin.facturas f
      JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      WHERE f.factura_id = $1 AND f.empresa_id = $2
      FOR UPDATE OF f;
    `;
    const facRows = await client.query(facSql, [facturaId, empresaId]);

    if (!facRows.rows || facRows.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La factura solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const factura = facRows.rows[0];

    // 3. Validar si ya está anulada (idempotencia y concurrencia - Sección 8 y 20)
    if (String(factura.estado).toUpperCase() === "ANULADA") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "FACTURA_YA_ANULADA",
          message: "La factura ya ha sido anulada previamente."
        },
        { status: 409 }
      );
    }

    // Verificar si ya existe snapshot en admin.factura_anulacion para doble protección
    const faCheck = await client.query(
      `SELECT factura_anulacion_id FROM admin.factura_anulacion WHERE factura_id = $1`,
      [facturaId]
    ).catch(() => ({ rows: [] }));

    if (faCheck.rows && faCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "FACTURA_YA_ANULADA",
          message: "La factura ya cuenta con un registro histórico de anulación."
        },
        { status: 409 }
      );
    }

    // 4. Resolver Motivo de Anulación desde Catálogo (Secciones 1, 2, 5, 8)
    let motivoRow: {
      motivo_anulacion_factura_id: number;
      codigo: string;
      motivo_anulacion: string;
      descripcion: string | null;
      genera_movimiento: boolean;
      tipo_movimiento_id: number | null;
      codigo_tipo_movimiento?: string | null;
      nombre_tipo_movimiento?: string | null;
      naturaleza?: string | null;
      requiere_observacion: boolean;
      requiere_autorizacion: boolean;
    } | null = null;

    const motivoId = body.motivo_anulacion_factura_id
      ? parseInt(String(body.motivo_anulacion_factura_id), 10)
      : null;

    if (motivoId && !isNaN(motivoId) && motivoId > 0) {
      const mafRes = await client.query(
        `SELECT
            maf.motivo_anulacion_factura_id,
            maf.codigo,
            maf.motivo_anulacion,
            maf.descripcion,
            maf.genera_movimiento,
            maf.tipo_movimiento_id,
            maf.requiere_observacion,
            maf.requiere_autorizacion,
            tmi.codigo AS codigo_tipo_movimiento,
            tmi.nombre AS nombre_tipo_movimiento,
            tmi.naturaleza
         FROM admin.motivo_anulacion_factura maf
         LEFT JOIN admin.tipo_movimiento_inventario tmi ON maf.tipo_movimiento_id = tmi.tipo_movimiento_id
         WHERE maf.motivo_anulacion_factura_id = $1 AND maf.estado = 'ACTIVO'
         LIMIT 1`,
        [motivoId]
      ).catch(() => ({ rows: [] }));

      if (mafRes.rows && mafRes.rows.length > 0) {
        motivoRow = mafRes.rows[0];
      }
    }

    // Fallback: Si no se envió motivo_anulacion_factura_id pero vino texto en body.motivo
    if (!motivoRow && body.motivo && body.motivo.trim()) {
      const mafTextRes = await client.query(
        `SELECT
            maf.motivo_anulacion_factura_id,
            maf.codigo,
            maf.motivo_anulacion,
            maf.descripcion,
            maf.genera_movimiento,
            maf.tipo_movimiento_id,
            maf.requiere_observacion,
            maf.requiere_autorizacion,
            tmi.codigo AS codigo_tipo_movimiento,
            tmi.nombre AS nombre_tipo_movimiento,
            tmi.naturaleza
         FROM admin.motivo_anulacion_factura maf
         LEFT JOIN admin.tipo_movimiento_inventario tmi ON maf.tipo_movimiento_id = tmi.tipo_movimiento_id
         WHERE UPPER(TRIM(maf.codigo)) = UPPER(TRIM($1))
            OR UPPER(TRIM(maf.motivo_anulacion)) = UPPER(TRIM($1))
         LIMIT 1`,
        [body.motivo.trim()]
      ).catch(() => ({ rows: [] }));

      if (mafTextRes.rows && mafTextRes.rows.length > 0) {
        motivoRow = mafTextRes.rows[0];
      }
    }

    // Si aún no se localiza motivo y no vino motivo_anulacion_factura_id válido
    if (!motivoRow) {
      // Tomar primer motivo activo del catálogo por defecto o reportar error
      const mafDefRes = await client.query(
        `SELECT
            maf.motivo_anulacion_factura_id,
            maf.codigo,
            maf.motivo_anulacion,
            maf.descripcion,
            maf.genera_movimiento,
            maf.tipo_movimiento_id,
            maf.requiere_observacion,
            maf.requiere_autorizacion,
            tmi.codigo AS codigo_tipo_movimiento,
            tmi.nombre AS nombre_tipo_movimiento,
            tmi.naturaleza
         FROM admin.motivo_anulacion_factura maf
         LEFT JOIN admin.tipo_movimiento_inventario tmi ON maf.tipo_movimiento_id = tmi.tipo_movimiento_id
         WHERE maf.estado = 'ACTIVO'
         ORDER BY maf.motivo_anulacion_factura_id ASC
         LIMIT 1`
      ).catch(() => ({ rows: [] }));

      if (mafDefRes.rows && mafDefRes.rows.length > 0) {
        motivoRow = mafDefRes.rows[0];
      } else {
        // Fallback en memoria si la tabla aún se está aprovisionando
        motivoRow = {
          motivo_anulacion_factura_id: 1,
          codigo: "ERROR_FACTURACION",
          motivo_anulacion: body.motivo?.trim() || "Error de facturación",
          descripcion: "Error en la emisión de la factura.",
          genera_movimiento: true,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: "DEV_VENTA",
          nombre_tipo_movimiento: "Devolución por Anulación de Venta",
          naturaleza: "ENTRADA",
          requiere_observacion: false,
          requiere_autorizacion: false
        };
      }
    }

    if (!motivoRow) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "MOTIVO_ANULACION_NO_ENCONTRADO",
          message: "No se pudo identificar un motivo de anulación válido."
        },
        { status: 400 }
      );
    }

    const observacion = (body.observacion || body.motivo || "").trim();

    // 5. Validar Observación obligatoria según catálogo (Sección 15)
    if (motivoRow.requiere_observacion && !observacion) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "OBSERVACION_REQUERIDA",
          message: `El motivo '${motivoRow.motivo_anulacion}' requiere que especifique una observación explicativa.`
        },
        { status: 400 }
      );
    }

    // 6. Validar Autorización según catálogo (Sección 16)
    let validatedAutorizacionUsuarioId: number | null = null;
    if (motivoRow.requiere_autorizacion) {
      const autId = body.usuario_autorizacion_id ? parseInt(String(body.usuario_autorizacion_id), 10) : null;
      if (!autId || isNaN(autId) || autId <= 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "AUTORIZACION_REQUERIDA",
            message: `El motivo '${motivoRow.motivo_anulacion}' requiere la autorización formal de un usuario con permisos administrativos.`
          },
          { status: 400 }
        );
      }

      // Validar usuario autorizador en la misma empresa con permisos válidos
      const autUserRes = await client.query(
        `SELECT u.usuario_id, u.rol_principal_id
         FROM admin.usuario u
         WHERE u.usuario_id = $1 AND u.empresa_id = $2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
         LIMIT 1`,
        [autId, empresaId]
      );

      if (!autUserRes.rows || autUserRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "AUTORIZACION_INVALIDA",
            message: "El usuario autorizador seleccionado no existe o no pertenece a su empresa."
          },
          { status: 403 }
        );
      }

      const autUser = autUserRes.rows[0];
      const isSuperAdmin = Number(autUser.rol_principal_id) === 1;

      if (!isSuperAdmin) {
        const autPerms = await getModulePermissions("FACTURACION", autUser.usuario_id);
        if (!autPerms.puede_aprobar && !autPerms.puede_eliminar) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              error: "AUTORIZACION_DENEGADA",
              message: "El usuario seleccionado no cuenta con permisos para autorizar la anulación de facturas."
            },
            { status: 403 }
          );
        }
      }

      validatedAutorizacionUsuarioId = autUser.usuario_id;
    }

    // 7. Destino del Producto (Sección 14)
    const rawDestino = (body.destino_producto || "DISPONIBLE").trim().toUpperCase();
    const allowedDestinos = ["DISPONIBLE", "DAÑADO", "DEFECTUOSO", "CUARENTENA"];
    const destinoProducto = allowedDestinos.includes(rawDestino) ? rawDestino : "DISPONIBLE";

    // 8. Asegurar código de sistema 16 (DEVOLUCION_VENTA, DV) aprovisionado
    await ensureEmpresaCodigoSistemaProvisioned(client, empresaId);

    const codigoFactura = factura.codigo_factura || `FAC-${facturaId}`;
    const numeroFactura = factura.numero_factura || codigoFactura;

    // 9. Cargar detalle de la factura y clasificar líneas (Secciones 10, 11, 12, 13)
    const detSql = `
      SELECT
        df.detalle_factura_id,
        df.factura_id,
        df.almacen_id,
        df.tipo_linea,
        df.producto_id,
        df.orden_producto_id,
        df.orden_servicio_id,
        df.movimiento_inventario_id,
        df.cantidad,
        df.costo_unitario,
        df.descripcion,
        df.codigo
      FROM admin.detalle_factura df
      WHERE df.factura_id = $1
      ORDER BY df.detalle_factura_id ASC;
    `;
    const detRes = await client.query(detSql, [facturaId]);
    const detalles = detRes.rows || [];

    // Clasificación de líneas:
    // - SERVICIO: nunca genera movimiento de inventario.
    // - REPUESTO OT: si tiene orden_producto_id / procede de OT: NO DEV_VENTA. SAL_ORDEN intacto.
    // - PRODUCTO: producto de venta directa o extra sin orden_producto_id. Si generó SAL_VENTA, se revierte.
    const productosElegibles = detalles.filter(
      (d) => String(d.tipo_linea).toUpperCase() === "PRODUCTO" && !d.orden_producto_id && d.producto_id
    );

    // 10. Evaluar si la anulación genera movimiento físico de inventario (Sección 10 & 14)
    const debeRevertirInventario = Boolean(motivoRow.genera_movimiento) && productosElegibles.length > 0;
    const reversosGenerados: Array<{ movimiento_id: number; producto_id: number; cantidad: number }> = [];

    let devVentaTipoId: number | null = null;
    let devVentaCodigo = "DEV_VENTA";
    let devVentaNombre = "Devolución por Anulación de Venta";
    let devVentaNaturaleza = "ENTRADA";

    // Si debe revertir inventario, resolver catálogo DEV_VENTA de forma segura (Sección 1, 21)
    if (debeRevertirInventario) {
      const tipoMovRes = await client.query<{
        tipo_movimiento_id: number;
        codigo: string;
        nombre: string;
        naturaleza: string;
        estado?: string;
      }>(
        `SELECT tipo_movimiento_id, codigo, nombre, naturaleza, estado
         FROM admin.tipo_movimiento_inventario
         WHERE UPPER(TRIM(codigo)) = 'DEV_VENTA'
         LIMIT 1`
      );

      const devVentaRow = tipoMovRes.rows[0];
      if (!devVentaRow || !devVentaRow.tipo_movimiento_id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "CATALOGO_DEV_VENTA_NO_CONFIGURADO",
            message: "El tipo de movimiento DEV_VENTA no existe o no está configurado en el catálogo del sistema.",
            details: "CATALOGO_DEV_VENTA_NO_CONFIGURADO: La migración 028 debe estar debidamente aplicada."
          },
          { status: 500 }
        );
      }

      if (devVentaRow.estado && String(devVentaRow.estado).toUpperCase() === "INACTIVO") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: "CATALOGO_DEV_VENTA_NO_CONFIGURADO",
            message: "El tipo de movimiento DEV_VENTA se encuentra inactivo en el catálogo de inventario.",
            details: "CATALOGO_DEV_VENTA_NO_CONFIGURADO: El tipo de movimiento DEV_VENTA debe tener estado ACTIVO."
          },
          { status: 500 }
        );
      }

      devVentaTipoId = Number(devVentaRow.tipo_movimiento_id);
      devVentaCodigo = devVentaRow.codigo;
      devVentaNombre = devVentaRow.nombre;
      devVentaNaturaleza = devVentaRow.naturaleza;

      // 11. Localizar SAL_VENTA para cada PRODUCTO elegible (Secciones 11, 12, 13)
      for (const prodLinea of productosElegibles) {
        const prodId = Number(prodLinea.producto_id);
        const almId = prodLinea.almacen_id ? Number(prodLinea.almacen_id) : null;
        const cantRevertir = parseFloat(String(prodLinea.cantidad || 0));

        if (cantRevertir <= 0) continue;

        let movSalidaId = prodLinea.movimiento_inventario_id ? Number(prodLinea.movimiento_inventario_id) : null;
        let movSalidaRow: {
          movimiento_inventario_id: number;
          empresa_id: number;
          producto_id: number;
          almacen_id: number;
          cantidad: number;
          costo_unitario: number;
          costo_total: number;
          codigo_movimiento: string;
        } | null = null;

        // A) Búsqueda directa si el detalle ya tiene movimiento_inventario_id persistido
        if (movSalidaId) {
          const directMovRes = await client.query(
            `SELECT mi.movimiento_inventario_id, mi.empresa_id, mi.producto_id, mi.almacen_id,
                    mi.cantidad, mi.costo_unitario, mi.costo_total, mi.codigo_movimiento
             FROM admin.movimientos_inventario mi
             JOIN admin.tipo_movimiento_inventario tm ON mi.tipo_movimiento_id = tm.tipo_movimiento_id
             WHERE mi.movimiento_inventario_id = $1
               AND mi.empresa_id = $2
               AND tm.codigo = 'SAL_VENTA'
             FOR UPDATE OF mi`,
            [movSalidaId, empresaId]
          );
          if (directMovRes.rows && directMovRes.rows.length > 0) {
            movSalidaRow = directMovRes.rows[0];
          }
        }

        // B) Fallback para facturas históricas sin movimiento_inventario_id (Sección 12)
        if (!movSalidaRow) {
          const fallbackParams: (string | number)[] = [empresaId, prodId, codigoFactura, numeroFactura];
          let almClause = "";
          if (almId) {
            fallbackParams.push(almId);
            almClause = `AND mi.almacen_id = $${fallbackParams.length}`;
          }

          const fallbackSql = `
            SELECT mi.movimiento_inventario_id, mi.empresa_id, mi.producto_id, mi.almacen_id,
                   mi.cantidad, mi.costo_unitario, mi.costo_total, mi.codigo_movimiento
            FROM admin.movimientos_inventario mi
            JOIN admin.tipo_movimiento_inventario tm ON mi.tipo_movimiento_id = tm.tipo_movimiento_id
            WHERE mi.empresa_id = $1
              AND mi.producto_id = $2
              AND tm.codigo = 'SAL_VENTA'
              AND tm.naturaleza = 'SALIDA'
              AND (mi.referencia = $3 OR mi.referencia = $4)
              ${almClause}
              AND NOT EXISTS (
                SELECT 1
                FROM admin.movimientos_inventario rev
                WHERE rev.movimiento_origen_id = mi.movimiento_inventario_id
              )
            ORDER BY mi.movimiento_inventario_id ASC
            FOR UPDATE OF mi;
          `;
          const fallbackRes = await client.query(fallbackSql, fallbackParams);
          const matches = fallbackRes.rows || [];

          if (matches.length === 0) {
            // Regla Sección 13: NO ANULAR SI INVENTARIO ES INCONSISTENTE
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                error: "INVENTARIO_FACTURA_INCONSISTENTE",
                message: "No se encontró la salida original de inventario de uno o más productos de la factura.",
                details: `Producto '${prodLinea.descripcion}' (#${prodId}) no posee movimiento SAL_VENTA asociado en la factura ${codigoFactura}.`
              },
              { status: 409 }
            );
          }

          if (matches.length > 1) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                error: "INVENTARIO_FACTURA_AMBIGUO",
                message: "Se encontró más de una salida original de inventario para el producto en la factura.",
                details: `Se encontraron ${matches.length} movimientos SAL_VENTA activos para el producto #${prodId}.`
              },
              { status: 409 }
            );
          }

          const matchedMov = matches[0];
          if (!matchedMov) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                error: "INVENTARIO_FACTURA_INCONSISTENTE",
                message: "No se encontró la salida original de inventario de uno o más productos de la factura.",
                details: `Producto '${prodLinea.descripcion}' (#${prodId}) no posee movimiento SAL_VENTA asociado en la factura ${codigoFactura}.`
              },
              { status: 409 }
            );
          }
          movSalidaRow = matchedMov;
          movSalidaId = matchedMov.movimiento_inventario_id;

          // Vincular retroactivamente en detalle_factura para futuras consultas
          await client.query(
            `UPDATE admin.detalle_factura
             SET movimiento_inventario_id = $1
             WHERE detalle_factura_id = $2`,
            [movSalidaId, prodLinea.detalle_factura_id]
          ).catch(() => {});
        }

        if (!movSalidaRow) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              error: "INVENTARIO_FACTURA_INCONSISTENTE",
              message: "No se encontró la salida original de inventario de uno o más productos de la factura.",
              details: `Producto '${prodLinea.descripcion}' (#${prodId}) no posee movimiento SAL_VENTA asociado en la factura ${codigoFactura}.`
            },
            { status: 409 }
          );
        }

        // 12. Reingreso físico al inventario si destino_producto === 'DISPONIBLE' (Sección 14, 21, 22)
        const targetAlmId = movSalidaRow.almacen_id;
        const costoUnitarioHistorico = parseFloat(String(movSalidaRow.costo_unitario || 0));
        const costoTotalHistorico = Number((cantRevertir * costoUnitarioHistorico).toFixed(2));

        let stockActual = 0;
        let nuevoStockActual = 0;

        if (destinoProducto === "DISPONIBLE") {
          const exRes = await client.query(
            `SELECT existencia_producto_id, cantidad_actual, cantidad_reservada, costo_promedio
             FROM admin.existencias_producto
             WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
             FOR UPDATE`,
            [empresaId, prodId, targetAlmId]
          );

          if (!exRes.rows || exRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              {
                error: "INCONSISTENCIA_STOCK",
                message: `No existe registro de inventario para el producto #${prodId} en el almacén #${targetAlmId}.`
              },
              { status: 409 }
            );
          }

          const ex = exRes.rows[0];
          stockActual = parseFloat(String(ex.cantidad_actual || 0));
          const costoPromedioActual = parseFloat(String(ex.costo_promedio || 0));

          nuevoStockActual = Number((stockActual + cantRevertir).toFixed(4));
          const nuevoPMP = calcularNuevoPMP(stockActual, costoPromedioActual, cantRevertir, costoUnitarioHistorico);

          await client.query(
            `UPDATE admin.existencias_producto
             SET cantidad_actual = $1,
                 costo_promedio = $2,
                 fecha_ultimo_movimiento = NOW(),
                 fecha_actualizacion = NOW(),
                 usuario_actualizacion = $3
             WHERE existencia_producto_id = $4`,
            [nuevoStockActual, nuevoPMP, session.usuario_id, ex.existencia_producto_id]
          );
        } else {
          // Sección 14: DAÑADO / DEFECTUOSO / CUARENTENA
          // No falsear disponibilidad sumando al stock vendible disponible.
          // Se preserva el stock actual intacto.
          const exRes = await client.query(
            `SELECT cantidad_actual FROM admin.existencias_producto
             WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3`,
            [empresaId, prodId, targetAlmId]
          );
          stockActual = parseFloat(String(exRes.rows[0]?.cantidad_actual || 0));
          nuevoStockActual = stockActual;
        }

        // 13. Registrar Movimiento Kardex DEV_VENTA enlazado al origen (Sección 21)
        let codigoMovimientoDV: string | null = null;
        try {
          codigoMovimientoDV = await generarCodigoMovimiento(
            client,
            empresaId,
            INVENTORY_SYSTEM_CODES.DEVOLUCION_VENTA
          );
        } catch (errGen) {
          console.warn("Could not generate movement code for DEV_VENTA:", errGen);
        }

        const observacionMov = `Devolución por anulación de Factura ${codigoFactura} [Reverso de ${movSalidaRow.codigo_movimiento || `#${movSalidaRow.movimiento_inventario_id}`}] - Motivo: ${motivoRow.motivo_anulacion} - Destino: ${destinoProducto}${observacion ? ` - Obs: ${observacion}` : ""}`;

        const insMovRes = await client.query<{ movimiento_inventario_id: number }>(
          `INSERT INTO admin.movimientos_inventario (
             empresa_id,
             producto_id,
             almacen_id,
             tipo_movimiento_id,
             cantidad,
             costo_unitario,
             costo_total,
             stock_anterior,
             stock_nuevo,
             movimiento_origen_id,
             referencia,
             observacion,
             codigo_movimiento,
             fecha_movimiento,
             usuario_movimiento
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14
           )
           RETURNING movimiento_inventario_id;`,
          [
            empresaId,
            prodId,
            targetAlmId,
            devVentaTipoId,
            cantRevertir,
            costoUnitarioHistorico,
            costoTotalHistorico,
            stockActual,
            nuevoStockActual,
            movSalidaRow.movimiento_inventario_id,
            codigoFactura,
            observacionMov,
            codigoMovimientoDV,
            session.usuario_id
          ]
        );

        reversosGenerados.push({
          movimiento_id: insMovRes.rows[0]?.movimiento_inventario_id,
          producto_id: prodId,
          cantidad: cantRevertir
        });
      }
    }

    // 14. Insertar Snapshot Histórico en admin.factura_anulacion (Sección 17 & 18)
    try {
      const maxFaRes = await client.query(
        `SELECT COALESCE(MAX(factura_anulacion_id), 0) + 1 AS next_id FROM admin.factura_anulacion`
      ).catch(() => ({ rows: [{ next_id: 1 }] }));
      const nextFaId = Number(maxFaRes.rows[0]?.next_id) || 1;

      await client.query(
        `INSERT INTO admin.factura_anulacion (
           factura_anulacion_id,
           factura_id,
           motivo_anulacion_factura_id,
           motivo_codigo_snapshot,
           motivo_snapshot,
           motivo_descripcion_snapshot,
           genera_movimiento_snapshot,
           tipo_movimiento_id_snapshot,
           tipo_movimiento_codigo_snapshot,
           tipo_movimiento_nombre_snapshot,
           tipo_movimiento_naturaleza_snapshot,
           destino_producto,
           observacion,
           requiere_autorizacion_snapshot,
           usuario_autorizacion_id,
           fecha_anulacion,
           usuario_anulacion_id,
           empresa_id
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, $17
         )
         ON CONFLICT (factura_id) DO NOTHING`,
        [
          nextFaId,
          facturaId,
          motivoRow.motivo_anulacion_factura_id || null,
          motivoRow.codigo,
          motivoRow.motivo_anulacion,
          motivoRow.descripcion || null,
          motivoRow.genera_movimiento,
          devVentaTipoId,
          devVentaCodigo,
          devVentaNombre,
          devVentaNaturaleza,
          destinoProducto,
          observacion || null,
          motivoRow.requiere_autorizacion,
          validatedAutorizacionUsuarioId,
          session.usuario_id,
          empresaId
        ]
      );
    } catch (faErr) {
      console.warn("Could not write to admin.factura_anulacion snapshot:", faErr);
    }

    // 15. Actualizar admin.facturas como ANULADA (Sección 19)
    const updateSet: string[] = ["estado = 'ANULADA'"];
    const updateParams: (string | number)[] = [facturaId];
    let updateIdx = 2;

    if (facCols.has("motivo_anulacion")) {
      const textoFinalMotivo = observacion
        ? `${motivoRow.motivo_anulacion}: ${observacion}`
        : motivoRow.motivo_anulacion;
      updateSet.push(`motivo_anulacion = $${updateIdx}`);
      updateParams.push(textoFinalMotivo);
      updateIdx++;
    }

    if (facCols.has("fecha_anulacion")) {
      updateSet.push(`fecha_anulacion = NOW()`);
    }

    if (facCols.has("usuario_anulacion_id")) {
      updateSet.push(`usuario_anulacion_id = $${updateIdx}`);
      updateParams.push(session.usuario_id);
      updateIdx++;
    }

    if (facCols.has("fecha_modificacion")) {
      updateSet.push(`fecha_modificacion = NOW()`);
    }

    if (facCols.has("usuario_modificacion_id")) {
      updateSet.push(`usuario_modificacion_id = $${updateIdx}`);
      updateParams.push(session.usuario_id);
      updateIdx++;
    }

    await client.query(
      `UPDATE admin.facturas
       SET ${updateSet.join(", ")}
       WHERE factura_id = $1 AND empresa_id = $${updateIdx}`,
      [...updateParams, empresaId]
    );

    // Regla 3 & 13: NO borrar ni modificar registros de admin.pagos (se conservan como evidencia histórica)
    // Regla 20 & 21: NO modificar el estado de la Orden de Trabajo si pertenecía a una OT

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Factura anulada exitosamente.",
      data: {
        factura_id: facturaId,
        codigo_factura: codigoFactura,
        estado: "ANULADA",
        motivo_anulacion: motivoRow.motivo_anulacion,
        motivo_codigo: motivoRow.codigo,
        observacion,
        destino_producto: destinoProducto,
        reversos_inventario: reversosGenerados.length,
        movimientos_reversados: reversosGenerados
      }
    });

  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en POST /api/facturacion/facturas/[id]/anular:", err);

    if (errorMsg.includes("CATALOGO_DEV_VENTA_NO_CONFIGURADO")) {
      return NextResponse.json(
        {
          error: "CATALOGO_DEV_VENTA_NO_CONFIGURADO",
          message: "El tipo de movimiento DEV_VENTA no está configurado en el catálogo del sistema.",
          details: errorMsg
        },
        { status: 500 }
      );
    }

    if (errorMsg.includes("INVENTARIO_FACTURA_INCONSISTENTE")) {
      return NextResponse.json(
        {
          error: "INVENTARIO_FACTURA_INCONSISTENTE",
          message: "No se encontró la salida original de inventario de uno o más productos de la factura.",
          details: errorMsg
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "ERROR_ANULAR_FACTURA",
        message: "Ocurrió un error al anular la factura y procesar los reversos de inventario.",
        details: errorMsg
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
