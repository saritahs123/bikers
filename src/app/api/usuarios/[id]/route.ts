import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cleanId = String(id).replace(/\D/g, "");
    const userId = parseInt(cleanId || id, 10);
    
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const sql = `
      SELECT 
        u.usuario_id AS id,
        u.estado,
        u.estado_activacion,
        u.fecha_creacion,
        u.empresa_id AS "companyId",
        emp.nombre AS empresa_nombre,
        ui.nombre AS first_name,
        ui.apellido AS last_name,
        COALESCE(NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''), 'Usuario') AS full_name,
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
        us.identificador_principal AS login_identifiers,
        us.fecha_ultimo_acceso AS last_login_at,
        us.mfa_activo AS "mfaEnabled",
        us.mfa_tipo AS mfa_method,
        us.detalle_estado AS activation,
        uca.correo_acceso,
        uca.enviar_invitacion_correo,
        uca.generar_clave_automatica,
        uca.forzar_cambio_clave,
        uca.idioma_preferido,
        uca.zona_horaria,
        uca.formato_fecha,
        us.intentos_fallidos,
        us.bloqueado_hasta,
        us.estado_verificacion_correo,
        us.canales_permitidos,
        us.restriccion_ip,
        us.horario_acceso,
        us.expiracion_acceso,
        us.fecha_activacion,
        us.fecha_ultima_invitacion,
        us.expiracion_clave_temp
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
    
    const usersRes = await query(sql, [userId]);
    
    if (!usersRes || usersRes.length === 0) {
       return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const u = usersRes[0];

    const mappedUser = {
      id: u.id,
      full_name: u.full_name || 'Desconocido',
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      document_number: u.document_number,
      companyId: u.companyId,
      empresa_nombre: u.empresa_nombre,
      department_id: u.departamento_id,
      departamento_nombre: u.departamento_nombre,
      area_id: u.area_id,
      area_nombre: u.area_nombre,
      cargo_id: u.cargo_id,
      cargo_nombre: u.cargo_nombre,
      role: u.role || 'Sin rol asignado',
      user_type: u.user_type || 'Sin tipo',
      primary_access_type: u.primary_access_type || 'Correo electrónico',
      login_identifiers: u.login_identifiers ? [{ is_primary: true, identifier_value: u.login_identifiers }] : [],
      last_login_at: u.last_login_at,
      mfaEnabled: !!u.mfaEnabled,
      mfa_method: u.mfa_method || 'MFA no configurado',
      status: u.estado || 'INACTIVO', 
      estado: u.estado || 'INACTIVO', 
      estado_activacion: u.estado_activacion || 'PENDIENTE',
      activation: u.activation || 'Sin datos de activación',
      fecha_creacion: u.fecha_creacion,
      correo_acceso: u.correo_acceso || null,
      enviar_invitacion_correo: Boolean(u.enviar_invitacion_correo),
      generar_clave_automatica: Boolean(u.generar_clave_automatica),
      forzar_cambio_clave: Boolean(u.forzar_cambio_clave),
      idioma_preferido: u.idioma_preferido || 'es',
      zona_horaria: u.zona_horaria || 'America/Santo_Domingo',
      formato_fecha: u.formato_fecha || 'DD/MM/YYYY',
      intentos_fallidos: Number(u.intentos_fallidos || 0),
      bloqueado_hasta: u.bloqueado_hasta || null,
      estado_verificacion_correo: u.estado_verificacion_correo || 'No verificado',
      canales_permitidos: u.canales_permitidos || 'Web / Móvil',
      restriccion_ip: u.restriccion_ip || 'Sin restricción',
      horario_acceso: u.horario_acceso || 'Sin restricción horaria',
      expiracion_acceso: u.expiracion_acceso || 'Sin expiración',
      fecha_activacion: u.fecha_activacion || null,
      fecha_ultima_invitacion: u.fecha_ultima_invitacion || null,
      expiracion_clave_temp: u.expiracion_clave_temp || null,
      permissionsOverride: false,
      scope_type: 'GLOBAL'
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
    const cleanId = String(id).replace(/\D/g, "");
    const userId = parseInt(cleanId || id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();

    let firstName = (body.first_name || '').trim();
    let lastName = (body.last_name || '').trim();

    if ((!firstName || !lastName) && body.full_name) {
      const parts = body.full_name.trim().split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }

    const email = (body.email || body.correo_electronico || '').trim();
    const phone = (body.phone || body.telefono || '').trim();
    const docNumber = (body.document_number || body.numero_documento || '').trim();

    const parseNum = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const parsed = parseInt(String(val), 10);
      return isNaN(parsed) ? null : parsed;
    };

    const deptId = parseNum(body.department_id || body.departamento_id);
    const areaId = parseNum(body.area_id);
    const cargoId = parseNum(body.cargo_id);
    const companyId = parseNum(body.companyId || body.empresa_id);
    const userTypeId = parseNum(body.tipo_usuario_id);

    // Resolve rol_id if only role name was provided
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

    // 1. UPDATE or INSERT into admin.usuario_identidad
    try {
      const checkIdent = await query(`SELECT 1 FROM admin.usuario_identidad WHERE usuario_id = $1`, [userId]);
      if (checkIdent && checkIdent.length > 0) {
        await query(
          `UPDATE admin.usuario_identidad 
           SET nombre = $1,
               apellido = $2,
               correo_electronico = COALESCE(NULLIF($3, ''), correo_electronico),
               telefono = COALESCE(NULLIF($4, ''), telefono),
               numero_documento = COALESCE(NULLIF($5, ''), numero_documento),
               departamento_id = COALESCE($6, departamento_id),
               area_id = COALESCE($7, area_id),
               cargo_id = COALESCE($8, cargo_id)
           WHERE usuario_id = $9`,
          [firstName, lastName, email, phone, docNumber, deptId, areaId, cargoId, userId]
        );
      } else {
        await query(
          `INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono, numero_documento, departamento_id, area_id, cargo_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userId, firstName, lastName, email, phone, docNumber, deptId, areaId, cargoId]
        );
      }
    } catch (e) {
      console.error("Error saving usuario_identidad:", e);
    }

    // 2. UPDATE or INSERT into admin.usuario_seguridad
    try {
      const mainIdent = email || docNumber;
      const mainType = body.primary_access_type || (email ? 'EMAIL' : 'DOCUMENT');
      const mfaActivo = Boolean(body.mfaEnabled);
      const mfaTipo = body.mfa_method || 'MFA no configurado';
      const restriccionIp = body.allowed_ips || body.restriccion_ip || 'Sin restricción';
      const horarioAcceso = body.allowed_hours || body.horario_acceso || 'Sin restricción horaria';

      const correoAcceso = body.correo_acceso !== undefined && body.correo_acceso !== null 
        ? String(body.correo_acceso).trim() 
        : (body.access_email ? String(body.access_email).trim() : email);
      const enviarInvitacion = Boolean(body.enviar_invitacion_correo);
      const generarClave = Boolean(body.generar_clave_automatica);
      const forzarCambio = Boolean(body.forzar_cambio_clave);
      const idioma = body.idioma_preferido || 'Español (América Latina)';
      const zonaHoraria = body.zona_horaria || 'America/Santo_Domingo (GMT-4)';
      const formatoFecha = body.formato_fecha || 'DD/MM/YYYY';

      const checkSeg = await query(`SELECT 1 FROM admin.usuario_seguridad WHERE usuario_id = $1`, [userId]);
      if (checkSeg && checkSeg.length > 0) {
        await query(
          `UPDATE admin.usuario_seguridad
           SET metodo_acceso_principal = $1,
               identificador_principal = $2,
               mfa_activo = $3,
               mfa_tipo = $4,
               restriccion_ip = $5,
               restriccion_horaria = $6,
               correo_acceso = $7,
               enviar_invitacion_correo = $8,
               generar_clave_automatica = $9,
               forzar_cambio_clave = $10,
               idioma_preferido = $11,
               zona_horaria = $12,
               formato_fecha = $13
           WHERE usuario_id = $14`,
          [mainType, mainIdent, mfaActivo, mfaTipo, restriccionIp, horarioAcceso, correoAcceso, enviarInvitacion, generarClave, forzarCambio, idioma, zonaHoraria, formatoFecha, userId]
        );
      } else {
        const maxSegRes = await query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
        const nextSegId = parseNum(maxSegRes[0]?.next_id) || 1;

        await query(
          `INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, mfa_activo, mfa_tipo, restriccion_ip, restriccion_horaria, correo_acceso, enviar_invitacion_correo, generar_clave_automatica, forzar_cambio_clave, idioma_preferido, zona_horaria, formato_fecha)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [nextSegId, userId, mainType, mainIdent, mfaActivo, mfaTipo, restriccionIp, horarioAcceso, correoAcceso, enviarInvitacion, generarClave, forzarCambio, idioma, zonaHoraria, formatoFecha]
        );
      }
    } catch (e) {
      console.warn("Could not save usuario_seguridad:", e);
    }

    // 4. UPDATE admin.usuario
    try {
      await query(
        `UPDATE admin.usuario 
         SET empresa_id = COALESCE($1, empresa_id),
             rol_principal_id = COALESCE($2, rol_principal_id),
             tipo_usuario_id = COALESCE($3, tipo_usuario_id),
             estado = COALESCE(NULLIF($4, ''), estado)
         WHERE usuario_id = $5`,
        [
          companyId,
          rolId,
          userTypeId,
          body.status || body.estado || null,
          userId
        ]
      );
    } catch (e) {
      console.error("Error updating usuario table:", e);
    }

    return NextResponse.json({ success: true, message: "Usuario actualizado correctamente" });
  } catch (error: any) {
    console.error("Error in PUT /api/usuarios/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido." }, { status: 400 });
    }

    // Clean up dependent child records to ensure cascade deletion without FK errors
    await query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM admin.usuario_sesion WHERE usuario_id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM admin.usuario_actividad WHERE usuario_id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM admin.usuario_auditoria WHERE usuario_id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM admin.usuario_seguridad WHERE usuario_id = $1`, [userId]).catch(() => {});
    await query(`DELETE FROM admin.usuario_identidad WHERE usuario_id = $1`, [userId]).catch(() => {});

    // Delete main user record
    await query(`DELETE FROM admin.usuario WHERE usuario_id = $1`, [userId]);

    return NextResponse.json({ success: true, message: "Usuario eliminado correctamente" });
  } catch (error: any) {
    console.error("Error in DELETE /api/usuarios/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
