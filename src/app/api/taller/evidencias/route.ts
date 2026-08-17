import { NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { isS3Configured, generateUploadToken } from "@/lib/s3";
import crypto from "crypto";

// POST /api/taller/evidencias (Carga Staging de Evidencias)
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para cargar evidencias de recepción." }, { status: 403 });
    }

    // Check S3 Configuration
    if (!isS3Configured()) {
      return NextResponse.json({
        error: "S3_NOT_CONFIGURED",
        message: "Almacenamiento de archivos S3 no configurado en variables de entorno (AWS_S3_BUCKET_NAME / AWS_REGION)."
      }, { status: 503 });
    }

    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let fileName = "evidencia.jpg";
    let mimeType = "image/jpeg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Debe adjuntar un archivo en el campo 'file'." }, { status: 400 });
      }
      fileName = file.name || "evidencia.jpg";
      mimeType = file.type || "image/jpeg";
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      if (!body.base64_data) {
        return NextResponse.json({ error: "Debe enviar 'base64_data' o adjuntar un archivo multipart." }, { status: 400 });
      }
      fileName = body.filename || "evidencia.jpg";
      mimeType = body.mime_type || "image/jpeg";
      const cleanBase64 = String(body.base64_data).replace(/^data:image\/\w+;base64,/, "");
      fileBuffer = Buffer.from(cleanBase64, "base64");
    }

    // Validations
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json({ error: "Formato no permitido. Solamente se admiten imágenes JPG, PNG o WEBP." }, { status: 400 });
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo de evidencia excede el límite máximo de 5 MB." }, { status: 400 });
    }

    // Verify binary magic bytes
    let isValidImage = false;
    if (fileBuffer.length >= 4) {
      if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8) isValidImage = true; // JPEG
      else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4e && fileBuffer[3] === 0x47) isValidImage = true; // PNG
      else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46) isValidImage = true; // WEBP (RIFF)
    }

    if (!isValidImage) {
      return NextResponse.json({ error: "La firma binaria del archivo no corresponde a una imagen válida." }, { status: 400 });
    }

    // Generate staging S3 Key and signed Token
    const uuid = crypto.randomUUID();
    const s3_key = `staging/emp_${session.empresa_id}/${uuid}.jpg`;
    const expires_at = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

    const upload_token = generateUploadToken({
      s3_key,
      empresa_id: session.empresa_id,
      usuario_id: session.usuario_id,
      mime_type: mimeType,
      file_size: fileBuffer.length,
      original_name: fileName,
      expires_at
    });

    return NextResponse.json({
      success: true,
      message: "Evidencia preparada exitosamente en staging.",
      upload_token,
      filename: fileName
    });

  } catch (error: any) {
    console.error("Error in POST /api/taller/evidencias:", error);
    return NextResponse.json({ error: error.message || "Error al procesar la evidencia." }, { status: 500 });
  }
}
