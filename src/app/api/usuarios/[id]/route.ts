import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorizeUserAccess, authorizeUserUpdate } from "@/lib/userAuth";
import { getModulePermissions } from "@/lib/workshop-session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const requestedUserId = authResult.targetUserId;

    // Query PostgreSQL user detail using exact real database columns
    const sql = `
      SELECT 
        u.usuario_id AS id,
        u.estado,
        u.estado_activacion,
        u.fecha_creacion,
        u.empresa_id AS "companyId",
        emp.nombre_comercial AS empresa_nombre,
        ui.nombre AS first_name,
        ui.apellido AS last_name,
        ui.correo_electronico AS email,
        ui.telefono AS phone,
        ui.numero_documento AS document_number,
        ui.departamento_id,
        dep.nombre AS departamento_nombre,
        ui.area_id,
        ar.nombre AS area_nombre,
        ui.cargo_id,
        cg.nombre AS cargo_nombre,
        r.nombre AS role,
        tu.nombre AS user_type,
        us.metodo_acceso_principal AS primary_access_type,
        us.identificador_principal,
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
        us.formato_fecha,
        us.intentos_fallidos,
        us.bloqueado_hasta,
        us.estado_verificacion_correo,
        us.canales_permitidos,
        us.restriccion_ip,
        us.restriccion_horaria AS horario_acceso,
        us.expiracion_acceso,
        us.fecha_credenciales_generada AS fecha_activacion,
        us.fecha_expiracion_invitacion AS fecha_ultima_invitacion
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
      LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      LEFT JOIN admin.empresa emp ON u.empresa_id = emp.empresa_id
      LEFT JOIN admin.departamento dep ON ui.departamento_id = dep.departamento_id
      LEFT JOIN admin.area ar ON ui.area_id = ar.area_id
      LEFT JOIN admin.cargo cg ON ui.cargo_id = cg.cargo_id
      WHERE u.usuario_id = $1
    `;
    
    const usersRes = await query(sql, [requestedUserId]);
    
    if (!usersRes || usersRes.length === 0) {
       return NextResponse.json({ error: "NOT_FOUND", message: "Usuario no encontrado." }, { status: 404 });
    }

    const u = usersRes[0];
    const primaryAccessValue = u.identificador_principal || u.correo_acceso || u.email || u.document_number || (u.id ? `ID #${u.id}` : '—');
    const fullNameComputed = (u.first_name || u.last_name)
      ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
      : (u.email || u.identificador_principal || (u.id ? `Usuario #${u.id}` : 'Usuario'));

    const scopeRes = await query(`SELECT usuario_alcance_id, nivel_alcance, incluir_herencia_jerarquica FROM admin.usuario_alcance WHERE usuario_id = $1`, [requestedUserId]);
    let scopeType = 'COMPANY';
    let includeChildren = true;
    let scopeEntityIds: number[] = [];

    if (scopeRes && scopeRes.length > 0) {
      const dbNivel = scopeRes[0].nivel_alcance;
      if (dbNivel === 'POR_AGRUPACION' || dbNivel === 'POR_DEPARTAMENTO' || dbNivel === 'DEPARTMENT') scopeType = 'DEPARTMENT';
      else if (dbNivel === 'POR_TERRITORIO' || dbNivel === 'POR_AREA' || dbNivel === 'AREA') scopeType = 'AREA';
      else if (dbNivel === 'POR_AGENCIA' || dbNivel === 'POR_SUCURSAL' || dbNivel === 'BRANCH' || dbNivel === 'SUCURSAL') scopeType = 'BRANCH';
      else scopeType = 'COMPANY';

      includeChildren = scopeRes[0].incluir_herencia_jerarquica ?? true;
      const scopeDetailRes = await query(`SELECT referencia_id FROM admin.usuario_alcance_detalle WHERE usuario_alcance_id = $1`, [scopeRes[0].usuario_alcance_id]);
      scopeEntityIds = (scopeDetailRes || []).map((r: any) => Number(r.referencia_id));
    }

    const mappedUser = {
      id: u.id,
      full_name: fullNameComputed,
      first_name: u.first_name ?? null,
      last_name: u.last_name ?? null,
      email: u.email ?? null,
      phone: u.phone ?? null,
      document_number: u.document_number ?? null,
      companyId: u.companyId ?? null,
      empresa_nombre: u.empresa_nombre ?? null,
      department_id: u.departamento_id ?? null,
      departamento_nombre: u.departamento_nombre ?? null,
      area_id: u.area_id ?? null,
      area_nombre: u.area_nombre ?? null,
      cargo_id: u.cargo_id ?? null,
      cargo_nombre: u.cargo_nombre ?? null,
      role: u.role ?? null,
      user_type: u.user_type ?? null,
      primary_access_type: u.primary_access_type ?? 'EMAIL',
      identificador_principal: primaryAccessValue,
      login_identifiers: [
        {
          is_primary: true,
          identifier_type: u.primary_access_type || (primaryAccessValue.includes('@') ? 'EMAIL' : 'DOCUMENT'),
          identifier_value: primaryAccessValue
        }
      ],
      last_login_at: u.last_login_at ?? null,
      mfaEnabled: Boolean(u.mfaEnabled),
      mfa_method: u.mfa_method ?? null,
      status: u.estado ?? null, 
      estado: u.estado ?? null, 
      estado_activacion: u.estado_activacion ?? null,
      activation: u.activation ?? null,
      fecha_creacion: u.fecha_creacion ?? null,
      correo_acceso: u.correo_acceso ?? null,
      enviar_invitacion_correo: Boolean(u.enviar_invitacion_correo),
      generar_clave_automatica: Boolean(u.generar_clave_automatica),
      forzar_cambio_clave: Boolean(u.forzar_cambio_clave),
      idioma_preferido: u.idioma_preferido ?? 'es',
      zona_horaria: u.zona_horaria ?? 'America/Santo_Domingo',
      formato_fecha: u.formato_fecha ?? 'DD/MM/YYYY',
      intentos_fallidos: Number(u.intentos_fallidos ?? 0),
      bloqueado_hasta: u.bloqueado_hasta ?? null,
      estado_verificacion_correo: u.estado_verificacion_correo ?? null,
      canales_permitidos: u.canales_permitidos ?? null,
      restriccion_ip: u.restriccion_ip ?? null,
      horario_acceso: u.horario_acceso ?? null,
      expiracion_acceso: u.expiracion_acceso ?? null,
      fecha_activacion: u.fecha_activacion ?? null,
      fecha_ultima_invitacion: u.fecha_ultima_invitacion ?? null,
      permissionsOverride: false,
      scope_type: scopeType,
      include_children: includeChildren,
      scope_entity_ids: scopeEntityIds
    };

    return NextResponse.json(mappedUser);
  } catch (error: any) {
    console.error("Error in GET /api/usuarios/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const { authUserId, targetUserId, isSelf, authUserCompanyId } = authResult;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Payload no proporcionado o JSON inválido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Payload inválido." },
        { status: 400 }
      );
    }

    // 1. Fetch current user data
    const currentRows = await query(
      `SELECT
         u.usuario_id,
         u.empresa_id,
         u.rol_principal_id,
         u.tipo_usuario_id,
         u.estado,
         u.estado_activacion,
         ui.nombre,
         ui.apellido,
         ui.telefono,
         ui.numero_documento,
         ui.departamento_id,
         ui.area_id,
         ui.cargo_id,
         us.idioma_preferido,
         us.zona_horaria,
         us.formato_fecha
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
       LEFT JOIN admin.usuario_seguridad us ON us.usuario_id = u.usuario_id
       WHERE u.usuario_id = $1
       LIMIT 1`,
      [targetUserId]
    );

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    const current = currentRows[0];

    // Check if caller has administrative edit permissions on module SEGURIDAD
    const segPerms = await getModulePermissions("SEGURIDAD", authUserId);
    const hasAdminEditPerm = segPerms.puede_editar;

    // Self Profile Guard: Only block admin changes if caller does NOT have SEGURIDAD edit permissions
    if (isSelf && !hasAdminEditPerm) {
      const isParamChanged = (newVal: any, oldVal: any) =>
        newVal !== undefined && newVal !== null && String(newVal).trim() !== String(oldVal ?? '').trim();

      const triedCompany = body.companyId !== undefined ? body.companyId : body.empresa_id;
      const triedRole = body.roleId !== undefined ? body.roleId : (body.rol_id !== undefined ? body.rol_id : (body.rol_principal_id !== undefined ? body.rol_principal_id : body.role));
      const triedStatus = body.status !== undefined ? body.status : body.estado;
      const triedUserType = body.user_type_id !== undefined ? body.user_type_id : body.tipo_usuario_id;
      const triedEstadoActivacion = body.estado_activacion !== undefined ? body.estado_activacion : body.activation;

      if (
        isParamChanged(triedCompany, current.empresa_id) ||
        (triedRole !== undefined && triedRole !== null && String(triedRole).trim() !== String(current.rol_principal_id ?? '').trim()) ||
        isParamChanged(triedStatus, current.estado) ||
        isParamChanged(triedUserType, current.tipo_usuario_id) ||
        isParamChanged(triedEstadoActivacion, current.estado_activacion) ||
        body.password !== undefined ||
        body.confirm_password !== undefined
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN",
            message: "No posee permisos para modificar campos administrativos del perfil (rol, empresa, estado, etc.)."
          },
          { status: 403 }
        );
      }
    }

    // 2. Resolve field values with current fallbacks
    const updatedFirstName =
      body.first_name !== undefined ? body.first_name : (body.nombre !== undefined ? body.nombre : current.nombre);

    const updatedLastName =
      body.last_name !== undefined ? body.last_name : (body.apellido !== undefined ? body.apellido : current.apellido);

    const updatedPhone =
      body.phone !== undefined ? body.phone : (body.telefono !== undefined ? body.telefono : current.telefono);

    const updatedDocument =
      body.document_number !== undefined ? body.document_number : (body.numero_documento !== undefined ? body.numero_documento : current.numero_documento);

    const updatedDeptId =
      body.department_id !== undefined ? body.department_id : (body.departamento_id !== undefined ? body.departamento_id : current.departamento_id);

    const updatedAreaId =
      body.area_id !== undefined ? body.area_id : current.area_id;

    const updatedCargoId =
      body.cargo_id !== undefined ? body.cargo_id : current.cargo_id;

    const updatedIdioma =
      body.idioma_preferido !== undefined ? body.idioma_preferido : (current.idioma_preferido || 'es');

    const updatedZona =
      body.zona_horaria !== undefined ? body.zona_horaria : (current.zona_horaria || 'America/Santo_Domingo');

    const updatedFormato =
      body.formato_fecha !== undefined ? body.formato_fecha : (current.formato_fecha || 'DD/MM/YYYY');

    // Duplicate document check (HTTP 409)
    const normalizedDoc = updatedDocument !== null && updatedDocument !== undefined ? String(updatedDocument).trim() : '';
    if (normalizedDoc.length > 0) {
      const dupRes = await query(
        `SELECT usuario_id FROM admin.usuario_identidad WHERE numero_documento = $1 AND usuario_id != $2 LIMIT 1`,
        [normalizedDoc, targetUserId]
      );
      if (dupRes && dupRes.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "CONFLICT",
            message: "El número de documento ya está registrado por otro usuario.",
            field: "document_number"
          },
          { status: 409 }
        );
      }
    }

    // Resolve administrative fields
    let newCompanyId: number | null = null;
    const rawComp = body.companyId ?? body.empresa_id;
    if (rawComp !== undefined && rawComp !== null && rawComp !== '') {
      if (typeof rawComp === 'number' || /^\d+$/.test(String(rawComp))) {
        newCompanyId = Number(rawComp);
      } else {
        const cRes = await query(`SELECT empresa_id FROM admin.empresa WHERE UPPER(nombre_comercial) = UPPER($1) OR UPPER(razon_social) = UPPER($1) LIMIT 1`, [String(rawComp).trim()]);
        if (cRes && cRes.length > 0) newCompanyId = cRes[0].empresa_id;
      }
    }
    if (newCompanyId === null && body.empresa_nombre && typeof body.empresa_nombre === 'string') {
      const cRes = await query(`SELECT empresa_id FROM admin.empresa WHERE UPPER(nombre_comercial) = UPPER($1) OR UPPER(razon_social) = UPPER($1) LIMIT 1`, [body.empresa_nombre.trim()]);
      if (cRes && cRes.length > 0) newCompanyId = cRes[0].empresa_id;
    }
    if (newCompanyId === null) newCompanyId = current.empresa_id;

    let newRolId: number | null = null;
    const rawRol = body.roleId ?? body.rol_id ?? body.rol_principal_id;
    if (rawRol !== undefined && rawRol !== null && rawRol !== '') {
      if (typeof rawRol === 'number' || /^\d+$/.test(String(rawRol))) {
        newRolId = Number(rawRol);
      } else {
        const rRes = await query(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE UPPER(nombre) = UPPER($1) LIMIT 1`, [String(rawRol).trim()]);
        if (rRes && rRes.length > 0) newRolId = rRes[0].rol_funcional_id;
      }
    }
    if (newRolId === null && body.role && typeof body.role === 'string') {
      const rRes = await query(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE UPPER(nombre) = UPPER($1) LIMIT 1`, [body.role.trim()]);
      if (rRes && rRes.length > 0) newRolId = rRes[0].rol_funcional_id;
    }
    if (newRolId === null) newRolId = current.rol_principal_id;

    let newTipoUsuarioId: number | null = null;
    const rawTu = body.user_type_id ?? body.tipo_usuario_id;
    if (rawTu !== undefined && rawTu !== null && rawTu !== '') {
      if (typeof rawTu === 'number' || /^\d+$/.test(String(rawTu))) {
        newTipoUsuarioId = Number(rawTu);
      } else {
        const tuRes = await query(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE UPPER(nombre) = UPPER($1) LIMIT 1`, [String(rawTu).trim()]);
        if (tuRes && tuRes.length > 0) newTipoUsuarioId = tuRes[0].tipo_usuario_id;
      }
    }
    if (newTipoUsuarioId === null && body.user_type && typeof body.user_type === 'string') {
      const tuRes = await query(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE UPPER(nombre) = UPPER($1) LIMIT 1`, [body.user_type.trim()]);
      if (tuRes && tuRes.length > 0) newTipoUsuarioId = tuRes[0].tipo_usuario_id;
    }
    if (newTipoUsuarioId === null) newTipoUsuarioId = current.tipo_usuario_id;

    const newEstado = body.status ?? body.estado ?? current.estado;
    const newEstadoActivacion = body.estado_activacion ?? body.activation ?? current.estado_activacion;

    if (authUserCompanyId && newCompanyId && Number(newCompanyId) !== Number(authUserCompanyId)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN",
          message: "No posee permisos para asignar el usuario a otra empresa."
        },
        { status: 403 }
      );
    }

    // Update admin.usuario
    await query(
      `UPDATE admin.usuario
       SET empresa_id = $1,
           rol_principal_id = $2,
           tipo_usuario_id = $3,
           estado = $4,
           estado_activacion = $5,
           fecha_actualizacion = NOW()
       WHERE usuario_id = $6`,
      [
        newCompanyId ? Number(newCompanyId) : null,
        newRolId ? Number(newRolId) : null,
        newTipoUsuarioId ? Number(newTipoUsuarioId) : null,
        newEstado ? String(newEstado) : null,
        newEstadoActivacion ? String(newEstadoActivacion) : null,
        targetUserId
      ]
    );

    // Update admin.usuario_identidad
    const finalFirstName = updatedFirstName !== null && updatedFirstName !== undefined ? String(updatedFirstName).trim() : null;
    const finalLastName = updatedLastName !== null && updatedLastName !== undefined ? String(updatedLastName).trim() : null;
    const finalPhone = updatedPhone !== null && updatedPhone !== undefined ? String(updatedPhone).trim() : null;
    const finalDoc = normalizedDoc.length > 0 ? normalizedDoc : null;
    const finalDeptId = updatedDeptId ? Number(updatedDeptId) : null;
    const finalAreaId = updatedAreaId ? Number(updatedAreaId) : null;
    const finalCargoId = updatedCargoId ? Number(updatedCargoId) : null;

    const identExists = await query(`SELECT 1 FROM admin.usuario_identidad WHERE usuario_id = $1`, [targetUserId]);
    if (identExists && identExists.length > 0) {
      await query(
        `UPDATE admin.usuario_identidad
         SET nombre = $1,
             apellido = $2,
             telefono = $3,
             numero_documento = $4,
             departamento_id = $5,
             area_id = $6,
             cargo_id = $7,
             fecha_actualizacion = NOW()
         WHERE usuario_id = $8`,
        [finalFirstName, finalLastName, finalPhone, finalDoc, finalDeptId, finalAreaId, finalCargoId, targetUserId]
      );
    } else {
      await query(
        `INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, telefono, numero_documento, departamento_id, area_id, cargo_id, fecha_actualizacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [targetUserId, finalFirstName, finalLastName, finalPhone, finalDoc, finalDeptId, finalAreaId, finalCargoId]
      );
    }

    // Update admin.usuario_seguridad
    const segExists = await query(`SELECT 1 FROM admin.usuario_seguridad WHERE usuario_id = $1`, [targetUserId]);
    if (segExists && segExists.length > 0) {
      await query(
        `UPDATE admin.usuario_seguridad
         SET idioma_preferido = COALESCE($1, idioma_preferido),
             zona_horaria = COALESCE($2, zona_horaria),
             formato_fecha = COALESCE($3, formato_fecha)
         WHERE usuario_id = $4`,
        [String(updatedIdioma), String(updatedZona), String(updatedFormato), targetUserId]
      );
    } else {
      await query(
        `INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, idioma_preferido, zona_horaria, formato_fecha)
         SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1, $1, $2, $3, $4 FROM admin.usuario_seguridad`,
        [targetUserId, String(updatedIdioma), String(updatedZona), String(updatedFormato)]
      );
    }

    // 5. Update admin.usuario_alcance and admin.usuario_alcance_detalle if scope fields are provided
    if (body.scope_type !== undefined || body.nivel_alcance !== undefined || body.scope_entity_ids !== undefined) {
      const rawScope = body.scope_type || body.nivel_alcance || 'COMPANY';
      let dbNivel = 'TODA_EMPRESA';
      if (rawScope === 'POR_AGRUPACION' || rawScope === 'DEPARTMENT' || rawScope === 'POR_DEPARTAMENTO') dbNivel = 'POR_AGRUPACION';
      else if (rawScope === 'POR_TERRITORIO' || rawScope === 'AREA' || rawScope === 'POR_AREA') dbNivel = 'POR_TERRITORIO';
      else if (rawScope === 'POR_AGENCIA' || rawScope === 'BRANCH' || rawScope === 'POR_SUCURSAL' || rawScope === 'SUCURSAL') dbNivel = 'POR_AGENCIA';
      else dbNivel = 'TODA_EMPRESA';

      const includeChildren = body.include_children !== undefined ? Boolean(body.include_children) : true;
      const entityIds = Array.isArray(body.scope_entity_ids) ? body.scope_entity_ids.map(Number).filter((n: number) => !isNaN(n)) : [];

      const currentScope = await query(`SELECT usuario_alcance_id FROM admin.usuario_alcance WHERE usuario_id = $1`, [targetUserId]);
      let scopeId: number;

      if (currentScope && currentScope.length > 0) {
        scopeId = currentScope[0].usuario_alcance_id;
        await query(
          `UPDATE admin.usuario_alcance
           SET nivel_alcance = $1, incluir_herencia_jerarquica = $2
           WHERE usuario_alcance_id = $3`,
          [dbNivel, includeChildren, scopeId]
        );
      } else {
        const nextScopeRes = await query(`SELECT COALESCE(MAX(usuario_alcance_id), 0) + 1 AS next_id FROM admin.usuario_alcance`);
        scopeId = Number(nextScopeRes[0].next_id);
        await query(
          `INSERT INTO admin.usuario_alcance (usuario_alcance_id, usuario_id, nivel_alcance, incluir_herencia_jerarquica)
           VALUES ($1, $2, $3, $4)`,
          [scopeId, targetUserId, dbNivel, includeChildren]
        );
      }

      await query(`DELETE FROM admin.usuario_alcance_detalle WHERE usuario_alcance_id = $1`, [scopeId]);

      if (dbNivel !== 'TODA_EMPRESA' && entityIds.length > 0) {
        let detalleTipo = 'AGRUPACION';
        if (dbNivel === 'POR_TERRITORIO') detalleTipo = 'TERRITORIO';
        if (dbNivel === 'POR_AGENCIA') detalleTipo = 'AGENCIA';

        for (const refId of entityIds) {
          await query(
            `INSERT INTO admin.usuario_alcance_detalle (usuario_alcance_detalle_id, usuario_alcance_id, alcance, referencia_id)
             VALUES ((SELECT COALESCE(MAX(usuario_alcance_detalle_id), 0) + 1 FROM admin.usuario_alcance_detalle), $1, $2, $3)`,
            [scopeId, detalleTipo, refId]
          );
        }
      }
    }

    // Re-query updated real data and construct usuarioActualizado
    const fetchUpdatedSql = `
      SELECT 
        u.usuario_id AS id,
        u.estado,
        u.estado_activacion,
        u.fecha_creacion,
        u.empresa_id AS "companyId",
        emp.nombre_comercial AS empresa_nombre,
        ui.nombre AS first_name,
        ui.apellido AS last_name,
        ui.correo_electronico AS email,
        ui.telefono AS phone,
        ui.numero_documento AS document_number,
        ui.departamento_id,
        dep.nombre AS departamento_nombre,
        ui.area_id,
        ar.nombre AS area_nombre,
        ui.cargo_id,
        cg.nombre AS cargo_nombre,
        r.nombre AS role,
        tu.nombre AS user_type,
        us.metodo_acceso_principal AS primary_access_type,
        us.identificador_principal,
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
        us.formato_fecha,
        us.intentos_fallidos,
        us.bloqueado_hasta,
        us.estado_verificacion_correo,
        us.canales_permitidos,
        us.restriccion_ip,
        us.restriccion_horaria AS horario_acceso,
        us.expiracion_acceso,
        us.fecha_credenciales_generada AS fecha_activacion,
        us.fecha_expiracion_invitacion AS fecha_ultima_invitacion
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
      LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      LEFT JOIN admin.empresa emp ON u.empresa_id = emp.empresa_id
      LEFT JOIN admin.departamento dep ON ui.departamento_id = dep.departamento_id
      LEFT JOIN admin.area ar ON ui.area_id = ar.area_id
      LEFT JOIN admin.cargo cg ON ui.cargo_id = cg.cargo_id
      WHERE u.usuario_id = $1
    `;
    const updatedUsersRes = await query(fetchUpdatedSql, [targetUserId]);
    const updatedRow = updatedUsersRes && updatedUsersRes.length > 0 ? updatedUsersRes[0] : null;

    const usuarioActualizado = updatedRow ? {
      id: updatedRow.id,
      full_name: `${updatedRow.first_name || ''} ${updatedRow.last_name || ''}`.trim() || null,
      first_name: updatedRow.first_name ?? null,
      last_name: updatedRow.last_name ?? null,
      email: updatedRow.email ?? null,
      phone: updatedRow.phone ?? null,
      document_number: updatedRow.document_number ?? null,
      companyId: updatedRow.companyId ?? null,
      empresa_nombre: updatedRow.empresa_nombre ?? null,
      department_id: updatedRow.departamento_id ?? null,
      departamento_nombre: updatedRow.departamento_nombre ?? null,
      area_id: updatedRow.area_id ?? null,
      area_nombre: updatedRow.area_nombre ?? null,
      cargo_id: updatedRow.cargo_id ?? null,
      cargo_nombre: updatedRow.cargo_nombre ?? null,
      role: updatedRow.role ?? null,
      user_type: updatedRow.user_type ?? null,
      primary_access_type: updatedRow.primary_access_type ?? 'EMAIL',
      login_identifiers: updatedRow.identificador_principal
        ? [{ is_primary: true, identifier_value: updatedRow.identificador_principal }]
        : [],
      last_login_at: updatedRow.last_login_at ?? null,
      mfaEnabled: Boolean(updatedRow.mfaEnabled),
      mfa_method: updatedRow.mfa_method ?? null,
      status: updatedRow.estado ?? null,
      estado: updatedRow.estado ?? null,
      estado_activacion: updatedRow.estado_activacion ?? null,
      activation: updatedRow.activation ?? null,
      fecha_creacion: updatedRow.fecha_creacion ?? null,
      correo_acceso: updatedRow.correo_acceso ?? null,
      enviar_invitacion_correo: Boolean(updatedRow.enviar_invitacion_correo),
      generar_clave_automatica: Boolean(updatedRow.generar_clave_automatica),
      forzar_cambio_clave: Boolean(updatedRow.forzar_cambio_clave),
      idioma_preferido: updatedRow.idioma_preferido ?? 'es',
      zona_horaria: updatedRow.zona_horaria ?? 'America/Santo_Domingo',
      formato_fecha: updatedRow.formato_fecha ?? 'DD/MM/YYYY',
      intentos_fallidos: Number(updatedRow.intentos_fallidos ?? 0),
      bloqueado_hasta: updatedRow.bloqueado_hasta ?? null,
      estado_verificacion_correo: updatedRow.estado_verificacion_correo ?? null,
      canales_permitidos: updatedRow.canales_permitidos ?? null,
      restriccion_ip: updatedRow.restriccion_ip ?? null,
      horario_acceso: updatedRow.horario_acceso ?? null,
      expiracion_acceso: updatedRow.expiracion_acceso ?? null,
      fecha_activacion: updatedRow.fecha_activacion ?? null,
      fecha_ultima_invitacion: updatedRow.fecha_ultima_invitacion ?? null
    } : null;

    // Record real audit log in admin.usuario_auditoria
    try {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
      const userAgent = req.headers.get("user-agent") || "Navegador Web";
      let auditAction = 'UPDATE_USER';
      let auditMotivo = 'Actualización de datos del usuario';

      if (body.estado && body.estado !== current.estado) {
        auditAction = body.estado === 'ACTIVO' ? 'ACTIVATE_USER' : (body.estado === 'INACTIVO' ? 'DEACTIVATE_USER' : 'STATUS_CHANGE');
        auditMotivo = body.motivo_bloqueo || `Cambio de estado a ${body.estado}`;
      } else if (body.roleId || body.rol_id) {
        auditAction = 'ROLE_CHANGE';
        auditMotivo = 'Actualización de rol y permisos';
      }

      await query(`
        INSERT INTO admin.usuario_auditoria 
        (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
        VALUES ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $2, NOW(), $3, $4, $5, $6, 'COMPLETADO', $7, $8)
      `, [
        targetUserId,
        authUserId || 1,
        auditAction,
        `Estado: ${current.estado || '—'} | Rol: ${current.rol_principal_id || '—'}`,
        `Estado: ${updatedRow?.estado || '—'} | Rol: ${updatedRow?.role || '—'}`,
        auditMotivo,
        clientIp,
        userAgent
      ]);
    } catch (auditErr) {
      console.warn("Could not insert usuario_auditoria record:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Usuario actualizado correctamente.",
      data: usuarioActualizado
    });
  } catch (error: any) {
    console.error("Error in PUT /api/usuarios/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error interno al actualizar usuario." }, { status: 500 });
  }
}
