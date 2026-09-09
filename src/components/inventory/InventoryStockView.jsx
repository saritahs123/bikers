"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  RefreshCw,
  Filter,
  Warehouse,
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Package,
  X
} from "lucide-react";

export default function InventoryStockView({ initialFilter = "TODOS" } = {}) {
  const searchParams = useSearchParams();
  const urlFilter = searchParams?.get("filter") || searchParams?.get("estado_stock") || initialFilter;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination state
  const [search, setSearch] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [estadoStock, setEstadoStock] = useState(urlFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("producto_nombre");
  const [sortDirection, setSortDirection] = useState("asc");

  // Meta
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1
  });
  const [lookups, setLookups] = useState({
    almacenes: []
  });

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (almacenId) params.set("almacen_id", almacenId);
      if (estadoStock && estadoStock !== "TODOS") params.set("estado_stock", estadoStock);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("sort_by", sortBy);
      params.set("sort_direction", sortDirection);

      const res = await fetch(`/api/inventario/existencias?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("No tienes permisos para consultar existencias.");
        }
        if (res.status === 401) {
          throw new Error("Sesión no válida o expirada.");
        }
        throw new Error("Error al consultar existencias de inventario.");
      }

      const result = await res.json();
      if (result.success) {
        setData(result.items || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
        if (result.lookups) {
          setLookups(result.lookups);
        }
      } else {
        throw new Error(result.message || "Error al procesar la solicitud.");
      }
    } catch (err) {
      console.error("Error en fetchStock:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [search, almacenId, estadoStock, page, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setAlmacenId("");
    setEstadoStock("TODOS");
    setPage(1);
    setSortBy("producto_nombre");
    setSortDirection("asc");
  };

  const formatMoney = (val) => {
    const num = Number(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatNumber = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-foreground-muted/40 ml-1 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary ml-1 inline" />
    );
  };

  // Aggregates for current page view
  const totalCantidadVisible = data.reduce((acc, row) => acc + Number(row.cantidad_actual || 0), 0);
  const totalValorVisible = data.reduce((acc, row) => acc + Number(row.valor_inventario || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1">
            <span>Módulo de Inventario</span>
            <span>/</span>
            <span className="text-primary">Existencias</span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            <span>Existencias de Inventario</span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Consulta de stock físico, reservado, disponible y valoraciones por almacén.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(search || almacenId || estadoStock !== "TODOS") && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-subtle hover:bg-surface-elevated text-foreground-muted hover:text-foreground text-xs font-medium rounded-md border border-border transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          )}
          <button
            onClick={fetchStock}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-subtle hover:bg-surface-elevated text-foreground border border-border rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Refrescar existencias"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Main Filter Toolbar */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por código, producto o marca..."
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Warehouse Selector */}
          <div className="relative">
            <Warehouse className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <select
              value={almacenId}
              onChange={(e) => {
                setAlmacenId(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">Todos los almacenes</option>
              {lookups.almacenes?.map((a) => (
                <option key={a.almacen_id} value={a.almacen_id}>
                  {a.codigo} - {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Selector */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <select
              value={estadoStock}
              onChange={(e) => {
                setEstadoStock(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos los estados de stock</option>
              <option value="CON_STOCK">Con Existencia (&gt; 0)</option>
              <option value="BAJO_MINIMO">Bajo Stock Mínimo</option>
              <option value="SIN_STOCK">Sin Stock (Agotado = 0)</option>
            </select>
          </div>

          {/* Records summary indicator */}
          <div className="flex items-center justify-end gap-3 text-xs text-foreground-muted px-1">
            <span className="font-semibold text-foreground font-mono">
              {pagination.total} {pagination.total === 1 ? "artículo" : "artículos"}
            </span>
            <span>•</span>
            <span>Página {pagination.page} de {pagination.total_pages || 1}</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-sm">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-6 w-48 bg-surface-subtle rounded" />
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-subtle rounded" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-12 text-center max-w-md mx-auto space-y-3">
            <div className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
              <X className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-foreground">Error al cargar existencias</p>
            <p className="text-xs text-foreground-muted">{error}</p>
            <button
              onClick={fetchStock}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Package className="w-12 h-12 text-foreground-muted/40 mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No se encontraron existencias</h3>
            <p className="text-xs text-foreground-muted max-w-sm mx-auto">
              No hay registros que coincidan con los filtros de búsqueda y almacén seleccionados.
            </p>
            {(search || almacenId || estadoStock !== "TODOS") && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface border-b border-border text-foreground-muted font-semibold select-none">
                  <th
                    onClick={() => handleSort("codigo_producto")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Código {getSortIcon("codigo_producto")}
                  </th>
                  <th
                    onClick={() => handleSort("producto_nombre")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Producto {getSortIcon("producto_nombre")}
                  </th>
                  <th
                    onClick={() => handleSort("marca")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                  >
                    Marca {getSortIcon("marca")}
                  </th>
                  <th
                    onClick={() => handleSort("almacen_nombre")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Almacén {getSortIcon("almacen_nombre")}
                  </th>
                  <th
                    onClick={() => handleSort("cantidad_actual")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                  >
                    Físico {getSortIcon("cantidad_actual")}
                  </th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell text-foreground-muted">
                    Reservado
                  </th>
                  <th
                    onClick={() => handleSort("stock_disponible")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors font-bold"
                  >
                    Disponible {getSortIcon("stock_disponible")}
                  </th>
                  <th className="py-3 px-4 text-right hidden xl:table-cell text-foreground-muted">
                    Mínimo
                  </th>
                  <th
                    onClick={() => handleSort("costo_promedio")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                  >
                    Costo PMP {getSortIcon("costo_promedio")}
                  </th>
                  <th
                    onClick={() => handleSort("valor_inventario")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors font-semibold"
                  >
                    Valoración {getSortIcon("valor_inventario")}
                  </th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item) => (
                  <tr
                    key={item.existencia_producto_id}
                    className="hover:bg-surface-subtle/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                      {item.codigo_producto}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-foreground">{item.producto_nombre}</p>
                        <p className="text-[10px] text-foreground-muted">
                          {item.categoria} • {item.unidad_medida}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground-muted hidden md:table-cell whitespace-nowrap">
                      {item.marca}
                    </td>
                    <td className="py-3 px-4 text-foreground whitespace-nowrap">
                      <span className="font-medium">{item.almacen_nombre}</span>
                      <span className="text-[10px] text-foreground-muted block font-mono">
                        {item.almacen_codigo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                      {formatNumber(item.cantidad_actual)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-foreground-muted hidden lg:table-cell">
                      {formatNumber(item.cantidad_reservada)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          item.stock_disponible <= 0
                            ? "text-error"
                            : item.stock_disponible <= item.stock_minimo
                            ? "text-warning"
                            : "text-foreground"
                        }
                      >
                        {formatNumber(item.stock_disponible)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-foreground-muted hidden xl:table-cell">
                      {formatNumber(item.stock_minimo)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-foreground-muted hidden sm:table-cell">
                      {formatMoney(item.costo_promedio)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      {formatMoney(item.valor_inventario)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                          item.estado_stock === "SIN_STOCK"
                            ? "bg-error/10 text-error border-error/30"
                            : item.estado_stock === "BAJO_MINIMO"
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "bg-success/10 text-success border-success/30"
                        }`}
                      >
                        {item.estado_stock === "SIN_STOCK"
                          ? "SIN STOCK"
                          : item.estado_stock === "BAJO_MINIMO"
                          ? "BAJO MÍNIMO"
                          : "NORMAL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Subtotals & Pagination */}
        {!loading && data.length > 0 && (
          <div className="p-3 border-t border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            {/* Page Totals */}
            <div className="flex items-center gap-4 text-foreground-muted">
              <span>
                Total visible: <strong className="text-foreground font-mono">{formatNumber(totalCantidadVisible)}</strong> uds.
              </span>
              <span>•</span>
              <span>
                Valuación página: <strong className="text-primary font-mono">{formatMoney(totalValorVisible)}</strong>
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-foreground-muted">
                <span>Mostrar:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded bg-surface-subtle border border-border text-foreground hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-foreground font-medium">
                  {page} / {pagination.total_pages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages || 1, p + 1))}
                  disabled={page >= (pagination.total_pages || 1)}
                  className="p-1 rounded bg-surface-subtle border border-border text-foreground hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
