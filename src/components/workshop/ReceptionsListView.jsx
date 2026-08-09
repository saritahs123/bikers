"use client";
import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, RefreshCw, Eye, Calendar, User, Bike, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import NewReceptionModal from "./NewReceptionModal";
import ReceptionDetailView from "./ReceptionDetailView";

export default function ReceptionsListView({ onViewDetail }) {
  const [recepciones, setRecepciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Modals & Navigation
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
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al cargar listado de recepciones.");
      }

      setRecepciones(json.data || []);
      setPagination(json.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
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

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Recepciones de Taller</h2>
          <p className="text-xs text-slate-400">Gestión de ingresos, inspección física y registro de firma.</p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-medium text-xs rounded-xl shadow-lg shadow-emerald-400/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Recepción
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código, cliente o bicicleta..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>

        <button
          onClick={fetchRecepciones}
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
          title="Recargar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold">
                <th className="p-4">Código</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Bicicleta</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Presupuesto</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Cargando recepciones...</span>
                    </div>
                  </td>
                </tr>
              ) : recepciones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No se encontraron recepciones registradas.
                  </td>
                </tr>
              ) : (
                recepciones.map((r) => (
                  <tr key={r.recepcion_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {r.codigo_recepcion}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-200">{r.cliente.nombre_completo}</p>
                      <p className="text-[11px] text-slate-400">{r.cliente.telefono}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-300">{r.bicicleta.resumen}</p>
                      <p className="text-[11px] text-slate-500">{r.bicicleta.color}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-slate-800 text-slate-300 rounded">
                        {r.estado.nombre}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      RD$ {Number(r.presupuesto_estimado).toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-400">
                      {new Date(r.fecha_recepcion).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(r.recepcion_id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-all"
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

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
          <span>
            Mostrando <strong>{recepciones.length}</strong> de <strong>{pagination.total}</strong> recepciones
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Página {page} de {pagination.totalPages || 1}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Reception Modal */}
      <NewReceptionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => { fetchRecepciones(); }}
      />
    </div>
  );
}
