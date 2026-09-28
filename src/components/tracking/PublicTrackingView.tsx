/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import {
  Check,
  Mail,
  RefreshCw,
  SearchX,
  Pause,
  Wrench,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { PublicWorkOrderDTO } from "@/lib/tracking/workOrderTrackingService";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#12161f] border border-[#232936] flex items-center justify-center mb-4 shadow-xl">
          <RefreshCw className="w-6 h-6 text-[#bfce7f] animate-spin" />
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-[#bfce7f] font-semibold">
          RIDE LAB
        </div>
        <p className="text-slate-400 text-xs mt-2 font-sans">
          Cargando seguimiento de reparación...
        </p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-[420px] w-full bg-[#12161f] border border-[#232936] rounded-2xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <SearchX className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#bfce7f]">
              RIDE LAB SEGUIMIENTO
            </span>
            <h1 className="text-lg font-bold text-slate-100 font-sans">
              Seguimiento no disponible
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
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
      activeColor: "#3b82f6",
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
  const bikeSubtitle = specParts.join(" · ");

  // Real client name handling (No mock, nulls handled gracefully)
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

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 selection:bg-[#bfce7f]/30 antialiased">
      <div className="w-full max-w-[440px] space-y-4">
        {/* Header: LOGO REAL RIDE LAB + Seguimiento de reparación */}
        <header className="flex flex-col items-center text-center pt-2 pb-1 space-y-1.5">
          <div className="h-10 sm:h-12 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ridelab-logo.png"
              alt="Ride Lab"
              className="h-9 sm:h-11 w-auto max-w-[200px] object-contain"
            />
          </div>
          <p className="text-xs text-slate-400 font-sans tracking-wide">
            Seguimiento de reparación
          </p>
        </header>

        {/* Main Compact Card */}
        <div className="bg-[#12161f] border border-[#232936] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 sm:space-y-5">
          {/* Top Section: OT Code + Status Badge, followed by Real Bicycle Info and Client */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-100">
                {order.codigoOrden}
              </div>

              <span
                className="px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wide uppercase shrink-0 border shadow-sm"
                style={{
                  backgroundColor: `${order.estadoColor || "#f59e0b"}15`,
                  color: order.estadoColor || "#f59e0b",
                  borderColor: `${order.estadoColor || "#f59e0b"}40`,
                }}
              >
                {order.estadoLabel}
              </span>
            </div>

            {/* Real Bicycle Info (Left) + Real Client Name (Right, text-right) */}
            <div className="flex items-start justify-between gap-3 pt-0.5">
              {/* Bloque Izquierdo: Bicicleta */}
              <div
                className="space-y-0.5 min-w-0 flex-1"
                data-testid="bicicleta-info"
                data-marca={bikeMarca || undefined}
                data-modelo={bikeModelo || undefined}
                data-tipo={bikeTipo || undefined}
                data-anio={bikeAno ? String(bikeAno) : undefined}
                data-color={bikeColor || undefined}
              >
                <div className="text-base sm:text-lg font-bold text-slate-100 font-sans uppercase tracking-tight truncate">
                  {bikeTitle}
                </div>
                {bikeSubtitle && (
                  <div className="text-xs font-mono text-[#bfce7f] uppercase tracking-wider font-semibold truncate">
                    {bikeSubtitle}
                  </div>
                )}
              </div>

              {/* Bloque Derecho: Cliente (alineado a la derecha) */}
              {clientName && (
                <div
                  className="text-right shrink-0 max-w-[45%] sm:max-w-[48%] space-y-0.5"
                  data-testid="cliente-info"
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
                    CLIENTE
                  </div>
                  <div
                    className="text-xs sm:text-sm font-semibold text-slate-200 font-sans leading-tight line-clamp-2 break-words"
                    title={clientName}
                  >
                    {clientName}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Canonical 4-Step Stepper Aligned Horizontally */}
          <div className="pt-2 pb-2">
            <div className="relative flex justify-between items-start">
              {/* Continuous track connecting step centers */}
              <div className="absolute left-[12%] right-[12%] top-3 h-[2px] bg-slate-800 -z-0">
                {/* Dynamic filled track according to completed progress */}
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 100)
                    )}%`,
                  }}
                />
              </div>

              {steps.map((s) => {
                const isStepCompleted = s.isCompleted;
                const isStepActive = s.isActive;
                const isHoldStep = order.isHold && s.stepIndex === 2;

                return (
                  <div
                    key={s.stepIndex}
                    className="flex-1 flex flex-col items-center relative z-10 min-w-0 px-0.5"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isStepCompleted
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : isStepActive
                          ? isHoldStep
                            ? "bg-rose-500 text-white ring-4 ring-rose-500/25 shadow-md scale-105"
                            : "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-md scale-105"
                          : "bg-[#141922] border-2 border-slate-700 text-slate-500"
                      }`}
                    >
                      {isStepCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : isStepActive ? (
                        isHoldStep ? (
                          <Pause className="w-3 h-3 fill-current" />
                        ) : s.stepIndex === 2 ? (
                          <Wrench className="w-3 h-3 stroke-[2.5]" />
                        ) : s.stepIndex === 3 ? (
                          <Truck className="w-3 h-3 stroke-[2.5]" />
                        ) : s.stepIndex === 4 ? (
                          <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-slate-950" />
                        )
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                      )}
                    </div>

                    <span
                      title={s.label}
                      className={`text-[9px] sm:text-[10px] font-mono mt-2 tracking-tight text-center truncate max-w-full leading-tight uppercase ${
                        isStepActive
                          ? isHoldStep
                            ? "text-rose-400 font-extrabold"
                            : "text-amber-400 font-extrabold"
                          : isStepCompleted
                          ? "text-slate-300 font-medium"
                          : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dates: Fecha de Ingreso (Izquierda) y Última Actualización (Derecha) */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#232936]">
            {/* Column 1: Fecha de Ingreso */}
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-semibold truncate">
                Fecha de ingreso
              </span>
              {ingresoParts ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs sm:text-sm leading-snug">
                  <span className="font-semibold text-slate-100 whitespace-nowrap">
                    {ingresoParts.date}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] sm:text-xs whitespace-nowrap">
                    {ingresoParts.time}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs mt-1 block">No registrada</span>
              )}
            </div>

            {/* Column 2: Última Actualización (Alineada a la derecha) */}
            <div className="min-w-0 text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-semibold truncate">
                Última actualización
              </span>
              {actualizacionParts ? (
                <div className="mt-1 flex flex-wrap items-baseline justify-end gap-x-1.5 text-xs sm:text-sm leading-snug">
                  <span className="font-semibold text-slate-100 whitespace-nowrap">
                    {actualizacionParts.date}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] sm:text-xs whitespace-nowrap">
                    {actualizacionParts.time}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs mt-1 block">No registrada</span>
              )}
            </div>
          </div>

          <div className="border-t border-[#232936]" />

          {/* Current State Message Card */}
          <div className="p-3.5 rounded-xl bg-[#141922] border border-[#232936] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1c222e] border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
              <Mail className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              “{order.statusMessage || "Nuestro equipo está trabajando en tu bicicleta."}”
            </p>
          </div>

          {/* Compact Services List */}
          {order.servicios && order.servicios.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Servicios
              </h3>
              <div className="space-y-2">
                {order.servicios.map((srv, idx) => {
                  const isDone = srv.completado || srv.estado === "COMPLETADO";
                  const isInProgress =
                    !isDone &&
                    (srv.estado === "EN_PROCESO" || srv.estado === "EN PROCESO");

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-[#141922] border border-[#232936]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isDone ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : isInProgress ? (
                          <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          </div>
                        )}
                        <span className="text-xs text-slate-200 font-medium truncate">
                          {srv.nombre}
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-mono font-medium shrink-0 ${
                          isDone
                            ? "text-emerald-400"
                            : isInProgress
                            ? "text-amber-400"
                            : "text-slate-400"
                        }`}
                      >
                        {srv.estadoLabel ||
                          (isDone ? "Completado" : isInProgress ? "En proceso" : "Pendiente")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Discreet footer */}
        <footer className="pt-2 text-center text-[10px] font-mono text-slate-400">
          Ride Lab • Taller Especializado
        </footer>
      </div>
    </div>
  );
}
