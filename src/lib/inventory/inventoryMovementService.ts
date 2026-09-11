import { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import crypto from "crypto";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type TipoMovimientoCodigo =
  | "ENT_COMPRA"
  | "SAL_ORDEN"
  | "SAL_MANUAL"
  | "INV_INICIAL"
  | "AJU_POS"
  | "AJU_NEG"
  | "DEV_CLIENTE"
  | "DEV_PROVEEDOR"
  | "TRAS_SAL"
  | "TRAS_ENT"
  | string;

export type NaturalezaMovimiento = "ENTRADA" | "SALIDA";

export interface RegistrarMovimientoParams {
  client?: PoolClient;
  empresaId: number;
  usuarioId: number;
  tipoMovimientoCodigo: TipoMovimientoCodigo;
  productoId: number;
  almacenId: number;
  cantidad: number;
  costoUnitario?: number | null;
  ordenTrabajoId?: number | null;
  ordenServicioId?: number | null;
  ordenCompraId?: number | null;
  recepcionCompraId?: number | null;
  referencia?: string | null;
  observacion?: string | null;
  transferenciaUuid?: string | null;
  codigoMovimiento?: string | null;
}

export interface RegistrarMovimientoResult {
  success: boolean;
  movimientoId: number;
  productoId: number;
  almacenId: number;
  tipoMovimientoId: number;
  tipoMovimientoCodigo: string;
  naturaleza: NaturalezaMovimiento;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  stockAnterior: number;
  stockNuevo: number;
  costoPromedioAnterior: number;
  costoPromedioNuevo: number;
  transferenciaUuid?: string | null;
  codigoMovimiento?: string | null;
  fechaMovimiento: Date;
}

export interface TransferirInventarioParams {
  client?: PoolClient;
  empresaId: number;
  usuarioId: number;
  productoId: number;
  almacenOrigenId: number;
  almacenDestinoId: number;
  cantidad: number;
  referencia?: string | null;
  observacion?: string | null;
  transferenciaUuid?: string | null;
  codigoMovimiento?: string | null;
}

export interface TransferirInventarioResult {
  success: boolean;
  transferenciaUuid: string;
  codigoMovimiento?: string | null;
  productoId: number;
  almacenOrigenId: number;
  almacenDestinoId: number;
  cantidad: number;
  costoUnitario: number;
  movimientoSalida: RegistrarMovimientoResult;
  movimientoEntrada: RegistrarMovimientoResult;
}

// ============================================================================
// CUSTOM CONTROLLED ERROR CLASSES
// ============================================================================

export class InventoryError extends Error {
  code: string;
  status: number;
  details?: Record<string, any>;

  constructor(message: string, code = "INVENTORY_ERROR", status = 400, details?: Record<string, any>) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class StockInsuficienteError extends InventoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "STOCK_INSUFICIENTE", 400, details);
    this.name = "StockInsuficienteError";
  }
}

export class AlmacenNoEncontradoError extends InventoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "ALMACEN_NO_ENCONTRADO", 404, details);
    this.name = "AlmacenNoEncontradoError";
  }
}

export class ProductoNoEncontradoError extends InventoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "PRODUCTO_NO_ENCONTRADO", 404, details);
    this.name = "ProductoNoEncontradoError";
  }
}

export class ValidacionInventarioError extends InventoryError {
  constructor(message: string, code = "VALIDACION_INVENTARIO_ERROR", details?: Record<string, any>) {
    super(message, code, 400, details);
    this.name = "ValidacionInventarioError";
  }
}

export class AccesoDenegadoInventarioError extends InventoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "ACCESO_DENEGADO", 403, details);
    this.name = "AccesoDenegadoInventarioError";
  }
}

// ============================================================================
// CANONICAL INVENTORY SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Execute single inventory movement inside transactional scope.
 */
