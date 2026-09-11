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
         m.codigo_movimiento,
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
         m.proveedor_id,
         COALESCE(prov.nombre_comercial, '—') AS proveedor_nombre,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(ui.nombre, ''), ' ', COALESCE(ui.apellido, ''))), ''), ui.correo_electronico, 'Sistema') AS usuario_nombre,
         tm.codigo AS tipo_codigo,
         tm.nombre AS tipo_nombre
       FROM admin.movimientos_inventario m
       JOIN admin.productos p ON m.producto_id = p.producto_id
       JOIN admin.almacenes a ON m.almacen_id = a.almacen_id
       JOIN admin.tipo_movimiento_inventario tm ON m.tipo_movimiento_id = tm.tipo_movimiento_id
       LEFT JOIN admin.proveedores prov ON m.proveedor_id = prov.proveedor_id
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
        codigoMovimiento: r.codigo_movimiento || "-",
        fecha: r.fecha_movimiento,
        productoCodigo: r.codigo_producto,
        productoNombre: r.producto_nombre,
        proveedorId: r.proveedor_id || null,
        proveedorNombre: r.proveedor_nombre?.trim() || "—",
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

// POST /api/inventario/entradas - Registrar Entrada por Compra (Multiproducto Atómica)
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
      proveedorId, // General / respaldo opcional
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

    // Normalizar líneas de la operación (referencia es exclusivamente de cabecera)
    let lineasToProcess: Array<{
      productoId: number;
      cantidad: number;
      costoUnitario: number;
      proveedorId?: number | null;
    }> = [];

    if (Array.isArray(lineas) && lineas.length > 0) {
      lineasToProcess = lineas.map((l: any) => ({
        productoId: Number(l.productoId),
        cantidad: Number(l.cantidad),
        costoUnitario: Number(l.costoUnitario),
        proveedorId: l.proveedorId ? Number(l.proveedorId) : null,
      }));
    } else if (productoId && cantidad) {
      lineasToProcess = [
        {
          productoId: Number(productoId),
          cantidad: Number(cantidad),
          costoUnitario: Number(costoUnitario || 0),
          proveedorId: proveedorId ? Number(proveedorId) : null,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "LINEAS_REQUERIDAS", message: "Debe incluir al menos una línea de producto en la entrada." },
        { status: 400 }
      );
    }

    // Validar duplicados en el mismo lote
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
      if (isNaN(line.costoUnitario) || line.costoUnitario < 0) {
        return NextResponse.json(
          { error: "COSTO_INVALIDO", message: `El costo unitario en la línea #${i + 1} no puede ser negativo.` },
          { status: 400 }
        );
      }
    }

    // Validar productos pertenezcan a la empresa y estén activos
    const productIds = lineasToProcess.map((l) => l.productoId);
    const prodRows = await query(
      `SELECT producto_id, codigo_producto, nombre
       FROM admin.productos
       WHERE producto_id = ANY($1::int[])
         AND empresa_id = $2
         AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL)`,
      [productIds, empresaId]
    );
    const validProdMap = new Map((prodRows || []).map((p: any) => [Number(p.producto_id), p]));
    for (const pid of productIds) {
      if (!validProdMap.has(pid)) {
        return NextResponse.json(
          { error: "PRODUCTO_NO_ENCONTRADO", message: `El producto ID ${pid} no pertenece a esta empresa o está inactivo.` },
          { status: 400 }
        );
      }
    }

    // Consultar relaciones en admin.producto_proveedor para los productos del lote
    const ppRows = await query(
      `SELECT
         pp.producto_id,
         pp.proveedor_id,
         COALESCE(pp.proveedor_principal, false) AS proveedor_principal,
         pr.nombre_comercial,
         pr.codigo_proveedor
       FROM admin.producto_proveedor pp
       JOIN admin.proveedores pr ON pp.proveedor_id = pr.proveedor_id
       WHERE pp.producto_id = ANY($1::int[])
         AND pr.empresa_id = $2
         AND (UPPER(pp.estado) = 'ACTIVO' OR pp.estado IS NULL)
         AND (UPPER(pr.estado) = 'ACTIVO' OR pr.estado IS NULL)
       ORDER BY pp.proveedor_principal DESC, pr.nombre_comercial ASC`,
      [productIds, empresaId]
    );

    // Agrupar proveedores asociados por producto
    const ppMap = new Map<number, any[]>();
    for (const r of ppRows || []) {
      const pid = Number(r.producto_id);
      if (!ppMap.has(pid)) ppMap.set(pid, []);
      ppMap.get(pid)!.push(r);
    }

    // Validar proveedor general si fue provisto
    let generalProvName: string | null = null;
    if (proveedorId) {
      const genProvRows = await query(
        `SELECT proveedor_id, nombre_comercial
         FROM admin.proveedores
         WHERE proveedor_id = $1 AND empresa_id = $2 AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL)`,
        [Number(proveedorId), empresaId]
      );
      if (!genProvRows || genProvRows.length === 0) {
        return NextResponse.json(
          { error: "PROVEEDOR_INVALIDO", message: "El proveedor general seleccionado no es válido o está inactivo." },
          { status: 400 }
        );
      }
      generalProvName = genProvRows[0].nombre_comercial;
    }

    // Resolver proveedor efectivo para cada línea
    // Reglas de negocio:
    // 1. Si la línea especificó proveedorId, validar que sea activo en el tenant
    // 2. Si no, si el producto tiene proveedor_principal = true, usarlo
    // 3. Si no, si el producto tiene exactamente 1 proveedor activo, usarlo
    // 4. Si no, si hay proveedor general, usarlo de fallback
    // 5. Si no, NULL (permitido sin proveedor)
    const lineasResueltas: Array<{
      productoId: number;
      cantidad: number;
      costoUnitario: number;
      referencia?: string | null;
      proveedorId?: number | null;
      proveedorNombre?: string | null;
    }> = [];

    for (let i = 0; i < lineasToProcess.length; i++) {
      const line = lineasToProcess[i];
      const prodsProvs = ppMap.get(line.productoId) || [];

      let effProvId: number | null = null;
      let effProvName: string | null = null;

      if (line.proveedorId) {
        // Validar que el proveedor especificado exista en el tenant
        const pMatch = prodsProvs.find((p) => Number(p.proveedor_id) === Number(line.proveedorId));
        if (pMatch) {
          effProvId = Number(pMatch.proveedor_id);
          effProvName = pMatch.nombre_comercial;
        } else {
          // Verificar si existe como proveedor general de la empresa
          const provCheck = await query(
            `SELECT proveedor_id, nombre_comercial FROM admin.proveedores WHERE proveedor_id = $1 AND empresa_id = $2 AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL)`,
            [Number(line.proveedorId), empresaId]
          );
          if (provCheck && provCheck.length > 0) {
            effProvId = Number(provCheck[0].proveedor_id);
            effProvName = provCheck[0].nombre_comercial;
          } else {
            return NextResponse.json(
              { error: "PROVEEDOR_INVALIDO", message: `El proveedor especificado en la línea #${i + 1} no es válido.` },
              { status: 400 }
            );
          }
        }
      } else {
        // CASO A: proveedor_principal activo
        const principal = prodsProvs.find((p) => p.proveedor_principal === true);
        if (principal) {
          effProvId = Number(principal.proveedor_id);
          effProvName = principal.nombre_comercial;
        } else if (prodsProvs.length === 1) {
          // CASO B: exactamente un proveedor activo
          effProvId = Number(prodsProvs[0].proveedor_id);
          effProvName = prodsProvs[0].nombre_comercial;
        } else if (prodsProvs.length > 1) {
          // CASO C: varios proveedores y ninguno principal
          // Usar el primer proveedor o general fallback
          if (generalProvName && proveedorId) {
            effProvId = Number(proveedorId);
            effProvName = generalProvName;
          } else {
            effProvId = Number(prodsProvs[0].proveedor_id);
            effProvName = prodsProvs[0].nombre_comercial;
          }
        } else {
          // CASO D / E: sin proveedor asociado -> fallback a proveedor general o NULL
          if (generalProvName && proveedorId) {
            effProvId = Number(proveedorId);
            effProvName = generalProvName;
          } else {
            effProvId = null;
            effProvName = null;
          }
        }
      }

      lineasResueltas.push({
        ...line,
        proveedorId: effProvId,
        proveedorNombre: effProvName,
      });
    }

    // Orden determinista para evitar deadlocks: producto_id ASC
    lineasResueltas.sort((a, b) => a.productoId - b.productoId);

    // Referencia exclusiva de cabecera
    const effectiveRef = (referencia && String(referencia).trim()) ? String(referencia).trim() : null;

    // Ejecutar con idempotencia atómica y código único por lote
    const result = await executeWithIdempotency({
      empresaId,
      usuarioId,
      tipoOperacion: "ENTRADA_INVENTARIO",
      idempotencyKey,
      requestPayload: { almacenId, referencia: effectiveRef, proveedorId, lineas: lineasResueltas, observacion },
      operation: async (client) => {
        // Generar código de sistema de la operación (código 5 = Entrada de Inventario)
        const codigoMovimiento = await generarCodigoMovimiento(
          client,
          empresaId,
          INVENTORY_SYSTEM_CODES.ENTRADA
        );

        const movimientosResult: any[] = [];

        for (const line of lineasResueltas) {
          const mov = await registrarMovimientoInventario({
            client,
            empresaId,
            usuarioId,
            tipoMovimientoCodigo: "ENT_COMPRA",
            productoId: line.productoId,
            almacenId: Number(almacenId),
            cantidad: line.cantidad,
            costoUnitario: line.costoUnitario,
            referencia: effectiveRef,
            observacion: (observacion && String(observacion).trim()) ? String(observacion).trim() : null,
            proveedorId: line.proveedorId ? Number(line.proveedorId) : null,
            codigoMovimiento,
          });

          movimientosResult.push({
            ...mov,
            proveedorId: line.proveedorId,
            proveedorNombre: line.proveedorNombre,
          });
        }

        return {
          statusCode: 201,
          data: {
            success: true,
            codigoMovimiento,
            totalLineas: movimientosResult.length,
            movimientos: movimientosResult,
            mensaje: `Entrada por compra registrada exitosamente con código ${codigoMovimiento}.`,
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

    console.error("Error en POST /api/inventario/entradas:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Error al procesar la entrada de inventario." },
      { status: 500 }
    );
  }
}
