import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/ordenes
export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." }, { status: 403 });
    }

    // Check IAM permission for Módulo TALLER
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para acceder a las órdenes de trabajo." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || searchParams.get("estado_codigo") || "";
    const estadoId = searchParams.get("estado_id") || "";
    const prioridadId = searchParams.get("prioridad_id") || "";
    const mecanicoId = searchParams.get("mecanico_id") || "";
    const period = searchParams.get("period") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Company isolation condition mandatory
    const queryParams: any[] = [empresaId];
    const whereConditions: string[] = [
      `u_ot.empresa_id = $1`,
      `ot.activo = true`
    ];

    if (search) {
      queryParams.push(`%${search}%`);
      const idx = queryParams.length;
      whereConditions.push(`(
        ot.codigo_orden ILIKE $${idx} OR
        ot.orden_trabajo_id::text ILIKE $${idx} OR
        r.codigo_recepcion ILIKE $${idx} OR
        r.recepcion_id::text ILIKE $${idx} OR
        c.nombre ILIKE $${idx} OR
        c.apellido ILIKE $${idx} OR
        c.nombre_completo ILIKE $${idx} OR
        c.identificacion ILIKE $${idx} OR
        c.telefono_principal ILIKE $${idx} OR
        b.marca ILIKE $${idx} OR
        b.modelo ILIKE $${idx} OR
        b.numero_serie_cuadro ILIKE $${idx} OR
        b.codigo_qr ILIKE $${idx}
      )`);
    }

    if (estado) {
      queryParams.push(estado.trim().toUpperCase());
      whereConditions.push(`eot.codigo = $${queryParams.length}`);
    } else if (estadoId) {
      if (isNaN(Number(estadoId))) {
        queryParams.push(estadoId.trim().toUpperCase());
        whereConditions.push(`eot.codigo = $${queryParams.length}`);
      } else {
        queryParams.push(parseInt(estadoId, 10));
        whereConditions.push(`ot.estado_orden_id = $${queryParams.length}`);
      }
    }

    if (prioridadId) {
      queryParams.push(parseInt(prioridadId, 10));
      whereConditions.push(`ot.prioridad_orden_id = $${queryParams.length}`);
    }

    if (mecanicoId) {
      queryParams.push(parseInt(mecanicoId, 10));
      whereConditions.push(`EXISTS (
        SELECT 1 FROM admin.orden_servicios os_mec
        WHERE os_mec.orden_trabajo_id = ot.orden_trabajo_id
          AND os_mec.usuario_id = $${queryParams.length}
          AND (os_mec.activo IS DISTINCT FROM false)
      )`);
    }

    if (period === "hoy" || period === "today") {
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date = (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`);
    } else if (period === "7d" || period === "7_dias" || period === "7dias") {
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date >= ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '6 days')::date AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date <= (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`);
    } else if (period === "30d" || period === "30_dias" || period === "30dias") {
      whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date >= ((NOW() AT TIME ZONE 'America/Santo_Domingo')::date - INTERVAL '29 days')::date AND (ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date <= (NOW() AT TIME ZONE 'America/Santo_Domingo')::date`);
    } else {
      if (from && dateRegex.test(from)) {
        queryParams.push(from);
        whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date >= $${queryParams.length}::date`);
      }
      if (to && dateRegex.test(to)) {
        queryParams.push(to);
        whereConditions.push(`(ot.fecha_registro AT TIME ZONE 'America/Santo_Domingo')::date <= $${queryParams.length}::date`);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Count Total
    const countSql = `
      SELECT COUNT(ot.orden_trabajo_id)::int as total
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      ${whereClause}
    `;
    const countRes = await query(countSql, queryParams);
    const total = parseInt(countRes[0]?.total || "0", 10);

    // Fetch Items
    const sql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        eot.orden_visual AS estado_orden,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_inicio_trabajo AS fecha_inicio,
        ot.fecha_finalizacion AS fecha_termino,
        ot.diagnostico_inicial,
        ot.observacion_interna AS observaciones,
        COALESCE(c.cliente_id, r.cliente_id) AS cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.telefono_principal AS cliente_telefono,
        COALESCE(b.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.ano AS bicicleta_ano,
        b.numero_serie_cuadro AS bicicleta_serie,
        COALESCE(ot.total_orden, ot.subtotal_general, 0) AS total_estimado,
        (SELECT COUNT(*) FROM admin.orden_servicios WHERE orden_trabajo_id = ot.orden_trabajo_id AND (activo IS DISTINCT FROM false)) AS total_servicios,
        (
          SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text))
          FROM admin.orden_servicios os
          JOIN admin.usuario u ON os.usuario_id = u.usuario_id
          LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
          ORDER BY os.orden_servicio_id ASC
          LIMIT 1
        ) AS mecanico_nombre,
        (
          SELECT os.usuario_id
          FROM admin.orden_servicios os
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
          ORDER BY os.orden_servicio_id ASC
          LIMIT 1
        ) AS mecanico_usuario_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      ${whereClause}
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const items = await query(sql, [...queryParams, limit, offset]);

    // Fetch Catalogs for Filters
    const estados = await query(`SELECT estado_orden_id, nombre, codigo, orden_visual AS orden FROM admin.estado_orden_trabajo WHERE activo = true AND estado_orden_id IN (1, 5, 7, 8) ORDER BY orden_visual ASC`);
    const prioridades = await query(`SELECT prioridad_orden_trabajo_id AS prioridad_id, nombre, codigo, color_estado AS color_hex FROM admin.prioridad_orden_trabajo WHERE activo = true ORDER BY prioridad_orden_trabajo_id ASC`);
    const mecanicos = await query(`
      SELECT 
        u.usuario_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), u.estado) AS nombre_completo
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
      WHERE u.empresa_id = $1 AND (tu.codigo = 'MECANICO' OR u.tipo_usuario_id = 2) AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      ORDER BY u.usuario_id ASC
    `, [empresaId]);

    // Summary Metrics for company isolation
    const metricsRes = await query<any>(`
      SELECT
        COUNT(ot.orden_trabajo_id) FILTER (WHERE (eot.codigo NOT IN ('ENTREGADA', 'CANCELADA') OR eot.codigo IS NULL) AND ot.estado_orden_id NOT IN (8, 9))::int AS abiertas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'RECIBIDA' OR ot.estado_orden_id = 1)::int AS recibidas,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'REPARACION' OR ot.estado_orden_id = 5)::int AS en_proceso,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'LISTA_ENTREGA' OR ot.estado_orden_id = 7)::int AS listas_entrega,
        COUNT(ot.orden_trabajo_id) FILTER (WHERE eot.codigo = 'ENTREGADA' OR ot.estado_orden_id = 8)::int AS entregadas,
        COUNT(ot.orden_trabajo_id)::int AS total
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.estado_orden_trabajo eot ON eot.estado_orden_id = ot.estado_orden_id
      WHERE u_ot.empresa_id = $1
        AND (ot.activo IS DISTINCT FROM false)
    `, [empresaId]);

    const metricsData = metricsRes[0] || {
      abiertas: 0,
      recibidas: 0,
      en_proceso: 0,
      listas_entrega: 0,
      entregadas: 0,
      total: 0
    };

    return NextResponse.json({
      success: true,
      data: items || [],
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1
      },
      metrics: {
        abiertas: Number(metricsData.abiertas || 0),
        recibidas: Number(metricsData.recibidas || 0),
        en_proceso: Number(metricsData.en_proceso || 0),
        listas_entrega: Number(metricsData.listas_entrega || 0),
        entregadas: Number(metricsData.entregadas || 0),
        total: Number(metricsData.total || 0)
      },
      catalogs: {
        estados: estados || [],
        prioridades: prioridades || [],
        mecanicos: mecanicos || []
      }
    });

  } catch (error: any) {
    console.error("Error in GET /api/taller/ordenes:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
