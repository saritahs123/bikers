import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    // Check Módulo 7 (TALLER) puede_ver permission
    const perms = await getModulePermissions(7, session.rol_principal_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para ver el Panel Operativo de Taller." }, { status: 403 });
    }

    const empresaId = session.empresa_id;

    // 1. Recepciones Hoy
    const recHoyRows = await query(`
      SELECT COUNT(r.recepcion_id)::int as total
      FROM admin.recepciones r
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1)
        AND (r.fecha_recepcion AT TIME ZONE 'America/Santo_Domingo')::date = (now() AT TIME ZONE 'America/Santo_Domingo')::date
        AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
    `, [empresaId]);
    const recepciones_hoy = recHoyRows[0]?.total || 0;

    // 2. Órdenes Activas (codigo NOT IN 'LISTA_ENTREGA', 'ENTREGADA')
    const ordActRows = await query(`
      SELECT COUNT(ot.orden_trabajo_id)::int as total
      FROM admin.ordenes_trabajo ot
      JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      WHERE eot.codigo NOT IN ('LISTA_ENTREGA', 'ENTREGADA')
        AND (ot.activo = true OR ot.activo IS NULL)
    `);
    const ordenes_activas = ordActRows[0]?.total || 0;

    // 3. Pendientes Aprobación
    const pendAprobRows = await query(`
      SELECT COUNT(r.recepcion_id)::int as total
      FROM admin.recepciones r
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1)
        AND r.requiere_aprobacion = true 
        AND r.aprobado_cliente IS NULL 
        AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
    `, [empresaId]);
    const pendientes_aprobacion = pendAprobRows[0]?.total || 0;

    // 4. Entregas Programadas Hoy
    const entregasHoyRows = await query(`
      SELECT COUNT(r.recepcion_id)::int as total
      FROM admin.recepciones r
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1)
        AND (r.fecha_entrega_estimada AT TIME ZONE 'America/Santo_Domingo')::date = (now() AT TIME ZONE 'America/Santo_Domingo')::date
        AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
    `, [empresaId]);
    const entregas_programadas_hoy = entregasHoyRows[0]?.total || 0;

    // 5. Recepciones Recientes (10 más recientes)
    const recRecientes = await query(`
      SELECT r.recepcion_id, r.codigo_recepcion, r.fecha_recepcion, r.presupuesto_estimado, r.requiere_aprobacion, r.aprobado_cliente,
             c.nombre_completo as cliente_nombre,
             CONCAT(b.marca, ' ', b.modelo) as bicicleta_resumen,
             er.nombre as estado_nombre, er.codigo as estado_codigo
      FROM admin.recepciones r
      LEFT JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
      ORDER BY r.recepcion_id DESC
      LIMIT 10
    `, [empresaId]);

    return NextResponse.json({
      success: true,
      data: {
        recepciones_hoy,
        ordenes_activas,
        pendientes_aprobacion,
        entregas_programadas_hoy,
        recepciones_recientes: (recRecientes || []).map((r: any) => ({
          recepcion_id: r.recepcion_id,
          codigo_recepcion: r.codigo_recepcion,
          fecha_recepcion: r.fecha_recepcion,
          cliente_nombre: r.cliente_nombre || "Cliente General",
          bicicleta_resumen: r.bicicleta_resumen || "Bicicleta",
          estado_nombre: r.estado_nombre || "INGRESADO",
          estado_codigo: r.estado_codigo || "INGRESADO",
          presupuesto_estimado: Number(r.presupuesto_estimado || 0),
          requiere_aprobacion: Boolean(r.requiere_aprobacion)
        }))
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/dashboard:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible obtener los datos del panel operativo. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}
