import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    // Check Module TALLER puede_ver permission
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para ver el Panel Operativo de Taller." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No fue posible determinar la empresa del usuario." }, { status: 403 });
    }

    // 1. Órdenes Activas y desglose por estado
    const ordSummaryRows = await query<any>(`
      SELECT
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA'))::int AS total_activas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'RECIBIDA')::int AS recibidas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION')::int AS en_reparacion,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'LISTA_ENTREGA')::int AS listas_entrega
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON c.cliente_id = ot.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE c.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false);
    `, [empresaId]);

    const summary = ordSummaryRows[0] || { total_activas: 0, recibidas: 0, en_reparacion: 0, listas_entrega: 0 };
    const ordenes_activas = summary.total_activas || 0;
    const recibidas = summary.recibidas || 0;
    const en_reparacion = summary.en_reparacion || 0;
    const listas_entrega = summary.listas_entrega || 0;

    // 2. Mecánicos disponibles y carga de trabajo
    const mecanicosRows = await query<any>(`
      SELECT
        u.usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), CONCAT('Técnico #', u.usuario_id)) AS nombre,
        COALESCE(c.nombre, tu.nombre, 'Mecánico') AS cargo,
        COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA'))::int AS ordenes_activas,
        COUNT(DISTINCT ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION')::int AS ordenes_en_reparacion
      FROM admin.usuario u
      JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
      LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
      LEFT JOIN admin.cargo c ON c.cargo_id = ui.cargo_id
      LEFT JOIN admin.ordenes_trabajo ot ON ot.mecanico_id = u.usuario_id AND (ot.activo IS DISTINCT FROM false)
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE u.empresa_id = $1
        AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
        AND (tu.codigo = 'MECANICO' OR c.nombre ILIKE '%Mecánico%' OR c.nombre ILIKE '%Técnico%')
      GROUP BY u.usuario_id, ui.nombre, ui.apellido, c.nombre, tu.nombre
      ORDER BY ordenes_activas DESC, u.usuario_id ASC;
    `, [empresaId]);

    const mecanicos_totales = mecanicosRows.length;
    const mecanicos_ocupados = mecanicosRows.filter((m: any) => Number(m.ordenes_en_reparacion || 0) > 0).length;
    const mecanicos_disponibles = Math.max(0, mecanicos_totales - mecanicos_ocupados);
    const mecanicosStr = `${mecanicos_disponibles} / ${mecanicos_totales}`;

    const carga_mecanicos = mecanicosRows.map((m: any) => ({
      usuario_id: Number(m.usuario_id),
      nombre: m.nombre,
      cargo: m.cargo,
      ordenes_activas: Number(m.ordenes_activas || 0),
      ordenes_en_reparacion: Number(m.ordenes_en_reparacion || 0)
    }));

    // 3. Retrasos Críticos reales
    const retrasosRows = await query<any>(`
      SELECT COUNT(ot.orden_trabajo_id)::int as total
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON c.cliente_id = ot.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON pot.prioridad_orden_trabajo_id = ot.prioridad_orden_id
      WHERE c.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
        AND eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA')
        AND ot.fecha_entrega_estimada IS NOT NULL
        AND ot.fecha_entrega_estimada < (NOW() AT TIME ZONE 'America/Santo_Domingo')
        AND (
          pot.codigo IN ('ALTA', 'URGENTE')
          OR ot.fecha_entrega_estimada < ((NOW() AT TIME ZONE 'America/Santo_Domingo') - INTERVAL '24 hours')
        );
    `, [empresaId]);

    const retrasos_criticos = Number(retrasosRows[0]?.total || 0);

    // 4. Facturación Semanal (Órdenes entregadas en los últimos 7 días)
    const facturacionRows = await query<any>(`
      SELECT COALESCE(SUM(ot.total_orden), 0)::numeric AS total
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON c.cliente_id = ot.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE c.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
        AND eot.codigo = 'ENTREGADA'
        AND ot.fecha_entrega_real >= ((NOW() AT TIME ZONE 'America/Santo_Domingo') - INTERVAL '7 days');
    `, [empresaId]);

    const monto_semanal = Number(facturacionRows[0]?.total || 0);

    // 5. Acciones Urgentes reales
    const candidateOrders = await query<any>(`
      SELECT
        ot.orden_trabajo_id AS orden_id,
        ot.codigo_orden,
        COALESCE(cl.nombre, 'Cliente no especificado') AS cliente,
        CONCAT_WS(' ', b.marca, b.modelo) AS bicicleta,
        COALESCE(pot.codigo, 'NORMAL') AS prioridad,
        COALESCE(eot.codigo, 'RECIBIDA') AS estado,
        ot.fecha_entrega_estimada,
        ot.mecanico_id,
        COUNT(os.orden_servicio_id) FILTER (WHERE eos.codigo = 'SUSPENDIDO')::int AS servicios_pausados,
        EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'America/Santo_Domingo') - ot.fecha_entrega_estimada))::int AS segundos_retraso
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes cl ON cl.cliente_id = ot.cliente_id
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON pot.prioridad_orden_trabajo_id = ot.prioridad_orden_id
      LEFT JOIN admin.bicicletas b ON b.bicicleta_id = ot.bicicleta_id
      LEFT JOIN admin.orden_servicios os ON os.orden_trabajo_id = ot.orden_trabajo_id AND (os.activo IS DISTINCT FROM false)
      LEFT JOIN admin.estado_orden_servicio eos ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
      WHERE cl.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
        AND eot.codigo IN ('RECIBIDA', 'REPARACION', 'LISTA_ENTREGA')
      GROUP BY ot.orden_trabajo_id, ot.codigo_orden, cl.nombre, b.marca, b.modelo, pot.codigo, eot.codigo, ot.fecha_entrega_estimada, ot.mecanico_id
      ORDER BY ot.orden_trabajo_id DESC;
    `, [empresaId]);

    const acciones_urgentes: any[] = [];

    for (const ord of candidateOrders) {
      const isOverdue = ord.fecha_entrega_estimada && ord.segundos_retraso > 0;
      const isHighPriority = ord.prioridad === "ALTA" || ord.prioridad === "URGENTE";
      const hasPausedServices = ord.estado === "REPARACION" && ord.servicios_pausados > 0;
      const missingMechanic = !ord.mecanico_id && (ord.estado === "REPARACION" || ord.estado === "LISTA_ENTREGA");

      if (isOverdue) {
        const dias = Math.floor(ord.segundos_retraso / 86400);
        const horas = Math.floor((ord.segundos_retraso % 86400) / 3600);
        let motivo = "Entrega comprometida vencida";
        if (dias > 0) {
          motivo += ` hace ${dias} día${dias > 1 ? "s" : ""}`;
        } else if (horas > 0) {
          motivo += ` hace ${horas} hora${horas > 1 ? "s" : ""}`;
        }
        acciones_urgentes.push({
          orden_id: Number(ord.orden_id),
          codigo_orden: ord.codigo_orden,
          cliente: ord.cliente,
          bicicleta: ord.bicicleta || "Bicicleta de taller",
          prioridad: ord.prioridad,
          estado: ord.estado,
          tipo: "ORDEN_VENCIDA",
          nivel: isHighPriority || ord.segundos_retraso > 86400 ? "CRITICO" : "ALERTA",
          motivo,
          score: (isHighPriority ? 100 : 50) + Math.min(dias, 30)
        });
      } else if (hasPausedServices) {
        acciones_urgentes.push({
          orden_id: Number(ord.orden_id),
          codigo_orden: ord.codigo_orden,
          cliente: ord.cliente,
          bicicleta: ord.bicicleta || "Bicicleta de taller",
          prioridad: ord.prioridad,
          estado: ord.estado,
          tipo: "SERVICIO_PAUSADO",
          nivel: "ALERTA",
          motivo: `Tiene ${ord.servicios_pausados} servicio(s) pausado(s) en reparación`,
          score: 40
        });
      } else if (missingMechanic) {
        acciones_urgentes.push({
          orden_id: Number(ord.orden_id),
          codigo_orden: ord.codigo_orden,
          cliente: ord.cliente,
          bicicleta: ord.bicicleta || "Bicicleta de taller",
          prioridad: ord.prioridad,
          estado: ord.estado,
          tipo: "SIN_MECANICO",
          nivel: "ATENCION",
          motivo: "Orden activa sin mecánico asignado",
          score: 20
        });
      } else if (isHighPriority && ord.estado === "RECIBIDA") {
        acciones_urgentes.push({
          orden_id: Number(ord.orden_id),
          codigo_orden: ord.codigo_orden,
          cliente: ord.cliente,
          bicicleta: ord.bicicleta || "Bicicleta de taller",
          prioridad: ord.prioridad,
          estado: ord.estado,
          tipo: "ALTA_PRIORIDAD",
          nivel: "ALERTA",
          motivo: `Orden ${ord.prioridad.toLowerCase()} pendiente de iniciar reparación`,
          score: 35
        });
      }
    }

    // Sort by highest criticality score and take top 5
    acciones_urgentes.sort((a, b) => b.score - a.score);
    const finalAcciones = acciones_urgentes.slice(0, 5).map(({ score, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      data: {
        metricas: {
          ordenes_activas,
          recibidas,
          en_reparacion,
          listas_entrega,
          mecanicos_disponibles,
          mecanicos_totales,
          mecanicos_str: mecanicosStr,
          retrasos_criticos,
          monto_semanal,
          tipo_monto: "FACTURACION"
        },
        carga_mecanicos,
        acciones_urgentes: finalAcciones,
        calculado_en: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/dashboard:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
