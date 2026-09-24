import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface FacturaEstadoCuentaRow {
  factura_id: number | string;
  empresa_id: number | string;
  codigo_factura: string;
  fecha_factura: Date | string;
  condicion_venta: string;
  total: number | string;
  balance_pendiente_bd: number | string;
  estado: string;
  orden_trabajo_id: number | string | null;
  codigo_orden: string | null;
  total_pagado_calc: number | string;
  monto_pagado_bd: number | string;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const crmPerms = await getModulePermissions("CRM", session.usuario_id);
    const facPerms = await getModulePermissions("FACTURACION", session.usuario_id);

    if (!crmPerms.puede_ver && !facPerms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar información financiera del cliente." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (isNaN(clienteId) || clienteId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "ID de cliente inválido." },
        { status: 400 }
      );
    }

    // Validar que el cliente exista y pertenezca a la empresa de la sesión (Multitenancy estricto)
    const clienteCheck = await query(`
      SELECT cliente_id, nombre, apellido, nombre_completo
      FROM admin.clientes
      WHERE cliente_id = $1 AND empresa_id = $2 AND fecha_eliminacion IS NULL
    `, [clienteId, session.empresa_id]);

    if (!clienteCheck || clienteCheck.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Cliente no encontrado o no pertenece a su empresa." },
        { status: 404 }
      );
    }

    // Consulta agregada y eficiente (SIN N+1) de facturas y pagos aplicados
    const facturasRows = await query<FacturaEstadoCuentaRow>(`
      SELECT 
        f.factura_id,
        f.empresa_id,
        COALESCE(f.codigo_factura, f.numero_factura, 'FAC-' || f.factura_id::text) AS codigo_factura,
        f.fecha_factura,
        COALESCE(f.condicion_venta, 'CONTADO') AS condicion_venta,
        COALESCE(f.total, f.total_factura, 0)::numeric AS total,
        COALESCE(f.balance_pendiente, 0)::numeric AS balance_pendiente_bd,
        f.estado,
        f.orden_trabajo_id,
        ot.codigo_orden,
        COALESCE(SUM(
          CASE 
            WHEN (p.estado = 'APLICADO' OR p.estado IS NULL) THEN COALESCE(p.monto_pago, p.monto, 0)
            ELSE 0 
          END
        ), 0)::numeric AS total_pagado_calc,
        COALESCE(f.monto_pagado, 0)::numeric AS monto_pagado_bd
      FROM admin.facturas f
      LEFT JOIN admin.pagos p ON f.factura_id = p.factura_id AND (p.estado = 'APLICADO' OR p.estado IS NULL)
      LEFT JOIN admin.ordenes_trabajo ot ON f.orden_trabajo_id = ot.orden_trabajo_id
      WHERE f.cliente_id = $1 AND f.empresa_id = $2
      GROUP BY f.factura_id, ot.codigo_orden
      ORDER BY f.fecha_factura DESC, f.factura_id DESC
    `, [clienteId, session.empresa_id]);

    let totalFacturado = 0;
    let totalPagado = 0;
    let saldoPendiente = 0;
    let facturasPendientes = 0;

    const facturas = (facturasRows || []).map((row: FacturaEstadoCuentaRow) => {
      const facturaId = Number(row.factura_id);
      const total = parseFloat(Number(row.total || 0).toFixed(2));
      const isAnulada = String(row.estado || "").toUpperCase() === "ANULADA";

      // Pagos aplicados: canónico con p.monto_pago
      const pagadoCalc = parseFloat(Number(row.total_pagado_calc || 0).toFixed(2));
      const pagadoBd = parseFloat(Number(row.monto_pagado_bd || 0).toFixed(2));
      const pagado = Math.max(pagadoCalc, pagadoBd);

      let saldo = 0;
      let estadoVisual = String(row.estado || "PENDIENTE").toUpperCase();

      if (isAnulada) {
        saldo = 0;
        estadoVisual = "ANULADA";
      } else {
        saldo = Math.max(0, parseFloat((total - pagado).toFixed(2)));

        if (saldo <= 0.009) {
          estadoVisual = "PAGADA";
          saldo = 0;
        } else if (pagado > 0.009) {
          estadoVisual = "PARCIAL";
        } else {
          estadoVisual = estadoVisual === "BORRADOR" ? "BORRADOR" : "PENDIENTE";
        }

        // Acumular únicamente facturas no anuladas
        totalFacturado += total;
        totalPagado += Math.min(total, pagado);
        if (saldo > 0.009) {
          saldoPendiente += saldo;
          facturasPendientes += 1;
        }
      }

      return {
        factura_id: facturaId,
        codigo_factura: row.codigo_factura,
        fecha_factura: row.fecha_factura,
        condicion_venta: String(row.condicion_venta || "CONTADO").toUpperCase(),
        total,
        monto_pagado: isAnulada ? 0 : pagado,
        saldo,
        estado: estadoVisual,
        orden_trabajo_id: row.orden_trabajo_id ? Number(row.orden_trabajo_id) : null,
        codigo_orden: row.codigo_orden || null
      };
    });

    totalFacturado = parseFloat(totalFacturado.toFixed(2));
    totalPagado = parseFloat(totalPagado.toFixed(2));
    saldoPendiente = parseFloat(saldoPendiente.toFixed(2));

    return NextResponse.json({
      success: true,
      resumen: {
        saldoPendiente,
        totalFacturado,
        totalPagado,
        facturasPendientes
      },
      facturas,
      permisos: {
        puede_registrar_pago: Boolean(facPerms.puede_crear || facPerms.puede_editar),
        puede_ver_factura: Boolean(facPerms.puede_ver)
      }
    });

  } catch (err: unknown) {
    console.error("Error en GET /api/crm/clientes/[id]/estado-cuenta:", err);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: err instanceof Error ? err.message : "Error al consultar estado de cuenta."
      },
      { status: 500 }
    );
  }
}
