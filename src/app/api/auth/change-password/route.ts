import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { query, withTransaction } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/validations";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";

export async function POST(req: Request) {
  try {
    let sessionToken: string | undefined;
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get("session_token")?.value;
    } catch {
      sessionToken = process.env.TEST_AUTH_SESSION_TOKEN;
    }

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión no válida o no encontrada." },
        { status: 401 }
      );
    }

    const validation = await validateAndTouchSession(sessionToken);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesión expirada o inválida." },
        { status: 401 }
      );
    }

    const userId = validation.userId;
    const body = await req.json().catch(() => ({}));

    const rawNew = String(body.newPassword || body.password || body.nueva_contrasena || "").trim();
    const rawConfirm = String(body.confirmPassword || body.confirm_password || body.confirmar_contrasena || "").trim();

    if (!rawNew) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Debe ingresar una nueva contraseña." },
        { status: 400 }
      );
    }

    if (!rawConfirm) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Debe confirmar la nueva contraseña." },
        { status: 400 }
      );
    }

    if (rawNew !== rawConfirm) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Las contraseñas no coinciden." },
        { status: 400 }
      );
    }

    const policyCheck = validatePasswordPolicy(rawNew);
    if (!policyCheck.isValid) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: policyCheck.message },
        { status: 400 }
      );
    }

    // Check against current hash to prevent reuse of current/initial password
    const secRows = await query<{ password: string | null }>(
      `SELECT password FROM admin.usuario_seguridad WHERE usuario_id = $1 LIMIT 1`,
      [userId]
    );

    if (!secRows || secRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "No se encontró la configuración de seguridad del usuario." },
        { status: 404 }
      );
    }

    const currentHash = secRows[0].password;
    if (currentHash && verifyPassword(rawNew, currentHash)) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "La nueva contraseña no puede ser igual a la contraseña actual." },
        { status: 400 }
      );
    }

    const newHash = hashPassword(rawNew);

    let ip: string | undefined;
    let userAgent: string | undefined;
    try {
      const reqHeaders = await headers();
      ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || undefined;
      userAgent = reqHeaders.get("user-agent") || undefined;
    } catch {
      // Standalone test environment
    }

    // Atomic update
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE admin.usuario_seguridad
         SET password = $1,
             forzar_cambio_clave = false,
             requiere_cambio_clave = false,
             fecha_ultimo_cambio_password = NOW(),
             detalle_estado = 'Contraseña actualizada por el usuario al primer ingreso'
         WHERE usuario_id = $2`,
        [newHash, userId]
      );
    });

    // Forensic audit record (without password or hash)
    await recordUserAudit({
      userId,
      adminId: userId,
      accion: 'PASSWORD_CHANGE_REQUIRED',
      valorAnterior: 'Credencial inicial temporal',
      valorNuevo: 'Nueva credencial configurada',
      motivo: 'Cambio obligatorio de contraseña al primer ingreso completado',
      resultado: 'COMPLETADO',
      ip
    });

    // Activity record
    await recordUserActivity({
      userId,
      modulo: 'Seguridad',
      evento: 'CAMBIO_PASSWORD_OBLIGATORIO',
      descripcion: 'Cambio obligatorio de contraseña completado exitosamente',
      resultado: 'Exitoso',
      ip,
      dispositivo: userAgent
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente."
    });

  } catch (error: any) {
    console.error("Error in POST /api/auth/change-password:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Error interno al cambiar la contraseña." },
      { status: 500 }
    );
  }
}
