import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { syncRecentPendingTextBeeNotifications } from "@/lib/notifications/workOrderNotificationService";

interface SummaryResult {
  total: number;
  pendientes: number;
  enviadas: number;
  entregadas: number;
  errores: number;
  sin_confirmar: number;
}

interface NotificationRow {
  notificacion_orden_trabajo_id: number;
  orden_trabajo_id: number;
  codigo_orden: string | null;
  cliente_id: number | null;
  nombre_cliente: string;
  telefono_destino: string | null;
  tipo_notificacion: string;
  mensaje: string;
  estado_envio: string;
  estado_proveedor: string | null;
  codigo_http: number | null;
  textbee_batch_id: string | null;
  error_mensaje: string | null;
  fecha_envio: string | null;
  fecha_registro: string;
  fecha_actualizacion: string | null;
  respuesta_proveedor: unknown;
  usuario_registro: number | null;
  usuario_nombre: string | null;
  empresa_id: number;
  nombre_empresa: string | null;
}

const SORT_WHITELIST: Record<string, string> = {
  fecha_registro: "n.fecha_registro",
  fecha: "n.fecha_registro",
  fecha_envio: "n.fecha_envio",
  fecha_actualizacion: "n.fecha_actualizacion",
  codigo_orden: "ot.codigo_orden",
  orden: "ot.codigo_orden",
  nombre_cliente: "nombre_cliente",
  cliente: "nombre_cliente",
  telefono_destino: "n.telefono_destino",
  telefono: "n.telefono_destino",
  tipo_notificacion: "n.tipo_notificacion",
  tipo: "n.tipo_notificacion",
  estado_envio: "n.estado_envio",
  estado: "n.estado_envio",
  estado_proveedor: "n.estado_proveedor",
  proveedor: "n.estado_proveedor",
  mensaje: "n.mensaje",
  id: "n.notificacion_orden_trabajo_id",
  notificacion_orden_trabajo_id: "n.notificacion_orden_trabajo_id",
};

