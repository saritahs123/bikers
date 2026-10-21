"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
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
  ReportTableColumn 
} from "@/lib/reports/reportExportService";

export interface CustomerActivityRow {
  cliente_id: number;
  cliente_nombre: string;
  telefono_principal: string | null;
  identificacion?: string | null;
  cliente_activo: boolean;
  fecha_ultimo_servicio: string | null;
  dias_transcurridos: number | null;
  categoria_antiguedad: string;
  categoria_etiqueta: string;
  total_ordenes: number;
  monto_historico: number;
  [key: string]: unknown;
}

interface CustomerActivityReportViewProps {
  initialCompany?: string;
}

export function CustomerActivityReportView({ initialCompany }: CustomerActivityReportViewProps) {
  // Data state
  const [data, setData] = useState<CustomerActivityRow[]>([]);
  const [kpis, setKpis] = useState({
    totalClientes: 0,
    clientesRecientes: 0,
    clientesSinServiciosRecientes: 0,
    promedioDias: 0,
    montoTotalHistorico: 0,
    distribucion: {
      cat0_30: 0,
      cat31_60: 0,
      cat61_90: 0,
      catMas90: 0,
      sinServicios: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<{
    clients: { cliente_id: number; nombre: string; identificacion?: string; telefono?: string }[];
  }>({ clients: [] });

  // Filter form state
  const [search, setSearch] = useState("");
  const [fechaCorte, setFechaCorte] = useState(() => getTodaySantoDomingo());
  const [categoria, setCategoria] = useState("TODOS");
  const [antiguedadMin, setAntiguedadMin] = useState("");
  const [antiguedadMax, setAntiguedadMax] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [estadoCliente, setEstadoCliente] = useState("TODOS");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState("fecha_ultimo_servicio");
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
          setFilterOptions({ clients: json.clients || [] });
        }
      } catch (err: unknown) {
        console.error("Error loading filter options:", err);
      }
    }
    loadOptions();
  }, []);

  // Build query string
  const buildQueryParams = useCallback(
    (exportAll = false) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (fechaCorte) params.set("fecha_corte", fechaCorte);
      if (categoria !== "TODOS") params.set("categoria", categoria);
      if (antiguedadMin) params.set("antiguedad_min", antiguedadMin);
      if (antiguedadMax) params.set("antiguedad_max", antiguedadMax);
      if (clienteId) params.set("cliente_id", clienteId);
      if (estadoCliente !== "TODOS") params.set("estado_cliente", estadoCliente);

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
    [search, fechaCorte, categoria, antiguedadMin, antiguedadMax, clienteId, estadoCliente, sortBy, sortDirection, page, pageSize]
  );

  // Fetch report data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryParams(false);
      const res = await fetch(`/api/reports/customer-activity?${qs}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Error al consultar la actividad de clientes.");
      }

      const json = await res.json();
      setData(json.data || []);
      setKpis(json.kpis || {
        totalClientes: 0,
        clientesRecientes: 0,
        clientesSinServiciosRecientes: 0,
        promedioDias: 0,
        montoTotalHistorico: 0,
        distribucion: { cat0_30: 0, cat31_60: 0, cat61_90: 0, catMas90: 0, sinServicios: 0 },
      });
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch (err: unknown) {
      console.error("Error in fetchData customer activity:", err);
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
      setSortDirection(columnKey === "cliente_nombre" ? "asc" : "desc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setFechaCorte(getTodaySantoDomingo());
    setCategoria("TODOS");
    setAntiguedadMin("");
    setAntiguedadMax("");
    setClienteId("");
    setEstadoCliente("TODOS");
    setPage(1);
  };

  // Prepare Export Meta
  const getExportMeta = async () => {
    const qs = buildQueryParams(true);
    const res = await fetch(`/api/reports/customer-activity?${qs}`);
    if (!res.ok) throw new Error("Error al obtener datos completos para exportación.");
    const json = await res.json();

    const activeFilters: ReportFilter[] = [{ label: "Fecha de Corte", value: fechaCorte }];
    if (categoria !== "TODOS") {
      const catLabels: Record<string, string> = {
        "0_30": "0–30 días",
        "31_60": "31–60 días",
        "61_90": "61–90 días",
        MAS_90: "Más de 90 días",
        SIN_SERVICIOS: "Sin servicios registrados",
      };
      activeFilters.push({ label: "Categoría", value: catLabels[categoria] || categoria });
    }
    if (clienteId) {
      const cli = filterOptions.clients.find((c) => String(c.cliente_id) === String(clienteId));
      activeFilters.push({ label: "Cliente", value: cli?.nombre || clienteId });
    }
    if (antiguedadMin || antiguedadMax) {
      activeFilters.push({
        label: "Días Antigüedad",
        value: `${antiguedadMin || "0"} - ${antiguedadMax || "Sin límite"} días`,
      });
    }
    if (estadoCliente !== "TODOS") {
      activeFilters.push({ label: "Estado Cliente", value: estadoCliente });
    }
    if (search) {
      activeFilters.push({ label: "Búsqueda", value: search });
    }

    const exportKpis: ReportKpi[] = [
      { label: "Clientes Recientes", value: json.kpis.clientesRecientes, sublabel: "Servicio en los últimos 30 días" },
      { label: "Sin Servicio Reciente", value: json.kpis.clientesSinServiciosRecientes, sublabel: ">30 días o sin servicios" },
      { label: "Promedio Días", value: `${json.kpis.promedioDias || 0} días`, sublabel: "Tiempo medio desde último servicio" },
      { label: "Total Clientes", value: json.kpis.totalClientes, sublabel: "Base de clientes evaluada" },
    ];

    const exportColumns: ReportTableColumn[] = [
      { header: "Cliente", key: "cliente_nombre", width: 45 },
      { header: "Teléfono", key: "telefono_str", width: 28 },
      { header: "Último Servicio", key: "fecha_servicio_str", width: 30, align: "center" },
      { header: "Días Transc.", key: "dias_str", width: 22, align: "center" },
      { header: "Categoría Antigüedad", key: "categoria_etiqueta", width: 35 },
      { header: "Cant. Órdenes", key: "total_ordenes", isInteger: true, width: 24, align: "center" },
      { header: "Monto Histórico", key: "monto_historico", isCurrency: true, width: 30, align: "right" },
    ];

    const exportRows: Record<string, unknown>[] = (json.data || []).map((r: CustomerActivityRow) => ({
      ...r,
      telefono_str: r.telefono_principal || "No registrado",
      fecha_servicio_str: r.fecha_ultimo_servicio
        ? new Date(r.fecha_ultimo_servicio).toLocaleDateString("es-DO")
        : "Sin servicios registrados",
      dias_str: r.dias_transcurridos !== null && r.dias_transcurridos !== undefined ? `${r.dias_transcurridos} d` : "--",
    }));

    const exportTotals = {
      total_ordenes: (json.data || []).reduce((acc: number, cur: CustomerActivityRow) => acc + (Number(cur.total_ordenes) || 0), 0),
      monto_historico: json.kpis.montoTotalHistorico,
    };

    return {
      title: "Reporte de Clientes por Antigüedad de Servicios",
      subtitle: `Análisis de retención y recurrencia de clientes al corte del ${fechaCorte}`,
      companyName: initialCompany || "Ride Lab",
      filename: `reporte_actividad_clientes_${fechaCorte}`,
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
        title="Antigüedad de Servicios por Cliente"
        subtitle="Identificación y categorización de clientes según el tiempo transcurrido desde su último servicio"
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
          label="Servicio Reciente"
          value={kpis.clientesRecientes}
          sublabel="Último servicio en 0–30 días"
          icon={<UserCheck className="w-5 h-5 text-emerald-500" />}
          variant="emerald"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Sin Servicio Reciente"
          value={kpis.clientesSinServiciosRecientes}
          sublabel="Más de 30 días o sin servicios"
          icon={<UserX className="w-5 h-5 text-amber-500" />}
          variant="amber"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Promedio Antigüedad"
          value={`${kpis.promedioDias || 0} días`}
          sublabel="Días medios desde última visita"
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          variant="blue"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Total de Clientes"
          value={kpis.totalClientes}
          sublabel="Base analizada a la fecha de corte"
          icon={<Users className="w-5 h-5 text-primary" />}
          variant="primary"
          isLoading={loading}
        />
      </ReportKpiGrid>

      {/* 3. Panel de Filtros */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros de Segmentación</span>
          </div>

          {/* Quick Category Badges */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[10px] text-foreground-muted mr-1">CATEGORÍAS:</span>
            <button
              type="button"
              onClick={() => {
                setCategoria("0_30");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer ${
                categoria === "0_30"
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500 font-bold"
                  : "border-border bg-surface-subtle text-foreground-secondary hover:text-foreground"
              }`}
            >
              0–30 d ({kpis.distribucion?.cat0_30 || 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoria("31_60");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer ${
                categoria === "31_60"
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-500 font-bold"
                  : "border-border bg-surface-subtle text-foreground-secondary hover:text-foreground"
              }`}
            >
              31–60 d ({kpis.distribucion?.cat31_60 || 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoria("61_90");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer ${
                categoria === "61_90"
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-500 font-bold"
                  : "border-border bg-surface-subtle text-foreground-secondary hover:text-foreground"
              }`}
            >
              61–90 d ({kpis.distribucion?.cat61_90 || 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoria("MAS_90");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer ${
                categoria === "MAS_90"
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-500 font-bold"
                  : "border-border bg-surface-subtle text-foreground-secondary hover:text-foreground"
              }`}
            >
              +90 d ({kpis.distribucion?.catMas90 || 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoria("SIN_SERVICIOS");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer ${
                categoria === "SIN_SERVICIOS"
                  ? "bg-foreground-muted/20 border-foreground-muted/50 text-foreground font-bold"
                  : "border-border bg-surface-subtle text-foreground-secondary hover:text-foreground"
              }`}
            >
              Sin Serv. ({kpis.distribucion?.sinServicios || 0})
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
          {/* Search box */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Búsqueda de cliente
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Nombre, cédula, teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-subtle border border-border text-foreground rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
              />
            </div>
          </div>

          {/* Fecha Corte */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Fecha de Corte
            </label>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => {
                setFechaCorte(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Categoría Dropdown */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Categoría de Antigüedad
            </label>
            <select
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="TODOS">Todas las categorías</option>
              <option value="0_30">0–30 días (Servicio Reciente)</option>
              <option value="31_60">31–60 días (Actividad Moderada)</option>
              <option value="61_90">61–90 días (En Riesgo de Inactividad)</option>
              <option value="MAS_90">Más de 90 días (Inactivo)</option>
              <option value="SIN_SERVICIOS">Sin servicios registrados</option>
            </select>
          </div>

          {/* Cliente selector con Búsqueda */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Cliente específico
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

          {/* Antigüedad Mínima */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Días Mínimos
            </label>
            <input
              type="number"
              placeholder="0"
              value={antiguedadMin}
              onChange={(e) => {
                setAntiguedadMin(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Antigüedad Máxima */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Días Máximos
            </label>
            <input
              type="number"
              placeholder="90"
              value={antiguedadMax}
              onChange={(e) => {
                setAntiguedadMax(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
            />
          </div>

          {/* Estado Cliente */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Estado del Cliente
            </label>
            <select
              value={estadoCliente}
              onChange={(e) => {
                setEstadoCliente(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="TODOS">Todos (Activos e Inactivos)</option>
              <option value="ACTIVO">Solo Clientes Activos</option>
              <option value="INACTIVO">Solo Clientes Inactivos</option>
            </select>
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
                <th className="px-3 py-2">Teléfono</th>
                <th
                  onClick={() => handleSort("fecha_ultimo_servicio")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Último Servicio</span>
                    {sortBy === "fecha_ultimo_servicio" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("dias_transcurridos")}
                  className="px-3 py-2 text-center cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Días Transcurridos</span>
                    {sortBy === "dias_transcurridos" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 text-center">Categoría Antigüedad</th>
                <th
                  onClick={() => handleSort("total_ordenes")}
                  className="px-3 py-2 text-center cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Cant. Órdenes</span>
                    {sortBy === "total_ordenes" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("monto_historico")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Monto Histórico</span>
                    {sortBy === "monto_historico" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-3.5 w-32 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-12 bg-surface-subtle rounded mx-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded mx-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-12 bg-surface-subtle rounded mx-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-foreground-muted">
                    <Users className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p className="font-semibold text-xs">No se encontraron clientes con los filtros aplicados</p>
                    <p className="text-[11px] text-foreground-muted mt-0.5">Pruebe ajustando la categoría o los días de antigüedad.</p>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const cat = row.categoria_antiguedad;
                  const catBadges: Record<string, { label: string; style: string }> = {
                    "0_30": { label: "0–30 días", style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold" },
                    "31_60": { label: "31–60 días", style: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
                    "61_90": { label: "61–90 días", style: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
                    MAS_90: { label: "+90 días", style: "bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold" },
                    SIN_SERVICIOS: { label: "Sin servicios", style: "bg-surface-subtle text-foreground-muted border-border italic" },
                  };
                  const badge = catBadges[cat] || { label: cat, style: "bg-surface-subtle border-border" };

                  return (
                    <tr
                      key={row.cliente_id}
                      className="hover:bg-surface-subtle/70 transition-colors group"
                    >
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">
                          {row.cliente_nombre}
                        </div>
                        {row.identificacion && (
                          <div className="text-[10px] text-foreground-muted">
                            ID: {row.identificacion}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground-secondary whitespace-nowrap">
                        {row.telefono_principal || <span className="text-foreground-muted italic">--</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.fecha_ultimo_servicio ? (
                          <span className="text-foreground">
                            {new Date(row.fecha_ultimo_servicio).toLocaleDateString("es-DO")}
                          </span>
                        ) : (
                          <span className="text-foreground-muted italic">Sin servicios registrados</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {row.dias_transcurridos !== null && row.dias_transcurridos !== undefined ? (
                          <span className="font-bold text-foreground">
                            {row.dias_transcurridos}{" "}
                            <span className="text-[10px] font-normal text-foreground-muted">días</span>
                          </span>
                        ) : (
                          <span className="text-foreground-muted">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-foreground whitespace-nowrap">
                        {row.total_ordenes}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                        {formatCurrency(row.monto_historico)}
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
                    TOTAL GENERAL ({totalRecords} {totalRecords === 1 ? "cliente" : "clientes"})
                  </td>
                  <td className="px-3 py-2 text-center text-xs whitespace-nowrap font-bold">
                    {data.reduce((acc, cur) => acc + (Number(cur.total_ordenes) || 0), 0)} ord.
                  </td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap font-bold text-emerald-500">
                    {formatCurrency(kpis.montoTotalHistorico)}
                  </td>
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
