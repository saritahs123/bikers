"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Wrench,
  User,
  Bike,
  ClipboardCheck,
  FileSignature,
  Loader2,
  Search,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import ReceptionChecklistModal from "./ReceptionChecklistModal";

export default function NewReceptionModal({ isOpen, onClose, onSuccess, onCreated }) {
  const router = useRouter();
  const navigationStartedRef = useRef(false);

  // Initial Data & Catalog States
  const [loadingInit, setLoadingInit] = useState(true);
  const [catalogs, setCatalogs] = useState({
    tipos_servicio: [],
    prioridades: [],
    mecanicos: [],
    items_checklist: [],
    estados_checklist: []
  });
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Client Autocomplete State
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const comboboxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Bicycle Selection State & Components for selected bike
  const [clientBicycles, setClientBicycles] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [loadingBikes, setLoadingBikes] = useState(false);
  const [bikeComponents, setBikeComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Multi-Service State & Draft Validation Errors
  const [serviciosList, setServiciosList] = useState([]);
  const [currentServicioId, setCurrentServicioId] = useState("");
  const [currentDiagnostico, setCurrentDiagnostico] = useState("");
  const [currentPrecio, setCurrentPrecio] = useState("");
  const [currentBicicletaComponenteId, setCurrentBicicletaComponenteId] = useState("");
  const [editingTempId, setEditingTempId] = useState(null);
  const [addingServiceProcessing, setAddingServiceProcessing] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState("");

  const [serviceDraftErrors, setServiceDraftErrors] = useState({
    tipo_servicio_id: "",
    precio_estimado: "",
    diagnostico_preliminar: ""
  });

  // Refs for service sub-form focus & validation
  const selectTypeRef = useRef(null);
  const inputPriceRef = useRef(null);
  const textDiagRef = useRef(null);

  // General Reception Notes & Budget
  const [observacionesCliente, setObservacionesCliente] = useState("");
  const [observacionesRecepcion, setObservacionesRecepcion] = useState("");
  const [presupuestoEstimado, setPresupuestoEstimado] = useState("0.00");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);

  // Work Order Auto-Creation State (No fechaPrometida per instructions)
  const [generarOrdenTrabajo, setGenerarOrdenTrabajo] = useState(true);
  const [prioridadId, setPrioridadId] = useState("");
  const [observacionesOT, setObservacionesOT] = useState("");

  // Sub-modals State (Checklist only; Signature disabled visually)
  const [checklistState, setChecklistState] = useState([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

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

      const clientArr = Array.isArray(resClients)
        ? resClients
        : Array.isArray(resClients?.data)
        ? resClients.data
        : [];
      setClients(clientArr);

      const catObj = resCats?.data || resCats || {};
      setCatalogs({
        tipos_servicio: catObj.tipos_servicio || [],
        prioridades: catObj.prioridades || [],
        mecanicos: catObj.mecanicos || [],
        items_checklist: catObj.items_checklist || [],
        estados_checklist: catObj.estados_checklist || []
      });

      if (catObj.prioridades?.length > 0) {
        setPrioridadId(String(catObj.prioridades[0].prioridad_id || catObj.prioridades[0].prioridad_orden_trabajo_id));
      }
    } catch (err) {
      console.error("Error cargando datos iniciales para recepción:", err);
      setError("No se pudieron cargar los datos necesarios. Intente de nuevo.");
    } finally {
      setLoadingInit(false);
    }
  };

  // Select Client & Load Bicycles
  const handleSelectClient = async (clientObj) => {
    setSelectedClient(clientObj);
    setClientSearch(clientObj.nombre_completo || "");
    setIsDropdownOpen(false);
    setActiveIndex(-1);
    setSelectedBike(null);
    setClientBicycles([]);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");

    if (!clientObj) return;

    setLoadingBikes(true);
    try {
      const clientId = clientObj.id || clientObj.cliente_id;
      const res = await fetch(`/api/crm/bicicletas?cliente_id=${clientId}`);
      const data = await res.json();
      const bikesArr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setClientBicycles(bikesArr);
      if (bikesArr.length === 1) {
        handleSelectBike(bikesArr[0]);
      }
    } catch (err) {
      console.error("Error al obtener bicicletas del cliente:", err);
    } finally {
      setLoadingBikes(false);
    }
  };

  // Select Bike & Load Components strictly belonging to this bike
  const handleSelectBike = async (bikeObj) => {
    setSelectedBike(bikeObj);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");

    if (!bikeObj) return;

    const bikeId = bikeObj.id || bikeObj.bicicleta_id;
    if (!bikeId) return;

    setLoadingComponents(true);
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/components`);
      const data = await res.json();
      const componentsArr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setBikeComponents(componentsArr);
    } catch (err) {
      console.error("Error cargando componentes de la bicicleta:", err);
    } finally {
      setLoadingComponents(false);
    }
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
    setSelectedBike(null);
    setClientBicycles([]);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");
    setIsDropdownOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
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

  // Add or Update service item in list with component linkage
  const handleAddOrUpdateService = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (addingServiceProcessing) return;

    const errors = {
      tipo_servicio_id: "",
      precio_estimado: "",
      diagnostico_preliminar: ""
    };

    // 1. Validations in strict order
    if (!Number(currentServicioId)) {
      errors.tipo_servicio_id = "Selecciona un tipo de servicio.";
    }

    const numPrecio = parseFloat(currentPrecio);
    if (isNaN(numPrecio) || numPrecio < 0) {
      errors.precio_estimado = "El precio debe ser un número mayor o igual a cero.";
    }

    if (!currentDiagnostico.trim()) {
      errors.diagnostico_preliminar = "Escribe un diagnóstico preliminar para el servicio.";
    }

    const isDuplicate = serviciosList.some(
      (s) =>
        String(s.tipo_servicio_id) === String(currentServicioId) &&
        String(s.bicicleta_componente_id || "") === String(currentBicicletaComponenteId || "") &&
        s.tempId !== editingTempId
    );
    if (isDuplicate) {
      errors.tipo_servicio_id = "Este tipo de servicio con el mismo componente ya fue agregado a la lista.";
    }

    if (errors.tipo_servicio_id || errors.precio_estimado || errors.diagnostico_preliminar) {
      setServiceDraftErrors(errors);
      return;
    }

    setAddingServiceProcessing(true);

    const typeObj = catalogs.tipos_servicio.find((t) => String(t.tipo_servicio_id) === String(currentServicioId));
    const serviceName = typeObj ? typeObj.nombre : "Servicio de Taller";

    const compObj = bikeComponents.find((c) => String(c.bicicleta_componente_id || c.id) === String(currentBicicletaComponenteId));
    const componentName = compObj
      ? `${compObj.categoria_nombre || compObj.categoria || "Componente"} ${compObj.marca || ""} ${compObj.modelo || ""}`.trim()
      : "Servicio general";

    const newServiceItem = {
      tempId: editingTempId || Date.now(),
      tipo_servicio_id: currentServicioId,
      nombre: serviceName,
      precio_estimado: numPrecio.toFixed(2),
      diagnostico_preliminar: currentDiagnostico.trim(),
      bicicleta_componente_id: currentBicicletaComponenteId ? Number(currentBicicletaComponenteId) : null,
      componente_nombre: componentName
    };

    let updatedList = [];
    if (editingTempId) {
      updatedList = serviciosList.map((s) => (s.tempId === editingTempId ? newServiceItem : s));
      setEditingTempId(null);
      setServiceSuccessMsg("Servicio actualizado correctamente.");
    } else {
      updatedList = [...serviciosList, newServiceItem];
      setServiceSuccessMsg("Servicio agregado a la lista.");
    }

    setServiciosList(updatedList);
    recalculateBudget(updatedList);

    // Clear sub-form input state
    setCurrentServicioId("");
    setCurrentDiagnostico("");
    setCurrentPrecio("");
    setCurrentBicicletaComponenteId("");
    setServiceDraftErrors({
      tipo_servicio_id: "",
      precio_estimado: "",
      diagnostico_preliminar: ""
    });

    setAddingServiceProcessing(false);
    setTimeout(() => setServiceSuccessMsg(""), 3000);
  };

  const handleEditServiceClick = (item) => {
    setEditingTempId(item.tempId);
    setCurrentServicioId(String(item.tipo_servicio_id));
    setCurrentDiagnostico(item.diagnostico_preliminar || "");
    setCurrentPrecio(String(item.precio_estimado || ""));
    setCurrentBicicletaComponenteId(item.bicicleta_componente_id ? String(item.bicicleta_componente_id) : "");
    setServiceDraftErrors({
      tipo_servicio_id: "",
      precio_estimado: "",
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
      setCurrentBicicletaComponenteId("");
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

    if (generarOrdenTrabajo && serviciosList.length === 0) {
      setError("Debe agregar al menos un servicio para generar la Orden de Trabajo.");
      return;
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
          bicicleta_componente_id: s.bicicleta_componente_id ? parseInt(s.bicicleta_componente_id, 10) : null
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
        generar_orden_trabajo: generarOrdenTrabajo,
        orden_trabajo: generarOrdenTrabajo
          ? {
              prioridad_id: prioridadId ? parseInt(prioridadId, 10) : null,
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
        throw new Error(json.message || json.error || "Error al registrar la recepción.");
      }

      const rawOrderId = json?.data?.orden_trabajo_id ?? json?.orden_trabajo_id;
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

      if (onSuccess) onSuccess(json.data || json);
      if (onCreated) onCreated(json.data || json);
      onClose();
    } catch (err) {
      console.error("Error al enviar recepción:", err);
      setError(err.message || "Error de red al guardar la recepción.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-snug">Nueva Recepción de Bicicleta</h2>
              <p className="text-xs text-slate-400">Registro de ingreso y servicios iniciales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loadingInit ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Cargando catálogos de recepción...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Cliente Combobox Search */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  1. Selección de Cliente <span className="text-rose-400">*</span>
                </label>

                {!selectedClient ? (
                  <div className="relative" ref={comboboxRef}>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setIsDropdownOpen(true);
                          setActiveIndex(-1);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe nombre, documento, teléfono o correo..."
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                      />
                      <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#161a21] border border-[#2d3748] rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                        {displayedClients.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 space-y-1">
                            <p className="font-semibold text-slate-300">Sin coincidencias encontradas</p>
                            <p className="text-[11px] text-slate-500">Verifique el término ingresado o registre al cliente en el CRM.</p>
                          </div>
                        ) : (
                          displayedClients.map((client, idx) => (
                            <div
                              key={client.id || client.cliente_id}
                              onClick={() => handleSelectClient(client)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`p-3 border-b border-slate-800/60 last:border-0 cursor-pointer flex items-center justify-between transition-colors ${
                                activeIndex === idx ? "bg-[#252c37] text-white" : "hover:bg-[#1f242d] text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f] flex items-center justify-center font-bold text-xs shrink-0">
                                  {getInitials(client.nombre_completo)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-100 truncate">{client.nombre_completo}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {client.identificacion ? `Doc: ${client.identificacion} • ` : ""}
                                    {client.telefono_principal || client.correo || "Sin contacto"}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-sans border border-slate-700 shrink-0 ml-2">
                                {client.tipo_cliente || "Cliente"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between font-mono">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                        {getInitials(selectedClient.nombre_completo)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-100">{selectedClient.nombre_completo}</p>
                          <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-sans font-semibold border border-emerald-500/30">
                            Seleccionado
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedClient.identificacion ? `Doc: ${selectedClient.identificacion} • ` : ""}
                          Tel: {selectedClient.telefono_principal || "N/A"} • Correo: {selectedClient.correo || "N/A"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearClient}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1 font-semibold cursor-pointer"
                      title="Cambiar cliente"
                    >
                      <X size={14} /> Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Bicicleta Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  2. Bicicleta a Ingresar <span className="text-rose-400">*</span>
                </label>

                {!selectedClient ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-500 text-xs font-mono">
                    Selecciona un cliente primero para ver sus bicicletas registradas.
                  </div>
                ) : loadingBikes ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Cargando bicicletas del cliente...</span>
                  </div>
                ) : clientBicycles.length === 0 ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-amber-300 text-xs font-mono">
                    Este cliente no tiene bicicletas registradas en el sistema. Debe registrar una bicicleta en CRM primero.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientBicycles.map((bike) => {
                      const isSelected = selectedBike?.id === bike.id || selectedBike?.bicicleta_id === bike.bicicleta_id;
                      return (
                        <div
                          key={bike.id || bike.bicicleta_id}
                          onClick={() => handleSelectBike(bike)}
                          className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/50 text-slate-100 ring-1 ring-emerald-500/30"
                              : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Bike className={`w-5 h-5 ${isSelected ? "text-emerald-400" : "text-slate-400"}`} />
                            <div>
                              <p className="text-xs font-bold font-mono">
                                {bike.marca} {bike.modelo}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Año: {bike.ano || "N/A"} • SN: {bike.numero_serie_cuadro || "N/A"}
                              </p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Multi-Service & Component Selection */}
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <span>3. Servicios Solicitados & Diagnóstico Preliminar</span>
                    <span className="text-[11px] font-normal text-slate-400 font-mono">({serviciosList.length} agregados)</span>
                  </label>
                  {/* Button 'Generar OT automática' moved next to section header */}
                  <button
                    type="button"
                    onClick={() => setGenerarOrdenTrabajo(!generarOrdenTrabajo)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      generarOrdenTrabajo
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                    title="Alternar creación automática de orden de trabajo"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Generar OT automática</span>
                    <span className={`w-2 h-2 rounded-full ${generarOrdenTrabajo ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  </button>
                </div>

                {/* Sub-form to Add/Edit a Service */}
                <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-200">
                    {editingTempId ? "Editar Servicio Seleccionado" : "Agregar Nuevo Servicio a la Recepción"}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Tipo de servicio */}
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

                    {/* Precio Estimado */}
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

                    {/* Componente afectado (Sustituye a Mecánico Asignado) */}
                    <div className="md:col-span-4">
                      <label className="text-[11px] text-slate-400 mb-1 block">Componente afectado</label>
                      <select
                        value={currentBicicletaComponenteId}
                        disabled={!selectedBike || loadingComponents}
                        onChange={(e) => {
                          setCurrentBicicletaComponenteId(e.target.value);
                          setServiceSuccessMsg("");
                        }}
                        className="w-full text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <option value="">— Seleccione un componente de la bicicleta —</option>
                        <option value="">Sin componente específico (Servicio General)</option>
                        {bikeComponents.map((c) => {
                          const cid = c.bicicleta_componente_id || c.id;
                          const cName = `${c.categoria_nombre || c.categoria || "Componente"} ${c.marca || ""} ${c.modelo || ""}`.trim();
                          const snText = c.numero_serie ? ` (SN: ${c.numero_serie})` : "";
                          const stText = c.estado_nombre ? ` [${c.estado_nombre}]` : "";
                          return (
                            <option key={cid} value={cid}>
                              {cName}{snText}{stText}
                            </option>
                          );
                        })}
                      </select>
                      {selectedBike && !loadingComponents && bikeComponents.length === 0 && (
                        <p className="text-[11px] text-amber-400/90 mt-1 font-mono">
                          Esta bicicleta no tiene componentes registrados.
                        </p>
                      )}
                    </div>

                    {/* Diagnóstico Preliminar */}
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
                            setCurrentBicicletaComponenteId("");
                            setServiceDraftErrors({
                              tipo_servicio_id: "",
                              precio_estimado: "",
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
                          <th className="py-2.5 px-3">Componente Afectado</th>
                          <th className="py-2.5 px-3 text-right">Precio Est.</th>
                          <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {serviciosList.map((srv) => (
                          <tr key={srv.tempId} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-emerald-400">{srv.nombre}</td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{srv.diagnostico_preliminar || "—"}</td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono">{srv.componente_nombre || "Servicio general"}</td>
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

                {/* Work Order Fields (Prioridad and Observaciones OT only - Fecha Prometida removed) */}
                {generarOrdenTrabajo && (
                  <div className="p-4 bg-slate-950/80 border border-emerald-500/20 rounded-xl space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                      <Wrench size={14} />
                      <span>Parámetros de la Orden de Trabajo (OT)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-400 mb-1 block">Prioridad de la Orden</label>
                        <select
                          value={prioridadId}
                          onChange={(e) => setPrioridadId(e.target.value)}
                          className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-slate-700 font-medium"
                        >
                          {catalogs.prioridades.map((p) => (
                            <option key={p.prioridad_id || p.prioridad_orden_trabajo_id} value={p.prioridad_id || p.prioridad_orden_trabajo_id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-400 mb-1 block">Observaciones Internas para la Orden de Trabajo</label>
                        <textarea
                          rows={2}
                          value={observacionesOT}
                          onChange={(e) => setObservacionesOT(e.target.value)}
                          placeholder="Instrucciones adicionales para el taller..."
                          className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Triggers for Checklist & Signature (Signature visually disabled per requirements) */}
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

                {/* Signature Card Disabled Visually per Section 3.D */}
                <div
                  id="btn-firma-digital"
                  aria-disabled="true"
                  tabIndex={-1}
                  className="p-4 rounded-xl border flex items-center justify-between text-left opacity-50 cursor-not-allowed bg-slate-950/40 border-slate-800 text-slate-400 select-none relative"
                >
                  <div className="flex items-center gap-3">
                    <FileSignature className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-400">Firma Digital del Cliente</p>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded">
                          Temporalmente deshabilitada
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">No requerida para este ingreso</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <div className="text-xs text-slate-400 font-mono">
            {selectedBike ? (
              <span>Bicicleta: <strong className="text-slate-200">{selectedBike.marca} {selectedBike.modelo}</strong></span>
            ) : (
              <span>Sin bicicleta seleccionada</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingInit}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
              <span>{generarOrdenTrabajo ? "Confirmar & Generar Orden de Trabajo" : "Guardar Recepción"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modal for Inspection Checklist */}
      <ReceptionChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        itemsCatalog={catalogs.items_checklist}
        estadosCatalog={catalogs.estados_checklist}
        value={checklistState}
        onChange={(updatedChecklist) => setChecklistState(updatedChecklist)}
        onSave={(updatedChecklist) => {
          setChecklistState(updatedChecklist);
          setIsChecklistOpen(false);
        }}
      />
    </div>
  );
}
