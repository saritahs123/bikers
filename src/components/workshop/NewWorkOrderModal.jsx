"use client";
import React, { useState, useEffect } from "react";
import { X, Wrench, Check, Loader2, AlertCircle, Calendar, User, Bike, FileText } from "lucide-react";

export default function NewWorkOrderModal({ isOpen, onClose, onSuccess }) {
  const [receptions, setReceptions] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [tiposServicios, setTiposServicios] = useState([]);

  const [selectedRecepcionId, setSelectedRecepcionId] = useState("");
  const [selectedRecepcionData, setSelectedRecepcionData] = useState(null);
  const [prioridadId, setPrioridadId] = useState("2"); // Default MEDIA (ID 2)
  const [mecanicoId, setMecanicoId] = useState("");
  const [fechaPrometida, setFechaPrometida] = useState("");
  const [diagnosticoInicial, setDiagnosticoInicial] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCatalogData();
    }
  }, [isOpen]);

  const fetchCatalogData = async () => {
    setLoadingForm(true);
    setError(null);
    try {
      // Receptions available
      const recRes = await fetch("/api/taller/recepciones?limit=100");
      const recData = await recRes.json();

      if (recData.data) {
        // Filter receptions that do NOT have a work order yet
        const unlinked = recData.data.filter((r) => !r.convertido_orden_id);
        setReceptions(unlinked);
      }

      // Work Order catalogs
      const ordRes = await fetch("/api/taller/ordenes?limit=1");
      const ordData = await ordRes.json();
      if (ordData.catalogs) {
        setPrioridades(ordData.catalogs.prioridades || []);
        setMecanicos(ordData.catalogs.mecanicos || []);
      }

      // Services catalog
      const catRes = await fetch("/api/taller/catalogos");
      const catData = await catRes.json();
      if (catData.tipos_servicio) {
        setTiposServicios(catData.tipos_servicio);
      }
    } catch (err) {
      console.error("fetchCatalogData Error:", err);
      setError("Error al cargar opciones del formulario.");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleSelectRecepcion = (idStr) => {
    setSelectedRecepcionId(idStr);
    if (!idStr) {
      setSelectedRecepcionData(null);
      setDiagnosticoInicial("");
      return;
    }

    const found = receptions.find((r) => String(r.recepcion_id) === String(idStr));
    if (found) {
      setSelectedRecepcionData(found);
      setDiagnosticoInicial(found.motivo_ingreso || "");
    }
  };

  const handleToggleService = (id) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecepcionId) {
      setError("Debes seleccionar una recepción válida.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        recepcion_id: parseInt(selectedRecepcionId, 10),
        prioridad_id: parseInt(prioridadId, 10),
        mecanico_usuario_id: mecanicoId ? parseInt(mecanicoId, 10) : null,
        fecha_prometida: fechaPrometida || null,
        diagnostico_inicial: diagnosticoInicial || null,
        observaciones: observaciones || null,
        servicios_iniciales: selectedServices
      };

      const res = await fetch("/api/taller/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || data.message || "Error al crear la Orden de Trabajo.");

      if (typeof onSuccess === "function") {
        await onSuccess(data.data.orden_id);
      }
      if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Nueva Orden de Trabajo</h2>
              <p className="text-xs text-slate-400">Genera una OT a partir de una recepción técnica inicial.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingForm ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Cargando catálogos del taller...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Recepción Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Seleccionar Recepción de Taller *
                </label>
                <select
                  required
                  value={selectedRecepcionId}
                  onChange={(e) => handleSelectRecepcion(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Selecciona una Recepción Activa --</option>
                  {receptions.map((r) => {
                    const clientName = r.cliente?.nombre_completo || r.cliente_nombre || (typeof r.cliente === 'string' ? r.cliente : "Cliente");
                    const bikeInfo = r.bicicleta?.resumen || r.bicicleta_resumen || [r.bicicleta_marca, r.bicicleta_modelo].filter(Boolean).join(" ") || "Bicicleta";
                    return (
                      <option key={r.recepcion_id} value={r.recepcion_id}>
                        {r.codigo_recepcion} - {clientName} ({bikeInfo})
                      </option>
                    );
                  })}
                </select>
                {receptions.length === 0 && (
                  <span className="text-[11px] text-amber-400 block mt-1">
                    No hay recepciones pendientes de vincular. Crea una recepción previa antes de generar la OT.
                  </span>
                )}
              </div>

              {/* Readonly Summary of Selected Reception */}
              {selectedRecepcionData && (
                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" /> Cliente:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {selectedRecepcionData.cliente?.nombre_completo || selectedRecepcionData.cliente_nombre || "Cliente"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-emerald-500/80" /> Bicicleta:
                    </span>
                    <span className="text-slate-300">
                      {selectedRecepcionData.bicicleta?.resumen || selectedRecepcionData.bicicleta_resumen || [selectedRecepcionData.bicicleta_marca, selectedRecepcionData.bicicleta_modelo].filter(Boolean).join(" ") || "Bicicleta"}
                    </span>
                  </div>
                </div>
              )}

              {/* Priority & Mechanic Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Prioridad *</label>
                  <select
                    required
                    value={prioridadId}
                    onChange={(e) => setPrioridadId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {prioridades.map((p) => (
                      <option key={p.prioridad_id} value={p.prioridad_id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Técnico / Mecánico Asignado</label>
                  <select
                    value={mecanicoId}
                    onChange={(e) => setMecanicoId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Sin asignar por el momento --</option>
                    {mecanicos.map((m) => (
                      <option key={m.usuario_id} value={m.usuario_id}>
                        {m.nombre_completo} {m.cargo_nombre ? `(${m.cargo_nombre})` : m.correo ? `(${m.correo})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha Prometida */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Fecha Prometida de Entrega</span>
                </label>
                <input
                  type="date"
                  value={fechaPrometida}
                  onChange={(e) => setFechaPrometida(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer [color-scheme:dark]"
                />
              </div>

              {/* Diagnóstico Inicial */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Diagnóstico Inicial</label>
                <textarea
                  rows={2}
                  value={diagnosticoInicial}
                  onChange={(e) => setDiagnosticoInicial(e.target.value)}
                  placeholder="Detalla la evaluación técnica preliminar..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Servicios Iniciales (Checkboxes) */}
              {tiposServicios.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Servicios Iniciales a Agregar
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 border border-slate-800 p-3 rounded-2xl max-h-40 overflow-y-auto">
                    {tiposServicios.map((s) => {
                      const selected = selectedServices.includes(s.tipo_servicio_id);
                      return (
                        <label
                          key={s.tipo_servicio_id}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border ${
                            selected
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-semibold"
                              : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleToggleService(s.tipo_servicio_id)}
                              className="hidden"
                            />
                            <span className="truncate">{s.nombre}</span>
                          </div>
                          <span className="font-mono text-slate-400 text-[11px]">
                            ${parseFloat(s.precio_base || 0).toLocaleString("es-CL")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observaciones Internas */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Observaciones Internas</label>
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas internas de taller..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedRecepcionId}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-400/20 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {submitting ? "Creando Orden..." : "Confirmar & Crear Orden"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
