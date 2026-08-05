"use client";

import React, { useState } from "react";
import {
  Wrench,
  DollarSign,
  Users,
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Calendar,
  ChevronRight,
  Package,
  ShieldCheck,
  Zap,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from "lucide-react";

interface DashboardMetrics {
  ordenesActivas: number;
  ingresosDia: number;
  nuevosClientesSemana: number;
  capacidad: { ocupadas: number; total: number };
  recentOrders?: Array<{
    id: string | number;
    codigo: string;
    cliente: string;
    vehiculo: string;
    servicio: string;
    estado: string;
    mecanico: string;
    tiempo: string;
  }>;
  lowStockItems?: Array<{
    id: string | number;
    codigo: string;
    nombre: string;
    stock: number;
    minimo: number;
  }>;
}

export default function DashboardView({ metrics }: { metrics: DashboardMetrics }) {
  const [timeRange, setTimeRange] = useState<"hoy" | "semana" | "mes">("semana");
  const [activeChartTab, setActiveChartTab] = useState<"ordenes" | "ingresos">("ordenes");

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(val);

  // Mock data for weekly trend chart
  const weeklyData = [
    { day: "Lun", ordenes: 5, ingresos: 18500 },
    { day: "Mar", ordenes: 8, ingresos: 29000 },
    { day: "Mié", ordenes: 12, ingresos: 42000 },
    { day: "Jue", ordenes: 9, ingresos: 31500 },
    { day: "Vie", ordenes: 15, ingresos: 58000 },
    { day: "Sáb", ordenes: 18, ingresos: 67500 },
    { day: "Dom", ordenes: 4, ingresos: 12000 },
  ];

  const maxOrdenes = Math.max(...weeklyData.map(d => d.ordenes));
  const maxIngresos = Math.max(...weeklyData.map(d => d.ingresos));

  // Service Category Breakdown
  const categoryBreakdown = [
    { name: "Mantenimiento Preventivo", percentage: 42, count: "38 servicios", color: "#bfce7f" },
    { name: "Motor & Transmisión", percentage: 28, count: "25 servicios", color: "#38bdf8" },
    { name: "Venta de Repuestos", percentage: 18, count: "16 ventas", color: "#f59e0b" },
    { name: "Ajuste & Detallado", percentage: 12, count: "11 servicios", color: "#a855f7" },
  ];

  // Workbays status mock
  const workbays = [
    { id: 1, name: "Estación #1 - Elevador Principal", status: "OCUPADA", mecanico: "Roberto Solís", orden: "OT-104" },
    { id: 2, name: "Estación #2 - Ajustes Rápidos", status: "OCUPADA", mecanico: "Carlos Méndez", orden: "OT-106" },
    { id: 3, name: "Estación #3 - Motor & Frenos", status: "LIBRE", mecanico: "Disponible", orden: "—" },
    { id: 4, name: "Estación #4 - Suspensión & Tuning", status: "OCUPADA", mecanico: "Marcos Peña", orden: "OT-108" },
    { id: 5, name: "Estación #5 - Detallado & Lavado", status: "OCUPADA", mecanico: "Luis Gómez", orden: "OT-109" },
    { id: 6, name: "Estación #6 - Diagnóstico Eléctrico", status: "LIBRE", mecanico: "Disponible", orden: "—" },
  ];

  const recentOrdersList = metrics.recentOrders && metrics.recentOrders.length > 0 ? metrics.recentOrders : [
    { id: 101, codigo: "OT-2026-088", cliente: "Juan Pérez", vehiculo: "Yamaha MT-07", servicio: "Mantenimiento General 10K", estado: "EN PROCESO", mecanico: "Roberto Solís", tiempo: "Hace 35 min" },
    { id: 102, codigo: "OT-2026-089", cliente: "Laura Torres", vehiculo: "Trek Fuel EX 8", servicio: "Purga de Frenos Hídraulicos", estado: "ESPERANDO REPUESTOS", mecanico: "Carlos Méndez", tiempo: "Hace 1 hora" },
    { id: 103, codigo: "OT-2026-090", cliente: "Mateo Núñez", vehiculo: "Honda CB650R", servicio: "Cambio de Kit de Arrastre", estado: "EN PROCESO", mecanico: "Marcos Peña", tiempo: "Hace 2 horas" },
    { id: 104, codigo: "OT-2026-091", cliente: "Ana Gómez", vehiculo: "Specialized Stumpjumper", servicio: "Ajuste de Transmisión 12v", estado: "LISTA PARA ENTREGA", mecanico: "Luis Gómez", tiempo: "Hace 3 horas" },
    { id: 105, codigo: "OT-2026-092", cliente: "Carlos Ruiz", vehiculo: "Kawasaki Z900", servicio: "Diagnóstico Inyección", estado: "DIAGNÓSTICO", mecanico: "Roberto Solís", tiempo: "Hace 4 horas" }
  ];

  const lowStockList = metrics.lowStockItems && metrics.lowStockItems.length > 0 ? metrics.lowStockItems : [
    { id: 1, codigo: "REP-044", nombre: "Pastillas de Freno Shimano Deore XT", stock: 2, minimo: 10 },
    { id: 2, codigo: "REP-089", nombre: "Cadena KMC X11 11v Gold", stock: 1, minimo: 5 },
    { id: 3, codigo: "REP-102", nombre: "Aceite Mineral Motul 7100 4T 10W40", stock: 3, minimo: 12 },
    { id: 4, codigo: "REP-156", nombre: "Líquido de Frenos DOT 5.1 Motorex", stock: 2, minimo: 8 }
  ];

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
              Dashboard General
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Taller 100% Operativo
            </span>
          </div>
          <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
            Monitoreo en tiempo real del taller, ordenes de trabajo, ingresos y capacidad instalada
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-1 flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => setTimeRange("hoy")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeRange === "hoy"
                  ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeRange("semana")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeRange === "semana"
                  ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setTimeRange("mes")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeRange === "mes"
                  ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Este Mes
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Órdenes Activas */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-[#bfce7f]/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                Órdenes Activas
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="font-mono text-3xl font-black text-[#bfce7f]">
                  {metrics.ordenesActivas || 8}
                </h3>
                <span className="inline-flex items-center gap-0.5 font-mono text-xs font-bold text-emerald-400">
                  <ArrowUpRight size={14} /> +12.5%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-2">
                4 en proceso • 2 en espera • 2 listas
              </p>
            </div>
            <div className="p-3 bg-[#bfce7f]/10 border border-[#bfce7f]/20 rounded-xl text-[#bfce7f] group-hover:scale-110 transition-transform">
              <Wrench size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Tiempo prom. reparación:</span>
            <span className="text-white font-bold">2.4 horas</span>
          </div>
        </div>

        {/* KPI 2: Ingresos del Día */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                Ingresos del Día
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="font-mono text-2xl lg:text-3xl font-black text-white">
                  {formatMoney(metrics.ingresosDia || 34500)}
                </h3>
              </div>
              <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-bold text-emerald-400 mt-2">
                <ArrowUpRight size={14} /> +8.4% vs ayer
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
              <DollarSign size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
              <span>Meta diaria (RD$ 40,000)</span>
              <span className="text-emerald-400 font-bold">86%</span>
            </div>
            <div className="w-full bg-[#0e1117] h-1.5 rounded-full overflow-hidden border border-[#2d3748]">
              <div className="bg-emerald-400 h-full rounded-full w-[86%]" />
            </div>
          </div>
        </div>

        {/* KPI 3: Capacidad del Taller */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-sky-500/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                Capacidad del Taller
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="font-mono text-3xl font-black text-white">
                  {Math.round((metrics.capacidad.ocupadas / metrics.capacidad.total) * 100)}%
                </h3>
              </div>
              <p className="text-[11px] text-sky-400 font-mono font-bold mt-2">
                {metrics.capacidad.ocupadas} de {metrics.capacidad.total} Estaciones Ocupadas
              </p>
            </div>

            {/* Circular Progress Ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="28" cy="28" r="23" fill="transparent" stroke="#2d3748" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="23"
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="5"
                  strokeDasharray="144"
                  strokeDashoffset={144 - (144 * metrics.capacidad.ocupadas) / metrics.capacidad.total}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sky-400">
                <Activity size={18} />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Disponibilidad inmediata:</span>
            <span className="text-sky-400 font-bold">2 bahías libres</span>
          </div>
        </div>

        {/* KPI 4: Nuevos Clientes & Fidelización */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                Nuevos Clientes
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="font-mono text-3xl font-black text-white">
                  +{metrics.nuevosClientesSemana || 5}
                </h3>
                <span className="inline-flex items-center gap-0.5 font-mono text-xs font-bold text-purple-400">
                  esta semana
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-2 flex items-center gap-1">
                <span>Rating Satisfacción:</span>
                <span className="text-amber-400 font-bold">4.9 ★</span>
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
              <Users size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Clientes recurrentes:</span>
            <span className="text-purple-400 font-bold">84% tasa retorno</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Flujo Semanal de Operaciones & Ingresos (8 cols) */}
        <div className="lg:col-span-8 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#2d3748] pb-4 mb-6">
            <div>
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-[#bfce7f]" />
                Flujo Operativo Semanal
              </h3>
              <p className="text-slate-400 font-mono text-xs mt-0.5">
                Volumen de órdenes completadas e ingresos por día de la semana
              </p>
            </div>

            <div className="flex items-center bg-[#0e1117] border border-[#2d3748] rounded-xl p-1 text-xs font-mono">
              <button
                onClick={() => setActiveChartTab("ordenes")}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  activeChartTab === "ordenes"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Órdenes Taller
              </button>
              <button
                onClick={() => setActiveChartTab("ingresos")}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  activeChartTab === "ingresos"
                    ? "bg-[#bfce7f] text-[#1d1f18] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Ingresos (RD$)
              </button>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-[#2d3748]/60">
            {weeklyData.map((item, idx) => {
              const val = activeChartTab === "ordenes" ? item.ordenes : item.ingresos;
              const maxVal = activeChartTab === "ordenes" ? maxOrdenes : maxIngresos;
              const heightPercent = Math.max(15, Math.round((val / maxVal) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-10 bg-[#0e1117] border border-[#bfce7f]/40 px-2.5 py-1 rounded-lg text-white font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10 whitespace-nowrap">
                    {activeChartTab === "ordenes"
                      ? `${item.ordenes} Órdenes`
                      : formatMoney(item.ingresos)}
                  </div>

                  {/* Bar Visual */}
                  <div className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl h-full flex items-end overflow-hidden p-1">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-lg transition-all duration-500 group-hover:brightness-125 ${
                        activeChartTab === "ordenes"
                          ? "bg-gradient-to-t from-[#89974f] to-[#bfce7f]"
                          : "bg-gradient-to-t from-emerald-600 to-emerald-400"
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chart Footer Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 mt-2">
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-center">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase block">Total Semanal</span>
              <span className="font-mono text-sm font-bold text-white">71 Órdenes</span>
            </div>
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-center">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase block">Promedio Diario</span>
              <span className="font-mono text-sm font-bold text-[#bfce7f]">10.1 Órdenes/día</span>
            </div>
            <div className="bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-center">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase block">Día Pico</span>
              <span className="font-mono text-sm font-bold text-emerald-400">Sábado (18 Órdenes)</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Distribución por Categoria de Servicio (4 cols) */}
        <div className="lg:col-span-4 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="border-b border-[#2d3748] pb-4 mb-4">
            <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
              <PieChart size={18} className="text-[#38bdf8]" />
              Categorías de Servicio
            </h3>
            <p className="text-slate-400 font-mono text-xs mt-0.5">
              Distribución porcentual de los servicios ejecutados
            </p>
          </div>

          {/* Donut Visual Breakdown List */}
          <div className="space-y-4 py-2">
            {categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center font-mono text-xs">
                  <span className="text-white font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </span>
                  <span className="text-slate-400">{cat.percentage}%</span>
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

          {/* Banner Box */}
          <div className="mt-4 p-3.5 bg-[#bfce7f]/10 border border-[#bfce7f]/30 rounded-xl flex items-center gap-3">
            <Sparkles size={20} className="text-[#bfce7f] shrink-0" />
            <p className="text-[11px] font-mono text-slate-300 leading-tight">
              Los servicios de <strong className="text-[#bfce7f]">Mantenimiento Preventivo</strong> representan el mayor volumen operativo de la semana.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Live Orders & Stock Alerts (7 cols + 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table: Órdenes en Curso (7 cols) */}
        <div className="lg:col-span-7 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
            <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-[#bfce7f]" />
              Órdenes de Trabajo Recientes en Taller
            </h3>
            <span className="text-xs font-mono text-[#bfce7f] font-bold">
              Ver todas →
            </span>
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
                  {recentOrdersList.map((order) => {
                    const statusClass =
                      order.estado === "EN PROCESO"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : order.estado === "LISTA PARA ENTREGA"
                        ? "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/30"
                        : order.estado === "ESPERANDO REPUESTOS"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-sky-500/15 text-sky-400 border-sky-500/30";

                    return (
                      <tr key={order.id} className="hover:bg-[#1f242d] transition-colors">
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Cards: Estaciones + Stock Crítico (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Estaciones de Trabajo Status */}
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                Estaciones de Trabajo en Taller
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                6/8 Ocupadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workbays.map((bay) => (
                <div
                  key={bay.id}
                  className={`p-3 rounded-xl border font-mono transition-all ${
                    bay.status === "OCUPADA"
                      ? "bg-[#0e1117] border-[#2d3748] hover:border-emerald-500/40"
                      : "bg-[#0e1117]/60 border-[#2d3748]/50 text-slate-500"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-white truncate max-w-[140px]">
                      {bay.name.split(" - ")[0]}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        bay.status === "OCUPADA"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {bay.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {bay.mecanico}
                  </p>
                  {bay.orden !== "—" && (
                    <span className="text-[9.5px] text-[#bfce7f] font-bold block mt-1">
                      {bay.orden}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Alertas de Stock Crítico */}
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400" />
                Alertas de Inventario Crítico
              </h3>
              <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-bold">
                {lowStockList.length} Repuestos
              </span>
            </div>

            <div className="space-y-2.5">
              {lowStockList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-center justify-between font-mono hover:border-rose-500/40 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">
                      {item.nombre}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Código: {item.codigo}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold block">
                      {item.stock} en stock (mín: {item.minimo})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
