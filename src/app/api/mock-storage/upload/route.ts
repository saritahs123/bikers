import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  // Blindaje estricto: solo accesible en entorno de pruebas
  if (process.env.APP_ENV !== "test") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const rawKey = searchParams.get("key") || "unknown";
  const key = rawKey.replace(/[^a-zA-Z0-9_\-\.\/]/g, "").replace(/\.\./g, "");

  return NextResponse.json({
    success: true,
    message: "Subida simulada exitosa en entorno local de pruebas.",
    mock: true,
    key
  }, { status: 200 });
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
