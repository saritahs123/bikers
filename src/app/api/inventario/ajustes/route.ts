import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  registrarMovimientoInventario,
  InventoryError,
} from "@/lib/inventory/inventoryMovementService";
import {
  INVENTORY_SYSTEM_CODES,
  generarCodigoMovimiento,
} from "@/lib/inventory/inventoryConstants";

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
         m.codigo_movimiento,
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
        codigoMovimiento: r.codigo_movimiento || "-",
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

// POST /api/inventario/ajustes - Registrar Salida Manual o Ajuste Positivo/Negativo (Multiproducto Atómica)
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
      tipo, // "SALIDA" | "SAL_MANUAL" | "AJU_POS" | "AJU_NEG"
      almacenId,
      motivo,
      observacion,
      lineas,
      // Legacy single-line fallback
      productoId,
      cantidad,
      costoUnitario,
      referencia,
    } = body;

    const empresaId = session.empresa_id;
    const usuarioId = session.usuario_id;
    const idempotencyKey = request.headers.get("x-idempotency-key") || body.idempotencyKey;

    if (!almacenId) {
      return NextResponse.json({ error: "ALMACEN_REQUERIDO", message: "El almacén es obligatorio." }, { status: 400 });
    }

    let tipoMovimientoCodigo: string;
    let tipoOperacionIdem: string;
    let codigoSistemaId: number;

    const cleanTipo = String(tipo || "").toUpperCase();
    if (cleanTipo === "SALIDA" || cleanTipo === "SAL_MANUAL") {
      tipoMovimientoCodigo = "SAL_MANUAL";
      tipoOperacionIdem = "SALIDA_MANUAL_INVENTARIO";
      codigoSistemaId = INVENTORY_SYSTEM_CODES.SALIDA; // 6
    } else if (cleanTipo === "AJU_POS") {
      tipoMovimientoCodigo = "AJU_POS";
      tipoOperacionIdem = "AJUSTE_INVENTARIO";
      codigoSistemaId = INVENTORY_SYSTEM_CODES.AJUSTE_POSITIVO; // 7
    } else if (cleanTipo === "AJU_NEG") {
      tipoMovimientoCodigo = "AJU_NEG";
      tipoOperacionIdem = "AJUSTE_INVENTARIO";
      codigoSistemaId = INVENTORY_SYSTEM_CODES.AJUSTE_NEGATIVO; // 8
    } else {
      return NextResponse.json(
        { error: "TIPO_INVALIDO", message: "El tipo de operación debe ser SALIDA, AJU_POS o AJU_NEG." },
        { status: 400 }
      );
    }

    // Normalizar líneas de la operación
    let lineasToProcess: Array<{
      productoId: number;
      cantidad: number;
      costoUnitario?: number | null;
      referencia?: string | null;
    }> = [];

    if (Array.isArray(lineas) && lineas.length > 0) {
      lineasToProcess = lineas.map((l: any) => ({
        productoId: Number(l.productoId),
        cantidad: Number(l.cantidad),
        costoUnitario: l.costoUnitario !== undefined && l.costoUnitario !== null ? Number(l.costoUnitario) : null,
        referencia: l.referencia ? String(l.referencia).trim() : null,
      }));
    } else if (productoId && cantidad) {
      lineasToProcess = [
        {
          productoId: Number(productoId),
          cantidad: Number(cantidad),
          costoUnitario: costoUnitario !== undefined && costoUnitario !== null ? Number(costoUnitario) : null,
          referencia: referencia ? String(referencia).trim() : null,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "LINEAS_REQUERIDAS", message: "Debe incluir al menos una línea de producto." },
        { status: 400 }
      );
    }

    // Validar duplicados en el lote
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
            message: `El producto ID ${line.productoId} aparece más de una vez en el lote. Consolide la cantidad en una sola línea.`,
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

      if (
        cleanTipo === "AJU_POS" &&
        (line.costoUnitario === null ||
          line.costoUnitario === undefined ||
          isNaN(Number(line.costoUnitario)) ||
          Number(line.costoUnitario) < 0)
      ) {
        return NextResponse.json(
          { error: "COSTO_INVALIDO", message: `El costo unitario en la línea #${i + 1} debe ser igual o mayor a 0 para ajuste positivo.` },
          { status: 400 }
        );
      }
    }

    const combinedObs = [
      motivo ? `Motivo: ${String(motivo).trim()}` : null,
      observacion ? String(observacion).trim() : null,
    ]
      .filter(Boolean)
      .join(" | ");

    // Orden determinista para evitar deadlocks: producto_id ASC
    lineasToProcess.sort((a, b) => a.productoId - b.productoId);

    // Ejecutar con idempotencia atómica y código único por lote
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: tipoOperacionIdem,
      idempotencyKey,
      requestPayload: { tipo, almacenId, lineas: lineasToProcess, motivo, observacion },
      operation: async (client) => {
        // Generar código de sistema de la operación según el tipo (6, 7 u 8)
        const codigoMovimiento = await generarCodigoMovimiento(
          client,
          empresaId,
          codigoSistemaId
        );

        const movimientosResult: any[] = [];

        for (const line of lineasToProcess) {
          const mov = await registrarMovimientoInventario({
            client,
            empresaId,
            usuarioId,
            tipoMovimientoCodigo,
            productoId: line.productoId,
            almacenId: Number(almacenId),
            cantidad: line.cantidad,
            costoUnitario: line.costoUnitario,
            referencia: line.referencia,
            observacion: combinedObs || null,
            codigoMovimiento,
          });

          movimientosResult.push(mov);
        }

        const tipoLabel =
          cleanTipo === "SALIDA" || cleanTipo === "SAL_MANUAL"
            ? "Salida manual"
            : cleanTipo === "AJU_POS"
            ? "Ajuste positivo"
            : "Ajuste negativo";

        return {
          statusCode: 201,
          data: {
            success: true,
            codigoMovimiento,
            totalLineas: movimientosResult.length,
            movimientos: movimientosResult,
            mensaje: `${tipoLabel} registrada exitosamente con código ${codigoMovimiento}.`,
          },
          recursoId: movimientosResult[0]?.movimientoId || null,
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
