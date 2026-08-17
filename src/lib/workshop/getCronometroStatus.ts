import { QueryExecutor } from "./recalculateWorkOrderTotals";

export interface CronometroStatus {
  activo: boolean;
  fecha_inicio_sesion: string | null;
  segundos_sesion_actual: number;
  segundos_acumulados: number;
  segundos_totales: number;
}

/**
 * Consulta el estado y los segundos exactos acumulados del cronómetro para un servicio.
 * Opera exclusivamente sobre sesiones técnicas (detalle_mano_obra IS NULL AND observacion IS NULL).
 */
export async function getCronometroStatus(
  executor: QueryExecutor,
  ordenServicioId: number
): Promise<CronometroStatus> {
  // 1. Consulta de la sesión técnica abierta más reciente
  const activeSql = `
    SELECT orden_servicio_mano_obra_id, fecha_inicio
    FROM admin.orden_servicio_mano_obra
    WHERE orden_servicio_id = $1
      AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
      AND (observacion IS NULL OR BTRIM(observacion) = '')
      AND fecha_inicio IS NOT NULL
      AND fecha_finalizacion IS NULL
      AND (activo IS DISTINCT FROM false)
    ORDER BY orden_servicio_mano_obra_id DESC
    LIMIT 1
  `;
  const activeRes = await executor.query(activeSql, [ordenServicioId]);
  const activeRow = activeRes.rows ? activeRes.rows[0] : (Array.isArray(activeRes) ? activeRes[0] : null);

  // 2. Consulta de segundos acumulados de sesiones técnicas cerradas (precisión en segundos desde epoch)
  const closedSql = `
    SELECT COALESCE(
      SUM(
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (fecha_finalizacion - fecha_inicio)))
        )
      ),
      0
    )::int AS segundos_acumulados
    FROM admin.orden_servicio_mano_obra
    WHERE orden_servicio_id = $1
      AND (detalle_mano_obra IS NULL OR BTRIM(detalle_mano_obra) = '')
      AND (observacion IS NULL OR BTRIM(observacion) = '')
      AND fecha_inicio IS NOT NULL
      AND fecha_finalizacion IS NOT NULL
      AND (activo IS DISTINCT FROM false)
  `;
  const closedRes = await executor.query(closedSql, [ordenServicioId]);
  const closedRow = closedRes.rows ? closedRes.rows[0] : (Array.isArray(closedRes) ? closedRes[0] : null);

  const segundosAcumulados = Number(closedRow?.segundos_acumulados || 0);

  if (activeRow && activeRow.fecha_inicio) {
    const fechaInicioDate = new Date(activeRow.fecha_inicio);
    const fechaInicioIso = fechaInicioDate.toISOString();
    const segundosSesionActual = Math.max(0, Math.floor((Date.now() - fechaInicioDate.getTime()) / 1000));
    const segundosTotales = segundosAcumulados + segundosSesionActual;

    return {
      activo: true,
      fecha_inicio_sesion: fechaInicioIso,
      segundos_sesion_actual: segundosSesionActual,
      segundos_acumulados: segundosAcumulados,
      segundos_totales: segundosTotales
    };
  }

  return {
    activo: false,
    fecha_inicio_sesion: null,
    segundos_sesion_actual: 0,
    segundos_acumulados: segundosAcumulados,
    segundos_totales: segundosAcumulados
  };
}
