"use client";
import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Wrench,
  Clock,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import NewReceptionModal from "./NewReceptionModal";
import ReceptionDetailView from "./ReceptionDetailView";

export default function ReceptionsListView({ onViewDetail }) {
  const [recepciones, setRecepciones] = useState([]);
  const [metrics, setMetrics] = useState({
    recepciones_hoy: 0,
    recepciones_pendientes: 0,
    convertidas_ot: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Modals & Internal Detail Navigation
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRecepcionId, setSelectedRecepcionId] = useState(null);

  useEffect(() => {
    fetchRecepciones();
  }, [page, search]);

  const fetchRecepciones = async () => {
    setLoading(true);
    setError("");
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      });
      if (search.trim()) queryParams.set("search", search.trim());

      const res = await fetch(`/api/taller/recepciones?${queryParams.toString()}`);
      if (res.status === 401) {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return;
      }
      let json = null;
      try {
        json = await res.json();
      } catch {
        throw new Error(res.ok ? "Respuesta inválida del servidor." : `Error del servidor (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Error al cargar listado de recepciones.");
      }

      setRecepciones(json.data || []);
      setPagination(json.pagination || { total: 0, totalPages: 1 });
      if (json.metricas) {
        setMetrics({
          recepciones_hoy: json.metricas.recepciones_hoy || 0,
          recepciones_pendientes: json.metricas.recepciones_pendientes || 0,
          convertidas_ot: json.metricas.convertidas_ot || 0
        });
      }
    } catch (err) {
      console.error("fetchRecepciones Error:", err);
      setError(err.message || "No se pudo obtener el listado de recepciones.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (id) => {
    if (onViewDetail) {
      onViewDetail(id);
    } else {
      setSelectedRecepcionId(id);
    }
  };

  if (selectedRecepcionId && !onViewDetail) {
    return (
      <ReceptionDetailView
        recepcionId={selectedRecepcionId}
        onBack={() => setSelectedRecepcionId(null)}
      />
    );
  }

  const kpis = [
    {
      title: "Recepciones Hoy",
      value: metrics.recepciones_hoy,
      icon: Calendar,
      color: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
      description: "Bicicletas ingresadas durante el día de hoy"
    },
    {
      title: "Recepciones Pendientes",
      value: metrics.recepciones_pendientes,
      icon: Clock,
      color: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30",
      description: "Ingresos pendientes de completar o convertir en OT"
    },
    {
      title: "Convertidas a OT",
      value: metrics.convertidas_ot,
      icon: Wrench,
      color: "from-[#bfce7f]/20 to-[#bfce7f]/5 text-[#bfce7f] border-[#bfce7f]/30",
      description: "Recepciones que generaron una orden de trabajo"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-slate-400 font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-slate-200 transition-colors cursor-pointer">TALLER</span>
        <span>/</span>
        <span className="text-[#bfce7f] font-semibold">RECEPCIONES</span>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight font-sans">
            Recepciones de Taller
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans">
            Gestión de ingresos, inspección física, checklists y registro de firma digital.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold tracking-wider uppercase border-t border-[#a5b467] shadow-lg shadow-[#84924a]/20"
        >
          <Plus className="w-4 h-4" />
          NUEVA RECEPCIÓN
        </button>
      </div>

      {/* KPI Cards Grid (Recovered from Original Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Search & Refresh Toolbar */}
      <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, cliente o bicicleta..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-[#bfce7f] outline-none"
          />
        </div>

        <button
          onClick={fetchRecepciones}
          className="p-2.5 bg-[#0a0c10] border border-[#2d3748] text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Actualizar listado"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Receptions Data Table */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#bfce7f]" />
          <span className="text-xs font-mono">Cargando recepciones...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchRecepciones}
            className="px-3 py-1 bg-rose-500/20 rounded-lg hover:bg-rose-500/30 font-mono text-xs"
          >
            Reintentar
          </button>
        </div>
      ) : recepciones.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-center gap-3">
          <ClipboardList className="w-10 h-10 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-300">No se encontraron recepciones</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Registra una nueva recepción de bicicleta para iniciar el proceso de taller.
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="mt-2 px-4 py-2 bg-[#84924a] text-white text-xs font-mono font-bold rounded-xl hover:brightness-110"
          >
            NUEVA RECEPCIÓN
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[#161a21] border border-[#2d3748] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1c2129] border-b border-[#2d3748] font-mono text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="p-4 whitespace-nowrap">Código</th>
                  <th className="p-4 whitespace-nowrap">Cliente</th>
                  <th className="p-4 whitespace-nowrap">Bicicleta</th>
                  <th className="p-4 whitespace-nowrap">Estado</th>
                  <th className="p-4 whitespace-nowrap text-right">Presupuesto</th>
                  <th className="p-4 whitespace-nowrap">Fecha</th>
                  <th className="p-4 whitespace-nowrap text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3748]">
                {recepciones.map((r) => {
                  const clienteNombre = r.cliente?.nombre_completo || r.cliente_nombre || (typeof r.cliente === 'string' ? r.cliente : "Cliente General");
                  const bicicletaResumen = r.bicicleta?.resumen || r.bicicleta_resumen || (typeof r.bicicleta === 'string' ? r.bicicleta : "Bicicleta");
                  const estadoNombre = r.estado?.nombre || r.estado_nombre || "INGRESADO";

                  return (
                    <tr key={r.recepcion_id} className="hover:bg-[#1c2129] transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-extrabold text-[#bfce7f] bg-[#bfce7f]/10 px-2 py-0.5 rounded border border-[#bfce7f]/20">
                          {r.codigo_recepcion}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-200">{clienteNombre}</td>
                      <td className="p-4 text-slate-300">{bicicletaResumen}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {estadoNombre}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-100">
                        RD$ {parseFloat(r.presupuesto_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 text-slate-400 font-mono">
                        {new Date(r.fecha_recepcion).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenDetail(r.recepcion_id)}
                          className="p-1.5 text-slate-400 hover:text-[#bfce7f] hover:bg-slate-800 rounded-lg transition-colors"
                          title="Ver Detalle de Recepción"
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

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-400 font-mono">
            <span>
              Mostrando {recepciones.length > 0 ? (page - 1) * 10 + 1 : 0}-{Math.min(page * 10, pagination.total)} de {pagination.total} recepciones
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
              <span className="px-2">Página {page} de {pagination.totalPages || 1}</span>
              <button
                disabled={page >= pagination.totalPages}
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

      {/* New Reception Modal */}
      <NewReceptionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(createdReception) => {
          setIsNewModalOpen(false);
          const hasOT = Boolean(
            createdReception?.orden_trabajo_id ||
            createdReception?.data?.orden_trabajo_id ||
            createdReception?.generar_orden_trabajo
          );
          fetchRecepciones();
          fetchDashboardMetrics();
          if (!hasOT) {
            showToast("Recepción creada exitosamente.", "success");
          }
        }}
        onCreated={(createdReception) => {
          setIsNewModalOpen(false);
          const hasOT = Boolean(
            createdReception?.orden_trabajo_id ||
            createdReception?.data?.orden_trabajo_id ||
            createdReception?.generar_orden_trabajo
          );
          fetchRecepciones();
          fetchDashboardMetrics();
        }}
      />
    </div>
  );
}
