"use client";
import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw
} from "lucide-react";

export default function BillingKanbanView({ onViewInvoiceDetail }) {
  const [orders, setOrders] = useState([]);
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state with debounce
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef(null);

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

  const fetchBillingData = async (searchQuery = "") => {
    setLoading(true);
    setError(null);
    try {
      const url = searchQuery
        ? `/api/taller/facturacion/ordenes?search=${encodeURIComponent(searchQuery)}`
        : `/api/taller/facturacion/ordenes`;

      const res = await fetch(url);
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
        throw new Error(data?.message || data?.error || "Error al cargar órdenes.");
      }

      setOrders(data.data || []);
      const operationalEstados = [
        { estado_orden_id: 1, codigo: "RECIBIDA", nombre: "Recibida", color_estado: "#38BDF8" },
        { estado_orden_id: 5, codigo: "REPARACION", nombre: "En Reparación", color_estado: "#F59E0B" },
        { estado_orden_id: 7, codigo: "LISTA_ENTREGA", nombre: "Lista para Entrega", color_estado: "#10B981" },
        { estado_orden_id: 8, codigo: "ENTREGADA", nombre: "Entregada", color_estado: "#64748B" }
      ];
      setEstados(data.catalogs?.estados || operationalEstados);
    } catch (err) {
      console.error("fetchBillingData Error:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData(debouncedSearch);
  }, [debouncedSearch]);

  const getPrioridadBadge = (nombre, color) => {
    const colorStyle = color ? { color: color, borderColor: `${color}40`, backgroundColor: `${color}15` } : {};
    return (
      <span
        className="px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 w-fit select-none shrink-0"
        style={colorStyle}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || "#64748B" }} />
        {nombre || "Normal"}
      </span>
    );
  };

  const renderColumn = (estado) => {
    const columnOrders = orders.filter((o) => o.estado_orden_id === estado.estado_orden_id);

    return (
      <div
        key={estado.estado_orden_id}
        className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 transition-all min-h-[300px] w-full"
      >
        {/* Column Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 shrink-0 min-h-[42px]">
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: estado.color_estado || "#64748B" }}
            />
            <h3 className="text-xs font-bold text-slate-200 tracking-wide font-sans leading-tight whitespace-normal break-words flex-1">
              {estado.nombre}
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-full shrink-0">
            {columnOrders.length}
          </span>
        </div>

        {/* Column Cards Container */}
        <div className="flex-1 space-y-3 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar overflow-x-hidden">
          {columnOrders.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-xl text-slate-600 text-center p-3">
              <span className="text-[11px]">Sin órdenes en este estado</span>
            </div>
          ) : (
            columnOrders.map((ord) => {
              const totalAmount = parseFloat(ord.total_orden || ord.total_estimado || 0);

              return (
                <div
                  key={ord.orden_id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-3 transition-all shadow-md group relative overflow-x-hidden"
                >
                  {/* Top / Header & Customer Info with Priority & Detalle on right */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 text-xs flex-1 min-w-0">
                      <div className="text-xs font-mono font-extrabold text-emerald-400 mb-1">
                        {ord.codigo_orden}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-200 font-medium truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate" title={ord.cliente_nombre}>
                          {ord.cliente_nombre}
                        </span>
                      </div>
                      {ord.cliente_identificacion && (
                        <div className="text-[10px] text-slate-500 font-mono ml-5">
                          ID: {ord.cliente_identificacion}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                        <Bike className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">
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
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:text-slate-950 bg-emerald-500/10 hover:bg-emerald-400 border border-emerald-500/30 rounded-lg transition-all cursor-pointer shadow-sm"
                        title="Ver detalle de la orden"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalle</span>
                      </button>
                    </div>
                  </div>

                  {/* Financial & Reception Bar */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400 text-[10px]">
                      {ord.codigo_recepcion || "S/R"}
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Total de la Orden</span>
                      <span className="font-bold text-slate-200 text-xs">
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Breadcrumb */}
      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
        <span className="text-slate-400">Taller</span>
        <span>/</span>
        <span className="text-emerald-400 font-semibold">Despacho de Órdenes</span>
      </div>

      {/* 2. Top Header: Title and Description */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>DESPACHO DE ÓRDENES</span>
            <span className="text-xs px-2.5 py-0.5 bg-slate-800 text-emerald-400 border border-slate-700 rounded-full font-mono font-medium">
              {orders.length} Órdenes
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Consulta, revisión y entrega final de órdenes al cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchBillingData(debouncedSearch)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Actualizar listado"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 3. Full-width Wide Search Bar */}
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar por orden, recepción, cliente, bicicleta o identificación…"
            className="w-full bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-2xl pl-11 pr-10 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all shadow-inner font-sans"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {debouncedSearch && (
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between px-1">
            <span>
              Resultados para: <strong className="text-slate-200 font-mono">"{debouncedSearch}"</strong> ({orders.length} encontradas)
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-emerald-400 hover:underline text-[11px] font-medium cursor-pointer"
            >
              Mostrar todas
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Body: Loading, Error or Kanban Columns */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs font-medium">Cargando órdenes...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-semibold block">Error al cargar datos</span>
              <span className="text-rose-300/80">{error}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchBillingData(debouncedSearch)}
            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : orders.length === 0 && debouncedSearch ? (
        <div className="p-12 flex flex-col items-center justify-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-center space-y-3">
          <FileSpreadsheet className="w-10 h-10 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Sin coincidencias para la búsqueda</p>
            <p className="text-xs text-slate-500 mt-1">
              No se encontraron órdenes con el término "{debouncedSearch}".
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all cursor-pointer"
          >
            Limpiar Búsqueda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {estados.map(renderColumn)}
        </div>
      )}
    </div>
  );
}
