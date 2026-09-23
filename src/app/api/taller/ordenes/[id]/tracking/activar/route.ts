import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession } from "@/lib/workshop-session";
import {
  activateWorkOrderTracking,
  generateTrackingQrDataUrl,
} from "@/lib/tracking/workOrderTrackingService";

export async function POST(
  req: NextRequest,
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

    const origin = req.nextUrl.origin;
    const trackingInfo = await activateWorkOrderTracking(ordenId, origin);
    const qrDataUrl = await generateTrackingQrDataUrl(trackingInfo.publicUrl);

    return NextResponse.json({
      success: true,
      message: "Seguimiento público activado.",
      tracking: {
        ...trackingInfo,
        qrDataUrl,
      },
    });
  } catch (error) {
    console.error("Error activating work order tracking:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Error al activar el seguimiento." },
      { status: 500 }
    );
  }
}
