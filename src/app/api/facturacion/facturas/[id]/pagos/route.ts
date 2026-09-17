import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { registrarPago } from "@/lib/billing/billingService";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para registrar pagos en facturación." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const facturaId = parseInt(id, 10);
    if (isNaN(facturaId) || facturaId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Identificador de factura no válido." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const monto = Number(body.monto);
    const tipoPagoId = Number(body.tipo_pago_id);

    if (isNaN(monto) || monto <= 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El monto del pago debe ser mayor a 0." },
        { status: 400 }
      );
    }

    if (isNaN(tipoPagoId) || tipoPagoId <= 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Debe seleccionar un tipo de pago válido." },
        { status: 400 }
      );
    }

    const montoRecibido = body.monto_recibido != null ? Number(body.monto_recibido) : monto;
    const montoDevuelta = body.monto_devuelta != null ? Number(body.monto_devuelta) : 0;

    // Registrar pago atómicamente con billingService (Sección 23 a 27)
    const result = await registrarPago({
      empresa_id: session.empresa_id,
      factura_id: facturaId,
      tipo_pago_id: tipoPagoId,
      monto,
      monto_recibido: montoRecibido,
      monto_devuelta: montoDevuelta,
      referencia: body.referencia ? String(body.referencia).trim() : null,
      observacion: body.observacion ? String(body.observacion).trim() : null,
      fecha_pago: body.fecha_pago || new Date(),
      usuario_id: session.usuario_id
    });

    const pagoObj = result.pago as unknown as Record<string, unknown>;
    const montoFinal = Number(pagoObj.monto_pago ?? pagoObj.monto ?? monto);

    return NextResponse.json({
      success: true,
      message: `Pago de RD$ ${monto.toFixed(2)} registrado exitosamente. Estado actual de la factura: ${result.factura.estado}.`,
      pago: {
        ...result.pago,
        monto: montoFinal,
        monto_pago: montoFinal
      },
      factura: result.factura
    }, { status: 201 });

  } catch (err: unknown) {
    console.error("Error en POST /api/facturacion/facturas/[id]/pagos:", err);
    const errorMessage = err instanceof Error ? err.message : "No se pudo registrar el pago.";
    return NextResponse.json(
      {
        error: "ERROR_REGISTRAR_PAGO",
        message: errorMessage
      },
      { status: 400 }
    );
  }
}
