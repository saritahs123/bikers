import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession } from "@/lib/workshop-session";
import { deactivateWorkOrderTracking } from "@/lib/tracking/workOrderTrackingService";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión requerida." },
        { status: 401 }
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
