"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Boxes, 
  Package, 
  DollarSign, 
  Truck, 
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
  ReportFilter, 
  ReportKpi, 
  ReportTableColumn,
  AdditionalSheet 
} from "@/lib/reports/reportExportService";

export interface InventorySupplierRow {
  producto_id: number;
  codigo_producto: string;
  producto_nombre: string;
  categoria_nombre: string;
  proveedor_id: number;
  suplidor_nombre: string;
  existencia_actual: number;
  costo_unitario: number;
  valor_total: number;
  subtotal_suplidor_unidades?: number;
  subtotal_suplidor_valor?: number;
  [key: string]: unknown;
}

export interface SupplierSummaryRow {
  proveedor_id: number;
  suplidor_nombre: string;
  cantidad_productos: number;
  total_unidades: number;
  subtotal_valor: number;
  [key: string]: unknown;
}

interface InventorySupplierReportViewProps {
  initialCompany?: string;
  canExport?: boolean;
}

export function InventorySupplierReportView({ initialCompany, canExport }: InventorySupplierReportViewProps) {
  // Data state
  const [data, setData] = useState<InventorySupplierRow[]>([]);
  const [supplierSummary, setSupplierSummary] = useState<SupplierSummaryRow[]>([]);
  const [kpis, setKpis] = useState({
    totalUnidades: 0,
    totalProductos: 0,
    valorTotalInventario: 0,
    totalSuplidores: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<{
    suppliers: { proveedor_id: number; nombre: string }[];
    categories: { categoria_producto_id: number; nombre: string }[];
  }>({ suppliers: [], categories: [] });

  // Filter form state
  const [search, setSearch] = useState("");
  const [proveedorId, setProveedorId] = useState("TODOS");
  const [categoriaId, setCategoriaId] = useState("");
  const [estadoProducto, setEstadoProducto] = useState("TODOS");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState("suplidor_nombre");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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
            suppliers: json.suppliers || [],
            categories: json.categories || [],
          });
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
      if (proveedorId !== "TODOS") params.set("proveedor_id", proveedorId);
      if (categoriaId) params.set("categoria_id", categoriaId);
      if (estadoProducto !== "TODOS") params.set("estado_producto", estadoProducto);

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
    [search, proveedorId, categoriaId, estadoProducto, sortBy, sortDirection, page, pageSize]
  );

  // Fetch report data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildQueryParams(false);
      const res = await fetch(`/api/reports/inventory-supplier?${qs}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Error al consultar inventario por suplidor.");
      }

      const json = await res.json();
      setData(json.data || []);
      setSupplierSummary(json.supplierSummary || []);
      setKpis(json.kpis || { totalUnidades: 0, totalProductos: 0, valorTotalInventario: 0, totalSuplidores: 0 });
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch (err: unknown) {
      console.error("Error in fetchData inventory-supplier:", err);
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
      setSortDirection(columnKey === "existencia_actual" || columnKey === "valor_total" ? "desc" : "asc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setProveedorId("TODOS");
    setCategoriaId("");
    setEstadoProducto("TODOS");
    setPage(1);
  };

  // Prepare Export Meta
  const getExportMeta = async () => {
    const qs = buildQueryParams(true);
    const res = await fetch(`/api/reports/inventory-supplier?${qs}`);
    if (!res.ok) throw new Error("Error al obtener datos completos para exportación.");
    const json = await res.json();

    const activeFilters: ReportFilter[] = [];
    if (proveedorId !== "TODOS") {
      if (proveedorId === "0") {
        activeFilters.push({ label: "Suplidor", value: "Sin suplidor asignado" });
      } else {
        const prov = filterOptions.suppliers.find((s) => String(s.proveedor_id) === String(proveedorId));
        activeFilters.push({ label: "Suplidor", value: prov?.nombre || proveedorId });
      }
    }
    if (categoriaId) {
      const cat = filterOptions.categories.find((c) => String(c.categoria_producto_id) === String(categoriaId));
      activeFilters.push({ label: "Categoría", value: cat?.nombre || categoriaId });
    }
    if (estadoProducto !== "TODOS") {
      activeFilters.push({ label: "Estado Producto", value: estadoProducto });
    }
    if (search) {
      activeFilters.push({ label: "Búsqueda", value: search });
    }

    const exportKpis: ReportKpi[] = [
      { label: "Total Unidades", value: json.kpis.totalUnidades.toLocaleString("es-DO"), sublabel: "Existencia física consolidada" },
      { label: "Total Productos", value: json.kpis.totalProductos, sublabel: "Referencias distintas" },
      { label: "Valor Inventario", value: formatCurrency(json.kpis.valorTotalInventario), sublabel: "Valoración a costo real" },
      { label: "Total Suplidores", value: json.kpis.totalSuplidores, sublabel: "Suplidores con existencias" },
    ];

    const exportColumns: ReportTableColumn[] = [
      { header: "Suplidor", key: "suplidor_nombre", width: 36 },
      { header: "Código", key: "codigo_producto", width: 22 },
      { header: "Producto", key: "producto_nombre", width: 45 },
      { header: "Categoría", key: "categoria_nombre", width: 28 },
      { header: "Existencia", key: "existencia_actual", isInteger: true, width: 20, align: "right" },
      { header: "Costo Unitario", key: "costo_unitario", isCurrency: true, width: 26, align: "right" },
      { header: "Valor Total", key: "valor_total", isCurrency: true, width: 28, align: "right" },
    ];

    const exportRows: Record<string, unknown>[] = (json.data || []).map((r: InventorySupplierRow) => ({
      ...r,
      existencia_actual: Number(r.existencia_actual) || 0,
      costo_unitario: Number(r.costo_unitario) || 0,
      valor_total: Number(r.valor_total) || 0,
    }));

    const exportTotals = {
      existencia_actual: json.kpis.totalUnidades,
      valor_total: json.kpis.valorTotalInventario,
    };

    // Build Secondary Sheet: Resumen por Suplidor
    const additionalSheets: AdditionalSheet[] = [
      {
        sheetName: "Resumen por Suplidor",
        columns: [
          { header: "Suplidor", key: "suplidor_nombre", width: 40 },
          { header: "Cant. Productos", key: "cantidad_productos", isInteger: true, width: 24, align: "center" },
          { header: "Total Unidades", key: "total_unidades", isInteger: true, width: 24, align: "right" },
          { header: "Valor Inventario", key: "subtotal_valor", isCurrency: true, width: 30, align: "right" },
        ],
        rows: json.supplierSummary || [],
        totals: {
          cantidad_productos: (json.supplierSummary || []).reduce(
            (acc: number, s: { cantidad_productos?: number }) => acc + Number(s.cantidad_productos || 0),
            0
          ),
          total_unidades: (json.supplierSummary || []).reduce(
            (acc: number, s: { total_unidades?: number }) => acc + Number(s.total_unidades || 0),
            0
          ),
          subtotal_valor: (json.supplierSummary || []).reduce(
            (acc: number, s: { subtotal_valor?: number }) => acc + Number(s.subtotal_valor || 0),
            0
          ),
        },
      },
    ];

    return {
      title: "Reporte de Inventario Total por Suplidor",
      subtitle: "Existencias y valoración agrupadas por suplidor comercial",
      companyName: initialCompany || "Ride Lab",
      filename: `reporte_inventario_suplidor_${new Date().toISOString().split("T")[0]}`,
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
        title="Inventario Total por Suplidor"
        subtitle="Existencias y valoración de inventario consolidadas y agrupadas por suplidor"
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
          label="Total Unidades"
          value={kpis.totalUnidades.toLocaleString("es-DO")}
          sublabel="Unidades físicas en existencias"
          icon={<Boxes className="w-5 h-5 text-primary" />}
          variant="primary"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Total Productos"
          value={kpis.totalProductos}
          sublabel="Artículos y referencias únicos"
          icon={<Package className="w-5 h-5 text-blue-500" />}
          variant="blue"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Valor Inventario"
          value={formatCurrency(kpis.valorTotalInventario)}
          sublabel="Valoración total a costo promedio"
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          variant="emerald"
          isLoading={loading}
        />
        <ReportKpiCard
          label="Total Suplidores"
          value={kpis.totalSuplidores}
          sublabel="Suplidores con stock activo"
          icon={<Truck className="w-5 h-5 text-amber-500" />}
          variant="amber"
          isLoading={loading}
        />
      </ReportKpiGrid>

      {/* Resumen Compacto por Suplidor */}
      {supplierSummary.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-3 md:p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary" />
              Subtotales Consolidados por Suplidor
            </span>
            <span className="text-foreground-muted text-[10px] font-normal">
              {supplierSummary.length} grupos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-0.5">
            {supplierSummary.map((s) => {
              const isSelected = proveedorId === String(s.proveedor_id);
              return (
                <button
                  key={s.proveedor_id}
                  type="button"
                  onClick={() => {
                    setProveedorId(isSelected ? "TODOS" : String(s.proveedor_id));
                    setPage(1);
                  }}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-surface-subtle hover:border-primary/40 hover:bg-hover"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-[11px] text-foreground truncate">
                      {s.suplidor_nombre}
                    </span>
                    <span className="text-[9px] text-foreground-muted shrink-0">
                      {s.cantidad_productos} prod.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50">
                    <span className="text-foreground-secondary">
                      {Number(s.total_unidades).toLocaleString("es-DO")} u.
                    </span>
                    <span className="font-bold text-emerald-500">
                      {formatCurrency(s.subtotal_valor)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Panel de Filtros */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider pb-2 border-b border-border/80">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>Filtros de Inventario</span>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {/* Search box */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Búsqueda general
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Código, producto, categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-subtle border border-border text-foreground rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs"
              />
            </div>
          </div>

          {/* Suplidor Dropdown con Búsqueda */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Suplidor
            </label>
            <SearchableSelect
              value={proveedorId}
              onChange={(val) => {
                setProveedorId(val);
                setPage(1);
              }}
              allOption={{ value: "TODOS", label: "Todos los suplidores" }}
              options={[
                { value: "0", label: "Sin suplidor asignado" },
                ...filterOptions.suppliers.map((s) => ({
                  value: String(s.proveedor_id),
                  label: s.nombre,
                })),
              ]}
              placeholder="Todos los suplidores"
              searchPlaceholder="Buscar suplidor..."
            />
          </div>

          {/* Categoría Dropdown con Búsqueda */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Categoría
            </label>
            <SearchableSelect
              value={categoriaId}
              onChange={(val) => {
                setCategoriaId(val);
                setPage(1);
              }}
              allOption={{ value: "", label: "Todas las categorías" }}
              options={filterOptions.categories.map((c) => ({
                value: String(c.categoria_producto_id),
                label: c.nombre,
              }))}
              placeholder="Todas las categorías"
              searchPlaceholder="Buscar categoría..."
            />
          </div>

          {/* Estado Producto */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-semibold text-foreground-secondary uppercase">
              Estado de Producto
            </label>
            <select
              value={estadoProducto}
              onChange={(e) => {
                setEstadoProducto(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-subtle border border-border text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50 text-xs cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
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
                  onClick={() => handleSort("suplidor_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Suplidor</span>
                    {sortBy === "suplidor_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("codigo_producto")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Código</span>
                    {sortBy === "codigo_producto" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("producto_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Producto</span>
                    {sortBy === "producto_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("categoria_nombre")}
                  className="px-3 py-2 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoría</span>
                    {sortBy === "categoria_nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("existencia_actual")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Existencia</span>
                    {sortBy === "existencia_actual" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("costo_unitario")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Costo Unitario</span>
                    {sortBy === "costo_unitario" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("valor_total")}
                  className="px-3 py-2 text-right cursor-pointer hover:text-foreground select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Valor Total</span>
                    {sortBy === "valor_total" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 text-right">Subtotal Suplidor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-2"><div className="h-3.5 w-28 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-36 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-12 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-16 bg-surface-subtle rounded ml-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3.5 w-20 bg-surface-subtle rounded ml-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-foreground-muted">
                    <Package className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p className="font-semibold text-xs">No se encontraron productos con los filtros seleccionados</p>
                    <p className="text-[11px] text-foreground-muted mt-0.5">Pruebe seleccionando otro suplidor o ajustando los términos de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const hasStock = Number(row.existencia_actual) > 0;
                  const isUnassigned = row.proveedor_id === 0 || row.suplidor_nombre === "Sin suplidor asignado";

                  return (
                    <tr
                      key={row.producto_id}
                      className="hover:bg-surface-subtle/70 transition-colors group"
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`font-semibold ${
                            isUnassigned ? "text-foreground-muted italic" : "text-foreground"
                          }`}
                        >
                          {row.suplidor_nombre}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-primary whitespace-nowrap">
                        {row.codigo_producto}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {row.producto_nombre}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-foreground-secondary whitespace-nowrap">
                        {row.categoria_nombre}
                      </td>
                      <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                        <span className={hasStock ? "text-foreground" : "text-foreground-muted"}>
                          {Number(row.existencia_actual).toLocaleString("es-DO")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-foreground-secondary whitespace-nowrap">
                        {formatCurrency(row.costo_unitario)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(row.valor_total)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-500 whitespace-nowrap text-[11px]">
                        {formatCurrency(row.subtotal_suplidor_valor)}
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
                    TOTAL GENERAL ({totalRecords} {totalRecords === 1 ? "producto" : "productos"})
                  </td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap font-bold">
                    {kpis.totalUnidades.toLocaleString("es-DO")} u.
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-xs text-emerald-500 font-bold whitespace-nowrap">
                    {formatCurrency(kpis.valorTotalInventario)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-foreground-muted whitespace-nowrap">
                    {formatCurrency(kpis.valorTotalInventario)}
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
