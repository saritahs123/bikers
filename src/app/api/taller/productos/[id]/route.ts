import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/taller/productos/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar productos." }, { status: 403 });
    }

    const { id } = await context.params;
    const productoId = parseInt(id, 10);

    if (isNaN(productoId)) {
      return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        p.producto_id AS id,
        p.producto_id,
        p.codigo_producto,
        p.codigo_barra,
        p.nombre,
        p.descripcion,
        p.tipo_producto_id,
        tp.nombre AS tipo_producto_nombre,
        p.categoria_producto_id,
        cp.nombre AS categoria_producto_nombre,
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
        COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS stock_actual
      FROM admin.productos p
      LEFT JOIN admin.tipo_producto tp ON p.tipo_producto_id = tp.tipo_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id AND (ep.estado = 'ACTIVO' OR ep.estado IS NULL)
      WHERE p.producto_id = $1
      GROUP BY p.producto_id, tp.nombre, cp.nombre, mp.nombre, um.codigo, um.nombre
    `, [productoId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    });

  } catch (error: any) {
    console.error("Error in GET /api/taller/productos/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al obtener producto" }, { status: 500 });
  }
}

// PUT /api/taller/productos/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar productos." }, { status: 403 });
    }

    const { id } = await context.params;
    const productoId = parseInt(id, 10);

    if (isNaN(productoId)) {
      return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.productos WHERE producto_id = $1
    `, [productoId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const beforeItem = beforeRows[0];
    const body = await req.json();

    const codigo_producto = (body.codigo_producto !== undefined ? body.codigo_producto : (beforeItem.codigo_producto || '')).trim().toUpperCase();
    const codigo_barra = (body.codigo_barra !== undefined ? body.codigo_barra : (beforeItem.codigo_barra || '')).trim();
    const nombre = (body.nombre !== undefined ? body.nombre : (beforeItem.nombre || '')).trim();
    const descripcion = (body.descripcion !== undefined ? body.descripcion : (beforeItem.descripcion || '')).trim();
    const tipo_producto_id = body.tipo_producto_id !== undefined ? parseInt(body.tipo_producto_id, 10) : beforeItem.tipo_producto_id;
    const categoria_producto_id = body.categoria_producto_id !== undefined ? parseInt(body.categoria_producto_id, 10) : beforeItem.categoria_producto_id;
    const marca_producto_id = body.marca_producto_id !== undefined 
      ? (body.marca_producto_id ? parseInt(body.marca_producto_id, 10) : null) 
      : beforeItem.marca_producto_id;
    const unidad_medida_id = body.unidad_medida_id !== undefined ? parseInt(body.unidad_medida_id, 10) : beforeItem.unidad_medida_id;
    const imagen_url = (body.imagen_url !== undefined ? body.imagen_url : (beforeItem.imagen_url || '')).trim();
    const costo_actual = body.costo_actual !== undefined && body.costo_actual !== null && body.costo_actual !== '' ? parseFloat(body.costo_actual) : (beforeItem.costo_actual || 0);
    const precio_venta = body.precio_venta !== undefined && body.precio_venta !== null && body.precio_venta !== '' ? parseFloat(body.precio_venta) : (beforeItem.precio_venta || 0);
    const stock_minimo = body.stock_minimo !== undefined && body.stock_minimo !== null && body.stock_minimo !== '' ? parseFloat(body.stock_minimo) : (beforeItem.stock_minimo || 0);
    const stock_maximo = body.stock_maximo !== undefined 
      ? (body.stock_maximo !== null && body.stock_maximo !== '' ? parseFloat(body.stock_maximo) : null)
      : beforeItem.stock_maximo;
    const requiere_serial = body.requiere_serial !== undefined ? Boolean(body.requiere_serial) : Boolean(beforeItem.requiere_serial);
    
    // Support toggle activo or explicit estado
    let estado = beforeItem.estado || 'ACTIVO';
    if (body.estado !== undefined) {
      estado = body.estado.trim().toUpperCase();
    } else if (body.activo !== undefined) {
      estado = body.activo ? 'ACTIVO' : 'INACTIVO';
    }

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

    // Uniqueness Checks for other records
    const checkCodigo = await query(`
      SELECT producto_id FROM admin.productos
      WHERE UPPER(codigo_producto) = $1 AND producto_id <> $2
    `, [codigo_producto, productoId]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe otro producto registrado con este Código.", field: "codigo_producto" }, { status: 409 });
    }

    if (codigo_barra) {
      const checkBarra = await query(`
        SELECT producto_id FROM admin.productos
        WHERE codigo_barra = $1 AND producto_id <> $2
      `, [codigo_barra, productoId]);
      if (checkBarra && checkBarra.length > 0) {
        return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe otro producto registrado con este Código de Barra.", field: "codigo_barra" }, { status: 409 });
      }
    }

    const sql = `
      UPDATE admin.productos SET
        codigo_producto = $1,
        codigo_barra = $2,
        nombre = $3,
        descripcion = $4,
        tipo_producto_id = $5,
        categoria_producto_id = $6,
        marca_producto_id = $7,
        unidad_medida_id = $8,
        imagen_url = $9,
        costo_actual = $10,
        precio_venta = $11,
        stock_minimo = $12,
        stock_maximo = $13,
        requiere_serial = $14,
        estado = $15,
        fecha_actualizacion = NOW(),
        usuario_actualizacion = $16
      WHERE producto_id = $17
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
      session.usuario_id,
      productoId
    ]);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const updated = result[0];
    const diff = computeDiff(beforeItem, updated);

    if (diff.hasChanges) {
      let eventType = "PRODUCT_UPDATED";
      if (beforeItem.estado === 'ACTIVO' && updated.estado === 'INACTIVO') {
        eventType = "PRODUCT_DEACTIVATED";
      } else if (beforeItem.estado === 'INACTIVO' && updated.estado === 'ACTIVO') {
        eventType = "PRODUCT_REACTIVATED";
      }

      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER",
        evento: eventType,
        descripcion: `Actualización de producto ${updated.nombre} (ID: ${productoId})`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: "TALLER_PRODUCT_UPDATED",
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de producto ID ${productoId}`,
        req
      });
    }

    return NextResponse.json({
      success: true,
      message: "Producto actualizado correctamente.",
      data: {
        id: updated.producto_id,
        ...updated
      }
    });

  } catch (error: any) {
    console.error("Error in PUT /api/taller/productos/[id]:", error);
    return NextResponse.json({ error: error.message || "No fue posible actualizar el producto" }, { status: 500 });
  }
}

