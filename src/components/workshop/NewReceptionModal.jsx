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
  ChevronDown,
  Sparkles,
  PackagePlus,
  UserPlus,
  AlertTriangle,
  Info
} from "lucide-react";
import ReceptionChecklistModal from "./ReceptionChecklistModal";
import DigitalSignatureCanvasModal from "./DigitalSignatureCanvasModal";
import CustomerFormDrawer from "@/components/crm/CustomerFormDrawer";
import BikeFormDrawer from "@/components/crm/BikeFormDrawer";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function NewReceptionModal({ isOpen, onClose, onSuccess, onCreated }) {
  const router = useRouter();
  const navigationStartedRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const discardedStagingKeysRef = useRef([]);

  // Initial Data & Catalog States
  const [loadingInit, setLoadingInit] = useState(true);
  const [catalogs, setCatalogs] = useState({
    tipos_servicio: [],
    prioridades: [],
    mecanicos: [],
    items_checklist: [],
    estados_checklist: [],
    categorias_componente: [],
    estados_componente: []
  });
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // CRM Permissions
  const [canCreateClient, setCanCreateClient] = useState(true);
  const [canCreateBike, setCanCreateBike] = useState(true);

  // Client Autocomplete State
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const comboboxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Bicycle Autocomplete & Selection State
  const [bikeSearch, setBikeSearch] = useState("");
  const [clientBicycles, setClientBicycles] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [isBikeDropdownOpen, setIsBikeDropdownOpen] = useState(false);
  const [activeBikeIndex, setActiveBikeIndex] = useState(-1);
  const [loadingBikes, setLoadingBikes] = useState(false);
  const [bikeComponents, setBikeComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const bikeComboboxRef = useRef(null);
  const bikeSearchInputRef = useRef(null);

  // Service Type Autocomplete & Selection State
  const [serviceSearch, setServiceSearch] = useState("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [activeServiceIndex, setActiveServiceIndex] = useState(-1);
  const serviceComboboxRef = useRef(null);
  const serviceSearchInputRef = useRef(null);

  // Multi-Service State & Draft Validation Errors
  const [serviciosList, setServiciosList] = useState([]);
  const [currentServicioId, setCurrentServicioId] = useState("");
  const [currentPrecio, setCurrentPrecio] = useState("");
  const [currentBicicletaComponenteId, setCurrentBicicletaComponenteId] = useState("");
  const [editingTempId, setEditingTempId] = useState(null);
  const [addingServiceProcessing, setAddingServiceProcessing] = useState(false);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState("");

  // Inline New Component Draft State
  const [isAddingNewComponent, setIsAddingNewComponent] = useState(false);
  const [attachedNewComponent, setAttachedNewComponent] = useState(null);
  const [newComponentDraft, setNewComponentDraft] = useState({
    categoria_componente_id: "",
    estado_componente_id: "1",
    marca: "",
    numero_serie: ""
  });
  const [newComponentErrors, setNewComponentErrors] = useState({
    categoria_componente_id: "",
    estado_componente_id: "",
    numero_serie: ""
  });

  const [serviceDraftErrors, setServiceDraftErrors] = useState({
    tipo_servicio_id: "",
    precio_estimado: ""
  });

  // General Reception Notes & Budget
  const [observacionesCliente, setObservacionesCliente] = useState("");
  const [diagnosticoPreliminar, setDiagnosticoPreliminar] = useState("");
  const [presupuestoEstimado, setPresupuestoEstimado] = useState("0.00");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);

  // Work Order Auto-Creation State
  const [generarOrdenTrabajo, setGenerarOrdenTrabajo] = useState(true);
  const [prioridadId, setPrioridadId] = useState("");
  const [observacionesOT, setObservacionesOT] = useState("");

  // Digital Signature State
  const [signatureData, setSignatureData] = useState(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Sub-modals State
  const [checklistState, setChecklistState] = useState([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);
  const [isBikeDrawerOpen, setIsBikeDrawerOpen] = useState(false);

  // Confirmation Modals State
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      }
      discardedStagingKeysRef.current = [];
      navigationStartedRef.current = false;
      setGenerarOrdenTrabajo(true);
      loadInitialData();
    }
  }, [isOpen]);

  // Click outside to close client, bike & service dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
      if (bikeComboboxRef.current && !bikeComboboxRef.current.contains(e.target)) {
        setIsBikeDropdownOpen(false);
      }
      if (serviceComboboxRef.current && !serviceComboboxRef.current.contains(e.target)) {
        setIsServiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    setLoadingInit(true);
    setError("");
    try {
      const [resClients, resCats, resBikes] = await Promise.all([
        fetch("/api/crm/clientes"),
        fetch("/api/taller/catalogos"),
        fetch("/api/crm/bicicletas")
      ]);

      // Check RBAC permissions from headers
      const clientPermCrear = resClients.headers.get("x-perm-crear");
      if (clientPermCrear !== null) {
        setCanCreateClient(clientPermCrear === "true");
      }
      const bikePermCrear = resBikes.headers.get("x-perm-crear");
      if (bikePermCrear !== null) {
        setCanCreateBike(bikePermCrear === "true");
      }

      const clientsJson = await resClients.json().catch(() => []);
      const catsJson = await resCats.json().catch(() => ({}));

      const clientArr = Array.isArray(clientsJson)
        ? clientsJson
        : Array.isArray(clientsJson?.data)
        ? clientsJson.data
        : [];
      setClients(clientArr);

      const catObj = catsJson?.data || catsJson || {};
      setCatalogs({
        tipos_servicio: catObj.tipos_servicio || [],
        prioridades: catObj.prioridades || [],
        mecanicos: catObj.mecanicos || [],
        items_checklist: catObj.items_checklist || [],
        estados_checklist: catObj.estados_checklist || [],
        categorias_componente: catObj.categorias_componente || [],
        estados_componente: catObj.estados_componente || []
      });

      if (catObj.prioridades?.length > 0 && !prioridadId) {
        setPrioridadId(
          String(catObj.prioridades[0].prioridad_id || catObj.prioridades[0].prioridad_orden_trabajo_id)
        );
      }
    } catch (err) {
      console.error("Error cargando datos iniciales para recepción:", err);
      setError("No se pudieron cargar los datos necesarios. Intente de nuevo.");
    } finally {
      setLoadingInit(false);
    }
  };

  // Check if form is dirty (has unsaved modifications)
  const isFormDirty = () => {
    return Boolean(
      selectedClient ||
      selectedBike ||
      serviciosList.length > 0 ||
      observacionesCliente.trim() ||
      diagnosticoPreliminar.trim() ||
      checklistState.length > 0 ||
      signatureData ||
      attachedNewComponent
    );
  };

  // Attempt to close modal with unsaved changes verification
  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setIsCloseConfirmOpen(true);
    } else {
      performActualClose();
    }
  };

  // Handle photo replacement during checklist evaluation
  const handleChecklistPhotoReplaced = (oldKey, oldToken) => {
    if (oldKey) {
      discardedStagingKeysRef.current.push({ object_key: oldKey, upload_token: oldToken });
    }
  };

  // Final Close: Clean staging photos and notify parent
  const performActualClose = async () => {
    // Collect staging entries from checklistState & discarded
    const stagingEntries = [];
    checklistState.forEach((c) => {
      const key = c.object_key || c.s3_key || c.ruta_archivo;
      if (key && typeof key === "string" && key.startsWith("staging/")) {
        stagingEntries.push({ object_key: key, upload_token: c.upload_token });
      }
    });
    discardedStagingKeysRef.current.forEach((item) => {
      const key = typeof item === "string" ? item : item?.object_key;
      const token = typeof item === "object" ? item?.upload_token : null;
      if (key && typeof key === "string" && key.startsWith("staging/")) {
        stagingEntries.push({ object_key: key, upload_token: token });
      }
    });

    if (stagingEntries.length > 0) {
      fetch("/api/taller/evidencias/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: stagingEntries })
      }).catch(() => {});
    }

    idempotencyKeyRef.current = null;
    discardedStagingKeysRef.current = [];
    setIsCloseConfirmOpen(false);
    onClose();
  };

  // Select Client & Load Bicycles
  const handleSelectClient = (clientObj) => {
    if (!clientObj) return;

    const currentClientId = selectedClient?.id || selectedClient?.cliente_id;
    const newClientId = clientObj.id || clientObj.cliente_id;

    if (currentClientId && currentClientId === newClientId) {
      setIsDropdownOpen(false);
      return;
    }

    applyClientSelection(clientObj);
  };

  const applyClientSelection = async (clientObj) => {
    setSelectedClient(clientObj);
    setClientSearch(clientObj.nombre_completo || "");
    setIsDropdownOpen(false);
    setActiveIndex(-1);

    // Invalidate dependent items
    setSelectedBike(null);
    setClientBicycles([]);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");
    setAttachedNewComponent(null);
    setIsAddingNewComponent(false);
    setSignatureData(null); // Signature is strictly invalid if customer changes

    // Clear bike component references from services
    const sanitizedServices = serviciosList.map((s) => {
      if (s.bicicleta_componente_id) {
        return { ...s, bicicleta_componente_id: null, componente_nombre: null };
      }
      return s;
    });
    setServiciosList(sanitizedServices);

    // Fetch bicycles for the selected client
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
    setBikeSearch(bikeObj ? `${bikeObj.marca || "Bicicleta"} ${bikeObj.modelo || ""}`.trim() : "");
    setIsBikeDropdownOpen(false);
    setActiveBikeIndex(-1);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");
    setAttachedNewComponent(null);
    setIsAddingNewComponent(false);
    setSignatureData(null); // Invalidate signature if bike changes

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

  const handleClearBike = () => {
    setSelectedBike(null);
    setBikeSearch("");
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");
    setAttachedNewComponent(null);
    setIsAddingNewComponent(false);
    setSignatureData(null);
    setIsBikeDropdownOpen(false);
    if (bikeSearchInputRef.current) {
      bikeSearchInputRef.current.focus();
    }
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
    setSelectedBike(null);
    setBikeSearch("");
    setClientBicycles([]);
    setBikeComponents([]);
    setCurrentBicicletaComponenteId("");
    setAttachedNewComponent(null);
    setIsAddingNewComponent(false);
    setSignatureData(null);
    setIsDropdownOpen(false);
    setIsBikeDropdownOpen(false);
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

  const displayedClients = filteredClientsList;

  const filteredBikesList = clientBicycles.filter((b) => {
    if (!bikeSearch.trim()) return true;
    const q = normalizeText(bikeSearch);
    const marca = normalizeText(b.marca);
    const modelo = normalizeText(b.modelo);
    const sn = normalizeText(b.numero_serie_cuadro);
    const qr = normalizeText(b.codigo_qr);
    const tipo = normalizeText(b.tipo_bicicleta);
    const color = normalizeText(b.color);

    return (
      marca.includes(q) ||
      modelo.includes(q) ||
      sn.includes(q) ||
      qr.includes(q) ||
      tipo.includes(q) ||
      color.includes(q)
    );
  });

  const displayedBikes = filteredBikesList;

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

  const handleBikeKeyDown = (e) => {
    if (!isBikeDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsBikeDropdownOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveBikeIndex((prev) => (prev < displayedBikes.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveBikeIndex((prev) => (prev > 0 ? prev - 1 : displayedBikes.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeBikeIndex >= 0 && activeBikeIndex < displayedBikes.length) {
        handleSelectBike(displayedBikes[activeBikeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsBikeDropdownOpen(false);
      setActiveBikeIndex(-1);
    }
  };

  // Filtered Service Types for Searchable Combobox
  const filteredServicesList = (catalogs.tipos_servicio || []).filter((ts) => {
    if (!serviceSearch.trim()) return true;
    const q = normalizeText(serviceSearch);
    const nombre = normalizeText(ts.nombre);
    const codigo = normalizeText(ts.codigo);
    const desc = normalizeText(ts.descripcion);
    const cat = normalizeText(ts.categoria_nombre);

    return (
      nombre.includes(q) ||
      codigo.includes(q) ||
      desc.includes(q) ||
      cat.includes(q)
    );
  });

  const displayedServices = filteredServicesList;

  const selectedServiceType = (catalogs.tipos_servicio || []).find(
    (t) => String(t.tipo_servicio_id) === String(currentServicioId)
  );

  const handleSelectServiceCombobox = (ts) => {
    if (!ts) return;
    const sId = String(ts.tipo_servicio_id);
    setCurrentServicioId(sId);
    setCurrentPrecio(String(ts.precio_base || "0"));
    setServiceSearch("");
    setIsServiceDropdownOpen(false);
    setActiveServiceIndex(-1);
    setServiceDraftErrors((prev) => ({ ...prev, tipo_servicio_id: "", precio_estimado: "" }));
    setServiceSuccessMsg("");
  };

  const handleClearServiceCombobox = () => {
    setCurrentServicioId("");
    setCurrentPrecio("");
    setServiceSearch("");
    setIsServiceDropdownOpen(false);
    setActiveServiceIndex(-1);
    if (serviceSearchInputRef.current) {
      serviceSearchInputRef.current.focus();
    }
  };

  const handleServiceKeyDown = (e) => {
    if (!isServiceDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsServiceDropdownOpen(true);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveServiceIndex((prev) => (prev < displayedServices.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveServiceIndex((prev) => (prev > 0 ? prev - 1 : displayedServices.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeServiceIndex >= 0 && activeServiceIndex < displayedServices.length) {
        handleSelectServiceCombobox(displayedServices[activeServiceIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsServiceDropdownOpen(false);
      setActiveServiceIndex(-1);
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

  // Handle attaching inline component draft to service
  const handleAttachNewComponentToService = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const errs = {
      categoria_componente_id: "",
      estado_componente_id: "",
      numero_serie: ""
    };

    if (!newComponentDraft.categoria_componente_id) {
      errs.categoria_componente_id = "Seleccione una categoría para el componente.";
    } else {
      const alreadyOnBike = bikeComponents.some(
        (c) => String(c.categoria_componente_id) === String(newComponentDraft.categoria_componente_id)
      );
      if (alreadyOnBike) {
        errs.categoria_componente_id = "Ya existe un componente de esta categoría en la bicicleta.";
      }

      const alreadyInList = serviciosList.some(
        (s) =>
          s.nuevo_componente &&
          String(s.nuevo_componente.categoria_componente_id) === String(newComponentDraft.categoria_componente_id) &&
          s.tempId !== editingTempId
      );
      if (alreadyInList) {
        errs.categoria_componente_id = "Ya agregaste un nuevo componente con esta categoría en la lista.";
      }
    }

    if (!newComponentDraft.estado_componente_id) {
      errs.estado_componente_id = "Seleccione un estado de uso para el componente.";
    }

    if (errs.categoria_componente_id || errs.estado_componente_id) {
      setNewComponentErrors(errs);
      return;
    }

    const catObj = catalogs.categorias_componente.find(
      (c) => String(c.categoria_componente_id) === String(newComponentDraft.categoria_componente_id)
    );
    const estObj = catalogs.estados_componente.find(
      (e) => String(e.estado_componente_id) === String(newComponentDraft.estado_componente_id)
    );

    const preparedDraft = {
      categoria_componente_id: Number(newComponentDraft.categoria_componente_id),
      categoria_nombre: catObj ? catObj.nombre : "Componente",
      estado_componente_id: Number(newComponentDraft.estado_componente_id),
      estado_nombre: estObj ? estObj.nombre : "Nuevo",
      marca: (newComponentDraft.marca || "").trim(),
      numero_serie: (newComponentDraft.numero_serie || "").trim()
    };

    setAttachedNewComponent(preparedDraft);
    setCurrentBicicletaComponenteId("");
    setIsAddingNewComponent(false);
    setNewComponentErrors({ categoria_componente_id: "", estado_componente_id: "", numero_serie: "" });
  };

  // Add or Update service item in list with component linkage
  const handleAddOrUpdateService = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (addingServiceProcessing) return;

    const errs = {
      tipo_servicio_id: "",
      precio_estimado: ""
    };

    if (!Number(currentServicioId)) {
      errs.tipo_servicio_id = "Selecciona un tipo de servicio.";
    }

    const numPrecio = parseFloat(currentPrecio);
    if (isNaN(numPrecio) || numPrecio < 0) {
      errs.precio_estimado = "Ingrese un precio estimado válido (≥ 0.00).";
    }

    if (errs.tipo_servicio_id || errs.precio_estimado) {
      setServiceDraftErrors(errs);
      return;
    }

    setAddingServiceProcessing(true);

    const sType = catalogs.tipos_servicio.find((t) => String(t.tipo_servicio_id) === String(currentServicioId));
    const compObj = bikeComponents.find((c) => String(c.bicicleta_componente_id) === String(currentBicicletaComponenteId));

    const serviceItem = {
      tempId: editingTempId || "srv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tipo_servicio_id: Number(currentServicioId),
      nombre_servicio: sType ? sType.nombre : `Servicio #${currentServicioId}`,
      precio_estimado: numPrecio.toFixed(2),
      bicicleta_componente_id: attachedNewComponent ? null : compObj ? Number(compObj.bicicleta_componente_id) : null,
      componente_nombre: attachedNewComponent
        ? `[Nuevo] ${attachedNewComponent.categoria_nombre}${attachedNewComponent.marca ? ` (${attachedNewComponent.marca})` : ""}`
        : compObj
        ? `${compObj.categoria_nombre || "Componente"}${compObj.marca ? ` - ${compObj.marca}` : ""}`
        : null,
      nuevo_componente: attachedNewComponent ? { ...attachedNewComponent } : null
    };

    let updatedList;
    if (editingTempId) {
      updatedList = serviciosList.map((s) => (s.tempId === editingTempId ? serviceItem : s));
      setServiceSuccessMsg("Servicio actualizado correctamente.");
    } else {
      updatedList = [...serviciosList, serviceItem];
      setServiceSuccessMsg("Servicio agregado.");
    }

    setServiciosList(updatedList);
    recalculateBudget(updatedList);
    setSignatureData(null); // Invalidate signature on services modification

    // Reset sub-form
    setCurrentServicioId("");
    setCurrentPrecio("");
    setServiceSearch("");
    setIsServiceDropdownOpen(false);
    setActiveServiceIndex(-1);
    setCurrentBicicletaComponenteId("");
    setAttachedNewComponent(null);
    setIsAddingNewComponent(false);
    setEditingTempId(null);
    setServiceDraftErrors({ tipo_servicio_id: "", precio_estimado: "" });
    setNewComponentErrors({ categoria_componente_id: "", estado_componente_id: "", numero_serie: "" });
    setAddingServiceProcessing(false);

    setTimeout(() => {
      setServiceSuccessMsg("");
    }, 3000);
  };

  const handleEditServiceClick = (item) => {
    setEditingTempId(item.tempId);
    setCurrentServicioId(String(item.tipo_servicio_id));
    setCurrentPrecio(String(item.precio_estimado));
    setCurrentBicicletaComponenteId(item.bicicleta_componente_id ? String(item.bicicleta_componente_id) : "");
    if (item.nuevo_componente) {
      setAttachedNewComponent(item.nuevo_componente);
      setNewComponentDraft({
        categoria_componente_id: String(item.nuevo_componente.categoria_componente_id || ""),
        estado_componente_id: String(item.nuevo_componente.estado_componente_id || "1"),
        marca: item.nuevo_componente.marca || "",
        numero_serie: item.nuevo_componente.numero_serie || ""
      });
      setIsAddingNewComponent(false);
    } else {
      setAttachedNewComponent(null);
      setIsAddingNewComponent(false);
    }
    setServiceDraftErrors({ tipo_servicio_id: "", precio_estimado: "" });
    setNewComponentErrors({ categoria_componente_id: "", estado_componente_id: "", numero_serie: "" });
    setServiceSuccessMsg("");
  };

  const handleDeleteServiceClick = (tempId) => {
    const updated = serviciosList.filter((s) => s.tempId !== tempId);
    setServiciosList(updated);
    recalculateBudget(updated);
    setSignatureData(null); // Invalidate signature
    if (editingTempId === tempId) {
      setEditingTempId(null);
      setCurrentServicioId("");
      setCurrentPrecio("");
      setCurrentBicicletaComponenteId("");
      setAttachedNewComponent(null);
      setIsAddingNewComponent(false);
    }
  };

  const recalculateBudget = (list) => {
    const total = list.reduce((sum, item) => sum + (Number(item.precio_estimado) || 0), 0);
    setPresupuestoEstimado(total.toFixed(2));
  };

  // Quick Customer Creation Callback
  const handleCustomerCreated = (newClient) => {
    setIsCustomerDrawerOpen(false);
    if (newClient) {
      setClients((prev) => [newClient, ...prev]);
      applyClientSelection(newClient);
    }
  };

  // Quick Bicycle Creation Callback
  const handleBikeCreated = (newBikeId) => {
    setIsBikeDrawerOpen(false);
    if (selectedClient) {
      const clientId = selectedClient.id || selectedClient.cliente_id;
      fetch(`/api/crm/bicicletas?cliente_id=${clientId}`)
        .then((r) => r.json())
        .then((data) => {
          const bikesArr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
          setClientBicycles(bikesArr);
          const found = bikesArr.find(
            (b) => Number(b.id || b.bicicleta_id) === Number(newBikeId?.id || newBikeId?.bicicleta_id || newBikeId)
          );
          if (found) {
            handleSelectBike(found);
          } else if (typeof newBikeId === "object" && newBikeId !== null) {
            handleSelectBike(newBikeId);
          } else if (bikesArr.length > 0) {
            handleSelectBike(bikesArr[bikesArr.length - 1]);
          }
        })
        .catch((err) => console.error("Error refreshing bikes:", err));
    }
  };

  // Final Submit
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
        observaciones_cliente: observacionesCliente.trim() || null,
        diagnostico_preliminar: diagnosticoPreliminar.trim() || null,
        servicios: serviciosList.map((s) => ({
          tipo_servicio_id: parseInt(s.tipo_servicio_id, 10),
          precio_estimado: parseFloat(s.precio_estimado || "0"),
          bicicleta_componente_id: s.bicicleta_componente_id ? parseInt(s.bicicleta_componente_id, 10) : null,
          nuevo_componente: s.nuevo_componente
            ? {
                categoria_componente_id: parseInt(s.nuevo_componente.categoria_componente_id, 10),
                estado_componente_id: parseInt(s.nuevo_componente.estado_componente_id, 10),
                marca: s.nuevo_componente.marca || null,
                numero_serie: s.nuevo_componente.numero_serie || null
              }
            : null
        })),
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
        firma_digital: signatureData?.firma_digital || null,
        version_terminos: signatureData?.version_terminos || null,
        generar_orden_trabajo: generarOrdenTrabajo,
        idempotency_key: idempotencyKeyRef.current,
        replaced_staging_keys: discardedStagingKeysRef.current,
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

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al registrar la recepción.");
      }

      const rawOrderId = json?.data?.orden_trabajo_id ?? json?.orden_trabajo_id;
      const orderId = Number(rawOrderId);

      // Reset idempotency key upon full success
      idempotencyKeyRef.current = null;
      discardedStagingKeysRef.current = [];

      if (generarOrdenTrabajo && Number.isInteger(orderId) && orderId > 0) {
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
      setError(err.message || "Error al guardar la recepción. Puede reintentar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] bg-card border border-border sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-foreground font-sans">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary-muted border border-primary/20 rounded-xl text-primary">
                <Wrench size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                  Nueva Recepción de Bicicleta
                </h2>
                <p className="text-xs text-foreground-muted">Registro de ingreso y servicios iniciales</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {error && (
              <div className="p-3.5 bg-error-muted border border-error/30 rounded-xl flex items-start gap-2.5 text-xs text-error">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loadingInit ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-foreground-muted">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Cargando catálogos de recepción...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Step 1: Cliente Combobox Search & Quick Create */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      1. Selección de Cliente <span className="text-error">*</span>
                    </label>
                    {canCreateClient && (
                      <button
                        type="button"
                        onClick={() => setIsCustomerDrawerOpen(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <UserPlus size={13} />
                        <span>+ Registrar Cliente</span>
                      </button>
                    )}
                  </div>

                  {!selectedClient ? (
                    <div className="relative" ref={comboboxRef}>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
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
                          placeholder="Buscar por nombre, cédula, RNC o teléfono..."
                          className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono"
                        />
                        <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                      </div>

                      {isDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                          {displayedClients.length === 0 ? (
                            <div className="p-4 text-center space-y-2">
                              <p className="font-semibold text-foreground">Sin coincidencias encontradas</p>
                              {canCreateClient ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsDropdownOpen(false);
                                    setIsCustomerDrawerOpen(true);
                                  }}
                                  className="mt-2 px-3.5 py-2 bg-primary-button-bg text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 mx-auto hover:bg-primary-button-hover transition-colors cursor-pointer"
                                >
                                  <UserPlus size={14} />
                                  <span>Crear Cliente &quot;{clientSearch}&quot;</span>
                                </button>
                              ) : (
                                <p className="text-[11px] text-foreground-muted flex items-center justify-center gap-1">
                                  <Info size={13} className="text-info" />
                                  <span>No tienes permiso para registrar clientes. Selecciona uno existente.</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            displayedClients.map((client, idx) => (
                              <div
                                key={client.id || client.cliente_id}
                                onClick={() => handleSelectClient(client)}
                                className={`p-3 flex items-center justify-between cursor-pointer border-b border-border-subtle last:border-0 transition-colors ${
                                  activeIndex === idx ? "bg-hover text-foreground" : "hover:bg-hover"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-primary shrink-0">
                                    {getInitials(client.nombre_completo)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground">{client.nombre_completo}</p>
                                    <p className="text-[11px] text-foreground-muted">
                                      {client.identificacion ? `${client.identificacion} • ` : ""}Tel: {client.telefono_principal || "Sin teléfono"}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-foreground-muted bg-surface px-2 py-0.5 rounded">
                                  {client.tipo_cliente || "Persona"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-surface border border-border rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-muted border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0 font-mono">
                          {getInitials(selectedClient.nombre_completo)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-xs">{selectedClient.nombre_completo}</span>
                            <span className="text-[10px] uppercase font-bold text-primary bg-primary-muted px-2 py-0.5 rounded">
                              {selectedClient.tipo_cliente || "Persona"}
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground-muted font-mono mt-0.5">
                            Doc: {selectedClient.identificacion || "—"} | Tel: {selectedClient.telefono_principal || "—"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="p-1.5 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer"
                        title="Cambiar cliente"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Step 2: Selección de Bicicleta & Quick Create */}
                {selectedClient && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground-secondary block">
                        2. Bicicleta a Recibir <span className="text-error">*</span>
                      </label>
                      {canCreateBike && (
                        <button
                          type="button"
                          onClick={() => setIsBikeDrawerOpen(true)}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>+ Registrar Bicicleta</span>
                        </button>
                      )}
                    </div>

                    {loadingBikes ? (
                      <div className="p-4 bg-surface border border-border rounded-xl flex items-center justify-center gap-2 text-xs text-foreground-muted font-mono">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Cargando bicicletas del cliente...</span>
                      </div>
                    ) : !selectedBike ? (
                      <div className="relative" ref={bikeComboboxRef}>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                          <input
                            ref={bikeSearchInputRef}
                            type="text"
                            value={bikeSearch}
                            onChange={(e) => {
                              setBikeSearch(e.target.value);
                              setIsBikeDropdownOpen(true);
                              setActiveBikeIndex(-1);
                            }}
                            onFocus={() => setIsBikeDropdownOpen(true)}
                            onKeyDown={handleBikeKeyDown}
                            placeholder={
                              clientBicycles.length === 0
                                ? "No hay bicicletas registradas para este cliente..."
                                : "Buscar por marca, modelo, tipo, color o número de serie..."
                            }
                            className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono"
                          />
                          <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                        </div>

                        {isBikeDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                            {clientBicycles.length === 0 ? (
                              <div className="p-4 text-center space-y-2">
                                <p className="text-xs text-foreground-muted">Este cliente no tiene bicicletas registradas.</p>
                                {canCreateBike ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsBikeDropdownOpen(false);
                                      setIsBikeDrawerOpen(true);
                                    }}
                                    className="px-3.5 py-2 bg-primary-button-bg text-primary-foreground font-bold rounded-xl text-xs inline-flex items-center gap-1.5 hover:bg-primary-button-hover transition-colors cursor-pointer"
                                  >
                                    <Bike size={14} />
                                    <span>Registrar Primera Bicicleta</span>
                                  </button>
                                ) : (
                                  <p className="text-[11px] text-foreground-muted flex items-center justify-center gap-1">
                                    <Info size={13} className="text-info" />
                                    <span>No posees permisos para registrar bicicletas en el CRM.</span>
                                  </p>
                                )}
                              </div>
                            ) : displayedBikes.length === 0 ? (
                              <div className="p-4 text-center space-y-2">
                                <p className="font-semibold text-foreground">Sin coincidencias encontradas</p>
                                {canCreateBike ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsBikeDropdownOpen(false);
                                      setIsBikeDrawerOpen(true);
                                    }}
                                    className="mt-2 px-3.5 py-2 bg-primary-button-bg text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 mx-auto hover:bg-primary-button-hover transition-colors cursor-pointer"
                                  >
                                    <Plus size={14} />
                                    <span>Registrar Bicicleta &quot;{bikeSearch}&quot;</span>
                                  </button>
                                ) : (
                                  <p className="text-[11px] text-foreground-muted flex items-center justify-center gap-1">
                                    <Info size={13} className="text-info" />
                                    <span>No posees permisos para registrar bicicletas en el CRM.</span>
                                  </p>
                                )}
                              </div>
                            ) : (
                              displayedBikes.map((bike, idx) => (
                                <div
                                  key={bike.id || bike.bicicleta_id}
                                  onClick={() => handleSelectBike(bike)}
                                  className={`p-3 flex items-center justify-between cursor-pointer border-b border-border-subtle last:border-0 transition-colors ${
                                    activeBikeIndex === idx ? "bg-hover text-foreground" : "hover:bg-hover"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-primary shrink-0">
                                      <Bike size={16} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground">
                                        {bike.marca || "Bicicleta"} {bike.modelo || ""}
                                      </p>
                                      <p className="text-[11px] text-foreground-muted">
                                        {bike.tipo_bicicleta || "General"} {bike.color ? `• ${bike.color}` : ""}{" "}
                                        {bike.numero_serie_cuadro ? `• S/N: ${bike.numero_serie_cuadro}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] uppercase font-bold text-primary bg-primary-muted px-2 py-0.5 rounded">
                                    {bike.tipo_bicicleta || "Bicicleta"}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-surface border border-border rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-muted border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0 font-mono">
                            <Bike size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-xs">
                                {selectedBike.marca || "Bicicleta"} {selectedBike.modelo || ""}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-primary bg-primary-muted px-2 py-0.5 rounded">
                                {selectedBike.tipo_bicicleta || "Bicicleta"}
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground-muted font-mono mt-0.5">
                              {selectedBike.color ? `Color: ${selectedBike.color} | ` : ""}
                              {selectedBike.numero_serie_cuadro ? `S/N: ${selectedBike.numero_serie_cuadro} | ` : ""}
                              QR: {selectedBike.codigo_qr || "Sin QR"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearBike}
                          className="p-1.5 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer"
                          title="Cambiar bicicleta"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Motivo de Ingreso del Cliente */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground-secondary block">
                    Motivo de Ingreso (Declarado por el Cliente)
                  </label>
                  <textarea
                    value={observacionesCliente}
                    onChange={(e) => {
                      setObservacionesCliente(e.target.value);
                      setSignatureData(null);
                    }}
                    placeholder="Indique los síntomas, ruidos o requerimientos que expresa el cliente..."
                    rows={2}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Step 4: Multi-Service Configuration */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      3. Servicios a Realizar <span className="text-error">*</span>
                    </label>
                    <span className="text-xs font-mono text-primary font-bold">
                      Presupuesto: RD$ {presupuestoEstimado}
                    </span>
                  </div>

                  {/* Sub-form to Add/Edit Service */}
                  <div className="p-3.5 bg-surface border border-border rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] text-foreground-muted mb-1 font-semibold">
                          Tipo de Servicio <span className="text-error">*</span>
                        </label>
                        {!selectedServiceType ? (
                          <div className="relative" ref={serviceComboboxRef}>
                            <div className="relative">
                              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                              <input
                                ref={serviceSearchInputRef}
                                type="text"
                                value={serviceSearch}
                                onChange={(e) => {
                                  setServiceSearch(e.target.value);
                                  setIsServiceDropdownOpen(true);
                                  setActiveServiceIndex(-1);
                                }}
                                onFocus={() => setIsServiceDropdownOpen(true)}
                                onKeyDown={handleServiceKeyDown}
                                placeholder="Buscar por código o servicio..."
                                className={`w-full pl-9 pr-8 py-2 bg-card border rounded-lg text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono ${
                                  serviceDraftErrors.tipo_servicio_id ? "border-error focus:border-error" : "border-border"
                                }`}
                              />
                              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                            </div>

                            {isServiceDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                                {displayedServices.length === 0 ? (
                                  <div className="p-3 text-center text-foreground-muted text-xs">
                                    Sin coincidencias encontradas
                                  </div>
                                ) : (
                                  displayedServices.map((ts, idx) => (
                                    <div
                                      key={ts.tipo_servicio_id}
                                      onClick={() => handleSelectServiceCombobox(ts)}
                                      className={`p-2.5 flex items-center justify-between cursor-pointer border-b border-border-subtle last:border-0 transition-colors ${
                                        activeServiceIndex === idx ? "bg-hover text-foreground" : "hover:bg-hover"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-primary shrink-0">
                                          <Wrench size={14} />
                                        </div>
                                        <div className="truncate">
                                          <p className="font-bold text-foreground truncate">{ts.nombre}</p>
                                          <p className="text-[10px] text-foreground-muted truncate">
                                            {ts.codigo} {ts.categoria_nombre ? `• ${ts.categoria_nombre}` : ""}{" "}
                                            {ts.duracion_estimada_horas ? `• ${Number(ts.duracion_estimada_horas).toFixed(1)}h` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-bold text-emerald-400 font-mono ml-2 shrink-0">
                                        RD$ {Number(ts.precio_base || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-card border border-border rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-primary-muted border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0 font-mono">
                                <Wrench size={14} />
                              </div>
                              <div className="truncate">
                                <p className="font-bold text-foreground text-xs truncate">{selectedServiceType.nombre}</p>
                                <p className="text-[10px] text-foreground-muted font-mono truncate">
                                  {selectedServiceType.codigo} • Base: RD$ {Number(selectedServiceType.precio_base || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleClearServiceCombobox}
                              className="p-1 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                              title="Cambiar tipo de servicio"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        {serviceDraftErrors.tipo_servicio_id && (
                          <p className="text-error text-[10px] mt-1">{serviceDraftErrors.tipo_servicio_id}</p>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] text-foreground-muted mb-1">Precio Estimado (RD$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={currentPrecio}
                          onChange={(e) => {
                            setCurrentPrecio(e.target.value);
                            setServiceDraftErrors((prev) => ({ ...prev, precio_estimado: "" }));
                          }}
                          placeholder="0.00"
                          className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                        />
                        {serviceDraftErrors.precio_estimado && (
                          <p className="text-error text-[10px] mt-1">{serviceDraftErrors.precio_estimado}</p>
                        )}
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] text-foreground-muted mb-1">Componente Vinculado</label>
                        {attachedNewComponent ? (
                          <div className="p-2 bg-primary-muted border border-primary/30 rounded-lg text-xs text-primary flex items-center justify-between">
                            <span className="truncate">{attachedNewComponent.categoria_nombre}</span>
                            <button
                              type="button"
                              onClick={() => setAttachedNewComponent(null)}
                              className="text-foreground-muted hover:text-error text-xs"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <select
                            value={currentBicicletaComponenteId}
                            onChange={(e) => setCurrentBicicletaComponenteId(e.target.value)}
                            disabled={!selectedBike || bikeComponents.length === 0}
                            className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">General (Sin componente específico)</option>
                            {bikeComponents.map((c) => (
                              <option key={c.bicicleta_componente_id} value={c.bicicleta_componente_id}>
                                {c.categoria_nombre || "Componente"}{c.marca ? ` - ${c.marca}` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {editingTempId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTempId(null);
                            setCurrentServicioId("");
                            setCurrentPrecio("");
                            setCurrentBicicletaComponenteId("");
                            setAttachedNewComponent(null);
                          }}
                          className="px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground"
                        >
                          Cancelar Edición
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddOrUpdateService}
                        className="px-4 py-1.5 bg-primary-button-bg text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary-button-hover transition-colors flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>{editingTempId ? "Actualizar Servicio" : "Agregar Servicio"}</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Added Services */}
                  {serviciosList.length > 0 && (
                    <div className="space-y-1.5">
                      {serviciosList.map((srv) => (
                        <div
                          key={srv.tempId}
                          className="p-2.5 bg-surface border border-border rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-foreground">{srv.nombre_servicio}</span>
                            {srv.componente_nombre && (
                              <span className="ml-2 text-[11px] text-foreground-muted font-mono">
                                ({srv.componente_nombre})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-primary">
                              RD$ {parseFloat(srv.precio_estimado).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditServiceClick(srv)}
                                className="p-1 text-foreground-muted hover:text-foreground"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteServiceClick(srv.tempId)}
                                className="p-1 text-foreground-muted hover:text-error"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 5: Checklist & Digital Signature Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  {/* Checklist Card */}
                  <div
                    onClick={() => setIsChecklistOpen(true)}
                    className="p-4 bg-surface border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-muted border border-primary/20 rounded-lg text-primary">
                        <ClipboardCheck size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">Checklist de Inspección</p>
                        <p className="text-[11px] text-foreground-muted">
                          {checklistState.length > 0
                            ? `${checklistState.length} puntos evaluados`
                            : "Completar inspección previa"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary font-semibold">
                      {checklistState.length > 0 ? "Modificar" : "Abrir"}
                    </span>
                  </div>

                  {/* Digital Signature Card (Deshabilitada) */}
                  <div
                    className="p-4 bg-surface/50 border border-border/40 rounded-xl opacity-50 cursor-not-allowed select-none flex items-center justify-between"
                    title="Firma digital deshabilitada temporalmente"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-card border border-border/40 rounded-lg text-foreground-muted">
                        <FileSignature size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground-muted">Firma de Consentimiento</p>
                        <p className="text-[11px] text-foreground-muted/70">
                          Deshabilitada (No requerida)
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-foreground-muted font-semibold bg-card px-2 py-0.5 rounded border border-border/40">
                      Deshabilitada
                    </span>
                  </div>
                </div>

                {/* Step 6: Orden de Trabajo Auto-Generation Settings */}
                <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                  generarOrdenTrabajo
                    ? "bg-[#bfce7f]/10 border-[#bfce7f]/40 shadow-sm"
                    : "bg-surface border-border"
                }`}>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={generarOrdenTrabajo}
                      onChange={(e) => setGenerarOrdenTrabajo(e.target.checked)}
                      className="rounded border-border accent-[#bfce7f] h-4 w-4 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-foreground">
                      Generar automáticamente Orden de Trabajo (OT) al registrar la recepción
                    </span>
                  </label>

                  {generarOrdenTrabajo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] text-foreground-muted mb-1">Prioridad de OT</label>
                        <select
                          value={prioridadId}
                          onChange={(e) => setPrioridadId(e.target.value)}
                          className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
                        >
                          {catalogs.prioridades.map((p) => (
                            <option key={p.prioridad_id} value={p.prioridad_id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-foreground-muted mb-1">Observaciones Internas de OT</label>
                        <input
                          type="text"
                          value={observacionesOT}
                          onChange={(e) => setObservacionesOT(e.target.value)}
                          placeholder="Instrucciones para el equipo técnico..."
                          className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-surface flex items-center justify-between shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={handleAttemptClose}
              className="px-4 py-2 bg-surface border border-border hover:bg-hover text-foreground-muted hover:text-foreground font-mono text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={submitting || !selectedClient || !selectedBike}
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-primary-button-bg text-primary-foreground hover:bg-primary-button-hover font-mono text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Procesando Recepción...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Registrar Recepción</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modal: Quick Customer Creation (CRM Drawer) */}
      <CustomerFormDrawer
        isOpen={isCustomerDrawerOpen}
        onClose={() => setIsCustomerDrawerOpen(false)}
        onSuccess={handleCustomerCreated}
      />

      {/* Sub-Modal: Quick Bicycle Registration (CRM Drawer) */}
      <BikeFormDrawer
        isOpen={isBikeDrawerOpen}
        lockCliente={true}
        preselectedClienteId={selectedClient?.id || selectedClient?.cliente_id}
        preselectedClienteName={selectedClient?.nombre_completo}
        clientes={clients}
        onClose={() => setIsBikeDrawerOpen(false)}
        onSuccess={handleBikeCreated}
      />

      {/* Sub-Modal: Checklist */}
      <ReceptionChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        itemsCatalog={catalogs.items_checklist}
        estadosCatalog={catalogs.estados_checklist}
        checklistState={checklistState}
        onChangeChecklist={(newItems) => {
          setChecklistState(newItems);
          setSignatureData(null); // Invalidate signature on checklist modification
        }}
        onPhotoReplaced={handleChecklistPhotoReplaced}
      />

      {/* Sub-Modal: Digital Signature */}
      <DigitalSignatureCanvasModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onConfirm={(sigData) => {
          setSignatureData(sigData);
        }}
      />

      {/* Confirmation Dialog: Unsaved Changes on Exit */}
      <SecurityConfirmDialog
        isOpen={isCloseConfirmOpen}
        onClose={() => setIsCloseConfirmOpen(false)}
        onConfirm={performActualClose}
        title="Cambios Sin Guardar"
        description="Tienes cambios sin guardar en esta recepción. Si sales ahora, se descartarán los datos capturados y las fotos temporales. ¿Deseas salir?"
        confirmLabel="Descartar y Salir"
        cancelLabel="Continuar Editando"
        variant="danger"
      />
    </>
  );
}
