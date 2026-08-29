import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorizeUserAccess } from "@/lib/userAuth";
import { extractClientInfo, recordUserActivity } from "@/lib/auditLogger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)));
    const fechaDesde = searchParams.get("fechaDesde") || "";
    const fechaHasta = searchParams.get("fechaHasta") || "";
    const modulo = searchParams.get("modulo") || "";
    const evento = searchParams.get("evento") || "";
    const resultado = searchParams.get("resultado") || "";
    const search = searchParams.get("search") || "";
    const fetchAll = searchParams.get("all") === "true";

    const whereConditions: string[] = ["a.usuario_id = $1"];
    const queryParams: any[] = [userId];

    if (fechaDesde) {
      queryParams.push(`${fechaDesde} 00:00:00+00`);
      whereConditions.push(`a.fecha_hora >= $${queryParams.length}::timestamptz`);
    }

    if (fechaHasta) {
      queryParams.push(`${fechaHasta} 23:59:59+00`);
      whereConditions.push(`a.fecha_hora <= $${queryParams.length}::timestamptz`);
    }

    if (modulo && modulo !== "Todos") {
      queryParams.push(modulo);
      whereConditions.push(`a.modulo = $${queryParams.length}`);
    }

    if (evento && evento !== "Todos") {
      queryParams.push(evento);
      whereConditions.push(`a.evento = $${queryParams.length}`);
    }

    if (resultado && resultado !== "Todos") {
      queryParams.push(`%${resultado}%`);
      whereConditions.push(`UPPER(a.resultado) LIKE UPPER($${queryParams.length})`);
    }

    if (search.trim()) {
      queryParams.push(`%${search.trim()}%`);
      const sIdx = queryParams.length;
      whereConditions.push(`(
        a.evento ILIKE $${sIdx} OR
        a.descripcion ILIKE $${sIdx} OR
        a.modulo ILIKE $${sIdx} OR
        a.direccion_ip ILIKE $${sIdx} OR
        a.dispositivo ILIKE $${sIdx} OR
        a.resultado ILIKE $${sIdx}
      )`);
    }

    const whereClause = whereConditions.join(" AND ");

    // 1. Total Count
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM admin.usuario_actividad a
      WHERE ${whereClause}
    `;
    const countRes = await query(countSql, queryParams);
    const total = countRes?.[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 2. Fetch Items
    let itemsSql = `
      SELECT *
      FROM admin.usuario_actividad a
      WHERE ${whereClause}
      ORDER BY a.fecha_hora DESC
    `;

    if (!fetchAll) {
      const offset = (page - 1) * pageSize;
      itemsSql += ` LIMIT ${pageSize} OFFSET ${offset}`;
    }

    const rows = await query(itemsSql, queryParams);

    const mapped = (rows || []).map((r: any) => ({
      id: r.actividad_id,
      actividad_id: r.actividad_id,
      usuario_id: r.usuario_id,
      timestamp: r.fecha_hora || null,
      fecha_hora: r.fecha_hora || null,
      event: r.evento || "Actividad",
      evento: r.evento || "Actividad",
      tipo_accion: r.evento || "Actividad",
      module: r.modulo || "Sistema",
      modulo: r.modulo || "Sistema",
      desc: r.descripcion || "—",
      descripcion: r.descripcion || "—",
      result: r.resultado || "—",
      resultado: r.resultado || "—",
      ip: r.direccion_ip || "—",
      direccion_ip: r.direccion_ip || "—",
      device: r.dispositivo || "—",
      dispositivo: r.dispositivo || "—"
    }));

    // 3. Stats for header cards
    const statsSql = `
      SELECT
        COUNT(*)::int AS total_eventos,
        COUNT(*) FILTER (WHERE a.fecha_hora >= CURRENT_DATE)::int AS eventos_hoy,
        COUNT(*) FILTER (WHERE a.fecha_hora >= NOW() - INTERVAL '7 days')::int AS eventos_7dias,
        COUNT(*) FILTER (WHERE UPPER(a.resultado) LIKE '%ERROR%' OR UPPER(a.resultado) LIKE '%FALLID%' OR UPPER(a.resultado) LIKE '%FAIL%')::int AS eventos_error,
        COUNT(*) FILTER (WHERE UPPER(a.resultado) LIKE '%EXIT%' OR UPPER(a.resultado) LIKE '%SUCCESS%' OR UPPER(a.resultado) LIKE '%COMPLET%')::int AS eventos_exito
      FROM admin.usuario_actividad a
      WHERE a.usuario_id = $1
    `;
    const statsRes = await query(statsSql, [userId]);
    const summaryStats = statsRes?.[0] || {
      total_eventos: total,
      eventos_hoy: 0,
      eventos_7dias: 0,
      eventos_error: 0,
      eventos_exito: 0
    };

    // 4. Available Modules
    const distinctModulesSql = `
      SELECT DISTINCT modulo
      FROM admin.usuario_actividad
      WHERE usuario_id = $1 AND modulo IS NOT NULL
      ORDER BY modulo ASC
    `;
    const distinctModulesRes = await query(distinctModulesSql, [userId]);
    const availableModules = (distinctModulesRes || []).map((m: any) => m.modulo);

    return NextResponse.json({
      items: mapped,
      total,
      page,
      pageSize,
      totalPages,
      summaryStats,
      availableModules
    });
  } catch (error: any) {
    console.error("Error fetching usuario_actividad:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;
    const body = await req.json();
    const { modulo = 'Seguridad', evento = 'Actividad', descripcion = null, resultado = 'Exitoso' } = body;

    const clientInfo = await extractClientInfo(req);

    await recordUserActivity({
      userId,
      modulo,
      evento,
      descripcion,
      resultado,
      ip: clientInfo.ip,
      dispositivo: clientInfo.dispositivo
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error inserting usuario_actividad:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
