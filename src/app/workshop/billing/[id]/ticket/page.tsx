"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { Printer, X, AlertCircle, Loader2 } from "lucide-react";
import type { InvoicePdfData } from "@/lib/workshop/generateInvoicePdf";

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

const formatMoney = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val || "0");
  return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateStr;
  }
};

export default function PosTicketPage({ params }: TicketPageProps) {
  const resolvedParams = use(params);
  const ordenId = resolvedParams.id;

  const [data, setData] = useState<InvoicePdfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; title: string; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTicketData() {
      if (!ordenId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/taller/facturacion/ordenes/${ordenId}/imprimir`);
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!isMounted) return;

        if (!res.ok) {
          if (res.status === 401) {
            setError({
              status: 401,
              title: "Sesión no válida o expirada",
              message: "Debe iniciar sesión en el sistema para acceder a los datos de esta orden."
            });
            return;
          }

          if (res.status === 403) {
            setError({
              status: 403,
              title: "Acceso denegado",
              message: "No posee permisos del módulo Taller para visualizar e imprimir esta factura."
            });
            return;
          }

          if (res.status === 404) {
            setError({
              status: 404,
              title: "Orden no encontrada",
              message: json?.message || "La orden solicitada no existe o no pertenece a su empresa."
            });
            return;
          }

          if (res.status === 409) {
            setError({
              status: 409,
              title: "Factura no disponible",
              message: json?.message || "La factura solo puede imprimirse cuando la orden esté entregada y facturada."
            });
            return;
          }

          setError({
            status: res.status,
            title: "Error al cargar el ticket",
            message: json?.message || "No fue posible obtener los datos de la factura para esta orden."
          });
          return;
        }

        if (!json?.data) {
          setError({
            status: 500,
            title: "Respuesta inválida",
            message: "El servidor entregó una estructura de datos vacía."
          });
          return;
        }

        setData(json.data);
      } catch (err: any) {
        if (!isMounted) return;
        setError({
          status: 500,
          title: "Error de conexión",
          message: err?.message || "No se pudo conectar con el servidor de Ride Lab."
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTicketData();

    return () => {
      isMounted = false;
    };
  }, [ordenId]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleClose = () => {
    if (typeof window !== "undefined") {
      if (window.opener) {
        window.close();
      } else {
        window.history.back();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            width: 80mm !important;
          }
          .no-print {
            display: none !important;
          }
          .ticket-screen-wrapper {
            padding: 0 !important;
            background: transparent !important;
            min-height: 0 !important;
          }
          .ticket {
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            color: #000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .ticket-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}} />

      {/* Screen Top Action Bar */}
      <div className="no-print sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Vista Previa Ticket POS (80 mm)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !!error}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all rounded-xl shadow-md shadow-amber-400/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ticket</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-xl border border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Screen Wrapper & Ticket Container */}
      <div className="ticket-screen-wrapper p-4 sm:p-8 flex flex-col items-center justify-start">
        {/* Loading State */}
        {loading && (
          <div className="no-print p-12 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 shadow-2xl max-w-sm w-full my-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-xs font-mono font-semibold">Cargando ticket...</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="no-print p-6 sm:p-8 bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full my-8 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-100 font-mono">{error.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{error.message}</p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              {error.status === 401 ? (
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all"
                >
                  Iniciar Sesión
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  Cerrar Ventana
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ticket POS 80mm Render */}
        {!loading && !error && data && (
          <div
            className="ticket bg-white text-black p-3.5 sm:p-4 rounded shadow-2xl font-mono text-[10.5px] leading-[1.3] select-all transition-all"
            style={{
              width: "74mm",
              maxWidth: "74mm",
              minHeight: 0,
              height: "auto",
              overflow: "visible"
            }}
          >
            {/* 1. Header Section: Clean Text Branding & Company Info */}
            <div className="ticket-section text-center space-y-0.5 pb-1">
              <div className="text-[19px] font-black uppercase tracking-wider leading-tight">
                {(() => {
                  const name = data.empresa?.nombre_comercial || "";
                  if (!name || name.toLowerCase().includes("biker")) {
                    return "RIDE LAB";
                  }
                  return name;
                })()}
              </div>

              <div className="text-[10px] font-bold tracking-tight text-black uppercase">
                TIENDA Y TALLER DE BICICLETAS
              </div>

              {data.empresa?.direccion && (
                <div className="text-[9px] text-gray-700 leading-snug px-1 pt-0.5">
                  {data.empresa.direccion}
                </div>
              )}

              <div className="text-[9px] text-gray-700 flex justify-center gap-2 flex-wrap">
                {data.empresa?.telefono && <span>Tel: {data.empresa.telefono}</span>}
                {data.empresa?.rnc && <span>RNC: {data.empresa.rnc}</span>}
              </div>
            </div>

            {/* 2. Factura & Cliente - Compact & Balanced (Zero Empty Holes) */}
            <div className="ticket-section pt-0.5">
              <div className="my-1.5 border-b border-dashed border-gray-400"></div>

              {/* Two Column Key-Value Grid */}
              <div className="grid grid-cols-[48%_52%] gap-1 text-[10px] leading-tight">
                {/* Left Column: Factura & Orden */}
                <div className="space-y-0.5 pr-1">
                  {data.factura?.numero_factura && (
                    <div className="break-words">
                      <span className="font-bold">Núm.:</span> {data.factura.numero_factura}
                    </div>
                  )}
                  <div className="break-words">
                    <span className="font-bold">Orden:</span> {data.factura?.codigo_orden}
                  </div>
                  {data.factura?.codigo_recepcion && data.factura.codigo_recepcion !== "Sin Recepción" && (
                    <div className="break-words">
                      <span className="font-bold">Recibido:</span> {data.factura.codigo_recepcion}
                    </div>
                  )}
                </div>

                {/* Right Column: Cliente Info */}
                <div className="space-y-0.5 pl-0.5">
                  {data.cliente?.nombre_completo && data.cliente.nombre_completo !== "No registrado" && (
                    <div className="break-words">
                      <span className="font-bold">Nombre:</span> {data.cliente.nombre_completo}
                    </div>
                  )}
                  {data.cliente?.telefono && data.cliente.telefono !== "No registrado" && (
                    <div className="break-words">
                      <span className="font-bold">Teléfono:</span> {data.cliente.telefono}
                    </div>
                  )}
                  {data.cliente?.identificacion &&
                    data.cliente.identificacion !== "No registrada" &&
                    data.cliente.identificacion !== "No registrado" && (
                      <div className="break-words">
                        <span className="font-bold">RNC / ID:</span> {data.cliente.identificacion}
                      </div>
                    )}
                </div>
              </div>

              {/* Bottom Row: Fecha & Estado (Full Width, Single Line) */}
              <div className="flex justify-between items-center text-[10px] leading-tight pt-1">
                <div className="break-words">
                  <span className="font-bold">Fecha:</span> {formatDateTime(data.factura?.fecha_factura)}
                </div>
                {(data.pago_entrega?.estado_pago || data.factura?.estado) && (
                  <div className="text-right whitespace-nowrap pl-1">
                    <span className="font-bold">Estado:</span> {data.pago_entrega?.estado_pago || data.factura?.estado}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Bicicleta Section (Full Width) */}
            <div className="ticket-section pt-1">
              <div className="my-1.5 border-b border-dashed border-gray-400"></div>
              <div className="font-black uppercase text-[10.5px] mb-1 tracking-wide">BICICLETA</div>
              <div className="text-[10px] space-y-0.5">
                <div>
                  <span className="font-bold">Marca / Modelo:</span> {data.bicicleta?.marca_modelo || "Bicicleta"}
                </div>
                {data.bicicleta?.ano_color && data.bicicleta.ano_color !== "— / —" && (
                  <div>
                    <span className="font-bold">Año / Color:</span> {data.bicicleta.ano_color}
                  </div>
                )}
                {data.bicicleta?.numero_serie &&
                  data.bicicleta.numero_serie !== "No registrado" &&
                  data.bicicleta.numero_serie !== "Sin serie registrada" && (
                    <div>
                      <span className="font-bold">Serie:</span> {data.bicicleta.numero_serie}
                    </div>
                  )}
              </div>
            </div>

            {/* 4. Detalle de Conceptos */}
            <div className="ticket-section pt-1">
              <div className="my-1.5 border-b border-dashed border-gray-400"></div>
              <div className="font-black uppercase text-[10.5px] mb-1 tracking-wide">DETALLE DE CONCEPTOS</div>

              <div className="grid grid-cols-[1fr_36px_58px_58px] gap-1 text-[9.5px] font-bold border-b border-gray-300 pb-1 mb-1">
                <span className="text-left">DESCRIPCIÓN</span>
                <span className="text-center">CANT.</span>
                <span className="text-right">P. UNITARIO</span>
                <span className="text-right">TOTAL</span>
              </div>

              <div className="space-y-1.5 pt-0.5">
                {Array.isArray(data.conceptos) && data.conceptos.length > 0 ? (
                  data.conceptos.map((item, idx) => {
                    const cant = parseFloat(String(item.cantidad || 1)).toFixed(2);
                    const precio = formatMoney(item.precio_unitario);
                    const subtotal = formatMoney(item.subtotal);
                    const desc = parseFloat(String(item.descuento || 0));

                    return (
                      <div key={idx} className="ticket-section text-[10px] leading-tight space-y-0.5">
                        <div className="grid grid-cols-[1fr_36px_58px_58px] gap-1 items-start">
                          <span className="break-words font-medium">{item.descripcion}</span>
                          <span className="text-center text-gray-800">{cant}</span>
                          <span className="text-right text-gray-800">{precio}</span>
                          <span className="text-right font-bold text-black">{subtotal}</span>
                        </div>
                        {item.notas && (
                          <div className="text-[9px] text-gray-600 italic break-words pl-1">
                            {item.notas}
                          </div>
                        )}
                        {desc > 0 && (
                          <div className="text-[9px] text-gray-600 text-right">
                            Descuento: -{formatMoney(desc)}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-gray-500 italic text-center py-2">
                    Sin conceptos facturados.
                  </div>
                )}
              </div>
            </div>

            {/* 5. Resumen Financiero */}
            <div className="ticket-section pt-1">
              <div className="my-1.5 border-b border-dashed border-gray-400"></div>
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal Servicios:</span>
                  <span>{formatMoney(data.resumen_financiero?.subtotal_servicios ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal Repuestos:</span>
                  <span>{formatMoney(data.resumen_financiero?.subtotal_repuestos ?? 0)}</span>
                </div>
                {parseFloat(String(data.resumen_financiero?.descuento_total || 0)) > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Descuento:</span>
                    <span>-{formatMoney(data.resumen_financiero?.descuento_total ?? 0)}</span>
                  </div>
                )}
                {parseFloat(String(data.resumen_financiero?.impuesto || 0)) > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Impuestos:</span>
                    <span>{formatMoney(data.resumen_financiero?.impuesto ?? 0)}</span>
                  </div>
                )}

                {/* Total General Destacado */}
                <div className="my-1.5 border-t-2 border-b-2 border-black py-1.5 flex justify-between items-center text-[13.5px] font-black tracking-tight">
                  <span>TOTAL:</span>
                  <span>{formatMoney(data.resumen_financiero?.total_general ?? 0)}</span>
                </div>

                {parseFloat(String(data.resumen_financiero?.monto_pagado || 0)) > 0 && (
                  <div className="flex justify-between text-[10px] text-gray-700">
                    <span>Monto Pagado:</span>
                    <span>{formatMoney(data.resumen_financiero?.monto_pagado ?? 0)}</span>
                  </div>
                )}

                {parseFloat(String(data.resumen_financiero?.balance_pendiente || 0)) > 0 && (
                  <div className="flex justify-between text-[10px] font-bold text-black">
                    <span>Balance Pendiente:</span>
                    <span>{formatMoney(data.resumen_financiero?.balance_pendiente ?? 0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Información Final & Cierre */}
            <div className="ticket-section pt-1">
              <div className="my-1.5 border-b border-dashed border-gray-400"></div>
              <div className="text-[10px] space-y-0.5 text-gray-900">
                {data.pago_entrega?.entregado_por && (
                  <div>
                    <span className="font-bold">Facturado por:</span> {data.pago_entrega.entregado_por}
                  </div>
                )}
                {data.pago_entrega?.fecha_entrega && (
                  <div>
                    <span className="font-bold">Fecha de Entrega:</span> {formatDateTime(data.pago_entrega.fecha_entrega)}
                  </div>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-dashed border-gray-400 text-center space-y-0.5">
                <div className="font-black text-[11px] uppercase tracking-wide">¡GRACIAS POR CONFIAR EN RIDE LAB!</div>
                <div className="text-[9px] text-gray-700 uppercase font-semibold">TIENDA Y TALLER DE BICICLETAS</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
