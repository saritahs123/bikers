"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Wrench,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  Maximize,
  Minimize,
  Bike,
  User,
  AlertCircle,
  Loader2,
  Calendar,
  X
} from "lucide-react";

const PERIOD_OPTIONS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "custom", label: "Personalizado" }
];

const KANBAN_COLUMNS = [
  {
    key: "RECIBIDAS",
    codigos: ["RECIBIDA", "RECIBIDAS", "DIAGNOSTICO", "APROBACION", "REPUESTOS"],
    estado_ids: [1, 2, 3, 4],
    title: "PENDIENTE",
    subtitle: "Pendientes de inicio",
    icon: Clock,
    headerColor: "text-sky-500 dark:text-sky-400",
    badgeBg: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
    borderTop: "border-t-sky-500",
    cardAccent: "border-l-sky-500"
  },
  {
    key: "REPARACION",
    codigos: ["REPARACION", "EN_REPARACION", "CALIDAD"],
    estado_ids: [5, 6],
    title: "EN EJECUCIÓN",
    subtitle: "Trabajo técnico activo",
    icon: Wrench,
    headerColor: "text-amber-500 dark:text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    borderTop: "border-t-amber-500",
    cardAccent: "border-l-amber-500"
  },
  {
    key: "LISTA_ENTREGA",
    codigos: ["LISTA_ENTREGA", "LISTA_PARA_ENTREGA", "LISTAS_PARA_ENTREGA"],
    estado_ids: [7],
    title: "COMPLETADA",
    subtitle: "Lista para entrega",
    icon: ClipboardCheck,
    headerColor: "text-emerald-500 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    borderTop: "border-t-emerald-500",
    cardAccent: "border-l-emerald-500"
  },
  {
    key: "ENTREGADAS",
    codigos: ["ENTREGADA", "ENTREGADAS"],
    estado_ids: [8],
    title: "ENTREGADA",
    subtitle: "Finalizadas",
    icon: CheckCircle2,
    headerColor: "text-slate-500 dark:text-slate-300",
    badgeBg: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
    borderTop: "border-t-slate-500",
    cardAccent: "border-l-slate-500"
  }
];

