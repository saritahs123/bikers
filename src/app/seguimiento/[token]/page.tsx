/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import {
  Check,
  Mail,
  RefreshCw,
  SearchX
} from "lucide-react";

interface PublicWorkOrderDTO {
  codigoOrden: string;
  estado: string;
  estadoLabel: string;
  estadoColor: string;
  pasoActual: number;
  pasosTotales: number;
  esEntregada: boolean;
  fechaRecepcion: string;
  fechaPrometidaEstimada: string | null;
  fechaEntregaReal: string | null;
  ultimaActualizacion: string;
  clienteNombre?: string | null;
  bicicleta: {
    marca: string | null;
    modelo: string | null;
    tipo: string | null;
    color: string | null;
    ano: number | null;
    anio?: number | null;
    fotoUrl: string | null;
  };
  timeline?: Array<{
    id: number;
    estadoCodigo: string;
    estadoLabel: string;
    color: string;
    fecha: string;
    comentario: string;
    esEstadoActual: boolean;
  }>;
  servicios: Array<{
    secuencia: number;
    nombre: string;
    estado: string;
    estadoLabel: string;
    completado: boolean;
  }>;
}

const STEP_DEFINITIONS = [
  { paso: 1, key: "RECIBIDA", title: "Recibida" },
  { paso: 2, key: "DIAGNOSTICO", title: "Diagnóstico" },
  { paso: 3, key: "REPARACION", title: "En reparación" },
  { paso: 4, key: "LISTA_ENTREGA", title: "Lista" },
  { paso: 5, key: "ENTREGADA", title: "Entregada" }
];

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
      "dic"
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
      time: `${hours}:${minutes} ${ampm}`
    };
  } catch {
    return null;
  }
}

function getCurrentStateMessage(order: PublicWorkOrderDTO): string {
  const code = (order.estado || "").toUpperCase();
  const label = (order.estadoLabel || "").toUpperCase();

  if (order.esEntregada || code === "ENTREGADA" || label.includes("ENTREGADA")) {
    return "La reparación fue completada y la bicicleta fue entregada.";
  }
  if (code.includes("LISTA") || label.includes("LISTA") || code === "COMPLETADA") {
    return "Tu bicicleta está lista para ser retirada.";
  }
  if (code === "REPARACION" || code === "EN_REPARACION" || label.includes("REPARACI")) {
    return "El técnico está realizando los trabajos aprobados.";
  }
  if (code === "DIAGNOSTICO" || code === "EVALUACION" || label.includes("DIAGN")) {
    return "El equipo se encuentra en proceso de diagnóstico.";
  }
  if (code === "RECIBIDA" || code === "PENDIENTE" || label.includes("RECIBIDA")) {
    return "Tu bicicleta fue recibida correctamente.";
  }
  if (code === "HOLD" || code === "EN_HOLD" || label.includes("HOLD")) {
    return "El trabajo está en pausa esperando aprobación o piezas requeridas.";
  }
  if (code === "APROBACION" || label.includes("APROBACI")) {
    return "Pendiente de tu confirmación para proceder con los trabajos.";
  }
  return "El técnico está realizando los trabajos aprobados.";
}

export default function PublicTrackingPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [order, setOrder] = useState<PublicWorkOrderDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  const fetchTrackingData = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/public/tracking/${encodeURIComponent(token)}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
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
  }, [token]);

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

  // Determine current step index
  const isDelivered = order.esEntregada || order.estado === "ENTREGADA";
  let currentStep = order.pasoActual || 1;
  const stateCode = (order.estado || "").toUpperCase();
  if (isDelivered) {
    currentStep = 5;
  } else if (stateCode.includes("LISTA") || order.estadoLabel?.toLowerCase().includes("lista")) {
    currentStep = 4;
  } else if (stateCode.includes("REPARAC") || order.estadoLabel?.toLowerCase().includes("reparac")) {
    currentStep = 3;
  } else if (stateCode.includes("DIAGN") || order.estadoLabel?.toLowerCase().includes("diagn")) {
    currentStep = 2;
  } else if (stateCode.includes("RECIBIDA") || stateCode.includes("PENDIENTE")) {
    currentStep = 1;
  }
  currentStep = Math.min(5, Math.max(1, currentStep));

  // Determine latest update timestamp
  const latestUpdateDate =
    order.ultimaActualizacion ||
    (order.timeline && order.timeline.length > 0
      ? order.timeline[order.timeline.length - 1]?.fecha
      : null) ||
    order.fechaRecepcion;

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
    bikeColor
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
  const actualizacionParts = formatFriendlyDateParts(latestUpdateDate);

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
                  borderColor: `${order.estadoColor || "#f59e0b"}40`
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

          {/* Horizontal Progress Stepper */}
          <div className="pt-1 pb-1">
            <div className="flex items-center justify-between">
              {STEP_DEFINITIONS.map((s, idx) => {
                const isStepCompleted = s.paso < currentStep || (isDelivered && s.paso === 5);
                const isStepCurrent = s.paso === currentStep && !isDelivered;

                const hasNext = idx < STEP_DEFINITIONS.length - 1;
                let lineClass = "bg-slate-800";
                if (isDelivered) {
                  lineClass = "bg-emerald-500";
                } else if (idx < currentStep - 1) {
                  lineClass = "bg-emerald-500";
                } else if (idx === currentStep - 1) {
                  lineClass = "bg-gradient-to-r from-emerald-500 to-amber-500";
                }

                return (
                  <React.Fragment key={s.paso}>
                    <div className="flex flex-col items-center z-10 shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isStepCompleted
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                            : isStepCurrent
                            ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-md scale-105"
                            : "bg-[#141922] border-2 border-slate-700 text-slate-500"
                        }`}
                      >
                        {isStepCompleted ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isStepCurrent ? (
                          <div className="w-2 h-2 rounded-full bg-slate-950" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] mt-1.5 tracking-tight text-center whitespace-nowrap ${
                          isStepCurrent
                            ? "text-amber-400 font-bold"
                            : isStepCompleted
                            ? "text-slate-300 font-medium"
                            : "text-slate-500"
                        }`}
                      >
                        {s.title}
                      </span>
                    </div>

                    {hasNext && (
                      <div className="flex-1 h-[2px] mx-1 mb-5 transition-colors">
                        <div className={`h-full w-full ${lineClass}`} />
                      </div>
                    )}
                  </React.Fragment>
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
              “{getCurrentStateMessage(order)}”
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
