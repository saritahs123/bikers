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
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Sparkles,
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
    codigo: "RECIBIDA",
    estado_id: 1,
    title: "RECIBIDAS",
    subtitle: "Pendientes de inicio",
    icon: Clock,
    headerColor: "text-sky-400",
    badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    borderTop: "border-t-sky-500",
    ringColor: "ring-sky-500/20"
  },
  {
    key: "REPARACION",
    codigo: "REPARACION",
    estado_id: 5,
    title: "EN REPARACIÓN",
    subtitle: "Trabajo técnico activo",
    icon: Wrench,
    headerColor: "text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    borderTop: "border-t-amber-500",
    ringColor: "ring-amber-500/20"
  },
  {
    key: "LISTA_ENTREGA",
    codigo: "LISTA_ENTREGA",
    estado_id: 7,
    title: "LISTAS PARA ENTREGA",
    subtitle: "Listas para cliente",
    icon: ClipboardCheck,
    headerColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    borderTop: "border-t-emerald-500",
    ringColor: "ring-emerald-500/20"
  },
  {
    key: "ENTREGADAS",
    codigo: "ENTREGADA",
    estado_id: 8,
    title: "ENTREGADAS",
    subtitle: "Completadas",
    icon: CheckCircle2,
    headerColor: "text-slate-300",
    badgeBg: "bg-slate-700/40 text-slate-300 border-slate-600/40",
    borderTop: "border-t-slate-500",
    ringColor: "ring-slate-500/20"
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
    if (!isSilent) setLoading(true);
    setIsRefreshing(true);
    setError(null);

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
        throw new Error(res.ok ? "Respuesta inválida del servidor." : `Error del servidor (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Error al consultar las órdenes del taller.");
      }

      setOrders(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("fetchOrders Kanban Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedPeriod, customFrom, customTo]);

  // Initial load and on period change
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Auto-refresh every 30 seconds for live monitor
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 30000);

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
    return date.toLocaleTimeString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const formatOrderDate = (dateString) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  // Group orders by column
  const getOrdersForColumn = (column) => {
    return orders.filter((o) => {
      if (o.estado_codigo) {
        return o.estado_codigo === column.codigo;
      }
      return o.estado_orden_id === column.estado_id;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col space-y-4 font-sans text-slate-100 ${
        isFullscreen ? "bg-[#0c0f14] p-6 min-h-screen overflow-y-auto" : ""
      }`}
    >
      {/* 1. ENCABEZADO SIMPLE SIN TARJETA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#2d3748]/50">
        {/* Lado Izquierdo */}
        <div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mb-1">
            <span
              className="hover:text-slate-300 transition-colors cursor-pointer"
              onClick={onToggleList}
            >
              Taller
            </span>
            <span>/</span>
            <span
              className="hover:text-slate-300 transition-colors cursor-pointer"
              onClick={onToggleList}
            >
              Órdenes de Trabajo
            </span>
            <span>/</span>
            <span className="text-[#bfce7f] font-bold">Vista Kanban</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight font-sans">
              Monitoreo de Órdenes
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f]">
              <span className="w-2 h-2 rounded-full bg-[#bfce7f] animate-pulse" />
              {orders.length} Órdenes
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Seguimiento operativo del taller en tiempo real
          </p>
        </div>

        {/* Lado Derecho: Controles Operativos */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Período Segmentado */}
          <div className="bg-[#161a21] border border-[#2d3748] p-1 rounded-xl flex items-center shadow-inner">
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = selectedPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handlePeriodChange(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#bfce7f] text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
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
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#161a21] border border-[#2d3748] rounded-xl text-[11px] font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5 text-[#bfce7f]" />
              <span>{formatTimeAgo(lastUpdated)}</span>
            </div>
          )}

          {/* Botón Compacto de Actualizar */}
          <button
            onClick={() => fetchOrders(false)}
            disabled={isRefreshing}
            className="p-2.5 bg-[#161a21] hover:bg-slate-800 border border-[#2d3748] text-slate-300 hover:text-[#bfce7f] rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Actualizar datos ahora"
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#bfce7f]" : ""}`} />
          </button>

          {/* Botón de Pantalla Completa para Proyección en TV */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#161a21] hover:bg-slate-800 border border-[#2d3748] text-slate-300 hover:text-white rounded-xl transition-all shadow-sm text-xs font-mono font-bold cursor-pointer"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa para TV / Monitor"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-[#bfce7f]" />
                <span className="hidden md:inline">Pantalla Completa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal para Período Personalizado mediante Portal a document.body */}
      {mounted && showCustomModal && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                backdropFilter: "blur(6px)"
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowCustomModal(false);
              }}
            >
              <div
                style={{
                  width: "440px",
                  maxWidth: "95vw",
                  minWidth: "320px",
                  backgroundColor: "#161a21",
                  border: "1px solid #2d3748",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                  color: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  flexShrink: 0
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #2d3748",
                    paddingBottom: "14px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        padding: "8px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(191, 206, 127, 0.15)",
                        border: "1px solid rgba(191, 206, 127, 0.3)",
                        color: "#bfce7f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h3
                      style={{
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#f8fafc",
                        fontFamily: "monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        margin: 0
                      }}
                    >
                      Rango de Fecha Personalizado
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    style={{
                      padding: "6px",
                      borderRadius: "8px",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Inputs en 2 columnas */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}
                    >
                      Desde
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: "#0a0c10",
                        border: "1px solid #2d3748",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        color: "#f1f5f9",
                        outline: "none",
                        fontFamily: "monospace",
                        colorScheme: "dark",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}
                    >
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: "#0a0c10",
                        border: "1px solid #2d3748",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        color: "#f1f5f9",
                        outline: "none",
                        fontFamily: "monospace",
                        colorScheme: "dark",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "12px",
                    borderTop: "1px solid #2d3748",
                    paddingTop: "16px"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      fontWeight: "700",
                      color: "#94a3b8",
                      backgroundColor: "transparent",
                      border: "1px solid transparent",
                      cursor: "pointer"
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomPeriod}
                    disabled={!customFrom || !customTo}
                    style={{
                      padding: "8px 20px",
                      backgroundColor: !customFrom || !customTo ? "#2d3748" : "#bfce7f",
                      color: !customFrom || !customTo ? "#64748b" : "#0f172a",
                      fontFamily: "monospace",
                      fontWeight: "700",
                      borderRadius: "10px",
                      fontSize: "12px",
                      border: "none",
                      cursor: !customFrom || !customTo ? "not-allowed" : "pointer",
                      boxShadow: !customFrom || !customTo ? "none" : "0 4px 12px rgba(191, 206, 127, 0.25)"
                    }}
                  >
                    Aplicar Filtro
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* 2. TABLERO KANBAN — 4 COLUMNAS SIMULTÁNEAS OPTIMIZADAS PARA PANTALLA GRANDE */}
      {loading && !orders.length ? (
        <div className="p-16 flex flex-col items-center justify-center bg-[#161a21]/60 border border-[#2d3748] rounded-2xl text-slate-400 gap-3 min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
          <span className="text-sm font-mono tracking-wide">Cargando tablero operativo en tiempo real...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm font-mono text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p>{error}</p>
          <button
            onClick={() => fetchOrders(false)}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl font-bold transition-all cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5 w-full items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = getOrdersForColumn(col);
            const IconComponent = col.icon;

            return (
              <div
                key={col.key}
                className={`bg-[#12161f] border border-[#2d3748] rounded-2xl flex flex-col overflow-hidden shadow-xl ${col.borderTop} border-t-4 transition-all`}
              >
                {/* Encabezado de Columna */}
                <div className="p-4 bg-[#161a21]/90 border-b border-[#2d3748] flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-slate-900 border border-[#2d3748] ${col.headerColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className={`font-mono text-xs md:text-sm font-extrabold tracking-wider uppercase ${col.headerColor}`}>
                        {col.title}
                      </h2>
                      <p className="text-[10px] text-slate-400 font-sans">{col.subtitle}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-full border ${col.badgeBg}`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Lista de Tarjetas Operativas */}
                <div className="p-3 space-y-3 max-h-[calc(100vh-230px)] overflow-y-auto custom-scrollbar min-h-[180px]">
                  {colOrders.length === 0 ? (
                    <div className="py-10 px-4 text-center text-slate-500 text-xs font-mono border-2 border-dashed border-slate-800/60 rounded-xl">
                      Sin órdenes en esta etapa
                    </div>
                  ) : (
                    colOrders.map((ord) => {
                      const totalNum = parseFloat(ord.total_orden || ord.total_estimado || 0);
                      const priorityColor =
                        ord.prioridad_codigo === "URGENTE"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : ord.prioridad_codigo === "ALTA"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700";

                      return (
                        <div
                          key={ord.orden_id || ord.orden_trabajo_id}
                          onClick={() => onViewDetail && onViewDetail(ord.orden_id || ord.orden_trabajo_id)}
                          className="bg-[#161a21] hover:bg-[#1a202c] border border-[#2d3748] hover:border-[#bfce7f]/60 rounded-xl p-3.5 space-y-2.5 transition-all shadow-md cursor-pointer group hover:shadow-lg relative overflow-hidden"
                        >
                          {/* Línea Superior: Código y Prioridad */}
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-black text-slate-100 group-hover:text-[#bfce7f] transition-colors tracking-wide">
                              {ord.codigo_orden}
                            </span>
                            {ord.prioridad_nombre && (
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${priorityColor}`}
                              >
                                {ord.prioridad_nombre}
                              </span>
                            )}
                          </div>

                          {/* Cliente */}
                          <div className="text-xs md:text-sm font-bold text-slate-200 truncate">
                            {ord.cliente_nombre || "Cliente Sin Nombre"}
                          </div>

                          {/* Bicicleta / Vehículo */}
                          {(ord.bicicleta_marca || ord.bicicleta_modelo) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                              <Bike className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">
                                {ord.bicicleta_marca} {ord.bicicleta_modelo}
                              </span>
                            </div>
                          )}

                          {/* Mecánico Asignado */}
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span
                              className={`truncate font-medium ${
                                ord.mecanico_asignado ? "text-amber-300/90" : "text-slate-500 italic"
                              }`}
                            >
                              {ord.mecanico_asignado ? ord.mecanico_asignado : "Mecánico por asignar"}
                            </span>
                          </div>

                          {/* Línea Inferior: Total y Fecha */}
                          <div className="pt-2 border-t border-[#2d3748]/60 flex items-center justify-between font-mono text-xs">
                            <span className="font-extrabold text-[#bfce7f]">
                              RD$ {totalNum.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatOrderDate(ord.fecha_registro)}
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
