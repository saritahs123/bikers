import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, sanitizeAuditPayload } from "@/lib/auditLogger";

const CANONICAL_STATUS_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const CANONICAL_STATUS_CODES = [
  "RECIBIDA",
  "DIAGNOSTICO",
  "APROBACION",
  "REPUESTOS",
  "REPARACION",
  "CALIDAD",
  "LISTA_ENTREGA",
  "ENTREGADA"
];

// GET /api/taller/estados-orden
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar los estados de orden de trabajo." }, { status: 403 });
    }

    const sql = `
      SELECT 
        eot.estado_orden_id AS id,
        eot.estado_orden_id,
        eot.codigo,
        eot.nombre,
        eot.descripcion,
        eot.color_estado,
        eot.orden_visual,
        eot.estado_inicial,
        eot.estado_final,
        eot.permite_edicion,
        eot.activo,
        eot.fecha_registro,
        eot.usuario_registro,
        eot.fecha_actualizacion,
        eot.usuario_actualizacion,
        (
          SELECT COUNT(DISTINCT ot.orden_trabajo_id)::int
          FROM admin.ordenes_trabajo ot
          WHERE ot.estado_orden_id = eot.estado_orden_id
        ) AS total_ordenes,
        (
          SELECT COUNT(DISTINCT ohe.orden_historial_estado_id)::int
          FROM admin.orden_historial_estado ohe
          WHERE ohe.estado_anterior_id = eot.estado_orden_id OR ohe.estado_nuevo_id = eot.estado_orden_id
        ) AS total_historial
      FROM admin.estado_orden_trabajo eot
      ORDER BY eot.orden_visual ASC, eot.estado_orden_id ASC;
    `;

    const rows = await query(sql);

    const mapped = (rows || []).map((r: any) => {
      const isCanonical = CANONICAL_STATUS_IDS.includes(Number(r.estado_orden_id)) ||
        CANONICAL_STATUS_CODES.includes(String(r.codigo || "").toUpperCase());
      const totalRefs = Number(r.total_ordenes || 0) + Number(r.total_historial || 0);

      return {
        id: r.estado_orden_id,
        estado_orden_id: r.estado_orden_id,
        codigo: r.codigo || "",
        nombre: r.nombre || "",
        descripcion: r.descripcion || "",
        color_estado: r.color_estado || "#64748B",
        orden_visual: Number(r.orden_visual ?? 0),
        estado_inicial: Boolean(r.estado_inicial),
        estado_final: Boolean(r.estado_final),
        permite_edicion: Boolean(r.permite_edicion),
        activo: r.activo !== false,
        es_estructural: isCanonical,
        total_ordenes: Number(r.total_ordenes || 0),
        total_historial: Number(r.total_historial || 0),
        en_uso: totalRefs > 0,
        fecha_registro: r.fecha_registro ? String(r.fecha_registro) : null,
        fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion) : null
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped
    }, {
      headers: {
        "x-perm-ver": String(perms.puede_ver),
        "x-perm-crear": String(perms.puede_crear),
        "x-perm-editar": String(perms.puede_editar),
        "x-perm-eliminar": String(perms.puede_eliminar)
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/estados-orden:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "Error al obtener la lista de estados de orden de trabajo."
    }, { status: 500 });
  }
}

