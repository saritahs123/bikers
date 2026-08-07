import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generateSecurePassword, hashPassword, maskEmail } from "@/lib/auth";
import { sendResetPasswordEmail } from "@/lib/email";
import { validateEmail } from "@/lib/validations";

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
    const userId = parseInt(id.replace(/\D/g, ""), 10);

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido." }, { status: 400 });
    }

    // 1. Validate user existence and status
    const userResult = await query(
      `SELECT u.usuario_id, u.estado, u.estado_activacion,
              ui.nombre, ui.apellido, ui.correo_electronico, ui.numero_documento
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE u.usuario_id = $1`,
      [userId]
    );

    if (!userResult || userResult.length === 0) {
      return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
    }

    const userRow = userResult[0];
    if (userRow.estado === 'ELIMINADO' || userRow.estado === 'INCOMPATIBLE') {
      return NextResponse.json({ error: "La cuenta del usuario se encuentra inhabilitada o eliminada." }, { status: 400 });
    }

    // 2. Fetch access configuration from admin.usuario_seguridad
    const configResult = await query(
      `SELECT usuario_id, correo_acceso, enviar_invitacion_correo, generar_clave_automatica, forzar_cambio_clave
       FROM admin.usuario_seguridad
       WHERE usuario_id = $1`,
      [userId]
    );

    if (!configResult || configResult.length === 0) {
      return NextResponse.json({ error: "No se encontró la configuración de acceso del usuario." }, { status: 400 });
    }

    const configRow = configResult[0];

    // 3. Pre-validations
    // Check 3.1: Recovery Email exists
    if (!configRow.correo_acceso || !configRow.correo_acceso.trim()) {
      return NextResponse.json(
        { error: "El usuario no tiene un correo de recuperación configurado." },
        { status: 400 }
      );
    }

    const recoveryEmail = configRow.correo_acceso.trim();

    // Check 3.2: Recovery Email Format
    const emailValidation = validateEmail(recoveryEmail, true);
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { error: "El correo de recuperación no tiene un formato válido." },
        { status: 400 }
      );
    }

    // Check 3.3: Enviar Invitación (Email) Enabled
    if (configRow.enviar_invitacion_correo !== true) {
      return NextResponse.json(
        { error: "El envío de invitaciones por correo no está habilitado para este usuario." },
        { status: 400 }
      );
    }

    // 4. Verify admin.usuario_seguridad record exists
    const securityResult = await query(
      `SELECT usuario_id, metodo_acceso_principal, identificador_principal, password
       FROM admin.usuario_seguridad
       WHERE usuario_id = $1`,
      [userId]
    );

    let securityRow = securityResult && securityResult.length > 0 ? securityResult[0] : null;

    if (!securityRow) {
      // If missing, initialize security row
      const maxSegRes = await query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
      const nextSegId = parseNum(maxSegRes[0]?.next_id) || 1;

      await query(
        `INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, mfa_activo)
         VALUES ($1, $2, 'EMAIL', $3, false)`,
        [nextSegId, userId, userRow.correo_electronico || recoveryEmail]
      );
    }

    // 5. Generate secure temporary password in backend
    const tempPassword = generateSecurePassword({
      first_name: userRow.nombre,
      last_name: userRow.apellido,
      email: userRow.correo_electronico,
      document_number: userRow.numero_documento
    });

    // 6. Hash temporary password
    const passwordHash = hashPassword(tempPassword);

    // 7. Calculate expiration date (7 days policy)
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

    // 8. Prepare email details
    const fullName = `${userRow.nombre || ''} ${userRow.apellido || ''}`.trim() || 'Usuario';
    const accessIdentifier = securityRow?.identificador_principal || userRow.correo_electronico || userRow.numero_documento || recoveryEmail;
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;

    // 9. Send email BEFORE committing password change to prevent locking user out if email fails
    const emailRes = await sendResetPasswordEmail({
      to: recoveryEmail,
      subject: "Restablecimiento de contraseña - Bikers’ Fort",
      fullName,
      accessIdentifier,
      tempPassword,
      expiresAtFormatted,
      loginUrl
    });

    if (!emailRes.success) {
      return NextResponse.json(
        { error: "No fue posible enviar el correo de recuperación. No se aplicaron cambios a la contraseña." },
        { status: 500 }
      );
    }

    // 10. Update admin.usuario_seguridad with hashed password and forced change flags
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
           detalle_estado = 'Contraseña temporal generada por administrador'
       WHERE usuario_id = $2`,
      [passwordHash, userId]
    );

    // 12. Register audit log
    const masked = maskEmail(recoveryEmail);
    await query(
      `INSERT INTO admin.usuario_auditoria
       (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
       VALUES ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, 1, NOW(), 'RESET_PASSWORD', 'Estado: Anterior', $2, 'Restablecimiento forzado de contraseña por administrador', 'COMPLETADO', '127.0.0.1', 'Navegador Web')`,
      [
        userId,
        `Destinatario: ${masked} | Expiración: ${expiresAtISO}`
      ]
    );

    // 13. Return safe success response (NEVER return plain password or hash)
    return NextResponse.json({
      success: true,
      message: "Contraseña temporal generada y enviada correctamente.",
      maskedEmail: masked,
      expiresAt: expiresAtISO
    });

  } catch (error: any) {
    console.error("Error in reset-password endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al restablecer la contraseña." },
      { status: 500 }
    );
  }
}
