import { NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { enqueueS3Cleanup, verifyStagingOwnership, updateStagingState } from "@/lib/storage/s3CleanupQueue";
import { withTransaction } from "@/lib/db";

interface CleanupEntry {
  object_key: string;
  upload_token?: string;
  context_id?: string;
}

// POST /api/taller/evidencias/cleanup
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id || !session.usuario_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para gestionar evidencias de taller." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Normalize input to CleanupEntry[]
    let itemsToProcess: CleanupEntry[] = [];

    if (Array.isArray(body.entries)) {
      itemsToProcess = body.entries.map((e: any) => ({
        object_key: String(e.object_key || e.key || e.s3_key || "").trim(),
        upload_token: String(e.upload_token || e.token || "").trim() || undefined,
        context_id: String(e.context_id || body.context_id || body.idempotency_key || "").trim() || undefined
      }));
    } else if (Array.isArray(body.staging_keys)) {
      const tokens = Array.isArray(body.upload_tokens) ? body.upload_tokens : [];
      itemsToProcess = body.staging_keys.map((k: any, idx: number) => ({
        object_key: String(k || "").trim(),
        upload_token: String(tokens[idx] || body.upload_token || "").trim() || undefined,
        context_id: String(body.context_id || body.idempotency_key || "").trim() || undefined
      }));
    } else if (typeof body.staging_key === "string" || typeof body.object_key === "string") {
      itemsToProcess = [{
        object_key: String(body.staging_key || body.object_key || "").trim(),
        upload_token: String(body.upload_token || body.token || "").trim() || undefined,
        context_id: String(body.context_id || body.idempotency_key || "").trim() || undefined
      }];
    }

    // Filter out completely empty items
    itemsToProcess = itemsToProcess.filter(item => item.object_key);

    if (itemsToProcess.length === 0) {
      return NextResponse.json({ success: true, message: "No se proporcionaron claves de staging para encolar.", queued_count: 0 });
    }

    const expectedPrefix = `staging/emp_${session.empresa_id}/`;
    let queuedCount = 0;

    for (const item of itemsToProcess) {
      const cleanKey = item.object_key;
      const uploadToken = item.upload_token;
      const contextId = item.context_id || body?.context_id || body?.idempotency_key || null;

      // 1. Validate namespace tenant isolation (404 semantic response, 0 info leakage)
      if (!cleanKey.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "La evidencia solicitada no existe o no pertenece a su contexto autorizado." },
          { status: 404 }
        );
      }

      // 2. Validate secure filename format in staging (uuid + extension)
      const relativePart = cleanKey.slice(expectedPrefix.length);
      const isValidFormat = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(relativePart);
      if (!isValidFormat) {
        return NextResponse.json(
          { error: "INVALID_KEY_FORMAT", message: "Formato de clave de staging inválido." },
          { status: 400 }
        );
      }

      // 3. Durable Staging Ownership & Context Authorization Check
      const ownershipCheck = await verifyStagingOwnership({
        empresaId: session.empresa_id,
        objectKey: cleanKey,
        usuarioId: session.usuario_id,
        contextoId: contextId,
        uploadToken: uploadToken || null
      });

      if (!ownershipCheck.authorized) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "La evidencia solicitada no existe o no pertenece a su contexto autorizado." },
          { status: 404 }
        );
      }

      // 4. Atomically update durable registry state to 'QUEUED' and enqueue cleanup obligation
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE admin.s3_staging_registry
           SET estado = 'QUEUED'
           WHERE empresa_id = $1 AND object_key = $2 AND estado = 'STAGING'`,
          [session.empresa_id, cleanKey]
        );

        await enqueueS3Cleanup(client, {
          empresaId: session.empresa_id,
          objectKey: cleanKey,
          modulo: "TALLER",
          entidad: "recepcion_checklist",
          usuarioId: session.usuario_id
        });
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
