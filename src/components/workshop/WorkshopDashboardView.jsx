"use client";
import React, { useState, useEffect } from "react";
import {
  Wrench,
  Users,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Package,
  User,
  Phone,
  RefreshCw,
  Plus
} from "lucide-react";

export default function WorkshopDashboardView({ onNavigateList, onNavigateWorkOrders, onViewDetail, onOpenNewReception, onOpenNewOrder }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/taller/dashboard");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return;
        }
        setError(json.message || json.error || "Error al cargar el Panel Operativo.");
        return;
      }
      setDashboardData(json.data);
    } catch (err) {
      setError("No se pudieron obtener las métricas del taller.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
        <span className="text-xs font-mono">Cargando Panel Operativo...</span>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "No se pudieron obtener los datos del panel operativo."}</span>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-3 py-1 bg-rose-500/20 rounded-lg hover:bg-rose-500/30 font-mono text-xs"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const {
    ordenes_activas = 0,
    mecanicos_disponibles = "0/0",
    retrasos_criticos = 0,
    ingresos_semanales = 0,
    carga_mecanicos = [],
    acciones_urgentes = []
  } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-slate-400 font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-slate-200 transition-colors cursor-pointer">TALLER</span>
        <span>/</span>
        <span className="text-[#bfce7f] font-semibold">DASHBOARD</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight font-sans">
            Panel Operativo de Taller
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans">
            Monitoreo en tiempo real de carga de trabajo, mecánicos y alertas críticas del taller.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 border border-[#2d3748] rounded-xl text-slate-300 hover:text-white bg-[#161a21] hover:border-slate-600 transition-colors font-mono text-xs font-semibold tracking-wider uppercase"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            ACTUALIZAR
          </button>
          <button
            onClick={onOpenNewOrder || onOpenNewReception}
            className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold tracking-wider uppercase border-t border-[#a5b467] shadow-lg shadow-[#84924a]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            NUEVA ORDEN
          </button>
        </div>
      </div>

      {/* Stitch 4 Summary Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ÓRDENES ACTIVAS */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-6 hover:border-slate-600 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              ÓRDENES ACTIVAS
            </span>
            <div className="p-2 bg-[#1f201a] rounded-lg text-[#bfce7f] border border-[#2d3748]">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-100 font-mono">{ordenes_activas}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-mono font-semibold">
            <span>En curso / Recibidas</span>
          </div>
        </div>

        {/* Card 2: MECÁNICOS DISPONIBLES */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-6 hover:border-slate-600 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              MECÁNICOS DISPONIBLES
            </span>
            <div className="p-2 bg-[#1f201a] rounded-lg text-slate-300 border border-[#2d3748]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-100 font-mono">{mecanicos_disponibles}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-xs text-slate-400 font-semibold">Capacidad asignada</span>
          </div>
        </div>

        {/* Card 3: RETRASOS CRÍTICOS */}
        <div className="bg-[#161a21] border border-rose-500/40 rounded-xl p-6 hover:border-rose-500/60 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-xs font-bold text-rose-400 uppercase tracking-widest">
              RETRASOS CRÍTICOS
            </span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-rose-400 font-mono">{retrasos_criticos}</div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-400 font-mono font-semibold">
            <Clock className="w-4 h-4" />
            <span>Alta prioridad / Demoras</span>
          </div>
        </div>

        {/* Card 4: INGRESOS SEMANALES */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-6 hover:border-slate-600 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
              INGRESOS SEMANALES
            </span>
            <div className="p-2 bg-[#1f201a] rounded-lg text-[#bfce7f] border border-[#2d3748]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-100 font-mono">
            ${(ingresos_semanales / 1000).toFixed(1)}k
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 font-mono font-semibold">
            <span>Últimos 7 días</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout Area (2/3 Workload Chart + 1/3 Urgent Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Carga de Trabajo por Mecánico */}
        <div className="lg:col-span-2 bg-[#161a21] border border-[#2d3748] rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-4 border-b border-[#2d3748] mb-6">
            <h2 className="text-lg font-bold text-slate-100 font-sans">
              Carga de Trabajo por Mecánico
            </h2>
            <button
              onClick={onNavigateWorkOrders}
              className="text-xs font-mono text-[#bfce7f] hover:text-emerald-300 font-bold uppercase flex items-center gap-1 transition-colors"
            >
              Ver Detalles <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bar Chart Bars */}
          <div className="relative min-h-[260px] flex items-end justify-around gap-4 pt-6 pb-2">
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 opacity-20">
              <div className="border-t border-[#2d3748] w-full h-0"></div>
              <div className="border-t border-[#2d3748] w-full h-0"></div>
              <div className="border-t border-[#2d3748] w-full h-0"></div>
              <div className="border-t border-[#2d3748] w-full h-0"></div>
            </div>

            {/* Mechanics Bars */}
            {carga_mecanicos.map((mec) => (
              <div key={mec.id} className="w-16 md:w-20 flex flex-col items-center gap-2 z-10 group">
                <div className="w-full bg-[#0a0c10] h-56 rounded-t-lg border border-b-0 border-[#2d3748] relative overflow-hidden group-hover:border-slate-500 transition-colors flex items-end">
                  <div
                    className={`w-full ${mec.color} rounded-t-sm transition-all duration-500`}
                    style={{ height: `${mec.pct}%` }}
                    title={`${mec.nombre}: ${mec.ordenes} órdenes (${mec.pct}%)`}
                  ></div>
                </div>
                <span
                  className="font-mono text-xs font-bold text-slate-300 group-hover:text-[#bfce7f] transition-colors text-center truncate max-w-full px-1"
                  title={mec.nombre}
                >
                  {mec.nombre}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1/3: Acciones Urgentes */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#2d3748] mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-bold text-slate-100 font-sans">
              Acciones Urgentes
            </h2>
          </div>

          <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {acciones_urgentes.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#13140f] border-l-4 border-rose-500 p-4 rounded-r-xl border-y border-r border-[#2d3748] hover:border-slate-600 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-bold text-slate-200">{item.id}</span>
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${item.tipo_color}`}>
                    {item.tipo}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed font-sans">
                  {item.descripcion}
                </p>
                <div className="flex justify-between items-center pt-2 border-t border-[#2d3748]/60 text-[11px] font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" /> {item.ref}
                  </span>
                  <button
                    onClick={onNavigateWorkOrders}
                    className="text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider transition-colors"
                  >
                    {item.accion}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
