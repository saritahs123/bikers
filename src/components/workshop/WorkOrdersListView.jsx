"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  AlertTriangle,
  Inbox,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import WorkOrderStatusBadge, { hexToRgba } from "./WorkOrderStatusBadge";

const STATUS_FILTERS = {
  TOTAL: "",
  RECIBIDAS: "RECIBIDA",
  REPARACION: "REPARACION",
  LISTAS_ENTREGA: "LISTA_ENTREGA",
  ENTREGADAS: "ENTREGADA"
};

const formatCreationDate = (dateValue) => {
  if (!dateValue) return { datePart: "—", timePart: "" };
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return { datePart: "—", timePart: "" };
  const datePart = d.toLocaleDateString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timePart = d.toLocaleTimeString("en-US", {
    timeZone: "America/Santo_Domingo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  return { datePart, timePart };
};

export default function WorkOrdersListView({ onViewDetail, onOpenNewModal, onToggleKanban }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getNormalizedStatus = (val) => {
    if (!val) return STATUS_FILTERS.TOTAL;
    const str = String(val).trim().toUpperCase();
    if (str === "1" || str === "RECIBIDA") return STATUS_FILTERS.RECIBIDAS;
    if (str === "5" || str === "REPARACION") return STATUS_FILTERS.REPARACION;
    if (str === "7" || str === "LISTA_ENTREGA") return STATUS_FILTERS.LISTAS_ENTREGA;
    if (str === "8" || str === "ENTREGADA") return STATUS_FILTERS.ENTREGADAS;
    return str;
  };

  // Primary URL source of truth
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlEstado = getNormalizedStatus(searchParams.get("estado") || searchParams.get("estado_id") || "");
  const urlPrioridad = searchParams.get("prioridad_id") || "";
  const urlMecanico = searchParams.get("mecanico_id") || "";
  const urlSortBy = searchParams.get("sort_by") || "";
  const urlSortOrder = searchParams.get("sort_order") || "asc";
  const urlPage = parseInt(searchParams.get("page") || "1", 10);

  const [orders, setOrders] = useState([]);
  const [catalogs, setCatalogs] = useState({ estados: [], prioridades: [], mecanicos: [] });
  const [metrics, setMetrics] = useState({ total: 0, abiertas: 0, recibidas: 0, en_proceso: 0, en_hold: 0, listas_entrega: 0, entregadas: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  // Synchronized state
  const [search, setSearch] = useState(urlSearch);
  const [selectedEstado, setSelectedEstado] = useState(urlEstado);
  const [selectedPrioridad, setSelectedPrioridad] = useState(urlPrioridad);
  const [selectedMecanico, setSelectedMecanico] = useState(urlMecanico);
  const [dateFrom, setDateFrom] = useState(urlFrom);
  const [dateTo, setDateTo] = useState(urlTo);
  const [sortBy, setSortBy] = useState(urlSortBy);
  const [sortOrder, setSortOrder] = useState(urlSortOrder);
  const [page, setPage] = useState(urlPage);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });

  const fetchSequenceRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Sync state with URL search params on mount & when URL params change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateFrom(urlFrom);
    setDateTo(urlTo);
    setSearch(urlSearch);
    setSelectedEstado(urlEstado);
    setSelectedPrioridad(urlPrioridad);
    setSelectedMecanico(urlMecanico);
    setSortBy(urlSortBy);
    setSortOrder(urlSortOrder);
    setPage(urlPage);
  }, [searchParams, urlFrom, urlTo, urlSearch, urlEstado, urlPrioridad, urlMecanico, urlPage, urlSortBy, urlSortOrder]);

  // Clean up in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch orders using active URL / State filters (preserves existing rows without flickering)
  const fetchOrders = useCallback(async () => {
    const currentSeq = ++fetchSequenceRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsFetching(true);
    setError(null);
    try {
      const activeFrom = dateFrom !== undefined ? dateFrom : urlFrom;
      const activeTo = dateTo !== undefined ? dateTo : urlTo;
      const activeSearch = search !== undefined ? search : urlSearch;
      const activeEstado = selectedEstado !== undefined ? selectedEstado : urlEstado;
      const activePrioridad = selectedPrioridad !== undefined ? selectedPrioridad : urlPrioridad;
      const activeMecanico = selectedMecanico !== undefined ? selectedMecanico : urlMecanico;
      const activeSortBy = sortBy !== undefined ? sortBy : urlSortBy;
      const activeSortOrder = sortOrder !== undefined ? sortOrder : urlSortOrder;

      const queryParams = new URLSearchParams();
      if (activeSearch) queryParams.set("search", activeSearch);
      if (activeEstado) queryParams.set("estado", activeEstado);
      if (activePrioridad) queryParams.set("prioridad_id", activePrioridad);
      if (activeMecanico) queryParams.set("mecanico_id", activeMecanico);
      if (activeFrom) queryParams.set("from", activeFrom);
      if (activeTo) queryParams.set("to", activeTo);
      if (activeSortBy) {
        queryParams.set("sort_by", activeSortBy);
        queryParams.set("sort_order", activeSortOrder || "asc");
      }
      queryParams.set("page", String(page));
      queryParams.set("limit", "25");

      const apiUrl = `/api/taller/ordenes?${queryParams.toString()}`;
      const res = await fetch(apiUrl, { signal: controller.signal });
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

      if (currentSeq !== fetchSequenceRef.current) return;

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Error al cargar las órdenes de trabajo.");
      }

      const fetchedOrders = data.data || [];
      setOrders(fetchedOrders);
      if (data.catalogs) setCatalogs(data.catalogs);
      if (data.meta) setMeta(data.meta);

      if (data.metrics) {
        setMetrics({
          total: Number(data.metrics.total || 0),
          abiertas: Number(data.metrics.abiertas || 0),
          recibidas: Number(data.metrics.recibidas || 0),
          en_proceso: Number(data.metrics.en_proceso || 0),
          en_hold: Number(data.metrics.en_hold || 0),
          listas_entrega: Number(data.metrics.listas_entrega || 0),
          entregadas: Number(data.metrics.entregadas || 0)
        });
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      if (currentSeq === fetchSequenceRef.current) {
        console.error("fetchOrders Error:", err);
        setError(err.message);
      }
    } finally {
      if (currentSeq === fetchSequenceRef.current) {
        setInitialLoading(false);
        setIsFetching(false);
      }
    }
  }, [dateFrom, dateTo, search, selectedEstado, selectedPrioridad, selectedMecanico, sortBy, sortOrder, page, urlFrom, urlTo, urlSearch, urlEstado, urlPrioridad, urlMecanico, urlSortBy, urlSortOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  const updateUrlParams = (newParamsObj) => {
    const params = new URLSearchParams(searchParams.toString());
    const isExplicitPageChange = "page" in newParamsObj;

    Object.entries(newParamsObj).forEach(([key, val]) => {
      if (val === null || val === "" || val === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    });

    if (!isExplicitPageChange) {
      params.set("page", "1");
      setPage(1);
    } else if (newParamsObj.page) {
      setPage(parseInt(String(newParamsObj.page), 10));
    }

    const newQuery = params.toString();
    const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
    router.push(targetUrl);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedEstado(STATUS_FILTERS.TOTAL);
    setSelectedPrioridad("");
    setSelectedMecanico("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setSortBy("");
    setSortOrder("asc");

    const currentParams = new URLSearchParams(searchParams.toString());
    const viewParam = currentParams.get("view");
    const newParams = new URLSearchParams();
    if (viewParam) {
      newParams.set("view", viewParam);
    }

    const newQuery = newParams.toString();
    const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
    router.push(targetUrl);
  };

  const handleSort = (columnKey) => {
    let nextOrder = "asc";
    if (sortBy === columnKey) {
      nextOrder = sortOrder === "asc" ? "desc" : "asc";
    }
    setSortBy(columnKey);
    setSortOrder(nextOrder);
    updateUrlParams({ sort_by: columnKey, sort_order: nextOrder });
  };

  const renderSortIcon = (columnKey) => {
    if (sortBy !== columnKey) {
      return (
        <ArrowUpDown
          size={12}
          className="text-slate-600 opacity-60 group-hover:opacity-100 group-hover:text-slate-400 transition-opacity shrink-0"
        />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={12} className="text-[#bfce7f] shrink-0" />
    ) : (
      <ArrowDown size={12} className="text-[#bfce7f] shrink-0" />
    );
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
      setSelectedEstado(STATUS_FILTERS.TOTAL);
      updateUrlParams({ estado: null, estado_id: null });
    } else if (filterKey === "mecanico") {
      setSelectedMecanico("");
      updateUrlParams({ mecanico_id: null });
    }
  };

  const selectedMecanicoObj = catalogs.mecanicos?.find(m => String(m.usuario_id) === String(selectedMecanico));
  const hasActiveFilters = Boolean(search || selectedEstado || selectedMecanico || dateFrom || dateTo);

  const stRecibida = catalogs.estados?.find(e => e.codigo === "RECIBIDA" || e.estado_orden_id === 1);
  const stReparacion = catalogs.estados?.find(e => e.codigo === "REPARACION" || e.estado_orden_id === 5);
  const stHold = catalogs.estados?.find(e => e.codigo === "HOLD" || e.estado_orden_id === 2);
  const stListaEntrega = catalogs.estados?.find(e => e.codigo === "LISTA_ENTREGA" || e.estado_orden_id === 7);
  const stEntregada = catalogs.estados?.find(e => e.codigo === "ENTREGADA" || e.estado_orden_id === 8);

  const titleRecibida = stRecibida?.nombre || "RECIBIDAS";
  const colorRecibida = (stRecibida?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stRecibida.color_estado.trim())) ? stRecibida.color_estado.trim() : "#38BDF8";

  const titleReparacion = stReparacion?.nombre || "EN REPARACIÓN";
  const colorReparacion = (stReparacion?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stReparacion.color_estado.trim())) ? stReparacion.color_estado.trim() : "#F59E0B";

  const titleHold = stHold?.nombre || "EN HOLD";
  const colorHold = (stHold?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stHold.color_estado.trim())) ? stHold.color_estado.trim() : "#EAB308";

  const titleListaEntrega = stListaEntrega?.nombre || "LISTAS PARA ENTREGA";
  const colorListaEntrega = (stListaEntrega?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stListaEntrega.color_estado.trim())) ? stListaEntrega.color_estado.trim() : "#10B981";

  const titleEntregada = stEntregada?.nombre || "ENTREGADAS";
  const colorEntregada = (stEntregada?.color_estado && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stEntregada.color_estado.trim())) ? stEntregada.color_estado.trim() : "#64748B";

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
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold tracking-wider uppercase border-t border-[#a5b467] shadow-lg shadow-[#84924a]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            NUEVA ORDEN
          </button>
        </div>
      </div>

      {/* Summary Bento Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: TOTAL DE ÓRDENES */}
        <div
          onClick={() => updateUrlParams({ estado: null, estado_id: null })}
          className={`bg-[#161a21] border rounded-xl px-4 py-3 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            !selectedEstado || selectedEstado === STATUS_FILTERS.TOTAL
              ? "border-[#bfce7f] shadow-[0_0_15px_rgba(191,206,127,0.15)] ring-1 ring-[#bfce7f]/30"
              : "border-[#2d3748] hover:border-[#4a5568]"
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <span
                className="font-mono text-[11px] font-bold tracking-wider uppercase truncate"
                style={{ color: (!selectedEstado || selectedEstado === STATUS_FILTERS.TOTAL) ? "#bfce7f" : "#94a3b8" }}
              >
                TOTAL DE ÓRDENES
              </span>
              <Inbox className="w-4 h-4 text-[#bfce7f] shrink-0" />
            </div>
            <div className="text-2xl font-extrabold text-slate-100 font-mono leading-none tracking-tight">{metrics.total || 0}</div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-medium leading-tight">Todas las órdenes registradas</div>
        </div>

        {/* Card 2: RECIBIDAS */}
        <div
          onClick={() => updateUrlParams({ estado: STATUS_FILTERS.RECIBIDAS, estado_id: null })}
          className={`bg-[#161a21] border rounded-xl px-4 py-3 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedEstado === STATUS_FILTERS.RECIBIDAS
              ? "ring-1"
              : "border-[#2d3748] hover:border-[#4a5568]"
          }`}
          style={selectedEstado === STATUS_FILTERS.RECIBIDAS ? {
            borderColor: colorRecibida,
            boxShadow: `0 0 15px ${hexToRgba(colorRecibida, 0.15) || 'rgba(56,189,248,0.15)'}`,
            outlineColor: hexToRgba(colorRecibida, 0.3) || 'rgba(56,189,248,0.3)'
          } : {}}
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <span
                className="font-mono text-[11px] font-bold tracking-wider uppercase truncate"
                style={{ color: selectedEstado === STATUS_FILTERS.RECIBIDAS ? colorRecibida : "#94a3b8" }}
              >
                {titleRecibida}
              </span>
              <Clock className="w-4 h-4 shrink-0" style={{ color: colorRecibida }} />
            </div>
            <div className="text-2xl font-extrabold text-slate-100 font-mono leading-none tracking-tight">{metrics.recibidas || 0}</div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-medium leading-tight">Pendientes de inicio</div>
        </div>

        {/* Card 3: EN REPARACIÓN */}
        <div
          onClick={() => updateUrlParams({ estado: STATUS_FILTERS.REPARACION, estado_id: null })}
          className={`bg-[#161a21] border rounded-xl px-4 py-3 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedEstado === STATUS_FILTERS.REPARACION
              ? "ring-1"
              : "border-[#2d3748] hover:border-[#4a5568]"
          }`}
          style={selectedEstado === STATUS_FILTERS.REPARACION ? {
            borderColor: colorReparacion,
            boxShadow: `0 0 15px ${hexToRgba(colorReparacion, 0.15) || 'rgba(251,191,36,0.15)'}`,
            outlineColor: hexToRgba(colorReparacion, 0.3) || 'rgba(251,191,36,0.3)'
          } : {}}
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <span
                className="font-mono text-[11px] font-bold tracking-wider uppercase truncate"
                style={{ color: selectedEstado === STATUS_FILTERS.REPARACION ? colorReparacion : "#94a3b8" }}
              >
                {titleReparacion}
              </span>
              <Wrench className="w-4 h-4 shrink-0" style={{ color: colorReparacion }} />
            </div>
            <div className="text-2xl font-extrabold text-slate-100 font-mono leading-none tracking-tight">{metrics.en_proceso || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium leading-tight">Trabajo técnico activo</div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-[#2d3748]/60 flex items-center justify-between text-[11px] font-mono leading-none">
            <span className="text-slate-400 font-medium uppercase tracking-wider">
              {titleHold}:
            </span>
            <span
              className="font-bold text-xs"
              style={{ color: colorHold }}
            >
              {metrics.en_hold || 0}
            </span>
          </div>
        </div>

        {/* Card 4: LISTAS PARA ENTREGA */}
        <div
          onClick={() => updateUrlParams({ estado: STATUS_FILTERS.LISTAS_ENTREGA, estado_id: null })}
          className={`bg-[#161a21] border rounded-xl px-4 py-3 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedEstado === STATUS_FILTERS.LISTAS_ENTREGA
              ? "ring-1"
              : "border-[#2d3748] hover:border-[#4a5568]"
          }`}
          style={selectedEstado === STATUS_FILTERS.LISTAS_ENTREGA ? {
            borderColor: colorListaEntrega,
            boxShadow: `0 0 15px ${hexToRgba(colorListaEntrega, 0.15) || 'rgba(16,185,129,0.15)'}`,
            outlineColor: hexToRgba(colorListaEntrega, 0.3) || 'rgba(16,185,129,0.3)'
          } : {}}
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <span
                className="font-mono text-[11px] font-bold tracking-wider uppercase truncate"
                style={{ color: selectedEstado === STATUS_FILTERS.LISTAS_ENTREGA ? colorListaEntrega : "#94a3b8" }}
              >
                {titleListaEntrega}
              </span>
              <ClipboardList className="w-4 h-4 shrink-0" style={{ color: colorListaEntrega }} />
            </div>
            <div className="text-2xl font-extrabold text-slate-100 font-mono leading-none tracking-tight">{metrics.listas_entrega || 0}</div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-medium leading-tight">Listas para cliente</div>
        </div>

        {/* Card 5: ENTREGADAS */}
        <div
          onClick={() => updateUrlParams({ estado: STATUS_FILTERS.ENTREGADAS, estado_id: null })}
          className={`bg-[#161a21] border rounded-xl px-4 py-3 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedEstado === STATUS_FILTERS.ENTREGADAS
              ? "ring-1"
              : "border-[#2d3748] hover:border-[#4a5568]"
          }`}
          style={selectedEstado === STATUS_FILTERS.ENTREGADAS ? {
            borderColor: colorEntregada,
            boxShadow: `0 0 15px ${hexToRgba(colorEntregada, 0.15) || 'rgba(148,163,184,0.15)'}`,
            outlineColor: hexToRgba(colorEntregada, 0.3) || 'rgba(148,163,184,0.3)'
          } : {}}
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <span
                className="font-mono text-[11px] font-bold tracking-wider uppercase truncate"
                style={{ color: selectedEstado === STATUS_FILTERS.ENTREGADAS ? colorEntregada : "#94a3b8" }}
              >
                {titleEntregada}
              </span>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: colorEntregada }} />
            </div>
            <div className="text-2xl font-extrabold text-slate-100 font-mono leading-none tracking-tight">{metrics.entregadas || 0}</div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-medium leading-tight">Completadas / entregadas</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#1c2129] border border-[#2d3748] p-3.5 rounded-xl">
          {/* Search Bar */}
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateUrlParams({ search: e.target.value || null });
              }}
              placeholder="Buscar código, cliente, bicicleta, serie..."
              className="w-full bg-[#0a0c10] border border-[#2d3748] rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:border-[#bfce7f] outline-none font-sans transition-all"
            />
          </div>

          {/* Mechanic Filter & Reset */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <select
              value={selectedMecanico}
              onChange={(e) => {
                setSelectedMecanico(e.target.value);
                updateUrlParams({ mecanico_id: e.target.value || null });
              }}
              className="w-full sm:w-auto bg-[#0a0c10] border border-[#2d3748] rounded-xl py-2.5 px-3.5 text-xs text-slate-200 focus:border-[#bfce7f] outline-none font-sans transition-all cursor-pointer"
            >
              <option value="">Todos los Mecánicos</option>
              {catalogs.mecanicos?.map((m) => (
                <option key={m.usuario_id} value={m.usuario_id}>
                  {m.nombre_completo}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchOrders()}
              className="p-2.5 bg-[#0a0c10] border border-[#2d3748] text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Refrescar órdenes"
            >
              <RotateCcw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#bfce7f]" : ""}`} />
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
                Búsqueda: &ldquo;{search}&rdquo;
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
            {selectedEstado && selectedEstado !== STATUS_FILTERS.TOTAL && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                Estado: {
                  selectedEstado === STATUS_FILTERS.RECIBIDAS ? titleRecibida :
                  selectedEstado === STATUS_FILTERS.REPARACION ? titleReparacion :
                  selectedEstado === STATUS_FILTERS.LISTAS_ENTREGA ? titleListaEntrega :
                  selectedEstado === STATUS_FILTERS.ENTREGADAS ? titleEntregada :
                  catalogs.estados?.find(e => e.codigo === selectedEstado || String(e.estado_orden_id) === String(selectedEstado))?.nombre || selectedEstado
                }
                <button onClick={() => removeFilter("estado")} className="hover:text-white ml-0.5 cursor-pointer">
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
      {initialLoading && orders.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#bfce7f]" />
          <span className="text-xs font-mono">Cargando órdenes de trabajo...</span>
        </div>
      ) : error && orders.length === 0 ? (
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
      ) : !initialLoading && orders.length === 0 ? (
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
            <table className="w-full text-left border-collapse text-xs" aria-busy={isFetching}>
              <thead>
                <tr className="border-b border-[#2d3748] bg-[#12151b] font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none">
                  <th
                    onClick={() => handleSort("codigo")}
                    aria-sort={sortBy === "codigo" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>CÓDIGO</span>
                      {renderSortIcon("codigo")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("fecha")}
                    aria-sort={sortBy === "fecha" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors group whitespace-nowrap"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>FECHA CREACIÓN</span>
                      {renderSortIcon("fecha")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("cliente")}
                    aria-sort={sortBy === "cliente" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>CLIENTE / VEHÍCULO</span>
                      {renderSortIcon("cliente")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("estado")}
                    aria-sort={sortBy === "estado" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 text-center cursor-pointer hover:text-white transition-colors group"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span>ESTADO</span>
                      {renderSortIcon("estado")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("mecanico")}
                    aria-sort={sortBy === "mecanico" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>MECÁNICO ASIGNADO</span>
                      {renderSortIcon("mecanico")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("total")}
                    aria-sort={sortBy === "total" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors group"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      <span>TOTAL</span>
                      {renderSortIcon("total")}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center select-none">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3748]">
                {orders.map((order) => {
                  const targetId = order.orden_trabajo_id || order.orden_id;
                  const { datePart, timePart } = formatCreationDate(order.fecha_creacion || order.fecha_registro || order.fecha_ingreso || order.fecha_recepcion);
                  return (
                    <tr
                      key={targetId}
                      onClick={() => onViewDetail && onViewDetail(targetId)}
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
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{datePart}</span>
                          {timePart && (
                            <span className="text-[10px] text-slate-500">{timePart}</span>
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
                        <WorkOrderStatusBadge name={order.estado_nombre} color={order.estado_color} />
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
                            if (onViewDetail) onViewDetail(targetId);
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
