import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para ver el detalle de facturas." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const facturaId = parseInt(id, 10);
    if (isNaN(facturaId) || facturaId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "El identificador de la factura no es válido." },
        { status: 400 }
      );
    }

    const empresaId = session.empresa_id;

    // Consultar columnas reales de admin.facturas para tolerancia de esquema
    const facColsRes = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas'`
    );
    const facCols = new Set((facColsRes || []).map(r => String(r.column_name).toLowerCase()));

    const colCodigo = facCols.has("codigo_factura")
      ? (facCols.has("numero_factura") ? "COALESCE(f.codigo_factura, f.numero_factura, 'FAC-' || f.factura_id::text)" : "COALESCE(f.codigo_factura, 'FAC-' || f.factura_id::text)")
      : (facCols.has("numero_factura") ? "COALESCE(f.numero_factura, 'FAC-' || f.factura_id::text)" : "('FAC-' || f.factura_id::text)");

    const colNumero = facCols.has("numero_factura")
      ? (facCols.has("codigo_factura") ? "COALESCE(f.numero_factura, f.codigo_factura, 'FAC-' || f.factura_id::text)" : "COALESCE(f.numero_factura, 'FAC-' || f.factura_id::text)")
      : (facCols.has("codigo_factura") ? "COALESCE(f.codigo_factura, 'FAC-' || f.factura_id::text)" : "('FAC-' || f.factura_id::text)");

    const colTotal = facCols.has("total")
      ? (facCols.has("total_factura") ? "COALESCE(f.total, f.total_factura, 0)" : "COALESCE(f.total, 0)")
      : (facCols.has("total_factura") ? "COALESCE(f.total_factura, 0)" : "0");

    const colDescuento = facCols.has("descuento")
      ? (facCols.has("descuento_total") ? "COALESCE(f.descuento, f.descuento_total, 0)" : "COALESCE(f.descuento, 0)")
      : (facCols.has("descuento_total") ? "COALESCE(f.descuento_total, 0)" : "0");

    const colImpuesto = facCols.has("impuesto")
      ? (facCols.has("impuesto_total") ? "COALESCE(f.impuesto, f.impuesto_total, 0)" : "COALESCE(f.impuesto, 0)")
      : (facCols.has("impuesto_total") ? "COALESCE(f.impuesto_total, 0)" : "0");

    const colFechaCreacion = facCols.has("fecha_creacion")
      ? "COALESCE(f.fecha_creacion, f.fecha_factura, NOW())"
      : (facCols.has("fecha_registro") ? "COALESCE(f.fecha_registro, f.fecha_factura, NOW())" : "COALESCE(f.fecha_factura, NOW())");

    const colFechaMod = facCols.has("fecha_modificacion") ? "f.fecha_modificacion" : "NULL::timestamptz AS fecha_modificacion";
    const colUsuarioCreacion = facCols.has("usuario_creacion_id")
      ? "f.usuario_creacion_id"
      : (facCols.has("usuario_registro") ? "f.usuario_registro" : (facCols.has("usuario_id") ? "f.usuario_id" : "1"));
    const colObservacion = facCols.has("observacion") ? "COALESCE(f.observacion, '')" : "''";
    const colMontoPagado = facCols.has("monto_pagado") ? "COALESCE(f.monto_pagado, 0)" : "0";
    const colBalancePendiente = facCols.has("balance_pendiente")
      ? `COALESCE(f.balance_pendiente, ${colTotal})`
      : `GREATEST(0, (${colTotal} - ${colMontoPagado}))`;
    const colEmpresa = "f.empresa_id";
    const colMotivoAnulacion = facCols.has("motivo_anulacion") ? "f.motivo_anulacion" : "NULL::text AS motivo_anulacion";
    const colFechaAnulacion = facCols.has("fecha_anulacion") ? "f.fecha_anulacion" : "NULL::timestamptz AS fecha_anulacion";
    const colUsuarioAnulacion = facCols.has("usuario_anulacion_id") ? "f.usuario_anulacion_id" : "NULL::int AS usuario_anulacion_id";

    // 1. Cabecera de factura con Anti-IDOR estricto (Sección 13)
    const facSql = `
      SELECT
        f.factura_id,
        ${colEmpresa} AS empresa_id,
        ${colCodigo} AS codigo_factura,
        ${colNumero} AS numero_factura,
        f.tipo_factura_id,
        ${facCols.has("condicion_venta") ? "f.condicion_venta" : "'CONTADO'"} AS condicion_venta,
        COALESCE(tf.codigo, 'VENTA_DIRECTA') AS tipo_factura_codigo,
        COALESCE(tf.nombre, 'Venta Directa') AS tipo_factura_nombre,
        f.cliente_id,
        f.orden_trabajo_id,
        f.fecha_factura,
        f.subtotal,
        ${colDescuento} AS descuento,
        ${colDescuento} AS descuento_total,
        ${colImpuesto} AS impuesto,
        ${colImpuesto} AS impuesto_total,
        ${colTotal} AS total,
        ${colTotal} AS total_factura,
        ${colMontoPagado} AS monto_pagado,
        ${colBalancePendiente} AS balance_pendiente,
        f.estado,
        ${colObservacion} AS observacion,
        ${colFechaCreacion} AS fecha_creacion,
        ${colFechaMod},
        ${colMotivoAnulacion},
        ${colFechaAnulacion},
        ${colUsuarioAnulacion},
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui_anul.nombre, ui_anul.apellido)), ''), ui_anul.correo_electronico, ('Usuario #' || u_anul.usuario_id::text), NULL) AS usuario_anulacion_nombre,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text), 'Sistema') AS usuario_creacion_nombre
      FROM admin.facturas f
      LEFT JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.usuario u ON ${colUsuarioCreacion} = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario u_anul ON ${facCols.has("usuario_anulacion_id") ? "f.usuario_anulacion_id" : "NULL::int"} = u_anul.usuario_id
      LEFT JOIN admin.usuario_identidad ui_anul ON u_anul.usuario_id = ui_anul.usuario_id
      WHERE f.factura_id = $1
        AND f.empresa_id = $2;
    `;
    const facRows = await query<Record<string, unknown>>(facSql, [facturaId, empresaId]);

    if (!facRows || facRows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La factura solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const factura = facRows[0];

    // 2. Datos del Cliente (Tolerante a columnas de clientes)
    let cliente = null;
    if (factura.cliente_id) {
      try {
        const cliColsRes = await query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'clientes'`
        );
        const cliCols = new Set((cliColsRes || []).map(r => String(r.column_name).toLowerCase()));
        const colCliDir = cliCols.has("direccion") ? "c.direccion" : "NULL AS direccion";
        const colCliIdent = cliCols.has("identificacion") ? "c.identificacion" : "NULL AS identificacion";
        const colCliTel = cliCols.has("telefono_principal")
          ? "c.telefono_principal"
          : (cliCols.has("telefono") ? "c.telefono AS telefono_principal" : "NULL AS telefono_principal");
        const colCliEmail = cliCols.has("correo")
          ? "c.correo"
          : (cliCols.has("email") ? "c.email AS correo" : "NULL AS correo");

        const cliSql = `
          SELECT
            c.cliente_id,
            COALESCE(c.nombre_completo, TRIM(CONCAT_WS(' ', c.nombre, c.apellido))) AS nombre_completo,
            ${colCliIdent},
            ${colCliTel},
            ${colCliEmail},
            ${colCliDir}
          FROM admin.clientes c
          WHERE c.cliente_id = $1 AND (c.empresa_id = $2 OR c.empresa_id IS NULL);
        `;
        const cliRows = await query<Record<string, unknown>>(cliSql, [factura.cliente_id, empresaId]);
        if (cliRows && cliRows.length > 0) {
          cliente = cliRows[0];
        }
      } catch (cliErr) {
        console.warn("Could not query cliente details in invoice detail:", cliErr);
      }
    }

    // 3. Datos de Orden de Trabajo y Bicicleta (si aplica, tolerante a columnas)
    let ordenTrabajo = null;
    if (factura.orden_trabajo_id) {
      try {
        const otSql = `
          SELECT
            ot.orden_trabajo_id,
            ot.codigo_orden,
            ot.estado_orden_id,
            eot.codigo AS estado_codigo,
            eot.nombre AS estado_nombre,
            eot.color_estado,
            ot.fecha_registro,
            ot.fecha_finalizacion,
            b.bicicleta_id,
            b.marca AS bicicleta_marca,
            b.modelo AS bicicleta_modelo,
            b.ano AS bicicleta_ano,
            b.numero_serie_cuadro AS bicicleta_serie
          FROM admin.ordenes_trabajo ot
          LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
          LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
          LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
          WHERE ot.orden_trabajo_id = $1 AND (c.empresa_id = $2 OR c.empresa_id IS NULL);
        `;
        const otRows = await query<Record<string, unknown>>(otSql, [factura.orden_trabajo_id, empresaId]);
        if (otRows && otRows.length > 0) {
          const o = otRows[0];
          ordenTrabajo = {
            orden_trabajo_id: Number(o.orden_trabajo_id),
            codigo_orden: o.codigo_orden,
            estado_orden_id: Number(o.estado_orden_id),
            estado_codigo: o.estado_codigo,
            estado_nombre: o.estado_nombre,
            color_estado: o.color_estado,
            fecha_registro: o.fecha_registro,
            fecha_finalizacion: o.fecha_finalizacion,
            bicicleta: o.bicicleta_id ? {
              bicicleta_id: Number(o.bicicleta_id),
              marca: o.bicicleta_marca || "",
              modelo: o.bicicleta_modelo || "",
              ano: o.bicicleta_ano,
              color: "",
              numero_serie_cuadro: o.bicicleta_serie,
              codigo_qr: null
            } : null
          };
        }
      } catch (otErr) {
        console.warn("Could not query orden_trabajo details in invoice detail:", otErr);
      }
    }

    // 4. Detalle de líneas de la factura (Snapshot histórico, Sección 10)
    let detalle: Array<Record<string, unknown>> = [];
    try {
      const detColsRes = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura'`
      );
      const detCols = new Set((detColsRes || []).map(r => String(r.column_name).toLowerCase()));

      const exprDetTipoLinea = detCols.has("tipo_linea")
        ? "df.tipo_linea"
        : (detCols.has("tipo_detalle") ? "COALESCE(df.tipo_detalle, 'PRODUCTO')" : "'PRODUCTO'");
      const colDetTipoLinea = `${exprDetTipoLinea} AS tipo_linea`;

      const colDetAlmacenId = detCols.has("almacen_id") ? "df.almacen_id" : "NULL::int AS almacen_id";
      const colDetProductoId = detCols.has("producto_id") ? "df.producto_id" : "NULL::int AS producto_id";
      const colDetTipoServicioId = detCols.has("tipo_servicio_id")
        ? "df.tipo_servicio_id"
        : (detCols.has("servicio_id") ? "df.servicio_id AS tipo_servicio_id" : "NULL::int AS tipo_servicio_id");
      const colDetOrdenServicioId = detCols.has("orden_servicio_id") ? "df.orden_servicio_id" : "NULL::int AS orden_servicio_id";
      const colDetOrdenProductoId = detCols.has("orden_producto_id") ? "df.orden_producto_id" : "NULL::int AS orden_producto_id";
      const colDetCodigo = detCols.has("codigo") ? "df.codigo" : "'' AS codigo";
      const colDetCostoUnitario = detCols.has("costo_unitario") ? "df.costo_unitario" : "NULL::numeric AS costo_unitario";
      const colDetDescuento = detCols.has("descuento") ? "df.descuento" : "0::numeric AS descuento";
      const colAlmacenJoin = detCols.has("almacen_id") ? "LEFT JOIN admin.almacenes a ON df.almacen_id = a.almacen_id" : "";
      const colAlmacenNombre = detCols.has("almacen_id") ? "a.nombre AS almacen_nombre" : "NULL AS almacen_nombre";

      const detSql = `
        SELECT
          df.detalle_factura_id,
          df.factura_id,
          ${colDetAlmacenId},
          ${colAlmacenNombre},
          ${colDetTipoLinea},
          ${colDetProductoId},
          ${colDetTipoServicioId},
          ${colDetOrdenServicioId},
          ${colDetOrdenProductoId},
          ${colDetCodigo},
          COALESCE(
            NULLIF(TRIM(p.codigo_producto), ''),
            NULLIF(TRIM(p_op.codigo_producto), ''),
            NULLIF(TRIM(p.codigo_barra), ''),
            NULLIF(TRIM(p_op.codigo_barra), '')
          ) AS rel_codigo_producto,
          COALESCE(
            NULLIF(TRIM(ts.codigo), ''),
            NULLIF(TRIM(ts_os.codigo), ''),
            NULLIF(TRIM(os.codigo_servicio), ''),
            NULLIF(TRIM(ts_desc.codigo), '')
          ) AS rel_codigo_servicio,
          df.descripcion,
          df.cantidad,
          df.precio_unitario,
          ${colDetDescuento},
          df.subtotal,
          ${colDetCostoUnitario}
        FROM admin.detalle_factura df
        JOIN admin.facturas f ON df.factura_id = f.factura_id
        ${colAlmacenJoin}
        LEFT JOIN admin.productos p ON ${detCols.has("producto_id") ? "df.producto_id = p.producto_id" : "1=0"}
        LEFT JOIN admin.orden_productos op ON (
          ${detCols.has("orden_producto_id") ? "df.orden_producto_id = op.orden_producto_id" : "1=0"}
          OR (f.orden_trabajo_id IS NOT NULL AND op.orden_trabajo_id = f.orden_trabajo_id AND ${detCols.has("producto_id") ? "op.producto_id = df.producto_id" : "1=0"})
        )
        LEFT JOIN admin.productos p_op ON op.producto_id = p_op.producto_id
        LEFT JOIN admin.orden_servicios os ON (
          ${detCols.has("orden_servicio_id") ? "df.orden_servicio_id = os.orden_servicio_id" : "1=0"}
          OR ${detCols.has("servicio_id") ? "df.servicio_id = os.orden_servicio_id" : "1=0"}
          OR (f.orden_trabajo_id IS NOT NULL AND os.orden_trabajo_id = f.orden_trabajo_id AND (os.descripcion_servicio = df.descripcion OR ${detCols.has("servicio_id") ? "os.tipo_servicio_id = df.servicio_id" : "1=0"}))
        )
        LEFT JOIN admin.tipo_servicio ts_os ON os.tipo_servicio_id = ts_os.tipo_servicio_id
        LEFT JOIN admin.tipo_servicio ts ON (
          ${detCols.has("tipo_servicio_id") ? "df.tipo_servicio_id = ts.tipo_servicio_id" : "1=0"}
          OR ${detCols.has("servicio_id") ? "df.servicio_id = ts.tipo_servicio_id" : "1=0"}
        )
        LEFT JOIN admin.tipo_servicio ts_desc ON (
          COALESCE(${exprDetTipoLinea}, '') = 'SERVICIO' AND ts_desc.nombre = df.descripcion
        )
        WHERE df.factura_id = $1
        ORDER BY df.detalle_factura_id ASC;
      `;
      const detRows = await query<Record<string, unknown>>(detSql, [facturaId]);
      detalle = (detRows || []).map((d) => {
        const snapshotCodigo = d.codigo && String(d.codigo).trim() !== "" ? String(d.codigo).trim() : "";
        const relCodigoProd = d.rel_codigo_producto ? String(d.rel_codigo_producto).trim() : "";
        const relCodigoServ = d.rel_codigo_servicio ? String(d.rel_codigo_servicio).trim() : "";
        const tipoLinea = String(d.tipo_linea || "PRODUCTO").toUpperCase();

        // Prioridad: usar código snapshot guardado en detalle_factura
        // Fallback: usar relación real del producto/servicio si el snapshot no lo trae
        let finalCodigo = snapshotCodigo;
        if (!finalCodigo) {
          if (tipoLinea === "SERVICIO") {
            finalCodigo = relCodigoServ || relCodigoProd;
          } else {
            // PRODUCTO o REPUESTO
            finalCodigo = relCodigoProd || relCodigoServ;
          }
        }

        return {
          detalle_factura_id: Number(d.detalle_factura_id),
          almacen_id: d.almacen_id ? Number(d.almacen_id) : null,
          almacen_nombre: d.almacen_nombre || (tipoLinea === "SERVICIO" ? "Taller (Servicio)" : "Almacén"),
          tipo_linea: d.tipo_linea || "PRODUCTO",
          producto_id: d.producto_id ? Number(d.producto_id) : null,
          tipo_servicio_id: d.tipo_servicio_id ? Number(d.tipo_servicio_id) : null,
          orden_servicio_id: d.orden_servicio_id ? Number(d.orden_servicio_id) : null,
          orden_producto_id: d.orden_producto_id ? Number(d.orden_producto_id) : null,
          codigo: finalCodigo || "",
          codigo_producto: relCodigoProd || null,
          codigo_servicio: relCodigoServ || null,
          descripcion: d.descripcion,
          cantidad: parseFloat(Number(d.cantidad || 0).toFixed(2)),
          precio_unitario: parseFloat(Number(d.precio_unitario || 0).toFixed(2)),
          descuento: parseFloat(Number(d.descuento || 0).toFixed(2)),
          subtotal: parseFloat(Number(d.subtotal || 0).toFixed(2)),
          costo_unitario: d.costo_unitario != null ? parseFloat(Number(d.costo_unitario).toFixed(2)) : null
        };
      });
    } catch (detErr) {
      console.warn("Could not query detalle_factura:", detErr);
    }

    // 5. Historial de Pagos aplicados (Sección 12)
    let pagos: Array<Record<string, unknown>> = [];
    try {
      const pagoColsRes = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos'`
      );
      const pagoCols = new Set((pagoColsRes || []).map(r => String(r.column_name).toLowerCase()));

      const colPagoMonto = pagoCols.has("monto")
        ? (pagoCols.has("monto_pago") ? "COALESCE(p.monto, p.monto_pago, 0)" : "COALESCE(p.monto, 0)")
        : (pagoCols.has("monto_pago") ? "COALESCE(p.monto_pago, 0)" : "0");

      const colPagoUsuario = pagoCols.has("usuario_id")
        ? "p.usuario_id"
        : (pagoCols.has("usuario_creacion_id") ? "p.usuario_creacion_id" : (pagoCols.has("usuario_registro") ? "p.usuario_registro" : "1"));

      const pagosSql = `
        SELECT
          p.pago_id,
          p.factura_id,
          p.tipo_pago_id,
          COALESCE(tp.codigo, 'EFECTIVO') AS tipo_pago_codigo,
          COALESCE(tp.nombre, 'Efectivo') AS tipo_pago_nombre,
          ${colPagoMonto} AS monto,
          ${pagoCols.has("monto_recibido") ? "p.monto_recibido" : colPagoMonto} AS monto_recibido,
          ${pagoCols.has("monto_devuelta") ? "p.monto_devuelta" : "0"} AS monto_devuelta,
          ${pagoCols.has("referencia") ? "p.referencia" : "NULL AS referencia"},
          ${pagoCols.has("observacion") ? "p.observacion" : "NULL AS observacion"},
          ${pagoCols.has("fecha_pago") ? "p.fecha_pago" : (pagoCols.has("fecha_creacion") ? "p.fecha_creacion AS fecha_pago" : "NOW() AS fecha_pago")},
          ${pagoCols.has("estado") ? "p.estado" : "'APLICADO' AS estado"},
          ${pagoCols.has("fecha_creacion") ? "p.fecha_creacion" : "NOW() AS fecha_creacion"},
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text), 'Sistema') AS usuario_nombre
        FROM admin.pagos p
        JOIN admin.facturas f ON p.factura_id = f.factura_id
        LEFT JOIN admin.tipo_pago tp ON p.tipo_pago_id = tp.tipo_pago_id
        LEFT JOIN admin.usuario u ON ${colPagoUsuario} = u.usuario_id
        LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
        WHERE p.factura_id = $1 AND f.empresa_id = $2
        ORDER BY p.pago_id ASC;
      `;
      const pagosRows = await query<Record<string, unknown>>(pagosSql, [facturaId, empresaId]);
      pagos = (pagosRows || []).map((p) => ({
        pago_id: Number(p.pago_id),
        tipo_pago_id: Number(p.tipo_pago_id),
        tipo_pago_codigo: p.tipo_pago_codigo || "EFECTIVO",
        tipo_pago_nombre: p.tipo_pago_nombre || "Efectivo",
        monto: parseFloat(Number(p.monto || 0).toFixed(2)),
        monto_recibido: p.monto_recibido != null ? parseFloat(Number(p.monto_recibido).toFixed(2)) : null,
        monto_devuelta: p.monto_devuelta != null ? parseFloat(Number(p.monto_devuelta).toFixed(2)) : 0,
        referencia: p.referencia || null,
        observacion: p.observacion || null,
        fecha_pago: p.fecha_pago,
        estado: p.estado || "APLICADO",
        usuario_nombre: p.usuario_nombre || "Sistema"
      }));
    } catch (pagErr) {
      console.warn("Could not query pagos for invoice detail:", pagErr);
    }

    // 6. Datos reales de la Empresa (Sección 20)
    let empresa: Record<string, unknown> = {
      empresa_id: empresaId,
      nombre_comercial: "RIDE LAB",
      rnc: "",
      telefono: "",
      correo: "",
      direccion: "",
      logotipo_url: null
    };

    try {
      const empColsRes = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'empresa'`
      );
      const empCols = new Set((empColsRes || []).map(r => String(r.column_name).toLowerCase()));
      const colEmpEmail = empCols.has("email") ? "e.email AS correo" : (empCols.has("correo") ? "e.correo" : "NULL AS correo");
      const colEmpRnc = empCols.has("rnc") ? "e.rnc" : "NULL AS rnc";
      const colEmpTel = empCols.has("telefono") ? "e.telefono" : "NULL AS telefono";
      const colEmpDir = empCols.has("direccion") ? "e.direccion" : "NULL AS direccion";
      const colEmpLogo = empCols.has("logotipo_url") ? "e.logotipo_url" : "NULL AS logotipo_url";
      const colEmpNombre = empCols.has("nombre_comercial")
        ? "e.nombre_comercial"
        : (empCols.has("alias") ? "e.alias AS nombre_comercial" : "'RIDE LAB' AS nombre_comercial");

      const empSql = `
        SELECT
          e.empresa_id,
          ${colEmpNombre},
          ${colEmpRnc},
          ${colEmpTel},
          ${colEmpEmail},
          ${colEmpDir},
          ${colEmpLogo}
        FROM admin.empresa e
        WHERE e.empresa_id = $1;
      `;
      const empRows = await query<Record<string, unknown>>(empSql, [empresaId]);
      if (empRows && empRows.length > 0) {
        const emp = empRows[0];
        empresa = {
          empresa_id: Number(emp.empresa_id),
          nombre_comercial: String(emp.nombre_comercial || "RIDE LAB"),
          rnc: String(emp.rnc || ""),
          telefono: String(emp.telefono || ""),
          correo: String(emp.correo || ""),
          direccion: String(emp.direccion || ""),
          logotipo_url: (emp.logotipo_url as string) || null
        };
      }
    } catch (empErr) {
      console.warn("Could not query admin.empresa, using fallback metadata:", empErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        factura: {
          factura_id: Number(factura.factura_id),
          codigo_factura: factura.codigo_factura,
          numero_factura: factura.numero_factura || factura.codigo_factura,
          tipo_factura_id: Number(factura.tipo_factura_id || 1),
          condicion_venta: (factura.condicion_venta as "CONTADO" | "CREDITO") || "CONTADO",
          tipo_factura_codigo: factura.tipo_factura_codigo || "VENTA_DIRECTA",
          tipo_factura_nombre: factura.tipo_factura_nombre || "Venta Directa",
          cliente_id: factura.cliente_id ? Number(factura.cliente_id) : null,
          orden_trabajo_id: factura.orden_trabajo_id ? Number(factura.orden_trabajo_id) : null,
          fecha_factura: factura.fecha_factura,
          subtotal: parseFloat(Number(factura.subtotal || 0).toFixed(2)),
          descuento: parseFloat(Number(factura.descuento || factura.descuento_total || 0).toFixed(2)),
          impuesto: parseFloat(Number(factura.impuesto || factura.impuesto_total || 0).toFixed(2)),
          total: parseFloat(Number(factura.total || factura.total_factura || 0).toFixed(2)),
          monto_pagado: parseFloat(Number(factura.monto_pagado || 0).toFixed(2)),
          balance_pendiente: parseFloat(Number(factura.balance_pendiente || 0).toFixed(2)),
          estado: factura.estado,
          observacion: factura.observacion || "",
          fecha_creacion: factura.fecha_creacion,
          usuario_creacion_nombre: factura.usuario_creacion_nombre || "Sistema",
          motivo_anulacion: (factura.motivo_anulacion as string) || null,
          fecha_anulacion: (factura.fecha_anulacion as string) || null,
          usuario_anulacion_nombre: (factura.usuario_anulacion_nombre as string) || null
        },
        cliente,
        orden_trabajo: ordenTrabajo,
        detalle,
        pagos,
        empresa,
        permisos: perms
      }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en GET /api/facturacion/facturas/[id]:", err);
    return NextResponse.json(
      {
        error: "ERROR_DETALLE_FACTURA",
        message: "No se pudo obtener el detalle de la factura.",
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
