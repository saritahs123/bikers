import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorizeUserAccess } from "@/lib/userAuth";

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
    const accion = searchParams.get("accion") || "";
    const adminIdParam = searchParams.get("adminId") || "";
    const resultado = searchParams.get("resultado") || "";
    const search = searchParams.get("search") || "";
    const fetchAll = searchParams.get("all") === "true";

    // Build WHERE clause and params dynamically
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

    if (accion && accion !== "Todos") {
      queryParams.push(accion);
      whereConditions.push(`a.accion = $${queryParams.length}`);
    }

    if (adminIdParam && adminIdParam !== "Todos") {
      const parsedAdminId = parseInt(adminIdParam, 10);
      if (!isNaN(parsedAdminId)) {
        queryParams.push(parsedAdminId);
        whereConditions.push(`a.admin_id = $${queryParams.length}`);
      }
    }

    if (resultado && resultado !== "Todos") {
      queryParams.push(`%${resultado}%`);
      whereConditions.push(`UPPER(a.resultado) LIKE UPPER($${queryParams.length})`);
    }

    if (search.trim()) {
      queryParams.push(`%${search.trim()}%`);
      const searchIdx = queryParams.length;
      whereConditions.push(`(
        a.accion ILIKE $${searchIdx} OR
        a.motivo ILIKE $${searchIdx} OR
        a.direccion_ip ILIKE $${searchIdx} OR
        a.dispositivo ILIKE $${searchIdx} OR
        a.valor_anterior ILIKE $${searchIdx} OR
        a.valor_nuevo ILIKE $${searchIdx} OR
        ui.nombre ILIKE $${searchIdx} OR
        ui.apellido ILIKE $${searchIdx}
      )`);
    }

    const whereClause = whereConditions.join(" AND ");

    // 1. Get Count
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM admin.usuario_auditoria a
      LEFT JOIN admin.usuario u ON a.admin_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON a.admin_id = ui.usuario_id
      WHERE ${whereClause}
    `;
    const countRes = await query(countSql, queryParams);
    const total = countRes?.[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 2. Fetch Items
    let itemsSql = `
      SELECT 
        a.*,
        COALESCE(
          NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''),
          ui.correo_electronico,
          'Admin #' || a.admin_id::text,
          'Sistema'
        ) AS admin_nombre
      FROM admin.usuario_auditoria a
      LEFT JOIN admin.usuario u ON a.admin_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON a.admin_id = ui.usuario_id
      WHERE ${whereClause}
      ORDER BY a.fecha_hora DESC
    `;

    if (!fetchAll) {
      const offset = (page - 1) * pageSize;
      itemsSql += ` LIMIT ${pageSize} OFFSET ${offset}`;
    }

    const rows = await query(itemsSql, queryParams);

    const mapped = (rows || []).map((r: any) => ({
      id: r.auditoria_id,
      auditoria_id: r.auditoria_id,
      usuario_id: r.usuario_id,
      admin_id: r.admin_id,
      admin_nombre: r.admin_nombre || (r.admin_id ? `Admin #${r.admin_id}` : 'Sistema'),
      performed_by: r.admin_nombre || (r.admin_id ? `Admin #${r.admin_id}` : 'Sistema'),
      performed_at: r.fecha_hora || null,
      timestamp: r.fecha_hora || null,
      fecha_hora: r.fecha_hora || null,
      action: r.accion || 'Registro de Auditoría',
      accion: r.accion || 'Registro de Auditoría',
      before_value: r.valor_anterior || '—',
      valor_anterior: r.valor_anterior || '—',
      after_value: r.valor_nuevo || '—',
      valor_nuevo: r.valor_nuevo || '—',
      reason: r.motivo || '—',
      motivo: r.motivo || '—',
      observaciones: r.motivo || '—',
      result: r.resultado || '—',
      resultado: r.resultado || '—',
      ip: r.direccion_ip || '—',
      direccion_ip: r.direccion_ip || '—',
      device: r.dispositivo || '—',
      dispositivo: r.dispositivo || '—',
      modulo: r.modulo || 'Seguridad'
    }));

    // 3. Fetch Aggregated Summary Stats (for the whole user history)
    const statsSql = `
      SELECT
        COUNT(*)::int AS total_eventos,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%CREATE%' OR UPPER(accion) LIKE '%CREAR%')::int AS creaciones,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%UPDATE%' OR UPPER(accion) LIKE '%EDITAR%' OR UPPER(accion) LIKE '%CHANGE%')::int AS actualizaciones,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%PERMISO%' OR UPPER(accion) LIKE '%PERMISSION%')::int AS permisos_modificados,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%PASSWORD%' OR UPPER(accion) LIKE '%CLAVE%')::int AS reseteos_password,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%SESSION%' OR UPPER(accion) LIKE '%REVOKED%' OR UPPER(accion) LIKE '%REVOCAR%')::int AS revocaciones_sesion,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%ROLE%' OR UPPER(accion) LIKE '%ROL%')::int AS cambios_roles,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%LOCK%' OR UPPER(accion) LIKE '%BLOQUEO%')::int AS bloqueos,
        COUNT(*) FILTER (WHERE UPPER(accion) LIKE '%UNLOCK%' OR UPPER(accion) LIKE '%DESBLOQUEO%')::int AS desbloqueos
      FROM admin.usuario_auditoria
      WHERE usuario_id = $1
    `;
    const statsRes = await query(statsSql, [userId]);
    const summaryStats = statsRes?.[0] || {
      total_eventos: total,
      creaciones: 0,
      actualizaciones: 0,
      permisos_modificados: 0,
      reseteos_password: 0,
      revocaciones_sesion: 0,
      cambios_roles: 0,
      bloqueos: 0,
      desbloqueos: 0
    };

    // 4. Fetch Available Distinct Actions
    const distinctActionsSql = `
      SELECT DISTINCT accion
      FROM admin.usuario_auditoria
      WHERE usuario_id = $1 AND accion IS NOT NULL
      ORDER BY accion ASC
    `;
    const distinctActionsRes = await query(distinctActionsSql, [userId]);
    const availableActions = (distinctActionsRes || []).map((row: any) => row.accion);

    // 5. Fetch Available Distinct Admins
    const distinctAdminsSql = `
      SELECT DISTINCT 
        a.admin_id,
        COALESCE(
          NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''),
          ui.correo_electronico,
          'Admin #' || a.admin_id::text,
          'Sistema'
        ) AS admin_nombre
      FROM admin.usuario_auditoria a
      LEFT JOIN admin.usuario u ON a.admin_id = u.usuario_id
      LEFT JOIN admin.usuario_identidad ui ON a.admin_id = ui.usuario_id
      WHERE a.usuario_id = $1 AND a.admin_id IS NOT NULL
      ORDER BY admin_nombre ASC
    `;
    const distinctAdminsRes = await query(distinctAdminsSql, [userId]);
    const availableAdmins = (distinctAdminsRes || []).map((row: any) => ({
      admin_id: row.admin_id,
      admin_nombre: row.admin_nombre
    }));

    return NextResponse.json({
      items: mapped,
      total,
      page,
      pageSize,
      totalPages,
      summaryStats,
      availableActions,
      availableAdmins
    });
  } catch (error: any) {
    console.error("Error fetching usuario_auditoria Detailed:", error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
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
    const adminId = authResult.authUserId;
    const body = await req.json().catch(() => ({}));

    const { 
      accion = 'USER_UPDATED', 
      valor_anterior = null, 
      valor_nuevo = null, 
      motivo = null, 
      resultado = 'COMPLETADO' 
    } = body;

    const { recordUserAudit } = await import("@/lib/auditLogger");
    await recordUserAudit({
      userId,
      adminId,
      accion,
      valorAnterior: valor_anterior,
      valorNuevo: valor_nuevo,
      motivo,
      resultado,
      req
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error inserting usuario_auditoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
