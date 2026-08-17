import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    // Check Módulo TALLER puede_ver permission
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para ver el Panel Operativo de Taller." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No fue posible determinar la empresa del usuario." }, { status: 403 });
    }

    // 1. Órdenes Activas de la empresa (estado != 8 'ENTREGADA')
    const ordActRows = await query<any>(`
      SELECT COUNT(ot.orden_trabajo_id)::int as total
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      WHERE u_ot.empresa_id = $1
        AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8)
        AND (ot.activo IS DISTINCT FROM false)
    `, [empresaId]);

    const ordenes_activas = ordActRows[0]?.total || 0;

    // 2. Mecánicos Disponibles de la empresa
    const mecanicosRows = await query<any>(`
      SELECT u.usuario_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), CONCAT('Mecánico #', u.usuario_id)) AS nombre_completo,
             ui.nombre AS primer_nombre,
             COUNT(DISTINCT ot.orden_trabajo_id)::int AS ordenes_asignadas
      FROM admin.usuario u
      LEFT JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
      LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
      LEFT JOIN admin.orden_servicios os ON os.usuario_id = u.usuario_id AND (os.activo IS DISTINCT FROM false)
      LEFT JOIN admin.ordenes_trabajo ot ON ot.orden_trabajo_id = os.orden_trabajo_id AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8) AND (ot.activo IS DISTINCT FROM false)
      WHERE u.empresa_id = $1
        AND (tu.codigo = 'MECANICO' OR u.tipo_usuario_id = 2)
        AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      GROUP BY u.usuario_id, ui.nombre, ui.apellido
      ORDER BY ordenes_asignadas DESC, u.usuario_id ASC
    `, [empresaId]);

    const total_mecanicos = mecanicosRows.length;
    const mecanicos_disponibles = mecanicosRows.filter((m: any) => Number(m.ordenes_asignadas) < 5).length;
    const mecanicosStr = total_mecanicos > 0 ? `${mecanicos_disponibles}/${total_mecanicos}` : "0/0";

    const carga_mecanicos = mecanicosRows.slice(0, 6).map((m: any, idx: number) => {
      const assigned = Number(m.ordenes_asignadas || 0);
      const capacityPct = Math.min(Math.round((assigned / 5) * 100), 100);
      return {
        id: m.usuario_id,
        nombre: m.nombre_completo || `Mecánico #${idx + 1}`,
        ordenes: assigned,
        pct: capacityPct,
        color: capacityPct >= 90 ? "bg-rose-400" : capacityPct >= 70 ? "bg-[#bfce7f]" : "bg-slate-400"
      };
    });

    // 3. Retrasos Críticos de la empresa
    const retrasosRows = await query<any>(`
      SELECT COUNT(ot.orden_trabajo_id)::int as total
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      WHERE u_ot.empresa_id = $1
        AND (ot.prioridad_orden_id = 3 OR ot.estado_orden_id = 4)
        AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8)
        AND (ot.activo IS DISTINCT FROM false)
    `, [empresaId]);

    const retrasos_criticos = retrasosRows[0]?.total || 0;

    // 4. Ingresos Semanales reales de facturas de la empresa
    const ingSemRows = await query<any>(`
      SELECT COALESCE(SUM(f.total_factura), 0)::numeric AS total
      FROM admin.facturas f
      JOIN admin.usuario u_fac ON u_fac.usuario_id = f.usuario_registro
      WHERE u_fac.empresa_id = $1
        AND f.fecha_factura >= CURRENT_DATE - INTERVAL '7 days'
        AND (f.estado IS NULL OR f.estado != 'ANULADA')
    `, [empresaId]);

    const ingresos_semanales = Number(ingSemRows[0]?.total || 0);

    // 5. Acciones Urgentes reales basadas en órdenes con alta prioridad o retrasos
    const urgRows = await query<any>(`
      SELECT 
        ot.codigo_orden AS id,
        'Retraso / Urgente' AS tipo,
        'bg-rose-500/20 text-rose-400 border-rose-500/30' AS tipo_color,
        COALESCE(ot.diagnostico_inicial, ot.descripcion_cliente, 'Revisión técnica requerida') AS descripcion,
        COALESCE(CONCAT('OT #', ot.orden_trabajo_id), 'Taller') AS ref,
        'REVISAR' AS accion
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      WHERE u_ot.empresa_id = $1
        AND (ot.prioridad_orden_id = 3 OR ot.estado_orden_id = 4)
        AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8)
        AND (ot.activo IS DISTINCT FROM false)
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT 3
    `, [empresaId]);

    const acciones_urgentes = urgRows || [];

    return NextResponse.json({
      success: true,
      data: {
        ordenes_activas,
        mecanicos_disponibles: mecanicosStr,
        retrasos_criticos,
        ingresos_semanales,
        carga_mecanicos,
        acciones_urgentes
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/dashboard:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
