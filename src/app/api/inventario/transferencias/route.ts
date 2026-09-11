import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  transferirInventario,
  InventoryError,
} from "@/lib/inventory/inventoryMovementService";
import {
  INVENTORY_SYSTEM_CODES,
  generarCodigoMovimiento,
} from "@/lib/inventory/inventoryConstants";
import crypto from "crypto";

// GET /api/inventario/transferencias - Últimas transferencias registradas
export async function GET(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar transferencias." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 10), 50);

    // Obtener las transferencias agrupadas por su UUID compartido
    const rows = await query(
      `SELECT
         m_sal.transferencia_uuid,
         m_sal.codigo_movimiento,
         m_sal.fecha_movimiento,
         m_sal.cantidad::numeric AS cantidad,
         m_sal.referencia,
         p.producto_id,
         p.codigo_producto,
         p.nombre AS producto_nombre,
         alm_org.almacen_id AS origen_id,
         alm_org.codigo AS origen_codigo,
         alm_org.nombre AS origen_nombre,
         alm_dst.almacen_id AS destino_id,
         alm_dst.codigo AS destino_codigo,
         alm_dst.nombre AS destino_nombre,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(ui.nombre, ''), ' ', COALESCE(ui.apellido, ''))), ''), ui.correo_electronico, 'Sistema') AS usuario_nombre
       FROM admin.movimientos_inventario m_sal
       JOIN admin.movimientos_inventario m_ent
         ON m_sal.transferencia_uuid = m_ent.transferencia_uuid
         AND m_ent.tipo_movimiento_id = (SELECT tipo_movimiento_id FROM admin.tipo_movimiento_inventario WHERE codigo = 'TRAS_ENT')
       JOIN admin.productos p ON m_sal.producto_id = p.producto_id
       JOIN admin.almacenes alm_org ON m_sal.almacen_id = alm_org.almacen_id
       JOIN admin.almacenes alm_dst ON m_ent.almacen_id = alm_dst.almacen_id
       LEFT JOIN admin.usuario u ON m_sal.usuario_movimiento = u.usuario_id
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE m_sal.empresa_id = $1
         AND m_sal.tipo_movimiento_id = (SELECT tipo_movimiento_id FROM admin.tipo_movimiento_inventario WHERE codigo = 'TRAS_SAL')
       ORDER BY m_sal.fecha_movimiento DESC
       LIMIT $2`,
      [empresaId, limit]
    );

    return NextResponse.json({
      transferencias: (rows || []).map((r: any) => ({
        uuid: r.transferencia_uuid,
        codigoMovimiento: r.codigo_movimiento || "-",
        fecha: r.fecha_movimiento,
        productoCodigo: r.codigo_producto,
        productoNombre: r.producto_nombre,
        origenCodigo: r.origen_codigo,
        origenNombre: r.origen_nombre,
        destinoCodigo: r.destino_codigo,
        destinoNombre: r.destino_nombre,
        cantidad: Number(r.cantidad || 0),
        referencia: r.referencia || "-",
        usuario: r.usuario_nombre || "Sistema",
      })),
    });
  } catch (error: any) {
    console.error("Error en GET /api/inventario/transferencias:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al consultar transferencias." },
      { status: 500 }
    );
  }
}

