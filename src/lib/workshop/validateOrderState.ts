import { PoolClient } from "pg";
import { NextResponse } from "next/server";

export interface StateValidationResult {
  isValid: boolean;
  response?: NextResponse;
  order?: any;
}

export async function validateOrderInRepair(
  client: PoolClient,
  ordenTrabajoId: number,
  empresaId: number,
  accion: string
): Promise<StateValidationResult> {
  // Lock order and join state catalog & canonical client company ownership
  const res = await client.query(`
    SELECT 
      ot.orden_trabajo_id,
      ot.estado_orden_id,
      ot.bicicleta_id,
      eot.codigo AS estado_codigo,
      c.empresa_id AS empresa_id
    FROM admin.ordenes_trabajo ot
    JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
    JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
    WHERE ot.orden_trabajo_id = $1
      AND ot.activo = true
    FOR UPDATE OF ot
  `, [ordenTrabajoId]);

  if (res.rows.length === 0) {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "NOT_FOUND",
          message: "La orden de trabajo no existe o está inactiva."
        },
        { status: 404 }
      )
    };
  }

  const order = res.rows[0];

  // Canonical Company Isolation Check (returns 404 to avoid existence leakage)
  if (order.empresa_id == null || empresaId == null || Number(order.empresa_id) !== Number(empresaId)) {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "NOT_FOUND",
          message: "La orden de trabajo no existe o no pertenece a su empresa."
        },
        { status: 404 }
      )
    };
  }

  const estadoCodigo = String(order.estado_codigo || "").trim().toUpperCase();

  if (estadoCodigo !== "REPARACION") {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "ORDER_NOT_IN_REPAIR",
          message: "La orden debe estar en Reparación para modificar sus servicios o repuestos.",
          details: {
            estado_actual: estadoCodigo,
            accion: accion
          }
        },
        { status: 409 }
      )
    };
  }

  return { isValid: true, order };
}

export const CLOSED_SERVICE_STATUS_CODES = [
  "COMPLETADO",
  "FINALIZADO",
  "CANCELADO",
  "ANULADO",
  "INACTIVO"
] as const;

export function isServiceClosed(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmedUpper = String(code).trim().toUpperCase();
  return CLOSED_SERVICE_STATUS_CODES.includes(trimmedUpper as any);
}

export async function queryIncompleteServicesAndTimers(client: PoolClient, ordenTrabajoId: number) {
  // Query incomplete services with FOR SHARE
  const incompleteRes = await client.query(`
    SELECT
        os.orden_servicio_id,
        os.codigo_servicio,
        eos.codigo AS estado_servicio
    FROM admin.orden_servicios os
    LEFT JOIN admin.estado_orden_servicio eos
      ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
    WHERE os.orden_trabajo_id = $1
      AND os.activo IS DISTINCT FROM false
      AND (
        eos.codigo IS NULL
        OR UPPER(TRIM(eos.codigo)) NOT IN (
          'COMPLETADO',
          'FINALIZADO',
          'CANCELADO',
          'ANULADO',
          'INACTIVO'
        )
      )
    FOR SHARE OF os;
  `, [ordenTrabajoId]);

  // Query active timer sessions
  const activeTimersRes = await client.query(`
    SELECT
        os.orden_servicio_id,
        os.codigo_servicio,
        'CON_SESION_ACTIVA' AS estado_servicio
    FROM admin.orden_servicio_mano_obra mo
    JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id
    WHERE os.orden_trabajo_id = $1
      AND mo.fecha_inicio IS NOT NULL
      AND mo.fecha_finalizacion IS NULL
      AND (mo.activo IS DISTINCT FROM false)
      AND (os.activo IS DISTINCT FROM false);
  `, [ordenTrabajoId]);

  const combinedIncomplete: any[] = [];
  const serviceIdSet = new Set<number>();

  for (const s of incompleteRes.rows || []) {
    const sId = Number(s.orden_servicio_id);
    combinedIncomplete.push({
      servicio_id: sId,
      codigo_servicio: s.codigo_servicio,
      estado: s.estado_servicio || "DESCONOCIDO"
    });
    serviceIdSet.add(sId);
  }

  for (const s of activeTimersRes.rows || []) {
    const sId = Number(s.orden_servicio_id);
    if (!serviceIdSet.has(sId)) {
      combinedIncomplete.push({
        servicio_id: sId,
        codigo_servicio: s.codigo_servicio,
        estado: "EN_PROCESO"
      });
      serviceIdSet.add(sId);
    }
  }

  return combinedIncomplete;
}
