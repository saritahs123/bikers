import { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import crypto from "crypto";
import { ValidacionInventarioError } from "./inventoryMovementService";

export interface IdempotencyExecutionResult<T = any> {
  statusCode: number;
  data: T;
  replayed: boolean;
}

export interface ExecuteWithIdempotencyParams<T> {
  empresaId: number;
  usuarioId: number;
  tipoOperacion:
    | "ENTRADA_INVENTARIO"
    | "SALIDA_MANUAL_INVENTARIO"
    | "AJUSTE_INVENTARIO"
    | "TRANSFERENCIA_INVENTARIO"
    | "INVENTARIO_INICIAL"
    | string;
  idempotencyKey?: string | null;
  requestPayload: any;
  operation: (client: PoolClient) => Promise<{
    statusCode: number;
    data: T;
    recursoId?: number | null;
  }>;
}

/**
 * Execute an inventory operation with atomic idempotency guarantees.
 * Everything runs inside a single PostgreSQL transaction (withTransaction):
 * 1. Locks/Checks admin.idempotencia_operacion for the given tenant key and operation type.
 * 2. If already COMPLETADO, immediately returns the cached response without running operation.
 * 3. If EN_PROCESO, rejects concurrent duplicate requests with 409 conflict.
 * 4. Otherwise, creates the pending record, executes the operation using the transactional client,
 *    updates the idempotency record to COMPLETADO with response JSON and status code, and commits atomically.
 * 5. On failure, transaction rolls back completely (no movements committed, no completed idempotency record).
 */
export async function executeWithIdempotency<T>(
  params: ExecuteWithIdempotencyParams<T>
): Promise<IdempotencyExecutionResult<T>> {
  const {
    empresaId,
    usuarioId,
    tipoOperacion,
    idempotencyKey,
    requestPayload,
    operation,
  } = params;

  // If no idempotency key was supplied, execute operation in a standard transaction
  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    return withTransaction(async (client) => {
      const res = await operation(client);
      return {
        statusCode: res.statusCode,
        data: res.data,
        replayed: false,
      };
    });
  }

  const cleanKey = String(idempotencyKey).trim();
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(requestPayload || {}))
    .digest("hex");

  return withTransaction(async (client) => {
    // 1. Lock existing idempotency row if exists
    const checkRes = await client.query(
      `SELECT idempotencia_id, estado, codigo_http, respuesta_json, request_hash
       FROM admin.idempotencia_operacion
       WHERE empresa_id = $1 AND clave_idempotencia = $2 AND tipo_operacion = $3
       FOR UPDATE`,
      [Number(empresaId), cleanKey, tipoOperacion]
    );

    if (checkRes.rows && checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];

      if (existing.estado === "COMPLETADO") {
        return {
          statusCode: Number(existing.codigo_http) || 200,
          data: existing.respuesta_json as T,
          replayed: true,
        };
      }

      if (existing.estado === "EN_PROCESO") {
        throw new ValidacionInventarioError(
          "Una solicitud idéntica con esta misma clave de idempotencia se encuentra en proceso.",
          "OPERACION_EN_PROCESO",
          {
            empresaId,
            claveIdempotencia: cleanKey,
            tipoOperacion,
          }
        );
      }
    }

    // 2. Insert new idempotency tracking row in EN_PROCESO
    const insertRes = await client.query(
      `INSERT INTO admin.idempotencia_operacion (
         empresa_id,
         usuario_id,
         clave_idempotencia,
         tipo_operacion,
         request_hash,
         estado,
         fecha_creacion,
         fecha_actualizacion
       )
       VALUES ($1, $2, $3, $4, $5, 'EN_PROCESO', NOW(), NOW())
       RETURNING idempotencia_id`,
      [Number(empresaId), Number(usuarioId), cleanKey, tipoOperacion, requestHash]
    );

    const idempotenciaId = insertRes.rows[0].idempotencia_id;

    // 3. Execute business operation with the exact same transactional client
    const opResult = await operation(client);

    // 4. Update idempotency record to COMPLETADO with status and response payload
    await client.query(
      `UPDATE admin.idempotencia_operacion
       SET estado = 'COMPLETADO',
           codigo_http = $1,
           respuesta_json = $2,
           recurso_id = $3,
           fecha_actualizacion = NOW()
       WHERE idempotencia_id = $4`,
      [
        opResult.statusCode,
        JSON.stringify(opResult.data),
        opResult.recursoId ? Number(opResult.recursoId) : null,
        idempotenciaId,
      ]
    );

    return {
      statusCode: opResult.statusCode,
      data: opResult.data,
      replayed: false,
    };
  });
}
