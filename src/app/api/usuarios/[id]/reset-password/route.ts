import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generateSecurePassword, hashPassword, maskEmail } from "@/lib/auth";
import { sendResetPasswordEmail } from "@/lib/email";
import { validateEmail, validatePasswordPolicy } from "@/lib/validations";
import { authorizeUserUpdate } from "@/lib/userAuth";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";

const parseNum = (val: any) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Authorize caller via session and module SEGURIDAD permissions
    const authResult = await authorizeUserUpdate(id);
    if (!authResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: authResult.error, 
          message: authResult.message,
          ...(authResult.field ? { field: authResult.field } : {})
        },
        { status: authResult.status }
      );
    }

    const { authUserId, targetUserId } = authResult;

    // 2. Validate target user existence and status
    const userResult = await query(
      `SELECT u.usuario_id, u.estado, u.estado_activacion,
              ui.nombre, ui.apellido, ui.correo_electronico, ui.numero_documento
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE u.usuario_id = $1`,
      [targetUserId]
    );

    if (!userResult || userResult.length === 0) {
      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "El usuario no existe." }, { status: 404 });
    }

    const userRow = userResult[0];
    if (userRow.estado === 'ELIMINADO' || userRow.estado === 'INCOMPATIBLE') {
      return NextResponse.json({ success: false, error: "INVALID_STATE", message: "La cuenta del usuario se encuentra inhabilitada o eliminada." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'manual' ? 'manual' : (body.newPassword ? 'manual' : 'automatic');

    // ----------------------------------------------------
    // MODE A: MANUAL PASSWORD RESET BY ADMINISTRATOR
    // ----------------------------------------------------
    if (mode === 'manual') {
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
      const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword.trim() : '';
      const forceChange = body.forceChangeOnNextLogin !== undefined ? Boolean(body.forceChangeOnNextLogin) : true;

      if (!newPassword) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Debe ingresar una nueva contraseña." },
          { status: 400 }
        );
      }

      if (confirmPassword && newPassword !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Las contraseñas no coinciden." },
          { status: 400 }
        );
      }

      const policyCheck = validatePasswordPolicy(newPassword);
      if (!policyCheck.isValid) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: policyCheck.message },
          { status: 400 }
        );
      }

      // Hash password using secure scrypt (never plain text)
      const passwordHash = hashPassword(newPassword);

      // Verify or initialize admin.usuario_seguridad
      const secCheck = await query(`SELECT usuario_seguridad_id FROM admin.usuario_seguridad WHERE usuario_id = $1`, [targetUserId]);
      if (!secCheck || secCheck.length === 0) {
        const nextSegRes = await query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
        const nextSegId = parseNum(nextSegRes[0]?.next_id) || 1;
        await query(
          `INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, mfa_activo, password, requiere_cambio_clave, forzar_cambio_clave, fecha_ultimo_cambio_password, intentos_fallidos, bloqueado_hasta)
           VALUES ($1, $2, 'EMAIL', $3, false, $4, $5, $5, NOW(), 0, NULL)`,
          [nextSegId, targetUserId, userRow.correo_electronico || 'usuario@bikers.com', passwordHash, forceChange]
        );
      } else {
        await query(
          `UPDATE admin.usuario_seguridad
           SET password = $1,
               requiere_cambio_clave = $2,
               forzar_cambio_clave = $2,
               fecha_ultimo_cambio_password = NOW(),
               intentos_fallidos = 0,
               bloqueado_hasta = NULL,
               motivo_bloqueo = NULL,
               detalle_estado = 'Contraseña manual asignada por administrador'
           WHERE usuario_id = $3`,
          [passwordHash, forceChange, targetUserId]
        );
      }

      // Register audit in admin.usuario_auditoria with authentic admin_id
      await recordUserAudit({
        userId: targetUserId,
        adminId: authUserId,
        accion: 'PASSWORD_RESET_MANUAL',
        valorAnterior: 'Credencial de acceso previa',
        valorNuevo: 'Credencial restablecida manualmente',
        motivo: 'Restablecimiento manual de credenciales por administrador',
        resultado: 'COMPLETADO',
        req
      });

      // Register activity in admin.usuario_actividad
      await recordUserActivity({
        userId: targetUserId,
        modulo: 'Seguridad',
        evento: 'RESET_PASSWORD_MANUAL',
        descripcion: 'Restablecimiento manual de contraseña por administrador',
        resultado: 'Exitoso',
        req
      });

      return NextResponse.json({
        success: true,
        message: "Contraseña restablecida correctamente."
      });
    }

    // ----------------------------------------------------
    // MODE B: AUTOMATIC EMAIL TEMPORARY PASSWORD RESET
    // ----------------------------------------------------
    const configResult = await query(
      `SELECT usuario_id, correo_acceso, enviar_invitacion_correo, generar_clave_automatica, forzar_cambio_clave
       FROM admin.usuario_seguridad
       WHERE usuario_id = $1`,
      [targetUserId]
    );

    const configRow = configResult && configResult.length > 0 ? configResult[0] : null;
    const recoveryEmail = configRow?.correo_acceso?.trim() || userRow.correo_electronico?.trim();

    if (!recoveryEmail) {
      return NextResponse.json(
        { success: false, error: "CONFIG_ERROR", message: "El usuario no tiene un correo electrónico configurado para el envío." },
        { status: 400 }
      );
    }

    const emailValidation = validateEmail(recoveryEmail, true);
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "El correo electrónico no tiene un formato válido." },
        { status: 400 }
      );
    }

    // Generate secure temporary password in backend
    const tempPassword = generateSecurePassword({
      first_name: userRow.nombre,
      last_name: userRow.apellido,
      email: userRow.correo_electronico,
      document_number: userRow.numero_documento
    });

    const passwordHash = hashPassword(tempPassword);
    const expirationDays = 7;
    const expiresAtDate = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    const expiresAtISO = expiresAtDate.toISOString();
    const expiresAtFormatted = expiresAtDate.toLocaleString('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const fullName = `${userRow.nombre || ''} ${userRow.apellido || ''}`.trim() || 'Usuario';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;

    // Send email before committing
    const emailRes = await sendResetPasswordEmail({
      to: recoveryEmail,
      subject: "Restablecimiento de contraseña - Bikers’ Fort",
      fullName,
      accessIdentifier: userRow.correo_electronico || recoveryEmail,
      tempPassword,
      expiresAtFormatted,
      loginUrl
    });

    if (!emailRes.success) {
      return NextResponse.json(
        { success: false, error: "EMAIL_ERROR", message: "No fue posible enviar el correo de recuperación. No se aplicaron cambios." },
        { status: 500 }
      );
    }

    // Update admin.usuario_seguridad
    await query(
      `UPDATE admin.usuario_seguridad
       SET password = $1,
           requiere_cambio_clave = true,
           forzar_cambio_clave = true,
           fecha_ultimo_cambio_password = NOW(),
           fecha_credenciales_generada = NOW(),
           fecha_expiracion_invitacion = NOW() + INTERVAL '7 days',
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           motivo_bloqueo = NULL,
           detalle_estado = 'Contraseña temporal enviada por correo'
       WHERE usuario_id = $2`,
      [passwordHash, targetUserId]
    );

    const masked = maskEmail(recoveryEmail);

    // Register audit and activity with authentic admin_id
    await recordUserAudit({
      userId: targetUserId,
      adminId: authUserId,
      accion: 'PASSWORD_RESET_EMAIL',
      valorAnterior: 'Credencial previa',
      valorNuevo: `Contraseña temporal enviada a ${masked}`,
      motivo: 'Restablecimiento de contraseña por correo electrónico',
      resultado: 'COMPLETADO',
      req
    });

    await recordUserActivity({
      userId: targetUserId,
      modulo: 'Seguridad',
      evento: 'RESET_PASSWORD_EMAIL',
      descripcion: `Envío de contraseña temporal por correo a ${masked}`,
      resultado: 'Exitoso',
      req
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña temporal generada y enviada correctamente.",
      maskedEmail: masked,
      expiresAt: expiresAtISO
    });

  } catch (error: any) {
    console.error("Error in reset-password endpoint:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: error.message || "Error interno al restablecer la contraseña." },
      { status: 500 }
    );
  }
}
