"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Plus,
  Kanban,
  RotateCcw,
  Eye,
  Wrench,
  User,
  Bike,
  Calendar,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle2,
  Download,
  AlertTriangle,
  Inbox,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  Tag
} from "lucide-react";

export default function WorkOrdersListView({ onViewDetail, onOpenNewModal, onToggleKanban }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Primary URL source of truth
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlEstado = searchParams.get("estado_id") || "";
  const urlPrioridad = searchParams.get("prioridad_id") || "";
  const urlMecanico = searchParams.get("mecanico_id") || "";
  const urlPage = parseInt(searchParams.get("page") || "1", 10);

  const [orders, setOrders] = useState([]);
  const [catalogs, setCatalogs] = useState({ estados: [], prioridades: [], mecanicos: [] });
  const [metrics, setMetrics] = useState({ abiertas: 0, aprobacion: 0, en_proceso: 0, atrasadas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronized state
  const [search, setSearch] = useState(urlSearch);
  const [selectedEstado, setSelectedEstado] = useState(urlEstado);
  const [selectedPrioridad, setSelectedPrioridad] = useState(urlPrioridad);
  const [selectedMecanico, setSelectedMecanico] = useState(urlMecanico);
  const [dateFrom, setDateFrom] = useState(urlFrom);
  const [dateTo, setDateTo] = useState(urlTo);
  const [page, setPage] = useState(urlPage);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });

  // Sync state with URL search params on mount & when URL params change
  useEffect(() => {
    setDateFrom(urlFrom);
    setDateTo(urlTo);
    setSearch(urlSearch);
    setSelectedEstado(urlEstado);
    setSelectedPrioridad(urlPrioridad);
    setSelectedMecanico(urlMecanico);
    setPage(urlPage);
  }, [searchParams, urlFrom, urlTo, urlSearch, urlEstado, urlPrioridad, urlMecanico, urlPage]);

  // Fetch orders using active URL / State filters
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFrom = dateFrom !== undefined ? dateFrom : urlFrom;
      const activeTo = dateTo !== undefined ? dateTo : urlTo;
      const activeSearch = search !== undefined ? search : urlSearch;
      const activeEstado = selectedEstado !== undefined ? selectedEstado : urlEstado;
      const activePrioridad = selectedPrioridad !== undefined ? selectedPrioridad : urlPrioridad;
      const activeMecanico = selectedMecanico !== undefined ? selectedMecanico : urlMecanico;

      const queryParams = new URLSearchParams();
      if (activeSearch) queryParams.set("search", activeSearch);
      if (activeEstado) queryParams.set("estado_id", activeEstado);
      if (activePrioridad) queryParams.set("prioridad_id", activePrioridad);
      if (activeMecanico) queryParams.set("mecanico_id", activeMecanico);
      if (activeFrom) queryParams.set("from", activeFrom);
      if (activeTo) queryParams.set("to", activeTo);
      queryParams.set("page", String(page));
      queryParams.set("limit", "15");

      const apiUrl = `/api/taller/ordenes?${queryParams.toString()}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al cargar las órdenes de trabajo.");
      }

      const fetchedOrders = data.data || [];
      setOrders(fetchedOrders);
      if (data.catalogs) setCatalogs(data.catalogs);
      if (data.meta) setMeta(data.meta);

      // Compute summary metrics dynamically
      const abiertasCount = fetchedOrders.filter(o => o.estado_orden_id !== 8).length;
      const recibidasCount = fetchedOrders.filter(o => o.estado_orden_id === 1).length;
      const enReparacionCount = fetchedOrders.filter(o => o.estado_orden_id === 5).length;
      const listasEntregaCount = fetchedOrders.filter(o => o.estado_orden_id === 7).length;

      setMetrics({
        abiertas: abiertasCount || fetchedOrders.length,
        recibidas: recibidasCount,
        en_proceso: enReparacionCount,
        listas_entrega: listasEntregaCount
      });
    } catch (err) {
      console.error("fetchOrders Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search, selectedEstado, selectedPrioridad, selectedMecanico, page, urlFrom, urlTo, urlSearch, urlEstado, urlPrioridad, urlMecanico]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateUrlParams = (newParamsObj) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParamsObj).forEach(([key, val]) => {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    params.set("page", "1");
    setPage(1);
    const newQuery = params.toString();
    router.push(newQuery ? `/work-orders?${newQuery}` : "/work-orders");
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedEstado("");
    setSelectedPrioridad("");
    setSelectedMecanico("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    router.push("/work-orders");
  };

  const removeFilter = (filterKey) => {
    if (filterKey === "date") {
      setDateFrom("");
      setDateTo("");
      updateUrlParams({ from: null, to: null });
    } else if (filterKey === "search") {
      setSearch("");
      updateUrlParams({ search: null });
    } else if (filterKey === "estado") {
      setSelectedEstado("");
      updateUrlParams({ estado_id: null });
    } else if (filterKey === "mecanico") {
      setSelectedMecanico("");
      updateUrlParams({ mecanico_id: null });
    }
  };

  const getEstadoBadge = (codigo, nombre) => {
    let style = "bg-slate-800 text-slate-300 border-slate-700";
    if (codigo === "RECIBIDA") style = "bg-slate-800 text-slate-300 border-slate-700";
    if (codigo === "REPARACION") style = "bg-[#84924a]/20 text-[#bfce7f] border-[#84924a]/40";
    if (codigo === "LISTA_ENTREGA") style = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (codigo === "ENTREGADA") style = "bg-slate-700/40 text-slate-400 border-slate-600/30";

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded font-mono text-[10px] font-bold border uppercase tracking-wider ${style}`}>
        {nombre}
      </span>
    );
  };

  const selectedMecanicoObj = catalogs.mecanicos?.find(m => String(m.usuario_id) === String(selectedMecanico));
  const hasActiveFilters = Boolean(search || selectedEstado || selectedMecanico || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-slate-400 font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-slate-200 transition-colors cursor-pointer" onClick={handleClearFilters}>TALLER</span>
        <span>/</span>
        <span className="text-[#bfce7f] font-semibold">ÓRDENES DE TRABAJO</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight font-sans">
            Órdenes de Trabajo
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans">
            Administra las recepciones, servicios, reparaciones y entregas del taller.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => alert("Exportando listado de órdenes de trabajo...")}
            className="flex items-center gap-2 px-4 py-2 border border-[#2d3748] rounded-xl text-slate-300 hover:text-white bg-[#161a21] hover:border-slate-600 transition-colors font-mono text-xs font-semibold tracking-wider uppercase"
          >
            <Download className="w-4 h-4 text-slate-400" />
            EXPORTAR
          </button>
          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold tracking-wider uppercase border-t border-[#a5b467] shadow-lg shadow-[#84924a]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            NUEVA ORDEN
          </button>
        </div>
      </div>

      {/* Summary Bento Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ABIERTAS */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">ABIERTAS</span>
            <Inbox className="w-5 h-5 text-[#bfce7f]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.abiertas}</div>
          <div className="text-xs text-[#bfce7f] mt-1 font-medium">En proceso / activas</div>
        </div>

        {/* Card 2: RECIBIDAS */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">RECIBIDAS</span>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.recibidas || 0}</div>
          <div className="text-xs text-slate-400 mt-1 font-medium">Pendientes de inicio</div>
        </div>

        {/* Card 3: EN REPARACIÓN */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">EN REPARACIÓN</span>
            <Wrench className="w-5 h-5 text-[#bfce7f]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.en_proceso}</div>
          <div className="text-xs text-slate-400 mt-1 font-medium">Trabajo técnico activo</div>
        </div>

        {/* Card 4: LISTAS PARA ENTREGA */}
        <div className="bg-[#161a21] border border-amber-500/30 rounded-xl p-5 hover:border-amber-500/50 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-amber-400 tracking-wider uppercase">LISTAS PARA ENTREGA</span>
            <ClipboardList className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">{metrics.listas_entrega || 0}</div>
          <div className="text-xs text-amber-400/80 mt-1 font-medium">Listas para cliente</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#1c2129] border border-[#2d3748] p-4 rounded-xl">
          {/* Status Quick Filter Pills */}
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
            <button
              onClick={() => updateUrlParams({ estado_id: null })}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                selectedEstado === ""
                  ? "bg-[#2d3748] text-white border border-slate-600"
                  : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => updateUrlParams({ estado_id: "1" })}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                selectedEstado === "1"
                  ? "bg-[#2d3748] text-[#bfce7f] border border-slate-600"
                  : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
              }`}
            >
              Recibidas
            </button>
            <button
              onClick={() => updateUrlParams({ estado_id: "5" })}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                selectedEstado === "5"
                  ? "bg-[#2d3748] text-[#bfce7f] border border-slate-600"
                  : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
              }`}
            >
              En Reparación
            </button>
            <button
              onClick={() => updateUrlParams({ estado_id: "7" })}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                selectedEstado === "7"
                  ? "bg-[#2d3748] text-amber-400 border border-slate-600"
                  : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
              }`}
            >
              Listas para Entrega
            </button>
            <button
              onClick={() => updateUrlParams({ estado_id: "8" })}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
                selectedEstado === "8"
                  ? "bg-[#2d3748] text-emerald-400 border border-slate-600"
                  : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
              }`}
            >
              Entregadas
            </button>
          </div>

          {/* Search & Select Filters */}
          <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto items-center">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  updateUrlParams({ search: e.target.value || null });
                }}
                placeholder="Buscar código, cliente, bicicleta..."
                className="w-full bg-[#0a0c10] border border-[#2d3748] rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:border-[#bfce7f] outline-none"
              />
            </div>

            <select
              value={selectedMecanico}
              onChange={(e) => {
                setSelectedMecanico(e.target.value);
                updateUrlParams({ mecanico_id: e.target.value || null });
              }}
              className="bg-[#0a0c10] border border-[#2d3748] rounded-lg py-2 px-3 text-xs text-slate-200 focus:border-[#bfce7f] outline-none"
            >
              <option value="">Todos los Mecánicos</option>
              {catalogs.mecanicos?.map((m) => (
                <option key={m.usuario_id} value={m.usuario_id}>
                  {m.nombre_completo}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearFilters}
              className="p-2 bg-[#0a0c10] border border-[#2d3748] text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Limpiar Filtros"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Filters Bar */}
        {hasActiveFilters && (
          <div className="p-3 bg-[#13171f] border border-[#bfce7f]/40 rounded-xl flex flex-wrap items-center gap-2 font-mono text-xs animate-in fade-in duration-200">
            <span className="text-[#bfce7f] font-bold flex items-center gap-1.5 mr-1">
              <Tag size={13} /> Filtros Activos:
            </span>

            {/* Date Tag */}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f] font-bold">
                <Calendar size={12} />
                Fecha: {dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}
                <button onClick={() => removeFilter("date")} className="hover:text-white ml-0.5">
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Search Tag */}
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 font-bold">
                <Search size={12} />
                Búsqueda: "{search}"
                <button onClick={() => removeFilter("search")} className="hover:text-white ml-0.5">
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Mechanic Tag */}
            {selectedMecanico && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold">
                <User size={12} />
                Mecánico: {selectedMecanicoObj?.nombre_completo || `#${selectedMecanico}`}
                <button onClick={() => removeFilter("mecanico")} className="hover:text-white ml-0.5">
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Estado Tag */}
            {selectedEstado && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                Estado #{selectedEstado}
                <button onClick={() => removeFilter("estado")} className="hover:text-white ml-0.5">
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={handleClearFilters}
              className="ml-auto text-[11px] text-slate-400 hover:text-white underline font-bold"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* Data Table Container */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#bfce7f]" />
          <span className="text-xs font-mono">Cargando órdenes de trabajo...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono text-center space-y-3">
          <AlertCircle className="w-6 h-6 mx-auto" />
          <p>{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-1.5 bg-rose-500/20 rounded-lg hover:bg-rose-500/30 font-bold"
          >
            Reintentar
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 space-y-3 font-mono">
          <Inbox className="w-8 h-8 mx-auto text-slate-500" />
          <p className="text-sm font-bold text-slate-300">No se encontraron órdenes de trabajo</p>
          <p className="text-xs text-slate-500">Prueba ajustando los filtros de búsqueda o fecha.</p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[#bfce7f] text-[#1d1f18] rounded-xl font-bold hover:brightness-110 text-xs shadow"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#161a21]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2d3748] bg-[#12151b] font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none">
                  <th className="py-3 px-4">CÓDIGO</th>
                  <th className="py-3 px-4">CLIENTE / VEHÍCULO</th>
                  <th className="py-3 px-4 text-center">ESTADO</th>
                  <th className="py-3 px-4">MECÁNICO ASIGNADO</th>
                  <th className="py-3 px-4 text-right">TOTAL</th>
                  <th className="py-3 px-4 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3748]">
                {orders.map((order) => {
                  return (
                    <tr
                      key={order.orden_id}
                      onClick={() => onViewDetail && onViewDetail(order.orden_id)}
                      className="hover:bg-[#1f242d] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#bfce7f] whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{order.codigo_orden}</span>
                          {order.codigo_recepcion && (
                            <span className="text-[10px] text-slate-500">Rec: {order.codigo_recepcion}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white font-mono">{order.cliente_nombre}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {order.bicicleta_marca} {order.bicicleta_modelo}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getEstadoBadge(order.estado_codigo, order.estado_nombre)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-slate-400" />
                          <span>{order.mecanico_nombre || "Por asignar"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right font-bold text-emerald-400 whitespace-nowrap">
                        RD$ {Number(order.total_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onViewDetail) onViewDetail(order.orden_id);
                          }}
                          className="px-3 py-1 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-slate-300 hover:text-white hover:border-[#bfce7f] font-mono text-[11px] font-bold transition-colors"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-[#2d3748] bg-[#12151b] flex items-center justify-between font-mono text-xs text-slate-400">
            <span>
              Mostrando {orders.length} de {meta.total} órdenes
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => updateUrlParams({ page: String(Math.max(1, page - 1)) })}
                className="p-1.5 bg-[#0a0c10] border border-[#2d3748] rounded-lg disabled:opacity-40 hover:text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <span>Página {page} de {meta.total_pages}</span>
              <button
                disabled={page >= meta.total_pages}
                onClick={() => updateUrlParams({ page: String(Math.min(meta.total_pages, page + 1)) })}
                className="p-1.5 bg-[#0a0c10] border border-[#2d3748] rounded-lg disabled:opacity-40 hover:text-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
