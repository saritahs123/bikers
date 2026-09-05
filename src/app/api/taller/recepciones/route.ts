import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { CURRENT_RECEPTION_TERMS_VERSION, isValidReceptionTermsVersion } from "@/lib/workshop/receptionTerms";

function cleanFecha(val: any) {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// GET /api/taller/recepciones
export async function GET(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para el Módulo de Recepción." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;
    const estadoId = searchParams.get("estado_id") ? parseInt(searchParams.get("estado_id")!, 10) : null;
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    let whereClause = `WHERE c.empresa_id = $1 AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL`;
    const params: any[] = [session.empresa_id];

    if (estadoId && !isNaN(estadoId)) {
      params.push(estadoId);
      whereClause += ` AND r.estado_recepcion_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      whereClause += ` AND (LOWER(r.codigo_recepcion) LIKE $${pIdx} OR LOWER(c.nombre_completo) LIKE $${pIdx} OR LOWER(b.marca) LIKE $${pIdx} OR LOWER(b.modelo) LIKE $${pIdx})`;
    }

    const countSql = `
      SELECT COUNT(r.recepcion_id)::int as total
      FROM admin.recepciones r
      JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      ${whereClause}
    `;
    const countRows = await query<any>(countSql, params);
    const total = countRows[0]?.total || 0;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT r.recepcion_id, r.codigo_recepcion, r.token_seguimiento, r.fecha_recepcion,
             r.fecha_entrega_estimada, r.diagnostico_preliminar, r.observaciones_cliente,
             r.observaciones_recepcion, r.presupuesto_estimado, r.requiere_aprobacion, r.aprobado_cliente,
             r.convertido_orden_id,
             c.cliente_id, c.nombre_completo as cliente_nombre, c.telefono_principal as cliente_telefono,
             b.bicicleta_id, CONCAT(b.marca, ' ', b.modelo) as bicicleta_resumen, b.color as bicicleta_color,
             er.estado_recepcion_id, er.nombre as estado_nombre, er.codigo as estado_codigo
      FROM admin.recepciones r
      JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      ${whereClause}
      ORDER BY r.recepcion_id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rows = await query<any>(dataSql, params);

    // Fetch dynamic reception metrics (America/Santo_Domingo timezone)
    const metricsRes = await query<any>(`
      SELECT
        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE timezone('America/Santo_Domingo', r.fecha_recepcion::timestamptz)::date = timezone('America/Santo_Domingo', NOW())::date
          ),
          0
        )::integer AS recepciones_hoy,

        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE er.codigo IN ('BORRADOR', 'PENDIENTE_FIRMA', 'CONFIRMADA')
          ),
          0
        )::integer AS recepciones_pendientes,

        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE er.codigo = 'CONVERTIDA_OT'
              AND (r.convertido_orden_id IS NOT NULL OR EXISTS (
                SELECT 1 FROM admin.ordenes_trabajo ot
                WHERE ot.recepcion_id = r.recepcion_id AND ot.activo = true
              ))
          ),
          0
        )::integer AS convertidas_ot
      FROM admin.recepciones r
      JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      WHERE c.empresa_id = $1
        AND (r.activo = true OR r.activo IS NULL)
        AND r.fecha_eliminacion IS NULL;
    `, [session.empresa_id]);

    const metricsObj = metricsRes[0] || {
      recepciones_hoy: 0,
      recepciones_pendientes: 0,
      convertidas_ot: 0
    };

    return NextResponse.json({
      success: true,
      data: (rows || []).map((r: any) => ({
        recepcion_id: r.recepcion_id,
        codigo_recepcion: r.codigo_recepcion,
        token_seguimiento: r.token_seguimiento,
        fecha_recepcion: r.fecha_recepcion,
        fecha_entrega_estimada: r.fecha_entrega_estimada,
        diagnostico_preliminar: r.diagnostico_preliminar || "",
        observaciones_cliente: r.observaciones_cliente || "",
        observaciones_recepcion: r.observaciones_recepcion || "",
        presupuesto_estimado: Number(r.presupuesto_estimado || 0),
        requiere_aprobacion: Boolean(r.requiere_aprobacion),
        aprobado_cliente: r.aprobado_cliente,
        convertido_orden_id: r.convertido_orden_id || null,
        cliente_nombre: r.cliente_nombre || "Cliente General",
        bicicleta_resumen: r.bicicleta_resumen || "Bicicleta",
        estado_nombre: r.estado_nombre || "INGRESADO",
        cliente: {
          cliente_id: r.cliente_id,
          nombre_completo: r.cliente_nombre || "Cliente General",
          telefono: r.cliente_telefono || ""
        },
        bicicleta: {
          bicicleta_id: r.bicicleta_id,
          resumen: r.bicicleta_resumen || "Bicicleta",
          color: r.bicicleta_color || ""
        },
        estado: {
          estado_recepcion_id: r.estado_recepcion_id,
          nombre: r.estado_nombre || "INGRESADO",
          codigo: r.estado_codigo || "INGRESADO"
        }
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      metricas: {
        recepciones_hoy: Number(metricsObj.recepciones_hoy || 0),
        recepciones_pendientes: Number(metricsObj.recepciones_pendientes || 0),
        convertidas_ot: Number(metricsObj.convertidas_ot || 0)
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/recepciones:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible obtener las recepciones. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}

// POST /api/taller/recepciones
export async function POST(req: NextRequest) {
  let session: any = null;
  try {
    session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para registrar recepciones en TALLER." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const idempotency_key = (
      body.idempotency_key ||
      body.request_id ||
      req.headers.get("x-idempotency-key") ||
      ""
    ).trim() || null;

    const userAgent = req.headers.get("user-agent") || "Navegador Web";
    const ipFirma = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    let servicios: any[] = Array.isArray(body.servicios) ? body.servicios : [];
    if (servicios.length === 0 && body.tipo_servicio_id) {
      servicios = [{
        tipo_servicio_id: parseInt(body.tipo_servicio_id, 10),
        diagnostico_preliminar: (body.diagnostico_preliminar || "").trim(),
        precio_estimado: body.presupuesto_estimado !== undefined && body.presupuesto_estimado !== null
          ? parseFloat(body.presupuesto_estimado)
          : 0.00,
        bicicleta_componente_id: body.bicicleta_componente_id || null
      }];
    }

    const { executeReceptionWithWorkOrder } = await import("@/lib/workshop/receptionOrderService");

    const payload = {
      ...body,
      servicios,
      idempotency_key,
      userAgent,
      ipFirma,
      is_direct_work_order: false
    };

    const result = await executeReceptionWithWorkOrder(payload, session, req);

    return NextResponse.json(
      {
        success: true,
        message: result.mensaje,
        is_replay: result.is_replay,
        recepcion_id: result.recepcion_id,
        codigo_recepcion: result.codigo_recepcion,
        orden_trabajo_id: result.orden_trabajo_id,
        codigo_orden: result.codigo_orden,
        data: {
          recepcion_id: result.recepcion_id,
          codigo_recepcion: result.codigo_recepcion,
          orden_trabajo_id: result.orden_trabajo_id,
          codigo_orden: result.codigo_orden
        }
      },
      { status: result.is_replay ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/taller/recepciones:", error);

    // 1. Graceful recovery for concurrent idempotency race conditions
    if (error?.code === "23505" && (error?.constraint === "uq_recepciones_idempotency_empresa_key" || error?.message?.includes("uq_recepciones_idempotency"))) {
      try {
        const bodyFallback = await req.clone().json().catch(() => ({}));
        const key = (bodyFallback.idempotency_key || bodyFallback.request_id || "").trim();
        if (key && session?.empresa_id) {
          const replayRows = await query<any>(
            `SELECT r.recepcion_id, r.codigo_recepcion, r.convertido_orden_id, ot.codigo_orden
             FROM admin.recepciones r
             LEFT JOIN admin.ordenes_trabajo ot ON r.convertido_orden_id = ot.orden_trabajo_id
             WHERE r.idempotency_empresa_id = $1 AND r.idempotency_key = $2 AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
             LIMIT 1`,
            [session.empresa_id, key]
          );
          if (replayRows && replayRows.length > 0) {
            return NextResponse.json({
              success: true,
              is_replay: true,
              message: replayRows[0].convertido_orden_id
                ? "Recepción registrada exitosamente y Orden de Trabajo generada."
                : "Recepción de bicicleta registrada exitosamente.",
              recepcion_id: replayRows[0].recepcion_id,
              codigo_recepcion: replayRows[0].codigo_recepcion,
              orden_trabajo_id: replayRows[0].convertido_orden_id || null,
              codigo_orden: replayRows[0].codigo_orden || null,
              data: {
                recepcion_id: replayRows[0].recepcion_id,
                codigo_recepcion: replayRows[0].codigo_recepcion,
                orden_trabajo_id: replayRows[0].convertido_orden_id || null,
                codigo_orden: replayRows[0].codigo_orden || null
              }
            }, { status: 200 });
          }
        }
      } catch (err2) {
        console.error("Error recovering idempotent response on 23505:", err2);
      }
    }

    const isDev = process.env.NODE_ENV !== "production";
    let statusCode = error?.status || 400;
    let errorCode = error?.code || "SERVER_ERROR";
    let message = error?.message || "Ocurrió un error interno al registrar la recepción.";

    if (error?.code === "23505" || error?.message?.includes("uk_bicicleta_componentes")) {
      statusCode = 409;
      errorCode = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
      message = "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.";
    } else if (error?.code === "BICYCLE_COMPONENT_CATEGORY_EXISTS") {
      statusCode = 409;
      errorCode = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
    } else if (error?.code === "DUPLICATE_COMPONENT_SERIAL") {
      statusCode = 409;
      errorCode = "DUPLICATE_COMPONENT_SERIAL";
    }

    return NextResponse.json(
      {
        success: false,
        error: errorCode,
        message: message,
        ...(isDev ? { dev_details: error?.message, dev_stack: error?.stack } : {})
      },
      { status: statusCode }
    );
  }
}
