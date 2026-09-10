import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  registrarMovimientoInventario,
  InventoryError,
} from "@/lib/inventory/inventoryMovementService";

// GET /api/inventario/ajustes - Últimos movimientos de salidas y ajustes
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
        { error: "FORBIDDEN", message: "No tienes permisos para ver movimientos." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;
    const { searchParams } = new URL(request.url);
    const tipoParam = searchParams.get("tipo")?.toUpperCase();
    const limit = Math.min(Number(searchParams.get("limit") || 10), 50);

    let tipoFilter = "tm.codigo IN ('SAL_MANUAL', 'AJU_POS', 'AJU_NEG')";
    const params: any[] = [empresaId];

    if (tipoParam === "SALIDA" || tipoParam === "SAL_MANUAL") {
      tipoFilter = "tm.codigo = 'SAL_MANUAL'";
    } else if (tipoParam === "AJU_POS") {
      tipoFilter = "tm.codigo = 'AJU_POS'";
    } else if (tipoParam === "AJU_NEG") {
      tipoFilter = "tm.codigo = 'AJU_NEG'";
    }

    params.push(limit);

    const rows = await query(
      `SELECT
         m.movimiento_inventario_id,
         m.fecha_movimiento,
         m.cantidad::numeric AS cantidad,
         m.costo_unitario::numeric AS costo_unitario,
         m.costo_total::numeric AS costo_total,
         m.stock_anterior::numeric AS stock_anterior,
         m.stock_nuevo::numeric AS stock_nuevo,
         m.referencia,
         m.observacion,
         p.producto_id,
         p.codigo_producto,
         p.nombre AS producto_nombre,
         a.almacen_id,
         a.nombre AS almacen_nombre,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(ui.nombre, ''), ' ', COALESCE(ui.apellido, ''))), ''), ui.correo_electronico, 'Sistema') AS usuario_nombre,
         tm.codigo AS tipo_codigo,
         tm.nombre AS tipo_nombre,
         tm.naturaleza
       FROM admin.movimientos_inventario m
       JOIN admin.productos p ON m.producto_id = p.producto_id
       JOIN admin.almacenes a ON m.almacen_id = a.almacen_id
       JOIN admin.tipo_movimiento_inventario tm ON m.tipo_movimiento_id = tm.tipo_movimiento_id
       LEFT JOIN admin.usuario u ON m.usuario_movimiento = u.usuario_id
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       WHERE m.empresa_id = $1 AND ${tipoFilter}
       ORDER BY m.fecha_movimiento DESC
       LIMIT $2`,
      params
    );

    return NextResponse.json({
      movimientos: (rows || []).map((r: any) => ({
        id: r.movimiento_inventario_id,
        fecha: r.fecha_movimiento,
        tipoCodigo: r.tipo_codigo,
        tipoNombre: r.tipo_nombre,
        naturaleza: r.naturaleza,
        productoCodigo: r.codigo_producto,
        productoNombre: r.producto_nombre,
        almacenNombre: r.almacen_nombre,
        cantidad: Number(r.cantidad || 0),
        costoUnitario: Number(r.costo_unitario || 0),
        costoTotal: Number(r.costo_total || 0),
        stockAnterior: r.stock_anterior !== null ? Number(r.stock_anterior) : null,
        stockNuevo: r.stock_nuevo !== null ? Number(r.stock_nuevo) : null,
        motivo: r.observacion || r.referencia || "-",
        referencia: r.referencia || "-",
        usuario: r.usuario_nombre || "Sistema",
      })),
    });
  } catch (error: any) {
    console.error("Error en GET /api/inventario/ajustes:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Error al consultar ajustes." },
      { status: 500 }
    );
  }
}

// POST /api/inventario/ajustes - Registrar Salida Manual o Ajuste Positivo/Negativo
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
        { error: "FORBIDDEN", message: "No tienes permisos para registrar movimientos de inventario." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      tipo, // "SALIDA" | "AJU_POS" | "AJU_NEG"
      almacenId,
      productoId,
      cantidad,
      costoUnitario,
      motivo,
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
    if (!cantidad || Number(cantidad) <= 0) {
      return NextResponse.json({ error: "CANTIDAD_INVALIDA", message: "La cantidad debe ser mayor a 0." }, { status: 400 });
    }

    let tipoMovimientoCodigo: string;
    let tipoOperacionIdem: string;

    const cleanTipo = String(tipo || "").toUpperCase();
    if (cleanTipo === "SALIDA" || cleanTipo === "SAL_MANUAL") {
      tipoMovimientoCodigo = "SAL_MANUAL";
      tipoOperacionIdem = "SALIDA_MANUAL_INVENTARIO";
    } else if (cleanTipo === "AJU_POS") {
      tipoMovimientoCodigo = "AJU_POS";
      tipoOperacionIdem = "AJUSTE_INVENTARIO";
    } else if (cleanTipo === "AJU_NEG") {
      tipoMovimientoCodigo = "AJU_NEG";
      tipoOperacionIdem = "AJUSTE_INVENTARIO";
    } else {
      return NextResponse.json(
        { error: "TIPO_INVALIDO", message: "El tipo de operación debe ser SALIDA, AJU_POS o AJU_NEG." },
        { status: 400 }
      );
    }

    const combinedObs = [
      motivo ? `Motivo: ${String(motivo).trim()}` : null,
      observacion ? String(observacion).trim() : null,
    ]
      .filter(Boolean)
      .join(" | ");

    // Ejecutar con idempotencia atómica
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: tipoOperacionIdem,
      idempotencyKey,
      requestPayload: { tipo, almacenId, productoId, cantidad, costoUnitario, motivo, referencia },
      operation: async (client) => {
        const mov = await registrarMovimientoInventario({
          client,
          empresaId,
          usuarioId,
          tipoMovimientoCodigo,
          productoId: Number(productoId),
          almacenId: Number(almacenId),
          cantidad: Number(cantidad),
          costoUnitario: costoUnitario !== undefined && costoUnitario !== null ? Number(costoUnitario) : null,
          referencia: referencia ? String(referencia).trim() : null,
          observacion: combinedObs || null,
        });

        return {
          statusCode: 201,
          data: {
            success: true,
            movimiento: mov,
            mensaje: `${cleanTipo === "SALIDA" ? "Salida manual" : cleanTipo === "AJU_POS" ? "Ajuste positivo" : "Ajuste negativo"} registrado exitosamente.`,
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

    console.error("Error en POST /api/inventario/ajustes:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Error al procesar la operación." },
      { status: 500 }
    );
  }
}
