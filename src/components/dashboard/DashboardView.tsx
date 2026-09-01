"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
  PieChart,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Filter
} from "lucide-react";

interface InitialMetrics {
  ordenesActivas: number;
  ingresosDia: number;
  nuevosClientesSemana: number;
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

  const formatDOP = (val: number) =>
    `RD$ ${Number(val || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Extract snapshot & period data
  const totalOrdenesVal = dashboardData?.totalOrdenes ?? dashboardData?.total_ordenes ?? ((dashboardData?.ordenesActivas ?? 0) + (dashboardData?.desgloseEstados?.entregadas ?? 0));
  const ordenesActivasVal = dashboardData?.ordenesActivas ?? initialMetrics?.ordenesActivas ?? 0;
  const facturacionPeriodoVal = dashboardData?.facturacion_periodo ?? dashboardData?.facturacionPeriodo ?? initialMetrics?.ingresosDia ?? 0;
  const montoPendienteVal = dashboardData?.monto_pendiente_entrega ?? dashboardData?.montoPendienteEntrega ?? 0;
  const ordenesPendientesVal = dashboardData?.ordenes_pendientes_entrega ?? dashboardData?.ordenesPendientesEntrega ?? 0;
  const nuevosClientesVal = dashboardData?.nuevosClientesSemana ?? initialMetrics?.nuevosClientesSemana ?? 0;
  const ordenesEntregadasVal = dashboardData?.ordenesEntregadasPeriodo ?? 0;
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
  const mecanicosCarga: Array<{ id: number; nombre: string; servicios: number }> = dashboardData?.mecanicosCarga || [];
  const lowStockList: Array<{ id: number; codigo: string; nombre: string; stock: number; minimo: number }> = dashboardData?.lowStockItems || [];

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
    periodoTexto: "Últimos 7 días"
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

  const handleNavigateInventory = () => {
    router.push("/inventory");
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
              Monitoreo operativo de órdenes de trabajo, facturación, clientes e inventario
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

      {/* 5 Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        
        {/* KPI 1: Total de Órdenes (Snapshot) */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">
                TOTAL DE ÓRDENES
              </span>
              <div className="p-1.5 bg-primary/15 border border-primary/30 rounded-lg text-primary group-hover:scale-110 transition-transform">
                <Wrench size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-primary">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : totalOrdenesVal}
              </h3>
            </div>
            <p className="text-[9.5px] 2xl:text-[10px] text-foreground-muted font-mono mt-1.5 leading-tight">
              {desgloseEstados.enProceso} en reparación • {desgloseEstados.recibidas} recibidas • {desgloseEstados.listas} {desgloseEstados.listas === 1 ? 'lista' : 'listas'} para entrega • {desgloseEstados.entregadas || 0} entregadas
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-foreground-disabled">
            Estado General Taller
          </div>
        </div>

        {/* KPI 2: Facturación del Período (Period) */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-success/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">
                FACTURACIÓN PERÍODO
              </span>
              <div className="p-1.5 bg-success/15 border border-success/30 rounded-lg text-success group-hover:scale-110 transition-transform shrink-0">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-lg 2xl:text-xl font-black text-foreground whitespace-nowrap" title={formatDOP(facturacionPeriodoVal)}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatDOP(facturacionPeriodoVal)}
              </h3>
            </div>
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-foreground-muted mt-1.5">
              Órdenes entregadas en el período
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-foreground-disabled truncate">
            {resumenGrafico.periodoTexto}
          </div>
        </div>

        {/* KPI 3: Monto Pendiente de Entrega (Snapshot) */}
        <div className="bg-card border border-warning/30 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-warning/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-warning font-bold uppercase tracking-wider block">
                MONTO PENDIENTE
              </span>
              <div className="p-1.5 bg-warning/15 border border-warning/30 rounded-lg text-warning group-hover:scale-110 transition-transform shrink-0">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-lg 2xl:text-xl font-black text-warning whitespace-nowrap" title={formatDOP(montoPendienteVal)}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-warning" /> : formatDOP(montoPendienteVal)}
              </h3>
            </div>
            <p className="text-[10px] text-warning font-mono mt-1.5 font-bold">
              {ordenesPendientesVal} órdenes pendientes
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[9.5px] font-mono text-foreground-disabled leading-tight">
            Total de órdenes aún no entregadas
          </div>
        </div>

        {/* KPI 4: Mecánicos Asignados (Snapshot) */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-info/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">
                MECÁNICOS ASIGNADOS
              </span>
              <div className="p-1.5 bg-info/15 border border-info/30 rounded-lg text-info group-hover:scale-110 transition-transform">
                <Zap size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-foreground">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-info" /> : mecanicosCarga.filter(m => m.servicios > 0).length}
              </h3>
              <span className="font-mono text-xs text-foreground-muted">de {mecanicosCarga.length}</span>
            </div>
            <p className="text-[10px] text-info font-mono font-bold mt-1.5">
              Servicios activos
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-foreground-disabled">
            Capacidad Asignada
          </div>
        </div>

        {/* KPI 5: Nuevos Clientes (Period) */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">
                NUEVOS CLIENTES
              </span>
              <div className="p-1.5 bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-foreground">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" /> : `+${nuevosClientesVal}`}
              </h3>
            </div>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-1.5">
              Registrados en período
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-foreground-disabled truncate">
            {resumenGrafico.periodoTexto}
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Flujo Operativo Diario (8 cols) */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[380px] max-h-[440px] transition-colors">
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
          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2 min-h-[190px]">
              <Loader2 className="w-5 h-5 animate-spin text-primary" /> Cargando datos del flujo operativo...
            </div>
          ) : weeklyData.length === 0 || !hasAnyActivity ? (
            <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled gap-2 min-h-[190px]">
              <BarChart3 size={28} className="text-foreground-disabled opacity-60" />
              <span>No se registraron ni entregaron órdenes en este período.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-[190px] relative flex flex-col justify-end pt-4 pb-1">
              
              {/* Horizontal Grid Lines & Y-Axis Labels */}
              <div className="absolute inset-x-0 inset-y-6 flex flex-col justify-between pointer-events-none pb-7">
                {distinctYTicks.map((tickVal, tIdx) => (
                  <div key={tIdx} className="w-full flex items-center gap-2">
                    <span className="text-[9px] font-mono text-foreground-disabled w-4 text-right shrink-0">
                      {tickVal}
                    </span>
                    <div className="border-t border-border/60 w-full h-0" />
                  </div>
                ))}
              </div>

              {/* Grouped Bars Container */}
              <div className="w-full h-40 flex items-end justify-around gap-2 pl-6 pr-2 z-10">
                {weeklyData.map((item, idx) => {
                  const regCount = item.ordenes_registradas || 0;
                  const entCount = item.ordenes_entregadas || 0;
                  
                  const regHeightPct = regCount > 0 ? Math.max(10, Math.round((regCount / yAxisMax) * 100)) : 0;
                  const entHeightPct = entCount > 0 ? Math.max(10, Math.round((entCount / yAxisMax) * 100)) : 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (regCount > 0 || entCount > 0) {
                          router.push(`/work-orders?from=${item.fecha}&to=${item.fecha}`);
                        }
                      }}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    >
                      {/* Tooltip (Hover) */}
                      {hoveredBarIndex === idx && (
                        <div className="absolute bottom-full mb-2 bg-surface-elevated border border-primary/60 p-3 rounded-xl shadow-2xl text-foreground font-mono text-xs z-50 min-w-[210px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <div className="font-bold border-b border-border pb-1 mb-1.5 text-primary flex justify-between">
                            <span>{item.label || item.etiqueta}</span>
                            <span className="text-foreground-muted text-[10px]">Ver órdenes →</span>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="text-foreground-muted flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-primary" /> Registradas:
                              </span>
                              <span className="font-bold text-primary">{regCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-foreground-muted flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-info" /> Entregadas:
                              </span>
                              <span className="font-bold text-info">{entCount}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-border/60 text-foreground-muted text-[10px]">
                              <span>Servicios completados:</span>
                              <span className="font-bold text-foreground">{item.servicios_realizados || 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dual Bars Pair */}
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32 pb-0.5">
                        {/* Bar 1: Registradas */}
                        <div className="flex flex-col items-center justify-end h-full">
                          {regCount > 0 && (
                            <span className="text-[9px] font-mono font-bold text-primary mb-0.5 animate-in fade-in">
                              {regCount}
                            </span>
                          )}
                          <div
                            style={{ height: `${regHeightPct}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-md transition-all duration-300 ${
                              regCount > 0
                                ? "bg-gradient-to-t from-primary/70 to-primary shadow-sm shadow-primary/20 group-hover:brightness-125"
                                : "h-0"
                            }`}
                          />
                        </div>

                        {/* Bar 2: Entregadas */}
                        <div className="flex flex-col items-center justify-end h-full">
                          {entCount > 0 && (
                            <span className="text-[9px] font-mono font-bold text-info mb-0.5 animate-in fade-in">
                              {entCount}
                            </span>
                          )}
                          <div
                            style={{ height: `${entHeightPct}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-md transition-all duration-300 ${
                              entCount > 0
                                ? "bg-gradient-to-t from-info/70 to-info shadow-sm shadow-info/20 group-hover:brightness-125"
                                : "h-0"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Date Label below bars */}
                      <span className="font-mono text-[10px] font-bold text-foreground-muted group-hover:text-foreground transition-colors mt-2 truncate max-w-full">
                        {weeklyData.length <= 10 ? item.etiqueta : item.day}
                      </span>
                    </div>
                  );
                })}
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
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[380px] max-h-[440px] transition-colors">
          <div className="border-b border-border pb-3 mb-3 shrink-0">
            <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
              <PieChart size={18} className="text-info" />
              Servicios Realizados
            </h3>
            <p className="text-foreground-muted font-mono text-xs mt-0.5">
              Trabajos ejecutados en el período ({resumenGrafico.periodoTexto})
            </p>
          </div>

          {loading ? (
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

      {/* Bottom Grid: Live Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table: Órdenes Recientes en Taller (7 cols) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
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
                    <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CÓDIGO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CLIENTE / VEHÍCULO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">SERVICIO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">ESTADO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">MECÁNICO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center font-mono text-xs text-foreground-muted">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-primary" />
                        Cargando órdenes de trabajo...
                      </td>
                    </tr>
                  ) : recentOrdersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center font-mono text-xs text-foreground-disabled">
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
                          <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                            {order.codigo}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground font-mono">{order.cliente}</span>
                              <span className="text-[11px] text-foreground-muted font-mono">{order.vehiculo}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-foreground-secondary text-[11px]">
                            {order.servicio}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9.5px] font-bold uppercase tracking-wider ${statusClass}`}>
                              {order.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-foreground-secondary whitespace-nowrap">
                            {order.mecanico}
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

        {/* Sidebar: Carga Mecánicos + Alertas Inventario (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Carga Mecánicos (Snapshot) */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                <Zap size={18} className="text-warning" />
                Carga Operativa de Mecánicos
              </h3>
              <span className="px-2 py-0.5 rounded bg-warning/15 border border-warning/30 text-warning font-mono text-[10px] font-bold">
                {mecanicosCarga.length} Técnicos
              </span>
            </div>

            {loading ? (
              <div className="py-6 text-center font-mono text-xs text-foreground-muted">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-warning" />
                Cargando mecánicos...
              </div>
            ) : mecanicosCarga.length === 0 ? (
              <p className="text-xs font-mono text-foreground-disabled py-4 text-center">
                No hay mecánicos registrados en esta empresa.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mecanicosCarga.map((mec) => (
                  <div
                    key={mec.id}
                    className="p-3 rounded-xl border border-border bg-surface-subtle font-mono hover:border-primary/40 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-foreground truncate max-w-[130px]" title={mec.nombre}>
                        {mec.nombre}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${mec.servicios > 0 ? 'bg-success/15 text-success border-success/30' : 'bg-surface text-foreground-muted border-border'}`}>
                        {mec.servicios > 0 ? `${mec.servicios} Activos` : 'Libre'}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground-muted">
                      {mec.servicios} servicio{mec.servicios === 1 ? '' : 's'} asignado{mec.servicios === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas de Stock Crítico Real (Snapshot) */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle size={18} className="text-error" />
                Alertas de Stock Crítico Real
              </h3>
              <button
                onClick={handleNavigateInventory}
                className="text-[10px] font-mono text-primary hover:underline font-bold cursor-pointer"
              >
                Inventario →
              </button>
            </div>

            {loading ? (
              <div className="py-6 text-center font-mono text-xs text-foreground-muted">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-error" />
                Cargando inventario...
              </div>
            ) : lowStockList.length === 0 ? (
              <p className="text-xs font-mono text-foreground-disabled py-4 text-center">
                Sin productos en stock crítico.
              </p>
            ) : (
              <div className="space-y-2.5">
                {lowStockList.map((item) => (
                  <div
                    key={item.id}
                    onClick={handleNavigateInventory}
                    className="p-3 bg-surface-subtle border border-border rounded-xl flex items-center justify-between font-mono hover:border-error/40 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground truncate max-w-[180px]">
                        {item.nombre}
                      </span>
                      <span className="text-[10px] text-foreground-muted">
                        Código: {item.codigo}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-error/15 text-error border border-error/30 text-[10px] font-bold block">
                        Stock: {item.stock} (mín: {item.minimo})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
