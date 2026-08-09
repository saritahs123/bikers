"use client";
import React, { useState, useEffect } from "react";
import { X, Check, Search, Bike, User, FileText, ClipboardCheck, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import ReceptionChecklistModal from "./ReceptionChecklistModal";
import DigitalSignatureCanvasModal from "./DigitalSignatureCanvasModal";

export default function NewReceptionModal({ isOpen, onClose, onSuccess }) {
  const [clients, setClients] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [catalogs, setCatalogs] = useState({ items_checklist: [], estados_checklist: [], tipos_servicio: [] });
  const [loadingInit, setLoadingInit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedBike, setSelectedBike] = useState(null);
  const [tipoServicioId, setTipoServicioId] = useState("");
  const [diagnosticoPreliminar, setDiagnosticoPreliminar] = useState("");
  const [observacionesCliente, setObservacionesCliente] = useState("");
  const [observacionesRecepcion, setObservacionesRecepcion] = useState("");
  const [presupuestoEstimado, setPresupuestoEstimado] = useState("0");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);

  // Sub-modals State
  const [checklistState, setChecklistState] = useState([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);

  // Search states for client
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoadingInit(true);
    setError("");
    try {
      const [resClients, resCats] = await Promise.all([
        fetch("/api/crm/clientes").then(r => r.json()),
        fetch("/api/taller/catalogos").then(r => r.json())
      ]);

      setClients(Array.isArray(resClients) ? resClients : []);
      if (resCats.data) {
        setCatalogs(resCats.data);
      }
    } catch (err) {
      console.error("Error loading init data:", err);
      setError("No se pudieron cargar los datos de clientes y catálogos.");
    } finally {
      setLoadingInit(false);
    }
  };

  const loadBikesForClient = async (clientId) => {
    try {
      const res = await fetch(`/api/crm/bicicletas?cliente_id=${clientId}`);
      const data = await res.json();
      const allBikes = Array.isArray(data) ? data : data.data || [];
      // Filter for client
      const filtered = allBikes.filter(b => b.cliente_id === clientId || b.cliente?.id === clientId);
      setBikes(filtered.length > 0 ? filtered : allBikes);
    } catch (err) {
      console.error("Error loading bikes:", err);
    }
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setSelectedBike(null);
    loadBikesForClient(client.id || client.cliente_id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      setError("Debe seleccionar un cliente.");
      return;
    }
    if (!selectedBike) {
      setError("Debe seleccionar una bicicleta.");
      return;
    }
    if (!signatureData || !signatureData.firma_digital) {
      setError("Debe registrar la firma digital del cliente para confirmar el ingreso.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        cliente_id: selectedClient.id || selectedClient.cliente_id,
        bicicleta_id: selectedBike.id || selectedBike.bicicleta_id,
        tipo_servicio_id: tipoServicioId ? parseInt(tipoServicioId, 10) : null,
        diagnostico_preliminar: diagnosticoPreliminar,
        observaciones_cliente: observacionesCliente,
        observaciones_recepcion: observacionesRecepcion,
        presupuesto_estimado: parseFloat(presupuestoEstimado || "0"),
        requiere_aprobacion: requiereAprobacion,
        checklist: checklistState.map(c => ({
          item_checklist_id: c.item_checklist_id,
          estado_checklist_id: c.estado_checklist_id,
          observacion: c.observacion,
          requiere_trabajo: c.requiere_trabajo,
          upload_token: c.upload_token
        })),
        firma: {
          firma_digital: signatureData.firma_digital,
          terminos_aceptados: signatureData.terminos_aceptados
        }
      };

      const res = await fetch("/api/taller/recepciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al crear la recepción.");
      }

      onSuccess(json);
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar la recepción.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredClientsList = clients.filter(c => 
    (c.nombre_completo || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.identificacion || "").includes(clientSearch) ||
    (c.telefono_principal || "").includes(clientSearch)
  );

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Nueva Recepción de Bicicleta</h3>
              <p className="text-xs text-slate-400">Complete los datos del propietario, unidad e inspección inicial.</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
            {error && (
              <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Client Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  1. Selección de Cliente
                </label>
                {selectedClient && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Seleccionado: {selectedClient.nombre_completo}
                  </span>
                )}
              </div>

              {!selectedClient ? (
                <div className="space-y-2 bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, cédula o teléfono..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredClientsList.slice(0, 5).map(c => (
                      <button
                        key={c.id || c.cliente_id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left p-2.5 hover:bg-slate-800/60 rounded-lg flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-xs font-medium text-slate-200">{c.nombre_completo}</p>
                          <p className="text-[11px] text-slate-400">{c.telefono_principal} • {c.correo || 'Sin correo'}</p>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Seleccionar</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-emerald-300">{selectedClient.nombre_completo}</p>
                    <p className="text-[11px] text-slate-400">{selectedClient.telefono_principal} • {selectedClient.correo || 'Sin correo'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedClient(null); setSelectedBike(null); }}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    Cambiar Cliente
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Bike Selection */}
            {selectedClient && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Bike className="w-4 h-4 text-emerald-400" />
                  2. Selección de Bicicleta
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bikes.length === 0 ? (
                    <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl col-span-2">
                      El cliente seleccionado no posee bicicletas registradas. Registre una bicicleta primero en el CRM.
                    </p>
                  ) : (
                    bikes.map(b => {
                      const isSel = selectedBike && (selectedBike.id === b.id || selectedBike.bicicleta_id === b.bicicleta_id);
                      return (
                        <button
                          key={b.id || b.bicicleta_id}
                          type="button"
                          onClick={() => setSelectedBike(b)}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSel
                              ? "bg-emerald-500/20 border-emerald-500/40 text-slate-100"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-medium text-slate-200">{b.marca || b.brand} {b.modelo || b.model}</p>
                            <p className="text-[11px] text-slate-400">Color: {b.color || 'N/A'} • Serie: {b.numero_serie || b.serial || 'N/A'}</p>
                          </div>
                          {isSel && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Reception Parameters & Observations */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                3. Detalles de Recepción & Presupuesto
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de Servicio General</label>
                  <select
                    value={tipoServicioId}
                    onChange={(e) => setTipoServicioId(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-slate-700"
                  >
                    <option value="">Seleccione tipo de servicio...</option>
                    {catalogs.tipos_servicio.map(t => (
                      <option key={t.tipo_servicio_id} value={t.tipo_servicio_id}>
                        {t.nombre} (RD$ {Number(t.precio_base || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Presupuesto Estimado (RD$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={presupuestoEstimado}
                    onChange={(e) => setPresupuestoEstimado(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400 mb-1 block">Diagnóstico Preliminar</label>
                  <textarea
                    rows={2}
                    value={diagnosticoPreliminar}
                    onChange={(e) => setDiagnosticoPreliminar(e.target.value)}
                    placeholder="Descripción técnica inicial realizada en el mostrador..."
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Motivo de Ingreso / Obs. Cliente</label>
                  <textarea
                    rows={2}
                    value={observacionesCliente}
                    onChange={(e) => setObservacionesCliente(e.target.value)}
                    placeholder="Lo que declara o reporta el cliente..."
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Observaciones Internas de Recepción</label>
                  <textarea
                    rows={2}
                    value={observacionesRecepcion}
                    onChange={(e) => setObservacionesRecepcion(e.target.value)}
                    placeholder="Detalles sobre estado estético, rayones previos, etc..."
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Triggers for Checklist & Signature */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <button
                id="btn-checklist-inspeccion"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsChecklistOpen(true);
                }}
                className={`p-4 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer relative z-10 ${
                  checklistState.length > 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 pointer-events-none">
                  <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold">Checklist de Inspección</p>
                    <p className="text-[11px] text-slate-400">
                      {checklistState.length > 0 ? `${checklistState.length} ítems evaluados` : "Completar evaluación inicial"}
                    </p>
                  </div>
                </div>
                {checklistState.length > 0 && <Check className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                id="btn-firma-digital"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsSignatureOpen(true);
                }}
                className={`p-4 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer relative z-10 ${
                  signatureData
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 pointer-events-none">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold">Firma Digital del Cliente</p>
                    <p className="text-[11px] text-slate-400">
                      {signatureData ? "Firma registrada y lista" : "Requerida para confirmar"}
                    </p>
                  </div>
                </div>
                {signatureData && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </form>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-400/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? "Guardando Recepción..." : "Confirmar & Crear Recepción"}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      <ReceptionChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        itemsCatalog={catalogs.items_checklist}
        estadosCatalog={catalogs.estados_checklist}
        checklistState={checklistState}
        onChangeChecklist={setChecklistState}
      />

      <DigitalSignatureCanvasModal
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onConfirm={setSignatureData}
      />
    </>
  );
}
