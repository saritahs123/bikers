import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Blindaje estricto: solo accesible en entorno de pruebas
  if (process.env.APP_ENV !== "test") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const rawKey = searchParams.get("key") || "unknown";
  // Sanitizar clave para prevenir path traversal o inyeccion
  const key = rawKey.replace(/[^a-zA-Z0-9_\-\.\/]/g, "").replace(/\.\./g, "");

  // Retornar un SVG placeholder neutral
  const svgPlaceholder = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#1e293b"/>
      <text x="50%" y="45%" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16" font-weight="bold">
        RIDE LAB TEST ENVIRONMENT
      </text>
      <text x="50%" y="55%" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="12">
        Evidencia simulada (${key.substring(0, 35)}...)
      </text>
    </svg>
  `.trim();

  return new NextResponse(svgPlaceholder, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
