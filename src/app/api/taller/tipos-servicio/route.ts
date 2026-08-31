import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/taller/tipos-servicio
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar los tipos de servicio." }, { status: 403 });
    }

    const sql = `
      SELECT 
        ts.tipo_servicio_id AS id,
        ts.tipo_servicio_id,
        ts.categoria_servicio_id,
        cs.nombre AS categoria_nombre,
        cs.codigo AS categoria_codigo,
        ts.codigo,
        ts.nombre,
        ts.descripcion,
        COALESCE(ts.duracion_estimada_horas, 0)::numeric AS duracion_estimada_horas,
        COALESCE(ts.precio_base, 0)::numeric AS precio_base,
        COALESCE(ts.requiere_diagnostico, false) AS requiere_diagnostico,
        COALESCE(ts.requiere_aprobacion_cliente, false) AS requiere_aprobacion_cliente,
        COALESCE(ts.orden_visual, 0) AS orden_visual,
        COALESCE(ts.activo, true) AS activo,
        ts.fecha_creacion,
        ts.usuario_creacion,
        ts.fecha_modificacion,
        ts.usuario_modificacion,
        (
          SELECT COUNT(DISTINCT os.orden_servicio_id)::int
          FROM admin.orden_servicios os
          WHERE os.tipo_servicio_id = ts.tipo_servicio_id AND (os.activo = true OR os.activo IS NULL)
        ) + (
          SELECT COUNT(DISTINCT r.recepcion_id)::int
          FROM admin.recepciones r
          WHERE r.tipo_servicio_id = ts.tipo_servicio_id AND (r.activo = true OR r.activo IS NULL)
        ) AS uso_count
      FROM admin.tipo_servicio ts
      LEFT JOIN admin.categoria_servicio cs ON ts.categoria_servicio_id = cs.categoria_servicio_id
      WHERE ts.fecha_eliminacion IS NULL
      ORDER BY ts.orden_visual ASC, ts.tipo_servicio_id ASC
    `;

    const rows = await query(sql);

    // Lookup of active service categories for form select dropdowns
    const categorias = await query(`
      SELECT 
        categoria_servicio_id,
        categoria_servicio_id AS id,
        codigo,
        nombre,
        descripcion,
        orden_visual,
        activo
      FROM admin.categoria_servicio
      WHERE fecha_eliminacion IS NULL AND (activo = true OR activo IS NULL)
      ORDER BY orden_visual ASC, nombre ASC
    `);

    const mapped = (rows || []).map((r: any) => ({
      id: r.tipo_servicio_id,
      tipo_servicio_id: r.tipo_servicio_id,
      categoria_servicio_id: r.categoria_servicio_id,
      categoria_nombre: r.categoria_nombre || "Sin Categoría",
      categoria_codigo: r.categoria_codigo || "",
      codigo: r.codigo || "",
      nombre: r.nombre || "",
      descripcion: r.descripcion || "",
      duracion_estimada_horas: Number(r.duracion_estimada_horas || 0),
      precio_base: Number(r.precio_base || 0),
      requiere_diagnostico: Boolean(r.requiere_diagnostico),
      requiere_aprobacion_cliente: Boolean(r.requiere_aprobacion_cliente),
      orden_visual: Number(r.orden_visual || 0),
      activo: r.activo !== false,
      uso_count: Number(r.uso_count || 0),
      en_uso: Number(r.uso_count || 0) > 0,
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion) : null
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      categorias: categorias || []
    }, {
      headers: {
        "x-perm-ver": String(perms.puede_ver),
        "x-perm-crear": String(perms.puede_crear),
        "x-perm-editar": String(perms.puede_editar),
        "x-perm-eliminar": String(perms.puede_eliminar),
        "x-perm-exportar": String(perms.puede_exportar)
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/tipos-servicio:", error);
    return NextResponse.json({ error: error.message || "Error al obtener tipos de servicio" }, { status: 500 });
  }
}

// POST /api/taller/tipos-servicio
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear tipos de servicio." }, { status: 403 });
    }

    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const categoria_servicio_id = body.categoria_servicio_id ? parseInt(body.categoria_servicio_id, 10) : null;
    const duracion_estimada_horas = body.duracion_estimada_horas !== undefined && body.duracion_estimada_horas !== null && body.duracion_estimada_horas !== '' 
      ? parseFloat(body.duracion_estimada_horas) 
      : 0;
    const precio_base = body.precio_base !== undefined && body.precio_base !== null && body.precio_base !== '' 
      ? parseFloat(body.precio_base) 
      : 0;
    const requiere_diagnostico = Boolean(body.requiere_diagnostico);
    const requiere_aprobacion_cliente = Boolean(body.requiere_aprobacion_cliente);
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' 
      ? parseInt(body.orden_visual, 10) 
      : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Strict Field Validations
    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código del tipo de servicio es obligatorio.", field: "codigo" }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres.", field: "codigo" }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del tipo de servicio es obligatorio.", field: "nombre" }, { status: 400 });
    }
    if (nombre.length > 150) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 150 caracteres.", field: "nombre" }, { status: 400 });
    }
    if (descripcion.length > 500) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Descripción no puede exceder los 500 caracteres.", field: "descripcion" }, { status: 400 });
    }
    if (!categoria_servicio_id || isNaN(categoria_servicio_id)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar una Categoría de Servicio válida.", field: "categoria_servicio_id" }, { status: 400 });
    }
    if (isNaN(duracion_estimada_horas) || duracion_estimada_horas < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "La Duración Estimada debe ser mayor o igual a 0.", field: "duracion_estimada_horas" }, { status: 400 });
    }
    if (isNaN(precio_base) || precio_base < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Precio Base debe ser mayor o igual a 0.00 DOP.", field: "precio_base" }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Orden Visual debe ser un entero mayor o igual a 0.", field: "orden_visual" }, { status: 400 });
    }

    // Uniqueness Checks
    const checkCodigo = await query(`
      SELECT tipo_servicio_id FROM admin.tipo_servicio
      WHERE UPPER(codigo) = $1 AND fecha_eliminacion IS NULL
    `, [codigo]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "SERVICE_TYPE_ALREADY_EXISTS", message: "Ya existe un tipo de servicio registrado con este Código.", field: "codigo" }, { status: 409 });
    }

    const checkNombre = await query(`
      SELECT tipo_servicio_id FROM admin.tipo_servicio
      WHERE LOWER(nombre) = $1 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase()]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "SERVICE_TYPE_ALREADY_EXISTS", message: "Ya existe un tipo de servicio registrado con este Nombre.", field: "nombre" }, { status: 409 });
    }

    // Verify foreign key categoria_servicio_id exists
    const checkCat = await query(`
      SELECT categoria_servicio_id FROM admin.categoria_servicio
      WHERE categoria_servicio_id = $1 AND fecha_eliminacion IS NULL
    `, [categoria_servicio_id]);
    if (!checkCat || checkCat.length === 0) {
      return NextResponse.json({ error: "INVALID_FOREIGN_KEY", message: "La Categoría de Servicio seleccionada no existe.", field: "categoria_servicio_id" }, { status: 400 });
    }

    // Insert utilizing PostgreSQL Sequence DEFAULT nextval
    const sql = `
      INSERT INTO admin.tipo_servicio (
        categoria_servicio_id,
        codigo,
        nombre,
        descripcion,
        duracion_estimada_horas,
        precio_base,
        requiere_diagnostico,
        requiere_aprobacion_cliente,
        orden_visual,
        activo,
        fecha_creacion,
        usuario_creacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
      RETURNING *
    `;

    const result = await query(sql, [
      categoria_servicio_id,
      codigo,
      nombre,
      descripcion || null,
      duracion_estimada_horas,
      precio_base,
      requiere_diagnostico,
      requiere_aprobacion_cliente,
      orden_visual,
      activo,
      session.usuario_id
    ]);

    const created = result[0];

    // Forensic Activity & Audit Logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "SERVICE_TYPE_CREATED",
      descripcion: `Creación de tipo de servicio ${nombre} (Código: ${codigo})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_SERVICE_TYPE_CREATED",
      valorAnterior: null,
      valorNuevo: JSON.stringify(sanitizeAuditPayload({
        tipo_servicio_id: created.tipo_servicio_id,
        codigo,
        nombre,
        categoria_servicio_id,
        precio_base,
        duracion_estimada_horas,
        activo
      })),
      motivo: `Alta de tipo de servicio ${codigo}`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Tipo de servicio creado correctamente.",
      data: {
        id: created.tipo_servicio_id,
        ...created
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/taller/tipos-servicio:", error);
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("uk_tipo_servicio_codigo") || msg.includes("23505")) {
      return NextResponse.json({ error: "SERVICE_TYPE_ALREADY_EXISTS", message: "Ya existe un tipo de servicio con este Código.", field: "codigo" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "No fue posible crear el tipo de servicio" }, { status: 500 });
  }
}
