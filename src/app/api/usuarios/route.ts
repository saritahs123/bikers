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

export async function GET() {
  try {
    // 1. We join the primary identity, security, access config, role and type tables.
    const sql = `
      SELECT 
        u.usuario_id AS id,
        u.estado,
        u.estado_activacion,
        u.fecha_creacion,
        u.empresa_id AS "companyId",
        ui.nombre AS first_name,
        ui.apellido AS last_name,
        ui.nombre || ' ' || ui.apellido AS full_name,
        ui.correo_electronico AS email,
        ui.telefono AS phone,
        ui.numero_documento AS document_number,
        ui.departamento_id,
        ui.area_id,
        ui.cargo_id,
        r.nombre AS role,
        tu.nombre AS user_type,
        us.metodo_acceso_principal AS primary_access_type,
        us.identificador_principal AS login_identifiers,
        us.fecha_ultimo_acceso AS last_login_at,
        us.mfa_activo AS "mfaEnabled",
        us.mfa_tipo AS mfa_method,
        us.detalle_estado AS activation,
        us.correo_acceso,
        us.enviar_invitacion_correo,
        us.generar_clave_automatica,
        us.forzar_cambio_clave,
        us.idioma_preferido,
        us.zona_horaria,
        us.formato_fecha
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
      LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      ORDER BY u.usuario_id DESC
    `;
    
    const usersRes = await query(sql);
    
    // Convert properties correctly for the frontend component
    const mappedUsers = (usersRes || []).map((u: any) => ({
      id: u.id,
      full_name: u.full_name || 'Desconocido',
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      document_number: u.document_number,
      companyId: u.companyId,
      department_id: u.departamento_id,
      area_id: u.area_id,
      cargo_id: u.cargo_id,
      role: u.role || 'Sin Rol',
      user_type: u.user_type || 'Sin Tipo',
      primary_access_type: u.primary_access_type,
      login_identifiers: u.login_identifiers ? [{ is_primary: true, identifier_value: u.login_identifiers }] : [],
      last_login_at: u.last_login_at,
      mfaEnabled: !!u.mfaEnabled,
      mfa_method: u.mfa_method,
      status: u.estado, 
      estado: u.estado, 
      estado_activacion: u.estado_activacion,
      activation: u.activation,
      fecha_creacion: u.fecha_creacion,
      correo_acceso: u.correo_acceso || null,
      enviar_invitacion_correo: Boolean(u.enviar_invitacion_correo),
      generar_clave_automatica: Boolean(u.generar_clave_automatica),
      forzar_cambio_clave: Boolean(u.forzar_cambio_clave),
      idioma_preferido: u.idioma_preferido || 'Español (América Latina)',
      zona_horaria: u.zona_horaria || 'America/Santo_Domingo (GMT-4)',
      formato_fecha: u.formato_fecha || 'DD/MM/YYYY',
      permissionsOverride: false, // Default logic mapping
      scope_type: 'GLOBAL' // Default scope mapping 
    }));

    return NextResponse.json(mappedUsers);
  } catch (error: any) {
    console.error("Error in GET /api/usuarios:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = (body.first_name || '').trim();
    const lastName = (body.last_name || '').trim();
    const email = (body.email || body.correo_electronico || body.access_email || '').trim().toLowerCase();
    const phone = (body.phone || body.telefono || '').trim();
    const docNumber = (body.document_number || body.numero_documento || '').trim();
    
    const companyId = parseNum(body.companyId || body.empresa_id);
    const userTypeId = parseNum(body.tipo_usuario_id || body.user_type_id);
    let rolId = parseNum(body.rol_id || body.role_id || body.rol_principal_id);

    if (!rolId && body.role) {
      try {
        const rRes = await query(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE LOWER(nombre) = LOWER($1) LIMIT 1`, [body.role]);
        if (rRes && rRes.length > 0) {
          rolId = parseNum(rRes[0].rol_funcional_id);
        }
      } catch (e) {
        console.warn("Could not resolve role by name:", e);
      }
    }

    const deptId = parseNum(body.department_id || body.departamento_id);
    const areaId = parseNum(body.area_id);
    const cargoId = parseNum(body.cargo_id);

    // Strict Validations
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'El nombre y apellido son obligatorios.' }, { status: 400 });
    }
    
    const emailVal = validateEmail(email, true);
    if (!emailVal.isValid) {
      return NextResponse.json({ error: emailVal.message || 'Correo electrónico inválido.' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: 'La empresa es obligatoria.' }, { status: 400 });
    }

    if (!userTypeId) {
      return NextResponse.json({ error: 'El tipo de usuario es obligatorio.' }, { status: 400 });
    }

    if (!rolId) {
      return NextResponse.json({ error: 'El rol principal es obligatorio.' }, { status: 400 });
    }

    // Check duplicate email
    const emailCheck = await query(
      `SELECT 1 FROM admin.usuario_identidad WHERE LOWER(correo_electronico) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (emailCheck && emailCheck.length > 0) {
      return NextResponse.json({ error: 'El correo electrónico ya se encuentra registrado en el sistema.' }, { status: 400 });
    }

    // Check duplicate document number if provided
    if (docNumber) {
      const docCheck = await query(
        `SELECT 1 FROM admin.usuario_identidad WHERE numero_documento = $1 AND LENGTH(numero_documento) > 0 LIMIT 1`,
        [docNumber]
      );
      if (docCheck && docCheck.length > 0) {
        return NextResponse.json({ error: 'El número de documento ya se encuentra registrado.' }, { status: 400 });
      }
    }

    // Generate secure temp password & hash
    const tempPassword = generateSecurePassword({
      first_name: firstName,
      last_name: lastName,
      email,
      document_number: docNumber
    });
    const passwordHash = hashPassword(tempPassword);

    // Calculate next usuario_id
    const maxUserRes = await query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
    const nextUserId = parseNum(maxUserRes[0]?.next_id) || 1;

    // 1. Insert into admin.usuario
    await query(
      `INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [nextUserId, companyId, userTypeId, rolId, 'ACTIVO', 'Pendiente de primer ingreso']
    );

    // 2. Insert into admin.usuario_identidad
    await query(
      `INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono, numero_documento, departamento_id, area_id, cargo_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [nextUserId, firstName, lastName, email, phone || null, docNumber || null, deptId || null, areaId || null, cargoId || null]
    );

    // 3. Insert into admin.usuario_seguridad
    const mainType = body.primary_access_type || 'EMAIL';
    const mainIdent = mainType === 'EMAIL' ? email : (docNumber || email);
    const sendInvite = body.enviar_invitacion_correo !== false && body.send_invitation !== false;

    const maxSegRes = await query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
    const nextSegId = parseNum(maxSegRes[0]?.next_id) || 1;

    await query(
      `INSERT INTO admin.usuario_seguridad
       (usuario_seguridad_id, usuario_id, password, metodo_acceso_principal, identificador_principal, mfa_activo, mfa_tipo, restriccion_ip, restriccion_horaria, requiere_cambio_clave, forzar_cambio_clave, fecha_credenciales_generada, fecha_expiracion_invitacion, intentos_fallidos, detalle_estado, correo_acceso, enviar_invitacion_correo, generar_clave_automatica, idioma_preferido, zona_horaria, formato_fecha, inactividad_minutos, intentos_fallidos_permitidos, exigir_aprobacion_exportacion, exigir_doble_validacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW(), NOW() + INTERVAL '7 days', 0, 'Credenciales temporales generadas', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        nextSegId,
        nextUserId,
        passwordHash,
        mainType,
        mainIdent,
        Boolean(body.mfaEnabled || body.mfa_activo),
        body.mfa_method || 'MFA no configurado',
        body.allowed_ips || '*',
        body.allowed_hours || 'Cualquier horario',
        body.must_change_password !== false && body.forzar_cambio_clave !== false,
        body.correo_acceso || email,
        sendInvite,
        body.auto_generate_password !== false,
        body.preferred_language || 'es',
        body.timezone || 'America/Santo_Domingo',
        body.date_format || 'DD/MM/YYYY',
        body.inactivity_timeout_minutes ?? 0,
        body.max_failed_attempts ?? 10,
        Boolean(body.require_export_approval),
        Boolean(body.require_dual_validation)
      ]
    );

    // 5. Additional roles (admin.usuario_rol_adicional)
    if (Array.isArray(body.roles_additional) && body.roles_additional.length > 0) {
      for (const addRol of body.roles_additional) {
        const addRolId = parseNum(typeof addRol === 'object' ? (addRol.id || addRol.rol_funcional_id) : addRol);
        if (addRolId && addRolId !== rolId) {
          try {
            await query(
              `INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, $2)`,
              [nextUserId, addRolId]
            );
          } catch (e) {
            console.warn("Error inserting usuario_rol_adicional:", e);
          }
        }
      }
    }

    // 6. Scope (admin.usuario_alcance)
    const scopeType = body.scope_type || 'COMPANY';
    try {
      const scopeMax = await query(`SELECT COALESCE(MAX(usuario_alcance_id), 0) + 1 AS next_id FROM admin.usuario_alcance`);
      const nextScopeId = parseNum(scopeMax[0]?.next_id) || 1;
      await query(
        `INSERT INTO admin.usuario_alcance
         (usuario_alcance_id, usuario_id, tipo_alcance, incluir_hijos, permite_ver, permite_editar, permite_exportar, permite_asignar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          nextScopeId,
          nextUserId,
          scopeType,
          body.include_children !== false,
          body.can_view !== false,
          Boolean(body.can_edit),
          Boolean(body.can_export),
          Boolean(body.can_assign)
        ]
      );
    } catch (e) {
      console.warn("Error inserting usuario_alcance:", e);
    }

    // 7. Send credentials email if enabled
    let emailSent = false;
    let emailError = null;

    if (sendInvite) {
      const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const expiresAtFormatted = expiresAtDate.toLocaleString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
      const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;

      const emailRes = await sendResetPasswordEmail({
        to: email,
        subject: "Bienvenido a Bikers’ Fort - Credenciales temporales",
        fullName: `${firstName} ${lastName}`,
        accessIdentifier: mainIdent,
        tempPassword,
        expiresAtFormatted,
        loginUrl
      });

      emailSent = emailRes.success;
      if (!emailRes.success) {
        emailError = emailRes.error;
      }
    }

    // 8. Register audit log
    try {
      const masked = maskEmail(email);
      await query(
        `INSERT INTO admin.usuario_auditoria
         (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
         VALUES ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, 1, NOW(), 'CREAR_USUARIO', 'Sin registro previo', $2, 'Creación de nuevo usuario desde asistente IAM', 'COMPLETADO', '127.0.0.1', 'Navegador Web')`,
        [nextUserId, `Email: ${masked} | Empresa: ${companyId} | Rol: ${rolId}`]
      );
    } catch (e) {
      console.warn("Could not insert audit log:", e);
    }

    return NextResponse.json({
      success: true,
      usuario_id: nextUserId,
      message: emailSent
        ? `Usuario creado correctamente. Las credenciales temporales fueron enviadas a ${maskEmail(email)}.`
        : (sendInvite ? `El usuario fue creado, pero no se pudo enviar el correo de credenciales (${emailError || 'Error de proveedor'}). Puede reenviarlo desde el detalle del usuario.` : `Usuario creado correctamente en la base de datos.`),
      emailSent,
      emailError
    });
  } catch (error: any) {
    console.error("Error in POST /api/usuarios:", error);
    return NextResponse.json({ error: error.message || 'Error al crear el usuario en la base de datos.' }, { status: 500 });
  }
}

