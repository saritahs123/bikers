"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  ChevronLeft,
  RefreshCw,
  Download,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Search,
  FilterX,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ChevronRight,
  ExternalLink,
  MessageSquare
} from "lucide-react";

// Format date with full seconds DD/MM/YYYY HH:mm:ss
function formatFullDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return "-";
  }
}

// Badge for notification status
function DeliveryStatusBadge({ status }) {
  const normStatus = (status || "").toUpperCase();

  if (
    normStatus === "SIN CONFIRMAR" ||
    normStatus === "SIN_CONFIRMAR" ||
    normStatus === "UNKNOWN" ||
    !normStatus
  ) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-slate-800/80 text-slate-300 border border-slate-700/80 shadow-sm">
        SIN CONFIRMAR
      </span>
    );
  }

  switch (normStatus) {
    case "ENTREGADO":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
          ENTREGADO
        </span>
      );
    case "ENVIADO":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm">
          ENVIADO
        </span>
      );
    case "PENDIENTE":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm">
          PENDIENTE
        </span>
      );
    case "ERROR":
    case "FAILED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm">
          ERROR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-surface-subtle text-foreground-muted border border-border">
          {normStatus || "DESCONOCIDO"}
        </span>
      );
  }
}

// Badge for notification type
function NotificationTypeBadge({ type }) {
  const norm = (type || "").toUpperCase();
  let label = "Estado";
  if (norm === "BIENVENIDA") label = "Bienvenida";
  else if (norm === "CIERRE") label = "Cierre";

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-subtle border border-border text-foreground-secondary">
      {label}
    </span>
  );
}

// Provider badge or label
function ProviderStatusLabel({ providerStatus }) {
  const p = (providerStatus || "").toLowerCase();
  if (!p) return <span className="text-foreground-disabled text-xs">-</span>;

  let colorClass = "text-slate-400";
  if (p === "delivered") colorClass = "text-emerald-400 font-semibold";
  else if (p === "sent") colorClass = "text-blue-400 font-semibold";
  else if (p === "dispatched" || p === "pending") colorClass = "text-amber-400";
  else if (p === "failed" || p === "error") colorClass = "text-rose-400 font-semibold";
  else if (p === "unknown") colorClass = "text-slate-400 italic";

  return (
    <span className={`text-xs font-mono ${colorClass}`}>
      {p}
    </span>
  );
}

