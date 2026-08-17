import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { isS3Configured } from "@/lib/s3";

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

    // Multitenant Check
    const rows = await query(
      `SELECT rc.recepcion_checklist_id, rc.ruta_archivo, rc.nombre_archivo, rc.evidencia_foto
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

    if (!isS3Configured()) {
      return NextResponse.json({
        error: "S3_NOT_CONFIGURED",
        message: "Almacenamiento de archivos S3 no configurado en variables de entorno. La evidencia física no está disponible."
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: {
        recepcion_checklist_id: r.recepcion_checklist_id,
        nombre_archivo: r.nombre_archivo || "evidencia.jpg",
        key_referencia: r.ruta_archivo || null
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
