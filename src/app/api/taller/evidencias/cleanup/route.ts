import { NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { enqueueS3Cleanup } from "@/lib/storage/s3CleanupQueue";

// POST /api/taller/evidencias/cleanup
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para gestionar evidencias de taller." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const stagingKeysInput: string[] = Array.isArray(body.staging_keys)
      ? body.staging_keys
      : typeof body.staging_key === "string"
      ? [body.staging_key]
      : [];

    if (stagingKeysInput.length === 0) {
      return NextResponse.json({ success: true, message: "No se proporcionaron claves de staging para encolar.", queued_count: 0 });
    }

    const expectedPrefix = `staging/emp_${session.empresa_id}/`;
    let queuedCount = 0;

    for (const rawKey of stagingKeysInput) {
      const cleanKey = String(rawKey || "").trim();
      if (!cleanKey) continue;

      // Reject foreign tenant keys or non-staging keys with 404 semantic isolation (no leakage)
      if (!cleanKey.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "La evidencia solicitada no existe o no pertenece a su empresa." },
          { status: 404 }
        );
      }

      // Validate secure filename format in staging (uuid + extension)
      const relativePart = cleanKey.slice(expectedPrefix.length);
      const isValidFormat = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(relativePart);
      if (!isValidFormat) {
        return NextResponse.json(
          { error: "INVALID_KEY_FORMAT", message: "Formato de clave de staging inválido." },
          { status: 400 }
        );
      }

      await enqueueS3Cleanup(null, {
        empresaId: session.empresa_id,
        objectKey: cleanKey,
        modulo: "TALLER",
        entidad: "recepcion_checklist",
        usuarioId: session.usuario_id
      });
      queuedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Se encolaron ${queuedCount} evidencias temporales para limpieza durable.`,
      queued_count: queuedCount
    });

  } catch (error: any) {
    console.error("Error in POST /api/taller/evidencias/cleanup:", error);
    return NextResponse.json({ error: error.message || "Error al encolar evidencias para limpieza." }, { status: 500 });
  }
}
