"use server";

import { query, withTransaction } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/validations";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChangePasswordState = {
  success?: boolean;
  error?: string;
} | null;

export async function changeMandatoryPasswordAction(
  prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  let shouldRedirect = false;

  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie) {
      return { success: false, error: "Sesión no válida o no encontrada. Por favor inicie sesión nuevamente." };
    }

    const validation = await validateAndTouchSession(tokenCookie);
    if (!validation.valid || !validation.userId) {
      return { success: false, error: "Sesión expirada o no autorizada. Por favor inicie sesión nuevamente." };
    }

    const userId = validation.userId;

    const rawNew = String(formData.get("newPassword") || "");
    const rawConfirm = String(formData.get("confirmPassword") || "");

    if (!rawNew) {
      return { success: false, error: "Debe ingresar una nueva contraseña." };
    }

    if (!rawConfirm) {
      return { success: false, error: "Debe confirmar la nueva contraseña." };
    }

    if (rawNew !== rawConfirm) {
      return { success: false, error: "Las contraseñas no coinciden." };
    }

    const policy = validatePasswordPolicy(rawNew);
    if (!policy.isValid) {
      return { success: false, error: policy.message };
    }

    // Fetch current user security record to prevent reuse of current/initial password
    const secRows = await query<{ password: string | null }>(
      `SELECT password FROM admin.usuario_seguridad WHERE usuario_id = $1 LIMIT 1`,
      [userId]
    );

    if (!secRows || secRows.length === 0) {
      return { success: false, error: "No se encontró el registro de seguridad del usuario." };
    }

    const currentHash = secRows[0].password;

    // Securely compare against current hash using canonical verifyPassword
    if (currentHash && verifyPassword(rawNew, currentHash)) {
      return { success: false, error: "La nueva contraseña no puede ser igual a la contraseña actual." };
    }

    // Hash new password using canonical scrypt
    const newHash = hashPassword(rawNew);

    const reqHeaders = await headers();
    const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || undefined;
    const userAgent = reqHeaders.get("user-agent") || undefined;

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

    // Forensic audit record (no passwords or hashes)
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

    // Operational activity record
    await recordUserActivity({
      userId,
      modulo: 'Seguridad',
      evento: 'CAMBIO_PASSWORD_OBLIGATORIO',
      descripcion: 'Cambio obligatorio de contraseña completado exitosamente',
      resultado: 'Exitoso',
      ip,
      dispositivo: userAgent
    });

    shouldRedirect = true;
  } catch (err: any) {
    if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Error in changeMandatoryPasswordAction:", err);
    return { success: false, error: "Error técnico al actualizar la contraseña. Intente nuevamente." };
  }

  if (shouldRedirect) {
    redirect("/");
  }

  return { success: true };
}
