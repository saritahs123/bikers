"use client";
import React, { useState, useEffect } from "react";
import { Wrench, Calendar, ClipboardList, CheckCircle2, Clock, Eye, AlertCircle, Loader2, ArrowUpRight } from "lucide-react";

export default function WorkshopDashboardView({ onNavigateList, onViewDetail }) {
  const [data, setData] = useState(null);
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
        throw new Error(json.message || json.error || "Error al cargar el panel operativo.");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message || "No se pudo obtener la información del panel.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm text-slate-400">Cargando Panel Operativo de Taller...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "No se pudieron obtener las métricas del taller."}</span>
        </div>
        <button onClick={fetchDashboard} className="px-3 py-1 bg-rose-500/20 rounded-lg hover:bg-rose-500/30">
          Reintentar
        </button>
      </div>
    );
  }

  const kpis = [
    {
      title: "Recepciones Hoy",
      value: data.recepciones_hoy,
      icon: Calendar,
      color: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
      description: "Bicicletas ingresadas en la fecha actual"
    },
    {
      title: "Órdenes de Trabajo Activas",
      value: data.ordenes_activas,
      icon: Wrench,
      color: "from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30",
      description: "Unidades actualmente en mantenimiento"
    },
    {
      title: "Pendientes de Aprobación",
      value: data.pendientes_aprobacion,
      icon: Clock,
      color: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30",
      description: "Presupuestos esperando confirmación"
    },
    {
      title: "Entregas Programadas Hoy",
      value: data.entregas_programadas_hoy,
      icon: CheckCircle2,
      color: "from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/30",
      description: "Órdenes listas para salida al cliente"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl border bg-gradient-to-br ${kpi.color} shadow-lg transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{kpi.title}</span>
                <Icon className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-3xl font-extrabold text-slate-100 mt-3 font-mono">{kpi.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{kpi.description}</p>
            </div>
          );
        })}
      </div>

      {/* Recepciones Recientes Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              Recepciones Recientes
            </h3>
            <p className="text-xs text-slate-400">Últimos ingresos registrados en el taller.</p>
          </div>
          <button
            onClick={onNavigateList}
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Ver Todas <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="pb-3">Código</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Bicicleta</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Fecha</th>
                <th className="pb-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.recepciones_recientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No hay recepciones recientes registradas hoy.
                  </td>
                </tr>
              ) : (
                data.recepciones_recientes.map((r) => (
                  <tr key={r.recepcion_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {r.codigo_recepcion}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-slate-200">{r.cliente_nombre}</td>
                    <td className="py-3 text-slate-300">{r.bicicleta_resumen}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-[11px] bg-slate-800 text-slate-300 rounded font-medium">
                        {r.estado_nombre}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(r.fecha_recepcion).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onViewDetail(r.recepcion_id)}
                        className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Ver Detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
