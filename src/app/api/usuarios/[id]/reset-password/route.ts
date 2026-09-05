import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/validations";
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
    
    // 1. Authorize caller via session and module SEGURIDAD edit permissions
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

    // Canonical contract: password, confirm_password, forceChangeOnNextLogin
    const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const rawConfirm = typeof body.confirm_password === 'string' ? body.confirm_password.trim() : '';
    const forceChange = body.forceChangeOnNextLogin !== undefined ? Boolean(body.forceChangeOnNextLogin) : true;

    if (!rawPassword) {
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

    if (rawPassword !== rawConfirm) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Las contraseñas no coinciden." },
        { status: 400 }
      );
    }

    const policyCheck = validatePasswordPolicy(rawPassword);
    if (!policyCheck.isValid) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: policyCheck.message },
        { status: 400 }
      );
    }

    // 3. Hash password using secure scrypt (never plain text)
    const passwordHash = hashPassword(rawPassword);

    // 4. Atomic Transaction: update security credentials and revoke active sessions
    await withTransaction(async (client) => {
      const secCheck = await client.query(`SELECT usuario_seguridad_id FROM admin.usuario_seguridad WHERE usuario_id = $1`, [targetUserId]);
      if (!secCheck.rows || secCheck.rows.length === 0) {
        const nextSegRes = await client.query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
        const nextSegId = parseNum(nextSegRes.rows[0]?.next_id) || 1;
        await client.query(
          `INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, mfa_activo, password, requiere_cambio_clave, forzar_cambio_clave, fecha_ultimo_cambio_password, intentos_fallidos, bloqueado_hasta, detalle_estado)
           VALUES ($1, $2, 'EMAIL', $3, false, $4, $5, $5, NOW(), 0, NULL, 'Contraseña asignada por administrador')`,
          [nextSegId, targetUserId, userRow.correo_electronico || 'usuario@bikers.com', passwordHash, forceChange]
        );
      } else {
        await client.query(
          `UPDATE admin.usuario_seguridad
           SET password = $1,
               requiere_cambio_clave = $2,
               forzar_cambio_clave = $2,
               fecha_ultimo_cambio_password = NOW(),
               intentos_fallidos = 0,
               bloqueado_hasta = NULL,
               motivo_bloqueo = NULL,
               detalle_estado = 'Contraseña asignada por administrador'
           WHERE usuario_id = $3`,
          [passwordHash, forceChange, targetUserId]
        );
      }

      // Revoke active sessions within the same database transaction
      await client.query(
        `UPDATE admin.usuario_sesion
         SET estado = 'REVOCADA',
             fecha_cierre = NOW(),
             fecha_revocacion = NOW(),
             revocado_por = $1,
             tipo_cierre = 'REVOCACION',
             motivo_cierre = $2,
             ultima_actividad = NOW()
         WHERE usuario_id = $3
           AND estado = 'ACTIVA'`,
        [authUserId, 'Revocación por restablecimiento de contraseña por administrador', targetUserId]
      );
    });

    // 6. Register audit in admin.usuario_auditoria with authentic adminId (without password)
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

    // 7. Register activity in admin.usuario_actividad (without password)
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

  } catch (error: any) {
    console.error("Error in reset-password endpoint:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: error.message || "Error interno al restablecer la contraseña." },
      { status: 500 }
    );
  }
}
