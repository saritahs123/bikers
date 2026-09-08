import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeReceptionWithWorkOrder } from "@/lib/workshop/receptionOrderService";

// POST /api/taller/ordenes/crear-directa
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
        { error: "FORBIDDEN", message: "No tienes permiso para registrar Órdenes de Trabajo en el Taller." },
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

    const payload = {
      cliente_id: body.cliente_id,
      bicicleta_id: body.bicicleta_id,
      prioridad_id: body.prioridad_id,
      observaciones_cliente: body.observaciones_cliente,
      observaciones_recepcion: body.observaciones_recepcion,
      observacion_interna_ot: body.observacion_interna_ot,
      presupuesto_estimado: body.presupuesto_estimado,
      servicios: body.servicios,
      productos: body.productos,
      mecanico_id: null,
      fecha_prometida: null,
      is_direct_work_order: true,
      generar_orden_trabajo: true,
      idempotency_key,
      userAgent,
      ipFirma
    };

    const result = await executeReceptionWithWorkOrder(payload, session, req);

    return NextResponse.json(
      {
        success: true,
        message: result.mensaje || "Orden de trabajo creada correctamente.",
        is_replay: result.is_replay,
        data: {
          orden_id: result.orden_trabajo_id,
          orden_trabajo_id: result.orden_trabajo_id,
          codigo_orden: result.codigo_orden,
          recepcion_id: result.recepcion_id,
          codigo_recepcion: result.codigo_recepcion
        }
      },
      { status: result.is_replay ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/taller/ordenes/crear-directa:", error);

    const status = error.status || 500;
    let errorKey = error.code || "SERVER_ERROR";
    let message = error.message || "Error al procesar la creación directa de la orden de trabajo.";

    if (status === 500 && (typeof error?.code === "string" && (error.code.startsWith("42") || error.code.startsWith("28") || error.code.startsWith("XX")) || error?.message?.includes("column") || error?.message?.includes("syntax error") || error?.message?.includes("relation"))) {
      errorKey = "INTERNAL_ERROR";
      message = "Ocurrió un error interno en el servidor al procesar la orden de trabajo. Por favor, intente nuevamente.";
    }

    return NextResponse.json(
      {
        error: errorKey,
        message
      },
      { status }
    );
  }
}
