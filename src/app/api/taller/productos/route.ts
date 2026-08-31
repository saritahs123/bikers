import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/taller/productos
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar productos." }, { status: 403 });
    }

    const sql = `
      SELECT 
        p.producto_id AS id,
        p.producto_id,
        p.codigo_producto,
        p.codigo_barra,
        p.nombre,
        p.descripcion,
        p.tipo_producto_id,
        tp.nombre AS tipo_producto_nombre,
        tp.codigo AS tipo_producto_codigo,
        p.categoria_producto_id,
        cp.nombre AS categoria_producto_nombre,
        cp.codigo AS categoria_producto_codigo,
        p.marca_producto_id,
        mp.nombre AS marca_producto_nombre,
        p.unidad_medida_id,
        um.codigo AS unidad_medida_codigo,
        um.nombre AS unidad_medida_nombre,
        p.imagen_url,
        COALESCE(p.costo_actual, 0)::numeric AS costo_actual,
        COALESCE(p.precio_venta, 0)::numeric AS precio_venta,
        COALESCE(p.stock_minimo, 0)::numeric AS stock_minimo,
        p.stock_maximo::numeric AS stock_maximo,
        COALESCE(p.requiere_serial, false) AS requiere_serial,
        COALESCE(p.estado, 'ACTIVO') AS estado,
        p.fecha_registro,
        p.fecha_actualizacion,
        p.usuario_registro,
        p.usuario_actualizacion,
        COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS stock_actual,
        (
          SELECT COUNT(*)::int 
          FROM admin.orden_productos 
          WHERE producto_id = p.producto_id
        ) AS orden_productos_count
      FROM admin.productos p
      LEFT JOIN admin.tipo_producto tp ON p.tipo_producto_id = tp.tipo_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id AND (ep.estado = 'ACTIVO' OR ep.estado IS NULL)
      GROUP BY p.producto_id, tp.nombre, tp.codigo, cp.nombre, cp.codigo, mp.nombre, um.codigo, um.nombre
      ORDER BY p.producto_id DESC
    `;

    const rows = await query(sql);

    // Fetch related active lookups for drawer forms
    const [tipos, categorias, marcas, unidades] = await Promise.all([
      query(`SELECT tipo_producto_id AS id, tipo_producto_id, codigo, nombre FROM admin.tipo_producto WHERE (estado = 'ACTIVO' OR estado IS NULL) ORDER BY nombre ASC`),
      query(`SELECT categoria_producto_id AS id, categoria_producto_id, codigo, nombre FROM admin.categoria_producto WHERE (estado = 'ACTIVO' OR estado IS NULL) ORDER BY nombre ASC`),
      query(`SELECT marca_producto_id AS id, marca_producto_id, codigo, nombre FROM admin.marca_producto WHERE (estado = 'ACTIVO' OR estado IS NULL) ORDER BY nombre ASC`),
      query(`SELECT unidad_medida_id AS id, unidad_medida_id, codigo, nombre FROM admin.unidad_medida WHERE (estado = 'ACTIVO' OR estado IS NULL) ORDER BY nombre ASC`)
    ]);

    const mapped = (rows || []).map((r: any) => ({
      id: r.producto_id,
      producto_id: r.producto_id,
      codigo_producto: r.codigo_producto || "",
      codigo_barra: r.codigo_barra || "",
      nombre: r.nombre || "",
      descripcion: r.descripcion || "",
      tipo_producto_id: r.tipo_producto_id,
      tipo_producto_nombre: r.tipo_producto_nombre || "Sin Tipo",
      tipo_producto_codigo: r.tipo_producto_codigo || "",
      categoria_producto_id: r.categoria_producto_id,
      categoria_producto_nombre: r.categoria_producto_nombre || "Sin Categoría",
      categoria_producto_codigo: r.categoria_producto_codigo || "",
      marca_producto_id: r.marca_producto_id,
      marca_producto_nombre: r.marca_producto_nombre || "Genérico",
      unidad_medida_id: r.unidad_medida_id,
      unidad_medida_codigo: r.unidad_medida_codigo || "UND",
      unidad_medida_nombre: r.unidad_medida_nombre || "Unidad",
      imagen_url: r.imagen_url || null,
      costo_actual: Number(r.costo_actual || 0),
      precio_venta: Number(r.precio_venta || 0),
      stock_minimo: Number(r.stock_minimo || 0),
      stock_maximo: r.stock_maximo !== null && r.stock_maximo !== undefined ? Number(r.stock_maximo) : null,
      stock_actual: Number(r.stock_actual || 0),
      is_stock_critico: (r.estado === 'ACTIVO' || !r.estado) && (Number(r.stock_actual || 0) <= Number(r.stock_minimo || 0)),
      requiere_serial: Boolean(r.requiere_serial),
      estado: r.estado || 'ACTIVO',
      activo: (r.estado || 'ACTIVO').toUpperCase() === 'ACTIVO',
      orden_productos_count: Number(r.orden_productos_count || 0),
      fecha_registro: r.fecha_registro ? String(r.fecha_registro) : null
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      lookups: {
        tipos: tipos || [],
        categorias: categorias || [],
        marcas: marcas || [],
        unidades: unidades || []
      }
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
    console.error("Error in GET /api/taller/productos:", error);
    return NextResponse.json({ error: error.message || "Error al obtener catálogo de productos" }, { status: 500 });
  }
}

// POST /api/taller/productos
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear productos en el catálogo." }, { status: 403 });
    }

    const body = await req.json();
    const codigo_producto = (body.codigo_producto || body.codigo || '').trim().toUpperCase();
    const codigo_barra = (body.codigo_barra || '').trim();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const tipo_producto_id = body.tipo_producto_id ? parseInt(body.tipo_producto_id, 10) : null;
    const categoria_producto_id = body.categoria_producto_id ? parseInt(body.categoria_producto_id, 10) : null;
    const marca_producto_id = body.marca_producto_id ? parseInt(body.marca_producto_id, 10) : null;
    const unidad_medida_id = body.unidad_medida_id ? parseInt(body.unidad_medida_id, 10) : null;
    const imagen_url = (body.imagen_url || '').trim();
    const costo_actual = body.costo_actual !== undefined && body.costo_actual !== null && body.costo_actual !== '' ? parseFloat(body.costo_actual) : 0;
    const precio_venta = body.precio_venta !== undefined && body.precio_venta !== null && body.precio_venta !== '' ? parseFloat(body.precio_venta) : 0;
    const stock_minimo = body.stock_minimo !== undefined && body.stock_minimo !== null && body.stock_minimo !== '' ? parseFloat(body.stock_minimo) : 0;
    const stock_maximo = body.stock_maximo !== undefined && body.stock_maximo !== null && body.stock_maximo !== '' ? parseFloat(body.stock_maximo) : null;
    const requiere_serial = Boolean(body.requiere_serial);
    const estado = (body.estado || (body.activo === false ? 'INACTIVO' : 'ACTIVO')).trim().toUpperCase();

    // Validations
    if (!codigo_producto) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código de Producto es obligatorio.", field: "codigo_producto" }, { status: 400 });
    }
    if (codigo_producto.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código no puede exceder los 50 caracteres.", field: "codigo_producto" }, { status: 400 });
    }
    if (codigo_barra && codigo_barra.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Código de Barra no puede exceder los 100 caracteres.", field: "codigo_barra" }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre del producto es obligatorio.", field: "nombre" }, { status: 400 });
    }
    if (nombre.length > 200) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Nombre no puede exceder los 200 caracteres.", field: "nombre" }, { status: 400 });
    }
    if (!tipo_producto_id || isNaN(tipo_producto_id)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar un Tipo de Producto válido.", field: "tipo_producto_id" }, { status: 400 });
    }
    if (!categoria_producto_id || isNaN(categoria_producto_id)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar una Categoría de Producto válida.", field: "categoria_producto_id" }, { status: 400 });
    }
    if (!unidad_medida_id || isNaN(unidad_medida_id)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Debe seleccionar una Unidad de Medida válida.", field: "unidad_medida_id" }, { status: 400 });
    }
    if (isNaN(costo_actual) || costo_actual < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Costo Actual debe ser mayor o igual a 0.", field: "costo_actual" }, { status: 400 });
    }
    if (isNaN(precio_venta) || precio_venta < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Precio de Venta debe ser mayor o igual a 0.", field: "precio_venta" }, { status: 400 });
    }
    if (isNaN(stock_minimo) || stock_minimo < 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Stock Mínimo debe ser mayor o igual a 0.", field: "stock_minimo" }, { status: 400 });
    }
    if (stock_maximo !== null && (isNaN(stock_maximo) || stock_maximo < stock_minimo)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El Stock Máximo no puede ser menor al Stock Mínimo.", field: "stock_maximo" }, { status: 400 });
    }

    // Uniqueness Checks
    const checkCodigo = await query(`
      SELECT producto_id FROM admin.productos
      WHERE UPPER(codigo_producto) = $1
    `, [codigo_producto]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto registrado con este Código.", field: "codigo_producto" }, { status: 409 });
    }

    if (codigo_barra) {
      const checkBarra = await query(`
        SELECT producto_id FROM admin.productos
        WHERE codigo_barra = $1
      `, [codigo_barra]);
      if (checkBarra && checkBarra.length > 0) {
        return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto registrado con este Código de Barra.", field: "codigo_barra" }, { status: 409 });
      }
    }

    // Insert utilizing PostgreSQL Sequence DEFAULT nextval
    const sql = `
      INSERT INTO admin.productos (
        codigo_producto,
        codigo_barra,
        nombre,
        descripcion,
        tipo_producto_id,
        categoria_producto_id,
        marca_producto_id,
        unidad_medida_id,
        imagen_url,
        costo_actual,
        precio_venta,
        stock_minimo,
        stock_maximo,
        requiere_serial,
        estado,
        fecha_registro,
        usuario_registro
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16)
      RETURNING *
    `;

    const result = await query(sql, [
      codigo_producto,
      codigo_barra || null,
      nombre,
      descripcion || null,
      tipo_producto_id,
      categoria_producto_id,
      marca_producto_id || null,
      unidad_medida_id,
      imagen_url || null,
      costo_actual,
      precio_venta,
      stock_minimo,
      stock_maximo,
      requiere_serial,
      estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      session.usuario_id
    ]);

    const created = result[0];

    // Forensic Activity & Audit Logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "PRODUCT_CREATED",
      descripcion: `Creación de producto maestro ${nombre} (Código: ${codigo_producto})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_PRODUCT_CREATED",
      valorAnterior: null,
      valorNuevo: JSON.stringify(sanitizeAuditPayload({
        producto_id: created.producto_id,
        codigo_producto,
        codigo_barra,
        nombre,
        tipo_producto_id,
        categoria_producto_id,
        precio_venta,
        costo_actual,
        estado
      })),
      motivo: `Alta de producto de catálogo ${codigo_producto}`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Producto creado correctamente en el catálogo.",
      data: {
        id: created.producto_id,
        ...created
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/taller/productos:", error);
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("productos_codigo_uk") || msg.includes("23505")) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto con este Código.", field: "codigo_producto" }, { status: 409 });
    }
    if (msg.includes("productos_barra_uk")) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto con este Código de Barra.", field: "codigo_barra" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "No fue posible crear el producto" }, { status: 500 });
  }
}
