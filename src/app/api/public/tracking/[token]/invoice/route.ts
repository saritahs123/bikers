import { NextResponse } from "next/server";
import { getPublicInvoicePdfData } from "@/lib/tracking/workOrderTrackingService";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || typeof token !== "string" || token.trim().length < 6) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "No fue posible encontrar este seguimiento." },
        { status: 404 }
      );
    }

    const result = await getPublicInvoicePdfData(token.trim());

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "ERROR", message: result.message || "No se pudo obtener la factura." },
        { status: result.status || 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Public tracking invoice error:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Error al procesar la solicitud de factura." },
      { status: 500 }
    );
  }
}
