"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Info,
  Package,
  Calculator
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
    estados_componente: [],
    productos: []
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

  // Product Autocomplete & Selection State
  const [productSearch, setProductSearch] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(-1);
  const productComboboxRef = useRef(null);
  const productSearchInputRef = useRef(null);

  // Unified Added Items (Servicios y Productos) State
  const [itemsList, setItemsList] = useState([]);
  const [editingProductTempId, setEditingProductTempId] = useState(null);
  const [editingProductQuantity, setEditingProductQuantity] = useState("");
  const [editingProductError, setEditingProductError] = useState("");
  const editingQuantityInputRef = useRef(null);

  const serviciosList = useMemo(() => itemsList.filter((i) => i.type === "servicio"), [itemsList]);
  const productosList = useMemo(() => itemsList.filter((i) => i.type === "producto"), [itemsList]);
  const totalPresupuesto = useMemo(() => {
    return itemsList.reduce((acc, item) => {
      const val = item.type === "servicio" ? Number(item.precio_estimado || 0) : Number(item.subtotal || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [itemsList]);
  const presupuestoEstimado = totalPresupuesto.toFixed(2);

  // General Reception Notes & Budget
  const [observacionesCliente, setObservacionesCliente] = useState("");
  const [diagnosticoPreliminar, setDiagnosticoPreliminar] = useState("");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);

  // Work Order Auto-Creation State
  const [generarOrdenTrabajo, setGenerarOrdenTrabajo] = useState(true);
  const [prioridadId, setPrioridadId] = useState("");

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

  // Click outside to close client, bike, service & product dropdowns
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
      if (productComboboxRef.current && !productComboboxRef.current.contains(e.target)) {
        setIsProductDropdownOpen(false);
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
        estados_componente: catObj.estados_componente || [],
        productos: catObj.productos || []
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
      productosList.length > 0 ||
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
    setSignatureData(null); // Signature is strictly invalid if customer changes

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

  // Select Bike
  const handleSelectBike = (bikeObj) => {
    setSelectedBike(bikeObj);
    setBikeSearch(bikeObj ? `${bikeObj.marca || "Bicicleta"} ${bikeObj.modelo || ""}`.trim() : "");
    setIsBikeDropdownOpen(false);
    setActiveBikeIndex(-1);
    setSignatureData(null); // Invalidate signature if bike changes
  };

  const handleClearBike = () => {
    setSelectedBike(null);
    setBikeSearch("");
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

  const handleSelectServiceCombobox = (ts) => {
    if (!ts) return;
    const priceNum = parseFloat(String(ts.precio_base || "0"));
    const priceFormatted = (isNaN(priceNum) || priceNum < 0 ? 0 : priceNum).toFixed(2);

    const serviceItem = {
      type: "servicio",
      tempId: "srv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tipo_servicio_id: Number(ts.tipo_servicio_id),
      nombre_servicio: ts.nombre || `Servicio #${ts.tipo_servicio_id}`,
      codigo: ts.codigo || null,
      cantidad: 1,
      precio_estimado: priceFormatted,
      bicicleta_componente_id: null,
      componente_nombre: "Servicio confirmado",
      nuevo_componente: null
    };

    setItemsList((prev) => [...prev, serviceItem]);
    setSignatureData(null);
    setServiceSearch("");
    setIsServiceDropdownOpen(false);
    setActiveServiceIndex(-1);
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
      } else if (displayedServices.length > 0) {
        handleSelectServiceCombobox(displayedServices[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsServiceDropdownOpen(false);
      setActiveServiceIndex(-1);
    }
  };

  // Filtered Products for Combobox
  const filteredProductsList = useMemo(() => {
    const list = catalogs.productos || [];
    if (!productSearch || !productSearch.trim()) {
      return list.slice(0, 30);
    }
    const q = normalizeText(productSearch);
    return list
      .filter((p) => {
        const nombre = normalizeText(p.nombre);
        const codigo = normalizeText(p.codigo || p.codigo_producto);
        const barra = normalizeText(p.codigo_barra);
        return nombre.includes(q) || codigo.includes(q) || barra.includes(q);
      })
      .slice(0, 30);
  }, [catalogs.productos, productSearch]);

  const handleSelectProductCombobox = (prod) => {
    if (!prod) return;
    const priceNum = parseFloat(String(prod.precio_venta !== undefined && prod.precio_venta !== null ? prod.precio_venta : "0"));
    const unitPriceFormatted = (isNaN(priceNum) || priceNum < 0 ? 0 : priceNum).toFixed(2);

    setItemsList((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.type === "producto" && Number(i.producto_id) === Number(prod.producto_id || prod.id)
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newCant = Number(existing.cantidad || 0) + 1;
        const uPrice = Number(existing.precio_unitario || 0);
        updated[existingIndex] = {
          ...existing,
          cantidad: newCant,
          subtotal: (newCant * uPrice).toFixed(2)
        };
        return updated;
      }

      const productItem = {
        type: "producto",
        tempId: "prod_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        producto_id: Number(prod.producto_id || prod.id),
        nombre: prod.nombre || `Producto #${prod.producto_id || prod.id}`,
        codigo: prod.codigo || prod.codigo_producto || null,
        cantidad: 1,
        permite_decimales: Boolean(prod.permite_decimales),
        precio_unitario: unitPriceFormatted,
        subtotal: unitPriceFormatted,
        observacion: null
      };
      return [...prev, productItem];
    });

    setSignatureData(null);
    setProductSearch("");
    setIsProductDropdownOpen(false);
    setActiveProductIndex(-1);
  };

  const handleProductKeyDown = (e) => {
    if (!isProductDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsProductDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveProductIndex((prev) => (prev < filteredProductsList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveProductIndex((prev) => (prev > 0 ? prev - 1 : filteredProductsList.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeProductIndex >= 0 && activeProductIndex < filteredProductsList.length) {
        handleSelectProductCombobox(filteredProductsList[activeProductIndex]);
      } else if (filteredProductsList.length > 0) {
        handleSelectProductCombobox(filteredProductsList[0]);
      }
    } else if (e.key === "Escape") {
      setIsProductDropdownOpen(false);
      setActiveProductIndex(-1);
    }
  };

  // Product Quantity Editing Handlers
  const handleStartEditQuantity = (item) => {
    setEditingProductTempId(item.tempId);
    setEditingProductQuantity(String(item.cantidad));
    setEditingProductError("");
  };

  const handleCancelEditQuantity = () => {
    setEditingProductTempId(null);
    setEditingProductQuantity("");
    setEditingProductError("");
  };

  const handleSaveProductQuantity = (tempId) => {
    const item = itemsList.find((i) => i.tempId === tempId);
    if (!item) return;

    const qty = parseFloat(editingProductQuantity);
    if (isNaN(qty) || qty <= 0) {
      setEditingProductError("Debe ser mayor a 0");
      return;
    }

    if (!item.permite_decimales && !Number.isInteger(qty)) {
      setEditingProductError("Solo enteros");
      return;
    }

    const unitPrice = Number(item.precio_unitario || 0);
    const newSubtotal = (qty * unitPrice).toFixed(2);

    setItemsList((prev) =>
      prev.map((i) =>
        i.tempId === tempId
          ? {
              ...i,
              cantidad: qty,
              subtotal: newSubtotal
            }
          : i
      )
    );

    setSignatureData(null);
    setEditingProductTempId(null);
    setEditingProductQuantity("");
    setEditingProductError("");
  };

  const handleDeleteItem = (tempId) => {
    setItemsList((prev) => prev.filter((s) => s.tempId !== tempId));
    setSignatureData(null);
    if (editingProductTempId === tempId) {
      setEditingProductTempId(null);
      setEditingProductQuantity("");
      setEditingProductError("");
    }
  };

  // Quick Customer Creation Callback
  const handleCustomerCreated = (newClient) => {
    setIsCustomerDrawerOpen(false);
    if (newClient) {
      const cid = newClient.cliente_id || newClient.id;
      const formattedClient = {
        ...newClient,
        id: cid,
        cliente_id: cid,
        nombre_completo: newClient.nombre_completo || `${newClient.nombre || ""} ${newClient.apellido || ""}`.trim() || newClient.nombre || "Nuevo Cliente",
        telefono_principal: newClient.telefono_principal || newClient.telefono || "",
        identificacion: newClient.identificacion || newClient.rnc_cedula || "",
        tipo_cliente: newClient.tipo_cliente || "PERSONA"
      };
      setClients((prev) => [formattedClient, ...prev.filter((c) => (c.id || c.cliente_id) !== cid)]);
      applyClientSelection(formattedClient);
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
        productos: productosList.map((p) => ({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          precio_unitario: parseFloat(p.precio_unitario)
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
              observaciones: null
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

                {/* Selección de Bicicleta & Quick Create */}
                {selectedClient && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground-secondary block">
                        Bicicleta a Recibir <span className="text-error">*</span>
                      </label>
                      {canCreateBike && (
                        <button
                          type="button"
                          onClick={() => setIsBikeDrawerOpen(true)}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Registrar Bicicleta</span>
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

                {/* Steps 3 & 4: Prioridad & Observaciones (2 Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  {/* Step 3: Prioridad de Orden de Trabajo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      3. Prioridad de Orden de Trabajo <span className="text-error">*</span>
                    </label>
                    <select
                      value={prioridadId}
                      onChange={(e) => setPrioridadId(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary font-sans"
                    >
                      {catalogs.prioridades.map((p) => (
                        <option key={p.prioridad_id || p.prioridad_orden_trabajo_id} value={p.prioridad_id || p.prioridad_orden_trabajo_id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 4: Observaciones */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      4. Observaciones
                    </label>
                    <textarea
                      value={observacionesCliente}
                      onChange={(e) => {
                        setObservacionesCliente(e.target.value);
                        setSignatureData(null);
                      }}
                      placeholder="Indique observaciones, síntomas, ruidos o requerimientos informados por el cliente..."
                      rows={2}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary resize-none font-sans"
                    />
                  </div>
                </div>

                {/* Step 5: Servicios y Productos a Utilizar */}
                <div className="space-y-3 pt-2 border-t border-border-subtle">
                  <div>
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      5. Servicios y Productos a Utilizar
                    </label>
                  </div>

                  {/* Two Column Grid: Left (Agregar Servicio), Right (Agregar Producto) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* LEFT: AGREGAR SERVICIO */}
                    <div className="p-3.5 bg-surface border border-sky-500/20 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                          <Wrench size={13} />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          Agregar Servicio
                        </span>
                      </div>

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
                            placeholder="Buscar por código o nombre de servicio..."
                            className="w-full pl-9 pr-8 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono"
                          />
                          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                        </div>

                        {isServiceDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
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
                                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-sky-400 shrink-0">
                                      <Wrench size={13} />
                                    </div>
                                    <div className="truncate">
                                      <p className="font-bold text-foreground truncate">{ts.nombre}</p>
                                      <p className="text-[10px] text-foreground-muted truncate">
                                        {ts.codigo} {ts.categoria_nombre ? `• ${ts.categoria_nombre}` : ""}{" "}
                                        {ts.duracion_estimada_horas ? `• ${Number(ts.duracion_estimada_horas).toFixed(1)}h` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-bold text-primary font-mono ml-2 shrink-0">
                                    RD$ {Number(ts.precio_base || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: AGREGAR PRODUCTO */}
                    <div className="p-3.5 bg-surface border border-lime-500/20 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 shrink-0">
                          <Package size={13} />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          Agregar Producto
                        </span>
                      </div>

                      <div className="relative" ref={productComboboxRef}>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                          <input
                            ref={productSearchInputRef}
                            type="text"
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setIsProductDropdownOpen(true);
                              setActiveProductIndex(-1);
                            }}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            onKeyDown={handleProductKeyDown}
                            placeholder="Buscar por código o nombre de producto..."
                            className="w-full pl-9 pr-8 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono"
                          />
                          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                        </div>

                        {isProductDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                            {filteredProductsList.length === 0 ? (
                              <div className="p-3 text-center text-foreground-muted text-xs">
                                Sin coincidencias encontradas
                              </div>
                            ) : (
                              filteredProductsList.map((prod, idx) => (
                                <div
                                  key={prod.producto_id || prod.id}
                                  onClick={() => handleSelectProductCombobox(prod)}
                                  className={`p-2.5 flex items-center justify-between cursor-pointer border-b border-border-subtle last:border-0 transition-colors ${
                                    activeProductIndex === idx ? "bg-hover text-foreground" : "hover:bg-hover"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-lime-400 shrink-0">
                                      <Package size={13} />
                                    </div>
                                    <div className="truncate">
                                      <p className="font-bold text-foreground truncate">{prod.nombre}</p>
                                      <p className="text-[10px] text-foreground-muted truncate">
                                        {prod.codigo || prod.codigo_producto || "S/C"} {prod.categoria_nombre ? `• ${prod.categoria_nombre}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-bold text-primary font-mono ml-2 shrink-0">
                                    RD$ {Number(prod.precio_venta || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 6: Items Agregados (Servicios y Productos) */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground-secondary block">
                      6. Items Agregados (Servicios y Productos)
                    </label>
                    <span className="text-xs font-mono text-foreground-muted">
                      {itemsList.length} {itemsList.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-surface border-b border-border text-foreground-muted font-mono text-[11px] uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3 w-28">Tipo</th>
                            <th className="py-2.5 px-3">Descripción</th>
                            <th className="py-2.5 px-3 text-center w-28">Cantidad</th>
                            <th className="py-2.5 px-3 text-right w-36">Precio Unitario (RD$)</th>
                            <th className="py-2.5 px-3 text-right w-32">Subtotal (RD$)</th>
                            <th className="py-2.5 px-3 text-center w-20">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {itemsList.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-foreground-muted font-sans text-xs">
                                No hay servicios ni productos agregados aún.
                              </td>
                            </tr>
                          ) : (
                            itemsList.map((item, index) => {
                              const isService = item.type === "servicio";
                              const isEditingThisProduct = !isService && editingProductTempId === item.tempId;
                              const unitPrice = isService ? Number(item.precio_estimado || 0) : Number(item.precio_unitario || 0);
                              const subtotal = isService ? Number(item.precio_estimado || 0) : Number(item.subtotal || 0);

                              return (
                                <tr key={item.tempId} className="hover:bg-hover/50 transition-colors">
                                  <td className="py-3 px-3 text-center text-foreground-muted font-mono">
                                    {index + 1}
                                  </td>
                                  <td className="py-3 px-3">
                                    {isService ? (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                                        <Wrench size={12} />
                                        <span>Servicio</span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-lime-500/10 border border-lime-500/20 text-lime-400 text-[10px] font-bold uppercase tracking-wider">
                                        <Package size={12} />
                                        <span>Producto</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 font-sans">
                                    <p className="font-bold text-foreground text-xs">
                                      {isService ? item.nombre_servicio : item.nombre}
                                    </p>
                                    <p className="text-[10px] text-foreground-muted font-mono">
                                      {isService
                                        ? (item.codigo ? `Código: ${item.codigo}` : "Servicio confirmado")
                                        : (item.codigo ? `Código: ${item.codigo}` : "Producto / Repuesto")}
                                    </p>
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono">
                                    {isService ? (
                                      <span className="text-foreground font-semibold">1</span>
                                    ) : isEditingThisProduct ? (
                                      <div className="inline-flex flex-col items-center gap-1">
                                        <input
                                          ref={editingQuantityInputRef}
                                          type="number"
                                          min={item.permite_decimales ? "0.01" : "1"}
                                          step={item.permite_decimales ? "0.01" : "1"}
                                          value={editingProductQuantity}
                                          onChange={(e) => {
                                            setEditingProductQuantity(e.target.value);
                                            setEditingProductError("");
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              handleSaveProductQuantity(item.tempId);
                                            } else if (e.key === "Escape") {
                                              e.preventDefault();
                                              handleCancelEditQuantity();
                                            }
                                          }}
                                          className={`w-16 px-1.5 py-1 bg-surface border rounded-lg text-center font-mono text-xs text-foreground focus:outline-none ${
                                            editingProductError ? "border-error focus:border-error" : "border-primary focus:border-primary"
                                          }`}
                                          autoFocus
                                        />
                                        {editingProductError && (
                                          <span className="text-[9px] text-error font-sans font-medium whitespace-nowrap">{editingProductError}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-foreground font-semibold">{item.cantidad}</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-foreground">
                                    {unitPrice.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                                    {subtotal.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {!isService && (
                                        isEditingThisProduct ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveProductQuantity(item.tempId)}
                                              className="p-1.5 text-primary hover:bg-primary-muted rounded-lg transition-colors cursor-pointer"
                                              title="Guardar cantidad"
                                            >
                                              <Check size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleCancelEditQuantity}
                                              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors cursor-pointer"
                                              title="Cancelar"
                                            >
                                              <X size={14} />
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditQuantity(item)}
                                            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors cursor-pointer"
                                            title="Editar cantidad"
                                          >
                                            <Edit2 size={13} />
                                          </button>
                                        )
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(item.tempId)}
                                        className="p-1.5 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar fila"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer with Total */}
                    <div className="flex items-center justify-end gap-3 px-4 py-3 bg-surface/80 border-t border-border">
                      <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                        Total:
                      </span>
                      <span className="text-sm sm:text-base font-mono font-bold text-primary">
                        RD$ {totalPresupuesto.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 7: Checklist de Inspección */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <label className="text-xs font-semibold text-foreground-secondary block">
                    7. Checklist de Inspección
                  </label>
                  <div>
                    {/* Checklist Card */}
                    <div
                      onClick={() => setIsChecklistOpen(true)}
                      className="p-3.5 bg-surface border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between"
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
                              : "Completar inspección previa de componentes"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-primary font-semibold">
                        {checklistState.length > 0 ? "Modificar" : "Abrir"}
                      </span>
                    </div>
                  </div>
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

      {/* Sub-Modal: Quick Customer Creation (Centered Modal Mode) */}
      <CustomerFormDrawer
        isOpen={isCustomerDrawerOpen}
        presentation="modal"
        onClose={() => setIsCustomerDrawerOpen(false)}
        onSuccess={handleCustomerCreated}
      />

      {/* Sub-Modal: Quick Bicycle Registration (Centered Modal Mode) */}
      <BikeFormDrawer
        isOpen={isBikeDrawerOpen}
        presentation="modal"
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
