"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Users,
  AlertTriangle,
  DollarSign,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  User,
  RefreshCw,
  CheckCircle2,
  Activity,
  AlertOctagon,
  Info
} from "lucide-react";

export default function WorkshopDashboardView({
  onNavigateList,
  onNavigateWorkOrders,
  onViewDetail,
  onViewOrderDetail
}) {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
        setError(json.message || json.error || "No fue posible actualizar el panel operativo.");
        return;
      }
      setDashboardData(json.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError("No fue posible actualizar el panel operativo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleReviewOrder = (ordenId) => {
    if (onViewOrderDetail) {
      onViewOrderDetail(ordenId);
    } else {
      router.push(`/workshop?view=work_orders&order_id=${ordenId}`);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-2xl text-slate-400 gap-4 shadow-xl">
        <Loader2 className="w-10 h-10 animate-spin text-[#bfce7f]" />
        <div className="text-center">
          <h3 className="text-slate-200 font-bold text-sm font-sans mb-1">Cargando Panel Operativo</h3>
          <p className="text-xs text-slate-500 font-mono">Consultando métricas en tiempo real de PostgreSQL...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <AlertCircle className="w-7 h-7 shrink-0 text-rose-400" />
          <div>
            <h3 className="font-bold text-sm font-sans text-rose-200">Error al consultar el panel operativo</h3>
            <p className="text-xs font-mono text-rose-300/80 mt-0.5">
              {error || "No fue posible actualizar el panel operativo."}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchDashboard(false)}
          disabled={loading || refreshing}
          className="px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-rose-200 font-mono text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const {
    metricas = {
      ordenes_activas: 0,
      recibidas: 0,
      en_reparacion: 0,
      listas_entrega: 0,
      mecanicos_disponibles: 0,
      mecanicos_totales: 0,
      mecanicos_str: "0 / 0",
      retrasos_criticos: 0,
      monto_semanal: 0,
      tipo_monto: "FACTURACION"
    },
    carga_mecanicos = [],
    acciones_urgentes = []
  } = dashboardData;

  // Compute maximum orders for workload relative scaling
  const maxAssignedOrders = Math.max(
    ...carga_mecanicos.map((m) => Number(m.ordenes_activas || 0)),
    3
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-slate-400 font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-slate-200 transition-colors cursor-pointer">TALLER</span>
        <span>/</span>
        <span className="text-[#bfce7f] font-semibold">PANEL OPERATIVO</span>
      </div>

      {/* Header with Title and Single ACTUALIZAR Button */}
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
          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
              Actualizado: {lastUpdated.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-[#2d3748] rounded-xl text-slate-200 hover:text-white bg-[#161a21] hover:border-slate-500 active:scale-95 transition-all font-mono text-xs font-semibold tracking-wider uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            title="Refrescar métricas del taller"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#bfce7f] ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "ACTUALIZANDO..." : "ACTUALIZAR"}
          </button>
        </div>
      </div>

      {/* 4 Summary Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ÓRDENES ACTIVAS */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 hover:border-slate-500/60 transition-all relative overflow-hidden group shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                ÓRDENES ACTIVAS
              </span>
              <div className="p-2 bg-[#1f201a] rounded-xl text-[#bfce7f] border border-[#2d3748]">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-4xl font-extrabold text-slate-100 font-mono tracking-tight">
              {metricas.ordenes_activas ?? 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400 font-sans leading-tight">
              Recibidas, en reparación o listas para entrega
            </span>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 flex-wrap font-medium">
              <span className="text-slate-300">Recibidas: <strong className="text-white">{metricas.recibidas ?? 0}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">Reparación: <strong className="text-[#bfce7f]">{metricas.en_reparacion ?? 0}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">Listas: <strong className="text-cyan-400">{metricas.listas_entrega ?? 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: MECÁNICOS DISPONIBLES */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 hover:border-slate-500/60 transition-all relative overflow-hidden group shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                MECÁNICOS DISPONIBLES
              </span>
              <div className="p-2 bg-[#121c24] rounded-xl text-sky-400 border border-[#2d3748]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-4xl font-extrabold text-slate-100 font-mono tracking-tight">
              {metricas.mecanicos_str || `${metricas.mecanicos_disponibles ?? 0} / ${metricas.mecanicos_totales ?? 0}`}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex flex-col gap-1">
            <span className="text-[11px] text-slate-400 font-sans leading-tight">
              Disponibles actualmente
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {metricas.mecanicos_totales > 0
                ? `${Math.max(0, metricas.mecanicos_totales - metricas.mecanicos_disponibles)} ocupados en reparación`
                : "Sin personal técnico configurado"}
            </span>
          </div>
        </div>

        {/* Card 3: RETRASOS CRÍTICOS */}
        <div className={`bg-[#161a21] border rounded-2xl p-5 transition-all relative overflow-hidden group shadow-lg flex flex-col justify-between ${
          (metricas.retrasos_criticos || 0) > 0
            ? "border-rose-500/40 hover:border-rose-500/70"
            : "border-[#2d3748] hover:border-slate-500/60"
        }`}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className={`font-mono text-xs font-bold uppercase tracking-widest ${
                (metricas.retrasos_criticos || 0) > 0 ? "text-rose-400" : "text-slate-400"
              }`}>
                RETRASOS CRÍTICOS
              </span>
              <div className={`p-2 rounded-xl border ${
                (metricas.retrasos_criticos || 0) > 0
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-[#1f201a] text-slate-400 border-[#2d3748]"
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-4xl font-extrabold font-mono tracking-tight ${
              (metricas.retrasos_criticos || 0) > 0 ? "text-rose-400" : "text-slate-100"
            }`}>
              {metricas.retrasos_criticos ?? 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 flex items-center gap-1.5 text-[11px] font-sans text-slate-400">
            <Clock className="w-3.5 h-3.5 shrink-0 text-rose-400/80" />
            <span>Órdenes vencidas de alta prioridad</span>
          </div>
        </div>

        {/* Card 4: FACTURACIÓN SEMANAL */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 hover:border-slate-500/60 transition-all relative overflow-hidden group shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                FACTURACIÓN SEMANAL
              </span>
              <div className="p-2 bg-[#1f201a] rounded-xl text-[#bfce7f] border border-[#2d3748]">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-100 font-mono tracking-tight truncate" title={`RD$ ${Number(metricas.monto_semanal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              RD$ {Number(metricas.monto_semanal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2d3748]/60 text-[11px] text-slate-400 font-sans leading-tight">
            Total de órdenes entregadas en los últimos 7 días
          </div>
        </div>
      </div>

      {/* Main Grid: Carga de Trabajo (2/3) + Acciones Urgentes (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Carga de Trabajo por Mecánico */}
        <div className="lg:col-span-2 bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center pb-4 border-b border-[#2d3748] mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-sans">
                Carga de Trabajo por Mecánico
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Órdenes activas asignadas
              </p>
            </div>
            <button
              onClick={onNavigateWorkOrders}
              className="text-xs font-mono text-[#bfce7f] hover:text-white font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer bg-[#1f201a] px-3 py-1.5 rounded-lg border border-[#2d3748]"
            >
              VER DETALLES <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bar Chart Bars */}
          {carga_mecanicos.length === 0 ? (
            <div className="min-h-[260px] flex flex-col items-center justify-center text-slate-500 text-xs font-mono gap-2">
              <Users className="w-8 h-8 opacity-40" />
              <span>No hay mecánicos registrados en la empresa.</span>
            </div>
          ) : (
            <div className="relative min-h-[260px] flex items-end justify-around gap-4 pt-6 pb-2">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-10 opacity-20">
                <div className="border-t border-[#2d3748] w-full h-0"></div>
                <div className="border-t border-[#2d3748] w-full h-0"></div>
                <div className="border-t border-[#2d3748] w-full h-0"></div>
                <div className="border-t border-[#2d3748] w-full h-0"></div>
              </div>

              {/* Dynamic Real Mechanics Bars */}
              {carga_mecanicos.map((mec) => {
                const assigned = Number(mec.ordenes_activas || 0);
                const barHeightPct = Math.max(
                  8,
                  Math.round((assigned / maxAssignedOrders) * 100)
                );
                const hasOrders = assigned > 0;

                return (
                  <div key={mec.usuario_id} className="w-20 md:w-28 flex flex-col items-center gap-2.5 z-10 group">
                    {/* Value Badge above bar */}
                    <div className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-white transition-colors">
                      {assigned} {assigned === 1 ? "orden" : "órdenes"}
                    </div>

                    {/* Bar Container */}
                    <div className="w-full bg-[#0a0c10] h-52 rounded-t-xl border border-b-0 border-[#2d3748] relative overflow-hidden group-hover:border-slate-500 transition-colors flex items-end p-1">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          hasOrders
                            ? "bg-gradient-to-t from-[#84924a] to-[#bfce7f] shadow-lg shadow-[#bfce7f]/10"
                            : "bg-slate-800/60"
                        }`}
                        style={{ height: `${hasOrders ? barHeightPct : 6}%` }}
                        title={`${mec.nombre}: ${assigned} órdenes activas`}
                      ></div>
                    </div>

                    {/* Label */}
                    <div className="text-center w-full px-1">
                      <span
                        className="font-mono text-xs font-bold text-slate-200 group-hover:text-[#bfce7f] transition-colors block truncate"
                        title={mec.nombre}
                      >
                        {mec.nombre}
                      </span>
                      <span
                        className="font-sans text-[10px] text-slate-400 block truncate"
                        title={mec.cargo}
                      >
                        {mec.cargo}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1/3: Acciones Urgentes */}
        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#2d3748] mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-bold text-slate-100 font-sans">
                Acciones Urgentes
              </h2>
            </div>

            <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
              {acciones_urgentes.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-center gap-2.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/80" />
                  <span className="text-xs font-mono font-medium text-slate-300">
                    No hay acciones urgentes en este momento.
                  </span>
                  <p className="text-[11px] text-slate-400 max-w-xs font-sans">
                    Todas las órdenes activas marchan dentro del cronograma esperado.
                  </p>
                </div>
              ) : (
                acciones_urgentes.map((item) => {
                  const isCritico = item.nivel === "CRITICO";
                  const isAlerta = item.nivel === "ALERTA";

                  return (
                    <div
                      key={item.orden_id}
                      className={`p-4 rounded-xl border transition-all ${
                        isCritico
                          ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70"
                          : isAlerta
                          ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70"
                          : "bg-[#13140f] border-[#2d3748] hover:border-slate-500/60"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className="font-mono text-xs font-extrabold text-slate-100 tracking-wide">
                          {item.codigo_orden}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                            isCritico
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : isAlerta
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                          }`}
                        >
                          {item.nivel}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 mb-2 leading-relaxed font-sans font-medium">
                        {item.motivo}
                      </p>

                      <div className="text-[11px] text-slate-400 font-sans mb-3 truncate" title={`${item.cliente} • ${item.bicicleta}`}>
                        <strong className="text-slate-300">{item.cliente}</strong> • {item.bicicleta}
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-[#2d3748]/60 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[10px] uppercase font-bold text-slate-300 bg-[#1f201a] px-2 py-0.5 rounded border border-[#2d3748]">
                            {item.estado}
                          </span>
                        </div>
                        <button
                          onClick={() => handleReviewOrder(item.orden_id)}
                          className="text-[#bfce7f] hover:text-emerald-300 font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                        >
                          REVISAR <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
