import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorizeUserAccess } from "@/lib/userAuth";

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
    const fullNameComputed = (u.first_name || u.last_name)
      ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
      : null;

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
      login_identifiers: u.identificador_principal
        ? [{ is_primary: true, identifier_value: u.identificador_principal }]
        : [],
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
      scope_type: 'GLOBAL'
    };

    return NextResponse.json(mappedUser);
  } catch (error: any) {
    console.error("Error in GET /api/usuarios/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
