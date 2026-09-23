import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession } from "@/lib/workshop-session";
import {
  regenerateWorkOrderTracking,
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
    const trackingInfo = await regenerateWorkOrderTracking(
      ordenId,
      session.usuario_id,
      origin
    );
    const qrDataUrl = await generateTrackingQrDataUrl(trackingInfo.publicUrl);

    return NextResponse.json({
      success: true,
      message: "Enlace de seguimiento regenerado exitosamente.",
      tracking: {
        ...trackingInfo,
        qrDataUrl,
      },
    });
  } catch (error) {
    console.error("Error regenerating work order tracking:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Error al regenerar enlace de seguimiento." },
      { status: 500 }
    );
  }
}
