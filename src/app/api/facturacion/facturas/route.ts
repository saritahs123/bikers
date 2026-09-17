import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { crearFactura } from "@/lib/billing/billingService";
import { CrearFacturaInput, TipoLineaFactura } from "@/lib/billing/billingTypes";
import { StockInsuficienteError, InventoryError } from "@/lib/inventory/inventoryMovementService";

export const dynamic = "force-dynamic";

interface FacturaListRow {
  factura_id: number;
  empresa_id: number;
  codigo_factura: string;
  numero_factura: string | null;
  tipo_factura_id: number;
  tipo_factura_codigo: string;
  tipo_factura_nombre: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  cliente_identificacion: string | null;
  cliente_telefono: string | null;
  cliente_correo: string | null;
  orden_trabajo_id: number | null;
  codigo_orden: string | null;
  fecha_factura: string | Date;
  subtotal: number | string;
  descuento: number | string;
  descuento_total: number | string | null;
  impuesto: number | string;
  impuesto_total: number | string | null;
  total: number | string;
  total_factura: number | string | null;
  monto_pagado: number | string;
  balance_pendiente: number | string;
  estado: string;
  observacion: string | null;
  fecha_creacion: string | Date;
  total_lineas: number;
}

interface MetricasRow {
  total_facturas: number | string;
  facturado: number | string;
  pagado: number | string;
  pendiente: number | string;
}

