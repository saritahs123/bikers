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
  // Lock order and join state catalog & owner details
  const res = await client.query(`
    SELECT 
      ot.orden_trabajo_id,
      ot.estado_orden_id,
      ot.bicicleta_id,
      eot.codigo AS estado_codigo,
      u.empresa_id AS empresa_id
    FROM admin.ordenes_trabajo ot
    JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
    JOIN admin.usuario u ON ot.usuario_registro = u.usuario_id
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
          error: "ORDER_NOT_FOUND",
          message: "La orden de trabajo no existe o está inactiva."
        },
        { status: 404 }
      )
    };
  }

  const order = res.rows[0];

  // Company check
  if (order.empresa_id == null || empresaId == null || Number(order.empresa_id) !== Number(empresaId)) {
    return {
      isValid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN_COMPANY",
          message: "No posee permisos para acceder a esta orden de trabajo."
        },
        { status: 403 }
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