export default function OrderNotificationsView() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pendientes: 0,
    enviadas: 0,
    entregadas: 0,
    errores: 0,
    sin_confirmar: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("TODOS");
  const [estadoFilter, setEstadoFilter] = useState("TODOS");
  const [estadoProveedorFilter, setEstadoProveedorFilter] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Sort states
  const [sortBy, setSortBy] = useState("fecha_registro");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selected item for detail view
  const [selectedItem, setSelectedItem] = useState(null);
  const [showJsonDetails, setShowJsonDetails] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch data inside useEffect
  useEffect(() => {
    let ignore = false;

    async function loadNotifications() {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (activeSearch) params.set("search", activeSearch);
      if (tipoFilter && tipoFilter !== "TODOS") params.set("tipo", tipoFilter);
      if (estadoFilter && estadoFilter !== "TODOS") params.set("estado", estadoFilter);
      if (estadoProveedorFilter && estadoProveedorFilter !== "todos") {
        params.set("estadoProveedor", estadoProveedorFilter);
      }
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);

      try {
        const res = await fetch(`/api/configuracion/notificaciones-ordenes?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Error al cargar notificaciones");
        }

        const json = await res.json();
        if (!ignore && json.success) {
          setData(json.data || []);
          if (json.pagination) {
            setTotalRecords(json.pagination.totalRecords || 0);
            setTotalPages(json.pagination.totalPages || 1);
          }
          if (json.summary) {
            setSummary(json.summary);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching order notifications:", err);
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadNotifications();

    return () => {
      ignore = true;
    };
  }, [
    page,
    pageSize,
    activeSearch,
    tipoFilter,
    estadoFilter,
    estadoProveedorFilter,
    fechaDesde,
    fechaHasta,
    sortBy,
    sortOrder,
    refreshTrigger,
  ]);

  // Handle Search Trigger
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  };

  // Handle Reset Filters
  const handleResetFilters = () => {
    setSearchInput("");
    setActiveSearch("");
    setTipoFilter("TODOS");
    setEstadoFilter("TODOS");
    setEstadoProveedorFilter("todos");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  // Handle Quick Filter by Clicking Metric Cards
  const handleMetricCardClick = (targetStatus) => {
    setPage(1);
    if (targetStatus === "TOTAL") {
      setEstadoFilter("TODOS");
      setEstadoProveedorFilter("todos");
    } else if (targetStatus === "SIN_CONFIRMAR") {
      setEstadoFilter("SIN_CONFIRMAR");
    } else {
      setEstadoFilter(targetStatus);
      setEstadoProveedorFilter("todos");
    }
  };

  // Handle Sorting
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Copy to clipboard helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!data || data.length === 0) return;

    const headers = [
      "ID",
      "Fecha y Hora",
      "Orden",
      "Cliente",
      "Telefono",
      "Tipo",
      "Estado Envio",
      "Estado Proveedor",
      "Codigo HTTP",
      "Batch ID",
      "Mensaje",
      "Fecha Envio",
      "Usuario Registro"
    ];

    const rows = data.map((item) => [
      item.notificacion_orden_trabajo_id,
      formatFullDate(item.fecha_registro),
      `"${item.codigo_orden || ""}"`,
      `"${(item.nombre_cliente || "").replace(/"/g, '""')}"`,
      `"${item.telefono_destino || ""}"`,
      `"${item.tipo_notificacion || ""}"`,
      `"${item.estado_envio || ""}"`,
      `"${item.estado_proveedor || ""}"`,
      item.codigo_http || "",
      `"${item.textbee_batch_id || ""}"`,
      `"${(item.mensaje || "").replace(/"/g, '""')}"`,
      formatFullDate(item.fecha_envio),
      `"${item.usuario_nombre || ""}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Notificaciones_Ordenes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Sortable Table Header
  const renderSortableHeader = (label, columnKey, extraClass = "") => {
    const isSorted = sortBy === columnKey;
    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`px-3 py-2 text-left text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase cursor-pointer select-none transition-colors hover:text-white hover:bg-slate-800/40 ${extraClass}`}
      >
        <div className="flex items-center gap-1">
          <span className="truncate">{label}</span>
          <span className="text-slate-500 shrink-0">
            {isSorted ? (
              sortOrder === "asc" ? (
                <ArrowUp size={12} className="text-primary" />
              ) : (
                <ArrowDown size={12} className="text-primary" />
              )
            ) : (
              <ArrowUpDown size={11} className="opacity-40" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full h-full md:max-h-[calc(100vh-5.5rem)] flex flex-col min-h-0 font-sans text-foreground gap-2 overflow-y-auto md:overflow-hidden animate-in fade-in duration-200">
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground-muted shrink-0">
        <Link
          href="/settings/security/catalogs"
          className="flex items-center gap-0.5 hover:text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft size={13} />
          <span>Configuración</span>
        </Link>
        <span>&gt;</span>
        <span className="text-foreground font-semibold">Notificaciones de Órdenes</span>
      </div>

      {/* 2. Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-primary/30 flex items-center justify-center text-primary shadow-sm shadow-primary/10 shrink-0">
            <Mail size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white leading-tight">
              Notificaciones de Órdenes
            </h1>
            <p className="text-[11px] text-foreground-muted leading-tight mt-0.5">
              Consulta y seguimiento de las notificaciones enviadas a clientes por SMS, cambios de estado y cierres de órdenes.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              setRefreshTrigger((c) => c + 1);
            }}
            disabled={loading || refreshing}
            className="h-7.5 flex items-center gap-1.5 px-3 bg-surface-subtle hover:bg-hover border border-border rounded-lg text-xs font-mono font-medium text-foreground transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin text-primary" : "text-foreground-muted"} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || data.length === 0}
            className="h-7.5 flex items-center gap-1.5 px-3.5 bg-primary/10 hover:bg-primary/20 border border-primary/40 text-primary rounded-lg text-xs font-mono font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Exportar a CSV"
          >
            <Download size={12} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 3. Summary Cards Bar (6 compact cards matching visual mockup, 74px height) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        {/* Total */}
        <div
          onClick={() => handleMetricCardClick("TOTAL")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "TODOS"
              ? "bg-slate-900/90 border-slate-700 ring-1 ring-primary/40"
              : "bg-[#0e131f]/90 border-slate-800/80 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
              <MessageSquare size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight leading-none">
            {summary.total}
          </div>
          <div className="text-[10px] font-mono text-slate-400 leading-none">
            Total
          </div>
        </div>

        {/* Pendientes */}
        <div
          onClick={() => handleMetricCardClick("PENDIENTE")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "PENDIENTE"
              ? "bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50"
              : "bg-[#18140c]/90 border-amber-900/40 hover:border-amber-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 tracking-tight leading-none">
            {summary.pendientes}
          </div>
          <div className="text-[10px] font-mono text-amber-400/80 leading-none">
            Pendientes
          </div>
        </div>

        {/* Enviadas */}
        <div
          onClick={() => handleMetricCardClick("ENVIADO")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ENVIADO"
              ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50"
              : "bg-[#0b1526]/90 border-blue-900/40 hover:border-blue-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Send size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-400 tracking-tight leading-none">
            {summary.enviadas}
          </div>
          <div className="text-[10px] font-mono text-blue-400/80 leading-none">
            Enviadas
          </div>
        </div>

        {/* Entregadas */}
        <div
          onClick={() => handleMetricCardClick("ENTREGADO")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ENTREGADO"
              ? "bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50"
              : "bg-[#0d1c16]/90 border-emerald-900/40 hover:border-emerald-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight leading-none">
            {summary.entregadas}
          </div>
          <div className="text-[10px] font-mono text-emerald-400/80 leading-none">
            Entregadas
          </div>
        </div>

        {/* Errores */}
        <div
          onClick={() => handleMetricCardClick("ERROR")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ERROR"
              ? "bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/50"
              : "bg-[#201015]/90 border-rose-900/40 hover:border-rose-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 tracking-tight leading-none">
            {summary.errores}
          </div>
          <div className="text-[10px] font-mono text-rose-400/80 leading-none">
            Errores
          </div>
        </div>

        {/* Sin confirmar */}
        <div
          onClick={() => handleMetricCardClick("SIN_CONFIRMAR")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "SIN_CONFIRMAR"
              ? "bg-slate-800/50 border-cyan-500 ring-1 ring-cyan-500/50"
              : "bg-[#0e171f]/90 border-slate-800/80 hover:border-cyan-800/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Radio size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 tracking-tight leading-none">
            {summary.sin_confirmar}
          </div>
          <div className="text-[10px] font-mono text-cyan-400/80 leading-none">
            Sin confirmar
          </div>
        </div>
      </div>

      {/* 4. Filter Panel (Card with 2 rows matching visual mockup) */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-[#0e131f]/90 border border-slate-800/90 rounded-xl p-2.5 shadow-sm space-y-2 shrink-0"
      >
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Filtros de búsqueda
        </div>

        {/* Row 1: Search + Selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Search Input */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 block leading-tight">Buscar</label>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Código OT, cliente, teléfono..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-[#141b2b] border border-slate-700/80 rounded-lg pl-8 pr-2.5 h-8 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Tipo de Notificación */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 block leading-tight">Tipo de notificación</label>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#141b2b] border border-slate-700/80 rounded-lg px-2.5 h-8 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="BIENVENIDA">Bienvenida</option>
              <option value="ESTADO">Estado</option>
              <option value="CIERRE">Cierre</option>
            </select>
          </div>

          {/* Estado de Envío */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 block leading-tight">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#141b2b] border border-slate-700/80 rounded-lg px-2.5 h-8 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ENVIADO">Enviado</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="ERROR">Error</option>
              <option value="SIN_CONFIRMAR">Sin confirmar</option>
            </select>
          </div>

          {/* Estado Proveedor */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 block leading-tight">Estado proveedor</label>
            <select
              value={estadoProveedorFilter}
              onChange={(e) => {
                setEstadoProveedorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#141b2b] border border-slate-700/80 rounded-lg px-2.5 h-8 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="pending">pending</option>
              <option value="dispatched">dispatched</option>
              <option value="sent">sent</option>
              <option value="delivered">delivered</option>
              <option value="failed">failed</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Pickers + Action Buttons */}
        <div className="flex flex-wrap items-end justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Fecha Desde */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-mono text-slate-400 block leading-tight">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                className="bg-[#141b2b] border border-slate-700/80 rounded-lg px-2.5 h-8 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-mono text-slate-400 block leading-tight">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
                className="bg-[#141b2b] border border-slate-700/80 rounded-lg px-2.5 h-8 text-xs text-white font-mono focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Buttons: Limpiar + Buscar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 h-8 bg-surface-subtle hover:bg-hover border border-slate-700/80 rounded-lg text-xs font-mono text-slate-300 transition-colors cursor-pointer"
            >
              <FilterX size={13} />
              <span>Limpiar filtros</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 h-8 bg-[#95c11f] hover:bg-[#86ae1a] text-black font-mono text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer"
            >
              <Search size={13} />
              <span>Buscar</span>
            </button>
          </div>
        </div>
      </form>

      {/* 5. Table Header Count and Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono shrink-0 py-0.5">
        <div className="text-slate-400">
          <span className="font-bold text-white">{totalRecords}</span> registros encontrados
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Filas por página</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[#141b2b] border border-slate-700/80 rounded-md px-2 py-0.5 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page numbers navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-700/80 bg-[#141b2b] text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft size={13} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && page > 3) {
                pageNum = page - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }

              const isCurrent = page === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#95c11f] text-black shadow-sm"
                      : "border border-slate-700/80 bg-[#141b2b] text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-700/80 bg-[#141b2b] text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Main Data Table with Dynamic Viewport Height */}
      <div
        className={`bg-[#0e131f]/90 border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col min-h-0 transition-all duration-200 ${
          selectedItem ? "flex-[6] min-h-[160px]" : "flex-1 min-h-[220px]"
        }`}
      >
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[#141b2b] shadow-sm">
              <tr className="border-b border-slate-800 whitespace-nowrap">
                {renderSortableHeader("Fecha y hora", "fecha_registro")}
                {renderSortableHeader("Orden", "codigo_orden")}
                {renderSortableHeader("Cliente", "nombre_cliente")}
                <th className="px-3 py-2 text-left text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase">
                  Teléfono
                </th>
                {renderSortableHeader("Tipo", "tipo_notificacion")}
                {renderSortableHeader("Estado envío", "estado_envio")}
                {renderSortableHeader("Estado proveedor", "estado_proveedor")}
                <th className="px-3 py-2 text-left text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase">
                  Mensaje
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase sticky right-0 bg-[#141b2b] shadow-[-6px_0_10px_rgba(0,0,0,0.3)] z-10 w-[55px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-1.5" size={20} />
                    Cargando notificaciones de órdenes...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-rose-400 font-mono">
                    <AlertTriangle size={20} className="mx-auto mb-1.5 text-rose-500" />
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-mono italic">
                    No se encontraron notificaciones que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const isSelected =
                    selectedItem?.notificacion_orden_trabajo_id === item.notificacion_orden_trabajo_id;

                  return (
                    <tr
                      key={item.notificacion_orden_trabajo_id}
                      onClick={() => setSelectedItem(item)}
                      className={`h-10 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-slate-800/50 border-l-2 border-l-primary"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      {/* Fecha y Hora */}
                      <td className="px-3 py-1.5 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                        {formatFullDate(item.fecha_registro)}
                      </td>

                      {/* Código de Orden */}
                      <td className="px-3 py-1.5 whitespace-nowrap text-[11px]">
                        {item.orden_trabajo_id ? (
                          <Link
                            href={`/workshop?view=work_orders&order_id=${item.orden_trabajo_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-[#95c11f] hover:underline flex items-center gap-1"
                          >
                            <span>{item.codigo_orden || `OT-${item.orden_trabajo_id}`}</span>
                          </Link>
                        ) : (
                          <span className="font-mono text-slate-400">
                            {item.codigo_orden || "-"}
                          </span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="px-3 py-1.5 text-white font-medium whitespace-nowrap text-[11px]">
                        {item.nombre_cliente || "Cliente no especificado"}
                      </td>

                      {/* Teléfono */}
                      <td className="px-3 py-1.5 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                        {item.telefono_destino || "-"}
                      </td>

                      {/* Tipo */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <NotificationTypeBadge type={item.tipo_notificacion} />
                      </td>

                      {/* Estado Envío */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <DeliveryStatusBadge status={item.estado_envio} />
                      </td>

                      {/* Proveedor / Estado proveedor */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="text-[10px] font-medium text-slate-400">TextBee</span>
                          <ProviderStatusLabel providerStatus={item.estado_proveedor} />
                        </div>
                      </td>

                      {/* Mensaje */}
                      <td className="px-3 py-1.5 text-slate-300 max-w-[240px] truncate text-[11px]" title={item.mensaje}>
                        {item.mensaje || "-"}
                      </td>

                      {/* Acciones */}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap sticky right-0 bg-[#0e131f] shadow-[-6px_0_10px_rgba(0,0,0,0.3)] z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Ver detalle completo"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Bottom Detail Panel ("Detalle de notificación") matching visual mockup */}
      {selectedItem && (
        <div
          id="notification-detail-card"
          className="bg-[#0e131f]/95 border border-slate-800 rounded-xl p-3 shadow-2xl flex flex-col min-h-0 flex-[4] max-h-[38%] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 shrink-0"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Mail size={12} />
              </span>
              <h2 className="text-xs font-bold text-white tracking-wide">
                Detalle de notificación #{selectedItem.notificacion_orden_trabajo_id}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar detalle"
            >
              <X size={14} />
            </button>
          </div>

          {/* Internal scrollable content inside detail */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-1.5 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {/* Columna 1: Información General */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 pb-0.5">
                  Información general
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">ID:</span>
                  <span className="text-white font-bold">{selectedItem.notificacion_orden_trabajo_id}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Orden de trabajo:</span>
                  {selectedItem.orden_trabajo_id ? (
                    <Link
                      href={`/workshop?view=work_orders&order_id=${selectedItem.orden_trabajo_id}`}
                      className="font-bold text-[#95c11f] hover:underline flex items-center gap-1"
                    >
                      <span>{selectedItem.codigo_orden || `OT-${selectedItem.orden_trabajo_id}`}</span>
                      <ExternalLink size={10} />
                    </Link>
                  ) : (
                    <span className="text-slate-300">{selectedItem.codigo_orden || "-"}</span>
                  )}
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Cliente:</span>
                  <span className="text-white font-sans font-medium text-right">
                    {selectedItem.nombre_cliente || "-"}
                  </span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Tipo de notificación:</span>
                  <NotificationTypeBadge type={selectedItem.tipo_notificacion} />
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Teléfono destino:</span>
                  <span className="text-white">{selectedItem.telefono_destino || "-"}</span>
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>Mensaje:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedItem.mensaje, "msg")}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      {copiedField === "msg" ? <Check size={10} /> : <Copy size={10} />}
                      <span>{copiedField === "msg" ? "Copiado" : "Copiar"}</span>
                    </button>
                  </div>
                  <div className="bg-[#141b2b] border border-slate-800 rounded-lg p-2 text-[11px] font-sans text-slate-200 whitespace-pre-wrap leading-relaxed max-h-16 overflow-y-auto custom-scrollbar">
                    {selectedItem.mensaje}
                  </div>
                </div>
              </div>

              {/* Columna 2: Estado y Respuesta */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 pb-0.5">
                  Estado y respuesta
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Estado envío:</span>
                  <DeliveryStatusBadge status={selectedItem.estado_envio} />
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Estado proveedor:</span>
                  <ProviderStatusLabel providerStatus={selectedItem.estado_proveedor} />
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Código HTTP:</span>
                  <span className="text-white font-bold">{selectedItem.codigo_http || "-"}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 gap-2 text-[11px]">
                  <span className="text-slate-400 shrink-0">Batch ID:</span>
                  {selectedItem.textbee_batch_id ? (
                    <div className="flex items-center gap-1 text-right overflow-hidden">
                      <span className="text-slate-300 truncate max-w-[140px]" title={selectedItem.textbee_batch_id}>
                        {selectedItem.textbee_batch_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedItem.textbee_batch_id, "batch")}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title="Copiar Batch ID"
                      >
                        {copiedField === "batch" ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 gap-2 text-[11px]">
                  <span className="text-slate-400 shrink-0">Error mensaje:</span>
                  <span className="text-rose-400 text-right truncate max-w-[180px]" title={selectedItem.error_mensaje || "-"}>
                    {selectedItem.error_mensaje || "-"}
                  </span>
                </div>

                {/* JSON collapsible */}
                {selectedItem.respuesta_proveedor && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowJsonDetails((prev) => !prev)}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono cursor-pointer"
                    >
                      {showJsonDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span>Respuesta completa del proveedor (JSON)</span>
                    </button>

                    {showJsonDetails && (
                      <div className="mt-1 bg-[#090d16] border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 max-h-24 overflow-auto relative">
                        <button
                          type="button"
                          onClick={() => handleCopy(JSON.stringify(selectedItem.respuesta_proveedor, null, 2), "json")}
                          className="absolute top-1.5 right-1.5 p-1 bg-slate-800 rounded text-slate-400 hover:text-white"
                          title="Copiar JSON"
                        >
                          {copiedField === "json" ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
                        </button>
                        <pre className="font-mono whitespace-pre-wrap">
                          {JSON.stringify(selectedItem.respuesta_proveedor, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Columna 3: Fechas y Usuario */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 pb-0.5">
                  Fechas y usuario
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Fecha registro:</span>
                  <span className="text-white text-right">{formatFullDate(selectedItem.fecha_registro)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Fecha envío:</span>
                  <span className="text-white text-right">{formatFullDate(selectedItem.fecha_envio)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Fecha actualización:</span>
                  <span className="text-white text-right">{formatFullDate(selectedItem.fecha_actualizacion)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Usuario registro:</span>
                  <span className="text-white text-right">{selectedItem.usuario_nombre || "Sistema"}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-slate-800/30 text-[11px]">
                  <span className="text-slate-400">Empresa:</span>
                  <span className="text-white text-right">{selectedItem.nombre_empresa || "Ride Lab"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
