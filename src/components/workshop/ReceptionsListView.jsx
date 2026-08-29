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
      color: "bg-surface border-border text-primary",
      description: "Bicicletas ingresadas durante el día de hoy"
    },
    {
      title: "Recepciones Pendientes",
      value: metrics.recepciones_pendientes,
      icon: Clock,
      color: "bg-surface border-border text-warning",
      description: "Ingresos pendientes de completar o convertir en OT"
    },
    {
      title: "Convertidas a OT",
      value: metrics.convertidas_ot,
      icon: Wrench,
      color: "bg-surface border-border text-info",
      description: "Recepciones que generaron una orden de trabajo"
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-foreground-muted font-medium flex items-center gap-1.5 uppercase tracking-wider">
        <span className="hover:text-foreground transition-colors cursor-pointer">TALLER</span>
        <span>/</span>
        <span className="text-primary font-semibold">RECEPCIONES</span>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            Recepciones de Taller
          </h1>
          <p className="text-xs sm:text-sm text-foreground-muted mt-1 max-w-2xl">
            Gestión de ingresos, inspección física, checklists y registro de firma digital.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-button-bg text-primary-foreground rounded-xl hover:bg-primary-button-hover transition-all font-mono text-xs font-bold tracking-wider uppercase shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          NUEVA RECEPCIÓN
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl border ${kpi.color} shadow-sm transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">{kpi.title}</span>
                <Icon className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2">{kpi.value}</p>
              <p className="text-[11px] text-foreground-muted mt-1 font-sans">{kpi.description}</p>
            </div>
          );
        })}
      </div>

      {/* Search & Refresh Toolbar */}
      <div className="bg-surface border border-border p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between font-mono text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-foreground-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, cliente o bicicleta..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:border-primary outline-none"
          />
        </div>

        <button
          onClick={fetchRecepciones}
          className="p-2.5 bg-card border border-border text-foreground-muted hover:text-foreground rounded-xl hover:bg-hover transition-colors shrink-0 cursor-pointer"
          title="Actualizar listado"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Receptions Data Table */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-2xl text-foreground-muted gap-3 font-mono text-xs">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span>Cargando recepciones...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-error-muted border border-error/20 rounded-2xl text-error text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchRecepciones}
            className="px-3 py-1 bg-card border border-border text-foreground rounded-lg hover:bg-hover font-mono text-xs cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : recepciones.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-2xl text-center gap-3">
          <ClipboardList className="w-10 h-10 text-foreground-muted" />
          <h3 className="text-sm font-bold text-foreground">No se encontraron recepciones</h3>
          <p className="text-xs text-foreground-muted max-w-sm">
            Registra una nueva recepción de bicicleta para iniciar el proceso de taller.
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="mt-2 px-4 py-2 bg-primary-button-bg text-primary-foreground text-xs font-mono font-bold rounded-xl hover:bg-primary-button-hover cursor-pointer"
          >
            NUEVA RECEPCIÓN
          </button>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-surface border-b border-border font-mono text-xs text-foreground-secondary font-semibold uppercase tracking-wider">
                    <th className="p-3.5 whitespace-nowrap">Código</th>
                    <th className="p-3.5 whitespace-nowrap">Cliente</th>
                    <th className="p-3.5 whitespace-nowrap">Bicicleta</th>
                    <th className="p-3.5 whitespace-nowrap">Estado</th>
                    <th className="p-3.5 whitespace-nowrap text-right">Presupuesto</th>
                    <th className="p-3.5 whitespace-nowrap">Fecha</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {recepciones.map((r) => {
                    const clienteNombre =
                      r.cliente?.nombre_completo ||
                      r.cliente_nombre ||
                      (typeof r.cliente === "string" ? r.cliente : "Cliente General");
                    const bicicletaResumen =
                      r.bicicleta?.resumen ||
                      r.bicicleta_resumen ||
                      (typeof r.bicicleta === "string" ? r.bicicleta : "Bicicleta");
                    const estadoNombre = r.estado?.nombre || r.estado_nombre || "INGRESADO";

                    return (
                      <tr key={r.recepcion_id} className="hover:bg-hover transition-colors">
                        <td className="p-3.5">
                          <span className="font-extrabold text-primary bg-primary-muted px-2 py-0.5 rounded border border-primary/20">
                            {r.codigo_recepcion}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-foreground font-sans">{clienteNombre}</td>
                        <td className="p-3.5 text-foreground-secondary font-sans">{bicicletaResumen}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface text-foreground border border-border uppercase">
                            {estadoNombre}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-bold text-foreground">
                          RD$ {parseFloat(r.presupuesto_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-foreground-muted">
                          {new Date(r.fecha_recepcion).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleOpenDetail(r.recepcion_id)}
                            className="p-1.5 text-foreground-muted hover:text-primary hover:bg-hover rounded-lg transition-colors cursor-pointer"
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
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-2 pt-2 text-xs text-foreground-muted font-mono">
            <span>
              Mostrando {recepciones.length > 0 ? (page - 1) * 10 + 1 : 0}-{Math.min(page * 10, pagination.total)} de {pagination.total} recepciones
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 bg-card border border-border hover:bg-hover disabled:opacity-40 rounded-xl transition-all text-foreground cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">Página {page} de {pagination.totalPages || 1}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 bg-card border border-border hover:bg-hover disabled:opacity-40 rounded-xl transition-all text-foreground cursor-pointer"
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
        onSuccess={() => {
          setIsNewModalOpen(false);
          fetchRecepciones();
        }}
        onCreated={() => {
          setIsNewModalOpen(false);
          fetchRecepciones();
        }}
      />
    </div>
  );
}
