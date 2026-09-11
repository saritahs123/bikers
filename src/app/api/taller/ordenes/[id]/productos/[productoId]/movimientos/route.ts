import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; productoId: string }> }
) {
  const { id, productoId } = await context.params;

  if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden inválido." },
      { status: 400 }
    );
  }

  if (!productoId || typeof productoId !== "string" || !/^\d+$/.test(productoId.trim())) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de línea de producto inválido." },
      { status: 400 }
    );
  }

  const ordenTrabajoId = Number(id.trim());
  const ordenProductoId = Number(productoId.trim());

  if (!Number.isSafeInteger(ordenTrabajoId) || ordenTrabajoId <= 0 ||
      !Number.isSafeInteger(ordenProductoId) || ordenProductoId <= 0) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "Identificador de orden o repuesto inválido." },
      { status: 400 }
    );
  }

  try {
    // 1. Validar sesión
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    // 2. Validar permisos canónicos del módulo TALLER
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver && session.rol_principal_id !== 1) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para consultar información de esta orden." },
        { status: 403 }
      );
    }

    // 3. Validación jerárquica de tenant y pertenencia:
    // orden_producto -> orden_trabajo -> cliente -> empresa_id
    const lineCheckSql = `
      SELECT
        op.orden_producto_id,
        op.orden_trabajo_id,
        op.producto_id,
        op.almacen_id,
        op.cantidad,
        op.precio_unitario,
        op.subtotal,
        op.utilizado,
        p.nombre AS producto_nombre,
        p.codigo_producto,
        alm.nombre AS almacen_nombre,
        alm.codigo AS almacen_codigo,
        ot.codigo_orden,
        c.empresa_id
      FROM admin.orden_productos op
      JOIN admin.ordenes_trabajo ot ON op.orden_trabajo_id = ot.orden_trabajo_id
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      JOIN admin.productos p ON op.producto_id = p.producto_id
      LEFT JOIN admin.almacenes alm ON op.almacen_id = alm.almacen_id
      WHERE op.orden_producto_id = $1
        AND op.orden_trabajo_id = $2
        AND c.empresa_id = $3
        AND ot.activo = true
    `;

    interface LineCheckRow {
      orden_producto_id: number;
      orden_trabajo_id: number;
      producto_id: number;
      almacen_id: number | null;
      cantidad: string | number;
      precio_unitario: string | number;
      subtotal: string | number;
      utilizado: boolean;
      producto_nombre: string;
      codigo_producto: string;
      almacen_nombre: string | null;
      almacen_codigo: string | null;
      codigo_orden: string;
      empresa_id: number;
    }

    const lineRows = await query<LineCheckRow>(lineCheckSql, [ordenProductoId, ordenTrabajoId, session.empresa_id]);

    if (!lineRows || lineRows.length === 0) {
      // Patrón anti-IDOR certificado de Taller: 404 sin filtrar si el ID existe en otra empresa
      return NextResponse.json(
        { error: "NOT_FOUND", message: "La línea de repuesto solicitada no existe o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    const item = lineRows[0];

    // 4. Consulta estructurada de movimientos en admin.movimientos_inventario
    // Filtro estricto por orden_producto_id, orden_trabajo_id y empresa_id
    const movementsSql = `
      SELECT
        mi.movimiento_inventario_id,
        mi.codigo_movimiento,
        mi.tipo_movimiento_id,
        tmi.codigo AS tipo_movimiento_codigo,
        tmi.nombre AS tipo_movimiento_nombre,
        tmi.naturaleza,
        mi.cantidad::numeric AS cantidad,
        COALESCE(mi.costo_unitario, 0)::numeric AS costo_unitario,
        COALESCE(mi.costo_total, 0)::numeric AS costo_total,
        COALESCE(mi.stock_anterior, 0)::numeric AS stock_anterior,
        COALESCE(mi.stock_nuevo, 0)::numeric AS stock_nuevo,
        mi.fecha_movimiento,
        mi.referencia,
        mi.observacion,
        mi.orden_trabajo_id,
        mi.orden_producto_id,
        mi.movimiento_origen_id,
        orig.codigo_movimiento AS codigo_movimiento_origen,
        mi.usuario_movimiento,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, 'Usuario no disponible') AS usuario_nombre
      FROM admin.movimientos_inventario mi
      JOIN admin.tipo_movimiento_inventario tmi ON mi.tipo_movimiento_id = tmi.tipo_movimiento_id
      LEFT JOIN admin.movimientos_inventario orig ON mi.movimiento_origen_id = orig.movimiento_inventario_id AND orig.empresa_id = mi.empresa_id
      LEFT JOIN admin.usuario u ON mi.usuario_movimiento = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON mi.usuario_movimiento = ui.usuario_id
      WHERE mi.orden_producto_id = $1
        AND mi.orden_trabajo_id = $2
        AND mi.empresa_id = $3
      ORDER BY mi.fecha_movimiento DESC, mi.movimiento_inventario_id DESC
    `;

    interface MovementRow {
      movimiento_inventario_id: number;
      codigo_movimiento: string;
      tipo_movimiento_id: number;
      tipo_movimiento_codigo: string;
      tipo_movimiento_nombre: string;
      naturaleza: string;
      cantidad: string | number;
      costo_unitario: string | number;
      costo_total: string | number;
      stock_anterior: string | number;
      stock_nuevo: string | number;
      fecha_movimiento: string;
      referencia: string | null;
      observacion: string | null;
      orden_trabajo_id: number;
      orden_producto_id: number;
      movimiento_origen_id: number | null;
      codigo_movimiento_origen: string | null;
      usuario_movimiento: number | null;
      usuario_nombre: string;
    }

    const movRows = await query<MovementRow>(movementsSql, [ordenProductoId, ordenTrabajoId, session.empresa_id]);

    const formattedMovements = (movRows || []).map((m: MovementRow) => ({
      movimiento_inventario_id: m.movimiento_inventario_id,
      codigo_movimiento: m.codigo_movimiento,
      tipo_movimiento_id: m.tipo_movimiento_id,
      tipo_movimiento_codigo: m.tipo_movimiento_codigo,
      tipo_movimiento_nombre: m.tipo_movimiento_nombre,
      naturaleza: m.naturaleza,
      cantidad: Number(m.cantidad || 0),
      costo_unitario: Number(m.costo_unitario || 0),
      costo_total: Number(m.costo_total || 0),
      stock_anterior: Number(m.stock_anterior || 0),
      stock_nuevo: Number(m.stock_nuevo || 0),
      fecha_movimiento: m.fecha_movimiento,
      referencia: m.referencia,
      observacion: m.observacion,
      orden_trabajo_id: m.orden_trabajo_id,
      orden_producto_id: m.orden_producto_id,
      movimiento_origen_id: m.movimiento_origen_id,
      codigo_movimiento_origen: m.codigo_movimiento_origen || null,
      es_reverso: Boolean(m.movimiento_origen_id),
      reversa_a: m.codigo_movimiento_origen || null,
      usuario_nombre: m.usuario_nombre
    }));

    return NextResponse.json({
      success: true,
      data: {
        linea: {
          orden_producto_id: item.orden_producto_id,
          orden_trabajo_id: item.orden_trabajo_id,
          codigo_orden: item.codigo_orden,
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          codigo_producto: item.codigo_producto,
          almacen_id: item.almacen_id,
          almacen_nombre: item.almacen_nombre || `Almacén #${item.almacen_id}`,
          cantidad: Number(item.cantidad || 0),
          utilizado: item.utilizado === true,
          estado_inventario: item.utilizado === true ? "CONSUMIDO" : "RESERVADO"
        },
        movimientos: formattedMovements
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("GET /api/taller/ordenes/[id]/productos/[productoId]/movimientos error:", error);
    const msg = error instanceof Error ? error.message : "Error al obtener movimientos de la línea de repuesto.";
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: msg },
      { status: 500 }
    );
  }
}
