import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { sendStatusNotification } from "@/lib/notifications/workOrderNotificationService";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string" || !/^\d+$/.test(id.trim())) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    const ordenId = parseInt(id.trim(), 10);
    if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    // 1. Validar sesión
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    // 2. Validar RBAC (Módulo TALLER)
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No posees permisos para acceder a esta orden." },
        { status: 403 }
      );
    }

    // 3. Validar empresa de la sesión
    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json(
        { error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." },
        { status: 403 }
      );
    }

    // 4-12. Invocar servicio centralizado de notificación
    const result = await sendStatusNotification({
      ordenTrabajoId: ordenId,
      usuarioId: session.usuario_id,
      empresaId,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Notificación enviada al cliente.",
      });
    }

    if (result.missingPhone) {
      return NextResponse.json(
        {
          success: false,
          missingPhone: true,
          error: "MISSING_PHONE",
          message: "El cliente no tiene un teléfono válido registrado.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "SEND_FAILED",
        message: "No fue posible enviar la notificación.",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error en endpoint de notificación de estado:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "No fue posible enviar la notificación.",
      },
      { status: 500 }
    );
  }
}
