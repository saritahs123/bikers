import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { crearFactura } from "@/lib/billing/billingService";
import { CrearFacturaInput, TipoLineaFactura } from "@/lib/billing/billingTypes";
import { StockInsuficienteError, InventoryError } from "@/lib/inventory/inventoryMovementService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para crear facturas." },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.tipo_factura_id || isNaN(Number(body.tipo_factura_id))) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El tipo de factura es obligatorio." },
        { status: 400 }
      );
    }

    if (!body.lineas || !Array.isArray(body.lineas) || body.lineas.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Debe agregar al menos una línea de detalle a la factura." },
        { status: 400 }
      );
    }

    interface RawLineaInput {
      tipo_linea?: string;
      almacen_id?: number | string | null;
      producto_id?: number | string | null;
      tipo_servicio_id?: number | string | null;
      orden_servicio_id?: number | string | null;
      orden_producto_id?: number | string | null;
      codigo?: string | null;
      descripcion?: string;
      cantidad?: number | string;
      precio_unitario?: number | string;
      descuento?: number | string;
      costo_unitario?: number | string | null;
    }

    interface RawPagoInput {
      tipo_pago_id?: number | string;
      monto?: number | string;
      referencia?: string | null;
      observacion?: string | null;
      fecha_pago?: string | Date;
    }

    const input: CrearFacturaInput = {
      empresa_id: session.empresa_id,
      tipo_factura_id: Number(body.tipo_factura_id),
      cliente_id: body.cliente_id ? Number(body.cliente_id) : null,
      orden_trabajo_id: body.orden_trabajo_id ? Number(body.orden_trabajo_id) : null,
      fecha_factura: body.fecha_factura || new Date(),
      observacion: body.observacion ? String(body.observacion).trim() : null,
      usuario_id: session.usuario_id,
      lineas: (body.lineas as RawLineaInput[]).map((l: RawLineaInput) => ({
        tipo_linea: (l.tipo_linea as TipoLineaFactura) || "PRODUCTO",
        almacen_id: l.almacen_id ? Number(l.almacen_id) : null,
        producto_id: l.producto_id ? Number(l.producto_id) : null,
        tipo_servicio_id: l.tipo_servicio_id ? Number(l.tipo_servicio_id) : null,
        orden_servicio_id: l.orden_servicio_id ? Number(l.orden_servicio_id) : null,
        orden_producto_id: l.orden_producto_id ? Number(l.orden_producto_id) : null,
        codigo: l.codigo ? String(l.codigo).trim() : null,
        descripcion: String(l.descripcion || "").trim(),
        cantidad: Number(l.cantidad || 0),
        precio_unitario: Number(l.precio_unitario || 0),
        descuento: Number(l.descuento || 0),
        costo_unitario: l.costo_unitario != null ? Number(l.costo_unitario) : null
      })),
      pagos_iniciales: Array.isArray(body.pagos_iniciales)
        ? (body.pagos_iniciales as RawPagoInput[]).map((p: RawPagoInput) => ({
            tipo_pago_id: Number(p.tipo_pago_id || 0),
            monto: Number(p.monto || 0),
            referencia: p.referencia ? String(p.referencia).trim() : null,
            observacion: p.observacion ? String(p.observacion).trim() : null,
            fecha_pago: p.fecha_pago || new Date()
          }))
        : []
    };

    const result = await crearFactura(input);

    return NextResponse.json(
      {
        success: true,
        message: `Factura ${result.factura.codigo_factura} creada exitosamente.`,
        factura: result.factura,
        detalles: result.detalles,
        pagos: result.pagos
      },
      { status: 201 }
    );

  } catch (err: unknown) {
    console.error("Error en POST /api/facturacion/facturas:", err);

    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorCode = err instanceof InventoryError ? err.code : (err as { code?: string })?.code;
    const errorDetails = err instanceof InventoryError ? err.details : (err as { details?: Record<string, unknown> })?.details;

    // Concurrencia y duplicados de OT (Sección 15: 409 OT_YA_FACTURADA)
    const constraintName = (err as { constraint?: string })?.constraint;
    if (
      errorCode === "OT_YA_FACTURADA" ||
      constraintName === "uq_facturas_empresa_orden_activa" ||
      (errorCode === "23505" && String(errorObj.message).includes("orden_trabajo"))
    ) {
      return NextResponse.json(
        {
          error: "OT_YA_FACTURADA",
          message: errorObj.message || "La orden de trabajo ya cuenta con una factura activa."
        },
        { status: 409 }
      );
    }

    // Estado no facturable de la OT (Sección 2 y 14)
    if (errorCode === "OT_ESTADO_INVALIDO") {
      return NextResponse.json(
        {
          error: "OT_ESTADO_INVALIDO",
          message: errorObj.message
        },
        { status: 422 }
      );
    }

    if (errorCode === "CLIENTE_OT_INCONSISTENTE") {
      return NextResponse.json(
        {
          error: "CLIENTE_OT_INCONSISTENTE",
          message: errorObj.message
        },
        { status: 400 }
      );
    }

    if (err instanceof StockInsuficienteError || errorCode === "STOCK_DISPONIBLE_INSUFICIENTE" || errorCode === "STOCK_INSUFICIENTE") {
      return NextResponse.json(
        {
          error: "STOCK_INSUFICIENTE",
          message: errorObj.message,
          details: errorDetails
        },
        { status: 409 }
      );
    }

    if (err instanceof InventoryError) {
      return NextResponse.json(
        {
          error: err.code || "INVENTORY_ERROR",
          message: err.message,
          details: err.details
        },
        { status: err.status || 400 }
      );
    }

    const message = (err as Error)?.message || "Ocurrió un error inesperado al procesar la factura.";
    return NextResponse.json(
      {
        error: "ERROR_FACTURACION",
        message
      },
      { status: 400 }
    );
  }
}
