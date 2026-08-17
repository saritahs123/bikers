import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import {
  isS3Configured,
  getMissingS3EnvVars,
  getPresignedDownloadUrl,
  checkS3ObjectExists,
  isS3ObjectKey
} from "@/lib/storage/s3";

export const runtime = "nodejs";

// GET /api/taller/evidencias/[recepcion_checklist_id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ recepcion_checklist_id: string }> }
) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para acceder a las evidencias." }, { status: 403 });
    }

    const resolvedParams = await params;
    const chkId = parseInt(resolvedParams.recepcion_checklist_id, 10);
    if (isNaN(chkId)) {
      return NextResponse.json({ error: "ID de checklist inválido." }, { status: 400 });
    }

    // Query recepcion_checklist & multitenant company check
    const rows = await query(
      `SELECT rc.recepcion_checklist_id, rc.ruta_archivo, rc.url_archivo, rc.nombre_archivo, rc.evidencia_foto,
              r.recepcion_id, u.empresa_id as recepcion_empresa_id
       FROM admin.recepcion_checklist rc
       JOIN admin.recepciones r ON rc.recepcion_id = r.recepcion_id
       LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
       WHERE rc.recepcion_checklist_id = $1 AND (u.empresa_id = $2 OR u.empresa_id IS NULL OR $2 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
       LIMIT 1`,
      [chkId, session.empresa_id]
    );

    if (!rows || rows.length === 0 || !rows[0].evidencia_foto) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La evidencia solicitada no existe o no pertenece a su empresa." }, { status: 404 });
    }

    const r = rows[0];
    const keyCandidate = (r.ruta_archivo || r.url_archivo || "").trim();

    if (!keyCandidate) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El registro no contiene una clave o ruta de archivo asociada." }, { status: 404 });
    }

    let downloadUrl: string | null = null;
    let expiresIn = 300;

    if (isS3ObjectKey(keyCandidate) || (!keyCandidate.startsWith("http") && !keyCandidate.startsWith("/storage") && keyCandidate.includes("/"))) {
      // S3 Storage path -> Check S3 configuration first
      if (!isS3Configured()) {
        const missing = getMissingS3EnvVars();
        console.warn("S3 no configurado. Variables ausentes:", missing);
        return NextResponse.json({
          error: "S3_NOT_CONFIGURED",
          message: `Almacenamiento S3 no configurado en el servidor. Variables ausentes: ${missing.join(", ")}`
        }, { status: 503 });
      }

      // Check physical S3 object existence
      const exists = await checkS3ObjectExists(keyCandidate);
      if (!exists) {
        return NextResponse.json({
          error: "S3_OBJECT_NOT_FOUND",
          message: "El archivo físico de la evidencia no fue encontrado en el bucket S3."
        }, { status: 404 });
      }

      const presigned = await getPresignedDownloadUrl({ key: keyCandidate });
      downloadUrl = presigned.downloadUrl;
      expiresIn = presigned.expiresIn;

    } else if (keyCandidate.startsWith("http://") || keyCandidate.startsWith("https://") || keyCandidate.startsWith("/storage/")) {
      // Legacy URL / path compatibility
      downloadUrl = keyCandidate;
    } else {
      return NextResponse.json({ error: "INVALID_KEY_FORMAT", message: "El formato de la clave de archivo no es válido." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresIn,
      data: {
        recepcion_checklist_id: r.recepcion_checklist_id,
        nombre_archivo: r.nombre_archivo || "evidencia.jpg",
        key_referencia: r.ruta_archivo || null,
        downloadUrl,
        url_evidencia: downloadUrl
      }
    });

  } catch (error: any) {
    console.error("Error in GET /api/taller/evidencias/[recepcion_checklist_id]:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "Error al recuperar evidencia.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}
