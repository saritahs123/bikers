import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession } from "@/lib/workshop-session";
import { getPresignedDownloadUrl, checkS3ObjectExists } from "@/lib/storage/s3";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key || typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "INVALID_KEY", message: "Se requiere una clave de objeto válida." }, { status: 400 });
    }

    const cleanKey = key.trim();

    // Validate path traversal attempts
    if (cleanKey.includes("..")) {
      return NextResponse.json({ error: "INVALID_KEY", message: "La clave enviada contiene caracteres no permitidos." }, { status: 400 });
    }

    // Company isolation check on Key structure: {ambiente}/{empresa_id}/...
    const parts = cleanKey.split("/");
    if (parts.length < 3) {
      return NextResponse.json({ error: "INVALID_KEY_STRUCTURE", message: "Estructura de clave S3 no reconocida." }, { status: 400 });
    }

    const keyEmpresaId = parts[1];
    if (String(keyEmpresaId) !== String(empresaId)) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No tiene permiso para acceder a objetos de otra empresa." }, { status: 403 });
    }

    // Check if object exists in S3
    const exists = await checkS3ObjectExists(cleanKey);
    if (!exists) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El objeto solicitado no existe en el almacenamiento." }, { status: 404 });
    }

    // Generate presigned download URL
    const { downloadUrl, expiresIn } = await getPresignedDownloadUrl({
      key: cleanKey
    });

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresIn
    });

  } catch (error: any) {
    console.error("Error in GET /api/storage/presign-download:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al generar la URL firmada de lectura." }, { status: 500 });
  }
}
