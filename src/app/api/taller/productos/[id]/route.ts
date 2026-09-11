import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";
import { upsertProductoProveedor } from "@/lib/inventory/productSupplierService";

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
        COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS stock_actual,
        (
          SELECT pr.proveedor_id
          FROM admin.producto_proveedor pp
          JOIN admin.proveedores pr ON pr.proveedor_id = pp.proveedor_id
          WHERE pp.producto_id = p.producto_id AND pp.proveedor_principal = true AND (pp.estado = 'ACTIVO' OR pp.estado IS NULL)
          LIMIT 1
        ) AS proveedor_principal_id,
        (
          SELECT pr.nombre_comercial
          FROM admin.producto_proveedor pp
          JOIN admin.proveedores pr ON pr.proveedor_id = pp.proveedor_id
          WHERE pp.producto_id = p.producto_id AND pp.proveedor_principal = true AND (pp.estado = 'ACTIVO' OR pp.estado IS NULL)
          LIMIT 1
        ) AS proveedor_principal_nombre
      FROM admin.productos p
      LEFT JOIN admin.tipo_producto tp ON p.tipo_producto_id = tp.tipo_producto_id
      LEFT JOIN admin.categoria_producto cp ON p.categoria_producto_id = cp.categoria_producto_id
      LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
      LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
      LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id AND (ep.estado = 'ACTIVO' OR ep.estado IS NULL)
      WHERE p.producto_id = $1 AND (p.empresa_id = $2 OR p.empresa_id IS NULL)
      GROUP BY p.producto_id, tp.nombre, cp.nombre, mp.nombre, um.codigo, um.nombre
    `, [productoId, session.empresa_id]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const item = rows[0];
    const { searchParams } = new URL(req.url);

    if (searchParams.get("check_dependencies") === "true") {
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

      const referencias: Array<{ tipo: string; label: string; cantidad: number; detalles: string[] }> = [];

      if (countProv > 0) {
        const provRows = await query(
          `SELECT pr.nombre_comercial, pr.codigo_proveedor
           FROM admin.producto_proveedor pp
           JOIN admin.proveedores pr ON pr.proveedor_id = pp.proveedor_id
           WHERE pp.producto_id = $1
           LIMIT 4`,
          [productoId]
        );
        referencias.push({
          tipo: "proveedores",
          label: "Proveedores Asignados",
          cantidad: countProv,
          detalles: (provRows || []).map((r: any) => `${r.nombre_comercial} (${r.codigo_proveedor})`)
        });
      }

      if (countOrdenProd > 0) {
        referencias.push({
          tipo: "ordenes",
          label: "Órdenes de Trabajo / Taller",
          cantidad: countOrdenProd,
          detalles: [`${countOrdenProd} uso(s) o servicio(s) asociados en taller`]
        });
      }

      if (countMovs > 0) {
        referencias.push({
          tipo: "movimientos",
          label: "Movimientos en Kardex",
          cantidad: countMovs,
          detalles: [`${countMovs} transacciones de inventario registradas`]
        });
      }

      if (countExistencias > 0) {
        const stockRows = await query(
          `SELECT a.nombre, ep.cantidad_actual
           FROM admin.existencias_producto ep
           JOIN admin.almacenes a ON a.almacen_id = ep.almacen_id
           WHERE ep.producto_id = $1
           LIMIT 3`,
          [productoId]
        );
        referencias.push({
          tipo: "existencias",
          label: "Existencias en Almacén",
          cantidad: countExistencias,
          detalles: (stockRows || []).length > 0
            ? (stockRows || []).map((r: any) => `${r.nombre}: ${Number(r.cantidad_actual)} uds`)
            : [`${countExistencias} almacén(es) con registro de existencias`]
        });
      }

      if (countOrdenCompra + countRecCompra > 0) {
        referencias.push({
          tipo: "compras",
          label: "Compras / Recepciones",
          cantidad: countOrdenCompra + countRecCompra,
          detalles: [`${countOrdenCompra + countRecCompra} registro(s) en módulo de compras`]
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          ...item,
          can_delete: totalUsage === 0,
          total_dependencies: totalUsage,
          referencias,
          dependencies: {
            orden_productos: countOrdenProd,
            existencias: countExistencias,
            movimientos_inventario: countMovs,
            compras: countOrdenCompra + countRecCompra,
            proveedores: countProv,
            total: totalUsage
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: item
    });

  } catch (error: any) {
    console.error("Error in GET /api/taller/productos/[id]:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al obtener el producto." }, { status: 500 });
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
      SELECT * FROM admin.productos WHERE producto_id = $1 AND (empresa_id = $2 OR empresa_id IS NULL)
    `, [productoId, session.empresa_id]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const beforeItem = beforeRows[0];
    const body = await req.json();

    const codigo_producto = String((body.codigo_producto !== undefined && body.codigo_producto !== null ? body.codigo_producto : beforeItem.codigo_producto) || '').trim().toUpperCase();
    const codigo_barra = String((body.codigo_barra !== undefined && body.codigo_barra !== null ? body.codigo_barra : (beforeItem.codigo_barra || ''))).trim();
    const nombre = String((body.nombre !== undefined && body.nombre !== null ? body.nombre : beforeItem.nombre) || '').trim();
    const descripcion = String((body.descripcion !== undefined && body.descripcion !== null ? body.descripcion : (beforeItem.descripcion || ''))).trim();
    const tipo_producto_id = body.tipo_producto_id !== undefined && body.tipo_producto_id !== null && body.tipo_producto_id !== '' ? parseInt(body.tipo_producto_id, 10) : beforeItem.tipo_producto_id;
    const categoria_producto_id = body.categoria_producto_id !== undefined && body.categoria_producto_id !== null && body.categoria_producto_id !== '' ? parseInt(body.categoria_producto_id, 10) : beforeItem.categoria_producto_id;
    const marca_producto_id = body.marca_producto_id !== undefined 
      ? (body.marca_producto_id ? parseInt(body.marca_producto_id, 10) : null) 
      : beforeItem.marca_producto_id;
    const unidad_medida_id = body.unidad_medida_id !== undefined && body.unidad_medida_id !== null && body.unidad_medida_id !== '' ? parseInt(body.unidad_medida_id, 10) : beforeItem.unidad_medida_id;
    const imagen_url = String((body.imagen_url !== undefined && body.imagen_url !== null ? body.imagen_url : (beforeItem.imagen_url || ''))).trim();
    const costo_actual = body.costo_actual !== undefined && body.costo_actual !== null && body.costo_actual !== '' ? parseFloat(body.costo_actual) : (parseFloat(beforeItem.costo_actual) || 0);
    const precio_venta = body.precio_venta !== undefined && body.precio_venta !== null && body.precio_venta !== '' ? parseFloat(body.precio_venta) : (parseFloat(beforeItem.precio_venta) || 0);
    const stock_minimo = body.stock_minimo !== undefined && body.stock_minimo !== null && body.stock_minimo !== '' ? parseFloat(body.stock_minimo) : (parseFloat(beforeItem.stock_minimo) || 0);
    const stock_maximo = body.stock_maximo !== undefined 
      ? (body.stock_maximo !== null && body.stock_maximo !== '' ? parseFloat(body.stock_maximo) : null)
      : (beforeItem.stock_maximo !== null && beforeItem.stock_maximo !== undefined ? parseFloat(beforeItem.stock_maximo) : null);
    const requiere_serial = body.requiere_serial !== undefined ? Boolean(body.requiere_serial) : Boolean(beforeItem.requiere_serial);
    
    // Support toggle activo or explicit estado
    let estado = beforeItem.estado || 'ACTIVO';
    if (body.estado !== undefined && typeof body.estado === 'string') {
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
      WHERE UPPER(codigo_producto) = $1 AND producto_id <> $2 AND (empresa_id = $3 OR empresa_id IS NULL)
    `, [codigo_producto, productoId, session.empresa_id]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe otro producto registrado con este Código en su empresa.", field: "codigo_producto" }, { status: 409 });
    }

    if (codigo_barra) {
      const checkBarra = await query(`
        SELECT producto_id FROM admin.productos
        WHERE codigo_barra = $1 AND producto_id <> $2 AND (empresa_id = $3 OR empresa_id IS NULL)
      `, [codigo_barra, productoId, session.empresa_id]);
      if (checkBarra && checkBarra.length > 0) {
        return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe otro producto registrado con este Código de Barra en su empresa.", field: "codigo_barra" }, { status: 409 });
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
      WHERE producto_id = $17 AND (empresa_id = $18 OR empresa_id IS NULL)
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
      productoId,
      session.empresa_id
    ]);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
    }

    const updated = result[0];

    // If a primary supplier was assigned or updated, sync it
    if (body.proveedor_id !== undefined && body.proveedor_id !== null && body.proveedor_id !== "") {
      const provId = parseInt(body.proveedor_id, 10);
      if (!isNaN(provId)) {
        try {
          await upsertProductoProveedor({
            empresaId: session.empresa_id,
            usuarioId: session.usuario_id,
            productoId,
            proveedorId: provId,
            costoCompra: costo_actual,
            moneda: "DOP",
            tiempoEntregaDias: 3,
            proveedorPrincipal: true,
            estado: "ACTIVO",
            observacion: "Proveedor principal asignado desde catálogo de productos"
          });
        } catch (provErr) {
          console.error("Warning: could not update primary supplier:", provErr);
        }
      }
    }

    // Forensic Activity & Audit Logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "TALLER",
      evento: "PRODUCT_UPDATED",
      descripcion: `Actualización de producto ${nombre} (Código: ${codigo_producto})`,
      req
    });

    const diff = computeDiff(
      {
        codigo_producto: beforeItem.codigo_producto,
        codigo_barra: beforeItem.codigo_barra,
        nombre: beforeItem.nombre,
        descripcion: beforeItem.descripcion,
        tipo_producto_id: beforeItem.tipo_producto_id,
        categoria_producto_id: beforeItem.categoria_producto_id,
        marca_producto_id: beforeItem.marca_producto_id,
        unidad_medida_id: beforeItem.unidad_medida_id,
        imagen_url: beforeItem.imagen_url,
        costo_actual: Number(beforeItem.costo_actual),
        precio_venta: Number(beforeItem.precio_venta),
        stock_minimo: Number(beforeItem.stock_minimo),
        stock_maximo: beforeItem.stock_maximo !== null ? Number(beforeItem.stock_maximo) : null,
        requiere_serial: Boolean(beforeItem.requiere_serial),
        estado: beforeItem.estado
      },
      {
        codigo_producto,
        codigo_barra: codigo_barra || null,
        nombre,
        descripcion: descripcion || null,
        tipo_producto_id,
        categoria_producto_id,
        marca_producto_id,
        unidad_medida_id,
        imagen_url: imagen_url || null,
        costo_actual,
        precio_venta,
        stock_minimo,
        stock_maximo,
        requiere_serial,
        estado
      }
    );

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "TALLER_PRODUCT_UPDATED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload(beforeItem)),
      valorNuevo: JSON.stringify(sanitizeAuditPayload(updated)),
      motivo: `Actualización de producto ${codigo_producto}. Modificaciones: ${Object.keys(diff).join(", ")}`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Producto actualizado correctamente.",
      data: updated
    });

  } catch (error: any) {
    console.error("Error in PUT /api/taller/productos/[id]:", error);
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("productos_codigo_uk") || error?.code === "23505" || msg.includes("23505")) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto con este Código.", field: "codigo_producto" }, { status: 409 });
    }
    if (msg.includes("productos_barra_uk")) {
      return NextResponse.json({ error: "PRODUCT_ALREADY_EXISTS", message: "Ya existe un producto con este Código de Barra.", field: "codigo_barra" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "No fue posible actualizar el producto." }, { status: 500 });
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
      SELECT * FROM admin.productos WHERE producto_id = $1 AND (empresa_id = $2 OR empresa_id IS NULL)
    `, [productoId, session.empresa_id]);

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

      // Collect specific summarized references
      const referencias: Array<{ tipo: string; label: string; cantidad: number; detalles: string[] }> = [];

      if (countProv > 0) {
        const provRows = await query(
          `SELECT pr.nombre_comercial, pr.codigo_proveedor
           FROM admin.producto_proveedor pp
           JOIN admin.proveedores pr ON pr.proveedor_id = pp.proveedor_id
           WHERE pp.producto_id = $1
           LIMIT 4`,
          [productoId]
        );
        referencias.push({
          tipo: "proveedores",
          label: "Proveedores Asignados",
          cantidad: countProv,
          detalles: (provRows || []).map((r: any) => `${r.nombre_comercial} (${r.codigo_proveedor})`)
        });
      }

      if (countOrdenProd > 0) {
        referencias.push({
          tipo: "ordenes",
          label: "Órdenes de Trabajo / Taller",
          cantidad: countOrdenProd,
          detalles: [`${countOrdenProd} uso(s) o servicio(s) asociados en taller`]
        });
      }

      if (countMovs > 0) {
        referencias.push({
          tipo: "movimientos",
          label: "Movimientos en Kardex",
          cantidad: countMovs,
          detalles: [`${countMovs} transacciones de inventario registradas`]
        });
      }

      if (countExistencias > 0) {
        const stockRows = await query(
          `SELECT a.nombre, ep.cantidad_actual
           FROM admin.existencias_producto ep
           JOIN admin.almacenes a ON a.almacen_id = ep.almacen_id
           WHERE ep.producto_id = $1
           LIMIT 3`,
          [productoId]
        );
        referencias.push({
          tipo: "existencias",
          label: "Existencias en Almacén",
          cantidad: countExistencias,
          detalles: (stockRows || []).length > 0
            ? (stockRows || []).map((r: any) => `${r.nombre}: ${Number(r.cantidad_actual)} uds`)
            : [`${countExistencias} almacén(es) con registro de existencias`]
        });
      }

      if (countOrdenCompra + countRecCompra > 0) {
        referencias.push({
          tipo: "compras",
          label: "Compras / Recepciones",
          cantidad: countOrdenCompra + countRecCompra,
          detalles: [`${countOrdenCompra + countRecCompra} registro(s) en módulo de compras`]
        });
      }

      return NextResponse.json({
        success: false,
        error: "PRODUCT_IN_USE",
        code: "PRODUCT_IN_USE",
        message: "Este producto posee movimientos o registros asociados y no puede eliminarse físicamente.",
        producto: {
          id: productoId,
          codigo_producto: beforeItem.codigo_producto,
          nombre: beforeItem.nombre,
          activo: beforeItem.activo !== false,
          estado: beforeItem.estado || 'ACTIVO'
        },
        referencias,
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
      WHERE producto_id = $1 AND (empresa_id = $2 OR empresa_id IS NULL)
      RETURNING producto_id
    `, [productoId, session.empresa_id]);

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
    if (error?.code === "23503" || error?.message?.includes("23503")) {
      return NextResponse.json({ success: false, error: "PRODUCT_IN_USE", message: "Este producto posee registros asociados y no puede eliminarse." }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "No fue posible eliminar el producto." }, { status: 500 });
  }
}
