import { NextResponse } from "next/server";
import { getPublicTrackingData } from "@/lib/tracking/workOrderTrackingService";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || typeof token !== "string" || token.trim().length < 16) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "No fue posible encontrar este seguimiento." },
        { status: 404 }
      );
    }

    const data = await getPublicTrackingData(token.trim());

    if (!data) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "No fue posible encontrar este seguimiento." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Public tracking error:", error);
    return NextResponse.json(
      { error: "NOT_FOUND", message: "No fue posible encontrar este seguimiento." },
      { status: 404 }
    );
  }
}