// POST /api/inventario/transferencias - Ejecutar transferencia entre almacenes (Multiproducto Atómica)
export async function POST(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para transferir inventario." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      almacenOrigenId,
      almacenDestinoId,
      referencia,
      observacion,
      lineas,
      // Legacy single-line fallback
      productoId,
      cantidad,
    } = body;

    const empresaId = session.empresa_id;
    const usuarioId = session.usuario_id;
    const idempotencyKey = request.headers.get("x-idempotency-key") || body.idempotencyKey;

    if (!almacenOrigenId || !almacenDestinoId) {
      return NextResponse.json(
        { error: "ALMACENES_REQUERIDOS", message: "Los almacenes de origen y destino son obligatorios." },
        { status: 400 }
      );
    }
    if (Number(almacenOrigenId) === Number(almacenDestinoId)) {
      return NextResponse.json(
        { error: "MISMO_ALMACEN", message: "El almacén de origen y destino deben ser distintos." },
        { status: 400 }
      );
    }

    // Normalizar líneas de la transferencia
    let lineasToProcess: Array<{
      productoId: number;
      cantidad: number;
      referencia?: string | null;
    }> = [];

    if (Array.isArray(lineas) && lineas.length > 0) {
      lineasToProcess = lineas.map((l: any) => ({
        productoId: Number(l.productoId),
        cantidad: Number(l.cantidad),
        referencia: l.referencia ? String(l.referencia).trim() : null,
      }));
    } else if (productoId && cantidad) {
      lineasToProcess = [
        {
          productoId: Number(productoId),
          cantidad: Number(cantidad),
          referencia: referencia ? String(referencia).trim() : null,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "LINEAS_REQUERIDAS", message: "Debe incluir al menos una línea de producto a transferir." },
        { status: 400 }
      );
    }

    // Validar duplicados en el lote de transferencia
    const seenProds = new Set<number>();
    for (let i = 0; i < lineasToProcess.length; i++) {
      const line = lineasToProcess[i];
      if (!line.productoId || isNaN(line.productoId)) {
        return NextResponse.json(
          { error: "PRODUCTO_REQUERIDO", message: `La línea #${i + 1} no tiene un producto válido.` },
          { status: 400 }
        );
      }
      if (seenProds.has(line.productoId)) {
        return NextResponse.json(
          {
            error: "PRODUCTO_DUPLICADO",
            message: `El producto ID ${line.productoId} aparece más de una vez en la transferencia. Consolide la cantidad en una sola línea.`,
          },
          { status: 400 }
        );
      }
      seenProds.add(line.productoId);

      if (isNaN(line.cantidad) || line.cantidad <= 0) {
        return NextResponse.json(
          { error: "CANTIDAD_INVALIDA", message: `La cantidad en la línea #${i + 1} debe ser mayor a 0.` },
          { status: 400 }
        );
      }
    }

    // Orden determinista para evitar deadlocks: producto_id ASC
    lineasToProcess.sort((a, b) => a.productoId - b.productoId);

    // Ejecutar transferencia con idempotencia atómica, único codigo_movimiento y único transferencia_uuid compartido
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: "TRANSFERENCIA_INVENTARIO",
      idempotencyKey,
      requestPayload: {
        almacenOrigenId,
        almacenDestinoId,
        lineas: lineasToProcess,
        referencia,
        observacion,
      },
      operation: async (client) => {
        // Generar código de sistema de la operación (código 9 = Transferencia de Inventario)
        const codigoMovimiento = await generarCodigoMovimiento(
          client,
          empresaId,
          INVENTORY_SYSTEM_CODES.TRANSFERENCIA
        );

        // Generar un único UUID para correlacionar todas las líneas del lote de transferencia
        const transferenciaUuid = crypto.randomUUID();
        const batchRef = referencia ? String(referencia).trim() : `TRF-${transferenciaUuid.substring(0, 8).toUpperCase()}`;

        const transferenciasResult: any[] = [];

        for (const line of lineasToProcess) {
          const lineRef = line.referencia || batchRef;

          const transferRes = await transferirInventario({
            client,
            empresaId,
            usuarioId,
            productoId: line.productoId,
            almacenOrigenId: Number(almacenOrigenId),
            almacenDestinoId: Number(almacenDestinoId),
            cantidad: line.cantidad,
            referencia: lineRef,
            observacion: observacion ? String(observacion).trim() : null,
            transferenciaUuid,
            codigoMovimiento,
          });

          transferenciasResult.push(transferRes);
        }

        return {
          statusCode: 201,
          data: {
            success: true,
            codigoMovimiento,
            transferenciaUuid,
            totalLineas: transferenciasResult.length,
            transferencias: transferenciasResult,
            mensaje: `Transferencia de inventario realizada exitosamente con código ${codigoMovimiento}.`,
          },
          recursoId: transferenciasResult[0]?.movimientoSalida?.movimientoId || null,
        };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    if (error instanceof InventoryError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          details: error.details,
        },
        { status: error.status || 400 }
      );
    }

    console.error("Error en POST /api/inventario/transferencias:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Error al procesar la transferencia." },
      { status: 500 }
    );
  }
}
