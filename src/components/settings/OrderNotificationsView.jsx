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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-surface-subtle text-foreground-muted border border-border shadow-sm">
        SIN CONFIRMAR
      </span>
    );
  }

  switch (normStatus) {
    case "ENTREGADO":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-success/15 text-success border border-success/30 shadow-sm">
          ENTREGADO
        </span>
      );
    case "ENVIADO":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-info/15 text-info border border-info/30 shadow-sm">
          ENVIADO
        </span>
      );
    case "PENDIENTE":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-warning/15 text-warning border border-warning/30 shadow-sm">
          PENDIENTE
        </span>
      );
    case "ERROR":
    case "FAILED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-error/15 text-error border border-error/30 shadow-sm">
          ERROR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tracking-wider uppercase bg-surface-subtle text-foreground-muted border border-border">
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
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-subtle border border-border text-foreground-secondary">
      {label}
    </span>
  );
}

// Provider badge or label
function ProviderStatusLabel({ providerStatus }) {
  const p = (providerStatus || "").toLowerCase();
  if (!p) return <span className="text-foreground-disabled text-xs">-</span>;

  let colorClass = "text-foreground-muted";
  if (p === "delivered") colorClass = "text-success font-semibold";
  else if (p === "sent") colorClass = "text-info font-semibold";
  else if (p === "dispatched" || p === "pending") colorClass = "text-warning";
  else if (p === "failed" || p === "error") colorClass = "text-error font-semibold";
  else if (p === "unknown") colorClass = "text-foreground-disabled italic";

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
          const list = json.data || [];
          setData(list);
          if (json.pagination) {
            setTotalRecords(json.pagination.totalRecords || 0);
            setTotalPages(json.pagination.totalPages || 1);
          }
          if (json.summary) {
            setSummary(json.summary);
          }
          if (list.length > 0) {
            setSelectedItem((prev) => {
              if (!prev) return list[0];
              const exists = list.find(
                (d) => d.notificacion_orden_trabajo_id === prev.notificacion_orden_trabajo_id
              );
              return exists || list[0];
            });
          } else {
            setSelectedItem(null);
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
      "Fecha Registro",
      "Fecha Envio",
      "Fecha Actualizacion",
      "Orden",
      "Cliente",
      "Telefono",
      "Tipo",
      "Estado Envio",
      "Estado Proveedor",
      "Codigo HTTP",
      "Batch ID",
      "Mensaje",
      "Usuario Registro"
    ];

    const rows = data.map((item) => [
      item.notificacion_orden_trabajo_id,
      formatFullDate(item.fecha_registro),
      formatFullDate(item.fecha_envio),
      formatFullDate(item.fecha_actualizacion),
      `"${item.codigo_orden || ""}"`,
      `"${(item.nombre_cliente || "").replace(/"/g, '""')}"`,
      `"${item.telefono_destino || ""}"`,
      `"${item.tipo_notificacion || ""}"`,
      `"${item.estado_envio || ""}"`,
      `"${item.estado_proveedor || ""}"`,
      item.codigo_http || "",
      `"${item.textbee_batch_id || ""}"`,
      `"${(item.mensaje || "").replace(/"/g, '""')}"`,
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
        className={`px-2.5 py-2 text-left text-[11px] font-mono font-bold tracking-wider uppercase cursor-pointer select-none transition-colors hover:text-foreground text-foreground-secondary ${extraClass}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap">{label}</span>
          <span className="shrink-0">
            {isSorted ? (
              sortOrder === "asc" ? (
                <ArrowUp size={11} className="text-primary" />
              ) : (
                <ArrowDown size={11} className="text-primary" />
              )
            ) : (
              <ArrowUpDown size={10} className="text-foreground-disabled opacity-50" />
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
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shadow-sm shrink-0">
            <Mail size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-tight">
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
            className="h-8 flex items-center gap-1.5 px-3 bg-surface-subtle hover:bg-hover border border-border rounded-lg text-xs font-mono font-medium text-foreground transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin text-primary" : "text-foreground-muted"} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || data.length === 0}
            className="h-8 flex items-center gap-1.5 px-3.5 bg-surface-subtle hover:bg-hover border border-border text-foreground rounded-lg text-xs font-mono font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Exportar a CSV"
          >
            <Download size={12} className="text-primary" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 3. Summary Cards Bar (6 compact cards matching Ride Lab branding) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        {/* Total */}
        <div
          onClick={() => handleMetricCardClick("TOTAL")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "TODOS"
              ? "bg-primary/10 border-primary ring-1 ring-primary/40"
              : "bg-card border-border hover:border-primary/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-surface-subtle border border-border flex items-center justify-center text-primary">
              <MessageSquare size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-foreground tracking-tight leading-none">
            {summary.total}
          </div>
          <div className="text-[10px] font-mono text-foreground-muted uppercase font-bold leading-none">
            Total
          </div>
        </div>

        {/* Pendientes */}
        <div
          onClick={() => handleMetricCardClick("PENDIENTE")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "PENDIENTE"
              ? "bg-warning/15 border-warning ring-1 ring-warning/50"
              : "bg-card border-border hover:border-warning/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-warning/15 border border-warning/30 flex items-center justify-center text-warning">
              <Clock size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-warning tracking-tight leading-none">
            {summary.pendientes}
          </div>
          <div className="text-[10px] font-mono text-warning/80 uppercase font-bold leading-none">
            Pendientes
          </div>
        </div>

        {/* Enviadas */}
        <div
          onClick={() => handleMetricCardClick("ENVIADO")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ENVIADO"
              ? "bg-info/15 border-info ring-1 ring-info/50"
              : "bg-card border-border hover:border-info/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-info/15 border border-info/30 flex items-center justify-center text-info">
              <Send size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-info tracking-tight leading-none">
            {summary.enviadas}
          </div>
          <div className="text-[10px] font-mono text-info/80 uppercase font-bold leading-none">
            Enviadas
          </div>
        </div>

        {/* Entregadas */}
        <div
          onClick={() => handleMetricCardClick("ENTREGADO")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ENTREGADO"
              ? "bg-success/15 border-success ring-1 ring-success/50"
              : "bg-card border-border hover:border-success/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-success/15 border border-success/30 flex items-center justify-center text-success">
              <CheckCircle2 size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-success tracking-tight leading-none">
            {summary.entregadas}
          </div>
          <div className="text-[10px] font-mono text-success/80 uppercase font-bold leading-none">
            Entregadas
          </div>
        </div>

        {/* Errores */}
        <div
          onClick={() => handleMetricCardClick("ERROR")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "ERROR"
              ? "bg-error/15 border-error ring-1 ring-error/50"
              : "bg-card border-border hover:border-error/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-error/15 border border-error/30 flex items-center justify-center text-error">
              <AlertTriangle size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-error tracking-tight leading-none">
            {summary.errores}
          </div>
          <div className="text-[10px] font-mono text-error/80 uppercase font-bold leading-none">
            Errores
          </div>
        </div>

        {/* Sin confirmar */}
        <div
          onClick={() => handleMetricCardClick("SIN_CONFIRMAR")}
          className={`h-[74px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            estadoFilter === "SIN_CONFIRMAR"
              ? "bg-surface-elevated border-border-strong ring-1 ring-primary/30"
              : "bg-card border-border hover:border-border-strong"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-5 h-5 rounded-md bg-surface-subtle border border-border flex items-center justify-center text-foreground-muted">
              <Radio size={11} />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-foreground-secondary tracking-tight leading-none">
            {summary.sin_confirmar}
          </div>
          <div className="text-[10px] font-mono text-foreground-muted uppercase font-bold leading-none">
            Sin confirmar
          </div>
        </div>
      </div>

      {/* 4. Filter Panel (Ride Lab Card) */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-card border border-border rounded-xl p-2.5 shadow-sm space-y-2 shrink-0"
      >
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
          Filtros de búsqueda
        </div>

        {/* Row 1: Search + Selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Search Input */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Buscar</label>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-disabled pointer-events-none"
              />
              <input
                type="text"
                placeholder="Código OT, cliente, teléfono..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-input border border-border rounded-lg pl-8 pr-2.5 h-8 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Tipo de Notificación */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Tipo de notificación</label>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-input border border-border rounded-lg px-2.5 h-8 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="BIENVENIDA">Bienvenida</option>
              <option value="ESTADO">Estado</option>
              <option value="CIERRE">Cierre</option>
            </select>
          </div>

          {/* Estado de Envío */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-input border border-border rounded-lg px-2.5 h-8 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
            <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Estado proveedor</label>
            <select
              value={estadoProveedorFilter}
              onChange={(e) => {
                setEstadoProveedorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-input border border-border rounded-lg px-2.5 h-8 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
              <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                className="bg-input border border-border rounded-lg px-2.5 h-8 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-mono text-foreground-muted block leading-tight">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
                className="bg-input border border-border rounded-lg px-2.5 h-8 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Buttons: Limpiar + Buscar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 h-8 bg-surface-subtle hover:bg-hover border border-border rounded-lg text-xs font-mono text-foreground-secondary transition-colors cursor-pointer"
            >
              <FilterX size={13} />
              <span>Limpiar filtros</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 h-8 bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono text-xs font-bold rounded-lg transition-all shadow-md cursor-pointer"
            >
              <Search size={13} />
              <span>Buscar</span>
            </button>
          </div>
        </div>
      </form>

      {/* 5. Table Header Count and Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono shrink-0 py-0.5">
        <div className="text-foreground-muted">
          <span className="font-bold text-foreground">{totalRecords}</span> registros encontrados
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-foreground-muted">
            <span>Filas por página</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-input border border-border rounded-md px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
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
              className="w-6 h-6 flex items-center justify-center rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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
                      ? "bg-primary-button-bg text-primary-foreground shadow-sm"
                      : "border border-border bg-surface-subtle text-foreground-secondary hover:border-primary/40 hover:text-foreground hover:bg-hover"
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
              className="w-6 h-6 flex items-center justify-center rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Main Data Table with Dynamic Viewport Height */}
      <div
        className={`bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0 transition-all duration-200 ${
          selectedItem ? "flex-[6] min-h-[160px]" : "flex-1 min-h-[220px]"
        }`}
      >
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-surface-subtle shadow-sm">
              <tr className="border-b border-border whitespace-nowrap">
                {renderSortableHeader("Fecha registro", "fecha_registro", "w-px whitespace-nowrap")}
                {renderSortableHeader("Fecha envío", "fecha_envio", "w-px whitespace-nowrap")}
                {renderSortableHeader("Fecha actualización", "fecha_actualizacion", "w-px whitespace-nowrap")}
                {renderSortableHeader("Orden", "codigo_orden", "w-px whitespace-nowrap")}
                {renderSortableHeader("Cliente", "nombre_cliente", "w-px whitespace-nowrap")}
                <th className="w-px whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-mono font-bold tracking-wider text-foreground-secondary uppercase">
                  Teléfono
                </th>
                {renderSortableHeader("Tipo", "tipo_notificacion", "w-px whitespace-nowrap")}
                {renderSortableHeader("Estado envío", "estado_envio", "w-px whitespace-nowrap")}
                {renderSortableHeader("Estado proveedor", "estado_proveedor", "w-px whitespace-nowrap")}
                <th className="px-2.5 py-2 text-left text-[11px] font-mono font-bold tracking-wider text-foreground-secondary uppercase w-full">
                  Mensaje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-foreground-muted font-mono text-xs">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-1.5" size={20} />
                    Cargando notificaciones de órdenes...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-error font-mono text-xs">
                    <AlertTriangle size={20} className="mx-auto mb-1.5 text-error" />
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-foreground-muted font-mono italic text-xs">
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
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-hover"
                      }`}
                    >
                      {/* Fecha Registro */}
                      <td className="w-px px-2.5 py-1.5 font-mono text-foreground-secondary whitespace-nowrap text-xs">
                        {formatFullDate(item.fecha_registro)}
                      </td>

                      {/* Fecha Envío */}
                      <td className="w-px px-2.5 py-1.5 font-mono text-foreground-secondary whitespace-nowrap text-xs">
                        {formatFullDate(item.fecha_envio)}
                      </td>

                      {/* Fecha Actualización */}
                      <td className="w-px px-2.5 py-1.5 font-mono text-foreground-secondary whitespace-nowrap text-xs">
                        {formatFullDate(item.fecha_actualizacion)}
                      </td>

                      {/* Código de Orden */}
                      <td className="w-px px-2.5 py-1.5 whitespace-nowrap text-xs">
                        {item.orden_trabajo_id ? (
                          <Link
                            href={`/workshop?view=work_orders&order_id=${item.orden_trabajo_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <span>{item.codigo_orden || `OT-${item.orden_trabajo_id}`}</span>
                          </Link>
                        ) : (
                          <span className="font-mono text-foreground-muted">
                            {item.codigo_orden || "-"}
                          </span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="w-px px-2.5 py-1.5 text-foreground font-medium whitespace-nowrap text-xs max-w-[150px] truncate" title={item.nombre_cliente || "Cliente no especificado"}>
                        {item.nombre_cliente || "Cliente no especificado"}
                      </td>

                      {/* Teléfono */}
                      <td className="w-px px-2.5 py-1.5 font-mono text-foreground-secondary whitespace-nowrap text-xs">
                        {item.telefono_destino || "-"}
                      </td>

                      {/* Tipo */}
                      <td className="w-px px-2.5 py-1.5 whitespace-nowrap">
                        <NotificationTypeBadge type={item.tipo_notificacion} />
                      </td>

                      {/* Estado Envío */}
                      <td className="w-px px-2.5 py-1.5 whitespace-nowrap">
                        <DeliveryStatusBadge status={item.estado_envio} />
                      </td>

                      {/* Proveedor / Estado proveedor */}
                      <td className="w-px px-2.5 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="text-[10px] font-medium text-foreground-muted">TextBee</span>
                          <ProviderStatusLabel providerStatus={item.estado_proveedor} />
                        </div>
                      </td>

                      {/* Mensaje */}
                      <td className="px-2.5 py-1.5 text-foreground-secondary text-xs" title={item.mensaje}>
                        <div className="line-clamp-2 leading-snug break-words select-text">
                          {item.mensaje || "-"}
                        </div>
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
          className="bg-card border border-border rounded-xl p-3 shadow-2xl flex flex-col min-h-0 flex-[4] max-h-[38%] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 shrink-0"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-border pb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Mail size={12} />
              </span>
              <h2 className="text-xs font-bold text-foreground tracking-wide">
                Detalle de notificación #{selectedItem.notificacion_orden_trabajo_id}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
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
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border pb-0.5">
                  Información general
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">ID:</span>
                  <span className="text-foreground font-bold">{selectedItem.notificacion_orden_trabajo_id}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Orden de trabajo:</span>
                  {selectedItem.orden_trabajo_id ? (
                    <Link
                      href={`/workshop?view=work_orders&order_id=${selectedItem.orden_trabajo_id}`}
                      className="font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>{selectedItem.codigo_orden || `OT-${selectedItem.orden_trabajo_id}`}</span>
                      <ExternalLink size={10} />
                    </Link>
                  ) : (
                    <span className="text-foreground-secondary">{selectedItem.codigo_orden || "-"}</span>
                  )}
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Cliente:</span>
                  <span className="text-foreground font-sans font-medium text-right">
                    {selectedItem.nombre_cliente || "-"}
                  </span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Tipo de notificación:</span>
                  <NotificationTypeBadge type={selectedItem.tipo_notificacion} />
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Teléfono destino:</span>
                  <span className="text-foreground">{selectedItem.telefono_destino || "-"}</span>
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-foreground-muted text-[10px]">
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
                  <div className="bg-surface-subtle border border-border rounded-lg p-2 text-[11px] font-sans text-foreground whitespace-pre-wrap leading-relaxed max-h-16 overflow-y-auto custom-scrollbar">
                    {selectedItem.mensaje}
                  </div>
                </div>
              </div>

              {/* Columna 2: Estado y Respuesta */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border pb-0.5">
                  Estado y respuesta
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Estado envío:</span>
                  <DeliveryStatusBadge status={selectedItem.estado_envio} />
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Estado proveedor:</span>
                  <ProviderStatusLabel providerStatus={selectedItem.estado_proveedor} />
                </div>

                <div className="flex items-center justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Código HTTP:</span>
                  <span className="text-foreground font-bold">{selectedItem.codigo_http || "-"}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle gap-2 text-[11px]">
                  <span className="text-foreground-muted shrink-0">Batch ID:</span>
                  {selectedItem.textbee_batch_id ? (
                    <div className="flex items-center gap-1 text-right overflow-hidden">
                      <span className="text-foreground-secondary truncate max-w-[140px]" title={selectedItem.textbee_batch_id}>
                        {selectedItem.textbee_batch_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedItem.textbee_batch_id, "batch")}
                        className="text-foreground-muted hover:text-foreground cursor-pointer"
                        title="Copiar Batch ID"
                      >
                        {copiedField === "batch" ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-foreground-disabled">-</span>
                  )}
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle gap-2 text-[11px]">
                  <span className="text-foreground-muted shrink-0">Error mensaje:</span>
                  <span className="text-error text-right truncate max-w-[180px]" title={selectedItem.error_mensaje || "-"}>
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
                      <div className="mt-1 bg-input border border-border rounded-lg p-2 text-[10px] text-foreground-secondary max-h-24 overflow-auto relative">
                        <button
                          type="button"
                          onClick={() => handleCopy(JSON.stringify(selectedItem.respuesta_proveedor, null, 2), "json")}
                          className="absolute top-1.5 right-1.5 p-1 bg-surface-subtle hover:bg-hover border border-border rounded text-foreground-muted hover:text-foreground"
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
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border pb-0.5">
                  Fechas y usuario
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Fecha registro:</span>
                  <span className="text-foreground text-right">{formatFullDate(selectedItem.fecha_registro)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Fecha envío:</span>
                  <span className="text-foreground text-right">{formatFullDate(selectedItem.fecha_envio)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Fecha actualización:</span>
                  <span className="text-foreground text-right">{formatFullDate(selectedItem.fecha_actualizacion)}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Usuario registro:</span>
                  <span className="text-foreground text-right">{selectedItem.usuario_nombre || "Sistema"}</span>
                </div>

                <div className="flex items-start justify-between py-0.5 border-b border-border-subtle text-[11px]">
                  <span className="text-foreground-muted">Empresa:</span>
                  <span className="text-foreground text-right">{selectedItem.nombre_empresa || "Ride Lab"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
