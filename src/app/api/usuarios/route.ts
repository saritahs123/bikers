import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    // 1. We join the primary identity, security, role and type tables.
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
      permissionsOverride: false, // Default logic mapping
      scope_type: 'GLOBAL' // Default scope mapping 
    }));

    return NextResponse.json(mappedUsers);
  } catch (error: any) {
    console.error("Error in GET /api/usuarios:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
