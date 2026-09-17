import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { INVENTORY_SYSTEM_CODES, generarCodigoMovimiento, ensureEmpresaCodigoSistemaProvisioned } from "@/lib/inventory/inventoryConstants";
import { calcularNuevoPMP } from "@/lib/inventory/inventoryMovementService";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  let body: { motivo?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "El cuerpo de la petición debe ser un objeto JSON válido." },
      { status: 400 }
    );
  }

  const motivo = (body.motivo || "").trim();
  if (!motivo) {
    return NextResponse.json(
      { error: "MOTIVO_REQUERIDO", message: "El motivo de la anulación es obligatorio." },
      { status: 400 }
    );
  }

  const empresaId = session.empresa_id;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Consultar columnas reales de admin.facturas para tolerancia de esquema
    const facColsRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas'`
    );
    const facCols = new Set((facColsRes.rows || []).map(r => String(r.column_name).toLowerCase()));

    // 2. Bloquear fila de factura con FOR UPDATE para concurrencia estricta (Sección 18 y 19)
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

    // 3. Validar si ya está anulada (idempotencia y concurrencia)
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

    // 4. Asegurar código de sistema 16 (DEVOLUCION_VENTA, DV) aprovisionado
    await ensureEmpresaCodigoSistemaProvisioned(client, empresaId);

    // 5. Localizar movimientos SAL_VENTA originados por esta factura (Sección 5, 6, 7, 10, 11, 12)
    // - Las líneas SERVICIO y REPUESTO de OT NO se revierten aquí (pertenecen al Taller).
    // - Solo se revierten movimientos SAL_VENTA de líneas PRODUCTO.
    const codigoFactura = factura.codigo_factura || `FAC-${facturaId}`;
    const numeroFactura = factura.numero_factura || codigoFactura;

    const movsSalVentaSql = `
      SELECT
        mi.movimiento_inventario_id,
        mi.empresa_id,
        mi.producto_id,
        mi.almacen_id,
        mi.cantidad,
        mi.costo_unitario,
        mi.costo_total,
        mi.codigo_movimiento,
        mi.referencia
      FROM admin.movimientos_inventario mi
      JOIN admin.tipo_movimiento_inventario tm ON mi.tipo_movimiento_id = tm.tipo_movimiento_id
      WHERE mi.empresa_id = $1
        AND tm.codigo = 'SAL_VENTA'
        AND tm.naturaleza = 'SALIDA'
        AND (mi.referencia = $2 OR mi.referencia = $3)
        AND NOT EXISTS (
          SELECT 1
          FROM admin.movimientos_inventario rev
          WHERE rev.movimiento_origen_id = mi.movimiento_inventario_id
        )
      ORDER BY mi.movimiento_inventario_id ASC
      FOR UPDATE OF mi;
    `;
    const movsSalVentaRes = await client.query(movsSalVentaSql, [empresaId, codigoFactura, numeroFactura]);
    const movsSalVenta = movsSalVentaRes.rows || [];

    // 6. Resolver tipo_movimiento_id para DEV_VENTA por código canónico si hay reversos de venta directa
    let devVentaTipoId: number | null = null;
    if (movsSalVenta.length > 0) {
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
            details: "CATALOGO_DEV_VENTA_NO_CONFIGURADO: La migración 028 debe estar aplicada en la base de datos."
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
    }

    const reversosGenerados: Array<{ movimiento_id: number; producto_id: number; cantidad: number }> = [];

    // 7. Por cada movimiento original SAL_VENTA, crear movimiento inverso de ENTRADA (DEV_VENTA)
    for (const movOrigen of movsSalVenta) {
      const productoId = Number(movOrigen.producto_id);
      const almacenId = Number(movOrigen.almacen_id);
      const cantidadDevuelta = parseFloat(String(movOrigen.cantidad || 0));
      const costoUnitarioHistorico = parseFloat(String(movOrigen.costo_unitario || 0));

      if (cantidadDevuelta <= 0) continue;

      // Bloquear registro de existencias_producto FOR UPDATE
      const exRes = await client.query(`
        SELECT
          existencia_producto_id,
          cantidad_actual,
          cantidad_reservada,
          costo_promedio
        FROM admin.existencias_producto
        WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
        FOR UPDATE
      `, [empresaId, productoId, almacenId]);

      if (!exRes.rows || exRes.rows.length === 0) {
        throw new Error(
          `No existe registro de inventario para el producto #${productoId} en el almacén #${almacenId}.`
        );
      }

      const ex = exRes.rows[0];
      const stockActual = parseFloat(String(ex.cantidad_actual || 0));
      const costoPromedioActual = parseFloat(String(ex.costo_promedio || 0));

      // Regla 8: cantidad_actual += cantidad, cantidad_reservada NO cambia, disponible aumenta
      const nuevoStockActual = Number((stockActual + cantidadDevuelta).toFixed(4));

      // Regla 9: Recalcular PMP usando regla canónica con costo histórico original
      const nuevoPMP = calcularNuevoPMP(
        stockActual,
        costoPromedioActual,
        cantidadDevuelta,
        costoUnitarioHistorico
      );

      // Actualizar existencias_producto
      await client.query(`
        UPDATE admin.existencias_producto
        SET
          cantidad_actual = $1,
          costo_promedio = $2,
          fecha_ultimo_movimiento = NOW(),
          fecha_actualizacion = NOW(),
          usuario_actualizacion = $3
        WHERE existencia_producto_id = $4
      `, [nuevoStockActual, nuevoPMP, session.usuario_id, ex.existencia_producto_id]);

      // Generar código de movimiento DV (Prefijo DV, Código Sistema 16)
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

      // Regla 7 & 10: Insertar movimiento físico DEV_VENTA con movimiento_origen_id enlazado
      const costoTotalHistorico = Number((cantidadDevuelta * costoUnitarioHistorico).toFixed(2));
      const observacionMov = `Devolución por anulación de Factura ${codigoFactura} [Reverso de ${movOrigen.codigo_movimiento || `#${movOrigen.movimiento_inventario_id}`}] - Motivo: ${motivo}`;

      const insMovRes = await client.query<{ movimiento_inventario_id: number }>(`
        INSERT INTO admin.movimientos_inventario (
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
        RETURNING movimiento_inventario_id;
      `, [
        empresaId,
        productoId,
        almacenId,
        devVentaTipoId,
        cantidadDevuelta,
        costoUnitarioHistorico,
        costoTotalHistorico,
        stockActual,
        nuevoStockActual,
        movOrigen.movimiento_inventario_id,
        codigoFactura,
        observacionMov,
        codigoMovimientoDV,
        session.usuario_id
      ]);

      const nuevoMovId = insMovRes.rows[0]?.movimiento_inventario_id;
      reversosGenerados.push({
        movimiento_id: nuevoMovId,
        producto_id: productoId,
        cantidad: cantidadDevuelta
      });
    }

    // 7. Marcar factura como ANULADA y registrar trazabilidad de anulación (Sección 4 y 18)
    const updateSet: string[] = ["estado = 'ANULADA'"];
    const updateParams: (string | number)[] = [facturaId];
    let updateIdx = 2;

    if (facCols.has("motivo_anulacion")) {
      updateSet.push(`motivo_anulacion = $${updateIdx}`);
      updateParams.push(motivo);
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

    await client.query(`
      UPDATE admin.facturas
      SET ${updateSet.join(", ")}
      WHERE factura_id = $1 AND empresa_id = $${updateIdx}
    `, [...updateParams, empresaId]);

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
        motivo_anulacion: motivo,
        reversos_inventario: reversosGenerados.length,
        movimientos_reversados: reversosGenerados
      }
    });
  } catch (err: unknown) {
    await client.query("ROLLBACK");
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
