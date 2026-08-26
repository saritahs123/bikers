/**
 * DEUDA TÉCNICA DOCUMENTADA:
 * La tabla admin.orden_servicio_mano_obra almacena tanto sesiones de control de tiempo del cronómetro
 * como registros de mano de obra facturable sin una columna discriminadora explícita (ej. tipo_registro).
 * Propuesta futura (pendiente de migración aprobada):
 * 1. Agregar columna `tipo_registro` (VARCHAR/ENUM: 'CRONOMETRO' | 'MANO_OBRA') en admin.orden_servicio_mano_obra, O
 * 2. Mover las sesiones del cronómetro a una tabla dedicada admin.orden_servicio_cronometro.
 */

export interface FinancialSummary {
  subtotal_servicios: number;
  subtotal_mano_obra: number;
  subtotal_productos: number;
  subtotal_repuestos: number;
  descuento_servicios: number;
  descuento_productos: number;
  otros_descuentos: number;
  subtotal_bruto: number;
  subtotal_neto: number;
  impuesto: number;
  total_orden: number;
}

export type QueryExecutor = {
  query: (sql: string, params?: any[]) => Promise<any>;
};

export async function recalculateWorkOrderTotals(
  executor: QueryExecutor,
  ordenId: number,
  usuarioId?: number
): Promise<FinancialSummary> {
  const calcSql = `
    WITH servicios_totales AS (
      SELECT 
        COALESCE(SUM(COALESCE(subtotal, cantidad * precio_unitario, 0)), 0)::numeric AS subtotal_servicios,
        COALESCE(SUM(COALESCE(valor_descuento, 0)), 0)::numeric AS descuento_servicios
      FROM admin.orden_servicios
      WHERE orden_trabajo_id = $1 AND (activo IS DISTINCT FROM false)
    ),
    mano_obra_total AS (
      SELECT 
        COALESCE(SUM(mo.costo_total), 0)::numeric AS subtotal_mano_obra
      FROM admin.orden_servicio_mano_obra mo
      JOIN admin.orden_servicios s ON mo.orden_servicio_id = s.orden_servicio_id
      WHERE s.orden_trabajo_id = $1 
        AND (mo.activo IS DISTINCT FROM false) 
        AND (s.activo IS DISTINCT FROM false)
        AND mo.detalle_mano_obra IS NOT NULL
        AND BTRIM(mo.detalle_mano_obra) <> ''
    ),
    productos_totales AS (
      SELECT 
        COALESCE(SUM(subtotal), 0)::numeric AS subtotal_productos,
        COALESCE(SUM(valor_descuento), 0)::numeric AS descuento_productos
      FROM admin.orden_productos
      WHERE orden_trabajo_id = $1
    ),
    orden_descuentos AS (
      SELECT 
        COALESCE(descuento_servicios, 0)::numeric AS otros_descuentos
      FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1
    )
    SELECT 
      ROUND(s.subtotal_servicios, 2) AS subtotal_servicios,
      ROUND(s.descuento_servicios, 2) AS descuento_servicios,
      ROUND(m.subtotal_mano_obra, 2) AS subtotal_mano_obra,
      ROUND(p.subtotal_productos, 2) AS subtotal_productos,
      ROUND(p.descuento_productos, 2) AS descuento_productos,
      ROUND(o.otros_descuentos, 2) AS otros_descuentos,
      ROUND(s.subtotal_servicios + m.subtotal_mano_obra + p.subtotal_productos, 2) AS subtotal_bruto,
      ROUND((s.subtotal_servicios + m.subtotal_mano_obra + p.subtotal_productos) - (s.descuento_servicios + p.descuento_productos + o.otros_descuentos), 2) AS subtotal_neto,
      0.00 AS impuesto,
      ROUND((s.subtotal_servicios + m.subtotal_mano_obra + p.subtotal_productos) - (s.descuento_servicios + p.descuento_productos + o.otros_descuentos), 2) AS total_orden
    FROM servicios_totales s, mano_obra_total m, productos_totales p, orden_descuentos o
  `;

  const res = await executor.query(calcSql, [ordenId]);
  const row = res.rows ? res.rows[0] : (Array.isArray(res) ? res[0] : res);

  const summary: FinancialSummary = {
    subtotal_servicios: parseFloat(row?.subtotal_servicios || "0"),
    subtotal_mano_obra: parseFloat(row?.subtotal_mano_obra || "0"),
    subtotal_productos: parseFloat(row?.subtotal_productos || "0"),
    subtotal_repuestos: parseFloat(row?.subtotal_productos || "0"),
    descuento_servicios: parseFloat(row?.descuento_servicios || "0"),
    descuento_productos: parseFloat(row?.descuento_productos || "0"),
    otros_descuentos: parseFloat(row?.otros_descuentos || "0"),
    subtotal_bruto: parseFloat(row?.subtotal_bruto || "0"),
    subtotal_neto: parseFloat(row?.subtotal_neto || "0"),
    impuesto: 0,
    total_orden: parseFloat(row?.total_orden || "0"),
  };

  const timeRes = await executor.query(`
    SELECT COALESCE(SUM(COALESCE(os.tiempo_transcurrido, 0)), 0)::bigint AS total_segundos
    FROM admin.orden_servicios os
    WHERE os.orden_trabajo_id = $1
      AND os.activo IS DISTINCT FROM false
  `, [ordenId]);

  const timeRow = timeRes.rows ? timeRes.rows[0] : (Array.isArray(timeRes) ? timeRes[0] : null);
  const totalSegundos = parseInt(timeRow?.total_segundos || "0", 10);

  const params = [
    summary.subtotal_servicios,
    summary.subtotal_productos,
    summary.subtotal_bruto,
    summary.total_orden,
    totalSegundos,
    ordenId
  ];

  let updateSql = `
    UPDATE admin.ordenes_trabajo
    SET 
      subtotal_servicios = $1,
      subtotal_productos = $2,
      subtotal_general = $3,
      impuesto = 0.00,
      total_orden = $4,
      total_tiempo_transcurrido = $5,
      fecha_actualizacion = NOW()
  `;

  if (usuarioId !== undefined) {
    updateSql += `, usuario_actualizacion = $7`;
    params.push(usuarioId);
  }

  updateSql += ` WHERE orden_trabajo_id = $6`;

  await executor.query(updateSql, params);

  return summary;
}
