/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import {
  Check,
  SearchX,
  RefreshCw,
  Clock,
  Phone,
  Download,
  FileText,
  MapPin,
} from "lucide-react";
import { PublicWorkOrderDTO } from "@/lib/tracking/workOrderTrackingService";
import { generateInvoicePdfDocument } from "@/lib/workshop/generateInvoicePdf";

function formatFriendlyDateParts(
  isoString?: string | null
): { date: string; time: string } | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    const day = d.getDate();
    const shortMonths = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    const month = shortMonths[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "p. m." : "a. m.";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return {
      date: `${day} ${month} ${year}`,
      time: `${hours}:${minutes} ${ampm}`,
    };
  } catch {
    return null;
  }
}

export default function PublicTrackingView({
  params,
  paramKey = "code",
}: {
  params: Promise<Record<string, string>>;
  paramKey?: string;
}) {
  const resolvedParams = use(params);
  const codeOrToken = resolvedParams[paramKey] || "";

  const [order, setOrder] = useState<PublicWorkOrderDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  const fetchTrackingData = useCallback(async () => {
    if (!codeOrToken) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/public/tracking/${encodeURIComponent(codeOrToken)}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        setNotFound(true);
        setOrder(null);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setOrder(json.data);
        setNotFound(false);
      } else {
        setNotFound(true);
        setOrder(null);
      }
    } catch (err) {
      console.error("Error fetching tracking:", err);
      setNotFound(true);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [codeOrToken]);

  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyHeight = document.body.style.height;
    const originalHtmlHeight = document.documentElement.style.height;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.height = "100%";
    document.documentElement.style.height = "100%";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.height = originalBodyHeight;
      document.documentElement.style.height = originalHtmlHeight;
    };
  }, []);

  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadInvoice = async () => {
    if (!order || !order.esEntregada || !order.canDownloadInvoice || isDownloadingInvoice) {
      return;
    }

    setIsDownloadingInvoice(true);
    setDownloadError(null);

    try {
      const res = await fetch(
        `/api/public/tracking/${encodeURIComponent(codeOrToken)}/invoice`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        const errMsg = json.message || "No se pudo descargar la factura.";
        setDownloadError(errMsg);
        setTimeout(() => setDownloadError(null), 4000);
        return;
      }

      const invoiceData = json.data;
      const doc = generateInvoicePdfDocument(invoiceData);
      const codigoFactura =
        invoiceData.factura?.codigo_factura ||
        invoiceData.factura?.numero_factura ||
        invoiceData.factura?.codigo_orden ||
        order.codigoOrden;
      const fileName = `Factura_${codigoFactura}.pdf`.replace(/[/\\?%*:|"<>]/g, "-");
      doc.save(fileName);
    } catch (err) {
      console.error("Error al descargar factura:", err);
      setDownloadError("No se pudo descargar la factura.");
      setTimeout(() => setDownloadError(null), 4000);
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{ height: "100dvh" }}
        className="w-full h-screen h-[100dvh] overflow-hidden bg-[#f8fafc] text-[#0F0F0F] flex flex-col justify-center items-center p-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center mb-4 shadow-sm">
          <RefreshCw className="w-6 h-6 text-[#84924A] animate-spin" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ridelab-logo.png"
          alt="Ride Lab"
          className="h-8 sm:h-9 w-auto object-contain mb-2"
        />
        <p className="text-slate-400 text-xs font-sans">
          Cargando seguimiento de reparación...
        </p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div
        style={{ height: "100dvh" }}
        className="w-full h-screen h-[100dvh] overflow-hidden bg-[#f8fafc] text-[#0F0F0F] flex flex-col items-center justify-center p-4"
      >
        <div className="max-w-[420px] w-full bg-white border border-slate-200/80 rounded-2xl p-6 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mx-auto flex items-center justify-center">
            <SearchX className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#84924A]">
              RIDE LAB SEGUIMIENTO
            </span>
            <h1 className="text-lg font-bold text-[#0F0F0F] font-sans">
              Seguimiento no disponible
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              El enlace no es válido o el seguimiento público ha sido desactivado por el taller.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = order.pasoActual || (order.esEntregada ? 4 : 1);

  // Exact 4 canonical steps: PENDIENTE, EN REPARACIÓN, COMPLETADA, ENTREGADA
  const trackingSteps = [
    {
      stepIndex: 1,
      label: "PENDIENTE",
      isCompleted: currentStep > 1,
      isActive: currentStep === 1,
    },
    {
      stepIndex: 2,
      label: "EN REPARACIÓN",
      isCompleted: currentStep > 2,
      isActive: currentStep === 2,
    },
    {
      stepIndex: 3,
      label: "COMPLETADA",
      isCompleted: currentStep > 3,
      isActive: currentStep === 3,
    },
    {
      stepIndex: 4,
      label: "ENTREGADA",
      isCompleted: false,
      isActive: currentStep >= 4,
    },
  ];

  // Real bicycle data handling (No mock, nulls handled gracefully)
  const bikeMarca = order.bicicleta?.marca ? order.bicicleta.marca.trim() : "";
  const bikeModelo = order.bicicleta?.modelo ? order.bicicleta.modelo.trim() : "";
  const bikeTipo = order.bicicleta?.tipo ? order.bicicleta.tipo.trim() : "";
  const rawAno = order.bicicleta?.anio ?? order.bicicleta?.ano;
  const bikeAno = rawAno && !isNaN(Number(rawAno)) ? Number(rawAno) : null;
  const bikeColor = order.bicicleta?.color ? order.bicicleta.color.trim() : "";

  // Title: Marca + Modelo or clean fallback
  const titleParts = [bikeMarca, bikeModelo].filter(Boolean);
  const bikeTitle = titleParts.length > 0 ? titleParts.join(" ") : "Bicicleta";

  // Subtitle: Tipo · Año · Color
  const specParts = [
    bikeTipo,
    bikeAno ? String(bikeAno) : null,
    bikeColor,
  ].filter(
    (v): v is string =>
      Boolean(
        v &&
          v.toLowerCase() !== "null" &&
          v.toLowerCase() !== "undefined" &&
          v.toLowerCase() !== "n/a"
      )
  );
  const bikeSubtitle = specParts.join(" • ");

  // Real client name handling
  const rawClientName = order.clienteNombre?.trim();
  const hasValidClientName = Boolean(
    rawClientName &&
      rawClientName.toLowerCase() !== "null" &&
      rawClientName.toLowerCase() !== "undefined"
  );
  const clientName = hasValidClientName ? rawClientName : "Cliente";

  // Formatted date and time for entry date
  const ingresoParts = formatFriendlyDateParts(order.fechaRecepcion);
  const ingresoTexto = ingresoParts
    ? `${ingresoParts.date} ${ingresoParts.time}`
    : "No registrada";

  // Real photo: only use if exists in order.fotos or order.bicicleta.fotoUrl
  const fotoPrincipal = order.fotos && order.fotos.length > 0 ? order.fotos[0].url : order.bicicleta?.fotoUrl || null;

  return (
    <div
      style={{ height: "100dvh" }}
      className="w-full h-screen h-[100dvh] flex flex-col overflow-hidden bg-[#f8fafc] text-[#0F0F0F] selection:bg-[#84924A]/20 antialiased font-sans"
    >
      <style>{`
        @media (max-height: 500px) {
          .portal-header-box { padding-top: 4px !important; padding-bottom: 4px !important; }
          .portal-logo-img { max-width: 130px !important; width: 28% !important; }
          .portal-footer-box { padding-top: 4px !important; }
        }
      `}</style>
      {/* HEADER ESTRUCTURAL OSCURO FULL WIDTH CON LOGO REAL CENTRADO - FIJO */}
      <header
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className="w-full flex-none shrink-0 m-0 bg-[#0F0F0F] border-b border-[#1f1f1f] z-30 print:hidden"
      >
        <div className="portal-header-box w-full py-1.5 min-[390px]:py-2 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ridelab-logo.png"
            alt="Ride Lab"
            className="portal-logo-img w-[43%] min-w-[140px] max-w-[185px] sm:max-w-[198px] h-auto object-contain block"
          />
        </div>
      </header>

      {/* CONTENIDO CENTRAL SCROLLABLE */}
      <main
        style={{ WebkitOverflowScrolling: "touch" }}
        className="flex-1 min-h-0 w-full overflow-y-auto overscroll-y-contain custom-scrollbar"
      >
        <div className="w-full max-w-[430px] sm:max-w-[450px] mx-auto px-3.5 min-[390px]:px-4 pt-3.5 sm:pt-4 pb-6 space-y-4">
        {/* CARD PRINCIPAL */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 space-y-3.5">
          {/* Top Row: CLIENTE (Left) and ORDEN DE TRABAJO (Right) */}
          <div className="flex justify-between gap-3 sm:gap-4 items-start">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                CLIENTE
              </span>
              <div
                className="text-sm min-[390px]:text-[15px] sm:text-base font-black text-[#0F0F0F] uppercase tracking-tight mt-0.5 truncate"
                title={clientName}
              >
                {clientName}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                ORDEN DE TRABAJO
              </span>
              <div className="font-mono text-[11px] min-[390px]:text-xs sm:text-[13px] font-bold text-[#0F0F0F] mt-0.5 truncate">
                {order.codigoOrden}
              </div>
            </div>
          </div>

          {/* Bottom Row: BICICLETA (Left) and FECHA DE INGRESO (Right) */}
          <div className="border-t border-slate-100/90 pt-3.5 flex justify-between gap-2.5 sm:gap-4 items-start">
            {/* LADO IZQUIERDO: BICICLETA */}
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
              {fotoPrincipal && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoPrincipal}
                  alt={bikeTitle}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-100 shrink-0 mt-0.5"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  BICICLETA
                </span>
                <div
                  className="text-sm min-[390px]:text-[15px] sm:text-base font-black text-[#0F0F0F] uppercase tracking-tight truncate mt-0.5"
                  title={bikeTitle}
                >
                  {bikeTitle}
                </div>
                {bikeSubtitle && (
                  <div
                    className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate mt-0.5"
                    title={bikeSubtitle}
                  >
                    {bikeSubtitle}
                  </div>
                )}
              </div>
            </div>

            {/* LADO DERECHO: FECHA DE INGRESO */}
            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                FECHA DE INGRESO
              </span>
              <div className="text-[10.5px] min-[390px]:text-[11.5px] sm:text-xs font-bold text-[#0F0F0F] whitespace-nowrap mt-0.5">
                {ingresoTexto}
              </div>
            </div>
          </div>
        </div>

        {/* CARD ESTATUS DE LA ORDEN */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5">
          <div className="mb-4">
            <span className="text-xs font-bold text-[#0F0F0F] tracking-wider uppercase block">
              ESTATUS DE LA ORDEN
            </span>
          </div>

          <div className="relative flex justify-between items-start pt-1 pb-1">
            {/* Background Track connecting step centers */}
            <div className="absolute left-[12%] right-[12%] top-3.5 h-[2px] bg-slate-200 -z-0">
              <div
                className="h-full bg-[#84924A] transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, ((currentStep - 1) / (trackingSteps.length - 1)) * 100)
                  )}%`,
                }}
              />
            </div>

            {trackingSteps.map((s) => {
              const isCompleted = s.isCompleted;
              const isActive = s.isActive;

              return (
                <div
                  key={s.stepIndex}
                  className="flex-1 flex flex-col items-center relative z-10 min-w-0 px-0.5"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted || isActive
                        ? "bg-[#84924A] text-white shadow-xs"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {isCompleted || isActive ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : null}
                  </div>

                  <span
                    className={`text-[9px] min-[390px]:text-[10px] sm:text-[11px] mt-2 tracking-tight text-center truncate max-w-full leading-tight uppercase ${
                      isCompleted || isActive
                        ? "text-[#334155] font-bold"
                        : "text-slate-400 font-medium"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD SERVICIOS CONTRATADOS */}
        {order.servicios && order.servicios.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F0F0F] tracking-wider uppercase">
                SERVICIOS CONTRATADOS
              </span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-400">
                Total: {order.servicios.length} ítems
              </span>
            </div>

            <div className="space-y-2">
              {order.servicios.map((srv, idx) => {
                const isDone = srv.completado || srv.estado === "COMPLETADO" || srv.estado === "FINALIZADO";
                const isEnCola =
                  srv.estado === "EN_COLA" ||
                  srv.estado === "PENDIENTE" ||
                  srv.estadoLabel?.toLowerCase().includes("cola") ||
                  srv.estadoLabel?.toLowerCase().includes("pendiente");

                return (
                  <div
                    key={idx}
                    className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-100/90 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-[#0F0F0F] truncate">
                        {srv.nombre}
                      </div>
                      {srv.descripcion && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {srv.descripcion}
                        </div>
                      )}
                    </div>

                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-[#84924A]/15 text-[#5e6931] border border-[#84924A]/30 shrink-0">
                        <span className="w-4 h-4 rounded-full bg-[#84924A] flex items-center justify-center text-white shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                        <span>{srv.estadoLabel || "Completado"}</span>
                      </span>
                    ) : isEnCola ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>{srv.estadoLabel || "En Cola"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-[#84924A]/15 text-[#5e6931] border border-[#84924A]/30 shrink-0">
                        <span className="w-4 h-4 rounded-full bg-[#84924A] flex items-center justify-center text-white shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                        <span>{srv.estadoLabel}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FOTOS DE RECEPCIÓN */}
        {order.fotos && order.fotos.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F0F0F] tracking-wider uppercase">
                FOTOS DE RECEPCIÓN
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-[#84924A]">
                {order.fotos.length} {order.fotos.length === 1 ? "foto adjunta" : "fotos adjuntas"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {order.fotos.map((f) => (
                <div
                  key={f.id}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 group shadow-2xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.descripcion || "Foto de recepción"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-2 left-2 right-2">
                    <span className="inline-block max-w-full truncate px-2.5 py-0.5 rounded-full bg-[#0F0F0F]/80 backdrop-blur-md text-white text-[10px] font-medium shadow-sm">
                      {f.descripcion || (f.esPrincipal ? "Foto Principal" : "Foto Recepción")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* BOTONES DE ACCIÓN: WHATSAPP, DESCARGAR FACTURA, LLAMADA */}
        <div className="space-y-2.5 pt-1 print:hidden">
          {downloadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center">
              {downloadError}
            </div>
          )}

          {/* WhatsApp Button - PRIMARY: verde Ride Lab real #84924A */}
          {order.empresa?.whatsappUrl && (
            <a
              href={order.empresa.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-2xl bg-[#84924A] hover:bg-[#74813e] active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-sm transition-all"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span>Consultar por WhatsApp</span>
            </a>
          )}

          {/* Two Buttons: Descargar Factura & Llamar al Taller */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              disabled={!order.esEntregada || !order.canDownloadInvoice || isDownloadingInvoice}
              title={
                !order.esEntregada
                  ? "Disponible cuando la orden sea entregada."
                  : !order.canDownloadInvoice
                  ? "La factura asociada no está disponible."
                  : undefined
              }
              onClick={handleDownloadInvoice}
              className={`h-11 sm:h-12 py-2.5 px-2 sm:px-3 rounded-xl font-semibold text-[11px] min-[390px]:text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-2xs transition-all ${
                order.esEntregada && order.canDownloadInvoice
                  ? "bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-[#0F0F0F] cursor-pointer"
                  : "bg-[#eef0f3] border border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isDownloadingInvoice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">Generando...</span>
                </>
              ) : order.esEntregada && order.canDownloadInvoice ? (
                <>
                  <Download className="w-4 h-4 shrink-0 text-[#334155]" />
                  <span className="whitespace-nowrap">Descargar Factura</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="whitespace-nowrap">Descargar Factura</span>
                </>
              )}
            </button>

            {order.empresa?.telefonoLlamada ? (
              <a
                href={order.empresa.telefonoLlamada}
                className="h-11 sm:h-12 py-2.5 px-2 sm:px-3 rounded-xl bg-white hover:bg-[#84924A]/5 active:bg-[#84924A]/10 border border-[#84924A] text-[#84924A] font-semibold text-[11px] min-[390px]:text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-2xs transition-all"
              >
                <Phone className="w-4 h-4 text-[#84924A] shrink-0" />
                <span className="whitespace-nowrap">Llamar al Taller</span>
              </a>
            ) : (
              <button
                disabled
                className="h-11 sm:h-12 py-2.5 px-2 sm:px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-[11px] min-[390px]:text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 cursor-not-allowed opacity-75"
              >
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="whitespace-nowrap">Llamar al Taller</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </main>

      {/* FOOTER OSCURO INTEGRADO (BASE #0F0F0F) - FIJO Y COMPACTO (~10% MÁS COMPACTO) */}
      <footer
        style={{
          height: "auto",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
        className="portal-footer-box w-full h-auto flex-none shrink-0 bg-[#0F0F0F] text-slate-400 border-t border-[#1f1f1f] z-30 pt-2 min-[390px]:pt-2.5 sm:pt-3 print:hidden"
      >
        <div className="w-full max-w-xl mx-auto px-3.5 sm:px-4 space-y-1.5 min-[390px]:space-y-2 text-center flex flex-col items-center">
          {order.empresa?.descripcion && (
            <p className="portal-footer-desc text-[10px] min-[370px]:text-[10.5px] min-[390px]:text-[11px] sm:text-xs text-slate-300 font-normal leading-tight line-clamp-2 max-w-full tracking-tight">
              {order.empresa.descripcion}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-3.5 sm:gap-x-4 gap-y-1 text-[10px] min-[390px]:text-[10.5px] sm:text-[11px] text-slate-300 leading-tight">
            {order.empresa?.telefono && (
              <div className="flex items-center gap-1 shrink-0">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{order.empresa.telefono}</span>
              </div>
            )}

            {order.empresa?.horario && (
              <div className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{order.empresa.horario}</span>
              </div>
            )}

            {order.empresa?.direccion && (
              <div className="flex items-center gap-1 text-center">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{order.empresa.direccion}</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#2d3748]/40 pt-1.5 w-full text-center">
            <p className="text-[9.5px] min-[390px]:text-[10px] sm:text-[10.5px] text-slate-400 font-normal leading-tight">
              © {new Date().getFullYear()} {order.empresa?.nombreComercial || "Ride Lab"}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