async function executeRegistrarMovimiento(
  client: PoolClient,
  params: RegistrarMovimientoParams
): Promise<RegistrarMovimientoResult> {
  const {
    empresaId,
    usuarioId,
    tipoMovimientoCodigo,
    productoId,
    almacenId,
    cantidad,
    costoUnitario = null,
    ordenTrabajoId = null,
    ordenServicioId = null,
    referencia = null,
    observacion = null,
    transferenciaUuid = null,
    codigoMovimiento = null,
  } = params;

  // 1. Validate basic inputs & Multitenancy requirement
  if (!empresaId || isNaN(Number(empresaId))) {
    throw new ValidacionInventarioError("El ID de empresa es obligatorio.", "EMPRESA_REQUERIDA");
  }
  if (!usuarioId || isNaN(Number(usuarioId))) {
    throw new ValidacionInventarioError("El ID de usuario es obligatorio.", "USUARIO_REQUERIDO");
  }
  if (!productoId || isNaN(Number(productoId))) {
    throw new ValidacionInventarioError("El ID de producto es obligatorio y debe ser numérico.", "PRODUCTO_REQUERIDO");
  }
  if (!almacenId || isNaN(Number(almacenId))) {
    throw new ValidacionInventarioError("El ID de almacén es obligatorio y debe ser numérico.", "ALMACEN_REQUERIDO");
  }
  if (!tipoMovimientoCodigo || !String(tipoMovimientoCodigo).trim()) {
    throw new ValidacionInventarioError("El código de tipo de movimiento es obligatorio.", "TIPO_MOVIMIENTO_REQUERIDO");
  }
  if (cantidad === undefined || cantidad === null || isNaN(Number(cantidad)) || Number(cantidad) <= 0 || !isFinite(Number(cantidad))) {
    throw new ValidacionInventarioError("La cantidad del movimiento debe ser un número positivo mayor a 0.", "CANTIDAD_INVALIDA", {
      cantidadRecibida: cantidad,
    });
  }

  const cantidadNum = Number(cantidad);

  // 2. Resolve Movement Type by Code (NOT hardcoded IDs)
  const cleanCodigo = String(tipoMovimientoCodigo).trim().toUpperCase();
  const tipoMovRes = await client.query(
    `SELECT tipo_movimiento_id, codigo, nombre, naturaleza, estado
     FROM admin.tipo_movimiento_inventario
     WHERE UPPER(TRIM(codigo)) = $1
     LIMIT 1`,
    [cleanCodigo]
  );

  if (!tipoMovRes.rows || tipoMovRes.rows.length === 0) {
    throw new ValidacionInventarioError(`Tipo de movimiento de inventario no reconocido: ${cleanCodigo}`, "TIPO_MOVIMIENTO_INVALIDO", {
      codigo: cleanCodigo,
    });
  }

  const tipoMov = tipoMovRes.rows[0];
  if (tipoMov.estado && String(tipoMov.estado).toUpperCase() === "INACTIVO") {
    throw new ValidacionInventarioError(`El tipo de movimiento '${cleanCodigo}' está inactivo.`, "TIPO_MOVIMIENTO_INACTIVO");
  }

  const naturaleza: NaturalezaMovimiento = String(tipoMov.naturaleza).toUpperCase() === "SALIDA" ? "SALIDA" : "ENTRADA";

  // 3. Resolve and validate Warehouse (admin.almacenes) + Multitenancy
  const almRes = await client.query(
    `SELECT a.almacen_id, a.codigo, a.nombre, a.estado, a.empresa_id
     FROM admin.almacenes a
     WHERE a.almacen_id = $1
     LIMIT 1`,
    [Number(almacenId)]
  );

  if (!almRes.rows || almRes.rows.length === 0) {
    throw new AlmacenNoEncontradoError(`Almacén con ID ${almacenId} no encontrado.`, { almacenId });
  }

  const almacen = almRes.rows[0];
  if (Number(almacen.empresa_id) !== Number(empresaId)) {
    throw new AccesoDenegadoInventarioError(
      `Acceso denegado: El almacén '${almacen.nombre}' (ID: ${almacenId}) no pertenece a su empresa.`,
      { almacenId, empresaId, almacenEmpresaId: almacen.empresa_id }
    );
  }

  if (almacen.estado && String(almacen.estado).toUpperCase() === "INACTIVO") {
    throw new ValidacionInventarioError(`El almacén '${almacen.nombre}' (ID: ${almacenId}) se encuentra inactivo.`, "ALMACEN_INACTIVO");
  }

  // 4. Resolve Product and Unit of Measure (admin.productos & admin.unidad_medida) + Multitenancy
  const prodRes = await client.query(
    `SELECT
       p.producto_id,
       p.codigo_producto,
       p.nombre,
       p.costo_actual,
       p.precio_venta,
       p.estado,
       p.empresa_id,
       p.unidad_medida_id,
       um.codigo AS unidad_medida_codigo,
       um.nombre AS unidad_medida_nombre,
       COALESCE(um.permite_decimales, false) AS permite_decimales
     FROM admin.productos p
     LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
     WHERE p.producto_id = $1
     LIMIT 1`,
    [Number(productoId)]
  );

  if (!prodRes.rows || prodRes.rows.length === 0) {
    throw new ProductoNoEncontradoError(`Producto con ID ${productoId} no encontrado en el catálogo.`, { productoId });
  }

  const product = prodRes.rows[0];
  if (Number(product.empresa_id) !== Number(empresaId)) {
    throw new AccesoDenegadoInventarioError(
      `Acceso denegado: El producto '${product.nombre}' (ID: ${productoId}) no pertenece a su empresa.`,
      { productoId, empresaId, productoEmpresaId: product.empresa_id }
    );
  }

  if (product.estado && String(product.estado).toUpperCase() === "INACTIVO") {
    throw new ValidacionInventarioError(`El producto '${product.nombre}' (ID: ${productoId}) se encuentra inactivo.`, "PRODUCTO_INACTIVO");
  }

  // 5. Unit & Decimal Validation (strictly from BD admin.unidad_medida.permite_decimales)
  const permiteDecimales = Boolean(product.permite_decimales);
  if (!permiteDecimales) {
    if (!Number.isInteger(cantidadNum) || cantidadNum % 1 !== 0) {
      throw new ValidacionInventarioError(
        `La unidad de medida '${product.unidad_medida_codigo || "UND"}' no permite cantidades decimales. Cantidad recibida: ${cantidadNum}.`,
        "DECIMALES_NO_PERMITIDOS",
        {
          unidadMedida: product.unidad_medida_codigo,
          cantidad: cantidadNum,
        }
      );
    }
  }

  // 6. Concurrently Safe Row Locking (SELECT FOR UPDATE on existencias_producto)
  // Check if existence row exists; if not and it's ENTRADA, securely create it using PostgreSQL default nextval.
  let lockRes = await client.query(
    `SELECT
       existencia_producto_id,
       empresa_id,
       producto_id,
       almacen_id,
       cantidad_actual,
       COALESCE(cantidad_reservada, 0)::numeric AS cantidad_reservada,
       COALESCE(costo_promedio, 0)::numeric AS costo_promedio,
       estado
     FROM admin.existencias_producto
     WHERE producto_id = $1 AND almacen_id = $2 AND empresa_id = $3
     FOR UPDATE`,
    [Number(productoId), Number(almacenId), Number(empresaId)]
  );

  if (!lockRes.rows || lockRes.rows.length === 0) {
    if (naturaleza === "SALIDA") {
      throw new StockInsuficienteError(
        `Stock insuficiente para el producto '${product.nombre}' (ID: ${productoId}) en el almacén '${almacen.nombre}' (ID: ${almacenId}). Disponible: 0, Solicitado: ${cantidadNum}.`,
        {
          code: "STOCK_DISPONIBLE_INSUFICIENTE",
          cantidad_actual: 0,
          cantidad_reservada: 0,
          cantidad_disponible: 0,
          cantidad_solicitada: cantidadNum,
          cantidadActual: 0,
          cantidadReservada: 0,
          cantidadDisponible: 0,
          cantidadSolicitada: cantidadNum,
          productoId: Number(productoId),
          almacenId: Number(almacenId),
          productoNombre: product.nombre,
          almacenNombre: almacen.nombre,
        }
      );
    }

    // Secure UPSERT for ENTRADA without manual MAX(id)+1
    await client.query(
      `INSERT INTO admin.existencias_producto (
         empresa_id,
         producto_id,
         almacen_id,
         cantidad_actual,
         costo_promedio,
         estado,
         fecha_registro,
         usuario_registro
       )
       VALUES ($1, $2, $3, 0, 0, 'ACTIVO', NOW(), $4)
       ON CONFLICT (producto_id, almacen_id) DO NOTHING`,
      [Number(empresaId), Number(productoId), Number(almacenId), Number(usuarioId)]
    );

    // Re-lock the guaranteed existing row
    lockRes = await client.query(
      `SELECT
         existencia_producto_id,
         empresa_id,
         producto_id,
         almacen_id,
         cantidad_actual,
         COALESCE(cantidad_reservada, 0)::numeric AS cantidad_reservada,
         COALESCE(costo_promedio, 0)::numeric AS costo_promedio,
         estado
       FROM admin.existencias_producto
       WHERE producto_id = $1 AND almacen_id = $2 AND empresa_id = $3
       FOR UPDATE`,
      [Number(productoId), Number(almacenId), Number(empresaId)]
    );
  }

  const existencia = lockRes.rows[0];
  const stockAnterior = Number(existencia.cantidad_actual || 0);
  const stockReservado = Number(existencia.cantidad_reservada || 0);
  const costoPromedioAnterior = Number(existencia.costo_promedio || 0);

  let stockNuevo: number;
  let costoPromedioNuevo: number;
  let costoUnitarioMovimiento: number;

  // 7. Calculate Stock and Weighted Average Cost (PMP) per Warehouse
  if (naturaleza === "SALIDA") {
    // Audit physical consistency: cantidad_reservada cannot exceed cantidad_actual
    if (stockReservado > stockAnterior) {
      throw new StockInsuficienteError(
        `Inconsistencia de inventario: La cantidad reservada (${stockReservado}) supera el stock físico actual (${stockAnterior}) para el producto '${product.nombre}' (ID: ${productoId}) en el almacén '${almacen.nombre}' (ID: ${almacenId}). Operación bloqueada.`,
        {
          code: "INCONSISTENCIA_STOCK_RESERVADO",
          cantidad_actual: stockAnterior,
          cantidad_reservada: stockReservado,
          cantidad_disponible: stockAnterior - stockReservado,
          cantidad_solicitada: cantidadNum,
          cantidadActual: stockAnterior,
          cantidadReservada: stockReservado,
          cantidadDisponible: stockAnterior - stockReservado,
          cantidadSolicitada: cantidadNum,
          productoId: Number(productoId),
          almacenId: Number(almacenId),
          productoNombre: product.nombre,
          almacenNombre: almacen.nombre,
        }
      );
    }

    // Generic exit operations (SAL_MANUAL, AJU_NEG, TRAS_SAL, etc.) must respect reserved stock!
    const esSalidaGenerica = cleanCodigo !== "SAL_ORDEN";

    if (esSalidaGenerica) {
      const stockDisponible = Number((stockAnterior - stockReservado).toFixed(4));
      if (cantidadNum > stockDisponible) {
        throw new StockInsuficienteError(
          `Stock disponible insuficiente para el producto '${product.nombre}' (ID: ${productoId}) en el almacén '${almacen.nombre}' (ID: ${almacenId}). Stock actual: ${stockAnterior}, Reservado: ${stockReservado}, Disponible: ${stockDisponible}, Solicitado: ${cantidadNum}.`,
          {
            code: "STOCK_DISPONIBLE_INSUFICIENTE",
            cantidad_actual: stockAnterior,
            cantidad_reservada: stockReservado,
            cantidad_disponible: stockDisponible,
            cantidad_solicitada: cantidadNum,
            cantidadActual: stockAnterior,
            cantidadReservada: stockReservado,
            cantidadDisponible: stockDisponible,
            cantidadSolicitada: cantidadNum,
            productoId: Number(productoId),
            almacenId: Number(almacenId),
            productoNombre: product.nombre,
            almacenNombre: almacen.nombre,
          }
        );
      }
    } else {
      // SAL_ORDEN (for future Taller integration): validate total physical stock
      if (stockAnterior < cantidadNum) {
        throw new StockInsuficienteError(
          `Stock insuficiente para el producto '${product.nombre}' (ID: ${productoId}) en el almacén '${almacen.nombre}' (ID: ${almacenId}). Disponible: ${stockAnterior}, Solicitado: ${cantidadNum}.`,
          {
            code: "STOCK_INSUFICIENTE",
            cantidad_actual: stockAnterior,
            cantidad_reservada: stockReservado,
            cantidad_disponible: stockAnterior,
            cantidad_solicitada: cantidadNum,
            cantidadActual: stockAnterior,
            cantidadReservada: stockReservado,
            cantidadDisponible: stockAnterior,
            cantidadSolicitada: cantidadNum,
            productoId: Number(productoId),
            almacenId: Number(almacenId),
            productoNombre: product.nombre,
            almacenNombre: almacen.nombre,
          }
        );
      }
    }

    stockNuevo = Number((stockAnterior - cantidadNum).toFixed(4));

    // Post-operation invariant: after generic exit, cantidad_actual_nueva cannot be less than cantidad_reservada
    if (esSalidaGenerica && stockNuevo < stockReservado) {
      throw new StockInsuficienteError(
        `Operación rechazada: El stock resultante (${stockNuevo}) no puede quedar por debajo del stock reservado (${stockReservado}).`,
        {
          code: "STOCK_NUEVO_MENOR_RESERVADO",
          cantidad_actual: stockAnterior,
          cantidad_reservada: stockReservado,
          cantidad_disponible: stockAnterior - stockReservado,
          cantidad_solicitada: cantidadNum,
          cantidadActual: stockAnterior,
          cantidadReservada: stockReservado,
          cantidadDisponible: stockAnterior - stockReservado,
          cantidadSolicitada: cantidadNum,
          stockNuevo,
        }
      );
    }

    // For SALIDA: PMP of remaining stock in this warehouse is preserved intact!
    costoPromedioNuevo = costoPromedioAnterior > 0 ? costoPromedioAnterior : Number(product.costo_actual || 0);
    // Movement unit cost records current warehouse PMP
    costoUnitarioMovimiento = costoPromedioNuevo;
  } else {
    // ENTRADA
    // Special validations for INV_INICIAL (Saldo de apertura inicial)
    if (cleanCodigo === "INV_INICIAL") {
      const histCheck = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM admin.movimientos_inventario
         WHERE producto_id = $1 AND almacen_id = $2 AND empresa_id = $3`,
        [Number(productoId), Number(almacenId), Number(empresaId)]
      );
      const movCount = histCheck.rows[0]?.count || 0;
      if (movCount > 0) {
        throw new ValidacionInventarioError(
          `Este producto ya posee historial de inventario en este almacén (${movCount} movimiento(s)). Utiliza Ajuste de Inventario.`,
          "HISTORIAL_PREVIO_EXISTE",
          { productoId: Number(productoId), almacenId: Number(almacenId), movCount }
        );
      }

      if (stockReservado > 0) {
        throw new ValidacionInventarioError(
          `No se puede registrar inventario inicial sobre una existencia con stock reservado (${stockReservado}).`,
          "RESERVA_PREVIA_EXISTE",
          { productoId: Number(productoId), almacenId: Number(almacenId), stockReservado }
        );
      }

      if (stockAnterior > 0) {
        throw new ValidacionInventarioError(
          `El producto ya cuenta con stock registrado (${stockAnterior}) en este almacén. Utiliza Ajuste de Inventario.`,
          "STOCK_PREVIO_EXISTE",
          { productoId: Number(productoId), almacenId: Number(almacenId), stockAnterior }
        );
      }
    }

    stockNuevo = Number((stockAnterior + cantidadNum).toFixed(4));

    // Determine entry unit cost per policy
    let costoUnitarioEntrada: number;
    if (costoUnitario !== undefined && costoUnitario !== null && !isNaN(Number(costoUnitario)) && Number(costoUnitario) >= 0) {
      costoUnitarioEntrada = Number(costoUnitario);
    } else if (costoPromedioAnterior > 0) {
      costoUnitarioEntrada = costoPromedioAnterior;
    } else {
      costoUnitarioEntrada = Number(product.costo_actual || 0);
    }

    costoUnitarioMovimiento = costoUnitarioEntrada;

    // Recalculate PMP per warehouse:
    if (cleanCodigo === "INV_INICIAL" || stockAnterior <= 0 || costoPromedioAnterior <= 0) {
      costoPromedioNuevo = costoUnitarioEntrada;
    } else {
      const valorAnterior = stockAnterior * costoPromedioAnterior;
      const valorEntrada = cantidadNum * costoUnitarioEntrada;
      costoPromedioNuevo = Number(((valorAnterior + valorEntrada) / (stockAnterior + cantidadNum)).toFixed(2));
    }
  }

  // 8. Update Stock Balance in admin.existencias_producto
  await client.query(
    `UPDATE admin.existencias_producto
     SET
       cantidad_actual = $1,
       costo_promedio = $2,
       fecha_ultimo_movimiento = NOW(),
       fecha_actualizacion = NOW(),
       usuario_actualizacion = $3
     WHERE existencia_producto_id = $4 AND empresa_id = $5`,
    [stockNuevo, costoPromedioNuevo, Number(usuarioId), existencia.existencia_producto_id, Number(empresaId)]
  );

  // Note: Catalog master cost (admin.productos.costo_actual) is NOT modified automatically by warehouse entries
  // to maintain independent PMP across multi-warehouse environments.

  // 9. Insert Historical Kardex Movement in admin.movimientos_inventario
  const costoTotal = Number((cantidadNum * costoUnitarioMovimiento).toFixed(2));

  const insertMovRes = await client.query(
    `INSERT INTO admin.movimientos_inventario (
       empresa_id,
       producto_id,
       almacen_id,
       tipo_movimiento_id,
       cantidad,
       costo_unitario,
       costo_total,
       stock_anterior,
       stock_nuevo,
       orden_trabajo_id,
       orden_servicio_id,
       referencia,
       observacion,
       transferencia_uuid,
       codigo_movimiento,
       fecha_movimiento,
       usuario_movimiento,
       fecha_registro,
       usuario_registro
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, NOW(), $16
     )
     RETURNING movimiento_inventario_id, fecha_movimiento`,
    [
      Number(empresaId),
      Number(productoId),
      Number(almacenId),
      Number(tipoMov.tipo_movimiento_id),
      cantidadNum,
      costoUnitarioMovimiento,
      costoTotal,
      stockAnterior,
      stockNuevo,
      ordenTrabajoId ? Number(ordenTrabajoId) : null,
      ordenServicioId ? Number(ordenServicioId) : null,
      referencia ? String(referencia).trim() : null,
      observacion ? String(observacion).trim() : null,
      transferenciaUuid ? String(transferenciaUuid).trim() : null,
      codigoMovimiento ? String(codigoMovimiento).trim() : null,
      Number(usuarioId),
    ]
  );

  const movRow = insertMovRes.rows[0];

  return {
    success: true,
    movimientoId: movRow.movimiento_inventario_id,
    productoId: Number(productoId),
    almacenId: Number(almacenId),
    tipoMovimientoId: Number(tipoMov.tipo_movimiento_id),
    tipoMovimientoCodigo: cleanCodigo,
    naturaleza,
    cantidad: cantidadNum,
    costoUnitario: costoUnitarioMovimiento,
    costoTotal,
    stockAnterior,
    stockNuevo,
    costoPromedioAnterior,
    costoPromedioNuevo,
    transferenciaUuid: transferenciaUuid || null,
    codigoMovimiento: codigoMovimiento ? String(codigoMovimiento).trim() : null,
    fechaMovimiento: movRow.fecha_movimiento,
  };
}

/**
 * Public Canonical Function: registrarMovimientoInventario
 * Centralizes inventory transaction with row-locking, PMP calculation, and Kardex logging.
 * Reuses existing pg PoolClient without committing/rolling back externally,
 * or wraps execution in a standalone transaction if no client was passed.
 */
export async function registrarMovimientoInventario(
  params: RegistrarMovimientoParams
): Promise<RegistrarMovimientoResult> {
  if (params.client) {
    return executeRegistrarMovimiento(params.client, params);
  }

  return withTransaction(async (client) => {
    return executeRegistrarMovimiento(client, params);
  });
}

/**
 * Public Canonical Function: transferirInventario
 * Atomically transfers inventory between two warehouses with deterministic locking (ORDER BY almacen_id ASC)
 * to avoid deadlocks. Enforces same-tenant transfer policy and produces TRAS_SAL and TRAS_ENT with a shared UUID.
 */
export async function transferirInventario(
  params: TransferirInventarioParams
): Promise<TransferirInventarioResult> {
  const {
    empresaId,
    usuarioId,
    productoId,
    almacenOrigenId,
    almacenDestinoId,
    cantidad,
    referencia = null,
    observacion = null,
    transferenciaUuid: paramTransferenciaUuid = null,
    codigoMovimiento = null,
  } = params;

  if (!empresaId || isNaN(Number(empresaId))) {
    throw new ValidacionInventarioError("El ID de empresa es obligatorio para la transferencia.", "EMPRESA_REQUERIDA");
  }

  if (Number(almacenOrigenId) === Number(almacenDestinoId)) {
    throw new ValidacionInventarioError(
      "El almacén de origen y destino no pueden ser iguales.",
      "TRANSFERENCIA_MISMO_ALMACEN",
      { almacenOrigenId, almacenDestinoId }
    );
  }

  if (cantidad === undefined || cantidad === null || isNaN(Number(cantidad)) || Number(cantidad) <= 0 || !isFinite(Number(cantidad))) {
    throw new ValidacionInventarioError(
      "La cantidad a transferir debe ser un número positivo mayor a 0.",
      "CANTIDAD_INVALIDA",
      { cantidad }
    );
  }

  const runTransfer = async (client: PoolClient): Promise<TransferirInventarioResult> => {
    // 0. Multi-tenant Validation: Verify both warehouses exist and belong to the same session company
    const almsCheck = await client.query(
      `SELECT almacen_id, nombre, empresa_id FROM admin.almacenes WHERE almacen_id IN ($1, $2)`,
      [Number(almacenOrigenId), Number(almacenDestinoId)]
    );

    if (!almsCheck.rows || almsCheck.rows.length < 2) {
      throw new AlmacenNoEncontradoError("Uno o ambos almacenes especificados no existen.");
    }

    const almOrigen = almsCheck.rows.find(a => Number(a.almacen_id) === Number(almacenOrigenId));
    const almDestino = almsCheck.rows.find(a => Number(a.almacen_id) === Number(almacenDestinoId));

    if (!almOrigen || !almDestino) {
      throw new AlmacenNoEncontradoError("No se pudieron resolver ambos almacenes.");
    }

    if (
      Number(almOrigen.empresa_id) !== Number(empresaId) ||
      Number(almDestino.empresa_id) !== Number(empresaId) ||
      Number(almOrigen.empresa_id) !== Number(almDestino.empresa_id)
    ) {
      throw new ValidacionInventarioError(
        "No se permiten transferencias de inventario entre distintas empresas.",
        "CROSS_TENANT_TRANSFER_NOT_ALLOWED",
        {
          empresaId,
          almacenOrigenEmpresaId: almOrigen.empresa_id,
          almacenDestinoEmpresaId: almDestino.empresa_id,
        }
      );
    }

    // 1. Deadlock Prevention: Lock rows in deterministic sorted order
    const sortedAlmacenIds = [Number(almacenOrigenId), Number(almacenDestinoId)].sort((a, b) => a - b);

    for (const almId of sortedAlmacenIds) {
      // Ensure existence record exists safely with empresa_id
      await client.query(
        `INSERT INTO admin.existencias_producto (
           empresa_id,
           producto_id,
           almacen_id,
           cantidad_actual,
           costo_promedio,
           estado,
           fecha_registro,
           usuario_registro
         )
         VALUES ($1, $2, $3, 0, 0, 'ACTIVO', NOW(), $4)
         ON CONFLICT (producto_id, almacen_id) DO NOTHING`,
        [Number(empresaId), Number(productoId), almId, Number(usuarioId)]
      );

      // Lock row FOR UPDATE in deterministic ascending order
      await client.query(
        `SELECT existencia_producto_id, empresa_id, cantidad_actual, COALESCE(cantidad_reservada, 0)::numeric AS cantidad_reservada, costo_promedio
         FROM admin.existencias_producto
         WHERE producto_id = $1 AND almacen_id = $2 AND empresa_id = $3
         FOR UPDATE`,
        [Number(productoId), almId, Number(empresaId)]
      );
    }

    // 2. Correlation UUID for both legs (use passed uuid if batch operation)
    const transferenciaUuid = paramTransferenciaUuid || crypto.randomUUID();
    const cleanRef = referencia || `TRF-${transferenciaUuid.substring(0, 8).toUpperCase()}`;

    // 3. Step 1: TRAS_SAL on origin warehouse
    const salidaResult = await executeRegistrarMovimiento(client, {
      client,
      empresaId,
      usuarioId,
      tipoMovimientoCodigo: "TRAS_SAL",
      productoId,
      almacenId: almacenOrigenId,
      cantidad,
      referencia: cleanRef,
      observacion: observacion || `Transferencia hacia almacén ID ${almacenDestinoId}`,
      transferenciaUuid,
      codigoMovimiento,
    });

    // 4. Step 2: TRAS_ENT on destination warehouse using origin's PMP cost
    const entradaResult = await executeRegistrarMovimiento(client, {
      client,
      empresaId,
      usuarioId,
      tipoMovimientoCodigo: "TRAS_ENT",
      productoId,
      almacenId: almacenDestinoId,
      cantidad,
      costoUnitario: salidaResult.costoUnitario,
      referencia: cleanRef,
      observacion: observacion || `Transferencia desde almacén ID ${almacenOrigenId}`,
      transferenciaUuid,
      codigoMovimiento,
    });

    return {
      success: true,
      transferenciaUuid,
      codigoMovimiento,
      productoId: Number(productoId),
      almacenOrigenId: Number(almacenOrigenId),
      almacenDestinoId: Number(almacenDestinoId),
      cantidad: Number(cantidad),
      costoUnitario: salidaResult.costoUnitario,
      movimientoSalida: salidaResult,
      movimientoEntrada: entradaResult,
    };
  };

  if (params.client) {
    return runTransfer(params.client);
  }

  return withTransaction(async (txClient) => {
    return runTransfer(txClient);
  });
}
