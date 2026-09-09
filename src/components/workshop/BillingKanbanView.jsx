"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Receipt,
  User,
  Bike,
  Eye,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  Calendar
} from "lucide-react";
import { hexToRgba } from "./WorkOrderStatusBadge";

const PERIOD_OPTIONS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "custom", label: "Personalizado" }
];

const DESPACHO_GROUPS = [
  {
    key: "RECIBIDAS",
    repCodigo: "RECIBIDA",
    repId: 1,
    codigos: ["RECIBIDA", "APROBACION"],
    estado_ids: [1, 3],
    fallbackNombre: "Recibida",
    fallbackColor: "#38BDF8"
  },
  {
    key: "REPARACION",
    repCodigo: "REPARACION",
    repId: 5,
    codigos: ["REPARACION", "HOLD"],
    estado_ids: [5, 2],
    fallbackNombre: "En Reparación",
    fallbackColor: "#F59E0B"
  },
  {
    key: "LISTA_ENTREGA",
    repCodigo: "LISTA_ENTREGA",
    repId: 7,
    codigos: ["LISTA_ENTREGA"],
    estado_ids: [7],
    fallbackNombre: "Lista para Entrega",
    fallbackColor: "#10B981"
  },
  {
    key: "ENTREGADAS",
    repCodigo: "ENTREGADA",
    repId: 8,
    codigos: ["ENTREGADA"],
    estado_ids: [8],
    fallbackNombre: "Entregada",
    fallbackColor: "#64748B"
  }
];

