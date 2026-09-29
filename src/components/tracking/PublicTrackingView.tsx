/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import {
  Check,
  SearchX,
  RefreshCw,
  Settings,
  User,
  Calendar,
  Clock,
  Wrench,
  Sparkles,
  Camera,
  Phone,
  Download,
  ChevronRight,
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

function getStatusBadgeStyle(estadoCodigo?: string | null, isHold = false) {
  const code = (estadoCodigo || "").trim().toUpperCase();
  if (isHold) {
    return {
      bg: "bg-rose-50",
      text: "text-rose-600",
      border: "border-rose-200",
      dot: "bg-rose-500",
    };
  }
  if (
    code === "COMPLETADA" ||
    code === "LISTA_ENTREGA" ||
    code === "ENTREGADA" ||
    code === "ENTREGADO"
  ) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (
    code === "PENDIENTE" ||
    code === "RECIBIDA" ||
    code === "REPARACION" ||
    code === "EN REPARACION" ||
    code === "EN_REPARACION"
  ) {
    return {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
      dot: "bg-orange-500",
    };
  }
  return {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };
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
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-center items-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center mb-4 shadow-sm">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ridelab-logo-white.png"
          alt="Ride Lab"
          className="h-7 w-auto object-contain mb-2"
        />
        <p className="text-slate-400 text-xs font-sans">
          Cargando seguimiento de reparación...
        </p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="max-w-[420px] w-full bg-white border border-slate-200/80 rounded-2xl p-6 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mx-auto flex items-center justify-center">
            <SearchX className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              RIDE LAB SEGUIMIENTO
            </span>
            <h1 className="text-lg font-bold text-slate-900 font-sans">
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

  // Determine steps from pipeline configuration (or fallback to canonical 4 steps)
  const steps = order.pipelineSteps || [
    {
      stepIndex: 1,
      key: "RECIBIDA",
      label: "PENDIENTE",
      activeColor: "#f97316",
      isCompleted: order.pasoActual > 1,
      isActive: order.pasoActual === 1,
    },
    {
      stepIndex: 2,
      key: "REPARACION",
      label: order.isHold ? "EN HOLD" : "EN REPARACION",
      activeColor: order.isHold ? "#ef4444" : "#f97316",
      isCompleted: order.pasoActual > 2,
      isActive: order.pasoActual === 2,
    },
    {
      stepIndex: 3,
      key: "LISTA_ENTREGA",
      label: "COMPLETADA",
      activeColor: "#10b981",
      isCompleted: order.pasoActual > 3,
      isActive: order.pasoActual === 3,
    },
    {
      stepIndex: 4,
      key: "ENTREGADA",
      label: "ENTREGADA",
      activeColor: "#059669",
      isCompleted: false,
      isActive: order.pasoActual === 4,
    },
  ];

  const currentStep = order.pasoActual || 1;

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
  const clientName = hasValidClientName ? rawClientName : null;

  // Formatted date and time pairs for two-column row
  const ingresoParts = formatFriendlyDateParts(order.fechaRecepcion);
  const actualizacionParts = formatFriendlyDateParts(order.ultimaActualizacion);

  // Badge style for current state
  const badgeStyle = getStatusBadgeStyle(order.estado, order.isHold);

  // Real photo: only use if exists in order.fotos or order.bicicleta.fotoUrl
  const fotoPrincipal = order.fotos && order.fotos.length > 0 ? order.fotos[0].url : order.bicicleta?.fotoUrl || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-start selection:bg-emerald-500/20 antialiased">
      {/* 3. HEADER BLANCO FIJO CON LOGO REAL RIDE LAB | TIENDA Y TALLER DE BICICLETAS */}
      <header className="w-full bg-white border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sticky top-0 z-30 print:hidden">
        <div className="max-w-[440px] mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-center gap-2.5 sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ridelab-logo-white.png"
            alt="Ride Lab"
            className="h-7 sm:h-8 w-auto object-contain shrink-0"
          />
          <span className="text-[11px] min-[390px]:text-xs sm:text-[13px] font-black text-black tracking-tight uppercase whitespace-nowrap">
            TIENDA Y TALLER DE BICICLETAS
          </span>
        </div>
      </header>

      {/* Main Content Container: Mobile-first centered */}
      <main className="w-full max-w-[430px] sm:max-w-[450px] mx-auto px-4 pt-2 pb-6 space-y-3.5">
        {/* 4. HERO SECTION */}
        <section className="text-center pt-2 pb-1 space-y-1.5 print:pt-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] text-[11px] font-bold tracking-wider uppercase shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            PORTAL DE CLIENTES EN VIVO
          </div>
          <h1 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
            Seguimiento de reparación
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 font-normal leading-relaxed">
            Información actualizada al instante desde nuestro box mecánico
          </p>
        </section>

        {/* 5. CARD ORDEN DE TRABAJO */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3.5">
          {/* Top Row: ORDEN DE TRABAJO (Left) and CLIENTE (Right) */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Settings className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  ORDEN DE TRABAJO
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {order.codigoOrden}
              </div>
            </div>

            {clientName && (
              <div className="text-right">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  CLIENTE
                </span>
                <div className="flex items-center justify-end gap-1.5 text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate max-w-[170px]" title={clientName}>
                    {clientName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Middle Row: Bicycle Details (Left with optional photo) and Status Badge (Right) */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              {fotoPrincipal && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoPrincipal}
                  alt={bikeTitle}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-100 shadow-2xs shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight truncate">
                  {bikeTitle}
                </div>
                {bikeSubtitle && (
                  <div className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                    {bikeSubtitle}
                  </div>
                )}
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${badgeStyle.dot}`} />
              {order.estadoLabel}
            </span>
          </div>
        </div>

        {/* 8 & 9. CARD ESTADO DE LA REPARACIÓN & STEPPER */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              ESTADO DE LA REPARACIÓN
            </span>
          </div>

          <div className="relative flex justify-between items-start pt-1 pb-1">
            {/* Background Track connecting step centers */}
            <div className="absolute left-[12%] right-[12%] top-3.5 h-[2px] bg-slate-200 -z-0">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 100)
                  )}%`,
                }}
              />
            </div>

            {steps.map((s) => {
              const isCompleted = s.isCompleted;
              const isActive = s.isActive;
              const isOrangeActive = isActive && s.stepIndex <= 2;
              const isGreenActive = isActive && s.stepIndex >= 3;

              return (
                <div
                  key={s.stepIndex}
                  className="flex-1 flex flex-col items-center relative z-10 min-w-0 px-0.5"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? "bg-emerald-600 text-white shadow-xs"
                        : isOrangeActive
                        ? "bg-orange-500 text-white ring-4 ring-orange-500/20 shadow-xs"
                        : isGreenActive
                        ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-100 border border-slate-200 text-slate-400"
                    }`}
                  >
                    {isCompleted || isGreenActive ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : isOrangeActive ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>

                  <span
                    className={`text-[9px] min-[390px]:text-[10px] sm:text-[11px] font-bold mt-2 tracking-tight text-center truncate max-w-full leading-tight uppercase ${
                      isCompleted
                        ? "text-emerald-700"
                        : isOrangeActive
                        ? "text-orange-600 font-extrabold"
                        : isGreenActive
                        ? "text-emerald-700 font-extrabold"
                        : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 10. FECHAS: INGRESO & ÚLTIMA ACTUALIZACIÓN (Fecha y hora en una sola línea horizontal) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 items-stretch">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5 min-[390px]:p-3.5 sm:p-4 flex items-start gap-2 min-[390px]:gap-2.5 sm:gap-3 h-full">
            <div className="w-[34px] h-[34px] min-[390px]:w-9 min-[390px]:h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 min-[390px]:w-[18px] min-[390px]:h-[18px] sm:w-5 sm:h-5 text-slate-700" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-start">
              <div
                className="flex items-start"
                style={{ height: "30px", minHeight: "30px", maxHeight: "30px" }}
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-[14px] sm:leading-[15px] block">
                  FECHA DE INGRESO
                </span>
              </div>
              <div className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap mt-1 min-w-0">
                <span className="text-[10px] min-[380px]:text-[11px] min-[410px]:text-xs sm:text-[13px] font-bold text-slate-900 shrink-0">
                  {ingresoParts?.date || "No registrada"}
                </span>
                {ingresoParts?.time && (
                  <span className="text-[9px] min-[380px]:text-[10px] min-[410px]:text-[11px] sm:text-xs font-normal text-slate-500 shrink-0">
                    {ingresoParts.time}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5 min-[390px]:p-3.5 sm:p-4 flex items-start gap-2 min-[390px]:gap-2.5 sm:gap-3 h-full">
            <div className="w-[34px] h-[34px] min-[390px]:w-9 min-[390px]:h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
              <Clock className="w-4 h-4 min-[390px]:w-[18px] min-[390px]:h-[18px] sm:w-5 sm:h-5 text-slate-700" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-start">
              <div
                className="flex items-start"
                style={{ height: "30px", minHeight: "30px", maxHeight: "30px" }}
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-[14px] sm:leading-[15px] block">
                  ÚLTIMA ACTUALIZACIÓN
                </span>
              </div>
              <div className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap mt-1 min-w-0">
                <span className="text-[10px] min-[380px]:text-[11px] min-[410px]:text-xs sm:text-[13px] font-bold text-slate-900 shrink-0">
                  {actualizacionParts?.date || "No registrada"}
                </span>
                {actualizacionParts?.time && (
                  <span className="text-[9px] min-[380px]:text-[10px] min-[410px]:text-[11px] sm:text-xs font-normal text-slate-500 shrink-0">
                    {actualizacionParts.time}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 11. MENSAJE DEL ESTADO */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl p-4 flex items-start gap-3.5 shadow-2xs">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-[#065f46] leading-snug">
              “{order.statusMessage}”
            </p>
          </div>
        </div>

        {/* 12 & 13. SERVICIOS CONTRATADOS */}
        {order.servicios && order.servicios.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                  SERVICIOS CONTRATADOS
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400">
                Total: {order.servicios.length} ítems
              </span>
            </div>

            <div className="space-y-2">
              {order.servicios.map((srv, idx) => {
                const isDone = srv.completado || srv.estado === "COMPLETADO";
                const isEnCola =
                  srv.estado === "EN_COLA" ||
                  srv.estadoLabel?.toLowerCase().includes("cola");

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-100/90 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {srv.nombre}
                        </div>
                        {srv.descripcion && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {srv.descripcion}
                          </div>
                        )}
                      </div>
                    </div>

                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {srv.estadoLabel}
                      </span>
                    ) : isEnCola ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {srv.estadoLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {srv.estadoLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 14 & 15. FOTOS DE RECEPCIÓN */}
        {order.fotos && order.fotos.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                  FOTOS DE RECEPCIÓN
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-600">
                {order.fotos.length} fotos adjuntas
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
                    <span className="inline-block max-w-full truncate px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-medium shadow-sm">
                      {f.descripcion || (f.esPrincipal ? "Foto Principal" : "Foto Recepción")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 16, 17, 18. BOTONES DE ACCIÓN: WHATSAPP, DESCARGAR FACTURA, LLAMADA */}
        <div className="space-y-2.5 pt-1 print:hidden">
          {downloadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center">
              {downloadError}
            </div>
          )}

          {/* WhatsApp Button */}
          {order.empresa?.whatsappUrl && (
            <a
              href={order.empresa.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-2xl bg-[#00a884] hover:bg-[#008f6f] active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-between shadow-sm transition-all"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Consultar por WhatsApp</span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80" />
            </a>
          )}

          {/* Two Buttons: Descargar Factura & Llamar al Taller (Aligned 50/50, same height, full text on mobile) */}
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
                  ? "bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 cursor-pointer"
                  : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-75"
              }`}
            >
              {isDownloadingInvoice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">Generando...</span>
                </>
              ) : (
                <>
                  <Download
                    className={`w-4 h-4 shrink-0 ${
                      order.esEntregada && order.canDownloadInvoice ? "text-slate-700" : "text-slate-400"
                    }`}
                  />
                  <span className="whitespace-nowrap">Descargar Factura</span>
                </>
              )}
            </button>

            {order.empresa?.telefonoLlamada ? (
              <a
                href={order.empresa.telefonoLlamada}
                className="h-11 sm:h-12 py-2.5 px-2 sm:px-3 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-[11px] min-[390px]:text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-2xs transition-all"
              >
                <Phone className="w-4 h-4 text-slate-700 shrink-0" />
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
      </main>

      {/* 19-30. FOOTER OSCURO ESTRUCTURAL INTEGRADO CON DATOS DINÁMICOS DE admin.empresa */}
      <footer className="w-full bg-[#0a0d14] text-slate-400 mt-10 pt-8 pb-10 border-t border-slate-900 print:hidden">
        <div className="w-full max-w-[430px] sm:max-w-[450px] mx-auto px-4 space-y-4">
          {order.empresa?.descripcion && (
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              {order.empresa.descripcion}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
            {order.empresa?.telefono && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{order.empresa.telefono}</span>
              </div>
            )}

            {/* Cleanly omitted if not present in admin.empresa */}
            {order.empresa?.horario && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{order.empresa.horario}</span>
              </div>
            )}

            {order.empresa?.direccion && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{order.empresa.direccion}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/80 pt-4 text-center">
            <p className="text-[11px] text-slate-500 font-normal">
              © {new Date().getFullYear()} {order.empresa?.nombreComercial || "Ride Lab"}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