// DELETE /api/taller/productos/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar productos." }, { status: 403 });
    }

    const { id } = await context.params;
    const productoId = parseInt(id, 10);

    if (isNaN(productoId)) {
      return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.productos WHERE producto_id = $1
    `, [productoId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const beforeItem = beforeRows[0];

    // 1. Audit all real foreign key dependencies across Workshop, Inventory, Purchases
    const [ordenProdCheck, existenciasCheck, movsCheck, ordenCompraCheck, recCompraCheck, provCheck] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM admin.orden_productos WHERE producto_id = $1`, [productoId]),
      query(`SELECT COUNT(*)::int AS count FROM admin.existencias_producto WHERE producto_id = $1`, [productoId]),
      query(`SELECT COUNT(*)::int AS count FROM admin.movimientos_inventario WHERE producto_id = $1`, [productoId]),
      query(`SELECT COUNT(*)::int AS count FROM admin.detalle_orden_compra WHERE producto_id = $1`, [productoId]),
      query(`SELECT COUNT(*)::int AS count FROM admin.detalle_recepcion_compra WHERE producto_id = $1`, [productoId]),
      query(`SELECT COUNT(*)::int AS count FROM admin.producto_proveedor WHERE producto_id = $1`, [productoId])
    ]);

    const countOrdenProd = Number(ordenProdCheck[0]?.count || 0);
    const countExistencias = Number(existenciasCheck[0]?.count || 0);
    const countMovs = Number(movsCheck[0]?.count || 0);
    const countOrdenCompra = Number(ordenCompraCheck[0]?.count || 0);
    const countRecCompra = Number(recCompraCheck[0]?.count || 0);
    const countProv = Number(provCheck[0]?.count || 0);

    const totalUsage = countOrdenProd + countExistencias + countMovs + countOrdenCompra + countRecCompra + countProv;

    // 2. Block physical deletion if dependencies exist -> Return HTTP 409
    if (totalUsage > 0) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "TALLER",
        evento: "PRODUCT_DELETE_BLOCKED",
        descripcion: `Intento de eliminación de producto con referencias ${beforeItem.nombre} (ID: ${productoId})`,
        resultado: "DENEGADO",
        req
      });

      return NextResponse.json({
        success: false,
        error: "PRODUCT_IN_USE",
        code: "PRODUCT_IN_USE",
        message: "Este producto posee movimientos o registros asociados y no puede eliminarse. Puedes desactivarlo.",
        dependencies: {
          orden_productos: countOrdenProd,
          existencias: countExistencias,
          movimientos_inventario: countMovs,
          compras: countOrdenCompra + countRecCompra,
          proveedores: countProv,
          total: totalUsage
        }
      }, { status: 409 });
    }

    // 3. Perform physical deletion if 0 dependencies exist
    const delResult = await query(`
      DELETE FROM admin.productos
      WHERE producto_id = $1
      RETURNING producto_id
    `, [productoId]);

    if (!delResult || delResult.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    // Forensic logging on successful deletion
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "PRODUCT_DELETED",
      descripcion: `Eliminación física de producto ${beforeItem.nombre} (ID: ${productoId})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_PRODUCT_DELETED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        producto_id: beforeItem.producto_id,
        codigo_producto: beforeItem.codigo_producto,
        nombre: beforeItem.nombre,
        tipo_producto_id: beforeItem.tipo_producto_id,
        categoria_producto_id: beforeItem.categoria_producto_id,
        precio_venta: beforeItem.precio_venta
      })),
      valorNuevo: null,
      motivo: `Eliminación de producto ID ${productoId} sin dependencias`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente del catálogo.",
      id: productoId
    });

  } catch (error: any) {
    console.error("Error in DELETE /api/taller/productos/[id]:", error);
    return NextResponse.json({ error: error.message || "No fue posible eliminar el producto" }, { status: 500 });
  }
}
