"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Filter,
  Warehouse,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  X,
  AlertCircle,
  FileText,
  User,
  Hash,
  Clock,
  Layers,
  DollarSign,
  Copy,
  Check
} from "lucide-react";

export default function InventoryMovementsView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [tipoMovimientoId, setTipoMovimientoId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("fecha_movimiento");
  const [sortDirection, setSortDirection] = useState("desc");

  // Meta & Lookups
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1
  });
  const [lookups, setLookups] = useState({
    almacenes: [],
    tipos_movimiento: []
  });

  // Detail Modal state
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [copiedUuid, setCopiedUuid] = useState(false);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (almacenId) params.set("almacen_id", almacenId);
      if (tipoMovimientoId) params.set("tipo_movimiento_id", tipoMovimientoId);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("sort_by", sortBy);
      params.set("sort_direction", sortDirection);

      const res = await fetch(`/api/inventario/movimientos?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("No tienes permisos para consultar movimientos de inventario.");
        }
        if (res.status === 401) {
          throw new Error("Sesión no válida o expirada.");
        }
        throw new Error("Error al consultar movimientos de inventario.");
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
      console.error("Error en fetchMovements:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [search, almacenId, tipoMovimientoId, fechaDesde, fechaHasta, page, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setAlmacenId("");
    setTipoMovimientoId("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    setSortBy("fecha_movimiento");
    setSortDirection("desc");
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("es-DO", {
        timeZone: "America/Santo_Domingo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return String(dateStr);
    }
  };

  const handleCopyUuid = (uuid) => {
    if (!uuid) return;
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1">
            <span>Módulo de Inventario</span>
            <span>/</span>
            <span className="text-primary">Movimientos</span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <span>Movimientos de Inventario</span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Registro histórico inmutable de entradas, salidas, ajustes y transferencias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(search || almacenId || tipoMovimientoId || fechaDesde || fechaHasta) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-subtle hover:bg-surface-elevated text-foreground-muted hover:text-foreground text-xs font-medium rounded-md border border-border transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          )}
          <button
            onClick={fetchMovements}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-subtle hover:bg-surface-elevated text-foreground border border-border rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Refrescar movimientos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Main Filter Toolbar */}
      <div className="bg-surface border border-border rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              placeholder="Buscar por SKU, producto, ref..."
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

          {/* Movement Type Selector */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <select
              value={tipoMovimientoId}
              onChange={(e) => {
                setTipoMovimientoId(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">Todos los tipos</option>
              {lookups.tipos_movimiento?.map((t) => (
                <option key={t.tipo_movimiento_id} value={t.tipo_movimiento_id}>
                  [{t.naturaleza}] {t.codigo} - {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Desde */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(1);
              }}
              title="Fecha Desde"
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            />
          </div>

          {/* Date Range: Hasta */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(1);
              }}
              title="Fecha Hasta"
              className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
            />
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
            <p className="text-sm font-bold text-foreground">Error al cargar movimientos</p>
            <p className="text-xs text-foreground-muted">{error}</p>
            <button
              onClick={fetchMovements}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <ArrowLeftRight className="w-12 h-12 text-foreground-muted/40 mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No se encontraron movimientos</h3>
            <p className="text-xs text-foreground-muted max-w-sm mx-auto">
              No hay registros de transacciones de inventario con los filtros seleccionados.
            </p>
            {(search || almacenId || tipoMovimientoId || fechaDesde || fechaHasta) && (
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
                    onClick={() => handleSort("fecha_movimiento")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Fecha y Hora {getSortIcon("fecha_movimiento")}
                  </th>
                  <th
                    onClick={() => handleSort("tipo_nombre")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Tipo {getSortIcon("tipo_nombre")}
                  </th>
                  <th
                    onClick={() => handleSort("producto_nombre")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Producto {getSortIcon("producto_nombre")}
                  </th>
                  <th
                    onClick={() => handleSort("almacen_nombre")}
                    className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Almacén {getSortIcon("almacen_nombre")}
                  </th>
                  <th
                    onClick={() => handleSort("cantidad")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                  >
                    Cantidad {getSortIcon("cantidad")}
                  </th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell text-foreground-muted">
                    Stock Ant. &rarr; Nuevo
                  </th>
                  <th
                    onClick={() => handleSort("costo_unitario")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                  >
                    Costo Unit. {getSortIcon("costo_unitario")}
                  </th>
                  <th
                    onClick={() => handleSort("costo_total")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors font-semibold"
                  >
                    Costo Total {getSortIcon("costo_total")}
                  </th>
                  <th className="py-3 px-4 hidden xl:table-cell text-foreground-muted">
                    Usuario
                  </th>
                  <th className="py-3 px-4 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item) => {
                  const isEntrada = item.naturaleza === "ENTRADA";
                  const hasTransfer = Boolean(item.transferencia_uuid);
                  return (
                    <tr
                      key={item.movimiento_inventario_id}
                      onClick={() => setSelectedMovement(item)}
                      className="hover:bg-surface-subtle/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-foreground-muted whitespace-nowrap font-medium">
                        {formatDateTime(item.fecha_movimiento)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isEntrada
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-warning/10 text-warning border-warning/30"
                            }`}
                          >
                            {isEntrada ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {item.tipo_codigo}
                          </span>
                          {hasTransfer && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-tight"
                              title={`Transferencia: ${item.transferencia_uuid}`}
                            >
                              TRF
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-foreground">{item.producto_nombre}</p>
                          <p className="text-[10px] text-foreground-muted font-mono">
                            {item.codigo_producto}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground whitespace-nowrap">
                        <span className="font-medium">{item.almacen_nombre}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isEntrada ? "text-success" : "text-warning"}>
                          {isEntrada ? "+" : "-"}
                          {formatNumber(item.cantidad)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground-muted hidden lg:table-cell whitespace-nowrap">
                        <span>{formatNumber(item.stock_anterior)}</span>
                        <span className="mx-1 text-foreground-muted/40">&rarr;</span>
                        <span className="font-semibold text-foreground">{formatNumber(item.stock_nuevo)}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground-muted hidden sm:table-cell">
                        {formatMoney(item.costo_unitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatMoney(item.costo_total)}
                      </td>
                      <td className="py-3 px-4 text-foreground-muted hidden xl:table-cell truncate max-w-[120px]">
                        {item.usuario_nombre}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMovement(item);
                          }}
                          className="p-1 rounded bg-surface-subtle hover:bg-surface-elevated text-foreground-muted hover:text-foreground border border-border transition-colors cursor-pointer"
                          title="Ver detalle del movimiento"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Pagination */}
        {!loading && data.length > 0 && (
          <div className="p-3 border-t border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div className="text-foreground-muted">
              Total movimientos: <strong className="text-foreground font-mono">{pagination.total}</strong>
            </div>

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

      {/* Movement Detail Modal (Read-Only) */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="bg-card border border-border rounded-lg max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-surface border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Detalle de Transacción #{selectedMovement.movimiento_inventario_id}
                  </h3>
                  <p className="text-[11px] text-foreground-muted">
                    {formatDateTime(selectedMovement.fecha_movimiento)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMovement(null)}
                className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Type and Nature Banner */}
              <div className="bg-surface-subtle p-3 rounded-md border border-border flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-foreground-muted uppercase font-semibold">Tipo de Movimiento</p>
                  <p className="font-bold text-foreground text-sm">
                    {selectedMovement.tipo_nombre} ({selectedMovement.tipo_codigo})
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border ${
                    selectedMovement.naturaleza === "ENTRADA"
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-warning/10 text-warning border-warning/30"
                  }`}
                >
                  {selectedMovement.naturaleza === "ENTRADA" ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {selectedMovement.naturaleza}
                </span>
              </div>

              {/* Product and Warehouse Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface p-3 rounded-md border border-border">
                  <p className="text-[10px] text-foreground-muted uppercase font-semibold">Producto</p>
                  <p className="font-bold text-foreground text-xs mt-0.5 truncate" title={selectedMovement.producto_nombre}>
                    {selectedMovement.producto_nombre}
                  </p>
                  <p className="text-[10px] text-foreground-muted font-mono mt-0.5">
                    SKU: {selectedMovement.codigo_producto}
                  </p>
                </div>
                <div className="bg-surface p-3 rounded-md border border-border">
                  <p className="text-[10px] text-foreground-muted uppercase font-semibold">Almacén</p>
                  <p className="font-bold text-foreground text-xs mt-0.5 truncate">
                    {selectedMovement.almacen_nombre}
                  </p>
                  <p className="text-[10px] text-foreground-muted font-mono mt-0.5">
                    ID: {selectedMovement.almacen_id}
                  </p>
                </div>
              </div>

              {/* Balances and Quantities */}
              <div className="bg-surface p-3 rounded-md border border-border space-y-2">
                <p className="text-[10px] text-foreground-muted uppercase font-semibold">Impacto en Existencias</p>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-card p-2 rounded border border-border">
                    <p className="text-[10px] text-foreground-muted">Stock Anterior</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">
                      {formatNumber(selectedMovement.stock_anterior)}
                    </p>
                  </div>
                  <div className="bg-card p-2 rounded border border-border">
                    <p className="text-[10px] text-foreground-muted">Cantidad Movida</p>
                    <p
                      className={`font-mono font-bold mt-0.5 ${
                        selectedMovement.naturaleza === "ENTRADA" ? "text-success" : "text-warning"
                      }`}
                    >
                      {selectedMovement.naturaleza === "ENTRADA" ? "+" : "-"}
                      {formatNumber(selectedMovement.cantidad)}
                    </p>
                  </div>
                  <div className="bg-card p-2 rounded border border-border">
                    <p className="text-[10px] text-foreground-muted">Stock Resultante</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">
                      {formatNumber(selectedMovement.stock_nuevo)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Valuation & Costs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface p-3 rounded-md border border-border">
                  <p className="text-[10px] text-foreground-muted uppercase font-semibold">Costo Unitario</p>
                  <p className="font-bold font-mono text-foreground text-sm mt-0.5">
                    {formatMoney(selectedMovement.costo_unitario)}
                  </p>
                </div>
                <div className="bg-surface p-3 rounded-md border border-border">
                  <p className="text-[10px] text-foreground-muted uppercase font-semibold">Costo Total Valuado</p>
                  <p className="font-bold font-mono text-primary text-sm mt-0.5">
                    {formatMoney(selectedMovement.costo_total)}
                  </p>
                </div>
              </div>

              {/* User, Reference and Observations */}
              <div className="bg-surface p-3 rounded-md border border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-muted">Registrado por:</span>
                  <span className="font-semibold text-foreground">{selectedMovement.usuario_nombre}</span>
                </div>
                {selectedMovement.referencia && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border-subtle">
                    <span className="text-foreground-muted">Referencia:</span>
                    <span className="font-mono font-semibold text-foreground">{selectedMovement.referencia}</span>
                  </div>
                )}
                {selectedMovement.observacion && (
                  <div className="pt-1 border-t border-border-subtle">
                    <span className="text-[10px] text-foreground-muted block mb-0.5">Observaciones:</span>
                    <p className="text-foreground bg-card p-2 rounded border border-border italic text-[11px]">
                      {selectedMovement.observacion}
                    </p>
                  </div>
                )}
              </div>

              {/* Transfer UUID if applicable */}
              {selectedMovement.transferencia_uuid && (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 space-y-1">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    Vinculación de Transferencia
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-foreground truncate">
                      {selectedMovement.transferencia_uuid}
                    </span>
                    <button
                      onClick={() => handleCopyUuid(selectedMovement.transferencia_uuid)}
                      className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors cursor-pointer shrink-0"
                      title="Copiar UUID"
                    >
                      {copiedUuid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-surface border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedMovement(null)}
                className="px-4 py-1.5 bg-surface-subtle hover:bg-surface-elevated text-foreground border border-border rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
