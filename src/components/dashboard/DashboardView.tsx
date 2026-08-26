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
  const ordenesActivasVal = dashboardData?.ordenesActivas ?? initialMetrics?.ordenesActivas ?? 0;
  const facturacionPeriodoVal = dashboardData?.facturacion_periodo ?? dashboardData?.facturacionPeriodo ?? initialMetrics?.ingresosDia ?? 0;
  const montoPendienteVal = dashboardData?.monto_pendiente_entrega ?? dashboardData?.montoPendienteEntrega ?? 0;
  const ordenesPendientesVal = dashboardData?.ordenes_pendientes_entrega ?? dashboardData?.ordenesPendientesEntrega ?? 0;
  const nuevosClientesVal = dashboardData?.nuevosClientesSemana ?? initialMetrics?.nuevosClientesSemana ?? 0;
  const ordenesEntregadasVal = dashboardData?.ordenesEntregadasPeriodo ?? 0;
  const desgloseEstados = dashboardData?.desgloseEstados || { enProceso: 0, recibidas: 0, listas: 0 };

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
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
                Dashboard General
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Datos actualizados
              </span>
            </div>
            <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
              Monitoreo operativo de órdenes de trabajo, facturación, clientes e inventario
            </p>
          </div>

          {/* Controls: Range Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchDashboard(rangeType, customFrom, customTo)}
              className="p-2 bg-[#0e1117] border border-[#2d3748] rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#bfce7f]' : ''}`} />
            </button>

            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-1 flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setRangeType("7d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "7d"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                7 días
              </button>
              <button
                onClick={() => setRangeType("14d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "14d"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                14 días
              </button>
              <button
                onClick={() => setRangeType("30d")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "30d"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                30 días
              </button>
              <button
                onClick={() => setRangeType("custom")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  rangeType === "custom"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Custom Range Inputs Bar (Appears when Personalizado is active) */}
        {rangeType === "custom" && (
          <div className="pt-3 border-t border-[#2d3748]/60 flex flex-wrap items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Calendar size={14} className="text-[#bfce7f]" /> Rango Personalizado:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">Desde:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-[#0e1117] border border-[#2d3748] rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:border-[#bfce7f] outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">Hasta:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-[#0e1117] border border-[#2d3748] rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:border-[#bfce7f] outline-none"
              />
            </div>
            <button
              onClick={handleApplyCustomRange}
              className="px-4 py-1.5 bg-[#bfce7f] text-[#1d1f18] rounded-lg font-bold hover:brightness-110 transition-all flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Filter size={13} /> Aplicar Rango
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboard(rangeType, customFrom, customTo)}
            className="px-3 py-1 bg-rose-500/20 rounded-lg hover:bg-rose-500/30 font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 6 Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Órdenes Activas (Snapshot) */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#bfce7f]/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ÓRDENES ACTIVAS
              </span>
              <div className="p-1.5 bg-[#bfce7f]/10 border border-[#bfce7f]/20 rounded-lg text-[#bfce7f] group-hover:scale-110 transition-transform">
                <Wrench size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-[#bfce7f]">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-[#bfce7f]" /> : ordenesActivasVal}
              </h3>
            </div>
            <p className="text-[9.5px] 2xl:text-[10px] text-slate-400 font-mono mt-1.5 leading-tight">
              {desgloseEstados.enProceso} en reparación • {desgloseEstados.recibidas} recibidas • {desgloseEstados.listas} listas para entrega
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[10px] font-mono text-slate-500">
            Estado Actual Taller
          </div>
        </div>

        {/* KPI 2: Facturación del Período (Period) */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                FACTURACIÓN PERÍODO
              </span>
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-lg 2xl:text-xl font-black text-white whitespace-nowrap" title={formatDOP(facturacionPeriodoVal)}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatDOP(facturacionPeriodoVal)}
              </h3>
            </div>
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-slate-400 mt-1.5">
              Órdenes entregadas en el período
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[10px] font-mono text-slate-500 truncate">
            {resumenGrafico.periodoTexto}
          </div>
        </div>

        {/* KPI 3: Monto Pendiente de Entrega (Snapshot) */}
        <div className="bg-[#161a21] border border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-amber-500/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                MONTO PENDIENTE
              </span>
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 group-hover:scale-110 transition-transform shrink-0">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-lg 2xl:text-xl font-black text-amber-300 whitespace-nowrap" title={formatDOP(montoPendienteVal)}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> : formatDOP(montoPendienteVal)}
              </h3>
            </div>
            <p className="text-[10px] text-amber-400/90 font-mono mt-1.5 font-bold">
              {ordenesPendientesVal} órdenes pendientes
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[9.5px] font-mono text-slate-500 leading-tight">
            Total de órdenes aún no entregadas
          </div>
        </div>

        {/* KPI 4: Órdenes Entregadas en el Período (Period) */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-emerald-400/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ÓRDENES ENTREGADAS
              </span>
              <div className="p-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-emerald-400">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : ordenesEntregadasVal}
              </h3>
            </div>
            <p className="text-[10px] text-emerald-400 font-mono mt-1.5 font-bold">
              Ciclos completados
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[10px] font-mono text-slate-500 truncate">
            {resumenGrafico.periodoTexto}
          </div>
        </div>

        {/* KPI 5: Mecánicos Asignados (Snapshot) */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-sky-500/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                MECÁNICOS ASIGNADOS
              </span>
              <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 group-hover:scale-110 transition-transform">
                <Zap size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-white">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-sky-400" /> : mecanicosCarga.filter(m => m.servicios > 0).length}
              </h3>
              <span className="font-mono text-xs text-slate-400">de {mecanicosCarga.length}</span>
            </div>
            <p className="text-[10px] text-sky-400 font-mono font-bold mt-1.5">
              Servicios activos
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[10px] font-mono text-slate-500">
            Capacidad Asignada
          </div>
        </div>

        {/* KPI 6: Nuevos Clientes (Period) */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                NUEVOS CLIENTES
              </span>
              <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="font-mono text-2xl 2xl:text-3xl font-black text-white">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-purple-400" /> : `+${nuevosClientesVal}`}
              </h3>
            </div>
            <p className="text-[10px] text-purple-400 font-mono mt-1.5">
              Registrados en período
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#2d3748]/60 text-[10px] font-mono text-slate-500 truncate">
            {resumenGrafico.periodoTexto}
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Flujo Operativo Diario (8 cols) */}
        <div className="lg:col-span-8 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col justify-between min-h-[380px] max-h-[440px]">
          {/* Header & Static Legend (No Toggle Buttons) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#2d3748] pb-3 mb-3 shrink-0">
            <div>
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-[#bfce7f]" />
                Flujo Operativo Diario
              </h3>
              <p className="text-slate-400 font-mono text-xs mt-0.5">
                Órdenes registradas y entregadas por día durante el período seleccionado
              </p>
            </div>

            {/* Static Non-Interactive Visual Legend */}
            <div className="flex items-center gap-4 text-xs font-mono shrink-0">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#bfce7f]" />
                Registradas
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                Entregadas
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization Area */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-400 gap-2 min-h-[190px]">
              <Loader2 className="w-5 h-5 animate-spin text-[#bfce7f]" /> Cargando datos del flujo operativo...
            </div>
          ) : weeklyData.length === 0 || !hasAnyActivity ? (
            <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2 min-h-[190px]">
              <BarChart3 size={28} className="text-slate-600 opacity-60" />
              <span>No se registraron ni entregaron órdenes en este período.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-[190px] relative flex flex-col justify-end pt-4 pb-1">
              
              {/* Horizontal Grid Lines & Y-Axis Labels */}
              <div className="absolute inset-x-0 inset-y-6 flex flex-col justify-between pointer-events-none pb-7">
                {distinctYTicks.map((tickVal, tIdx) => (
                  <div key={tIdx} className="w-full flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500 w-4 text-right shrink-0">
                      {tickVal}
                    </span>
                    <div className="border-t border-[#2d3748]/40 w-full h-0" />
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
                        <div className="absolute bottom-full mb-2 bg-[#090b0e] border border-[#bfce7f]/60 p-3 rounded-xl shadow-2xl text-white font-mono text-xs z-50 min-w-[210px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <div className="font-bold border-b border-[#2d3748] pb-1 mb-1.5 text-[#bfce7f] flex justify-between">
                            <span>{item.label || item.etiqueta}</span>
                            <span className="text-slate-400 text-[10px]">Ver órdenes →</span>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#bfce7f]" /> Registradas:
                              </span>
                              <span className="font-bold text-[#bfce7f]">{regCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-sky-400" /> Entregadas:
                              </span>
                              <span className="font-bold text-sky-400">{entCount}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-[#2d3748]/50 text-slate-400 text-[10px]">
                              <span>Servicios completados:</span>
                              <span className="font-bold text-slate-200">{item.servicios_realizados || 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dual Bars Pair */}
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32 pb-0.5">
                        {/* Bar 1: Registradas */}
                        <div className="flex flex-col items-center justify-end h-full">
                          {regCount > 0 && (
                            <span className="text-[9px] font-mono font-bold text-[#bfce7f] mb-0.5 animate-in fade-in">
                              {regCount}
                            </span>
                          )}
                          <div
                            style={{ height: `${regHeightPct}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-md transition-all duration-300 ${
                              regCount > 0
                                ? "bg-gradient-to-t from-[#7d8b44] to-[#bfce7f] shadow-sm shadow-[#bfce7f]/20 group-hover:brightness-125"
                                : "h-0"
                            }`}
                          />
                        </div>

                        {/* Bar 2: Entregadas */}
                        <div className="flex flex-col items-center justify-end h-full">
                          {entCount > 0 && (
                            <span className="text-[9px] font-mono font-bold text-sky-400 mb-0.5 animate-in fade-in">
                              {entCount}
                            </span>
                          )}
                          <div
                            style={{ height: `${entHeightPct}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-md transition-all duration-300 ${
                              entCount > 0
                                ? "bg-gradient-to-t from-sky-600 to-sky-400 shadow-sm shadow-sky-400/20 group-hover:brightness-125"
                                : "h-0"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Date Label below bars */}
                      <span className="font-mono text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors mt-2 truncate max-w-full">
                        {weeklyData.length <= 10 ? item.etiqueta : item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clean Resumen Inferior (4 Indicadores Propios del Comportamiento Diario) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 pt-3 mt-1 border-t border-[#2d3748]/60 font-mono text-xs shrink-0">
            {/* 1. Órdenes Registradas */}
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Órdenes Registradas</span>
              <span className="text-sm font-black text-[#bfce7f]">{totalRegistradasPeriodo} órdenes</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Ingresadas en el período</span>
            </div>

            {/* 2. Servicios Ejecutados */}
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Servicios Ejecutados</span>
              <span className="text-sm font-black text-[#38bdf8]">{totalServiciosPeriodo} trabajos</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Finalizados en el período</span>
            </div>

            {/* 3. Promedio Diario */}
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-center">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Promedio Diario</span>
              <span className="text-sm font-black text-sky-400">{Number(promedioDiarioVal).toFixed(1)} órdenes/día</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">Promedio de ingresos</span>
            </div>

            {/* 4. Día de Mayor Actividad */}
            <div className="bg-[#0e1117] border border-amber-500/20 rounded-xl p-2.5 text-center bg-amber-950/10">
              <span className="text-[9.5px] text-amber-400 font-bold uppercase block">Día de Mayor Actividad</span>
              <span className="text-sm font-black text-amber-300 truncate block" title={diaMayorActividadVal.etiqueta}>
                {diaMayorActividadVal.etiqueta}
              </span>
              <span className="text-[9px] text-amber-500/80 block truncate mt-0.5">
                {diaMayorActividadVal.cantidad > 0 ? `${diaMayorActividadVal.cantidad} órdenes registradas` : "Sin actividad"}
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Servicios Realizados en el Período (4 cols) */}
        <div className="lg:col-span-4 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col justify-between min-h-[380px] max-h-[440px]">
          <div className="border-b border-[#2d3748] pb-3 mb-3 shrink-0">
            <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
              <PieChart size={18} className="text-[#38bdf8]" />
              Servicios Realizados
            </h3>
            <p className="text-slate-400 font-mono text-xs mt-0.5">
              Trabajos ejecutados en el período ({resumenGrafico.periodoTexto})
            </p>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#38bdf8]" /> Cargando servicios...
            </div>
          ) : categoryBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-slate-500 text-center">
              No hay servicios registrados en este período.
            </div>
          ) : (
            <div className="space-y-3 py-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
              {categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="text-white font-bold flex items-center gap-2 truncate pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-slate-400 shrink-0">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-[#0e1117] h-2 rounded-full overflow-hidden border border-[#2d3748]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-400">
                    {cat.count}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 p-3 bg-[#13171f] border border-[#2d3748] rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-400">
              Servicios filtrados según el período seleccionado
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Live Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table: Órdenes Recientes en Taller (7 cols) */}
        <div className="lg:col-span-7 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
            <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-[#bfce7f]" />
              Órdenes de Trabajo Recientes
            </h3>
            <button
              onClick={handleNavigateWorkOrders}
              className="text-xs font-mono text-[#bfce7f] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              Ver todas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#0e1117]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2d3748] bg-[#161a21] select-none">
                    <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold uppercase tracking-wider">CÓDIGO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold uppercase tracking-wider">CLIENTE / VEHÍCULO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold uppercase tracking-wider">SERVICIO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold uppercase tracking-wider text-center">ESTADO</th>
                    <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold uppercase tracking-wider">MECÁNICO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center font-mono text-xs text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#bfce7f]" />
                        Cargando órdenes de trabajo...
                      </td>
                    </tr>
                  ) : recentOrdersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center font-mono text-xs text-slate-500">
                        No hay órdenes de trabajo registradas.
                      </td>
                    </tr>
                  ) : (
                    recentOrdersList.map((order) => {
                      const statusClass =
                        order.estado === "En Reparación" || order.estado === "EN PROCESO"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : order.estado === "Lista para Entrega"
                          ? "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/30"
                          : order.estado === "Entregada"
                          ? "bg-slate-500/15 text-slate-400 border-slate-500/30"
                          : "bg-sky-500/15 text-sky-400 border-sky-500/30";

                      return (
                        <tr
                          key={order.id}
                          onClick={() => router.push(`/work-orders?order_id=${order.id}`)}
                          className="hover:bg-[#1f242d] transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#bfce7f] whitespace-nowrap">
                            {order.codigo}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white font-mono">{order.cliente}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{order.vehiculo}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                            {order.servicio}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9.5px] font-bold uppercase tracking-wider ${statusClass}`}>
                              {order.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
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
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                Carga Operativa de Mecánicos
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                {mecanicosCarga.length} Técnicos
              </span>
            </div>

            {loading ? (
              <div className="py-6 text-center font-mono text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-amber-400" />
                Cargando mecánicos...
              </div>
            ) : mecanicosCarga.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-4 text-center">
                No hay mecánicos registrados en esta empresa.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mecanicosCarga.map((mec) => (
                  <div
                    key={mec.id}
                    className="p-3 rounded-xl border border-[#2d3748] bg-[#0e1117] font-mono hover:border-slate-500 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-white truncate max-w-[130px]" title={mec.nombre}>
                        {mec.nombre}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${mec.servicios > 0 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {mec.servicios > 0 ? `${mec.servicios} Activos` : 'Libre'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {mec.servicios} servicio{mec.servicios === 1 ? '' : 's'} asignado{mec.servicios === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas de Stock Crítico Real (Snapshot) */}
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400" />
                Alertas de Stock Crítico Real
              </h3>
              <button
                onClick={handleNavigateInventory}
                className="text-[10px] font-mono text-[#bfce7f] hover:underline font-bold cursor-pointer"
              >
                Inventario →
              </button>
            </div>

            {loading ? (
              <div className="py-6 text-center font-mono text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-rose-400" />
                Cargando inventario...
              </div>
            ) : lowStockList.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-4 text-center">
                Sin productos en stock crítico.
              </p>
            ) : (
              <div className="space-y-2.5">
                {lowStockList.map((item) => (
                  <div
                    key={item.id}
                    onClick={handleNavigateInventory}
                    className="p-3 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-center justify-between font-mono hover:border-rose-500/40 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white truncate max-w-[180px]">
                        {item.nombre}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Código: {item.codigo}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold block">
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