export default function WorkOrdersKanbanView({ onViewDetail, onOpenNewModal, onToggleList }) {
  const containerRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("hoy");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error al cambiar modo de pantalla completa:", err);
    }
  };

  // Fetch orders from PostgreSQL with timezone and period
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setIsRefreshing(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");

      if (selectedPeriod === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      } else {
        params.set("period", selectedPeriod);
      }

      const res = await fetch(`/api/taller/ordenes?${params.toString()}`);
      if (res.status === 401) {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return;
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        if (!isSilent) {
          throw new Error(res.ok ? "Respuesta inválida del servidor." : `Error del servidor (${res.status})`);
        }
        return;
      }

      if (!res.ok) {
        if (!isSilent) {
          throw new Error(data?.message || data?.error || "Error al consultar las órdenes del taller.");
        }
        return;
      }

      setOrders(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("fetchOrders Kanban Error:", err);
      if (!isSilent) {
        setError(err.message);
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedPeriod, customFrom, customTo]);

  // Initial load and on period change
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Auto-refresh every 10 seconds for live monitor (transparent in background)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handlePeriodChange = (periodId) => {
    if (periodId === "custom") {
      setShowCustomModal(true);
    } else {
      setSelectedPeriod(periodId);
    }
  };

  const handleApplyCustomPeriod = () => {
    setSelectedPeriod("custom");
    setShowCustomModal(false);
  };

  const formatTimeAgo = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-DO", {
      timeZone: "America/Santo_Domingo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Group orders by column
  const getOrdersForColumn = (column) => {
    return orders.filter((o) => {
      const codigo = String(o.estado_codigo || "").trim().toUpperCase();
      if (codigo && column.codigos) {
        return column.codigos.includes(codigo);
      }
      if (o.estado_orden_id && column.estado_ids) {
        return column.estado_ids.includes(Number(o.estado_orden_id));
      }
      return false;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col space-y-6 font-sans text-foreground transition-colors ${
        isFullscreen ? "bg-background p-6 md:p-8 min-h-screen overflow-y-auto" : ""
      }`}
    >
      {/* 1. ENCABEZADO: FLUJO DE TALLER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border">
        {/* Lado Izquierdo */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight font-sans uppercase">
            Flujo de taller
          </h1>
        </div>

        {/* Lado Derecho: Controles Operativos */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Período Segmentado */}
          <div className="bg-surface border border-border p-1 rounded-xl flex items-center shadow-sm">
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = selectedPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handlePeriodChange(opt.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-hover"
                  }`}
                >
                  {opt.label}
                  {opt.id === "custom" && customFrom && customTo && selectedPeriod === "custom" && (
                    <span className="ml-1 text-[10px] opacity-80">({customFrom})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Indicador de Última Actualización */}
          {lastUpdated && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-mono text-foreground-muted">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{formatTimeAgo(lastUpdated)}</span>
            </div>
          )}

          {/* Botón Compacto de Actualizar */}
          <button
            onClick={() => fetchOrders(false)}
            disabled={isRefreshing}
            className="p-2.5 bg-surface hover:bg-hover border border-border text-foreground-secondary hover:text-primary rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Actualizar datos ahora"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Botón de Pantalla Completa para Proyección en TV */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-hover border border-border text-foreground rounded-xl transition-all shadow-sm text-xs font-mono font-bold cursor-pointer"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa para TV / Monitor"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4 text-amber-500" />
                <span className="hidden md:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-primary" />
                <span className="hidden md:inline">Pantalla Completa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal para Período Personalizado */}
      {mounted && showCustomModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="w-[440px] max-w-[95vw] bg-card border border-border rounded-2xl p-6 shadow-2xl text-foreground flex flex-col gap-5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">
                      Rango de Fecha Personalizado
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground cursor-pointer"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Inputs en 2 columnas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-wider">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full bg-input border border-border rounded-xl p-2.5 text-xs text-foreground font-mono outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-wider">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full bg-input border border-border rounded-xl p-2.5 text-xs text-foreground font-mono outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="px-4 py-2 bg-surface hover:bg-hover text-foreground-muted hover:text-foreground font-mono font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomPeriod}
                    disabled={!customFrom || !customTo}
                    className="px-5 py-2 bg-primary-button-bg text-primary-foreground font-mono font-bold rounded-xl text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                  >
                    Aplicar Filtro
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* 2. TABLERO KANBAN — 4 COLUMNAS SIMULTÁNEAS OPTIMIZADAS PARA PANTALLA GRANDE / TV */}
      {loading && !orders.length ? (
        <div className="p-16 flex flex-col items-center justify-center bg-card/60 border border-border rounded-2xl text-foreground-muted gap-3 min-h-[420px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-mono tracking-wide">Cargando flujo de taller en tiempo real...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-error-muted border border-error/30 rounded-2xl text-error text-sm font-mono text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-error" />
          <p>{error}</p>
          <button
            onClick={() => fetchOrders(false)}
            className="px-4 py-2 bg-card border border-border text-foreground hover:bg-hover rounded-xl font-bold transition-all cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-4.5 2xl:gap-5 w-full items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = getOrdersForColumn(col);
            const IconComponent = col.icon;

            return (
              <div
                key={col.key}
                className={`bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-lg ${col.borderTop} border-t-4 transition-all`}
              >
                {/* Encabezado de Columna */}
                <div className="p-3.5 bg-surface/90 border-b border-border flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-card border border-border ${col.headerColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className={`font-mono text-xs md:text-sm font-extrabold tracking-wider uppercase ${col.headerColor}`}>
                        {col.title}
                      </h2>
                      <p className="text-[11px] text-foreground-muted font-sans">{col.subtitle}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${col.badgeBg}`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Lista de Tarjetas Operativas (No Clickeables, Formato Grande para TV/Monitor) */}
                <div className={`p-3 space-y-3 overflow-y-auto custom-scrollbar min-h-[200px] ${
                  isFullscreen ? "max-h-[calc(100vh-190px)]" : "max-h-[calc(100vh-250px)]"
                }`}>
                  {colOrders.length === 0 ? (
                    <div className="py-12 px-4 text-center text-foreground-muted text-xs font-mono border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2">
                      <IconComponent className="w-5 h-5 opacity-40 mb-0.5" />
                      <span>Sin órdenes en esta etapa</span>
                    </div>
                  ) : (
                    colOrders.map((ord) => {
                      const bikeDescriptor =
                        ord.bicicleta_marca || ord.bicicleta_modelo
                          ? `${ord.bicicleta_marca || ""} ${ord.bicicleta_modelo || ""}`.trim()
                          : "Bicicleta de taller";

                      return (
                        <div
                          key={ord.orden_id || ord.orden_trabajo_id}
                          className={`bg-surface border border-border border-l-4 ${col.cardAccent} rounded-xl p-4 space-y-2.5 shadow-sm select-none transition-all cursor-default`}
                        >
                          {/* 1. NÚMERO DE ORDEN Y FECHA(S) */}
                          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 min-w-0">
                            <span className="font-mono text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-foreground tracking-tight whitespace-nowrap shrink-0">
                              {ord.codigo_orden}
                            </span>

                            {/* Fechas según columna */}
                            {(col.key === "RECIBIDAS" || col.key === "REPARACION") && (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-foreground-muted shrink-0 text-right">
                                <Calendar className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                                <span>{formatDate(ord.fecha_registro || ord.fecha_ingreso)}</span>
                              </div>
                            )}

                            {col.key === "LISTA_ENTREGA" && (
                              <div className="flex flex-col items-end font-mono text-[10px] sm:text-[11px] text-foreground-muted shrink-0 leading-tight gap-0.5 text-right">
                                <span>
                                  <span className="text-foreground-muted">Creación: </span>
                                  <span className="text-foreground-secondary font-semibold">{formatDate(ord.fecha_registro || ord.fecha_ingreso)}</span>
                                </span>
                                <span>
                                  <span className="text-emerald-500 font-medium">Completada: </span>
                                  <span className="text-emerald-400 font-bold">{formatDate(ord.fecha_finalizacion || ord.fecha_termino)}</span>
                                </span>
                              </div>
                            )}

                            {col.key === "ENTREGADAS" && (
                              <div className="flex flex-col items-end font-mono text-[10px] sm:text-[11px] text-foreground-muted shrink-0 leading-tight gap-0.5 text-right">
                                <span>
                                  <span className="text-foreground-muted">Creación: </span>
                                  <span className="text-foreground-secondary font-semibold">{formatDate(ord.fecha_registro || ord.fecha_ingreso)}</span>
                                </span>
                                <span>
                                  <span className="text-slate-400 font-medium">Entregada: </span>
                                  <span className="text-slate-300 font-bold">{formatDate(ord.fecha_entrega_real)}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 2. BICICLETA + CLIENTE EN LA MISMA LÍNEA */}
                          <div className="flex items-start justify-between gap-2.5 min-w-0">
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              <Bike className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-foreground leading-tight break-words whitespace-normal">
                                {bikeDescriptor}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5 min-w-0 shrink-0 max-w-[50%] font-sans">
                              <User className="w-3 h-3 text-foreground-muted shrink-0 mt-0.5" />
                              <span className="text-[11px] font-medium text-foreground-muted leading-tight break-words whitespace-normal text-right">
                                {ord.cliente_nombre || "Cliente Sin Nombre"}
                              </span>
                            </div>
                          </div>

                          {/* 3. PRIMER SERVICIO */}
                          <div className="flex items-start gap-2 min-w-0 pt-0.5">
                            <Wrench className="w-3.5 h-3.5 text-foreground-muted shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm font-sans font-medium text-foreground-muted leading-snug break-words whitespace-normal flex-1 min-w-0">
                              {ord.primer_servicio || "Sin servicio asignado"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
