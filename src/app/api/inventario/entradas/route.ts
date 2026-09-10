import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  registrarMovimientoInventario,
  InventoryError,
} from "@/lib/inventory/inventoryMovementService";

// GET /api/inventario/entradas - Últimas entradas registradas
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
        { error: "FORBIDDEN", message: "No tienes permisos para ver entradas." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 5), 50);

    const rows = await query(
      `SELECT
         m.movimiento_inventario_id,
         m.fecha_movimiento,
         m.cantidad::numeric AS cantidad,
         m.costo_unitario::numeric AS costo_unitario,
         m.costo_total::numeric AS costo_total,
         m.referencia,
         m.observacion,
         p.producto_id,
         p.codigo_producto,
         p.nombre AS producto_nombre,
         a.almacen_id,
         a.nombre AS almacen_nombre,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(ui.nombre, ''), ' ', COALESCE(ui.apellido, ''))), ''), ui.correo_electronico, 'Sistema') AS usuario_nombre,
         tm.codigo AS tipo_codigo,
         tm.nombre AS tipo_nombre
       FROM admin.movimientos_inventario m
       JOIN admin.productos p ON m.producto_id = p.producto_id
       JOIN admin.almacenes a ON m.almacen_id = a.almacen_id
       JOIN admin.tipo_movimiento_inventario tm ON m.tipo_movimiento_id = tm.tipo_movimiento_id
       LEFT JOIN admin.usuario u ON m.usuario_movimiento = u.usuario_id
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE m.empresa_id = $1
         AND tm.codigo = 'ENT_COMPRA'
       ORDER BY m.fecha_movimiento DESC
       LIMIT $2`,
      [empresaId, limit]
    );

    return NextResponse.json({
      entradas: (rows || []).map((r: any) => ({
        id: r.movimiento_inventario_id,
        fecha: r.fecha_movimiento,
        productoCodigo: r.codigo_producto,
        productoNombre: r.producto_nombre,
        almacenNombre: r.almacen_nombre,
        cantidad: Number(r.cantidad || 0),
        costoUnitario: Number(r.costo_unitario || 0),
        costoTotal: Number(r.costo_total || 0),
        referencia: r.referencia || "-",
        usuario: r.usuario_nombre || "Sistema",
      })),
    });
  } catch (error: any) {
    console.error("Error en GET /api/inventario/entradas:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al consultar entradas." },
      { status: 500 }
    );
  }
}

// POST /api/inventario/entradas - Registrar Entrada por Compra
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
        { error: "FORBIDDEN", message: "No tienes permisos para registrar entradas de inventario." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      almacenId,
      proveedorId,
      productoId,
      cantidad,
      costoUnitario,
      referencia,
      observacion,
    } = body;

    const empresaId = session.empresa_id;
    const usuarioId = session.usuario_id;
    const idempotencyKey = request.headers.get("x-idempotency-key") || body.idempotencyKey;

    if (!almacenId) {
      return NextResponse.json({ error: "ALMACEN_REQUERIDO", message: "El almacén es obligatorio." }, { status: 400 });
    }
    if (!productoId) {
      return NextResponse.json({ error: "PRODUCTO_REQUERIDO", message: "El producto es obligatorio." }, { status: 400 });
    }
    if (!proveedorId) {
      return NextResponse.json({ error: "PROVEEDOR_REQUERIDO", message: "El proveedor es obligatorio para una entrada por compra." }, { status: 400 });
    }
    if (!cantidad || Number(cantidad) <= 0) {
      return NextResponse.json({ error: "CANTIDAD_INVALIDA", message: "La cantidad debe ser mayor a 0." }, { status: 400 });
    }
    if (costoUnitario === undefined || costoUnitario === null || Number(costoUnitario) < 0) {
      return NextResponse.json({ error: "COSTO_INVALIDO", message: "El costo unitario debe ser igual o mayor a 0." }, { status: 400 });
    }

    // Validar relación producto ↔ proveedor activa (Regla INV-2B 12 y 13)
    const ppCheck = await query(
      `SELECT pp.producto_proveedor_id, pr.nombre_comercial
       FROM admin.producto_proveedor pp
       JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
       JOIN admin.productos p ON pp.producto_id = p.producto_id
       WHERE pp.producto_id = $1
         AND pp.proveedor_id = $2
         AND p.empresa_id = $3
         AND pr.empresa_id = $3
         AND UPPER(pp.estado) = 'ACTIVO'
         AND UPPER(pr.estado) = 'ACTIVO'
       LIMIT 1`,
      [Number(productoId), Number(proveedorId), empresaId]
    );

    if (!ppCheck || ppCheck.length === 0) {
      return NextResponse.json(
        {
          error: "PROVEEDOR_NO_ASOCIADO",
          message: "Este proveedor no se encuentra activo o asociado a este producto. Configura la relación previamente.",
        },
        { status: 400 }
      );
    }

    const proveedorNombre = ppCheck[0].nombre_comercial;
    const finalObs = observacion
      ? `${observacion} | Proveedor: ${proveedorNombre}`
      : `Proveedor: ${proveedorNombre}`;

    // Ejecutar con idempotencia atómica
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: "ENTRADA_INVENTARIO",
      idempotencyKey,
      requestPayload: { almacenId, proveedorId, productoId, cantidad, costoUnitario, referencia },
      operation: async (client) => {
        const mov = await registrarMovimientoInventario({
          client,
          empresaId,
          usuarioId,
          tipoMovimientoCodigo: "ENT_COMPRA",
          productoId: Number(productoId),
          almacenId: Number(almacenId),
          cantidad: Number(cantidad),
          costoUnitario: Number(costoUnitario),
          referencia: referencia ? String(referencia).trim() : null,
          observacion: finalObs,
        });

        return {
          statusCode: 201,
          data: {
            success: true,
            movimiento: mov,
            mensaje: "Entrada por compra registrada exitosamente.",
          },
          recursoId: mov.movimientoId,
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

    console.error("Error en POST /api/inventario/entradas:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Error al procesar la entrada de inventario." },
      { status: 500 }
    );
  }
}