// POST /api/taller/estados-orden
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear estados de orden de trabajo." }, { status: 403 });
    }

    const body = await req.json();

    const rawCodigo = String(body.codigo || "").trim().toUpperCase();
    const rawNombre = String(body.nombre || "").trim();
    const rawDescripcion = body.descripcion ? String(body.descripcion).trim() : null;
    let rawColor = body.color_estado ? String(body.color_estado).trim().toUpperCase() : "#64748B";
    const rawOrdenVisual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== ""
      ? parseInt(body.orden_visual, 10)
      : 0;
    const rawPermiteEdicion = body.permite_edicion !== undefined ? Boolean(body.permite_edicion) : true;
    const rawActivo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validation: Codigo
    if (!rawCodigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del estado es obligatorio." }, { status: 400 });
    }
    if (rawCodigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede superar los 50 caracteres." }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]+$/.test(rawCodigo)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código solo puede contener letras mayúsculas, números, guiones y guiones bajos." }, { status: 400 });
    }

    // Validation: Nombre
    if (!rawNombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del estado es obligatorio." }, { status: 400 });
    }
    if (rawNombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede superar los 100 caracteres." }, { status: 400 });
    }

    // Validation: Descripcion
    if (rawDescripcion && rawDescripcion.length > 300) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede superar los 300 caracteres." }, { status: 400 });
    }

    // Validation: Color
    if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(rawColor)) {
      rawColor = "#64748B";
    }

    // Validation: Orden Visual
    if (isNaN(rawOrdenVisual) || rawOrdenVisual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual debe ser un número entero mayor o igual a cero." }, { status: 400 });
    }

    // Validation: Initial / Final state protection
    if (body.estado_inicial === true) {
      return NextResponse.json({
        error: "VALIDATION_ERROR",
        message: "El estado inicial es único y pertenece exclusivamente al estado RECIBIDA."
      }, { status: 400 });
    }

    if (body.estado_final === true) {
      return NextResponse.json({
        error: "VALIDATION_ERROR",
        message: "El estado final es único y pertenece exclusivamente al estado ENTREGADA."
      }, { status: 400 });
    }

    // Check code and name collision
    const existingCheck = await query(
      `SELECT estado_orden_id, codigo, nombre FROM admin.estado_orden_trabajo WHERE UPPER(codigo) = $1 OR UPPER(nombre) = UPPER($2) LIMIT 1`,
      [rawCodigo, rawNombre]
    );

    if (existingCheck && existingCheck.length > 0) {
      const match = existingCheck[0];
      if (String(match.codigo).toUpperCase() === rawCodigo) {
        return NextResponse.json({ error: "CONFLICT", message: `Ya existe un estado de orden con el código '${rawCodigo}'.` }, { status: 409 });
      }
      if (String(match.nombre).toUpperCase() === rawNombre.toUpperCase()) {
        return NextResponse.json({ error: "CONFLICT", message: `Ya existe un estado de orden con el nombre '${rawNombre}'.` }, { status: 409 });
      }
    }

    // Insert new state - PK generated automatically by sequence default
    const insertSql = `
      INSERT INTO admin.estado_orden_trabajo (
        codigo,
        nombre,
        descripcion,
        color_estado,
        orden_visual,
        estado_inicial,
        estado_final,
        permite_edicion,
        activo,
        fecha_registro,
        usuario_registro
      )
      VALUES ($1, $2, $3, $4, $5, false, false, $6, $7, NOW(), $8)
      RETURNING *;
    `;

    const insertedRows = await query(insertSql, [
      rawCodigo,
      rawNombre,
      rawDescripcion,
      rawColor,
      rawOrdenVisual,
      rawPermiteEdicion,
      rawActivo,
      session.usuario_id
    ]);

    if (!insertedRows || insertedRows.length === 0) {
      return NextResponse.json({ error: "SERVER_ERROR", message: "No se pudo registrar el estado de orden de trabajo." }, { status: 500 });
    }

    const createdItem = insertedRows[0];

    // Audit Logging
    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_ORDER_STATUS_CREATED",
      valorNuevo: sanitizeAuditPayload(createdItem),
      motivo: `Creación de estado de orden ID ${createdItem.estado_orden_id} (${createdItem.codigo})`,
      req
    });

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "CREAR_ESTADO_ORDEN",
      descripcion: `Creación de nuevo estado de orden: ${createdItem.nombre} (${createdItem.codigo})`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Estado de orden de trabajo creado exitosamente.",
      data: {
        id: createdItem.estado_orden_id,
        estado_orden_id: createdItem.estado_orden_id,
        codigo: createdItem.codigo,
        nombre: createdItem.nombre,
        descripcion: createdItem.descripcion,
        color_estado: createdItem.color_estado,
        orden_visual: Number(createdItem.orden_visual ?? 0),
        estado_inicial: Boolean(createdItem.estado_inicial),
        estado_final: Boolean(createdItem.estado_final),
        permite_edicion: Boolean(createdItem.permite_edicion),
        activo: createdItem.activo !== false,
        es_estructural: false,
        total_ordenes: 0,
        total_historial: 0,
        en_uso: false,
        fecha_registro: createdItem.fecha_registro ? String(createdItem.fecha_registro) : null
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/taller/estados-orden:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "Error al procesar la creación del estado de orden de trabajo."
    }, { status: 500 });
  }
}