export async function GET(request: NextRequest) {
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
        { error: "FORBIDDEN", message: "No tienes permisos para consultar facturación." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || "").trim();
    const estado = (searchParams.get("estado") || "").trim().toUpperCase();
    const tipoFactura = (searchParams.get("tipo_factura") || "").trim();
    const fechaDesde = (searchParams.get("fecha_desde") || "").trim();
    const fechaHasta = (searchParams.get("fecha_hasta") || "").trim();

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const offset = (page - 1) * limit;

    const sortByParam = (searchParams.get("sortBy") || "fecha_factura").toLowerCase();
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

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

    const colObservacion = facCols.has("observacion")
      ? "COALESCE(f.observacion, '')"
      : "''";

    const colMontoPagado = facCols.has("monto_pagado")
      ? "COALESCE(f.monto_pagado, 0)"
      : "0";

    const colBalancePendiente = facCols.has("balance_pendiente")
      ? `COALESCE(f.balance_pendiente, ${colTotal})`
      : `GREATEST(0, (${colTotal} - ${colMontoPagado}))`;

    const colEmpresa = "f.empresa_id";

    const colCondicion = facCols.has("condicion_venta")
      ? "f.condicion_venta"
      : "'CONTADO'";

    const sortColumns: Record<string, string> = {
      factura_id: "f.factura_id",
      codigo_factura: colCodigo,
      numero_factura: colNumero,
      fecha_factura: "f.fecha_factura",
      fecha_creacion: colFechaCreacion,
      total: colTotal,
      monto_pagado: colMontoPagado,
      balance_pendiente: colBalancePendiente,
      estado: "f.estado",
      cliente: "c.nombre_completo"
    };
    const sortColumn = sortColumns[sortByParam] || "f.fecha_factura";

    const conditions: string[] = ["f.empresa_id = $1"];
    const params: (number | string)[] = [empresaId];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(${colCodigo} ILIKE $${paramIndex} OR c.nombre_completo ILIKE $${paramIndex} OR c.identificacion ILIKE $${paramIndex} OR ot.codigo_orden ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (estado && estado !== "TODOS") {
      conditions.push(`f.estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (tipoFactura && tipoFactura !== "TODOS") {
      if (!isNaN(Number(tipoFactura))) {
        conditions.push(`f.tipo_factura_id = $${paramIndex}`);
        params.push(Number(tipoFactura));
      } else {
        conditions.push(`COALESCE(tf.codigo, 'VENTA_DIRECTA') = $${paramIndex}`);
        params.push(tipoFactura);
      }
      paramIndex++;
    }

    if (fechaDesde) {
      conditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date >= $${paramIndex}::date`);
      params.push(fechaDesde);
      paramIndex++;
    }

    if (fechaHasta) {
      conditions.push(`(f.fecha_factura AT TIME ZONE 'America/Santo_Domingo')::date <= $${paramIndex}::date`);
      params.push(fechaHasta);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // 1. Consulta agregada de métricas y conteo total (Sección 2)
    const metricasSql = `
      SELECT
        COUNT(*)::int AS total_facturas,
        COALESCE(SUM(CASE WHEN f.estado <> 'ANULADA' THEN ${colTotal} ELSE 0 END), 0)::numeric AS facturado,
        COALESCE(SUM(CASE WHEN f.estado <> 'ANULADA' THEN ${colMontoPagado} ELSE 0 END), 0)::numeric AS pagado,
        COALESCE(SUM(CASE WHEN f.estado <> 'ANULADA' THEN ${colBalancePendiente} ELSE 0 END), 0)::numeric AS pendiente
      FROM admin.facturas f
      LEFT JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      WHERE ${whereClause};
    `;
    const metricasRes = await query<MetricasRow>(metricasSql, params);
    const metricasRow = metricasRes[0] || {
      total_facturas: 0,
      facturado: 0,
      pagado: 0,
      pendiente: 0
    };

    const totalRecords = Number(metricasRow.total_facturas || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    // 2. Consulta de registros paginados
    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const listSql = `
      SELECT
        f.factura_id,
        ${colEmpresa} AS empresa_id,
        ${colCodigo} AS codigo_factura,
        ${colNumero} AS numero_factura,
        f.tipo_factura_id,
        ${colCondicion} AS condicion_venta,
        COALESCE(tf.codigo, 'VENTA_DIRECTA') AS tipo_factura_codigo,
        COALESCE(tf.nombre, 'Venta Directa') AS tipo_factura_nombre,
        f.cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        c.telefono_principal AS cliente_telefono,
        c.correo AS cliente_correo,
        f.orden_trabajo_id,
        ot.codigo_orden,
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
        (SELECT COUNT(*)::int FROM admin.detalle_factura df WHERE df.factura_id = f.factura_id) AS total_lineas
      FROM admin.facturas f
      LEFT JOIN admin.tipo_factura tf ON f.tipo_factura_id = tf.tipo_factura_id
      LEFT JOIN admin.clientes c ON f.cliente_id = c.cliente_id
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrderParam}, f.factura_id DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const rawRows = await query<FacturaListRow & { condicion_venta?: string }>(listSql, listParams);

    const data = (rawRows || []).map((row) => ({
      factura_id: Number(row.factura_id),
      empresa_id: Number(row.empresa_id),
      codigo_factura: row.codigo_factura,
      numero_factura: row.numero_factura || row.codigo_factura,
      tipo_factura_id: Number(row.tipo_factura_id),
      tipo_factura_codigo: row.tipo_factura_codigo || "VENTA_DIRECTA",
      tipo_factura_nombre: row.tipo_factura_nombre || "Venta Directa",
      condicion_venta: (row.condicion_venta as "CONTADO" | "CREDITO") || "CONTADO",
      cliente_id: row.cliente_id ? Number(row.cliente_id) : null,
      cliente_nombre: row.cliente_nombre || "Cliente General",
      cliente_identificacion: row.cliente_identificacion || "",
      cliente_telefono: row.cliente_telefono || "",
      cliente_correo: row.cliente_correo || "",
      orden_trabajo_id: row.orden_trabajo_id ? Number(row.orden_trabajo_id) : null,
      codigo_orden: row.codigo_orden || null,
      fecha_factura: row.fecha_factura,
      subtotal: parseFloat(Number(row.subtotal || 0).toFixed(2)),
      descuento: parseFloat(Number(row.descuento || row.descuento_total || 0).toFixed(2)),
      impuesto: parseFloat(Number(row.impuesto || row.impuesto_total || 0).toFixed(2)),
      total: parseFloat(Number(row.total || row.total_factura || 0).toFixed(2)),
      monto_pagado: parseFloat(Number(row.monto_pagado || 0).toFixed(2)),
      balance_pendiente: parseFloat(Number(row.balance_pendiente || 0).toFixed(2)),
      estado: row.estado,
      observacion: row.observacion || "",
      fecha_creacion: row.fecha_creacion,
      total_lineas: Number(row.total_lineas || 0)
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalRecords,
        totalPages
      },
      metricas: {
        facturado: parseFloat(Number(metricasRow.facturado || 0).toFixed(2)),
        pagado: parseFloat(Number(metricasRow.pagado || 0).toFixed(2)),
        pendiente: parseFloat(Number(metricasRow.pendiente || 0).toFixed(2)),
        total_facturas: totalRecords
      }
    });
  } catch (err) {
    console.error("Error en GET /api/facturacion/facturas:", err);
    return NextResponse.json(
      {
        error: "ERROR_LISTADO_FACTURAS",
        message: "No se pudieron consultar las facturas emitidas."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para crear facturas." },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.tipo_factura_id || isNaN(Number(body.tipo_factura_id))) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El tipo de factura es obligatorio." },
        { status: 400 }
      );
    }

    if (!body.lineas || !Array.isArray(body.lineas) || body.lineas.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Debe agregar al menos una línea de detalle a la factura." },
        { status: 400 }
      );
    }

    interface RawLineaInput {
      tipo_linea?: string;
      almacen_id?: number | string | null;
      producto_id?: number | string | null;
      tipo_servicio_id?: number | string | null;
      orden_servicio_id?: number | string | null;
      orden_producto_id?: number | string | null;
      codigo?: string | null;
      descripcion?: string;
      cantidad?: number | string;
      precio_unitario?: number | string;
      descuento?: number | string;
      costo_unitario?: number | string | null;
    }

    interface RawPagoInput {
      tipo_pago_id?: number | string;
      monto?: number | string;
      monto_recibido?: number | string | null;
      monto_devuelta?: number | string | null;
      referencia?: string | null;
      observacion?: string | null;
      fecha_pago?: string | Date;
    }

    const condicionVenta: "CONTADO" | "CREDITO" = body.condicion_venta === "CREDITO" ? "CREDITO" : "CONTADO";

    let pagosIniciales: {
      tipo_pago_id: number;
      monto: number;
      monto_recibido?: number | null;
      monto_devuelta?: number | null;
      referencia?: string | null;
      observacion?: string | null;
      fecha_pago?: string | Date;
    }[] = [];

    if (condicionVenta === "CONTADO") {
      if (body.pago && body.pago.tipo_pago_id) {
        pagosIniciales = [{
          tipo_pago_id: Number(body.pago.tipo_pago_id),
          monto: Number(body.pago.monto || 0),
          monto_recibido: body.pago.monto_recibido != null ? Number(body.pago.monto_recibido) : null,
          monto_devuelta: body.pago.monto_devuelta != null ? Number(body.pago.monto_devuelta) : null,
          referencia: body.pago.referencia ? String(body.pago.referencia).trim() : null,
          observacion: body.pago.observacion ? String(body.pago.observacion).trim() : null,
          fecha_pago: body.pago.fecha_pago || new Date()
        }];
      } else if (Array.isArray(body.pagos_iniciales) && body.pagos_iniciales.length > 0) {
        pagosIniciales = (body.pagos_iniciales as RawPagoInput[]).map((p: RawPagoInput) => ({
          tipo_pago_id: Number(p.tipo_pago_id || 0),
          monto: Number(p.monto || 0),
          monto_recibido: p.monto_recibido != null ? Number(p.monto_recibido) : null,
          monto_devuelta: p.monto_devuelta != null ? Number(p.monto_devuelta) : null,
          referencia: p.referencia ? String(p.referencia).trim() : null,
          observacion: p.observacion ? String(p.observacion).trim() : null,
          fecha_pago: p.fecha_pago || new Date()
        }));
      } else if (body.tipo_pago_id) {
        pagosIniciales = [{
          tipo_pago_id: Number(body.tipo_pago_id),
          monto: Number(body.monto || 0),
          monto_recibido: body.monto_recibido != null ? Number(body.monto_recibido) : null,
          monto_devuelta: body.monto_devuelta != null ? Number(body.monto_devuelta) : null,
          referencia: body.referencia ? String(body.referencia).trim() : null,
          observacion: body.observacion ? String(body.observacion).trim() : null,
          fecha_pago: new Date()
        }];
      } else {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", message: "Debe seleccionar un tipo de pago para ventas al contado." },
          { status: 400 }
        );
      }
    }

    const input: CrearFacturaInput = {
      empresa_id: session.empresa_id,
      tipo_factura_id: Number(body.tipo_factura_id),
      condicion_venta: condicionVenta,
      cliente_id: body.cliente_id ? Number(body.cliente_id) : null,
      orden_trabajo_id: body.orden_trabajo_id ? Number(body.orden_trabajo_id) : null,
      fecha_factura: body.fecha_factura || new Date(),
      observacion: body.observacion ? String(body.observacion).trim() : null,
      usuario_id: session.usuario_id,
      lineas: (body.lineas as RawLineaInput[]).map((l: RawLineaInput) => ({
        tipo_linea: (l.tipo_linea as TipoLineaFactura) || "PRODUCTO",
        almacen_id: l.almacen_id ? Number(l.almacen_id) : null,
        producto_id: l.producto_id ? Number(l.producto_id) : null,
        tipo_servicio_id: l.tipo_servicio_id ? Number(l.tipo_servicio_id) : null,
        orden_servicio_id: l.orden_servicio_id ? Number(l.orden_servicio_id) : null,
        orden_producto_id: l.orden_producto_id ? Number(l.orden_producto_id) : null,
        codigo: l.codigo ? String(l.codigo).trim() : null,
        descripcion: String(l.descripcion || "").trim(),
        cantidad: Number(l.cantidad || 0),
        precio_unitario: Number(l.precio_unitario || 0),
        descuento: Number(l.descuento || 0),
        costo_unitario: l.costo_unitario != null ? Number(l.costo_unitario) : null
      })),
      pagos_iniciales: pagosIniciales
    };

    const result = await crearFactura(input);

    return NextResponse.json(
      {
        success: true,
        message: `Factura ${result.factura.codigo_factura} creada exitosamente.`,
        factura: result.factura,
        detalles: result.detalles,
        pagos: result.pagos
      },
      { status: 201 }
    );

  } catch (err: unknown) {
    console.error("Error en POST /api/facturacion/facturas:", err);

    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorCode = err instanceof InventoryError ? err.code : (err as { code?: string })?.code;
    const errorDetails = err instanceof InventoryError ? err.details : (err as { details?: Record<string, unknown> })?.details;

    // Concurrencia y duplicados de OT (Sección 15: 409 OT_YA_FACTURADA)
    const constraintName = (err as { constraint?: string })?.constraint;
    if (
      errorCode === "OT_YA_FACTURADA" ||
      constraintName === "uq_facturas_empresa_orden_activa" ||
      (errorCode === "23505" && String(errorObj.message).includes("orden_trabajo"))
    ) {
      return NextResponse.json(
        {
          error: "OT_YA_FACTURADA",
          message: errorObj.message || "La orden de trabajo ya cuenta con una factura activa."
        },
        { status: 409 }
      );
    }

    // Estado no facturable de la OT (Sección 2 y 14)
    if (errorCode === "OT_ESTADO_INVALIDO") {
      return NextResponse.json(
        {
          error: "OT_ESTADO_INVALIDO",
          message: errorObj.message
        },
        { status: 422 }
      );
    }

    if (errorCode === "CLIENTE_OT_INCONSISTENTE") {
      return NextResponse.json(
        {
          error: "CLIENTE_OT_INCONSISTENTE",
          message: errorObj.message
        },
        { status: 400 }
      );
    }

    if (err instanceof StockInsuficienteError || errorCode === "STOCK_DISPONIBLE_INSUFICIENTE" || errorCode === "STOCK_INSUFICIENTE") {
      return NextResponse.json(
        {
          error: "STOCK_INSUFICIENTE",
          message: errorObj.message,
          details: errorDetails
        },
        { status: 409 }
      );
    }

    if (err instanceof InventoryError) {
      return NextResponse.json(
        {
          error: err.code || "INVENTORY_ERROR",
          message: err.message,
          details: err.details
        },
        { status: err.status || 400 }
      );
    }

    const message = (err as Error)?.message || "Ocurrió un error inesperado al procesar la factura.";
    return NextResponse.json(
      {
        error: "ERROR_FACTURACION",
        message
      },
      { status: 400 }
    );
  }
}
