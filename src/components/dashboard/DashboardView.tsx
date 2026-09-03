"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Users,
  Clock,
  BarChart3,
  PieChart,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
  Calendar,
  Filter
} from "lucide-react";

interface InitialMetrics {
  totalOrdenes?: number;
  totalClientes?: number;
  // legacy fallback support
  ordenesActivas?: number;
  ingresosDia?: number;
  nuevosClientesSemana?: number;
}

export default function DashboardView({ initialMetrics }: { initialMetrics?: InitialMetrics }) {
  const router = useRouter();
  
  // Range states
  const [rangeType, setRangeType] = useState<"7d" | "14d" | "30d" | "custom">("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const chartScrollRef = React.useRef<HTMLDivElement>(null);
  const chartCardRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartScrollRef.current && (dashboardData?.weeklyData?.length || 0) > 10) {
      const timer = setTimeout(() => {
        if (chartScrollRef.current) {
          chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dashboardData, rangeType]);

  // Set default custom dates (last 7 days)
  useEffect(() => {
    const today = new Date();
    const SevenDaysAgo = new Date();
    SevenDaysAgo.setDate(today.getDate() - 6);
    
    setCustomTo(today.toISOString().split("T")[0]);
    setCustomFrom(SevenDaysAgo.toISOString().split("T")[0]);
  }, []);

  const fetchDashboard = async (range: string, from?: string, to?: string) => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/dashboard?range=${range}`;
      if (range === "custom") {
        if (!from || !to) {
          setError("Debe seleccionar las fechas 'Desde' y 'Hasta'.");
          setLoading(false);
          return;
        }
        if (from > to) {
          setError("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
          setLoading(false);
          return;
        }
        url += `&from=${from}&to=${to}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return;
        }
        setError(json.message || "Error al cargar las métricas.");
        return;
      }

      setDashboardData(json.data);
    } catch (err) {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rangeType !== "custom") {
      fetchDashboard(rangeType);
    }
  }, [rangeType]);

  const handleApplyCustomRange = () => {
    if (rangeType === "custom") {
      fetchDashboard("custom", customFrom, customTo);
    }
  };

  // Extract snapshot & period data
  const totalOrdenesVal = dashboardData?.totalOrdenes ?? dashboardData?.total_ordenes ?? initialMetrics?.totalOrdenes ?? ((dashboardData?.ordenesActivas ?? 0) + (dashboardData?.desgloseEstados?.entregadas ?? 0));
  const totalClientesVal = dashboardData?.totalClientes ?? dashboardData?.total_clientes ?? initialMetrics?.totalClientes ?? 0;
  const desgloseEstados = dashboardData?.desgloseEstados || { enProceso: 0, recibidas: 0, listas: 0, entregadas: 0 };

  const weeklyData: Array<{
    fecha: string;
    day: string;
    etiqueta: string;
    label: string;
    ordenes_registradas: number;
    ordenes_entregadas: number;
    servicios_realizados: number;
  }> = dashboardData?.weeklyData || [];

  const categoryBreakdown: Array<{ name: string; percentage: number; count: string; color: string }> = dashboardData?.categoryBreakdown || [];
  const recentOrdersList: Array<{ id: number; codigo: string; cliente: string; vehiculo: string; servicio: string; estado: string; mecanico: string; tiempo: string }> = dashboardData?.recentOrders || [];

  const totalRegistradasPeriodo = dashboardData?.resumenGrafico?.totalOrdenesRegistradas ?? weeklyData.reduce((acc, curr) => acc + (curr.ordenes_registradas || 0), 0);
  const totalEntregadasPeriodo = dashboardData?.resumenGrafico?.totalOrdenesEntregadas ?? weeklyData.reduce((acc, curr) => acc + (curr.ordenes_entregadas || 0), 0);
  const totalServiciosPeriodo = dashboardData?.resumenGrafico?.totalServicios ?? weeklyData.reduce((acc, curr) => acc + (curr.servicios_realizados || 0), 0);

  const numDaysPeriodo = Math.max(1, weeklyData.length);
  const promedioDiarioVal = dashboardData?.resumenGrafico?.promedioDiario ?? Number((totalRegistradasPeriodo / numDaysPeriodo).toFixed(1));

  // Compute Dia de Mayor Actividad (if not provided by backend)
  let diaMayorActividadVal = dashboardData?.resumenGrafico?.diaMayorActividad;
  if (!diaMayorActividadVal) {
    let maxRegCount = 0;
    let maxRegDay: any = null;
    for (const d of weeklyData) {
      if ((d.ordenes_registradas || 0) >= maxRegCount && (d.ordenes_registradas || 0) > 0) {
        maxRegCount = d.ordenes_registradas;
        maxRegDay = d;
      }
    }
    diaMayorActividadVal = maxRegDay
      ? { etiqueta: maxRegDay.etiqueta, cantidad: maxRegCount }
      : { etiqueta: "Sin actividad", cantidad: 0 };
  }

  const resumenGrafico = dashboardData?.resumenGrafico || {
    totalOrdenesRegistradas: totalRegistradasPeriodo,
    totalOrdenesEntregadas: totalEntregadasPeriodo,
    totalServicios: totalServiciosPeriodo,
    promedioDiario: promedioDiarioVal,
    diaMayorActividad: diaMayorActividadVal,
    periodoTexto: rangeType === 'custom'
      ? `${customFrom} a ${customTo}`
      : rangeType === '14d'
      ? 'Últimos 14 días'
      : rangeType === '30d'
      ? 'Últimos 30 días'
      : 'Últimos 7 días'
  };

  // Compute dynamic scale for Y axis
  const maxDailyCount = Math.max(
    1,
    ...weeklyData.map((d) => Math.max(d.ordenes_registradas || 0, d.ordenes_entregadas || 0))
  );
  const yAxisMax = maxDailyCount <= 3 ? 4 : maxDailyCount <= 6 ? 6 : Math.ceil(maxDailyCount / 2) * 2;
  const yAxisTicks = [yAxisMax, Math.round(yAxisMax * 0.75), Math.round(yAxisMax * 0.5), Math.round(yAxisMax * 0.25), 0];
  const distinctYTicks = Array.from(new Set(yAxisTicks));

  const hasAnyActivity = totalRegistradasPeriodo > 0 || totalEntregadasPeriodo > 0;

  const handleNavigateWorkOrders = () => {
    router.push("/work-orders");
  };

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Controls Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-sans text-2xl md:text-3xl font-black text-foreground tracking-tight">
                Dashboard General
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/15 border border-success/30 text-success font-mono text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Datos actualizados
              </span>
            </div>
            <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
              Monitoreo operativo de órdenes de trabajo, clientes y flujo del taller
            </p>
          </div>

          {/* Controls: Range Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchDashboard(rangeType, customFrom, customTo)}
              className="p-2 bg-surface-subtle border border-border rounded-xl text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>

            <div className="bg-surface-subtle border border-border rounded-xl p-1 flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setRangeType("7d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "7d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-hover"
                }`}
              >
                7 días
              </button>
              <button
                onClick={() => setRangeType("14d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "14d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-hover"
                }`}
              >
                14 días
              </button>
              <button
                onClick={() => setRangeType("30d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "30d"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-hover"
                }`}
              >
                30 días
              </button>
              <button
                onClick={() => setRangeType("custom")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "custom"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-hover"
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Custom Range Inputs Bar (Appears when Personalizado is active) */}
        {rangeType === "custom" && (
          <div className="pt-3 border-t border-border flex flex-wrap items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200">
            <span className="text-foreground-muted font-bold flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" /> Rango Personalizado:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-foreground-muted">Desde:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-input border border-border rounded-lg px-2.5 py-1 text-foreground font-mono text-xs focus:border-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-foreground-muted">Hasta:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-input border border-border rounded-lg px-2.5 py-1 text-foreground font-mono text-xs focus:border-primary outline-none"
              />
            </div>
            <button
              onClick={handleApplyCustomRange}
              className="px-4 py-1.5 bg-primary-button-bg text-primary-foreground rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Filter size={13} /> Aplicar Rango
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-error/15 border border-error/30 rounded-xl text-error text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboard(rangeType, customFrom, customTo)}
            className="px-3 py-1 bg-error/20 rounded-lg hover:bg-error/30 font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2 Main KPI Cards Grid: Total de Órdenes & Total de Clientes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* KPI 1: Total de Órdenes (Snapshot) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block">
                TOTAL DE ÓRDENES
              </span>
              <div className="p-2 bg-primary/15 border border-primary/30 rounded-xl text-primary group-hover:scale-110 transition-transform">
                <Wrench size={18} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-3xl md:text-4xl font-black text-primary">
                {loading && !dashboardData && initialMetrics?.totalOrdenes === undefined ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  totalOrdenesVal
                )}
              </h3>
            </div>
            <p className="text-xs text-foreground-muted font-mono mt-2 leading-relaxed">
              {desgloseEstados.enProceso} en reparación • {desgloseEstados.recibidas} recibidas • {desgloseEstados.listas} {desgloseEstados.listas === 1 ? 'lista' : 'listas'} para entrega • {desgloseEstados.entregadas || 0} entregadas
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled">
            Estado General Taller
          </div>
        </div>

        {/* KPI 2: Total de Clientes (Snapshot Global) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block">
                TOTAL DE CLIENTES
              </span>
              <div className="p-2 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-3xl md:text-4xl font-black text-foreground">
                {loading && !dashboardData && initialMetrics?.totalClientes === undefined ? (
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
                ) : (
                  totalClientesVal
                )}
              </h3>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-mono mt-2 font-medium">
              Clientes activos registrados
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled">
            Directorio de Clientes
          </div>
        </div>

      </div>

      {/* Middle Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Flujo Operativo Diario (8 cols) */}
        <div
          ref={chartCardRef}
          className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[400px] max-h-[490px] transition-colors min-w-0 relative"
        >
          {/* Floating Tooltip outside scroll clipping boundary */}
          {hoveredBarIndex !== null && weeklyData[hoveredBarIndex] && tooltipPos && (
            <div
              style={{
                left: `${Math.min(Math.max(115, tooltipPos.x), (chartCardRef.current?.clientWidth || 600) - 115)}px`,
                top: `${Math.max(65, tooltipPos.y - 130)}px`,
                transform: "translateX(-50%)"
              }}
              className="absolute bg-surface-elevated/95 backdrop-blur-md border border-primary/60 p-3 rounded-xl shadow-2xl text-foreground font-mono text-xs z-50 min-w-[210px] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="font-bold border-b border-border pb-1 mb-1.5 text-primary flex justify-between">
                <span>{weeklyData[hoveredBarIndex].label ? `${weeklyData[hoveredBarIndex].day} ${weeklyData[hoveredBarIndex].label}` : weeklyData[hoveredBarIndex].etiqueta}</span>
                <span className="text-foreground-muted text-[10px]">Ver órdenes →</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-primary" /> Registradas:
                  </span>
                  <span className="font-bold text-primary">{weeklyData[hoveredBarIndex].ordenes_registradas || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-info" /> Entregadas:
                  </span>
                  <span className="font-bold text-info">{weeklyData[hoveredBarIndex].ordenes_entregadas || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/60 text-foreground-muted text-[10px]">
                  <span>Servicios completados:</span>
                  <span className="font-bold text-foreground">{weeklyData[hoveredBarIndex].servicios_realizados || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Header & Static Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3 mb-3 shrink-0">
            <div>
              <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                Flujo Operativo Diario
              </h3>
              <p className="text-foreground-muted font-mono text-xs mt-0.5">
                Órdenes registradas y entregadas por día durante el período seleccionado
              </p>
            </div>

            {/* Static Non-Interactive Visual Legend */}
            <div className="flex items-center gap-4 text-xs font-mono shrink-0">
              <span className="flex items-center gap-1.5 text-foreground-secondary font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                Registradas
              </span>
              <span className="flex items-center gap-1.5 text-foreground-secondary font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-info" />
                Entregadas
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization Area */}
          {loading && !dashboardData ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2 min-h-[210px]">
              <Loader2 className="w-5 h-5 animate-spin text-primary" /> Cargando datos del flujo operativo...
            </div>
          ) : weeklyData.length === 0 || !hasAnyActivity ? (
            <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled gap-2 min-h-[210px]">
              <BarChart3 size={28} className="text-foreground-disabled opacity-60" />
              <span>No se registraron ni entregaron órdenes en este período.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-[220px] relative flex flex-col justify-end pt-3 pb-1 min-w-0 overflow-hidden">
              <div className="flex items-stretch h-full relative min-w-0">
                {/* 1. Pinned Y-Axis column (Fixed on the left) */}
                <div className="w-7 shrink-0 flex flex-col justify-between pb-10 pr-1.5 select-none pointer-events-none">
                  {distinctYTicks.map((tickVal, tIdx) => (
                    <span key={tIdx} className="text-[9.5px] font-mono font-bold text-foreground-disabled text-right block leading-none">
                      {tickVal}
                    </span>
                  ))}
                </div>

                {/* 2. Scrollable Plot Area Container */}
                <div
                  ref={chartScrollRef}
                  className="flex-1 min-w-0 overflow-x-auto custom-scrollbar relative flex flex-col justify-end pb-1"
                >
                  {/* Dynamic Canvas with width proportional to days (Full width on 7d/14d, scrollable on 30d+) */}
                  <div
                    style={{
                      minWidth: weeklyData.length > 14 ? `${weeklyData.length * 52}px` : "100%",
                    }}
                    className="w-full h-full flex flex-col justify-end relative"
                  >
                    {/* Horizontal Grid Lines spanning full available width */}
                    <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-10">
                      {distinctYTicks.map((_, tIdx) => (
                        <div key={tIdx} className="w-full border-t border-border/60 h-0" />
                      ))}
                    </div>

                    {/* Grouped Bars Container */}
                    <div className="w-full h-44 flex items-end justify-around gap-1 sm:gap-2 px-1 z-10">
                      {weeklyData.map((item, idx) => {
                        const regCount = item.ordenes_registradas || 0;
                        const entCount = item.ordenes_entregadas || 0;

                        const regHeightPct = regCount > 0 ? Math.max(14, Math.round((regCount / yAxisMax) * 100)) : 0;
                        const entHeightPct = entCount > 0 ? Math.max(14, Math.round((entCount / yAxisMax) * 100)) : 0;

                        const parts = (item.fecha || "").split("-");
                        const dayNum = parseInt(parts[2] || "1", 10);
                        const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                        const monthName = monthNamesShort[parseInt(parts[1] || "1", 10) - 1] || "";
                        const prevItem = idx > 0 ? weeklyData[idx - 1] : null;
                        const prevParts = prevItem ? (prevItem.fecha || "").split("-") : [];
                        const isMonthStart = idx === 0 || parts[1] !== prevParts[1] || dayNum === 1;

                        const barWidthClass =
                          weeklyData.length <= 7
                            ? "w-4 sm:w-6 md:w-7"
                            : weeklyData.length <= 14
                            ? "w-3.5 sm:w-4.5 md:w-5"
                            : "w-3 sm:w-3.5";

                        return (
                          <div
                            key={idx}
                            style={{ minWidth: weeklyData.length > 14 ? "44px" : undefined }}
                            onClick={() => {
                              if (regCount > 0 || entCount > 0) {
                                router.push(`/work-orders?from=${item.fecha}&to=${item.fecha}`);
                              }
                            }}
                            onMouseEnter={(e) => {
                              setHoveredBarIndex(idx);
                              if (chartCardRef.current) {
                                const rect = chartCardRef.current.getBoundingClientRect();
                                setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              }
                            }}
                            onMouseMove={(e) => {
                              if (chartCardRef.current) {
                                const rect = chartCardRef.current.getBoundingClientRect();
                                setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredBarIndex(null);
                              setTooltipPos(null);
                            }}
                            className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer hover:bg-surface-subtle/40 rounded-xl transition-colors py-1"
                          >
                            {/* Dual Bars Pair */}
                            <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2 h-34 pb-0.5">
                              {/* Bar 1: Registradas */}
                              <div className="flex flex-col items-center justify-end h-full">
                                {regCount > 0 && (
                                  <span className="text-[10px] sm:text-[11px] font-mono font-black text-primary mb-1 animate-in fade-in leading-none drop-shadow-sm">
                                    {regCount}
                                  </span>
                                )}
                                <div
                                  style={{ height: `${regHeightPct}%` }}
                                  className={`${barWidthClass} rounded-t-lg transition-all duration-300 ${
                                    regCount > 0
                                      ? "bg-gradient-to-t from-primary/75 via-primary/90 to-primary shadow-sm shadow-primary/30 group-hover:brightness-125"
                                      : "h-0"
                                  }`}
                                />
                              </div>

                              {/* Bar 2: Entregadas */}
                              <div className="flex flex-col items-center justify-end h-full">
                                {entCount > 0 && (
                                  <span className="text-[10px] sm:text-[11px] font-mono font-black text-info mb-1 animate-in fade-in leading-none drop-shadow-sm">
                                    {entCount}
                                  </span>
                                )}
                                <div
                                  style={{ height: `${entHeightPct}%` }}
                                  className={`${barWidthClass} rounded-t-lg transition-all duration-300 ${
                                    entCount > 0
                                      ? "bg-gradient-to-t from-info/75 via-info/90 to-info shadow-sm shadow-info/30 group-hover:brightness-125"
                                      : "h-0"
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Date Label below bars */}
                            <div className="flex flex-col items-center leading-tight mt-2 min-w-0 select-none">
                              <span className="font-mono text-[9.5px] sm:text-[10.5px] font-semibold text-foreground-muted group-hover:text-foreground transition-colors truncate">
                                {item.day}
                              </span>
                              <span className={`font-mono text-[10px] sm:text-[11px] ${
                                isMonthStart ? "font-black text-primary" : "text-foreground-secondary font-medium"
                              }`}>
                                {dayNum < 10 ? `0${dayNum}` : dayNum}{isMonthStart && weeklyData.length > 7 ? ` ${monthName}` : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen Inferior (4 Indicadores Propios del Comportamiento Diario) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 pt-3 mt-1 border-t border-border font-mono text-xs shrink-0">
            {/* 1. Órdenes Registradas */}
            <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Órdenes Registradas</span>
              <span className="text-sm font-black text-primary">{totalRegistradasPeriodo} órdenes</span>
              <span className="text-[9px] text-foreground-disabled block mt-0.5">Ingresadas en el período</span>
            </div>

            {/* 2. Servicios Ejecutados */}
            <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Servicios Ejecutados</span>
              <span className="text-sm font-black text-info">{totalServiciosPeriodo} trabajos</span>
              <span className="text-[9px] text-foreground-disabled block mt-0.5">Finalizados en el período</span>
            </div>

            {/* 3. Promedio Diario */}
            <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Promedio Diario</span>
              <span className="text-sm font-black text-foreground">{Number(promedioDiarioVal).toFixed(1)} órdenes/día</span>
              <span className="text-[9px] text-foreground-disabled block mt-0.5">Promedio de ingresos</span>
            </div>

            {/* 4. Día de Mayor Actividad */}
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-warning font-bold uppercase block">Día de Mayor Actividad</span>
              <span className="text-sm font-black text-warning truncate block" title={diaMayorActividadVal.etiqueta}>
                {diaMayorActividadVal.etiqueta}
              </span>
              <span className="text-[9px] text-warning/80 block truncate mt-0.5">
                {diaMayorActividadVal.cantidad > 0 ? `${diaMayorActividadVal.cantidad} órdenes registradas` : "Sin actividad"}
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Servicios Realizados en el Período (4 cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[400px] max-h-[490px] transition-colors min-w-0">
          <div className="border-b border-border pb-3 mb-3 shrink-0">
            <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
              <PieChart size={18} className="text-info" />
              Servicios Realizados
            </h3>
            <p className="text-foreground-muted font-mono text-xs mt-0.5">
              Trabajos ejecutados en el período ({resumenGrafico.periodoTexto})
            </p>
          </div>

          {loading && !dashboardData ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-info" /> Cargando servicios...
            </div>
          ) : categoryBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-disabled text-center">
              No hay servicios registrados en este período.
            </div>
          ) : (
            <div className="space-y-3 py-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
              {categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="text-foreground font-bold flex items-center gap-2 truncate pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-foreground-muted shrink-0">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <div className="text-right text-[10px] font-mono text-foreground-muted">
                    {cat.count}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 p-3 bg-surface-subtle border border-border rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-foreground-muted">
              Servicios filtrados según el período seleccionado
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Órdenes de Trabajo Recientes (Full Width) */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            Órdenes de Trabajo Recientes
          </h3>
          <button
            onClick={handleNavigateWorkOrders}
            className="text-xs font-mono text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            Ver todas <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-subtle select-none">
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CÓDIGO</th>
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CLIENTE / VEHÍCULO</th>
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">SERVICIO</th>
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">ESTADO</th>
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">MECÁNICO</th>
                  <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-right">FECHA RECEPCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && !dashboardData ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-mono text-xs text-foreground-muted">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-primary" />
                      Cargando órdenes de trabajo...
                    </td>
                  </tr>
                ) : recentOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center font-mono text-xs text-foreground-disabled">
                      No hay órdenes de trabajo registradas.
                    </td>
                  </tr>
                ) : (
                  recentOrdersList.map((order) => {
                    const statusClass =
                      order.estado === "En Reparación" || order.estado === "EN PROCESO"
                        ? "bg-success/15 text-success border-success/30"
                        : order.estado === "Lista para Entrega"
                        ? "bg-primary/15 text-primary border-primary/30"
                        : order.estado === "Entregada"
                        ? "bg-surface-subtle text-foreground-muted border-border"
                        : "bg-info/15 text-info border-info/30";

                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/work-orders?order_id=${order.id}`)}
                        className="hover:bg-hover transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                          {order.codigo}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground font-mono">{order.cliente}</span>
                            <span className="text-[11px] text-foreground-muted font-mono">{order.vehiculo}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-foreground-secondary text-[11px]">
                          {order.servicio}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9.5px] font-bold uppercase tracking-wider ${statusClass}`}>
                            {order.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-foreground-secondary whitespace-nowrap">
                          {order.mecanico}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-foreground-muted text-right whitespace-nowrap">
                          {order.tiempo}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