export async function GET(req: NextRequest) {
  try {
    // 1. Session Verification
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    // 2. RBAC Verification (Supports TALLER, CONFIGURACION, or SEGURIDAD)
    const [permsTaller, permsSeguridad] = await Promise.all([
      getModulePermissions("TALLER", session.usuario_id),
      getModulePermissions("SEGURIDAD", session.usuario_id),
    ]);

    if (!permsTaller.puede_ver && !permsSeguridad.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar las notificaciones." },
        { status: 403 }
      );
    }

    // 3. Multitenancy: filter by user company
    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Empresa no identificada para el usuario." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    // Sincronizar lotes de TextBee únicamente cuando se solicite explícitamente (?sync=true)
    // para evitar bloquear y degradar la velocidad de los filtros y la paginación.
    const shouldSync = searchParams.get("sync") === "true";
    if (shouldSync) {
      await syncRecentPendingTextBeeNotifications(10).catch(() => {});
    }

    // 4. Parse Pagination Parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const rawPageSize = parseInt(searchParams.get("pageSize") || "25", 10);
    const pageSize = [25, 50, 100].includes(rawPageSize) ? rawPageSize : 25;
    const offset = (page - 1) * pageSize;

    // 5. Parse Filter Parameters
    const search = searchParams.get("search")?.trim() || "";
    const tipo = searchParams.get("tipo")?.trim().toUpperCase() || "";
    const estado = searchParams.get("estado")?.trim().toUpperCase() || "";
    const estadoProveedor = searchParams.get("estadoProveedor")?.trim().toLowerCase() || "";
    const fechaDesde = searchParams.get("fechaDesde")?.trim() || "";
    const fechaHasta = searchParams.get("fechaHasta")?.trim() || "";

    // 6. Parse Sort Parameters
    const sortByParam = searchParams.get("sortBy")?.trim().toLowerCase() || "fecha_registro";
    const sortOrderParam = searchParams.get("sortOrder")?.trim().toLowerCase() || "desc";
    const sortColumnSql = SORT_WHITELIST[sortByParam] || "n.fecha_registro";
    const sortDirection = sortOrderParam === "asc" ? "ASC" : "DESC";

    // 7. Build Filtered Query with Safe Parameterized Conditions
    const whereClauses: string[] = ["n.empresa_id = $1"];
    const queryParams: (string | number)[] = [empresaId];

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      whereClauses.push(`(
        ot.codigo_orden ILIKE $${pIdx}
        OR CONCAT(c.nombre, ' ', COALESCE(c.apellido, '')) ILIKE $${pIdx}
        OR n.telefono_destino ILIKE $${pIdx}
        OR n.mensaje ILIKE $${pIdx}
        OR n.textbee_batch_id ILIKE $${pIdx}
      )`);
    }

    if (tipo && tipo !== "TODOS") {
      queryParams.push(tipo);
      whereClauses.push(`n.tipo_notificacion = $${queryParams.length}`);
    }

    if (estado && estado !== "TODOS") {
      if (estado === "SIN_CONFIRMAR" || estado === "SIN CONFIRMAR" || estado === "UNKNOWN") {
        whereClauses.push(`(n.estado_envio = 'SIN CONFIRMAR' OR n.estado_envio = 'UNKNOWN' OR n.estado_envio IS NULL OR n.estado_envio NOT IN ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'ERROR'))`);
      } else {
        queryParams.push(estado);
        whereClauses.push(`n.estado_envio = $${queryParams.length}`);
      }
    }

    if (estadoProveedor && estadoProveedor !== "todos") {
      queryParams.push(estadoProveedor);
      whereClauses.push(`LOWER(COALESCE(n.estado_proveedor, '')) = $${queryParams.length}`);
    }

    if (fechaDesde) {
      queryParams.push(fechaDesde);
      whereClauses.push(`n.fecha_registro >= $${queryParams.length}::timestamptz`);
    }

    if (fechaHasta) {
      // If date without time is provided (e.g. YYYY-MM-DD), add end-of-day
      const normalizedHasta = fechaHasta.length === 10 ? `${fechaHasta}T23:59:59.999Z` : fechaHasta;
      queryParams.push(normalizedHasta);
      whereClauses.push(`n.fecha_registro <= $${queryParams.length}::timestamptz`);
    }

    const whereSql = whereClauses.join(" AND ");

    // 8. SQL Queries: Summary, Count, and Paginated Data
    const summarySql = `
      SELECT 
         COUNT(*)::int AS total,
         COUNT(CASE WHEN estado_envio = 'PENDIENTE' THEN 1 END)::int AS pendientes,
         COUNT(CASE WHEN estado_envio = 'ENVIADO' THEN 1 END)::int AS enviadas,
         COUNT(CASE WHEN estado_envio = 'ENTREGADO' THEN 1 END)::int AS entregadas,
         COUNT(CASE WHEN estado_envio = 'ERROR' THEN 1 END)::int AS errores,
         COUNT(CASE WHEN estado_envio = 'SIN CONFIRMAR' OR estado_envio = 'UNKNOWN' OR estado_envio IS NULL OR estado_envio NOT IN ('PENDIENTE', 'ENVIADO', 'ENTREGADO', 'ERROR') THEN 1 END)::int AS sin_confirmar
       FROM admin.notificacion_orden_trabajo
       WHERE empresa_id = $1
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM admin.notificacion_orden_trabajo n
      LEFT JOIN admin.ordenes_trabajo ot ON ot.orden_trabajo_id = n.orden_trabajo_id
      LEFT JOIN admin.clientes c ON c.cliente_id = ot.cliente_id
      WHERE ${whereSql}
    `;

    const dataSql = `
      SELECT 
        n.notificacion_orden_trabajo_id,
        n.orden_trabajo_id,
        ot.codigo_orden,
        c.cliente_id,
        TRIM(CONCAT(c.nombre, ' ', COALESCE(c.apellido, ''))) AS nombre_cliente,
        n.telefono_destino,
        n.tipo_notificacion,
        n.mensaje,
        n.estado_envio,
        n.estado_proveedor,
        n.codigo_http,
        n.textbee_batch_id,
        n.error_mensaje,
        n.fecha_envio,
        n.fecha_registro,
        n.fecha_actualizacion,
        n.respuesta_proveedor,
        n.usuario_registro,
        TRIM(CONCAT(ui.nombre, ' ', COALESCE(ui.apellido, ''))) AS usuario_nombre,
        n.empresa_id,
        e.nombre_comercial AS nombre_empresa
      FROM admin.notificacion_orden_trabajo n
      LEFT JOIN admin.ordenes_trabajo ot ON ot.orden_trabajo_id = n.orden_trabajo_id
      LEFT JOIN admin.clientes c ON c.cliente_id = ot.cliente_id
      LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = n.usuario_registro
      LEFT JOIN admin.empresa e ON e.empresa_id = n.empresa_id
      WHERE ${whereSql}
      ORDER BY ${sortColumnSql} ${sortDirection}, n.notificacion_orden_trabajo_id DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const paginationParams = [...queryParams, pageSize, offset];

    // 9. Execute Summary, Count, and Paginated Data queries in parallel for high speed
    const [summaryRows, countRows, rows] = await Promise.all([
      query<SummaryResult>(summarySql, [empresaId]),
      query<{ total: number }>(countSql, queryParams),
      query<NotificationRow>(dataSql, paginationParams),
    ]);

    const summary = summaryRows[0] || {
      total: 0,
      pendientes: 0,
      enviadas: 0,
      entregadas: 0,
      errores: 0,
      sin_confirmar: 0,
    };

    const totalRecords = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages,
      },
      summary,
    });
  } catch (error: unknown) {
    const errorDetail = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al obtener notificaciones de órdenes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "SERVER_ERROR",
        message: `Error al consultar las notificaciones de órdenes: ${errorDetail}`,
      },
      { status: 500 }
    );
  }
}
