"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  DollarSign, 
  CreditCard, 
  AlertCircle, 
  Receipt 
} from "lucide-react";
import { ReportHeader } from "./ReportHeader";
import { ReportKpiCard, ReportKpiGrid } from "./ReportKpiCard";
import { ReportPagination } from "./ReportPagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { 
  exportReportToPdf, 
  exportReportToExcel, 
  formatCurrency, 
  getTodaySantoDomingo,
  ReportFilter, 
  ReportKpi, 
  ReportTableColumn 
} from "@/lib/reports/reportExportService";

export interface ReceivableRow {
  factura_id: number;
  numero_factura: string;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
  cliente_id: number;
  cliente_nombre: string;
  cliente_identificacion?: string | null;
  cliente_telefono?: string | null;
  total_facturado: number;
  total_pagado: number;
  saldo_pendiente: number;
  estado_cobro: string;
  estado_vencimiento: string;
  [key: string]: unknown;
}

interface ReceivablesReportViewProps {
  initialCompany?: string;
  canExport?: boolean;
}

export function ReceivablesReportView({ initialCompany, canExport }: ReceivablesReportViewProps) {
  const todayStr = getTodaySantoDomingo();

  // Data state
  const [data, setData] = useState<ReceivableRow[]>([]);
  const [kpis, setKpis] = useState({
    totalFacturado: 0,
    totalCobrado: 0,
    saldoPendiente: 0,
    cantidadFacturas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<{
    clients: { cliente_id: number; nombre: string; identificacion?: string; telefono?: string }[];
  }>({ clients: [] });

  // Filter form state
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState(todayStr);
  const [fechaHasta, setFechaHasta] = useState(todayStr);
  const [clienteId, setClienteId] = useState("");
  const [estadoCobro, setEstadoCobro] = useState("TODOS");
  const [vencimiento, setVencimiento] = useState("TODOS");
  const [saldoMin, setSaldoMin] = useState("");
  const [saldoMax, setSaldoMax] = useState("");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState("fecha_factura");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Export states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Load dropdown options once
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/reports/filter-options");
        if (res.ok) {
          const json = await res.json();
          setFilterOptions({ clients: json.clients || [] });
        }
      } catch (err: unknown) {
        console.error("Error loading filter options:", err);
      }
    }
    loadOptions();
  }, []);

  // Quick Date Preset helper
  const applyDatePreset = (preset: "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL") => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const today = getTodaySantoDomingo();

    if (preset === "TODAY") {
      setFechaDesde(today);
      setFechaHasta(today);
    } else if (preset === "THIS_MONTH") {
      const [yearStr, monthStr] = today.split("-");
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const end = new Date(y, m, 0);
      setFechaDesde(`${y}-${pad(m)}-01`);
      setFechaHasta(`${y}-${pad(m)}-${pad(end.getDate())}`);
    } else if (preset === "LAST_MONTH") {
      const [yearStr, monthStr] = today.split("-");
      let y = parseInt(yearStr, 10);
      let m = parseInt(monthStr, 10) - 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      const end = new Date(y, m, 0);
      setFechaDesde(`${y}-${pad(m)}-01`);
      setFechaHasta(`${y}-${pad(m)}-${pad(end.getDate())}`);
    } else if (preset === "THIS_YEAR") {
      const [yearStr] = today.split("-");
      setFechaDesde(`${yearStr}-01-01`);
      setFechaHasta(`${yearStr}-12-31`);
    } else {
      setFechaDesde("");
      setFechaHasta("");
    }
    setPage(1);
  };

  // Build query string
  const buildQueryParams = useCallback(
    (exportAll = false) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      if (clienteId) params.set("cliente_id", clienteId);
      if (estadoCobro !== "TODOS") params.set("estado_cobro", estadoCobro);
      if (vencimiento !== "TODOS") params.set("vencimiento", vencimiento);
      if (saldoMin) params.set("saldo_min", saldoMin);
      if (saldoMax) params.set("saldo_max", saldoMax);

      params.set("sort_by", sortBy);
      params.set("sort_direction", sortDirection);

      if (exportAll) {
        params.set("all", "true");
      } else {
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      return params.toString();
    },
    [search, fechaDesde, fechaHasta, clienteId, estadoCobro, vencimiento, saldoMin, saldoMax, sortBy, sortDirection, page, pageSize]
  );

  // Fetch report data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryParams(false);
      const res = await fetch(`/api/reports/receivables?${qs}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Error al consultar los datos del reporte.");
      }

      const json = await res.json();
      setData(json.data || []);
      setKpis(json.kpis || { totalFacturado: 0, totalCobrado: 0, saldoPendiente: 0, cantidadFacturas: 0 });
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch (err: unknown) {
      console.error("Error in fetchData receivables:", err);
      const msg = err instanceof Error ? err.message : "Error al conectar con el servidor.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Handle Sort Toggle
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setFechaDesde(todayStr);
    setFechaHasta(todayStr);
    setClienteId("");
    setEstadoCobro("TODOS");
    setVencimiento("TODOS");
    setSaldoMin("");
    setSaldoMax("");
    setPage(1);
  };

  // Prepare Export Meta
  const getExportMeta = async () => {
    const qs = buildQueryParams(true);
    const res = await fetch(`/api/reports/receivables?${qs}`);
    if (!res.ok) throw new Error("Error al obtener datos completos para exportación.");
    const json = await res.json();

    const activeFilters: ReportFilter[] = [];
    if (fechaDesde || fechaHasta) {
      activeFilters.push({
        label: "Período",
        value: `${fechaDesde || "Inicio"} a ${fechaHasta || "Hoy"}`,
      });
    }
    if (clienteId) {
      const cli = filterOptions.clients.find((c) => String(c.cliente_id) === String(clienteId));
      activeFilters.push({ label: "Cliente", value: cli?.nombre || clienteId });
    }
    if (estadoCobro !== "TODOS") {
      activeFilters.push({ label: "Estado Cobro", value: estadoCobro });
    }
    if (vencimiento !== "TODOS") {
      activeFilters.push({ label: "Vencimiento", value: vencimiento });
    }
    if (saldoMin || saldoMax) {
      activeFilters.push({
        label: "Rango Saldo",
        value: `RD$ ${saldoMin || "0"} - ${saldoMax || "Max"}`,
      });
    }
    if (search) {
      activeFilters.push({ label: "Búsqueda", value: search });
    }

    const exportKpis: ReportKpi[] = [
      { label: "Total Facturado", value: formatCurrency(json.kpis.totalFacturado), sublabel: "Facturas pendientes" },
      { label: "Total Cobrado", value: formatCurrency(json.kpis.totalCobrado), sublabel: "Abonos aplicados" },
      { label: "Saldo Pendiente", value: formatCurrency(json.kpis.saldoPendiente), sublabel: "Por cobrar a la fecha" },
      { label: "Facturas Pendientes", value: json.kpis.cantidadFacturas, sublabel: "Documentos con saldo" },
    ];

    const exportColumns: ReportTableColumn[] = [
      { header: "N° Factura", key: "numero_factura", width: 32 },
      { header: "Fecha Emisión", key: "fecha_factura", isDate: true, width: 24, align: "center" },
      { header: "Fecha Venc.", key: "fecha_vencimiento_str", width: 24, align: "center" },
      { header: "Cliente", key: "cliente_nombre", width: 45 },
      { header: "Total Facturado", key: "total_facturado", isCurrency: true, width: 28, align: "right" },
      { header: "Total Pagado", key: "total_pagado", isCurrency: true, width: 28, align: "right" },
      { header: "Saldo Pendiente", key: "saldo_pendiente", isCurrency: true, width: 28, align: "right" },
      { header: "Estado Cobro", key: "estado_cobro", width: 24, align: "center" },
      { header: "Vencimiento", key: "estado_vencimiento_label", width: 24, align: "center" },
    ];

    const exportRows: Record<string, unknown>[] = (json.data || []).map((r: ReceivableRow) => ({
      ...r,
      fecha_vencimiento_str: r.fecha_vencimiento
        ? new Date(r.fecha_vencimiento).toLocaleDateString("es-DO")
        : "Sin vencimiento",
      estado_vencimiento_label:
        r.estado_vencimiento === "VENCIDA"
          ? "Vencida"
          : r.estado_vencimiento === "AL_DIA"
          ? "Al día"
          : "Sin vencimiento",
    }));

    const exportTotals = {
      total_facturado: json.kpis.totalFacturado,
      total_pagado: json.kpis.totalCobrado,
      saldo_pendiente: json.kpis.saldoPendiente,
    };

    return {
      title: "Reporte de Cuentas por Cobrar",
      subtitle: "Facturas de clientes con saldo pendiente de cobro",
      companyName: initialCompany || "Ride Lab",
      filename: `reporte_cuentas_por_cobrar_${new Date().toISOString().split("T")[0]}`,
      filters: activeFilters,
      kpis: exportKpis,
      columns: exportColumns,
      rows: exportRows,
      totals: exportTotals,
    };
  };

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const meta = await getExportMeta();
      await exportReportToPdf(meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      alert("Error al exportar PDF: " + msg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Excel Export
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const meta = await getExportMeta();
      await exportReportToExcel(meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      alert("Error al exportar Excel: " + msg);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-3.5 font-mono text-foreground">
      {/* 1. Encabezado */}
      <ReportHeader
        title="Cuentas por Cobrar"
        subtitle="Identificación y seguimiento de facturas de clientes con saldo pendiente de cobro"
        canExport={canExport}
        onRefresh={fetchData}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        isExportingExcel={isExportingExcel}
        isExportingPdf={isExportingPdf}
        isLoading={loading}
        totalRecords={totalRecords}
      />

      {/* 2. Tarjetas KPI */}
      <ReportKpiGrid>
        <ReportKpiCard
          label="Total Facturado"
          value={formatCurrency(kpis.totalFacturado)}
          sublabel="Total en facturas pendientes"
          icon={<Receipt className="w-5 h-5 text-primary" />}
          variant="primary"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Total Cobrado"
          value={formatCurrency(kpis.totalCobrado)}
          sublabel="Abonos y pagos parciales"
          icon={<CreditCard className="w-5 h-5 text-emerald-500" />}
          variant="emerald"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Saldo Pendiente"
          value={formatCurrency(kpis.saldoPendiente)}
          sublabel="Balance total por recaudar"
          icon={<DollarSign className="w-5 h-5 text-amber-500" />}
          variant="amber"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Facturas Pendientes"
          value={kpis.cantidadFacturas}
          sublabel="Documentos pendientes de cobro"
          icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
          variant="rose"
          isLoading={loading}
        />
      </ReportKpiGrid>

      {/* 3. Panel de Filtros */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros de Búsqueda</span>
          </div>
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[10px] text-foreground-muted mr-1">RÁPIDOS:</span>
            <button
              type="button"
              onClick={() => applyDatePreset("TODAY")}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("THIS_MONTH")}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("LAST_MONTH")}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Mes Anterior
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("THIS_YEAR")}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Año Actual
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("ALL")}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Todos
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
          {/* Search box */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Búsqueda general
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="N° Factura, RNC, cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-subtle border border-border text-foreground rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
              />
            </div>
          </div>

          {/* Fecha Desde */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Fecha Hasta */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Cliente con Búsqueda */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Cliente
            </label>
            <SearchableSelect
              value={clienteId}
              onChange={(val) => {
                setClienteId(val);
                setPage(1);
              }}
              allOption={{ value: "", label: "Todos los clientes" }}
              options={filterOptions.clients.map((c) => ({
                value: String(c.cliente_id),
                label: c.nombre,
                sublabel: [c.identificacion, c.telefono].filter(Boolean).join(" • "),
              }))}
              placeholder="Todos los clientes"
              searchPlaceholder="Buscar cliente por nombre, cédula o teléfono..."
            />
          </div>

          {/* Estado de Cobro */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Estado de Cobro
            </label>
            <select
              value={estadoCobro}
              onChange={(e) => {
                setEstadoCobro(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="TODOS">Todos (Con saldo)</option>
              <option value="PENDIENTE">100% Pendiente (Sin abonos)</option>
              <option value="PAGO_PARCIAL">Pago Parcial (Con abonos)</option>
            </select>
          </div>

          {/* Vencimiento */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Vencimiento
            </label>
            <select
              value={vencimiento}
              onChange={(e) => {
                setVencimiento(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="TODOS">Todos los vencimientos</option>
              <option value="VENCIDAS">Vencidas (Fecha superada)</option>
              <option value="NO_VENCIDAS">Al día (Dentro del plazo)</option>
              <option value="SIN_VENCIMIENTO">Sin fecha de vencimiento</option>
            </select>
          </div>

          {/* Rango Saldo Mínimo */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Saldo Mínimo (RD$)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={saldoMin}
              onChange={(e) => {
                setSaldoMin(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Rango Saldo Máximo */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Saldo Máximo (RD$)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={saldoMax}
              onChange={(e) => {
                setSaldoMax(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>
        </div>

        {/* Buttons Bar */}
        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/60">
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:bg-hover transition-all text-xs cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>LIMPIAR FILTROS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              fetchData();
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-lg border border-primary/40 bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary-hover transition-all cursor-pointer shadow-sm"
          >
            <Filter className="w-3 h-3" />
            <span>APLICAR FILTROS</span>
          </button>
        </div>
      </div>

      {/* 4. Tabla de Resultados */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchData}
              className="underline hover:text-rose-400 font-bold ml-2 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-foreground-muted font-bold uppercase tracking-wider text-[11px]">
                <th
                  onClick={() => handleSort("numero_factura")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>N° Factura</span>
                    {sortBy === "numero_factura" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("fecha_factura")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Emisión</span>
                    {sortBy === "fecha_factura" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("fecha_vencimiento")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vencimiento</span>
                    {sortBy === "fecha_vencimiento" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("cliente_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cliente</span>
                    {sortBy === "cliente_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("total_facturado")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Facturado</span>
                    {sortBy === "total_facturado" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("total_pagado")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Pagado</span>
                    {sortBy === "total_pagado" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("saldo_pendiente")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Saldo Pendiente</span>
                    {sortBy === "saldo_pendiente" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 text-center">Estado Cobro</th>
                <th className="px-3 py-2 text-center">Vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-3.5 w-24 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-32 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-14 bg-surface-subtle rounded mx-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-14 bg-surface-subtle rounded mx-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-foreground-muted">
                    <Receipt className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p className="font-semibold text-xs">No se encontraron facturas con saldo pendiente</p>
                    <p className="text-[11px] text-foreground-muted mt-0.5">Pruebe ajustando los filtros de búsqueda o fechas seleccionadas.</p>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const isOverdue = row.estado_vencimiento === "VENCIDA";
                  const isUpToDate = row.estado_vencimiento === "AL_DIA";
                  const isPartial = row.estado_cobro === "PAGO PARCIAL";

                  return (
                    <tr
                      key={row.factura_id}
                      className="hover:bg-surface-subtle/70 transition-colors group"
                    >
                      <td className="px-3 py-2 font-bold text-foreground">
                        {row.numero_factura}
                      </td>
                      <td className="px-3 py-2 text-foreground-secondary whitespace-nowrap">
                        {row.fecha_factura
                          ? new Date(row.fecha_factura).toLocaleDateString("es-DO")
                          : "--"}
                      </td>
                      <td className="px-3 py-2 text-foreground-secondary whitespace-nowrap">
                        {row.fecha_vencimiento ? (
                          <span className={isOverdue ? "text-rose-500 font-bold" : ""}>
                            {new Date(row.fecha_vencimiento).toLocaleDateString("es-DO")}
                          </span>
                        ) : (
                          <span className="text-foreground-muted italic">Sin vencimiento</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">
                          {row.cliente_nombre}
                        </div>
                        {row.cliente_telefono && (
                          <div className="text-[10px] text-foreground-muted">
                            {row.cliente_telefono}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                        {formatCurrency(row.total_facturado)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-500 font-medium whitespace-nowrap">
                        {formatCurrency(row.total_pagado)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-amber-500 whitespace-nowrap">
                        {formatCurrency(row.saldo_pendiente)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            isPartial
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          }`}
                        >
                          {row.estado_cobro}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            isOverdue
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                              : isUpToDate
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "bg-surface-subtle text-foreground-muted border-border"
                          }`}
                        >
                          {isOverdue ? "Vencida" : isUpToDate ? "Al día" : "Sin fecha"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Totals Footer Row */}
            {data.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-subtle font-bold text-foreground">
                  <td colSpan={4} className="px-3 py-2 uppercase tracking-wider text-[11px]">
                    TOTAL GENERAL ({totalRecords} {totalRecords === 1 ? "factura" : "facturas"})
                  </td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                    {formatCurrency(kpis.totalFacturado)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-500 text-xs whitespace-nowrap">
                    {formatCurrency(kpis.totalCobrado)}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-500 text-xs font-bold whitespace-nowrap">
                    {formatCurrency(kpis.saldoPendiente)}
                  </td>
                  <td colSpan={2} className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Paginación */}
        <div className="p-2.5 px-3 border-t border-border bg-surface">
          <ReportPagination
            page={page}
            pageSize={pageSize}
            total={totalRecords}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            isLoading={loading}
          />
        </div>
      </div>
    </div>
  );
}
