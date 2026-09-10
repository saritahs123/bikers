import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { executeWithIdempotency } from "@/lib/inventory/idempotencyService";
import {
  registrarMovimientoInventario,
  InventoryError,
  ValidacionInventarioError,
} from "@/lib/inventory/inventoryMovementService";
import crypto from "crypto";

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
        { error: "FORBIDDEN", message: "No tienes permisos para registrar inventario inicial." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { items, observaciones } = body;
    const empresaId = session.empresa_id;
    const usuarioId = session.usuario_id;
    const idempotencyKey = request.headers.get("x-idempotency-key") || body.idempotencyKey;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "ITEMS_REQUERIDOS", message: "Debe incluir al menos un producto en el lote de inventario inicial." },
        { status: 400 }
      );
    }

    // 1. Validar duplicados en el lote temporal (mismo producto + mismo almacén)
    const seenCombos = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productoId || !item.almacenId) {
        return NextResponse.json(
          { error: "ITEM_INCOMPLETO", message: `La línea #${i + 1} no tiene producto o almacén especificado.` },
          { status: 400 }
        );
      }

      const comboKey = `${item.productoId}_${item.almacenId}`;
      if (seenCombos.has(comboKey)) {
        return NextResponse.json(
          {
            error: "PRODUCTO_DUPLICADO_EN_LOTE",
            message: `El producto ID ${item.productoId} ya fue agregado para el almacén ID ${item.almacenId} en este mismo lote.`,
          },
          { status: 400 }
        );
      }
      seenCombos.add(comboKey);

      const cant = Number(item.cantidad);
      if (isNaN(cant) || cant <= 0) {
        return NextResponse.json(
          { error: "CANTIDAD_INVALIDA", message: `La cantidad en la línea #${i + 1} debe ser mayor a 0.` },
          { status: 400 }
        );
      }

      const costo = Number(item.costoUnitario);
      if (isNaN(costo) || costo < 0) {
        return NextResponse.json(
          { error: "COSTO_INVALIDO", message: `El costo en la línea #${i + 1} debe ser igual o mayor a 0.` },
          { status: 400 }
        );
      }
    }

    // 2. Generar UUID de lote
    const loteUuid = crypto.randomUUID();
    const shortRef = `INV-INI-${loteUuid.substring(0, 8).toUpperCase()}`;

    // 3. Procesar lote de forma atómica e idempotente
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: "INVENTARIO_INICIAL",
      idempotencyKey,
      requestPayload: { items, observaciones, shortRef },
      operation: async (client) => {
        const movimientosGenerados: any[] = [];
        let totalUnidades = 0;
        let totalValor = 0;

        for (const item of items) {
          const prodId = Number(item.productoId);
          const almId = Number(item.almacenId);
          const cant = Number(item.cantidad);
          const costo = Number(item.costoUnitario);

          const mov = await registrarMovimientoInventario({
            client,
            empresaId,
            usuarioId,
            tipoMovimientoCodigo: "INV_INICIAL",
            productoId: prodId,
            almacenId: almId,
            cantidad: cant,
            costoUnitario: costo,
            referencia: shortRef,
            observacion: observaciones ? `Lote ${shortRef} | ${observaciones}` : `Lote de apertura ${shortRef}`,
          });

          movimientosGenerados.push(mov);
          totalUnidades += cant;
          totalValor += cant * costo;
        }

        return {
          statusCode: 201,
          data: {
            success: true,
            referenciaLote: shortRef,
            totalProductos: items.length,
            totalUnidades,
            totalValor: Number(totalValor.toFixed(2)),
            movimientos: movimientosGenerados,
            mensaje: "Inventario inicial cargado correctamente y listo para operar.",
          },
          recursoId: movimientosGenerados[0]?.movimientoId || null,
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

    console.error("Error en POST /api/inventario/inventario-inicial:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Error al procesar el inventario inicial." },
      { status: 500 }
    );
  }
}
