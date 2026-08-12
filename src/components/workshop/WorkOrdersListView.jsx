"use client";
import React, { useState, useEffect } from "react";
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
  MoreVertical
} from "lucide-react";

export default function WorkOrdersListView({ onViewDetail, onOpenNewModal, onToggleKanban }) {
  const [orders, setOrders] = useState([]);
  const [catalogs, setCatalogs] = useState({ estados: [], prioridades: [], mecanicos: [] });
  const [metrics, setMetrics] = useState({ abiertas: 0, aprobacion: 0, en_proceso: 0, atrasadas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedPrioridad, setSelectedPrioridad] = useState("");
  const [selectedMecanico, setSelectedMecanico] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (selectedEstado) queryParams.set("estado_id", selectedEstado);
      if (selectedPrioridad) queryParams.set("prioridad_id", selectedPrioridad);
      if (selectedMecanico) queryParams.set("mecanico_id", selectedMecanico);
      queryParams.set("page", String(page));
      queryParams.set("limit", "15");

      const res = await fetch(`/api/taller/ordenes?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al cargar las órdenes de trabajo.");
      }

      const fetchedOrders = data.data || [];
      setOrders(fetchedOrders);
      if (data.catalogs) setCatalogs(data.catalogs);
      if (data.meta) setMeta(data.meta);

      // Compute summary metrics dynamically for the 4 operational states
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
  };

  useEffect(() => {
    fetchOrders();
  }, [search, selectedEstado, selectedPrioridad, selectedMecanico, page]);

  const handleClearFilters = () => {
    setSearch("");
    setSelectedEstado("");
    setSelectedPrioridad("");
    setSelectedMecanico("");
    setPage(1);
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

  const getProgressPercentage = (estadoId) => {
    switch (estadoId) {
      case 1: return { pct: 25, text: "Recibida en taller" };
      case 5: return { pct: 60, text: "Reparación en proceso" };
      case 7: return { pct: 90, text: "Lista para entrega" };
      case 8: return { pct: 100, text: "Entregada al cliente" };
      default: return { pct: 50, text: "En progreso" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-slate-400 font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-slate-200 transition-colors cursor-pointer">TALLER</span>
        <span>/</span>
        <span className="text-[#bfce7f] font-semibold">ÓRDENES DE TRABAJO</span>
      </div>

      {/* Stitch Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight font-sans">
            Órdenes de Trabajo
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans">
            Administra los diagnósticos, servicios, aprobaciones y reparaciones realizadas en el taller.
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
            className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold tracking-wider uppercase border-t border-[#a5b467] shadow-lg shadow-[#84924a]/20"
          >
            <Plus className="w-4 h-4" />
            NUEVA ORDEN
          </button>
        </div>
      </div>

      {/* Stitch Summary Bento Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ABIERTAS */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">ABIERTAS</span>
            <Inbox className="w-5 h-5 text-[#bfce7f]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.abiertas}</div>
          <div className="text-xs text-[#bfce7f] mt-1 font-medium">+3 hoy</div>
        </div>

        {/* Card 2: APROBACIÓN */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">APROBACIÓN</span>
            <ClipboardList className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.aprobacion}</div>
          <div className="text-xs text-slate-400 mt-1 font-medium">Pendientes de cliente</div>
        </div>

        {/* Card 3: EN PROCESO */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase">EN PROCESO</span>
            <Wrench className="w-5 h-5 text-[#bfce7f]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono">{metrics.en_proceso}</div>
          <div className="text-xs text-slate-400 mt-1 font-medium">En taller</div>
        </div>

        {/* Card 4: ATRASADAS */}
        <div className="bg-[#161a21] border border-rose-500/30 rounded-xl p-5 hover:border-rose-500/50 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="font-mono text-xs font-bold text-rose-400 tracking-wider uppercase">ATRASADAS</span>
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">{metrics.atrasadas}</div>
          <div className="text-xs text-rose-400/80 mt-1 font-medium">Requieren atención</div>
        </div>
      </div>

      {/* Stitch Filters & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#1c2129] border border-[#2d3748] p-4 rounded-xl">
        {/* Status Quick Filter Pills */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
          <button
            onClick={() => { setSelectedEstado(""); setPage(1); }}
            className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              selectedEstado === ""
                ? "bg-[#2d3748] text-white border border-slate-600"
                : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => { setSelectedEstado("2"); setPage(1); }}
            className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              selectedEstado === "2"
                ? "bg-[#2d3748] text-[#bfce7f] border border-slate-600"
                : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
            }`}
          >
            Diagnóstico
          </button>
          <button
            onClick={() => { setSelectedEstado("5"); setPage(1); }}
            className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              selectedEstado === "5"
                ? "bg-[#2d3748] text-[#bfce7f] border border-slate-600"
                : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
            }`}
          >
            Reparación
          </button>
          <button
            onClick={() => { setSelectedEstado("3"); setPage(1); }}
            className={`px-3 py-1.5 rounded font-mono text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              selectedEstado === "3"
                ? "bg-[#2d3748] text-amber-400 border border-slate-600"
                : "text-slate-400 hover:bg-[#2d3748]/50 hover:text-white border border-transparent"
            }`}
          >
            Aprobación
          </button>
        </div>

        {/* Search & Select Filters */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto items-center">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Filtrar por mecánico, cliente..."
              className="w-full bg-[#0a0c10] border border-[#2d3748] rounded-lg py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:border-[#bfce7f] outline-none"
            />
          </div>

          <select
            value={selectedMecanico}
            onChange={(e) => { setSelectedMecanico(e.target.value); setPage(1); }}
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
            className="p-2 bg-[#0a0c10] border border-[#2d3748] text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Limpiar Filtros"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stitch Data Table Container */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#bfce7f]" />
          <span className="text-xs font-mono">Cargando órdenes de trabajo...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-semibold block">Error al cargar datos</span>
            <span className="text-rose-300/80">{error}</span>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-center gap-3">
          <Wrench className="w-10 h-10 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-300">No se encontraron órdenes de trabajo</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Prueba ajustando los filtros de búsqueda o registra una nueva Orden de Trabajo.
          </p>
          <button
            onClick={onOpenNewModal}
            className="mt-2 px-4 py-2 bg-[#84924a] text-white text-xs font-mono font-bold rounded-xl hover:brightness-110"
          >
            NUEVA ORDEN DE TRABAJO
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Stitch Data Table */}
          <div className="hidden md:block bg-[#161a21] border border-[#2d3748] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1c2129] border-b border-[#2d3748] font-mono text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="p-4 whitespace-nowrap">Orden #</th>
                  <th className="p-4 whitespace-nowrap">Fecha / Cliente</th>
                  <th className="p-4 whitespace-nowrap">Bicicleta / Mecánico</th>
                  <th className="p-4 whitespace-nowrap">Estado / Progreso</th>
                  <th className="p-4 whitespace-nowrap text-right">Total Est.</th>
                  <th className="p-4 whitespace-nowrap text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#2d3748]">
                {orders.map((item) => {
                  const isUrgent = item.prioridad_id === 3 || item.prioridad_nombre?.toLowerCase().includes("alta") || item.prioridad_nombre?.toLowerCase().includes("urgente");
                  const progress = getProgressPercentage(item.estado_orden_id);

                  return (
                    <tr
                      key={item.orden_id}
                      className={`border-b border-[#2d3748] hover:bg-[#1c2129] transition-colors ${
                        isUrgent ? "bg-rose-500/5" : ""
                      }`}
                    >
                      {/* Orden # */}
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" title="Alta Prioridad / Atrasada" />
                          )}
                          <span className="font-mono font-extrabold text-slate-100 text-xs">
                            {item.codigo_orden}
                          </span>
                        </div>
                      </td>

                      {/* Fecha / Cliente */}
                      <td className="p-4 align-top">
                        <div className="text-slate-200 font-semibold">
                          {new Date(item.fecha_ingreso).toLocaleDateString("es-ES", {
                            month: "short",
                            day: "2-digit"
                          })}, {new Date(item.fecha_ingreso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-slate-400 mt-1">{item.cliente_nombre}</div>
                      </td>

                      {/* Bicicleta / Mecánico */}
                      <td className="p-4 align-top">
                        <div className="text-slate-200 font-semibold">{item.bicicleta_marca} {item.bicicleta_modelo}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="text-slate-400">
                            {item.mecanico_nombre || "No asignado"}
                          </span>
                        </div>
                      </td>

                      {/* Estado / Progreso */}
                      <td className="p-4 align-top max-w-[200px]">
                        <div className="mb-2">{getEstadoBadge(item.estado_codigo, item.estado_nombre)}</div>
                        <div className="w-full bg-[#0a0c10] h-1.5 rounded-full overflow-hidden border border-[#2d3748]">
                          <div
                            className={`h-full rounded-full ${
                              isUrgent ? "bg-rose-400" : "bg-[#84924a]"
                            }`}
                            style={{ width: `${progress.pct}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 text-right font-mono">
                          {progress.pct}% - {progress.text}
                        </div>
                      </td>

                      {/* Total Est. */}
                      <td className="p-4 align-top text-right">
                        <div className="text-slate-100 font-mono font-bold">
                          RD$ {parseFloat(item.total_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="p-4 align-top text-center">
                        <button
                          onClick={() => onViewDetail(item.orden_id)}
                          className="p-1.5 text-slate-400 hover:text-[#bfce7f] hover:bg-slate-800 rounded-lg transition-colors"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stitch Cards View */}
          <div className="md:hidden space-y-3">
            {orders.map((item) => {
              const isUrgent = item.prioridad_id === 3 || item.prioridad_nombre?.toLowerCase().includes("alta");
              const progress = getProgressPercentage(item.estado_orden_id);

              return (
                <div
                  key={item.orden_id}
                  onClick={() => onViewDetail(item.orden_id)}
                  className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl space-y-3 hover:border-slate-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-[#bfce7f] text-xs flex items-center gap-1.5">
                      {isUrgent && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                      {item.codigo_orden}
                    </span>
                    {getEstadoBadge(item.estado_codigo, item.estado_nombre)}
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cliente:</span>
                      <span className="font-semibold text-slate-200">{item.cliente_nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bicicleta:</span>
                      <span className="text-slate-300">{item.bicicleta_marca} {item.bicicleta_modelo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mecánico:</span>
                      <span className="text-slate-300 font-medium">{item.mecanico_nombre || "Sin asignar"}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Total Est.:</span>
                      <span className="font-mono font-bold text-slate-100">
                        RD$ {parseFloat(item.total_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#2d3748]">
                    <div className="w-full bg-[#0a0c10] h-1.5 rounded-full overflow-hidden border border-[#2d3748]">
                      <div
                        className="bg-[#84924a] h-full rounded-full"
                        style={{ width: `${progress.pct}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 text-right font-mono">
                      {progress.pct}% - {progress.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stitch Pagination Footer */}
          <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400 font-mono">
            <span>
              Mostrando {orders.length > 0 ? (page - 1) * 15 + 1 : 0}-{Math.min(page * 15, meta.total)} de {meta.total} órdenes
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 bg-[#161a21] border border-[#2d3748] hover:bg-[#1c2129] disabled:opacity-40 rounded-lg transition-all text-slate-300"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= meta.total_pages}
                onClick={() => setPage(page + 1)}
                className="p-2 bg-[#161a21] border border-[#2d3748] hover:bg-[#1c2129] disabled:opacity-40 rounded-lg transition-all text-slate-300"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
