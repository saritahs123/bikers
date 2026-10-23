"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Banknote, 
  ArrowRightLeft, 
  CreditCard, 
  Receipt, 
  AlertCircle
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
  ReportTableColumn,
  AdditionalSheet 
} from "@/lib/reports/reportExportService";

interface DailyCashReportViewProps {
  initialCompany?: string;
  canExport?: boolean;
}

export interface DailyCashRow {
  pago_id: number;
  fecha_pago: string;
  importe: number;
  numero_factura: string;
  numero_transaccion: string | null;
  cliente_nombre: string;
  metodo_pago: string;
  responsable_nombre: string;
  estado_pago: string;
  [key: string]: unknown;
}

export interface DailyCashMethodSummary {
  metodo_pago: string;
  cantidad: number;
  total_monto: number;
  [key: string]: unknown;
}

export function DailyCashReportView({ initialCompany, canExport }: DailyCashReportViewProps) {
  const todayStr = getTodaySantoDomingo();

  // Data state
  const [data, setData] = useState<DailyCashRow[]>([]);
  const [methodSummary, setMethodSummary] = useState<DailyCashMethodSummary[]>([]);
  const [kpis, setKpis] = useState({
    totalCobrosEfectivos: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalTarjeta: 0,
    totalOtros: 0,
    cantidadTransacciones: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<{
    paymentMethods: { tipo_pago_id: number; codigo: string; nombre: string }[];
    users: { usuario_id: number; nombre: string }[];
  }>({ paymentMethods: [], users: [] });

  // Filter form state
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState(todayStr);
  const [fechaHasta, setFechaHasta] = useState(todayStr);
  const [tipoPagoId, setTipoPagoId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [estadoPago, setEstadoPago] = useState("TODOS");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState("fecha_pago");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Export states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Load dropdown options
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/reports/filter-options");
        if (res.ok) {
          const json = await res.json();
          setFilterOptions({
            paymentMethods: json.paymentMethods || [],
            users: json.users || [],
          });
        }
      } catch (err) {
        console.error("Error loading filter options:", err);
      }
    }
    loadOptions();
  }, []);

  // Quick Date Presets
  const applyDatePreset = (preset: "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH") => {
    const today = getTodaySantoDomingo();
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");

    if (preset === "TODAY") {
      setFechaDesde(today);
      setFechaHasta(today);
    } else if (preset === "YESTERDAY") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
      setFechaDesde(yStr);
      setFechaHasta(yStr);
    } else if (preset === "THIS_WEEK") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      setFechaDesde(`${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`);
      setFechaHasta(today);
    } else if (preset === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFechaDesde(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
      setFechaHasta(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`);
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
      if (tipoPagoId) params.set("tipo_pago_id", tipoPagoId);
      if (usuarioId) params.set("usuario_id", usuarioId);
      if (estadoPago !== "TODOS") params.set("estado_pago", estadoPago);

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
    [search, fechaDesde, fechaHasta, tipoPagoId, usuarioId, estadoPago, sortBy, sortDirection, page, pageSize]
  );

  // Fetch report data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryParams(false);
      const res = await fetch(`/api/reports/daily-cash?${qs}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Error al consultar cuadre de caja.");
      }

      const json = await res.json();
      setData(json.data || []);
      setMethodSummary(json.methodSummary || []);
      setKpis(json.kpis || {
        totalCobrosEfectivos: 0,
        totalEfectivo: 0,
        totalTransferencia: 0,
        totalTarjeta: 0,
        totalOtros: 0,
        cantidadTransacciones: 0,
      });
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch (err: unknown) {
      console.error("Error in fetchData daily-cash:", err);
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

  // Handle Sort
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortDirection(columnKey === "importe" ? "desc" : "asc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    const today = getTodaySantoDomingo();
    setSearch("");
    setFechaDesde(today);
    setFechaHasta(today);
    setTipoPagoId("");
    setUsuarioId("");
    setEstadoPago("TODOS");
    setPage(1);
  };

  // Prepare Export Meta
  const getExportMeta = async () => {
    const qs = buildQueryParams(true);
    const res = await fetch(`/api/reports/daily-cash?${qs}`);
    if (!res.ok) throw new Error("Error al obtener datos completos para exportación.");
    const json = await res.json();

    const activeFilters: ReportFilter[] = [
      { label: "Jornada / Fechas", value: `${fechaDesde} al ${fechaHasta}` },
    ];
    if (tipoPagoId) {
      const tp = filterOptions.paymentMethods.find((p) => String(p.tipo_pago_id) === String(tipoPagoId));
      activeFilters.push({ label: "Método de Pago", value: tp?.nombre || tipoPagoId });
    }
    if (usuarioId) {
      const u = filterOptions.users.find((usr) => String(usr.usuario_id) === String(usuarioId));
      activeFilters.push({ label: "Responsable", value: u?.nombre || usuarioId });
    }
    if (estadoPago !== "TODOS") {
      activeFilters.push({ label: "Estado Pago", value: estadoPago });
    }
    if (search) {
      activeFilters.push({ label: "Búsqueda", value: search });
    }

    const exportKpis: ReportKpi[] = [
      { label: "Total Cobros Efectivos", value: formatCurrency(json.kpis.totalCobrosEfectivos), sublabel: "Cobros Recibidos" },
      { label: "Cobros en Efectivo", value: formatCurrency(json.kpis.totalEfectivo), sublabel: "Total en billetes / monedas" },
      { label: "Cobros por Transferencia", value: formatCurrency(json.kpis.totalTransferencia), sublabel: "Depósitos y transferencias" },
      { label: "Tarjetas y Otros", value: formatCurrency(json.kpis.totalTarjeta + json.kpis.totalOtros), sublabel: "POS y otros métodos" },
    ];

    const exportColumns: ReportTableColumn[] = [
      { header: "Fecha y Hora", key: "fecha_hora_str", width: 30, align: "center" },
      { header: "N° Factura / Transac.", key: "numero_factura", width: 28 },
      { header: "Cliente", key: "cliente_nombre", width: 40 },
      { header: "Método de Pago", key: "metodo_pago", width: 26, align: "center" },
      { header: "Responsable", key: "responsable_nombre", width: 32 },
      { header: "Importe", key: "importe", isCurrency: true, width: 26, align: "right" },
      { header: "Estado", key: "estado_pago", width: 20, align: "center" },
    ];

    const exportRows: Record<string, unknown>[] = (((json.data as DailyCashRow[]) || [])).map((r) => {
      const d = r.fecha_pago ? new Date(r.fecha_pago) : null;
      return {
        ...r,
        fecha_hora_str: d
          ? `${d.toLocaleDateString("es-DO")} ${d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true })}`
          : "--",
        importe: Number(r.importe) || 0,
      };
    });

    const exportTotals = {
      importe: json.kpis.totalCobrosEfectivos,
    };

    // Build Secondary Sheet: Resumen por Método
    const additionalSheets: AdditionalSheet[] = [
      {
        sheetName: "Resumen por Método",
        columns: [
          { header: "Método de Pago", key: "metodo_pago", width: 35 },
          { header: "Transacciones", key: "cantidad", isInteger: true, width: 22, align: "center" },
          { header: "Total Recaudado", key: "total_monto", isCurrency: true, width: 28, align: "right" },
        ],
        rows: json.methodSummary || [],
        totals: {
          cantidad: json.kpis.cantidadTransacciones,
          total_monto: json.kpis.totalCobrosEfectivos,
        },
      },
    ];

    return {
      title: "Reporte de Cuadre de Caja Diario",
      subtitle: `Conciliación de cobros registrados en la jornada del ${fechaDesde} al ${fechaHasta}`,
      companyName: initialCompany || "Ride Lab",
      filename: `cuadre_caja_${fechaDesde}_${fechaHasta}`,
      filters: activeFilters,
      kpis: exportKpis,
      columns: exportColumns,
      rows: exportRows,
      totals: exportTotals,
      additionalSheets,
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
        title="Cuadre de Caja Diario"
        subtitle="Conciliación y arqueo de cobros registrados durante la jornada operativa"
        canExport={canExport}
        onRefresh={fetchData}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        isExportingExcel={isExportingExcel}
        isExportingPdf={isExportingPdf}
        isLoading={loading}
        totalRecords={totalRecords}
      />

      {/* 2. Tarjetas KPI y Conciliación por Método de Pago en la misma línea */}
      <ReportKpiGrid cols={5}>
        <ReportKpiCard
          label="Total Cobros Efectivos"
          value={formatCurrency(kpis.totalCobrosEfectivos)}
          sublabel="Cobros Recibidos"
          icon={<Receipt className="w-4 h-4 text-primary" />}
          variant="primary"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Cobros en Efectivo"
          value={formatCurrency(kpis.totalEfectivo)}
          sublabel="Recaudación en caja física"
          icon={<Banknote className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Cobros por Transferencia"
          value={formatCurrency(kpis.totalTransferencia)}
          sublabel="Depósitos y transferencias banco"
          icon={<ArrowRightLeft className="w-4 h-4 text-blue-500" />}
          variant="blue"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Tarjetas y Otros"
          value={formatCurrency(kpis.totalTarjeta + kpis.totalOtros)}
          sublabel="Transacciones POS y otros canales"
          icon={<CreditCard className="w-4 h-4 text-amber-500" />}
          variant="amber"
          isLoading={loading}
        />

        {/* Tarjeta 5: Conciliación por Método de Pago (en la misma línea que las tarjetas) */}
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 py-2.5 px-3 md:px-3.5 flex flex-col justify-between font-mono shadow-sm transition-all hover:shadow-md h-full min-h-[76px]">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

          <div className="flex items-center justify-between gap-1.5 mb-1 pl-1">
            <span className="text-[10px] font-bold text-foreground-muted tracking-wider uppercase truncate" title="Conciliación por Método de Pago">
              Conciliación Método
            </span>
            <div className="p-1 rounded-md bg-surface-subtle/80 border border-border/50 shrink-0">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>

          <div className="pl-1 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="h-5 w-24 bg-surface-subtle animate-pulse rounded my-0.5" />
            ) : methodSummary.length === 0 ? (
              <span className="text-[11px] text-foreground-muted">Sin cobros en la jornada</span>
            ) : (
              <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5 custom-scrollbar">
                {methodSummary.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-1.5 text-[11px] leading-tight">
                    <span className="font-semibold text-foreground truncate" title={m.metodo_pago}>
                      {m.metodo_pago}
                      <span className="text-[10px] text-foreground-muted ml-1">({m.cantidad})</span>
                    </span>
                    <span className="font-bold text-emerald-500 shrink-0 text-xs">
                      {formatCurrency(m.total_monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ReportKpiGrid>

      {/* 3. Panel de Filtros */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros de Cuadre</span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[10px] text-foreground-muted mr-1">RÁPIDOS:</span>
            <button
              type="button"
              onClick={() => applyDatePreset("TODAY")}
              className="px-2 py-0.5 rounded-lg border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("YESTERDAY")}
              className="px-2 py-0.5 rounded-lg border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("THIS_WEEK")}
              className="px-2 py-0.5 rounded-lg border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("THIS_MONTH")}
              className="px-2 py-0.5 rounded-lg border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:border-primary/40 text-[10px] transition-all cursor-pointer"
            >
              Este Mes
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Search box */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Búsqueda
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Factura, cliente, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-subtle border border-border text-foreground rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
              />
            </div>
          </div>

          {/* Fecha Desde */}
          <div className="space-y-1">
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
          <div className="space-y-1">
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

          {/* Método de Pago */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Método de Pago
            </label>
            <select
              value={tipoPagoId}
              onChange={(e) => {
                setTipoPagoId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="">Todos los métodos</option>
              {filterOptions.paymentMethods.map((tp) => (
                <option key={tp.tipo_pago_id} value={tp.tipo_pago_id}>
                  {tp.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Responsable con Búsqueda */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Cajero / Responsable
            </label>
            <SearchableSelect
              value={usuarioId}
              onChange={(val) => {
                setUsuarioId(val);
                setPage(1);
              }}
              allOption={{ value: "", label: "Todos los responsables" }}
              options={filterOptions.users.map((u) => ({
                value: String(u.usuario_id),
                label: u.nombre,
              }))}
              placeholder="Todos los responsables"
              searchPlaceholder="Buscar cajero / responsable..."
            />
          </div>
        </div>

        {/* Buttons Bar */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
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
          <div className="p-2.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
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
              <tr className="border-b border-border bg-surface-subtle text-foreground-muted font-bold uppercase tracking-wider">
                <th
                  onClick={() => handleSort("fecha_pago")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha y Hora</span>
                    {sortBy === "fecha_pago" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("numero_factura")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center gap-1">
                    <span>N° Operación / Factura</span>
                    {sortBy === "numero_factura" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("cliente_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Cliente</span>
                    {sortBy === "cliente_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("metodo_pago")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Método de Pago</span>
                    {sortBy === "metodo_pago" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("responsable_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Responsable</span>
                    {sortBy === "responsable_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("importe")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none text-[11px]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Importe</span>
                    {sortBy === "importe" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 text-center text-[11px]">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-3.5 w-24 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-28 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-32 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-24 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-14 bg-surface-subtle rounded mx-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-foreground-muted">
                    <Receipt className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p className="font-semibold text-xs">No se registraron movimientos en la jornada seleccionada</p>
                    <p className="text-[11px] text-foreground-muted mt-0.5">Pruebe ajustando el rango de fechas o seleccionando otro método de pago.</p>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const d = row.fecha_pago ? new Date(row.fecha_pago) : null;
                  const isApplied = row.estado_pago === "APLICADO";

                  return (
                    <tr
                      key={row.pago_id}
                      className="hover:bg-surface-subtle/70 transition-colors group"
                    >
                      <td className="px-3 py-1.5 md:py-2 text-foreground-secondary whitespace-nowrap">
                        {d ? (
                          <span>
                            <span className="font-medium text-foreground">
                              {d.toLocaleDateString("es-DO")}
                            </span>{" "}
                            <span className="text-[10px] text-foreground-muted">
                              {d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className="px-3 py-1.5 md:py-2 font-mono font-bold text-foreground whitespace-nowrap">
                        {row.numero_factura}
                        {row.numero_transaccion && (
                          <div className="text-[10px] font-normal text-foreground-muted">
                            Ref: {row.numero_transaccion}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 md:py-2">
                        <div className="font-semibold text-foreground">
                          {row.cliente_nombre}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 md:py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-subtle border border-border text-foreground">
                          {row.metodo_pago}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 md:py-2 text-foreground-secondary whitespace-nowrap">
                        {row.responsable_nombre}
                      </td>
                      <td className="px-3 py-1.5 md:py-2 text-right font-bold text-foreground whitespace-nowrap">
                        <span className={isApplied ? "text-emerald-500 font-bold" : "text-foreground-muted line-through"}>
                          {formatCurrency(row.importe)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 md:py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isApplied
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                          }`}
                        >
                          {row.estado_pago}
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
                  <td colSpan={5} className="px-3 py-2 uppercase tracking-wider text-[11px]">
                    TOTAL COBROS VÁLIDOS ({totalRecords} {totalRecords === 1 ? "operación" : "operaciones"})
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-emerald-500 whitespace-nowrap">
                    {formatCurrency(kpis.totalCobrosEfectivos)}
                  </td>
                  <td className="px-3 py-2" />
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
