"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  Search,
  Bike,
  User,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Wrench,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import ReceptionChecklistModal from "./ReceptionChecklistModal";
import DigitalSignatureCanvasModal from "./DigitalSignatureCanvasModal";

export default function NewReceptionModal({ isOpen, onClose, onSuccess, onCreated }) {
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [catalogs, setCatalogs] = useState({
    items_checklist: [],
    estados_checklist: [],
    tipos_servicio: [],
    prioridades: [],
    mecanicos: []
  });
  const [loadingInit, setLoadingInit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Guard ref for single execution navigation (race condition prevention)
  const navigationStartedRef = useRef(false);

  // Form State - Base
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedBike, setSelectedBike] = useState(null);
  const [observacionesCliente, setObservacionesCliente] = useState("");
  const [observacionesRecepcion, setObservacionesRecepcion] = useState("");
  const [presupuestoEstimado, setPresupuestoEstimado] = useState("0");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);

  // Combobox Autocomplete State for Client Selection
  const [clientSearch, setClientSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const comboboxRef = useRef(null);
  const inputRef = useRef(null);

  // Multi-Service State & Draft Validation Errors
  const [serviciosList, setServiciosList] = useState([]);
  const [currentServicioId, setCurrentServicioId] = useState("");
  const [currentDiagnostico, setCurrentDiagnostico] = useState("");
  const [currentPrecio, setCurrentPrecio] = useState("");
  const [currentMecanicoId, setCurrentMecanicoId] = useState("");
  const [editingTempId, setEditingTempId] = useState(null);
  const [addingServiceProcessing, setAddingServiceProcessing] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState("");

  const [serviceDraftErrors, setServiceDraftErrors] = useState({
    tipo_servicio_id: "",
    precio_estimado: "",
    mecanico_usuario_id: "",
    diagnostico_preliminar: ""
  });

  // Refs for service sub-form auto-focus
  const selectTypeRef = useRef(null);
  const inputPriceRef = useRef(null);
  const selectMechRef = useRef(null);
  const textDiagRef = useRef(null);

  // Work Order Auto-Creation State
  const [generarOrdenTrabajo, setGenerarOrdenTrabajo] = useState(true);
  const [prioridadId, setPrioridadId] = useState("");
  const [fechaPrometida, setFechaPrometida] = useState("");
  const [observacionesOT, setObservacionesOT] = useState("");

  // Sub-modals State
  const [checklistState, setChecklistState] = useState([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      navigationStartedRef.current = false;
      loadInitialData();
    }
  }, [isOpen]);

  // Click outside to close client dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    setLoadingInit(true);
    setError("");
    try {
      const [resClients, resCats] = await Promise.all([
        fetch("/api/crm/clientes").then((r) => r.json()),
        fetch("/api/taller/catalogos").then((r) => r.json())
      ]);

      setClients(Array.isArray(resClients) ? resClients : []);
      if (resCats.data || resCats) {
        const catData = resCats.data || resCats;
        const prios = catData.prioridades || [];
        const mecs = catData.mecanicos || [];
        const tServs = catData.tipos_servicio || [];

        setCatalogs({
          items_checklist: catData.items_checklist || [],
          estados_checklist: catData.estados_checklist || [],
          tipos_servicio: tServs,
          prioridades: prios,
          mecanicos: mecs
        });

        if (prios.length > 0) {
          const normalPrio = prios.find((p) => p.codigo === "NORMAL") || prios[0];
          setPrioridadId(String(normalPrio.prioridad_id || normalPrio.prioridad_orden_trabajo_id || ""));
        }
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
      const filtered = allBikes.filter((b) => b.cliente_id === clientId || b.cliente?.id === clientId);
      setBikes(filtered.length > 0 ? filtered : allBikes);
    } catch (err) {
      console.error("Error loading bikes:", err);
    }
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setSelectedBike(null);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
    loadBikesForClient(client.id || client.cliente_id);
  };

  // Helper for accent and case insensitive search
  const normalizeText = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredClientsList = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = normalizeText(clientSearch);
    const name = normalizeText(c.nombre_completo);
    const doc = normalizeText(c.identificacion);
    const phone = normalizeText(c.telefono_principal);
    const email = normalizeText(c.correo);

    return name.includes(q) || doc.includes(q) || phone.includes(q) || email.includes(q);
  });

  const displayedClients = filteredClientsList.slice(0, 6);

  const getInitials = (name) => {
    if (!name) return "CL";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsDropdownOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < displayedClients.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : displayedClients.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < displayedClients.length) {
        handleSelectClient(displayedClients[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    }
  };

  // Handle choice of service type in sub-form
  const handleSelectServiceType = (sId) => {
    setCurrentServicioId(sId);
    setServiceDraftErrors((prev) => ({ ...prev, tipo_servicio_id: "" }));
    setServiceSuccessMsg("");
    if (!sId) {
      setCurrentPrecio("");
      return;
    }
    const found = catalogs.tipos_servicio.find((t) => String(t.tipo_servicio_id) === String(sId));
    if (found) {
      setCurrentPrecio(String(found.precio_base || "0"));
      setServiceDraftErrors((prev) => ({ ...prev, precio_estimado: "" }));
    }
  };

  // Add or Update service item in list with strict field validation & double-execution prevention
  const handleAddOrUpdateService = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (addingServiceProcessing) return;

    const errors = {
      tipo_servicio_id: "",
      precio_estimado: "",
      mecanico_usuario_id: "",
      diagnostico_preliminar: ""
    };

    // 1. Validations in strict order
    if (!Number(currentServicioId)) {
      errors.tipo_servicio_id = "Selecciona un tipo de servicio.";
    }

    if (
      currentPrecio === "" ||
      Number.isNaN(Number(currentPrecio)) ||
      Number(currentPrecio) < 0
    ) {
      errors.precio_estimado = "Ingresa un precio estimado válido.";
    }

    if (!Number(currentMecanicoId)) {
      errors.mecanico_usuario_id = "Selecciona el mecánico responsable de este servicio.";
    }

    if (!currentDiagnostico?.trim()) {
      errors.diagnostico_preliminar = "Escribe el diagnóstico preliminar del servicio.";
    }

    // Duplicate check if not editing
    const isDuplicate = serviciosList.some(
      (s) => String(s.tipo_servicio_id) === String(currentServicioId) && s.tempId !== editingTempId
    );
    if (isDuplicate && !errors.tipo_servicio_id) {
      errors.tipo_servicio_id = "Este tipo de servicio ya fue agregado a la recepción.";
    }

    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) {
      setServiceDraftErrors(errors);
      setServiceSuccessMsg("");

      // Auto-focus first field with error
      if (errors.tipo_servicio_id && selectTypeRef.current) {
        selectTypeRef.current.focus();
      } else if (errors.precio_estimado && inputPriceRef.current) {
        inputPriceRef.current.focus();
      } else if (errors.mecanico_usuario_id && selectMechRef.current) {
        selectMechRef.current.focus();
      } else if (errors.diagnostico_preliminar && textDiagRef.current) {
        textDiagRef.current.focus();
      }
      return;
    }

    setAddingServiceProcessing(true);

    const typeObj = catalogs.tipos_servicio.find((t) => String(t.tipo_servicio_id) === String(currentServicioId));
    const mechObj = catalogs.mecanicos.find((m) => String(m.usuario_id) === String(currentMecanicoId));

    const itemPrice = parseFloat(currentPrecio || "0");

    let updatedList = [];
    if (editingTempId) {
      updatedList = serviciosList.map((s) => {
        if (s.tempId === editingTempId) {
          return {
            ...s,
            tipo_servicio_id: currentServicioId,
            nombre: typeObj?.nombre || `Servicio #${currentServicioId}`,
            diagnostico_preliminar: currentDiagnostico.trim(),
            precio_estimado: itemPrice,
            mecanico_usuario_id: currentMecanicoId,
            mecanico_nombre: mechObj?.nombre_completo || `Mecánico #${currentMecanicoId}`
          };
        }
        return s;
      });
      setEditingTempId(null);
    } else {
      const tempId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const newItem = {
        tempId,
        tipo_servicio_id: currentServicioId,
        nombre: typeObj?.nombre || `Servicio #${currentServicioId}`,
        diagnostico_preliminar: currentDiagnostico.trim(),
        precio_estimado: itemPrice,
        mecanico_usuario_id: currentMecanicoId,
        mecanico_nombre: mechObj?.nombre_completo || `Mecánico #${currentMecanicoId}`
      };

      updatedList = [...serviciosList, newItem];
    }

    setServiciosList(updatedList);
    recalculateBudget(updatedList);

    // Clear sub-form & errors
    setCurrentServicioId("");
    setCurrentDiagnostico("");
    setCurrentPrecio("");
    setCurrentMecanicoId("");
    setServiceDraftErrors({
      tipo_servicio_id: "",
      precio_estimado: "",
      mecanico_usuario_id: "",
      diagnostico_preliminar: ""
    });
    setError("");
    setServiceSuccessMsg("Servicio agregado correctamente.");

    setTimeout(() => {
      setAddingServiceProcessing(false);
    }, 200);
  };

  const handleEditServiceClick = (item) => {
    setEditingTempId(item.tempId);
    setCurrentServicioId(String(item.tipo_servicio_id));
    setCurrentDiagnostico(item.diagnostico_preliminar || "");
    setCurrentPrecio(String(item.precio_estimado || "0"));
    setCurrentMecanicoId(item.mecanico_usuario_id ? String(item.mecanico_usuario_id) : "");
    setServiceDraftErrors({
      tipo_servicio_id: "",
      precio_estimado: "",
      mecanico_usuario_id: "",
      diagnostico_preliminar: ""
    });
    setServiceSuccessMsg("");
  };

  const handleDeleteServiceClick = (tempId) => {
    const updated = serviciosList.filter((s) => s.tempId !== tempId);
    setServiciosList(updated);
    recalculateBudget(updated);
    if (editingTempId === tempId) {
      setEditingTempId(null);
      setCurrentServicioId("");
      setCurrentDiagnostico("");
      setCurrentPrecio("");
      setCurrentMecanicoId("");
    }
  };

  const recalculateBudget = (list) => {
    const total = list.reduce((sum, item) => sum + (Number(item.precio_estimado) || 0), 0);
    setPresupuestoEstimado(total.toFixed(2));
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (submitting || navigationStartedRef.current) return;

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
    if (generarOrdenTrabajo && serviciosList.length === 0) {
      setError("Debe agregar al menos un servicio con su mecánico asignado para generar la Orden de Trabajo.");
      return;
    }

    for (const s of serviciosList) {
      if (!s.mecanico_usuario_id) {
        setError(`El servicio '${s.nombre}' debe tener un mecánico asignado obligatoriamente.`);
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        cliente_id: selectedClient.id || selectedClient.cliente_id,
        bicicleta_id: selectedBike.id || selectedBike.bicicleta_id,
        servicios: serviciosList.map((s) => ({
          tipo_servicio_id: parseInt(s.tipo_servicio_id, 10),
          diagnostico_preliminar: s.diagnostico_preliminar,
          precio_estimado: parseFloat(s.precio_estimado || "0"),
          mecanico_usuario_id: parseInt(s.mecanico_usuario_id, 10)
        })),
        observaciones_cliente: observacionesCliente,
        observaciones_recepcion: observacionesRecepcion,
        presupuesto_estimado: parseFloat(presupuestoEstimado || "0"),
        requiere_aprobacion: requiereAprobacion,
        checklist: checklistState.map((c) => ({
          item_checklist_id: c.item_checklist_id,
          estado_checklist_id: c.estado_checklist_id,
          observacion: c.observacion,
          requiere_trabajo: c.requiere_trabajo,
          object_key: c.object_key || c.s3_key || null,
          upload_token: c.upload_token || null,
          filename: c.filename || null,
          evidencia_foto: Boolean(c.object_key || c.upload_token || c.s3_key)
        })),
        firma: {
          firma_digital: signatureData.firma_digital,
          terminos_aceptados: signatureData.terminos_aceptados
        },
        generar_orden_trabajo: generarOrdenTrabajo,
        orden_trabajo: generarOrdenTrabajo
          ? {
              prioridad_id: prioridadId ? parseInt(prioridadId, 10) : null,
              fecha_prometida: fechaPrometida || null,
              observaciones: observacionesOT
            }
          : null
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

      const rawOrderId = json?.data?.orden_trabajo_id;
      const orderId = Number(rawOrderId);

      if (generarOrdenTrabajo) {
        if (!Number.isInteger(orderId) || orderId <= 0) {
          setError("La recepción fue creada, pero el servidor no devolvió la orden generada.");
          setSubmitting(false);
          return;
        }

        if (navigationStartedRef.current) return;
        navigationStartedRef.current = true;

        router.push(`/work-orders?order_id=${orderId}`);
        return;
      }

      // Standard Reception-only flow without Work Order:
      if (typeof onSuccess === "function") {
        await onSuccess(json);
      } else if (typeof onCreated === "function") {
        await onCreated(json);
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Error al guardar la recepción.");
      setSubmitting(false);
    } finally {
      if (!navigationStartedRef.current) {
        setSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4">
        <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Nueva Recepción de Bicicleta</h3>
              <p className="text-xs text-slate-400">Complete los datos del propietario, servicios requeridos e inspección inicial.</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
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

            {/* Step 1: Client Selection Combobox */}
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
                <div ref={comboboxRef} className="relative w-full">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                    <input
                      id="input-client-combobox"
                      ref={inputRef}
                      type="text"
                      role="combobox"
                      aria-expanded={isDropdownOpen}
                      aria-autocomplete="list"
                      aria-controls="client-combobox-listbox"
                      aria-activedescendant={
                        activeIndex >= 0 && displayedClients[activeIndex]
                          ? `client-option-${displayedClients[activeIndex].id || displayedClients[activeIndex].cliente_id}`
                          : undefined
                      }
                      placeholder="Escribe nombre, documento, teléfono o correo…"
                      value={clientSearch}
                      onFocus={() => setIsDropdownOpen(true)}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setIsDropdownOpen(true);
                        setActiveIndex(0);
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    />
                    {loadingInit && (
                      <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-emerald-400 animate-spin" />
                    )}
                  </div>

                  {/* Floating Dropdown Panel */}
                  {isDropdownOpen && (
                    <div
                      id="client-combobox-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-slate-800/60 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      {loadingInit ? (
                        <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Buscando clientes…</span>
                        </div>
                      ) : displayedClients.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No encontramos clientes con esos datos.
                        </div>
                      ) : (
                        displayedClients.map((c, idx) => {
                          const cId = c.id || c.cliente_id;
                          const isHighlighted = idx === activeIndex;
                          return (
                            <div
                              key={cId}
                              id={`client-option-${cId}`}
                              role="option"
                              aria-selected={isHighlighted}
                              tabIndex={-1}
                              onClick={() => handleSelectClient(c)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`p-3 flex items-center justify-between transition-colors cursor-pointer text-left ${
                                isHighlighted
                                  ? "bg-slate-800/90 text-slate-100"
                                  : "hover:bg-slate-800/60 bg-slate-900/40 text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                                  {getInitials(c.nombre_completo)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-200 truncate">{c.nombre_completo}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    Doc: {c.identificacion || "S/I"} • Tel: {c.telefono_principal || "S/T"} • {c.correo || "Sin correo"}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {getInitials(selectedClient.nombre_completo)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-emerald-300 truncate">{selectedClient.nombre_completo}</p>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full shrink-0">
                          Cliente seleccionado
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Doc: {selectedClient.identificacion || "S/I"} • Tel: {selectedClient.telefono_principal || "S/T"} • {selectedClient.correo || "Sin correo"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setSelectedBike(null);
                      setClientSearch("");
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer shrink-0 ml-3"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cambiar cliente</span>
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
                    bikes.map((b) => {
                      const isSel = selectedBike && (selectedBike.id === b.id || selectedBike.bicicleta_id === b.bicicleta_id);
                      return (
                        <button
                          key={b.id || b.bicicleta_id}
                          type="button"
                          onClick={() => setSelectedBike(b)}
                          className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSel
                              ? "bg-emerald-500/20 border-emerald-500/40 text-slate-100"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{b.marca || b.brand} {b.modelo || b.model}</p>
                            <p className="text-[11px] text-slate-400">Color: {b.color || "N/A"} • Serie: {b.numero_serie || b.serial || "N/A"}</p>
                          </div>
                          {isSel && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Multi-Service & Reception Details */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  3. Servicios Solicitados & Diagnóstico Preliminar
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400 hidden sm:inline mr-1">
                    {serviciosList.length} servicio(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setGenerarOrdenTrabajo(!generarOrdenTrabajo)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      generarOrdenTrabajo
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                    title="Activar para registrar la Orden de Trabajo automáticamente en la misma transacción"
                  >
                    <Wrench className={`w-3.5 h-3.5 ${generarOrdenTrabajo ? "text-emerald-400" : "text-slate-500"}`} />
                    <span>Generar OT automática</span>
                    {generarOrdenTrabajo ? (
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sub-form to Add/Edit a Service */}
              <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-slate-200">
                  {editingTempId ? "Editar Servicio Seleccionado" : "Agregar Nuevo Servicio a la Recepción"}
                </p>

                {/* 5 / 3 / 4 column distribution on desktop for wide dropdown view */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <label className="text-[11px] text-slate-400 mb-1 block">Tipo de Servicio *</label>
                    <select
                      ref={selectTypeRef}
                      value={currentServicioId}
                      onChange={(e) => handleSelectServiceType(e.target.value)}
                      className={`w-full text-xs bg-slate-900 border rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none transition-colors ${
                        serviceDraftErrors.tipo_servicio_id
                          ? "border-rose-500/80 bg-rose-500/10 focus:border-rose-500"
                          : "border-slate-800 focus:border-slate-700"
                      }`}
                    >
                      <option value="">Seleccione tipo de servicio...</option>
                      {catalogs.tipos_servicio.map((t) => (
                        <option key={t.tipo_servicio_id} value={t.tipo_servicio_id}>
                          {t.nombre} (RD$ {Number(t.precio_base || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                    {serviceDraftErrors.tipo_servicio_id && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{serviceDraftErrors.tipo_servicio_id}</span>
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[11px] text-slate-400 mb-1 block">Precio Estimado (RD$)</label>
                    <input
                      ref={inputPriceRef}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={currentPrecio}
                      onChange={(e) => {
                        setCurrentPrecio(e.target.value);
                        setServiceDraftErrors((prev) => ({ ...prev, precio_estimado: "" }));
                        setServiceSuccessMsg("");
                      }}
                      className={`w-full text-xs bg-slate-900 border rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none font-mono transition-colors ${
                        serviceDraftErrors.precio_estimado
                          ? "border-rose-500/80 bg-rose-500/10 focus:border-rose-500"
                          : "border-slate-800 focus:border-slate-700"
                      }`}
                    />
                    {serviceDraftErrors.precio_estimado && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{serviceDraftErrors.precio_estimado}</span>
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-[11px] text-slate-400 mb-1 block">Mecánico Asignado *</label>
                    <select
                      ref={selectMechRef}
                      value={currentMecanicoId}
                      onChange={(e) => {
                        setCurrentMecanicoId(e.target.value);
                        setServiceDraftErrors((prev) => ({ ...prev, mecanico_usuario_id: "" }));
                        setServiceSuccessMsg("");
                      }}
                      className={`w-full text-xs bg-slate-900 border rounded-xl px-3 py-2.5 focus:outline-none font-medium transition-colors ${
                        serviceDraftErrors.mecanico_usuario_id
                          ? "border-rose-500/80 bg-rose-500/10 text-rose-300 focus:border-rose-500"
                          : "border-slate-800 text-emerald-300 focus:border-slate-700"
                      }`}
                    >
                      <option value="">-- Seleccione mecánico * --</option>
                      {catalogs.mecanicos.map((m) => (
                        <option key={m.usuario_id} value={m.usuario_id}>
                          {m.nombre_completo}
                        </option>
                      ))}
                    </select>
                    {serviceDraftErrors.mecanico_usuario_id && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{serviceDraftErrors.mecanico_usuario_id}</span>
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-12">
                    <label className="text-[11px] text-slate-400 mb-1 block">Diagnóstico Preliminar del Servicio *</label>
                    <textarea
                      ref={textDiagRef}
                      rows={2}
                      value={currentDiagnostico}
                      onChange={(e) => {
                        setCurrentDiagnostico(e.target.value);
                        setServiceDraftErrors((prev) => ({ ...prev, diagnostico_preliminar: "" }));
                        setServiceSuccessMsg("");
                      }}
                      placeholder="Diagnóstico preliminar o trabajo específico a realizar para este servicio..."
                      className={`w-full text-xs bg-slate-900 border rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors ${
                        serviceDraftErrors.diagnostico_preliminar
                          ? "border-rose-500/80 bg-rose-500/10 focus:border-rose-500"
                          : "border-slate-800 focus:border-slate-700"
                      }`}
                    />
                    {serviceDraftErrors.diagnostico_preliminar && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{serviceDraftErrors.diagnostico_preliminar}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {serviceSuccessMsg ? (
                    <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-4 h-4" />
                      <span>{serviceSuccessMsg}</span>
                    </p>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    {editingTempId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingTempId(null);
                          setCurrentServicioId("");
                          setCurrentDiagnostico("");
                          setCurrentPrecio("");
                          setCurrentMecanicoId("");
                          setServiceDraftErrors({
                            tipo_servicio_id: "",
                            precio_estimado: "",
                            mecanico_usuario_id: "",
                            diagnostico_preliminar: ""
                          });
                          setServiceSuccessMsg("");
                        }}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Cancelar Edición
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddOrUpdateService}
                      disabled={addingServiceProcessing}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {addingServiceProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {editingTempId ? "Guardar Cambios del Servicio" : "Agregar Servicio a la Lista"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table / List of Added Services */}
              {serviciosList.length > 0 && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Servicio</th>
                        <th className="py-2.5 px-3">Diagnóstico Preliminar</th>
                        <th className="py-2.5 px-3">Mecánico Asignado</th>
                        <th className="py-2.5 px-3 text-right">Precio Est.</th>
                        <th className="py-2.5 px-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {serviciosList.map((srv) => (
                        <tr key={srv.tempId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-emerald-400">{srv.nombre}</td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{srv.diagnostico_preliminar || "—"}</td>
                          <td className="py-2.5 px-3 text-emerald-300 font-medium">{srv.mecanico_nombre}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-100">RD$ {Number(srv.precio_estimado || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditServiceClick(srv)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Editar servicio"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteServiceClick(srv.tempId)}
                                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                title="Eliminar servicio"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* General Observations & Total Budget */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="md:col-span-2 flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Presupuesto Estimado Total</p>
                    <p className="text-[11px] text-slate-400">Suma total calculada de los servicios incluidos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">RD$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={presupuestoEstimado}
                      onChange={(e) => setPresupuestoEstimado(e.target.value)}
                      className="w-36 text-sm font-bold bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-emerald-400 text-right font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Work Order Fields (Only Prioridad, Fecha Prometida, Observaciones OT) */}
              {generarOrdenTrabajo && (
                <div className="p-4 bg-slate-950/80 border border-emerald-500/20 rounded-xl space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    <Wrench size={14} />
                    <span>Parámetros de la Orden de Trabajo (OT)</span>
                  </div>
                  {/* 2 columns on desktop, 1 on mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Prioridad de la Orden</label>
                      <select
                        value={prioridadId}
                        onChange={(e) => setPrioridadId(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-slate-700"
                      >
                        {catalogs.prioridades.map((p) => (
                          <option key={p.prioridad_id || p.prioridad_orden_trabajo_id} value={p.prioridad_id || p.prioridad_orden_trabajo_id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Fecha Prometida de Entrega</label>
                      <input
                        type="date"
                        value={fechaPrometida}
                        onChange={(e) => setFechaPrometida(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-slate-700"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-400 mb-1 block">Observaciones Internas para la Orden de Trabajo</label>
                      <textarea
                        rows={2}
                        value={observacionesOT}
                        onChange={(e) => setObservacionesOT(e.target.value)}
                        placeholder="Instrucciones adicionales para el mecánico o el taller..."
                        className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                      />
                    </div>
                  </div>
                </div>
              )}
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
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors font-medium cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-400/20 disabled:opacity-50 cursor-pointer font-semibold"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {navigationStartedRef.current ? "Abriendo Orden de Trabajo..." : "Guardando Recepción..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {generarOrdenTrabajo ? "Confirmar & Generar Orden de Trabajo" : "Confirmar & Crear Recepción"}
                </span>
              )}
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
