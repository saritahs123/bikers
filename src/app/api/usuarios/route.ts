import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { hashPassword, maskEmail } from "@/lib/auth";
import { validateEmail, validatePasswordPolicy } from "@/lib/validations";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { authorizeUserCreate } from "@/lib/userAuth";

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
        NULLIF(TRIM(CONCAT(COALESCE(ui.nombre, ''), ' ', COALESCE(ui.apellido, ''))), '') AS full_name,
        ui.correo_electronico AS email,
        ui.telefono AS phone,
        ui.numero_documento AS document_number,
        ui.departamento_id,
        ui.area_id,
        ui.cargo_id,
        r.nombre AS role,
        tu.nombre AS user_type,
        us.metodo_acceso_principal AS primary_access_type,
        us.identificador_principal,
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
    const mappedUsers = (usersRes || []).map((u: any) => {
      const primaryAccessValue = u.identificador_principal || u.correo_acceso || u.email || u.document_number || (u.id ? `ID #${u.id}` : '—');
      const resolvedFullName = u.full_name || u.email || u.identificador_principal || (u.id ? `Usuario #${u.id}` : 'Usuario');

      return {
        id: u.id,
        full_name: resolvedFullName,
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
        primary_access_type: u.primary_access_type || 'EMAIL',
        identificador_principal: primaryAccessValue,
        login_identifiers: [
          {
            is_primary: true,
            identifier_type: u.primary_access_type || (primaryAccessValue.includes('@') ? 'EMAIL' : 'DOCUMENT'),
            identifier_value: primaryAccessValue
          }
        ],
        last_login_at: u.last_login_at,
        mfaEnabled: !!u.mfaEnabled,
        mfa_method: u.mfa_method,
        status: u.estado, 
        estado: u.estado, 
        estado_activacion: u.estado_activacion,
        activation: u.activation,
        fecha_creacion: u.fecha_creacion,
        correo_acceso: u.correo_acceso || u.identificador_principal || u.email || null,
        enviar_invitacion_correo: Boolean(u.enviar_invitacion_correo),
        generar_clave_automatica: Boolean(u.generar_clave_automatica),
        forzar_cambio_clave: Boolean(u.forzar_cambio_clave),
        idioma_preferido: u.idioma_preferido || 'Español (América Latina)',
        zona_horaria: u.zona_horaria || 'America/Santo_Domingo (GMT-4)',
        formato_fecha: u.formato_fecha || 'DD/MM/YYYY',
        permissionsOverride: false, // Default logic mapping
        scope_type: 'GLOBAL' // Default scope mapping 
      };
    });

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

    // 1. Authorize user creation with strict SEGURIDAD.puede_crear permission and multitenant company isolation
    const authCheck = await authorizeUserCreate(companyId);
    if (!authCheck.success) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status }
      );
    }
    const authAdminId = authCheck.authUserId;

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

    // Password validations (administrator writes password manually)
    const rawPassword = typeof body.password === 'string' ? body.password : '';
    const rawConfirm = typeof body.confirm_password === 'string' ? body.confirm_password : '';

    if (!rawPassword) {
      return NextResponse.json({ error: 'La contraseña es obligatoria.' }, { status: 400 });
    }

    if (!rawConfirm) {
      return NextResponse.json({ error: 'Debe confirmar la contraseña.' }, { status: 400 });
    }

    if (rawPassword !== rawConfirm) {
      return NextResponse.json({ error: 'Las contraseñas no coinciden.' }, { status: 400 });
    }

    const passwordPolicy = validatePasswordPolicy(rawPassword);
    if (!passwordPolicy.isValid) {
      return NextResponse.json({ error: passwordPolicy.message }, { status: 400 });
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

    // Hash password securely via scrypt (never plain text)
    const passwordHash = hashPassword(rawPassword);

    const mainType = body.primary_access_type || 'EMAIL';
    const mainIdent = mainType === 'EMAIL' ? email : (docNumber || email);
    const forceChange = body.must_change_password !== false && body.forzar_cambio_clave !== false;
    const scopeType = body.scope_type || 'COMPANY';

    // ATOMIC TRANSACTION: User, Identity, Security, Additional Roles, and Scope
    const nextUserId = await withTransaction(async (client) => {
      // 1. Calculate next usuario_id atomically
      const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
      const createdUserId = parseNum(maxUserRes.rows[0]?.next_id) || 1;

      // 2. Insert into admin.usuario
      await client.query(
        `INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [createdUserId, companyId, userTypeId, rolId, 'ACTIVO', 'Activo']
      );

      // 3. Insert into admin.usuario_identidad
      await client.query(
        `INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono, numero_documento, departamento_id, area_id, cargo_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [createdUserId, firstName, lastName, email, phone || null, docNumber || null, deptId || null, areaId || null, cargoId || null]
      );

      // 4. Insert into admin.usuario_seguridad
      const maxSegRes = await client.query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
      const nextSegId = parseNum(maxSegRes.rows[0]?.next_id) || 1;

      await client.query(
        `INSERT INTO admin.usuario_seguridad
         (usuario_seguridad_id, usuario_id, password, metodo_acceso_principal, identificador_principal, mfa_activo, mfa_tipo, restriccion_ip, restriccion_horaria, requiere_cambio_clave, forzar_cambio_clave, fecha_credenciales_generada, fecha_expiracion_invitacion, intentos_fallidos, detalle_estado, correo_acceso, enviar_invitacion_correo, generar_clave_automatica, idioma_preferido, zona_horaria, formato_fecha, inactividad_minutos, intentos_fallidos_permitidos, exigir_aprobacion_exportacion, exigir_doble_validacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, NOW(), NULL, 0, 'Contraseña asignada por administrador', $11, false, false, $12, $13, $14, $15, $16, $17, $18)`,
        [
          nextSegId,
          createdUserId,
          passwordHash,
          mainType,
          mainIdent,
          Boolean(body.mfaEnabled || body.mfa_activo),
          body.mfa_method || 'MFA no configurado',
          body.allowed_ips || '*',
          body.allowed_hours || 'Cualquier horario',
          forceChange,
          body.correo_acceso || email,
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
            await client.query(
              `INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, $2)`,
              [createdUserId, addRolId]
            );
          }
        }
      }

      // 6. Scope (admin.usuario_alcance)
      const scopeMax = await client.query(`SELECT COALESCE(MAX(usuario_alcance_id), 0) + 1 AS next_id FROM admin.usuario_alcance`);
      const nextScopeId = parseNum(scopeMax.rows[0]?.next_id) || 1;
      await client.query(
        `INSERT INTO admin.usuario_alcance
         (usuario_alcance_id, usuario_id, tipo_alcance, incluir_hijos, permite_ver, permite_editar, permite_exportar, permite_asignar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          nextScopeId,
          createdUserId,
          scopeType,
          body.include_children !== false,
          body.can_view !== false,
          Boolean(body.can_edit),
          Boolean(body.can_export),
          Boolean(body.can_assign)
        ]
      );

      return createdUserId;
    });

    // Register audit log and user activity (without plain text passwords)
    try {
      const masked = maskEmail(email);
      await recordUserAudit({
        userId: nextUserId,
        adminId: authAdminId || null,
        accion: 'CREATE_USER',
        valorAnterior: 'Sin registro previo',
        valorNuevo: `Email: ${masked} | Empresa: ${companyId} | Rol: ${rolId}`,
        motivo: 'Creación de nuevo usuario por administrador',
        resultado: 'COMPLETADO',
        req
      });

      await recordUserActivity({
        userId: nextUserId,
        modulo: 'Seguridad',
        evento: 'CREAR_USUARIO',
        descripcion: `Creación de cuenta para ${firstName} ${lastName}`,
        resultado: 'Exitoso',
        req
      });
    } catch (e) {
      console.warn("Could not insert audit/activity log:", e);
    }

    return NextResponse.json({
      success: true,
      usuario_id: nextUserId,
      message: 'Usuario creado correctamente.'
    });
  } catch (error: any) {
    console.error("Error in POST /api/usuarios:", error);
    return NextResponse.json({ error: error.message || 'Error al crear el usuario en la base de datos.' }, { status: 500 });
  }
}

