import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  transferirInventario,
  InventoryError,
} from "@/lib/inventory/inventoryMovementService";

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

// POST /api/inventario/transferencias - Ejecutar transferencia entre almacenes
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
      productoId,
      cantidad,
      referencia,
      observacion,
    } = body;

    const empresaId = session.empresa_id;
    const usuarioId = session.usuario_id;
    const idempotencyKey = request.headers.get("x-idempotency-key") || body.idempotencyKey;

    if (!almacenOrigenId || !almacenDestinoId) {
      return NextResponse.json({ error: "ALMACENES_REQUERIDOS", message: "Los almacenes de origen y destino son obligatorios." }, { status: 400 });
    }
    if (Number(almacenOrigenId) === Number(almacenDestinoId)) {
      return NextResponse.json({ error: "MISMO_ALMACEN", message: "El almacén de origen y destino deben ser distintos." }, { status: 400 });
    }
    if (!productoId) {
      return NextResponse.json({ error: "PRODUCTO_REQUERIDO", message: "El producto es obligatorio." }, { status: 400 });
    }
    if (!cantidad || Number(cantidad) <= 0) {
      return NextResponse.json({ error: "CANTIDAD_INVALIDA", message: "La cantidad a transferir debe ser mayor a 0." }, { status: 400 });
    }

    // Ejecutar transferencia con idempotencia atómica
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: "TRANSFERENCIA_INVENTARIO",
      idempotencyKey,
      requestPayload: { almacenOrigenId, almacenDestinoId, productoId, cantidad, referencia },
      operation: async (client) => {
        const transferRes = await transferirInventario({
          client,
          empresaId,
          usuarioId,
          productoId: Number(productoId),
          almacenOrigenId: Number(almacenOrigenId),
          almacenDestinoId: Number(almacenDestinoId),
          cantidad: Number(cantidad),
          referencia: referencia ? String(referencia).trim() : null,
          observacion: observacion ? String(observacion).trim() : null,
        });

        return {
          statusCode: 201,
          data: {
            success: true,
            transferencia: transferRes,
            mensaje: "Transferencia de inventario realizada exitosamente.",
          },
          recursoId: transferRes.movimientoSalida?.movimientoId || null,
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