export default function BillingKanbanView({ onViewInvoiceDetail }) {
  const [orders, setOrders] = useState([]);
  const [estados, setEstados] = useState([]);
  const [catalogEstados, setCatalogEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Period / Date filter state
  const [selectedPeriod, setSelectedPeriod] = useState("hoy");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // Search state with debounce
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Live clock tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val.trim());
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

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

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const fetchBillingData = useCallback(async (searchQuery = "", isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      if (selectedPeriod === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      } else {
        params.set("period", selectedPeriod);
      }

      const res = await fetch(`/api/taller/facturacion/ordenes?${params.toString()}`);
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
          throw new Error(data?.message || data?.error || "Error al cargar órdenes.");
        }
        return;
      }

      setOrders(data.data || []);
      const rawEstados = data.catalogs?.estados || [];
      setCatalogEstados(rawEstados);
      const dynamicEstados = DESPACHO_GROUPS.map((group) => {
        const rep = rawEstados.find(
          (e) => e.codigo === group.repCodigo || e.estado_orden_id === group.repId
        );
        const color = (rep?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rep.color_estado.trim()))
          ? rep.color_estado.trim()
          : group.fallbackColor;

        return {
          ...group,
          nombre: rep?.nombre || group.fallbackNombre,
          color_estado: color
        };
      });
      setEstados(dynamicEstados);
    } catch (err) {
      console.error("fetchBillingData Error:", err);
      if (!isSilent) {
        setError(err.message || "Error al conectar con el servidor.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [selectedPeriod, customFrom, customTo]);

  // Initial load & debounced search / period changes
  useEffect(() => {
    fetchBillingData(debouncedSearch, false);
  }, [debouncedSearch, selectedPeriod, customFrom, customTo, fetchBillingData]);

  // Auto-refresh every 10 seconds for real-time monitoring (transparent in background)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBillingData(debouncedSearch, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [debouncedSearch, fetchBillingData]);

  const getPrioridadBadge = (nombre, color) => {
    const colorStyle = color ? { color: color, borderColor: `${color}40`, backgroundColor: `${color}15` } : {};
    return (
      <span
        className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border flex items-center gap-1 w-fit select-none shrink-0 uppercase tracking-wider"
        style={colorStyle}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || "#64748B" }} />
        {nombre || "Normal"}
      </span>
    );
  };

  const renderColumn = (estado) => {
    const columnOrders = orders.filter((o) => {
      const codigo = String(o.estado_codigo || "").trim().toUpperCase();
      if (codigo && estado.codigos) {
        return estado.codigos.includes(codigo);
      }
      if (o.estado_orden_id && estado.estado_ids) {
        return estado.estado_ids.includes(Number(o.estado_orden_id));
      }
      return false;
    });

    return (
      <div
        key={estado.key || estado.nombre}
        className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-lg transition-all min-h-[300px] w-full"
        style={{ borderTop: `4px solid ${estado.color_estado || "#64748B"}` }}
      >
        {/* Column Header */}
        <div className="p-3.5 bg-surface/90 border-b border-border flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: estado.color_estado || "#64748B" }}
            />
            <h2
              className="font-mono text-xs md:text-sm font-extrabold tracking-wider uppercase leading-tight whitespace-normal break-words flex-1"
              style={{ color: estado.color_estado || "inherit" }}
            >
              {estado.nombre}
            </h2>
          </div>
          <span
            className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-full border shrink-0"
            style={{
              backgroundColor: hexToRgba(estado.color_estado, 0.15) || "rgba(100, 116, 139, 0.15)",
              borderColor: hexToRgba(estado.color_estado, 0.35) || estado.color_estado || "#475569",
              color: estado.color_estado || "inherit"
            }}
          >
            {columnOrders.length}
          </span>
        </div>

        {/* Column Cards Container */}
        <div className="p-3 space-y-3 flex-1 max-h-[580px] overflow-y-auto custom-scrollbar overflow-x-hidden min-h-[160px]">
          {columnOrders.length === 0 ? (
            <div className="py-12 px-4 text-center text-foreground-muted text-xs font-mono border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2">
              <span>Sin órdenes en este estado</span>
            </div>
          ) : (
            columnOrders.map((ord) => {
              const totalAmount = parseFloat(ord.total_orden || ord.total_estimado || 0);

              const estadoCod = String(ord.estado_codigo || "").trim().toUpperCase();
              const estadoId = Number(ord.estado_orden_id);
              const isHold = estadoCod === "HOLD" || estadoId === 2;
              const isPendiente = (estadoCod === "RECIBIDA" || estadoCod === "APROBACION" || estadoId === 1 || estadoId === 3) && !isHold;
              const isReparacion = (estadoCod === "REPARACION" || estadoId === 5) && !isHold;
              const isCompletada = estadoCod === "LISTA_ENTREGA" || estadoCod === "COMPLETADA" || estadoId === 7;
              const isEntregada = estadoCod === "ENTREGADA" || estadoId === 8;

              const ordState = (catalogEstados || []).find(
                (e) => e.codigo === ord.estado_codigo || e.estado_orden_id === ord.estado_orden_id
              );
              const ordStateName = ordState?.nombre || ord.estado_nombre || "En Hold";
              const ordStateColor =
                ordState?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(ordState.color_estado.trim())
                  ? ordState.color_estado.trim()
                  : ord.estado_color || "#F59E0B";

              return (
                <div
                  key={ord.orden_id}
                  className="bg-surface border border-border rounded-xl p-3.5 space-y-3 transition-all shadow-sm group relative overflow-x-hidden"
                  style={{ borderLeft: isHold ? `4px solid ${ordStateColor}` : `4px solid ${estado.color_estado || "#64748B"}` }}
                >
                  {/* 1. Top Row: Order Code & Customer info + Priority & Detalle */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="space-y-1 text-xs flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-base font-black text-foreground tracking-tight whitespace-nowrap">
                          {ord.codigo_orden}
                        </span>
                        {isHold && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase tracking-wider whitespace-nowrap"
                            style={{
                              backgroundColor: hexToRgba(ordStateColor, 0.15) || "rgba(245, 158, 11, 0.15)",
                              borderColor: hexToRgba(ordStateColor, 0.35) || ordStateColor,
                              color: ordStateColor
                            }}
                          >
                            {ordStateName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                        <User className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                        <span className="truncate" title={ord.cliente_nombre}>
                          {ord.cliente_nombre}
                        </span>
                      </div>
                      {ord.cliente_identificacion && (
                        <div className="text-[10px] text-foreground-muted font-mono ml-5">
                          ID: {ord.cliente_identificacion}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-foreground-muted text-[11px] truncate">
                        <Bike className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate font-sans">
                          {ord.bicicleta_marca} {ord.bicicleta_modelo}
                        </span>
                      </div>
                    </div>

                    {/* Right column: Priority badge on top and Detalle button underneath */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {getPrioridadBadge(ord.prioridad_nombre, ord.prioridad_color)}
                      <button
                        type="button"
                        onClick={() => onViewInvoiceDetail(ord.orden_id || ord.orden_trabajo_id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary border border-primary/30 rounded-lg transition-all cursor-pointer shadow-sm"
                        title="Ver detalle de la orden"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalle</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Fechas Visibles y Específicas por Estado de la Orden */}
                  <div className="pt-2 border-t border-border/50 space-y-1 font-mono text-[10.5px]">
                    {/* Fecha de Creación (Siempre visible en todos los estados) */}
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span className="text-foreground-muted font-sans text-[11px]">Creada:</span>
                      <span className="text-foreground font-semibold">
                        {formatDate(ord.fecha_creacion || ord.fecha_registro)}
                      </span>
                    </div>

                    {/* Estado: EN REPARACIÓN */}
                    {isReparacion && (ord.fecha_inicio_reparacion || ord.fecha_inicio_trabajo) && (
                      <div className="flex items-center justify-between text-foreground-muted">
                        <span className="text-foreground-muted font-sans text-[11px]">Inicio reparación:</span>
                        <span className="text-amber-500/90 dark:text-amber-400 font-bold">
                          {formatDate(ord.fecha_inicio_reparacion || ord.fecha_inicio_trabajo)}
                        </span>
                      </div>
                    )}

                    {/* Estado: HOLD */}
                    {isHold && (
                      <>
                        {(ord.fecha_inicio_reparacion || ord.fecha_inicio_trabajo) && (
                          <div className="flex items-center justify-between text-foreground-muted">
                            <span className="text-foreground-muted font-sans text-[11px]">Inicio reparación:</span>
                            <span className="text-foreground-secondary font-semibold">
                              {formatDate(ord.fecha_inicio_reparacion || ord.fecha_inicio_trabajo)}
                            </span>
                          </div>
                        )}
                        {ord.fecha_hold && (
                          <div className="flex items-center justify-between text-foreground-muted">
                            <span className="text-amber-500/90 dark:text-amber-400 font-sans text-[11px]">Puesto en Hold:</span>
                            <span className="text-amber-500 dark:text-amber-400 font-bold">
                              {formatDate(ord.fecha_hold)}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Estado: COMPLETADA / LISTA_ENTREGA */}
                    {isCompletada && (ord.fecha_completada || ord.fecha_finalizacion) && (
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-600 dark:text-emerald-500 font-sans text-[11px]">Completada:</span>
                        <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                          {formatDate(ord.fecha_completada || ord.fecha_finalizacion)}
                        </span>
                      </div>
                    )}

                    {/* Estado: ENTREGADA */}
                    {isEntregada && (ord.fecha_entregada || ord.fecha_entrega_real) && (
                      <div className="flex items-center justify-between">
                        <span className="text-foreground-muted font-sans text-[11px]">Entregada:</span>
                        <span className="text-slate-300 dark:text-slate-300 font-bold">
                          {formatDate(ord.fecha_entregada || ord.fecha_entrega_real)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 3. Financial & Reception Bar */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-foreground-muted">
                    <span className="bg-card px-2 py-0.5 rounded border border-border text-foreground-muted text-[10px] font-mono font-bold">
                      {ord.codigo_recepcion || "S/R"}
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] text-foreground-muted block font-sans">Total de la Orden</span>
                      <span className="font-bold text-foreground text-xs font-mono">
                        RD$ {totalAmount.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-6 font-sans text-foreground transition-colors animate-in fade-in duration-200">
      {/* 1. Breadcrumb */}
      <div className="text-xs font-mono text-foreground-muted font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="text-foreground-secondary">Taller</span>
        <span>/</span>
        <span className="text-primary font-semibold">Despacho de Órdenes</span>
      </div>

      {/* 2. Top Header: Title, Description & Operating Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-border">
        {/* Left Side: Title & Badge */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Receipt className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight font-sans uppercase">
              Despacho de Órdenes
            </h1>
            <span className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded-full font-mono font-bold">
              {orders.length} Órdenes
            </span>
          </div>
          <p className="text-xs text-foreground-muted mt-1 font-sans">
            Consulta, revisión y entrega final de órdenes al cliente.
          </p>
        </div>

        {/* Right Side: Segmented Range Selector, Live Clock & Refresh Button */}
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

          {/* Reloj / Hora Actual Visible */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-mono text-foreground-muted shadow-sm">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{formatTime(currentTime)}</span>
          </div>

          {/* Botón Compacto de Actualizar */}
          <button
            onClick={() => fetchBillingData(debouncedSearch, false)}
            disabled={loading}
            className="p-2.5 bg-surface hover:bg-hover border border-border text-foreground-secondary hover:text-primary rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Actualizar listado"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : "text-primary"}`} />
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

      {/* 3. Full-width Wide Search Bar */}
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-foreground-muted absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar por orden, recepción, cliente, bicicleta o identificación…"
            className="w-full bg-input border border-border hover:border-border/80 focus:border-primary rounded-xl pl-11 pr-10 py-2.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all font-sans"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 p-1 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {debouncedSearch && (
          <div className="mt-2 text-xs text-foreground-muted flex items-center justify-between px-1">
            <span>
              Resultados para: <strong className="text-foreground font-mono">"{debouncedSearch}"</strong> ({orders.length} encontradas)
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-primary hover:underline text-[11px] font-semibold cursor-pointer font-mono"
            >
              Mostrar todas
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Body: Loading, Error or Kanban Columns */}
      {loading && !orders.length ? (
        <div className="p-16 flex flex-col items-center justify-center bg-card/60 border border-border rounded-2xl text-foreground-muted gap-3 min-h-[380px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-mono tracking-wide">Cargando órdenes de despacho...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-error-muted border border-error/30 rounded-2xl text-error text-sm font-mono text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-error" />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchBillingData(debouncedSearch)}
            className="px-4 py-2 bg-card border border-border text-foreground hover:bg-hover rounded-xl font-bold transition-all cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : orders.length === 0 && debouncedSearch ? (
        <div className="p-12 flex flex-col items-center justify-center bg-card/60 border-2 border-dashed border-border rounded-2xl text-foreground-muted text-center space-y-3">
          <FileSpreadsheet className="w-10 h-10 text-foreground-muted/60" />
          <div>
            <p className="text-sm font-bold text-foreground font-sans">Sin coincidencias para la búsqueda</p>
            <p className="text-xs text-foreground-muted mt-1 font-sans">
              No se encontraron órdenes con el término "{debouncedSearch}".
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-4 py-2 text-xs font-mono font-bold text-primary-foreground bg-primary-button-bg hover:brightness-110 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Limpiar Búsqueda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-4.5 2xl:gap-5 w-full items-start">
          {estados.map(renderColumn)}
        </div>
      )}
    </div>
  );
}
