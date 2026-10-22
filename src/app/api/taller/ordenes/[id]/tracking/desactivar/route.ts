import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { query } from "@/lib/db";
import { deactivateWorkOrderTracking } from "@/lib/tracking/workOrderTrackingService";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión requerida." },
        { status: 401 }
      );
    }

    const perms = await getScreenPermissions("TALLER_ORDENES", session.usuario_id);
    if (!perms.puede_inactivar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para desactivar el seguimiento de esta orden. Se requiere el privilegio INACTIVAR." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const ordenId = Number(id);
    if (!Number.isSafeInteger(ordenId) || ordenId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de orden inválido." },
        { status: 400 }
      );
    }

    const orderCheck = await query<{ orden_trabajo_id: number; empresa_id: number }>(
      `SELECT ot.orden_trabajo_id, c.empresa_id
       FROM admin.ordenes_trabajo ot
       JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
       WHERE ot.orden_trabajo_id = $1 AND ot.activo = true`,
      [ordenId]
    );

    if (!orderCheck.length || (session.empresa_id && Number(orderCheck[0].empresa_id) !== Number(session.empresa_id))) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Orden no encontrada o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    await deactivateWorkOrderTracking(ordenId);

    return NextResponse.json({
      success: true,
      activo: false,
      message: "Seguimiento público desactivado.",
    });
  } catch (error) {
    console.error("Error deactivating work order tracking:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Error al desactivar el seguimiento." },
      { status: 500 }
    );
  }
}
