import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// POST /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId: servIdStr } = await params;
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
    const servicioId = parseInt(servIdStr, 10);

    if (isNaN(ordenId) || isNaN(servicioId)) {
      client.release();
      return NextResponse.json({ error: "IDs no válidos." }, { status: 400 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_editar) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para modificar la mano de obra." }, { status: 403 });
    }

    const body = await req.json();
    const { mecanico_usuario_id, minutos_trabajados, costo_hora_personalizado, motivo_gratuito, horas_reales, costo_hora } = body;

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
    if (estadoOrdenId === 8 || estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se puede agregar mano de obra en el estado actual de la orden." }, { status: 409 });
    }

    // Verify service exists
    const servRes = await client.query(`
      SELECT orden_servicio_id, tipo_servicio_id, usuario_id
      FROM admin.orden_servicios
      WHERE orden_servicio_id = $1 AND orden_trabajo_id = $2 AND (activo IS DISTINCT FROM false)
    `, [servicioId, ordenId]);

    if (servRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const serv = servRes.rows[0];
    const mecUserId = mecanico_usuario_id ? parseInt(mecanico_usuario_id, 10) : (serv.usuario_id || sessionUserId);
    
    const rawHours = horas_reales ?? body.horas_trabajadas;
    const mins = (rawHours !== undefined && rawHours !== null && rawHours !== "" && !isNaN(parseFloat(rawHours)))
      ? Math.max(1, Math.round(parseFloat(rawHours) * 60))
      : Math.max(1, parseInt(minutos_trabajados || "60", 10));

    // Determine hourly rate safely
    let rate = 0.00;
    const customRate = costo_hora_personalizado ?? costo_hora;
    if (customRate !== undefined && customRate !== null && customRate !== "") {
      const parsedRate = parseFloat(customRate);
      if (parsedRate === 0) {
        if (!motivo_gratuito || !motivo_gratuito.trim()) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "WARRANTY_REASON_REQUIRED",
            message: "Para registrar mano de obra a costo 0.00 (garantía/trabajo gratuito), se requiere un motivo obligatorio."
          }, { status: 400 });
        }
        rate = 0.00;
      } else {
        rate = Math.max(0, parsedRate);
      }
    } else {
      const tsRes = await client.query(`SELECT precio_base, duracion_estimada_horas FROM admin.tipo_servicio WHERE tipo_servicio_id = $1`, [serv.tipo_servicio_id]);
      if (tsRes.rows.length > 0) {
        const pb = parseFloat(tsRes.rows[0].precio_base || 0);
        const dur = parseFloat(tsRes.rows[0]?.duracion_estimada_horas || 1);
        rate = dur > 0 ? Math.round((pb / dur) * 100) / 100 : pb;
      }
    }

    const costoTotal = Math.round(((mins / 60.0) * rate) * 100) / 100;

    // Insert Manual Closed Labor Session
    const insertLaborSql = `
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_mano_obra_id,
        orden_servicio_id,
        usuario_id,
        fecha_inicio,
        fecha_finalizacion,
        minutos_trabajados,
        minutos_facturables,
        costo_hora,
        costo_total,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_servicio_mano_obra_id), 0) + 1 FROM admin.orden_servicio_mano_obra),
        $1, $2, NOW() - ($3::integer || ' minutes')::interval, NOW(), $3::integer, $3::integer, $4, $5, true, NOW(), $6
      )
      RETURNING orden_servicio_mano_obra_id AS mano_obra_id
    `;

    const laborRes = await client.query(insertLaborSql, [
      servicioId,
      mecUserId,
      mins,
      rate,
      costoTotal,
      sessionUserId
    ]);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      data: { mano_obra_id: laborRes.rows[0].mano_obra_id },
      message: "Registro de mano de obra añadido exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al registrar mano de obra.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; servicioId: string }> }
) {
  const { id, servicioId: servIdStr } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      client.release();
      return NextResponse.json({ error: "NO_SESSION", message: "Sesión no válida o expirada." }, { status: 401 });
    }
    const ordenId = parseInt(id, 10);
    const servicioId = parseInt(servIdStr, 10);

    const { searchParams } = new URL(req.url);
    const rawManoObraId = searchParams.get("mano_obra_id") || searchParams.get("orden_servicio_mano_obra_id");
    const manoObraId = parseInt(rawManoObraId || "0", 10);

    if (isNaN(ordenId) || isNaN(servicioId) || isNaN(manoObraId) || manoObraId <= 0) {
      client.release();
      return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
    }

    const perms = await getModulePermissions(6, session.rol_principal_id);
    if (!perms.puede_editar) {
      client.release();
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso para eliminar mano de obra." }, { status: 403 });
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
    if (estadoOrdenId === 8 || estadoOrdenId === 7) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ORDER_LOCKED", message: "No se puede eliminar mano de obra en el estado actual de la orden." }, { status: 409 });
    }

    // Delete Labor Record
    const deleteRes = await client.query(`
      DELETE FROM admin.orden_servicio_mano_obra
      WHERE orden_servicio_mano_obra_id = $1 AND orden_servicio_id = $2
    `, [manoObraId, servicioId]);

    if (deleteRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Registro de mano de obra no encontrado." }, { status: 404 });
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Registro de mano de obra eliminado exitosamente."
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /api/taller/ordenes/[id]/servicios/[servicioId]/mano-obra Error:", err);
    return NextResponse.json({ error: "Error al eliminar mano de obra.", details: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
