import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/crm/component-states
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsBici = await getModulePermissions("BICICLETA", session.usuario_id);
    const permsCrm = await getModulePermissions("CRM", session.usuario_id);
    if (!permsBici.puede_ver && !permsCrm.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver los estados de componentes." }, { status: 403 });
    }

    const rows = await query(`
      SELECT 
        ec.estado_componente_id AS id,
        ec.estado_componente_id,
        ec.codigo,
        ec.nombre,
        ec.descripcion,
        ec.nivel_desgaste,
        ec.requiere_revision,
        ec.orden_visual,
        ec.activo,
        ec.fecha_creacion,
        ec.fecha_modificacion,
        COUNT(bc.bicicleta_componente_id)::int as component_count
      FROM admin.estado_componente ec
      LEFT JOIN admin.bicicleta_componentes bc ON ec.estado_componente_id = bc.estado_componente_id AND bc.fecha_eliminacion IS NULL
      WHERE ec.fecha_eliminacion IS NULL
      GROUP BY ec.estado_componente_id
      ORDER BY ec.orden_visual ASC, ec.estado_componente_id ASC
    `);

    const mapped = (rows || []).map((r: any) => ({
      id: r.estado_componente_id ?? r.id,
      estado_componente_id: r.estado_componente_id ?? r.id,
      codigo: r.codigo || '',
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      nivel_desgaste: r.nivel_desgaste !== undefined && r.nivel_desgaste !== null ? Number(r.nivel_desgaste) : 0,
      requiere_revision: r.requiere_revision === true || r.requiere_revision === 't' || r.requiere_revision === 'true',
      orden_visual: r.orden_visual !== undefined && r.orden_visual !== null ? Number(r.orden_visual) : 0,
      activo: r.activo !== false,
      estado: r.activo !== false ? 'ACTIVO' : 'INACTIVO',
      component_count: Number(r.component_count || 0),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_modificacion: r.fecha_modificacion ? String(r.fecha_modificacion).substring(0, 10) : null
    }));

    const response = NextResponse.json(mapped);
    response.headers.set("x-perm-ver", String(permsCrm.puede_ver || permsBici.puede_ver));
    response.headers.set("x-perm-crear", String(permsCrm.puede_crear));
    response.headers.set("x-perm-editar", String(permsCrm.puede_editar));
    response.headers.set("x-perm-eliminar", String(permsCrm.puede_eliminar));
    response.headers.set("x-perm-exportar", String(permsCrm.puede_exportar));

    return response;
  } catch (error: any) {
    console.error("Error in GET /api/crm/component-states:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/component-states
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear estados de componentes." }, { status: 403 });
    }

    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const nivel_desgaste = body.nivel_desgaste !== undefined && body.nivel_desgaste !== null && body.nivel_desgaste !== '' ? parseInt(body.nivel_desgaste, 10) : 0;
    const requiere_revision = Boolean(body.requiere_revision);
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del estado es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del estado es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(nivel_desgaste) || nivel_desgaste < 0 || nivel_desgaste > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nivel de Desgaste es obligatorio y debe estar entre 0 y 100." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual es obligatorio y debe ser mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE UPPER(codigo) = $1 AND fecha_eliminacion IS NULL
    `, [codigo]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "STATE_ALREADY_EXISTS", message: "Ya existe un estado registrado con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE LOWER(nombre) = $1 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase()]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "STATE_ALREADY_EXISTS", message: "Ya existe un estado registrado con este Nombre." }, { status: 400 });
    }

    const sql = `
      INSERT INTO admin.estado_componente (
        codigo, nombre, descripcion, nivel_desgaste, requiere_revision, orden_visual, activo, fecha_creacion, usuario_creacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *
    `;

    const result = await query(sql, [codigo, nombre, descripcion || null, nivel_desgaste, requiere_revision, orden_visual, activo, session.usuario_id]);
    const r = result[0] || {};

    const createdState = {
      id: r.estado_componente_id ?? r.id,
      estado_componente_id: r.estado_componente_id ?? r.id,
      codigo: r.codigo || codigo,
      nombre: r.nombre || nombre,
      descripcion: r.descripcion || descripcion,
      nivel_desgaste: r.nivel_desgaste ?? nivel_desgaste,
      requiere_revision: r.requiere_revision ?? requiere_revision,
      orden_visual: r.orden_visual ?? orden_visual,
      activo: r.activo !== false,
      component_count: 0,
      fecha_creacion: r.fecha_creacion || new Date().toISOString()
    };

    // Forensic logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "CRM",
      evento: "COMPONENT_STATE_CREATED",
      descripcion: `Creación de estado de componentes ${nombre} (Código: ${codigo})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_CATALOG_STATE_CREATED",
      valorAnterior: null,
      valorNuevo: JSON.stringify(sanitizeAuditPayload({
        estado_componente_id: createdState.id,
        codigo,
        nombre,
        descripcion,
        nivel_desgaste,
        requiere_revision,
        orden_visual
      })),
      motivo: `Creación de estado de componente ${nombre}`,
      req
    });

    return NextResponse.json(createdState, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/crm/component-states:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
