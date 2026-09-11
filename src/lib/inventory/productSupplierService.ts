import { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";

// ============================================================================
// TYPES & ERRORS
// ============================================================================

export class ProductSupplierError extends Error {
  code: string;
  status: number;
  details?: Record<string, any>;

  constructor(message: string, code = "PRODUCT_SUPPLIER_ERROR", status = 400, details?: Record<string, any>) {
    super(message);
    this.name = "ProductSupplierError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ProductoProveedorItem {
  producto_proveedor_id: number;
  producto_id: number;
  proveedor_id: number;
  codigo_producto_proveedor?: string | null;
  costo_compra: number;
  moneda: string;
  tiempo_entrega_dias?: number | null;
  proveedor_principal: boolean;
  ultima_fecha_compra?: Date | string | null;
  estado: string;
  observacion?: string | null;
  fecha_registro: Date | string;
  fecha_actualizacion?: Date | string | null;
  // Join fields:
  producto_nombre?: string;
  codigo_producto?: string;
  marca_nombre?: string;
  codigo_proveedor?: string;
  nombre_comercial?: string;
  nombre_contacto?: string;
  telefono?: string;
  correo?: string;
}

export interface UpsertRelationParams {
  empresaId: number;
  usuarioId: number;
  productoId: number;
  proveedorId: number;
  codigoProductoProveedor?: string | null;
  costoCompra: number;
  moneda?: string;
  tiempoEntregaDias?: number | null;
  proveedorPrincipal?: boolean;
  estado?: string;
  observacion?: string | null;
}

export interface UpdateRelationParams {
  empresaId: number;
  usuarioId: number;
  productoProveedorId: number;
  codigoProductoProveedor?: string | null;
  costoCompra?: number;
  moneda?: string;
  tiempoEntregaDias?: number | null;
  proveedorPrincipal?: boolean;
  estado?: string;
  observacion?: string | null;
}

// ============================================================================
// TENANT VERIFICATION HELPER
// ============================================================================

/**
 * Ensures both Product and Supplier belong to the authenticated session's company.
 * Prevents any cross-tenant data association.
 */
export async function validateTenantProductAndSupplier(
  clientOrQuery: { query: (text: string, params?: any[]) => Promise<any> },
  empresaId: number,
  productoId: number,
  proveedorId: number
): Promise<{ producto: any; proveedor: any }> {
  const prodRes = await clientOrQuery.query(
    `SELECT producto_id, codigo_producto, nombre, empresa_id, estado
     FROM admin.productos
     WHERE producto_id = $1`,
    [Number(productoId)]
  );

  if (!prodRes.rows || prodRes.rows.length === 0) {
    throw new ProductSupplierError(`Producto con ID ${productoId} no encontrado.`, "PRODUCTO_NO_ENCONTRADO", 404);
  }

  const producto = prodRes.rows[0];
  if (Number(producto.empresa_id) !== Number(empresaId)) {
    throw new ProductSupplierError(
      `Acceso denegado: El producto no pertenece a su empresa.`,
      "CROSS_TENANT_PRODUCTO_NOT_ALLOWED",
      403
    );
  }

  const provRes = await clientOrQuery.query(
    `SELECT proveedor_id, codigo_proveedor, nombre_comercial, empresa_id, estado
     FROM admin.proveedores
     WHERE proveedor_id = $1`,
    [Number(proveedorId)]
  );

  if (!provRes.rows || provRes.rows.length === 0) {
    throw new ProductSupplierError(`Proveedor con ID ${proveedorId} no encontrado.`, "PROVEEDOR_NO_ENCONTRADO", 404);
  }

  const proveedor = provRes.rows[0];
  if (Number(proveedor.empresa_id) !== Number(empresaId)) {
    throw new ProductSupplierError(
      `Acceso denegado: El proveedor no pertenece a su empresa.`,
      "CROSS_TENANT_PROVEEDOR_NOT_ALLOWED",
      403
    );
  }

  return { producto, proveedor };
}

// ============================================================================
// QUERIES FOR LISTING RELATIONS
// ============================================================================

/**
 * Returns all products associated with a specific supplier for the current company.
 */
export async function getProductosByProveedor(
  empresaId: number,
  proveedorId: number
): Promise<ProductoProveedorItem[]> {
  // Validate supplier tenant
  const provCheck = await query(
    `SELECT proveedor_id FROM admin.proveedores WHERE proveedor_id = $1 AND empresa_id = $2`,
    [Number(proveedorId), Number(empresaId)]
  );
  if (!provCheck || provCheck.length === 0) {
    throw new ProductSupplierError("Proveedor no encontrado en su empresa.", "PROVEEDOR_NO_ENCONTRADO", 404);
  }

  const rows = await query(
    `SELECT
       pp.producto_proveedor_id,
       pp.producto_id,
       pp.proveedor_id,
       p.codigo_producto,
       p.nombre AS producto_nombre,
       mp.nombre AS marca_nombre,
       pp.codigo_producto_proveedor,
       COALESCE(pp.costo_compra, 0)::numeric AS costo_compra,
       COALESCE(pp.moneda, 'DOP') AS moneda,
       pp.tiempo_entrega_dias,
       COALESCE(pp.proveedor_principal, false) AS proveedor_principal,
       pp.ultima_fecha_compra,
       COALESCE(pp.estado, 'ACTIVO') AS estado,
       pp.observacion,
       pp.fecha_registro,
       pp.fecha_actualizacion
     FROM admin.producto_proveedor pp
     JOIN admin.productos p ON pp.producto_id = p.producto_id
     LEFT JOIN admin.marca_producto mp ON p.marca_producto_id = mp.marca_producto_id
     WHERE pp.proveedor_id = $1
       AND p.empresa_id = $2
     ORDER BY pp.proveedor_principal DESC, pp.producto_proveedor_id DESC`,
    [Number(proveedorId), Number(empresaId)]
  );

  return rows.map((r: any) => ({
    ...r,
    costo_compra: Number(r.costo_compra || 0),
    tiempo_entrega_dias: r.tiempo_entrega_dias !== null ? Number(r.tiempo_entrega_dias) : null,
    proveedor_principal: Boolean(r.proveedor_principal),
    fecha_registro: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : "",
    fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
  }));
}

/**
 * Returns all suppliers associated with a specific product for the current company.
 */
export async function getProveedoresByProducto(
  empresaId: number,
  productoId: number
): Promise<ProductoProveedorItem[]> {
  // Validate product tenant
  const prodCheck = await query(
    `SELECT producto_id FROM admin.productos WHERE producto_id = $1 AND empresa_id = $2`,
    [Number(productoId), Number(empresaId)]
  );
  if (!prodCheck || prodCheck.length === 0) {
    throw new ProductSupplierError("Producto no encontrado en su empresa.", "PRODUCTO_NO_ENCONTRADO", 404);
  }

  const rows = await query(
    `SELECT
       pp.producto_proveedor_id,
       pp.producto_id,
       pp.proveedor_id,
       pr.codigo_proveedor,
       pr.nombre_comercial,
       pr.nombre_contacto,
       pr.telefono,
       pr.correo,
       pp.codigo_producto_proveedor,
       COALESCE(pp.costo_compra, 0)::numeric AS costo_compra,
       COALESCE(pp.moneda, 'DOP') AS moneda,
       pp.tiempo_entrega_dias,
       COALESCE(pp.proveedor_principal, false) AS proveedor_principal,
       pp.ultima_fecha_compra,
       COALESCE(pp.estado, 'ACTIVO') AS estado,
       pp.observacion,
       pp.fecha_registro,
       pp.fecha_actualizacion
     FROM admin.producto_proveedor pp
     JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
     JOIN admin.productos p ON pp.producto_id = p.producto_id
     WHERE pp.producto_id = $1
       AND pr.empresa_id = $2
       AND p.empresa_id = $2
     ORDER BY pp.proveedor_principal DESC, pp.producto_proveedor_id DESC`,
    [Number(productoId), Number(empresaId)]
  );

  return rows.map((r: any) => ({
    ...r,
    costo_compra: Number(r.costo_compra || 0),
    tiempo_entrega_dias: r.tiempo_entrega_dias !== null ? Number(r.tiempo_entrega_dias) : null,
    proveedor_principal: Boolean(r.proveedor_principal),
    fecha_registro: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : "",
    fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
  }));
}

// ============================================================================
// MUTATIONS: CREATE / REACTIVATE / UPDATE / INACTIVATE
// ============================================================================

/**
 * Upsert / Reactivate relation between Product and Supplier.
 * - Enforces cross-tenant validation
 * - If relation exists and is ACTIVE: rejects duplicate
 * - If relation exists and is INACTIVE: reactivates row (updates state, cost, etc.)
 * - If relation does not exist: inserts new row
 * - Manages single active primary supplier per product transactionally
 */
export async function upsertProductoProveedor(
  params: UpsertRelationParams
): Promise<ProductoProveedorItem> {
  const {
    empresaId,
    usuarioId,
    productoId,
    proveedorId,
    codigoProductoProveedor = null,
    costoCompra,
    moneda = "DOP",
    tiempoEntregaDias = null,
    proveedorPrincipal = false,
    estado = "ACTIVO",
    observacion = null,
  } = params;

  if (costoCompra === undefined || costoCompra === null || isNaN(Number(costoCompra)) || Number(costoCompra) < 0) {
    throw new ProductSupplierError("El costo de compra debe ser un número mayor o igual a 0.", "COSTO_COMPRA_INVALIDO", 400);
  }

  if (tiempoEntregaDias !== null && tiempoEntregaDias !== undefined && (!Number.isInteger(Number(tiempoEntregaDias)) || Number(tiempoEntregaDias) < 0)) {
    throw new ProductSupplierError("El tiempo de entrega debe ser un número entero mayor o igual a 0.", "TIEMPO_ENTREGA_INVALIDO", 400);
  }

  return withTransaction(async (client: PoolClient) => {
    // 1. Validate both Product and Supplier tenant ownership
    await validateTenantProductAndSupplier(client, empresaId, productoId, proveedorId);

    // 2. Lock existing relations for this product to prevent concurrency races on proveedor_principal
    await client.query(
      `SELECT producto_proveedor_id, proveedor_id, proveedor_principal, estado
       FROM admin.producto_proveedor
       WHERE producto_id = $1
       FOR UPDATE`,
      [Number(productoId)]
    );

    // 3. Check if relationship between this product and supplier already exists
    const existingRes = await client.query(
      `SELECT producto_proveedor_id, estado, proveedor_principal
       FROM admin.producto_proveedor
       WHERE producto_id = $1 AND proveedor_id = $2
       LIMIT 1`,
      [Number(productoId), Number(proveedorId)]
    );

    const isPrimary = Boolean(proveedorPrincipal);
    const cleanMoneda = String(moneda || "DOP").trim().toUpperCase();
    const cleanCodigoProv = codigoProductoProveedor ? String(codigoProductoProveedor).trim() : null;
    const cleanObs = observacion ? String(observacion).trim() : null;
    const cleanDelivery = tiempoEntregaDias !== null && tiempoEntregaDias !== undefined ? Number(tiempoEntregaDias) : null;
    const cleanCost = Number(Number(costoCompra).toFixed(2));

    // If making this relationship primary, clear any other active primary for this product
    if (isPrimary && estado === "ACTIVO") {
      await client.query(
        `UPDATE admin.producto_proveedor
         SET proveedor_principal = false,
             fecha_actualizacion = NOW(),
             usuario_actualizacion = $1
         WHERE producto_id = $2 AND proveedor_principal = true`,
        [Number(usuarioId), Number(productoId)]
      );
    }

    if (existingRes.rows && existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];

      if (String(existing.estado).toUpperCase() === "ACTIVO" && String(estado).toUpperCase() === "ACTIVO") {
        throw new ProductSupplierError(
          "Este producto ya está asociado al proveedor.",
          "RELACION_DUPLICADA_ACTIVA",
          409
        );
      }

      // Reactivate inactive record
      const updateRes = await client.query(
        `UPDATE admin.producto_proveedor
         SET
           codigo_producto_proveedor = $1,
           costo_compra = $2,
           moneda = $3,
           tiempo_entrega_dias = $4,
           proveedor_principal = $5,
           estado = $6,
           observacion = $7,
           fecha_actualizacion = NOW(),
           usuario_actualizacion = $8
         WHERE producto_proveedor_id = $9
         RETURNING *`,
        [
          cleanCodigoProv,
          cleanCost,
          cleanMoneda,
          cleanDelivery,
          isPrimary,
          estado,
          cleanObs,
          Number(usuarioId),
          existing.producto_proveedor_id,
        ]
      );

      return updateRes.rows[0];
    }

    // 4. Insert new relationship
    const insertRes = await client.query(
      `INSERT INTO admin.producto_proveedor (
         producto_id,
         proveedor_id,
         codigo_producto_proveedor,
         costo_compra,
         moneda,
         tiempo_entrega_dias,
         proveedor_principal,
         estado,
         observacion,
         fecha_registro,
         usuario_registro
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
       RETURNING *`,
      [
        Number(productoId),
        Number(proveedorId),
        cleanCodigoProv,
        cleanCost,
        cleanMoneda,
        cleanDelivery,
        isPrimary,
        estado,
        cleanObs,
        Number(usuarioId),
      ]
    );

    return insertRes.rows[0];
  });
}

/**
 * Update an existing Producto-Proveedor relationship.
 * Never changes producto_id or proveedor_id.
 */
export async function updateProductoProveedor(
  params: UpdateRelationParams
): Promise<ProductoProveedorItem> {
  const {
    empresaId,
    usuarioId,
    productoProveedorId,
    codigoProductoProveedor,
    costoCompra,
    moneda,
    tiempoEntregaDias,
    proveedorPrincipal,
    estado,
    observacion,
  } = params;

  return withTransaction(async (client: PoolClient) => {
    // 1. Lock and retrieve current record
    const currRes = await client.query(
      `SELECT
         pp.producto_proveedor_id,
         pp.producto_id,
         pp.proveedor_id,
         pp.codigo_producto_proveedor,
         pp.costo_compra,
         pp.moneda,
         pp.tiempo_entrega_dias,
         pp.proveedor_principal,
         pp.estado,
         pp.observacion,
         p.empresa_id AS producto_empresa_id,
         pr.empresa_id AS proveedor_empresa_id
       FROM admin.producto_proveedor pp
       JOIN admin.productos p ON pp.producto_id = p.producto_id
       JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
       WHERE pp.producto_proveedor_id = $1
       FOR UPDATE`,
      [Number(productoProveedorId)]
    );

    if (!currRes.rows || currRes.rows.length === 0) {
      throw new ProductSupplierError("Relación producto-proveedor no encontrada.", "RELACION_NO_ENCONTRADA", 404);
    }

    const curr = currRes.rows[0];

    // 2. Validate tenant for both parent entities
    if (Number(curr.producto_empresa_id) !== Number(empresaId) || Number(curr.proveedor_empresa_id) !== Number(empresaId)) {
      throw new ProductSupplierError("Acceso denegado: La relación no pertenece a su empresa.", "CROSS_TENANT_NOT_ALLOWED", 403);
    }

    // Prepare fields
    const nextCosto = costoCompra !== undefined && costoCompra !== null ? Number(Number(costoCompra).toFixed(2)) : Number(curr.costo_compra);
    if (isNaN(nextCosto) || nextCosto < 0) {
      throw new ProductSupplierError("El costo de compra debe ser mayor o igual a 0.", "COSTO_COMPRA_INVALIDO", 400);
    }

    const nextDelivery = tiempoEntregaDias !== undefined
      ? (tiempoEntregaDias !== null ? Number(tiempoEntregaDias) : null)
      : curr.tiempo_entrega_dias;

    if (nextDelivery !== null && (!Number.isInteger(nextDelivery) || nextDelivery < 0)) {
      throw new ProductSupplierError("El tiempo de entrega debe ser un número entero mayor o igual a 0.", "TIEMPO_ENTREGA_INVALIDO", 400);
    }

    const nextEstado = estado !== undefined ? String(estado).toUpperCase() : curr.estado;
    let nextIsPrimary = proveedorPrincipal !== undefined ? Boolean(proveedorPrincipal) : Boolean(curr.proveedor_principal);

    // Rule: Inactivation clears primary status (product temporarily has no primary)
    if (nextEstado === "INACTIVO") {
      nextIsPrimary = false;
    }

    // If making this relationship primary, clear any other active primary for this product
    if (nextIsPrimary && nextEstado === "ACTIVO") {
      await client.query(
        `UPDATE admin.producto_proveedor
         SET proveedor_principal = false,
             fecha_actualizacion = NOW(),
             usuario_actualizacion = $1
         WHERE producto_id = $2
           AND producto_proveedor_id != $3
           AND proveedor_principal = true`,
        [Number(usuarioId), Number(curr.producto_id), Number(curr.producto_proveedor_id)]
      );
    }

    const nextCodigoProv = codigoProductoProveedor !== undefined ? (codigoProductoProveedor ? String(codigoProductoProveedor).trim() : null) : curr.codigo_producto_proveedor;
    const nextMoneda = moneda !== undefined ? String(moneda).trim().toUpperCase() : curr.moneda;
    const nextObs = observacion !== undefined ? (observacion ? String(observacion).trim() : null) : curr.observacion;

    const updateRes = await client.query(
      `UPDATE admin.producto_proveedor
       SET
         codigo_producto_proveedor = $1,
         costo_compra = $2,
         moneda = $3,
         tiempo_entrega_dias = $4,
         proveedor_principal = $5,
         estado = $6,
         observacion = $7,
         fecha_actualizacion = NOW(),
         usuario_actualizacion = $8
       WHERE producto_proveedor_id = $9
       RETURNING *`,
      [
        nextCodigoProv,
        nextCosto,
        nextMoneda,
        nextDelivery,
        nextIsPrimary,
        nextEstado,
        nextObs,
        Number(usuarioId),
        Number(curr.producto_proveedor_id),
      ]
    );

    return updateRes.rows[0];
  });
}

/**
 * Inactivate an existing Producto-Proveedor relationship logically without physical DELETE.
 */
export async function inactivateProductoProveedor(
  empresaId: number,
  usuarioId: number,
  productoProveedorId: number
): Promise<boolean> {
  await updateProductoProveedor({
    empresaId,
    usuarioId,
    productoProveedorId,
    estado: "INACTIVO",
    proveedorPrincipal: false,
  });
  return true;
}
