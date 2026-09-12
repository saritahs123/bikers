import { PoolClient } from "pg";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";

export interface WorkshopProductInput {
  orden_producto_id?: number | null;
  producto_id: number | string;
  almacen_id?: number | string | null;
  cantidad: number | string;
  precio_unitario?: number | string | null;
  observacion?: string | null;
}

export interface ReserveProductsParams {
  client: PoolClient;
  ordenTrabajoId: number;
  empresaId: number;
  usuarioId: number;
  productos: WorkshopProductInput[];
}

export interface SyncProductsParams {
  client: PoolClient;
  ordenTrabajoId: number;
  empresaId: number;
  usuarioId: number;
  incomingProducts: WorkshopProductInput[];
}

export class WorkshopReservationError extends Error {
  status: number;
  code: string;
  stockActual?: number;
  cantidadReservada?: number;
  cantidadDisponible?: number;
  cantidadSolicitada?: number;
  productoId?: number;
  almacenId?: number;
  almacenesDisponibles?: Array<{ almacen_id: number; codigo: string; nombre: string }>;

  constructor(
    message: string,
    status = 400,
    code = "WORKSHOP_RESERVATION_ERROR",
    extra: Partial<WorkshopReservationError> = {}
  ) {
    super(message);
    this.name = "WorkshopReservationError";
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

/**
 * Resolves the active warehouse for a given tenant company.
 *
 * STRICT MULTI-WAREHOUSE AUDIT RULE:
 * 1. Queries active warehouses belonging strictly to session.empresa_id (never empresa_id IS NULL).
 * 2. If 0 active warehouses: throws 404 NO_ACTIVE_WAREHOUSE.
 * 3. If exactly 1 active warehouse: auto-selects that unique valid warehouse.
 * 4. If > 1 active warehouses: NEVER silently picks the first or lowest ID.
 *    Throws 400 ALMACEN_REQUERIDO, forcing explicit warehouse selection from frontend.
 */
export async function resolveDefaultWarehouse(
  client: PoolClient,
  empresaId: number,
  productIdentifier?: string | number
): Promise<{ almacen_id: number; codigo: string; nombre: string }> {
  const almRes = await client.query(
    `SELECT almacen_id, codigo, nombre
     FROM admin.almacenes
     WHERE empresa_id = $1 AND UPPER(estado) = 'ACTIVO'
     ORDER BY almacen_id ASC`,
    [empresaId]
  );

  if (!almRes.rows || almRes.rows.length === 0) {
    throw new WorkshopReservationError(
      "No existe ningún almacén activo configurado para su empresa.",
      404,
      "NO_ACTIVE_WAREHOUSE"
    );
  }

  if (almRes.rows.length === 1) {
    return {
      almacen_id: Number(almRes.rows[0].almacen_id),
      codigo: String(almRes.rows[0].codigo),
      nombre: String(almRes.rows[0].nombre)
    };
  }

  // More than 1 active warehouse: forbid silent selection.
  const names = almRes.rows.map(a => `${a.codigo} - ${a.nombre}`).join(", ");
  throw new WorkshopReservationError(
    `Su empresa cuenta con múltiples almacenes activos (${names}). Debe seleccionar explícitamente el almacén para el repuesto${productIdentifier ? ` "${productIdentifier}"` : ""}.`,
    400,
    "ALMACEN_REQUERIDO",
    {
      almacenesDisponibles: almRes.rows.map(a => ({
        almacen_id: Number(a.almacen_id),
        codigo: String(a.codigo),
        nombre: String(a.nombre)
      }))
    }
  );
}

export interface InsertedOrdenProducto {
  orden_producto_id: number;
  producto_id: number;
  almacen_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  utilizado: boolean;
}

export interface ExistingOrdenProducto {
  orden_producto_id: number;
  producto_id: number;
  almacen_id: number;
  cantidad: string | number;
  precio_unitario: string | number;
  utilizado: boolean;
}

/**
 * Atomically reserves inventory and inserts products for a newly created Work Order.
 *
 * Core Guarantees:
 * 1. Deterministic lock order: (producto_id ASC, almacen_id ASC) to prevent deadlocks.
 * 2. Strict stock validation: if requested > available -> throws 409 STOCK_INSUFICIENTE.
 * 3. Never auto-creates missing admin.existencias_producto rows.
 * 4. Increments existencias_producto.cantidad_reservada WITHOUT touching cantidad_actual or PMP.
 * 5. Zero movements created in admin.movimientos_inventario.
 * 6. Inserts into admin.orden_productos with utilizado = false.
 * 7. If any item fails, caller's transaction rolls back completely (atomic all-or-nothing).
 */
export async function reserveProductsForNewWorkOrder(
  params: ReserveProductsParams
): Promise<{
  insertedProducts: InsertedOrdenProducto[];
  subtotal_productos: number;
}> {
  const { client, ordenTrabajoId, empresaId, usuarioId, productos } = params;

  if (!Array.isArray(productos) || productos.length === 0) {
    return { insertedProducts: [], subtotal_productos: 0 };
  }

  // 1. Normalize and validate input lines
  const normalizedLines: Array<{
    producto_id: number;
    almacen_id: number;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    observacion: string | null;
    nombre_producto: string;
  }> = [];

  let subtotal_productos = 0;

  for (let idx = 0; idx < productos.length; idx++) {
    const p = productos[idx];
    const pId = parseInt(String(p.producto_id), 10);
    const qty = parseFloat(String(p.cantidad));

    if (isNaN(pId) || pId <= 0) {
      throw new WorkshopReservationError(
        `El producto en la posición ${idx + 1} no es válido.`,
        400,
        "INVALID_PRODUCT"
      );
    }

    if (isNaN(qty) || qty <= 0) {
      throw new WorkshopReservationError(
        `La cantidad para el producto #${pId} debe ser mayor a 0.`,
        400,
        "INVALID_QUANTITY"
      );
    }

    // Resolve warehouse: use item's if explicitly provided, otherwise strict tenant rule
    let targetAlmacenId: number;
    if (p.almacen_id !== undefined && p.almacen_id !== null && String(p.almacen_id).trim() !== "") {
      const explicitAlmId = parseInt(String(p.almacen_id), 10);
      if (isNaN(explicitAlmId) || explicitAlmId <= 0) {
        throw new WorkshopReservationError(
          `El almacén especificado para el producto #${pId} no es válido.`,
          400,
          "INVALID_WAREHOUSE"
        );
      }

      const valAlmRes = await client.query(
        `SELECT almacen_id, estado, empresa_id
         FROM admin.almacenes
         WHERE almacen_id = $1 AND empresa_id = $2`,
        [explicitAlmId, empresaId]
      );

      if (!valAlmRes.rows || valAlmRes.rows.length === 0) {
        throw new WorkshopReservationError(
          `El almacén #${explicitAlmId} no existe o no pertenece a su empresa.`,
          404,
          "ALMACEN_NOT_FOUND"
        );
      }

      if (String(valAlmRes.rows[0].estado || "").toUpperCase() !== "ACTIVO") {
        throw new WorkshopReservationError(
          `El almacén seleccionado (#${explicitAlmId}) se encuentra inactivo.`,
          400,
          "ALMACEN_INACTIVO"
        );
      }

      targetAlmacenId = explicitAlmId;
    } else {
      const defAlm = await resolveDefaultWarehouse(client, empresaId, pId);
      targetAlmacenId = defAlm.almacen_id;
    }

    // Product validation in catalog
    const prodRes = await client.query(
      `SELECT p.producto_id, p.codigo_producto, p.nombre, p.precio_venta, p.estado, p.empresa_id,
              COALESCE(um.permite_decimales, false) AS permite_decimales,
              um.codigo AS unidad_medida
       FROM admin.productos p
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       WHERE p.producto_id = $1`,
      [pId]
    );

    if (!prodRes.rows || prodRes.rows.length === 0) {
      throw new WorkshopReservationError(
        `El producto #${pId} no existe en el catálogo.`,
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    const prod = prodRes.rows[0];
    if (prod.empresa_id != null && Number(prod.empresa_id) !== Number(empresaId)) {
      throw new WorkshopReservationError(
        `El producto "${prod.nombre}" no pertenece a su empresa.`,
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    const isProdActive =
      String(prod.estado || "").toUpperCase() === "ACTIVO" ||
      prod.estado === true ||
      prod.estado === 1;
    if (!isProdActive) {
      throw new WorkshopReservationError(
        `El producto "${prod.nombre}" se encuentra inactivo.`,
        400,
        "PRODUCTO_INACTIVO"
      );
    }

    if (!prod.permite_decimales && !Number.isInteger(qty)) {
      throw new WorkshopReservationError(
        `La unidad de medida (${prod.unidad_medida || "UND"}) del producto "${prod.nombre}" no permite cantidades decimales.`,
        400,
        "DECIMALS_NOT_ALLOWED"
      );
    }

    const unitPrice =
      p.precio_unitario !== undefined &&
      p.precio_unitario !== null &&
      p.precio_unitario !== "" &&
      !isNaN(Number(p.precio_unitario)) &&
      Number(p.precio_unitario) >= 0
        ? Number(p.precio_unitario)
        : Number(prod.precio_venta || 0);

    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    subtotal_productos = Math.round((subtotal_productos + lineSubtotal) * 100) / 100;

    normalizedLines.push({
      producto_id: pId,
      almacen_id: targetAlmacenId,
      cantidad: qty,
      precio_unitario: unitPrice,
      subtotal: lineSubtotal,
      observacion: (p.observacion || "").trim() || null,
      nombre_producto: prod.nombre
    });
  }

  // 2. Aggregate quantities per (producto_id, almacen_id) to validate & lock once
  const aggregateMap = new Map<string, { producto_id: number; almacen_id: number; totalQty: number; nombre: string }>();
  for (const line of normalizedLines) {
    const key = `${line.producto_id}_${line.almacen_id}`;
    const existing = aggregateMap.get(key);
    if (existing) {
      existing.totalQty = Math.round((existing.totalQty + line.cantidad) * 100) / 100;
    } else {
      aggregateMap.set(key, {
        producto_id: line.producto_id,
        almacen_id: line.almacen_id,
        totalQty: line.cantidad,
        nombre: line.nombre_producto
      });
    }
  }

  // 3. DETERMINISTIC LOCK ORDER: sort by producto_id ASC, almacen_id ASC
  const sortedPairs = Array.from(aggregateMap.values()).sort((a, b) => {
    if (a.producto_id !== b.producto_id) {
      return a.producto_id - b.producto_id;
    }
    return a.almacen_id - b.almacen_id;
  });

  const lockedExistences: Array<{ existencia_producto_id: number; totalQty: number }> = [];

  for (const pair of sortedPairs) {
    const exRes = await client.query(
      `SELECT existencia_producto_id, empresa_id, producto_id, almacen_id,
              cantidad_actual, cantidad_reservada,
              (cantidad_actual - cantidad_reservada) AS disponible, estado
       FROM admin.existencias_producto
       WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
       FOR UPDATE`,
      [empresaId, pair.producto_id, pair.almacen_id]
    );

    if (!exRes.rows || exRes.rows.length === 0) {
      throw new WorkshopReservationError(
        `No hay existencia disponible suficiente para reservar el producto "${pair.nombre}". No existe registro de inventario en el almacén seleccionado.`,
        409,
        "STOCK_INSUFICIENTE",
        {
          stockActual: 0,
          cantidadReservada: 0,
          cantidadDisponible: 0,
          cantidadSolicitada: pair.totalQty,
          productoId: pair.producto_id,
          almacenId: pair.almacen_id
        }
      );
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");
    const cantidadDisponible = Math.round((stockActual - cantidadReservada) * 100) / 100;

    if (pair.totalQty > cantidadDisponible) {
      throw new WorkshopReservationError(
        `No hay existencia disponible suficiente para reservar el producto "${pair.nombre}". Stock actual: ${stockActual}, Reservado: ${cantidadReservada}, Disponible: ${cantidadDisponible}, Solicitado: ${pair.totalQty}.`,
        409,
        "STOCK_INSUFICIENTE",
        {
          stockActual,
          cantidadReservada,
          cantidadDisponible,
          cantidadSolicitada: pair.totalQty,
          productoId: pair.producto_id,
          almacenId: pair.almacen_id
        }
      );
    }

    lockedExistences.push({
      existencia_producto_id: ex.existencia_producto_id,
      totalQty: pair.totalQty
    });
  }

  // 4. Atomically increment cantidad_reservada in existencias_producto
  for (const item of lockedExistences) {
    await client.query(
      `UPDATE admin.existencias_producto
       SET cantidad_reservada = cantidad_reservada + $1,
           fecha_actualizacion = CURRENT_TIMESTAMP,
           usuario_actualizacion = $2
       WHERE existencia_producto_id = $3`,
      [item.totalQty, usuarioId, item.existencia_producto_id]
    );
  }

  // 5. Insert each line into admin.orden_productos with utilizado = false
  const insertedProducts: InsertedOrdenProducto[] = [];
  for (const line of normalizedLines) {
    const insRes = await client.query(
      `INSERT INTO admin.orden_productos (
        orden_trabajo_id,
        orden_servicio_id,
        producto_id,
        almacen_id,
        cantidad,
        precio_unitario,
        porcentaje_descuento,
        valor_descuento,
        subtotal,
        estado_aprobacion_id,
        utilizado,
        observacion,
        fecha_registro,
        usuario_registro
      ) VALUES (
        $1, NULL, $2, $3,
        $4, $5, 0, 0,
        $6, 1, false, $7,
        NOW(), $8
      )
      RETURNING orden_producto_id, producto_id, almacen_id, cantidad, precio_unitario, subtotal, utilizado`,
      [
        ordenTrabajoId,
        line.producto_id,
        line.almacen_id,
        line.cantidad,
        line.precio_unitario,
        line.subtotal,
        line.observacion,
        usuarioId
      ]
    );
    insertedProducts.push(insRes.rows[0]);
  }

  return {
    insertedProducts,
    subtotal_productos
  };
}

/**
 * Synchronizes products during Work Order edit (PUT /api/taller/ordenes/[id]).
 *
 * Core Guarantees:
 * 1. Blocks alteration/deletion of consumed items (utilizado = true).
 * 2. Computes net reservation delta per (producto_id, almacen_id).
 * 3. Acquires row locks in deterministic order (producto_id ASC, almacen_id ASC).
 * 4. Validates available stock for any net positive reservation increase.
 * 5. Safely adjusts cantidad_reservada (up or down) without touching cantidad_actual or PMP.
 * 6. Inserts, updates, or deletes admin.orden_productos in sync with reservations.
 */
export async function syncProductsForWorkOrderUpdate(
  params: SyncProductsParams
): Promise<void> {
  const { client, ordenTrabajoId, empresaId, usuarioId, incomingProducts } = params;

  // 1. Fetch existing products for the work order
  const existingRes = await client.query(
    `SELECT op.orden_producto_id, op.producto_id, op.almacen_id, op.cantidad, op.precio_unitario, op.utilizado
     FROM admin.orden_productos op
     WHERE op.orden_trabajo_id = $1`,
    [ordenTrabajoId]
  );

  const existingMap = new Map<number, ExistingOrdenProducto>();
  existingRes.rows.forEach((r) => existingMap.set(Number(r.orden_producto_id), r));

  // 2. Validate consumed items invariant
  const incomingIdSet = new Set<number>();
  for (const p of incomingProducts) {
    if (p.orden_producto_id) {
      const pId = Number(p.orden_producto_id);
      incomingIdSet.add(pId);
      const existRow = existingMap.get(pId);
      if (existRow && existRow.utilizado) {
        const newQty = parseFloat(String(p.cantidad));
        const oldQty = parseFloat(String(existRow.cantidad));
        if (Math.abs(newQty - oldQty) > 0.0001) {
          throw new WorkshopReservationError(
            `No se puede modificar la cantidad del repuesto #${existRow.producto_id} porque ya ha sido consumido en taller.`,
            400,
            "PRODUCTO_YA_CONSUMIDO"
          );
        }
      }
    }
  }

  for (const [exId, exRow] of existingMap.entries()) {
    if (!incomingIdSet.has(exId) && exRow.utilizado) {
      throw new WorkshopReservationError(
        `No se puede eliminar el repuesto #${exRow.producto_id} porque ya ha sido consumido en taller. Revierta el consumo primero.`,
        400,
        "PRODUCTO_YA_CONSUMIDO"
      );
    }
  }

  // 3. Compute net reservation delta per (producto_id, almacen_id)
  // Only for unconsumed lines! Consumed lines have already decremented reservation on consume.
  const deltaMap = new Map<string, { producto_id: number; almacen_id: number; netDelta: number }>();

  const getDeltaEntry = (pId: number, aId: number) => {
    const key = `${pId}_${aId}`;
    if (!deltaMap.has(key)) {
      deltaMap.set(key, { producto_id: pId, almacen_id: aId, netDelta: 0 });
    }
    return deltaMap.get(key)!;
  };

  // 3a. Account for deleted unconsumed lines (negative delta)
  for (const [exId, exRow] of existingMap.entries()) {
    if (!incomingIdSet.has(exId) && !exRow.utilizado) {
      const pId = Number(exRow.producto_id);
      const aId = Number(exRow.almacen_id);
      const oldQty = parseFloat(String(exRow.cantidad));
      const entry = getDeltaEntry(pId, aId);
      entry.netDelta = Math.round((entry.netDelta - oldQty) * 100) / 100;
    }
  }

  // 3b. Account for updated and inserted unconsumed lines
  const normalizedIncoming: Array<{
    orden_producto_id?: number | null;
    producto_id: number;
    almacen_id: number;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    observacion: string | null;
  }> = [];

  for (const p of incomingProducts) {
    const pId = parseInt(String(p.producto_id), 10);
    const qty = parseFloat(String(p.cantidad));

    if (isNaN(pId) || pId <= 0 || isNaN(qty) || qty <= 0) continue;

    const opId = p.orden_producto_id ? Number(p.orden_producto_id) : null;
    const existingRow = opId ? existingMap.get(opId) : null;

    let almId: number;
    if (existingRow?.almacen_id) {
      almId = Number(existingRow.almacen_id);
    } else if (p.almacen_id !== undefined && p.almacen_id !== null && String(p.almacen_id).trim() !== "") {
      const parsedAlm = parseInt(String(p.almacen_id), 10);
      if (isNaN(parsedAlm) || parsedAlm <= 0) {
        throw new WorkshopReservationError(`Almacén inválido para producto #${pId}.`, 400, "INVALID_WAREHOUSE");
      }
      almId = parsedAlm;
    } else {
      const defAlm = await resolveDefaultWarehouse(client, empresaId, pId);
      almId = defAlm.almacen_id;
    }

    // Validate decimal allowance
    const prodCheck = await client.query(
      `SELECT p.producto_id, p.nombre, p.precio_venta, p.estado,
              COALESCE(um.permite_decimales, false) AS permite_decimales,
              um.codigo AS unidad_medida
       FROM admin.productos p
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       WHERE p.producto_id = $1`,
      [pId]
    );

    if (!prodCheck.rows.length) {
      throw new WorkshopReservationError(`El producto #${pId} no existe.`, 404, "PRODUCT_NOT_FOUND");
    }

    const prodInfo = prodCheck.rows[0];
    if (!prodInfo.permite_decimales && !Number.isInteger(qty)) {
      throw new WorkshopReservationError(
        `El producto "${prodInfo.nombre}" no permite cantidades decimales.`,
        400,
        "DECIMALS_NOT_ALLOWED"
      );
    }

    const pu =
      p.precio_unitario !== undefined &&
      p.precio_unitario !== null &&
      p.precio_unitario !== "" &&
      !isNaN(Number(p.precio_unitario))
        ? Number(p.precio_unitario)
        : Number(prodInfo.precio_venta || 0);

    const sub = Math.round(qty * pu * 100) / 100;

    normalizedIncoming.push({
      orden_producto_id: opId,
      producto_id: pId,
      almacen_id: almId,
      cantidad: qty,
      precio_unitario: pu,
      subtotal: sub,
      observacion: p.observacion ? String(p.observacion).trim() : null
    });

    if (!existingRow || !existingRow.utilizado) {
      const oldQty = existingRow ? parseFloat(String(existingRow.cantidad)) : 0;
      const delta = Math.round((qty - oldQty) * 100) / 100;
      const entry = getDeltaEntry(pId, almId);
      entry.netDelta = Math.round((entry.netDelta + delta) * 100) / 100;
    }
  }

  // 4. Deterministic locking of affected existences: producto_id ASC, almacen_id ASC
  const affectedKeys = Array.from(deltaMap.values())
    .filter((e) => Math.abs(e.netDelta) > 0.0001)
    .sort((a, b) => (a.producto_id !== b.producto_id ? a.producto_id - b.producto_id : a.almacen_id - b.almacen_id));

  for (const pair of affectedKeys) {
    const exRes = await client.query(
      `SELECT existencia_producto_id, empresa_id, producto_id, almacen_id,
              cantidad_actual, cantidad_reservada,
              (cantidad_actual - cantidad_reservada) AS disponible
       FROM admin.existencias_producto
       WHERE empresa_id = $1 AND producto_id = $2 AND almacen_id = $3
       FOR UPDATE`,
      [empresaId, pair.producto_id, pair.almacen_id]
    );

    if (!exRes.rows.length) {
      if (pair.netDelta > 0) {
        throw new WorkshopReservationError(
          `No hay existencia disponible para reservar el producto #${pair.producto_id} en el almacén #${pair.almacen_id}.`,
          409,
          "STOCK_INSUFICIENTE",
          {
            stockActual: 0,
            cantidadReservada: 0,
            cantidadDisponible: 0,
            cantidadSolicitada: pair.netDelta,
            productoId: pair.producto_id,
            almacenId: pair.almacen_id
          }
        );
      }
      continue;
    }

    const ex = exRes.rows[0];
    const stockActual = parseFloat(ex.cantidad_actual || "0");
    const cantidadReservada = parseFloat(ex.cantidad_reservada || "0");
    const cantidadDisponible = Math.round((stockActual - cantidadReservada) * 100) / 100;

    if (pair.netDelta > 0 && pair.netDelta > cantidadDisponible) {
      throw new WorkshopReservationError(
        `Stock insuficiente para incrementar la reserva del producto #${pair.producto_id}. Disponible: ${cantidadDisponible}, Solicitado adicional: ${pair.netDelta}.`,
        409,
        "STOCK_INSUFICIENTE",
        {
          stockActual,
          cantidadReservada,
          cantidadDisponible,
          cantidadSolicitada: pair.netDelta,
          productoId: pair.producto_id,
          almacenId: pair.almacen_id
        }
      );
    }

    // Apply net delta to cantidad_reservada
    const newReservada = Math.max(0, Math.round((cantidadReservada + pair.netDelta) * 100) / 100);
    await client.query(
      `UPDATE admin.existencias_producto
       SET cantidad_reservada = $1,
           fecha_actualizacion = CURRENT_TIMESTAMP,
           usuario_actualizacion = $2
       WHERE existencia_producto_id = $3`,
      [newReservada, usuarioId, ex.existencia_producto_id]
    );
  }

  // 5. Update, insert, and delete records in admin.orden_productos
  for (const item of normalizedIncoming) {
    if (item.orden_producto_id && existingMap.has(item.orden_producto_id)) {
      await client.query(
        `UPDATE admin.orden_productos
         SET cantidad = $1, precio_unitario = $2, subtotal = $3, observacion = $4,
             fecha_actualizacion = NOW(), usuario_actualizacion = $5
         WHERE orden_producto_id = $6 AND orden_trabajo_id = $7`,
        [item.cantidad, item.precio_unitario, item.subtotal, item.observacion, usuarioId, item.orden_producto_id, ordenTrabajoId]
      );
    } else {
      await client.query(
        `INSERT INTO admin.orden_productos (
          orden_trabajo_id, orden_servicio_id, producto_id, almacen_id, cantidad,
          precio_unitario, porcentaje_descuento, valor_descuento, subtotal,
          estado_aprobacion_id, utilizado, observacion, fecha_registro, usuario_registro
        ) VALUES (
          $1, NULL, $2, $3, $4, $5, 0, 0, $6, 1, false, $7, NOW(), $8
        )`,
        [
          ordenTrabajoId,
          item.producto_id,
          item.almacen_id,
          item.cantidad,
          item.precio_unitario,
          item.subtotal,
          item.observacion,
          usuarioId
        ]
      );
    }
  }

  for (const [exId, exRow] of existingMap.entries()) {
    if (!incomingIdSet.has(exId) && !exRow.utilizado) {
      await client.query(
        `DELETE FROM admin.orden_productos
         WHERE orden_producto_id = $1 AND orden_trabajo_id = $2`,
        [exId, ordenTrabajoId]
      );
    }
  }

  // 6. Recalculate totals
  await recalculateWorkOrderTotals(client, ordenTrabajoId, usuarioId);
}
