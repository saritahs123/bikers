import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// POST /api/taller/ordenes/[id]/servicios
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      client.release();
      return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
    }
    const sessionUserId = session.usuario_id;
    const ordenId = parseInt(id, 10);

    if (isNaN(ordenId)) {
      client.release();
      return NextResponse.json({ error: "ID de orden no válido." }, { status: 400 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_editar) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar servicios en las órdenes de trabajo." }, { status: 403 });
    }

    const body = await req.json();
    const {
      tipo_servicio_id,
      mecanico_usuario_id,
      precio_unitario,
      cantidad,
      porcentaje_descuento,
      motivo,
      confirmar
    } = body;

    if (!tipo_servicio_id) {
      client.release();
      return NextResponse.json({ error: "El tipo de servicio es un campo obligatorio." }, { status: 400 });
    }

    await client.query("BEGIN");

    // Lock Order Row Exclusively
    const orderRes = await client.query(`
      SELECT orden_trabajo_id, estado_orden_id
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND activo = true
      FOR UPDATE OF ordenes_trabajo
    `, [ordenId]);

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = orderRes.rows[0].estado_orden_id;

    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "READ_ONLY_ORDER", message: "La orden se encuentra ENTREGADA y está en solo lectura." }, { status: 409 });
    }

    if (estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_IN_DELIVERY", message: "No se pueden agregar servicios a una orden en Lista de Entrega. Devuélvala a reparación primero." }, { status: 409 });
    }

    // Addition in REPARACION requires explicit confirmation and motivo
    if (estadoOrdenId === 5) {
      if (!confirmar || !motivo || !motivo.trim()) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "CONFIRMATION_REQUIRED",
          message: "Para agregar un servicio a una orden en Reparación, se requiere confirmación explícita y motivo obligatorio."
        }, { status: 400 });
      }
    }

    // Verify mechanic if provided
    let mecUserId = mecanico_usuario_id ? parseInt(mecanico_usuario_id, 10) : null;
    if (mecUserId) {
      const mecCheck = await client.query(`
        SELECT u.usuario_id
        FROM admin.usuario u
        JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
        WHERE u.usuario_id = $1 AND u.estado = 'ACTIVO' AND tu.codigo = 'MECANICO'
      `, [mecUserId]);

      if (mecCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "INVALID_MECHANIC", message: "El mecánico asignado no es válido o no está activo." }, { status: 400 });
      }
    }

    // Get Service base price if not supplied
    let precio = parseFloat(precio_unitario);
    if (isNaN(precio) || precio < 0) {
      const tsRes = await client.query(`SELECT precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1 AND activo = true`, [parseInt(tipo_servicio_id, 10)]);
      if (tsRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "El tipo de servicio especificado no existe." }, { status: 404 });
      }
      precio = parseFloat(tsRes.rows[0].precio_base || 0);
    }

    const qty = parseInt(cantidad || "1", 10);
    const descPct = Math.min(100, Math.max(0, parseFloat(porcentaje_descuento || "0")));
    const bruto = qty * precio;
    const valorDesc = Math.min(bruto, Math.round((bruto * (descPct / 100.0)) * 100) / 100);
    const subtotal = Math.max(0, bruto - valorDesc);

    // Initial state is PENDIENTE (1)
    const insertServSql = `
      INSERT INTO admin.orden_servicios (
        orden_servicio_id,
        orden_trabajo_id,
        tipo_servicio_id,
        estado_orden_servicio_id,
        estado_aprobacion_id,
        precio_unitario,
        cantidad,
        porcentaje_descuento,
        valor_descuento,
        subtotal,
        usuario_id,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
        $1, $2, 1, 2, $3, $4, $5, $6, $7, $8, true, NOW(), $9
      )
      RETURNING orden_servicio_id
    `;

    const newServRes = await client.query(insertServSql, [
      ordenId,
      parseInt(tipo_servicio_id, 10),
      precio,
      qty,
      descPct,
      valorDesc,
      subtotal,
      mecUserId,
      sessionUserId
    ]);

    const newServId = newServRes.rows[0].orden_servicio_id;

    // Recalculate Order Financial Totals
    await client.query(`
      UPDATE admin.ordenes_trabajo ot
      SET 
        subtotal_servicios = COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0),
        subtotal_productos = COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        descuento_servicios = COALESCE((SELECT SUM(valor_descuento) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0),
        descuento_productos = COALESCE((SELECT SUM(valor_descuento) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        subtotal_general = COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0) + 
                           COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0),
        total_orden = GREATEST(0, ROUND(
          (COALESCE((SELECT SUM(subtotal) FROM admin.orden_servicios WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)), 0) + 
           COALESCE((SELECT SUM(subtotal) FROM admin.orden_productos WHERE orden_trabajo_id = $1), 0)) + COALESCE(ot.impuesto, 0), 2
        )),
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $2
      WHERE ot.orden_trabajo_id = $1
    `, [ordenId, sessionUserId]);

    // History record
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
    `, [
      ordenId,
      estadoOrdenId,
      sessionUserId,
      `Servicio adicional agregado (ID #${newServId})${motivo ? `: ${motivo}` : ''}`
    ]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      data: { servicio_id: newServId },
      message: "Servicio agregado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios Error:", err);
    return NextResponse.json({ error: "Error al agregar servicio.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
