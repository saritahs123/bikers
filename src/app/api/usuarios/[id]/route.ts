import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    
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
        us.detalle_estado AS activation
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
      LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      WHERE u.usuario_id = $1
    `;
    
    // El query runner devuelve un arreglo; pasamos los params posicionalmente
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
    const userId = parseInt(id, 10);

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

    const email = body.email || body.correo_electronico || '';
    const phone = body.phone || body.telefono || '';
    const docNumber = body.document_number || body.numero_documento || '';
    const deptId = body.department_id || body.departamento_id || null;
    const areaId = body.area_id || null;
    const cargoId = body.cargo_id || null;

    // Resolve rol_id if only role name was provided
    let rolId = body.rol_id || body.role_id || body.rol_principal_id || null;
    if (!rolId && body.role) {
      try {
        const rRes = await query(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE LOWER(nombre) = LOWER($1) LIMIT 1`, [body.role]);
        if (rRes && rRes.length > 0) {
          rolId = rRes[0].rol_funcional_id;
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
    if (email || docNumber) {
      try {
        const mainIdent = email || docNumber;
        const mainType = body.primary_access_type || (email ? 'EMAIL' : 'DOCUMENT');
        const checkSeg = await query(`SELECT 1 FROM admin.usuario_seguridad WHERE usuario_id = $1`, [userId]);
        if (checkSeg && checkSeg.length > 0) {
          await query(
            `UPDATE admin.usuario_seguridad
             SET metodo_acceso_principal = $1,
                 identificador_principal = $2
             WHERE usuario_id = $3`,
            [mainType, mainIdent, userId]
          );
        } else {
          await query(
            `INSERT INTO admin.usuario_seguridad (usuario_id, metodo_acceso_principal, identificador_principal)
             VALUES ($1, $2, $3)`,
            [userId, mainType, mainIdent]
          );
        }
      } catch (e) {
        console.warn("Could not save usuario_seguridad:", e);
      }
    }

    // 3. UPDATE admin.usuario
    try {
      await query(
        `UPDATE admin.usuario 
         SET empresa_id = COALESCE($1, empresa_id),
             rol_principal_id = COALESCE($2, rol_principal_id),
             tipo_usuario_id = COALESCE($3, tipo_usuario_id),
             estado = COALESCE(NULLIF($4, ''), estado)
         WHERE usuario_id = $5`,
        [
          body.companyId || body.empresa_id || null,
          rolId,
          body.tipo_usuario_id || null,
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
