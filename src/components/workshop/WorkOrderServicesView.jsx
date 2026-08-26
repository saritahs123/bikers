"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Plus,
  Wrench,
  Package,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  AlertTriangle,
  Play,
  Pause,
  ArrowLeft,
  Layers,
  Sparkles,
  Info
} from "lucide-react";
import { getServiceStateRules } from "@/lib/workshop-state-machine";

// PORTAL MODAL SHELL (Directly rendered to document.body)
function WorkshopItemModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = "760px"
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workshop-item-modal-title"
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <section
        className="relative z-10 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl font-sans"
        style={{
          width: `min(${maxWidth}, calc(100vw - 32px))`,
          maxHeight: "calc(100vh - 32px)"
        }}
      >
        <header className="shrink-0 border-b border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between font-mono">
          <div>
            <h2
              id="workshop-item-modal-title"
              className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-slate-400 font-sans">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 custom-scrollbar font-mono text-xs">
          {children}
        </div>

        <footer className="shrink-0 border-t border-slate-800 bg-slate-950/80 px-6 py-4 font-sans">
          {footer}
        </footer>
      </section>
    </div>,
    document.body
  );
}

export default function WorkOrderServicesView({ ordenId, services = [], onRefresh, order, backUrl, onStartRepair = null }) {
  const [tiposServicio, setTiposServicio] = useState([]);
  const [productosList, setProductosList] = useState([]);
  const [mecanicosCatalog, setMecanicosCatalog] = useState([]);
  const [estadosComponenteCatalog, setEstadosComponenteCatalog] = useState([]);
  const [categoriasComponenteCatalog, setCategoriasComponenteCatalog] = useState([]);
  const [estadosServicio, setEstadosServicio] = useState([
    { estado_orden_servicio_id: 1, nombre: "Pendiente", codigo: "PENDIENTE" },
    { estado_orden_servicio_id: 2, nombre: "En Proceso", codigo: "EN_PROCESO" },
    { estado_orden_servicio_id: 3, nombre: "Completado", codigo: "COMPLETADO" },
    { estado_orden_servicio_id: 4, nombre: "Cancelado", codigo: "CANCELADO" },
    { estado_orden_servicio_id: 5, nombre: "Suspendido", codigo: "SUSPENDIDO" }
  ]);

  // Global Timer Reference Timestamp (updates every second)
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  // Global 1-second Interval Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals & UI States
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Unified Item Modal Form States
  const [itemType, setItemType] = useState("SERVICIO"); // "SERVICIO" | "PRODUCTO"
  const [formTipoServicioId, setFormTipoServicioId] = useState("");
  const [formBicicletaComponenteId, setFormBicicletaComponenteId] = useState("");
  const [formNuevoEstadoComponenteId, setFormNuevoEstadoComponenteId] = useState("");
  const [formProductoId, setFormProductoId] = useState("");
  const [formCantidad, setFormCantidad] = useState("1");
  const [formPrecioUnitario, setFormPrecioUnitario] = useState("");
  const [formDescuentoPct, setFormDescuentoPct] = useState("0");
  const [formObservaciones, setFormObservaciones] = useState("");
  const [formConfirmAdicional, setFormConfirmAdicional] = useState(false);
  const [formMotivoAdicional, setFormMotivoAdicional] = useState("");

  // Bike Component Loading States
  const [bicycleComponents, setBicycleComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [componentsError, setComponentsError] = useState("");

  // Local Pending New Component Draft (NOT yet persisted to DB)
  const [pendingNewComponent, setPendingNewComponent] = useState(null);

  // Inline New Component Form States
  const [showInlineComponentForm, setShowInlineComponentForm] = useState(false);
  const [newComponentDraft, setNewComponentDraft] = useState({
    categoria_componente_id: "",
    marca: "",
    estado_componente_id: "",
    numero_serie: ""
  });
  const [newComponentErrors, setNewComponentErrors] = useState({});
  const [savingComponent, setSavingComponent] = useState(false);
  const [componentCreationMessage, setComponentCreationMessage] = useState("");

  // Missing Component Status Modal on Service Finish
  const [completeComponentModalOpen, setCompleteComponentModalOpen] = useState(false);
  const [completeTargetService, setCompleteTargetService] = useState(null);
  const [selectedFinalStateId, setSelectedFinalStateId] = useState("");

  // Custom Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalOnConfirm, setConfirmModalOnConfirm] = useState(null);
  const [confirmModalType, setConfirmModalType] = useState("delete");

  // Loading & Toast States
  const [processingServiceId, setProcessingServiceId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [existingComponentSuggestionId, setExistingComponentSuggestionId] = useState(null);
  const [toast, setToast] = useState(null);

  // Idempotency and Refresh states
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [refreshFailed, setRefreshFailed] = useState(false);

  const generateUUID = () => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "idx-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now();
  };

  const showToast = (msg, type = "success", title = null, duration = 4500, subtext = null) => {
    if (typeof msg === "object" && msg !== null && msg.text) {
      setToast(msg);
    } else {
      setToast({ text: String(msg || ""), type, title, subtext });
    }
    setTimeout(() => setToast(null), duration);
  };

  const showErrorToast = (msg, title = "Error u Operación", duration = 5000) => showToast(msg, "error", title, duration);
  const showWarningToast = (msg, title = "Aviso de Operación", duration = 6500, subtext = null) => showToast(msg, "warning", title, duration, subtext);
  const showInfoToast = (msg, title = "Información", duration = 7500, subtext = null) => showToast(msg, "info", title, duration, subtext);
  const showSuccessToast = (msg, title = "Confirmación", duration = 4500) => showToast(msg, "success", title, duration);

  const askConfirmation = (title, message, onConfirm, type = "delete") => {
    setConfirmModalTitle(title);
    setConfirmModalMessage(message);
    setConfirmModalOnConfirm(() => onConfirm);
    setConfirmModalType(type);
    setConfirmModalOpen(true);
  };

  // Load Catalogs
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const catalogosRes = await fetch("/api/taller/catalogos");
        if (catalogosRes.ok) {
          const cData = await catalogosRes.json();
          setTiposServicio(cData.tipos_servicio || cData.data?.tipos_servicio || []);
          setProductosList(cData.productos || cData.data?.productos || []);
          setMecanicosCatalog(cData.mecanicos || cData.data?.mecanicos || []);
          setEstadosComponenteCatalog(cData.estados_componente || cData.data?.estados_componente || []);
          setCategoriasComponenteCatalog(cData.categorias_componente || cData.data?.categorias_componente || []);
          if (cData.estados_servicio || cData.data?.estados_servicio) {
            setEstadosServicio(cData.estados_servicio || cData.data?.estados_servicio);
          }
        }
      } catch (err) {
        console.error("Error loading catalogs:", err);
      }
    }
    loadCatalogs();
  }, []);

  // Normalized Bike ID from order
  const orderBicycleId = Number(
    order?.bicicleta_id ??
    order?.bicicleta?.bicicleta_id
  );

  // Load Bike Components when Item Modal opens in SERVICIO mode
  const fetchBikeComponents = async (controllerSignal) => {
    if (!Number.isInteger(orderBicycleId) || orderBicycleId <= 0) {
      setBicycleComponents([]);
      setComponentsError("No fue posible identificar la bicicleta asociada a esta orden.");
      return;
    }

    setLoadingComponents(true);
    setComponentsError("");

    try {
      const response = await fetch(`/api/crm/bicicletas/${orderBicycleId}/components`, {
        signal: controllerSignal,
        cache: "no-store"
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || "No pudimos cargar los componentes de la bicicleta.");
      }

      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.components)
        ? json.components
        : [];

      const normalized = rows
        .map((component) => ({
          bicicleta_componente_id: Number(component.bicicleta_componente_id ?? component.id),
          bicicleta_id: Number(component.bicicleta_id ?? orderBicycleId),
          categoria_componente_id: Number(component.categoria_componente_id ?? component.categoria_id),
          categoria_nombre: component.categoria_nombre ?? component.categoria ?? "Componente",
          marca: component.marca ?? "",
          modelo: component.modelo ?? component.especificacion ?? "",
          numero_serie: component.numero_serie ?? "",
          estado_nombre: component.estado_nombre ?? "Sin estado",
          nivel_desgaste: component.nivel_desgaste ?? 0,
          porcentaje_salud: component.nivel_desgaste !== undefined
            ? Math.max(0, 100 - Number(component.nivel_desgaste))
            : 100,
          activo: component.activo !== false
        }))
        .filter((component) =>
          Number.isInteger(component.bicicleta_componente_id) &&
          component.bicicleta_componente_id > 0 &&
          component.activo
        );

      setBicycleComponents(normalized);
    } catch (error) {
      if (error.name !== "AbortError") {
        setBicycleComponents([]);
        setComponentsError(error.message);
      }
    } finally {
      setLoadingComponents(false);
    }
  };

  const existingCategoryIds = useMemo(() => {
    const ids = new Set();
    (bicycleComponents || []).forEach(c => {
      const catId = Number(c.categoria_componente_id);
      if (Number.isInteger(catId) && catId > 0) {
        ids.add(catId);
      }
    });
    if (pendingNewComponent?.categoria_componente_id) {
      const pendingCatId = Number(pendingNewComponent.categoria_componente_id);
      if (Number.isInteger(pendingCatId) && pendingCatId > 0) {
        ids.add(pendingCatId);
      }
    }
    return ids;
  }, [bicycleComponents, pendingNewComponent]);

  const availableCategoriesCount = (categoriasComponenteCatalog || []).filter(
    (cat) => !existingCategoryIds.has(Number(cat.categoria_componente_id))
  ).length;

  const allCategoriesRegistered = (categoriasComponenteCatalog || []).length > 0 && availableCategoriesCount === 0;

  useEffect(() => {
    if (!itemModalOpen || itemType !== "SERVICIO") {
      setShowInlineComponentForm(false);
      setNewComponentErrors({});
      return;
    }

    const controller = new AbortController();
    fetchBikeComponents(controller.signal);

    return () => controller.abort();
  }, [itemModalOpen, itemType, orderBicycleId]);

  // Derived Permission & Visibility Flags
  const canCreateInlineComponent = !isEditing && itemType === "SERVICIO";

  const normalizedItemType = String(itemType || "").trim().toUpperCase();
  const isServiceMode = normalizedItemType === "SERVICIO" || normalizedItemType === "SERVICE";

  const estadoFromCatalog = (estadosServicio || []).find(
    (state) => Number(state.estado_orden_servicio_id) === Number(editingItem?.estado_servicio_id)
  );

  const effectiveStateCode = String(
    editingItem?.estado_servicio_codigo ||
    estadoFromCatalog?.codigo ||
    (Number(editingItem?.estado_servicio_id) === 2 ? "EN_PROCESO" : Number(editingItem?.estado_servicio_id) === 5 ? "PAUSADO" : Number(editingItem?.estado_servicio_id) === 1 ? "PENDIENTE" : Number(editingItem?.estado_servicio_id) === 3 ? "COMPLETADO" : "")
  ).trim().toUpperCase();

  const tieneComponenteEdit =
    Number.isInteger(Number(editingItem?.bicicleta_componente_id)) &&
    Number(editingItem?.bicicleta_componente_id) > 0;

  const puedeFinalizarEdit =
    effectiveStateCode === "EN_PROCESO" ||
    effectiveStateCode === "PAUSADO" ||
    effectiveStateCode === "SUSPENDIDO";

  const showFinalComponentStateField =
    Boolean(isEditing) &&
    isServiceMode &&
    tieneComponenteEdit &&
    puedeFinalizarEdit;
  const canSetFinalComponentState = showFinalComponentStateField;

  // Inline Component Form Handlers (LOCAL DRAFT ONLY, NO HTTP REQUEST)
  const handleOpenInlineComponentForm = () => {
    setShowInlineComponentForm(true);
    setNewComponentErrors({});
    setComponentCreationMessage("");
    setNewComponentDraft({
      categoria_componente_id: pendingNewComponent ? String(pendingNewComponent.categoria_componente_id || "") : "",
      marca: pendingNewComponent ? pendingNewComponent.marca || "" : "",
      estado_componente_id: pendingNewComponent ? String(pendingNewComponent.estado_componente_id || "") : "",
      numero_serie: pendingNewComponent ? pendingNewComponent.numero_serie || "" : ""
    });
  };

  const handleCancelInlineComponentForm = () => {
    setShowInlineComponentForm(false);
    setNewComponentErrors({});
    setComponentCreationMessage("");
  };

  const handleSaveInlineComponentLocal = (e) => {
    e.preventDefault();
    setNewComponentErrors({});
    setComponentCreationMessage("");

    const catId = parseInt(newComponentDraft.categoria_componente_id, 10);
    const stateId = parseInt(newComponentDraft.estado_componente_id, 10);
    const marca = (newComponentDraft.marca || "").trim();
    const serial = (newComponentDraft.numero_serie || "").trim();

    const errs = {};
    if (isNaN(catId) || catId <= 0) {
      errs.categoria_componente_id = "Selecciona una categoría.";
    } else if (existingCategoryIds.has(catId)) {
      errs.categoria_componente_id = "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.";
    }
    if (isNaN(stateId) || stateId <= 0) {
      errs.estado_componente_id = "Selecciona el estado actual del componente.";
    }

    if (Object.keys(errs).length > 0) {
      setNewComponentErrors(errs);
      return;
    }

    const catObj = categoriasComponenteCatalog.find(c => String(c.categoria_componente_id) === String(catId));
    const stateObj = estadosComponenteCatalog.find(e => String(e.estado_componente_id) === String(stateId));

    const draft = {
      isNew: true,
      temporaryId: `TEMP-${Date.now()}`,
      categoria_componente_id: catId,
      categoria_nombre: catObj?.nombre || "Componente",
      estado_componente_id: stateId,
      estado_nombre: stateObj?.nombre || "Nuevo",
      nivel_desgaste: stateObj?.nivel_desgaste ?? 0,
      porcentaje_salud: stateObj?.nivel_desgaste !== undefined ? Math.max(0, 100 - Number(stateObj.nivel_desgaste)) : 100,
      marca,
      numero_serie: serial
    };

    setPendingNewComponent(draft);
    setFormBicicletaComponenteId("");
    setShowInlineComponentForm(false);
  };

  const handleEditPendingComponent = () => {
    if (!pendingNewComponent) return;
    setNewComponentDraft({
      categoria_componente_id: String(pendingNewComponent.categoria_componente_id || ""),
      estado_componente_id: String(pendingNewComponent.estado_componente_id || ""),
      marca: pendingNewComponent.marca || "",
      numero_serie: pendingNewComponent.numero_serie || ""
    });
    setShowInlineComponentForm(true);
  };

  const handleRemovePendingComponent = () => {
    setPendingNewComponent(null);
    setShowInlineComponentForm(false);
  };

  const getServId = (s) => (s ? Number(s.servicio_id ?? s.orden_servicio_id) : null);

  // Format Date as "dia/mes/año hora:minutos a. m. / p. m." (e.g. "19/08/2026 12:46 a. m.")
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "p. m." : "a. m.";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
  };

  // Format Timer HH:MM:SS
  const formatSecondsToHHMMSS = (totalSec) => {
    const s = Math.max(0, Math.floor(Number(totalSec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Compute live elapsed seconds for a service row
  const getElapsedSecondsForService = (svc) => {
    const cron = svc?.cronometro;
    const segundosAcumulados = Number(svc?.tiempo_transcurrido ?? cron?.segundos_acumulados ?? 0);

    if (cron?.activo && cron?.fecha_inicio_sesion) {
      const startMs = new Date(cron.fecha_inicio_sesion).getTime();
      const elapsedSec = Math.max(0, Math.floor((nowTimestamp - startMs) / 1000));
      return segundosAcumulados + elapsedSec;
    }

    return Number(segundosAcumulados);
  };

  // Products array from order
  const orderProducts = order?.productos || [];



  const isOrderRecibida = Number(order?.estado_orden_id || order?.estado_id || 1) === 1;

  const orderStateCode = String(
    order?.estado_codigo ||
    order?.estado_orden_codigo ||
    (Number(order?.estado_orden_id) === 5 ? "REPARACION" : Number(order?.estado_orden_id) === 7 ? "LISTA_ENTREGA" : Number(order?.estado_orden_id) === 8 ? "ENTREGADA" : Number(order?.estado_orden_id) === 1 ? "RECIBIDA" : "")
  ).trim().toUpperCase();

  const isOrderInRepair = orderStateCode === "REPARACION" || Number(order?.estado_orden_id || order?.estado_id) === 5;

  // Open Unified Modal for Add Item
  const handleOpenAddItem = () => {
    if (!isOrderInRepair) return;
    setIsEditing(false);
    setEditingItem(null);
    setItemType("SERVICIO");
    setFormTipoServicioId("");
    setFormBicicletaComponenteId("");
    setFormNuevoEstadoComponenteId("");
    setFormProductoId("");
    setFormCantidad("1");
    setFormPrecioUnitario("");
    setFormDescuentoPct("0");
    setFormObservaciones("");
    setFormConfirmAdicional(false);
    setFormMotivoAdicional("");
    setPendingNewComponent(null);
    setShowInlineComponentForm(false);
    setComponentCreationMessage("");
    setModalError(null);
    setIdempotencyKey(generateUUID());
    setRefreshFailed(false);
    setItemModalOpen(true);
  };

  // Open Unified Modal for Edit Item
  const handleOpenEditItem = (item, type = "SERVICIO") => {
    if (!isOrderInRepair) return;
    const isService = String(type || "").trim().toUpperCase() === "SERVICIO" || String(type || "").trim().toUpperCase() === "SERVICE";

    const normalizedEditingItem = isService ? {
      ...item,
      servicio_id: Number(item.servicio_id ?? item.orden_servicio_id),
      bicicleta_componente_id:
        item.bicicleta_componente_id == null
          ? null
          : Number(item.bicicleta_componente_id),
      estado_servicio_id: Number(item.estado_servicio_id),
      estado_servicio_codigo: String(
        item.estado_servicio_codigo ||
        item.estado_codigo ||
        item.codigo_estado ||
        (Number(item.estado_servicio_id) === 2 ? "EN_PROCESO" : Number(item.estado_servicio_id) === 5 ? "PAUSADO" : Number(item.estado_servicio_id) === 1 ? "PENDIENTE" : Number(item.estado_servicio_id) === 3 ? "COMPLETADO" : "")
      ).trim().toUpperCase(),
      estado_servicio_nombre: item.estado_servicio_nombre || ""
    } : { ...item };

    setIsEditing(true);
    setEditingItem(normalizedEditingItem);
    setItemType(isService ? "SERVICIO" : "PRODUCTO");
    setModalError(null);
    setPendingNewComponent(null);
    setShowInlineComponentForm(false);
    setComponentCreationMessage("");

    if (isService) {
      setFormTipoServicioId(String(item.tipo_servicio_id || ""));
      setFormBicicletaComponenteId(item.bicicleta_componente_id ? String(item.bicicleta_componente_id) : "");
      setFormNuevoEstadoComponenteId(item.nuevo_estado_componente_id ? String(item.nuevo_estado_componente_id) : "");
      setFormCantidad(String(item.cantidad || "1"));
      setFormPrecioUnitario(String(item.precio_unitario || item.precio_acordado || ""));
      setFormDescuentoPct(String(item.porcentaje_descuento || "0"));
      setFormObservaciones(item.observacion_tecnica || item.observaciones || "");
    } else {
      setFormProductoId(String(item.producto_id || ""));
      setFormCantidad(String(item.cantidad || "1"));
      setFormPrecioUnitario(String(item.precio_unitario || ""));
      setFormDescuentoPct(String(item.porcentaje_descuento || "0"));
      setFormObservaciones(item.observacion || item.observaciones || "");
    }

    setItemModalOpen(true);
  };

  // Unified Item Form Submission
  const handleSubmitItemForm = async (e) => {
    e.preventDefault();
    if (!isOrderInRepair) {
      setModalError("La orden debe estar en Reparación para realizar cambios.");
      return;
    }
    setModalError(null);

    const parsedQty = parseFloat(formCantidad);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setModalError("La cantidad debe ser un número positivo.");
      return;
    }

    setSubmitting(true);

    try {
      if (itemType === "SERVICIO") {
        if (!formTipoServicioId) {
          setModalError("Debes seleccionar un tipo de servicio.");
          setSubmitting(false);
          return;
        }

        const url = isEditing
          ? `/api/taller/ordenes/${ordenId}/servicios/${getServId(editingItem)}`
          : `/api/taller/ordenes/${ordenId}/servicios`;
        const method = isEditing ? "PUT" : "POST";

        let payload;
        if (!isEditing) {
          // Check if inline component form is open with draft values filled in
          let effectiveNewComponent = pendingNewComponent;

          if (!effectiveNewComponent && showInlineComponentForm) {
            const catId = parseInt(newComponentDraft.categoria_componente_id, 10);
            const estId = parseInt(newComponentDraft.estado_componente_id, 10);
            const marca = (newComponentDraft.marca || "").trim();
            const serial = (newComponentDraft.numero_serie || "").trim();

            if (isNaN(catId) || catId <= 0) {
              setModalError("Selecciona una categoría para el nuevo componente.");
              setSubmitting(false);
              return;
            }
            if (isNaN(estId) || estId <= 0) {
              setModalError("Selecciona el estado de uso del nuevo componente.");
              setSubmitting(false);
              return;
            }

            effectiveNewComponent = {
              categoria_componente_id: catId,
              estado_componente_id: estId,
              marca: marca || null,
              numero_serie: serial || null
            };
          }

          if (effectiveNewComponent) {
            payload = {
              tipo_servicio_id: parseInt(formTipoServicioId, 10),
              cantidad: parsedQty,
              porcentaje_descuento: parseFloat(formDescuentoPct || "0"),
              observaciones: formObservaciones,
              observacion_tecnica: formObservaciones,
              confirmar: true,
              motivo: formMotivoAdicional,
              bicicleta_componente_id: null,
              nuevo_componente: {
                categoria_componente_id: parseInt(effectiveNewComponent.categoria_componente_id, 10),
                estado_componente_id: parseInt(effectiveNewComponent.estado_componente_id, 10),
                marca: effectiveNewComponent.marca ? String(effectiveNewComponent.marca).trim() : null,
                numero_serie: effectiveNewComponent.numero_serie ? String(effectiveNewComponent.numero_serie).trim() : null
              }
            };
          } else {
            payload = {
              tipo_servicio_id: parseInt(formTipoServicioId, 10),
              cantidad: parsedQty,
              porcentaje_descuento: parseFloat(formDescuentoPct || "0"),
              observaciones: formObservaciones,
              observacion_tecnica: formObservaciones,
              confirmar: true,
              motivo: formMotivoAdicional,
              bicicleta_componente_id: formBicicletaComponenteId ? parseInt(formBicicletaComponenteId, 10) : null,
              nuevo_componente: null
            };
          }
        } else {
          // EDIT SERVICE PAYLOAD
          payload = {
            tipo_servicio_id: parseInt(formTipoServicioId, 10),
            bicicleta_componente_id: formBicicletaComponenteId ? parseInt(formBicicletaComponenteId, 10) : null,
            nuevo_estado_componente_id: canSetFinalComponentState && formNuevoEstadoComponenteId ? parseInt(formNuevoEstadoComponenteId, 10) : null,
            cantidad: parsedQty,
            porcentaje_descuento: parseFloat(formDescuentoPct || "0"),
            observaciones: formObservaciones,
            observacion_tecnica: formObservaciones
          };
        }

        const reqHeaders = { "Content-Type": "application/json" };
        if (method === "POST" && itemType === "SERVICIO") {
          reqHeaders["x-idempotency-key"] = idempotencyKey;
        }

        const res = await fetch(url, {
          method,
          headers: reqHeaders,
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => null);

        console.log({
          mode: isEditing ? "EDIT" : "CREATE",
          itemType,
          url,
          requestBody: payload,
          status: res.status,
          responseBody: json
        });

        if (!isEditing) {
          if (json?.warning || json?.code === "REQUIRES_CONFIRMATION" || json?.confirmRequired) {
            setFormConfirmAdicional(true);
            setModalError(json.message || "La orden de trabajo ya está en proceso. Haz clic en 'AGREGAR SERVICIO' nuevamente para confirmar.");
            setSubmitting(false);
            return;
          }

          const isHttp201 = res.status === 201 && json?.success === true;
          const rawServId = json?.data?.servicio_id ?? json?.data?.orden_servicio_id ?? json?.servicio_id ?? json?.orden_servicio_id;
          const returnedServiceId = Number(rawServId);
          const hasValidServiceId = Number.isInteger(returnedServiceId) && returnedServiceId > 0;
          const hasServiceCode = Boolean(json?.data?.codigo_servicio || json?.codigo_servicio);

          let isContractValid = isHttp201 && hasValidServiceId && hasServiceCode;

          if (pendingNewComponent) {
            const createdCompId = Number(json?.data?.bicicleta_componente_id);
            const compCreatedFlag = json?.data?.componente_creado === true;
            if (!compCreatedFlag || !Number.isInteger(createdCompId) || createdCompId <= 0) {
              isContractValid = false;
            }
          }

          if (!isContractValid) {
            if (res.status === 409 || json?.error === "BICYCLE_COMPONENT_CATEGORY_EXISTS" || json?.error === "DUPLICATE_COMPONENT_SERIAL") {
              if (json?.error === "BICYCLE_COMPONENT_CATEGORY_EXISTS") {
                setModalError(json.message || "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.");
                if (json.data?.bicicleta_componente_id) {
                  setExistingComponentSuggestionId(String(json.data.bicicleta_componente_id));
                }
              } else {
                setModalError(json.message || "Ya existe un componente con este número de serie.");
              }
              await fetchBikeComponents();
            } else {
              setModalError(json?.message || json?.error || `Contrato o respuesta inválida al guardar el servicio. HTTP ${res.status}`);
            }
            setSubmitting(false);
            return;
          }
        } else {
          if (!res.ok || json?.success === false) {
            setModalError(json?.message || json?.error || `No fue posible actualizar el servicio. HTTP ${res.status}`);
            setSubmitting(false);
            return;
          }
        }
      } else {
        // REPUESTO DIRECT TO ORDER
        if (!formProductoId) {
          setModalError("Debes seleccionar un repuesto del catálogo.");
          setSubmitting(false);
          return;
        }

        // Validate stock available
        const selectedProd = productosList.find(p => String(p.producto_id) === String(formProductoId));
        if (selectedProd && selectedProd.stock_disponible !== undefined) {
          const stock = Number(selectedProd.stock_disponible);
          if (parsedQty > stock) {
            setModalError(`La cantidad solicitada (${parsedQty}) supera la existencia disponible (${stock} ${selectedProd.unidad_medida || "UND"}).`);
            setSubmitting(false);
            return;
          }
        }

        const url = isEditing
          ? `/api/taller/ordenes/${ordenId}/productos/${editingItem.orden_producto_id}`
          : `/api/taller/ordenes/${ordenId}/productos`;
        const method = isEditing ? "PUT" : "POST";

        const payload = {
          producto_id: parseInt(formProductoId, 10),
          cantidad: parsedQty,
          observacion: formObservaciones
        };

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => null);

        console.log({
          mode: isEditing ? "EDIT" : "CREATE",
          itemType,
          url,
          requestBody: payload,
          status: res.status,
          responseBody: json
        });

        if (!res.ok || json?.success === false) {
          setModalError(json?.message || json?.error || `No fue posible guardar el repuesto. HTTP ${res.status}`);
          setSubmitting(false);
          return;
        }

        // Validate Returned Product ID
        const returnedProdId = Number(json?.data?.orden_producto_id ?? json?.data?.producto_id ?? json?.orden_producto_id);
        if (!isEditing && (!returnedProdId || returnedProdId <= 0)) {
          setModalError("Error contractual: La API no devolvió un ID de repuesto válido.");
          setSubmitting(false);
          return;
        }
      }

      // Await page refresh to update order state before closing modal
      if (onRefresh) {
        try {
          await onRefresh();
        } catch (refreshErr) {
          if (!isEditing && itemType === "SERVICIO") {
            setRefreshFailed(true);
            setModalError("El servicio fue creado correctamente, pero no se pudo actualizar la vista.");
            setSubmitting(false);
            return;
          } else {
            setModalError("El ítem se guardó pero ocurrió un error al actualizar la vista. Por favor recarga la página.");
            setSubmitting(false);
            return;
          }
        }
      }

      setPendingNewComponent(null);
      setShowInlineComponentForm(false);
      setExistingComponentSuggestionId(null);
      setItemModalOpen(false);
      showSuccessToast(
        isEditing
          ? itemType === "PRODUCTO" ? "Repuesto actualizado exitosamente." : "Servicio actualizado exitosamente."
          : itemType === "PRODUCTO" ? "Repuesto agregado a la orden exitosamente." : "Servicio agregado correctamente."
      );
      fetchBikeComponents();
    } catch (err) {
      setModalError(err?.message || "Error de conexión al procesar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Operative Action Execution (Iniciar, Pausar, Reanudar, Finalizar)
  const executeOperativeAction = async (svc, actionCode, extraBody = {}) => {
    if (!isOrderInRepair) {
      if (orderStateCode === "LISTA_ENTREGA") {
        showInfoToast(
          "La orden está en estado Lista para Entrega. Reabre la reparación para modificar servicios o repuestos.",
          "ORDEN EN LISTA PARA ENTREGA",
          6500
        );
      } else {
        showInfoToast(
          "La orden debe estar en Reparación para realizar cambios.",
          "ORDEN NO ESTÁ EN REPARACIÓN",
          6500
        );
      }
      return;
    }

    const sId = getServId(svc);
    setProcessingServiceId(sId);

    try {
      let endpointAction = actionCode;
      if (actionCode === "INICIAR") endpointAction = "INICIAR_SERVICIO";
      if (actionCode === "PAUSAR") endpointAction = "PAUSAR_SERVICIO";
      if (actionCode === "REANUDAR") endpointAction = "REANUDAR_SERVICIO";
      if (actionCode === "FINALIZAR") endpointAction = "FINALIZAR_SERVICIO";

      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${sId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: endpointAction,
          estado_codigo: actionCode,
          ...extraBody
        })
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          showInfoToast(
            json.message || "Primero debes iniciar la reparación de la orden.",
            "RESTRICCIÓN DE PROCESO",
            6500
          );
        } else if (res.status === 400 && json.code === "COMPONENT_RESULT_STATUS_REQUIRED") {
          setCompleteTargetService(svc);
          setSelectedFinalStateId(String(svc.nuevo_estado_componente_id || ""));
          setCompleteComponentModalOpen(true);
        } else {
          showErrorToast(json.message || json.error || "No se pudo actualizar el servicio.");
        }
        return;
      }

      showSuccessToast(json.message || "Estado del servicio actualizado correctamente.");
      fetchBikeComponents();
      if (onRefresh) onRefresh();
    } catch (err) {
      showErrorToast("Error de conexión al comunicarse con el servidor.");
    } finally {
      setProcessingServiceId(null);
    }
  };

  // Handle Finish Service Trigger
  const handleFinishServiceTrigger = (svc) => {
    if (!isOrderInRepair) {
      if (orderStateCode === "LISTA_ENTREGA") {
        showInfoToast(
          "La orden está en estado Lista para Entrega. Reabre la reparación para modificar servicios o repuestos.",
          "ORDEN EN LISTA PARA ENTREGA",
          6500
        );
      } else {
        showInfoToast(
          "La orden debe estar en Reparación para realizar cambios.",
          "ORDEN NO ESTÁ EN REPARACIÓN",
          6500
        );
      }
      return;
    }

    if (svc.bicicleta_componente_id || svc.componente) {
      const currentCompName = svc.componente
        ? `${svc.componente.categoria} (${svc.componente.marca} ${svc.componente.modelo})`
        : "Componente afectado";

      if (!svc.nuevo_estado_componente_id) {
        setCompleteTargetService(svc);
        setSelectedFinalStateId("");
        setCompleteComponentModalOpen(true);
        return;
      }

      const estNuevoObj = estadosComponenteCatalog.find(e => String(e.estado_componente_id) === String(svc.nuevo_estado_componente_id));
      const estNuevoNombre = estNuevoObj?.nombre || svc.nuevo_estado_componente_nombre || "Nuevo Estado";
      const estActualNombre = svc.componente?.estado_actual_nombre || "Actual";

      askConfirmation(
        "Finalizar Servicio con Componente",
        `Al finalizar, el componente '${currentCompName}' cambiará de '${estActualNombre}' a '${estNuevoNombre}'. ¿Deseas marcar este servicio como completado?`,
        () => executeOperativeAction(svc, "FINALIZAR"),
        "finish"
      );
    } else {
      askConfirmation(
        "Finalizar Servicio",
        `¿Deseas marcar el servicio '${svc.tipo_servicio_nombre}' como completado?`,
        () => executeOperativeAction(svc, "FINALIZAR"),
        "finish"
      );
    }
  };

  // Submit missing component status on finish
  const handleSaveCompleteComponentStatus = async (e) => {
    e.preventDefault();
    if (!selectedFinalStateId) {
      showWarningToast("Por favor selecciona el estado resultante del componente.", "CAMPO REQUERIDO");
      return;
    }
    if (!completeTargetService) return;

    setCompleteComponentModalOpen(false);
    await executeOperativeAction(completeTargetService, "FINALIZAR", {
      nuevo_estado_componente_id: parseInt(selectedFinalStateId, 10)
    });
  };

  // Delete Service
  const handleDeleteService = (svc) => {
    if (!isOrderInRepair) {
      if (orderStateCode === "LISTA_ENTREGA") {
        showInfoToast(
          "La orden está en estado Lista para Entrega. Reabre la reparación para modificar servicios o repuestos.",
          "ORDEN EN LISTA PARA ENTREGA",
          6500
        );
      } else {
        showInfoToast(
          "La orden debe estar en Reparación para realizar cambios.",
          "ORDEN NO ESTÁ EN REPARACIÓN",
          6500
        );
      }
      return;
    }
    askConfirmation(
      "Eliminar Servicio",
      `¿Deseas eliminar el servicio '${svc.tipo_servicio_nombre}' de esta orden?`,
      async () => {
        try {
          const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${getServId(svc)}`, {
            method: "DELETE"
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 409) {
              showInfoToast(json.message || "No se puede eliminar el servicio en el estado actual de la orden.", "RESTRICCIÓN DE PROCESO", 6500);
            } else {
              showErrorToast(json.message || json.error || "No se pudo eliminar el servicio.");
            }
            return;
          }
          showSuccessToast("Servicio eliminado de la orden.");
          if (onRefresh) onRefresh();
        } catch (err) {
          showErrorToast("Error de conexión al eliminar el servicio.");
        }
      },
      "delete"
    );
  };

  // Delete Product
  const handleDeleteProduct = (prod) => {
    if (!isOrderInRepair) {
      if (orderStateCode === "LISTA_ENTREGA") {
        showInfoToast(
          "La orden está en estado Lista para Entrega. Reabre la reparación para modificar servicios o repuestos.",
          "ORDEN EN LISTA PARA ENTREGA",
          6500
        );
      } else {
        showInfoToast(
          "La orden debe estar en Reparación para realizar cambios.",
          "ORDEN NO ESTÁ EN REPARACIÓN",
          6500
        );
      }
      return;
    }
    askConfirmation(
      "Eliminar Repuesto",
      `¿Deseas eliminar el repuesto '${prod.nombre || prod.producto_nombre}' de esta orden?`,
      async () => {
        try {
          const res = await fetch(`/api/taller/ordenes/${ordenId}/productos/${prod.orden_producto_id}`, {
            method: "DELETE"
          });
          const json = await res.json();
          if (!res.ok) {
            if (res.status === 409) {
              showInfoToast(json.message || "No se puede eliminar el repuesto en el estado actual de la orden.", "RESTRICCIÓN DE PROCESO", 6500);
            } else {
              showErrorToast(json.message || json.error || "No se pudo eliminar el repuesto.");
            }
            return;
          }
          showSuccessToast("Repuesto eliminado de la orden.");
          if (onRefresh) onRefresh();
        } catch (err) {
          showErrorToast("Error de conexión al eliminar el repuesto.");
        }
      },
      "delete"
    );
  };

  const totalItemsCount = services.length + orderProducts.length;

  return (
    <div className="space-y-5 font-sans text-slate-100">
      {/* Global Floating Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            width: "min(420px, calc(100vw - 32px))"
          }}
          className={`p-4 rounded-xl shadow-2xl font-mono text-xs flex items-start gap-3 border backdrop-blur-md transition-all ${
            toast.type === "error"
              ? "bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/50"
              : toast.type === "warning"
              ? "bg-amber-950/95 border-amber-500 text-amber-100 shadow-amber-950/50"
              : toast.type === "info"
              ? "bg-[#081e36]/95 border-cyan-500/80 text-cyan-100 shadow-cyan-950/60"
              : "bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/50"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          ) : toast.type === "warning" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          ) : toast.type === "info" ? (
            <Info className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold block text-xs uppercase tracking-wider mb-1 font-mono text-slate-100">
              {toast.title || (toast.type === "error" ? "Error u Operación" : toast.type === "warning" ? "Aviso de Operación" : toast.type === "info" ? "Información" : "Confirmación")}
            </span>
            <span className="leading-relaxed font-sans text-xs block text-slate-200">{toast.text}</span>
            {toast.subtext && (
              <span className="leading-relaxed font-sans text-[11px] block text-cyan-300 mt-2 font-medium bg-cyan-950/50 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                {toast.subtext}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors ml-1 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="bg-[#161a21] border border-[#2d3748] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          {backUrl && (
            <Link
              href={backUrl}
              className="p-2 bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-300 hover:text-white hover:border-[#bfce7f] transition-all"
              title="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-tight">
              <Wrench className="w-5 h-5 text-[#bfce7f]" /> SERVICIOS Y REPUESTOS DE LA ORDEN
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Gestión de servicios, repuestos asociados, tiempos de ejecución y componentes afectados.
            </p>
          </div>
        </div>

        {/* Action Button "AGREGAR REPUESTO O SERVICIO" */}
        {isOrderInRepair && (
          <button
            type="button"
            onClick={handleOpenAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-[#bfce7f] hover:bg-[#aab86e] text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer font-mono uppercase"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>AGREGAR REPUESTO O SERVICIO</span>
          </button>
        )}
      </div>

      {/* Banner for Order in RECIBIDA state */}
      {isOrderRecibida && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 font-mono text-xs text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold">Orden en estado RECIBIDA</p>
              <p className="text-[11px] text-amber-400/80 font-sans">
                Para iniciar el cronómetro y ejecutar las acciones de los servicios, primero debes iniciar la reparación de la orden.
              </p>
            </div>
          </div>
          {onStartRepair && (
            <button
              type="button"
              onClick={onStartRepair}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer uppercase"
            >
              INICIAR REPARACIÓN
            </button>
          )}
        </div>
      )}

      {/* Banner for Order in LISTA_ENTREGA state */}
      {orderStateCode === "LISTA_ENTREGA" && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 font-mono text-xs text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold">Orden Lista para Entrega</p>
              <p className="text-[11px] text-amber-400/80 font-sans">
                La orden está en estado Lista para Entrega. Reabre la reparación para modificar servicios o repuestos.
              </p>
            </div>
          </div>
        </div>
      )}



      {/* Main Single Card - 100% Width "DETALLE DE SERVICIOS Y REPUESTOS" */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#2d3748] bg-[#0a0c10]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#bfce7f]" />
            <h4 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider">
              DETALLE DE SERVICIOS Y REPUESTOS ({totalItemsCount})
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Ancho completo 100% • Control directo en tabla
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-[#0a0c10]/60 border-b border-[#2d3748] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="p-3.5 pl-4">Código</th>
                <th className="p-3.5">Tipo / Descripción</th>
                <th className="p-3.5">Componente Afectado</th>
                <th className="p-3.5">Estado del Servicio</th>
                <th className="p-3.5 text-right">Precio (RD$)</th>
                <th className="p-3.5 text-center">Fecha Inicio</th>
                <th className="p-3.5 text-center">Fecha Fin</th>
                <th className="p-3.5 text-center">Tiempo Transcurrido</th>
                <th className="p-3.5 pr-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60 font-mono">
              {totalItemsCount === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 text-xs italic">
                    {orderStateCode === "LISTA_ENTREGA" || Number(order?.estado_orden_id) === 7 ? (
                      "Esta orden no tiene servicios ni repuestos registrados. Reabre la reparación para agregar elementos."
                    ) : isOrderInRepair ? (
                      "No hay servicios ni repuestos registrados. Agrega el primer servicio o repuesto para comenzar."
                    ) : (
                      "No hay servicios ni repuestos registrados en esta orden de trabajo."
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {/* SERVICES ROWS */}
                  {services.map((svc, idx) => {
                    const sId = getServId(svc) || (idx + 1);
                    const srvCode = svc.codigo_servicio || "SIN CÓDIGO";
                    const stateRules = getServiceStateRules(svc.estado_servicio_id, svc.usuario_id, Number(order?.estado_orden_id || 1));
                    const elapsedSec = getElapsedSecondsForService(svc);
                    const isProcessing = processingServiceId === sId;

                    const isPendiente = Number(svc.estado_servicio_id) === 1 || svc.estado_servicio_codigo === "PENDIENTE";
                    const isEnProceso = Number(svc.estado_servicio_id) === 2 || svc.estado_servicio_codigo === "EN_PROCESO";
                    const isPausado = Number(svc.estado_servicio_id) === 5 || svc.estado_servicio_codigo === "SUSPENDIDO" || svc.estado_servicio_codigo === "PAUSADO";
                    const isCompletado = Number(svc.estado_servicio_id) === 3 || svc.estado_servicio_codigo === "COMPLETADO";

                    return (
                      <tr key={`svc-${sId}`} className="hover:bg-[#1c2129]/60 transition-colors">
                        {/* Código */}
                        <td className="p-3.5 pl-4 font-bold text-[#bfce7f] whitespace-nowrap font-mono">
                          {srvCode}
                        </td>

                        {/* Tipo / Descripción */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-100 font-sans text-xs flex items-center gap-2">
                            <span>{svc.tipo_servicio_nombre}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#bfce7f]/10 text-[#bfce7f] border border-[#bfce7f]/30">SERVICIO</span>
                          </div>
                          {svc.observacion_tecnica || svc.tipo_servicio_descripcion ? (
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                              {svc.observacion_tecnica || svc.tipo_servicio_descripcion}
                            </div>
                          ) : null}
                        </td>

                        {/* Componente Afectado */}
                        <td className="p-3.5 whitespace-nowrap text-xs text-slate-300">
                          {svc.componente ? (
                            <div>
                              <div className="font-semibold text-slate-200">
                                {svc.componente.categoria} - {svc.componente.marca} {svc.componente.modelo}
                              </div>
                              <div className="text-[10px] text-emerald-400">
                                Estado: {svc.componente.estado_actual_nombre || "Bueno"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic font-normal">Servicio general</span>
                          )}
                        </td>

                        {/* Estado del Servicio */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 border rounded-md text-[10px] font-bold inline-block ${stateRules.badgeClass}`}>
                            {stateRules.badgeLabel}
                          </span>
                        </td>

                        {/* Precio */}
                        <td className="p-3.5 text-right font-bold text-slate-100 whitespace-nowrap">
                          RD$ {Number(svc.precio_unitario || svc.precio_acordado || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Fecha Inicio */}
                        <td className="p-3.5 text-center text-slate-300 text-[11px] whitespace-nowrap">
                          {formatDate(svc.fecha_inicio)}
                        </td>

                        {/* Fecha Fin */}
                        <td className="p-3.5 text-center text-slate-300 text-[11px] whitespace-nowrap">
                          {formatDate(svc.fecha_finalizacion)}
                        </td>

                        {/* Tiempo Transcurrido */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className={`px-2 py-1 rounded border text-xs font-bold font-mono tracking-wider ${
                            isEnProceso
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/40 animate-pulse"
                              : isPausado
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/40"
                              : isCompletado
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-900 text-slate-400 border-slate-800"
                          }`}>
                            {formatSecondsToHHMMSS(elapsedSec)}
                          </span>
                        </td>

                        {/* In-Line Operative Actions */}
                        <td className="p-3.5 pr-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* PENDIENTE Actions */}
                            {isPendiente && (
                              <button
                                type="button"
                                onClick={() => executeOperativeAction(svc, "INICIAR")}
                                disabled={isOrderRecibida || isProcessing || !isOrderInRepair}
                                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Iniciar servicio"
                                aria-label="Iniciar servicio"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            {/* EN PROCESO Actions */}
                            {isEnProceso && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => executeOperativeAction(svc, "PAUSAR")}
                                  disabled={isProcessing || !isOrderInRepair}
                                  className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Pausar servicio"
                                  aria-label="Pausar servicio"
                                >
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFinishServiceTrigger(svc)}
                                  disabled={isProcessing || !isOrderInRepair}
                                  className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Finalizar servicio"
                                  aria-label="Finalizar servicio"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* PAUSADO Actions */}
                            {isPausado && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => executeOperativeAction(svc, "REANUDAR")}
                                  disabled={isProcessing || !isOrderInRepair}
                                  className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Reanudar servicio"
                                  aria-label="Reanudar servicio"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFinishServiceTrigger(svc)}
                                  disabled={isProcessing || !isOrderInRepair}
                                  className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Finalizar servicio"
                                  aria-label="Finalizar servicio"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditItem(svc, "SERVICIO")}
                              disabled={!isOrderInRepair}
                              className={`p-1.5 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-colors ${
                                !isOrderInRepair
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-slate-700 cursor-pointer"
                              }`}
                              title="Editar servicio"
                              aria-label="Editar servicio"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button (Only if Pendiente or Cancelado) */}
                            {(isPendiente || Number(svc.estado_servicio_id) === 4) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteService(svc)}
                                disabled={!isOrderInRepair}
                                className={`p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg transition-colors ${
                                  !isOrderInRepair
                                    ? "opacity-40 cursor-not-allowed"
                                    : "hover:bg-rose-500/20 cursor-pointer"
                                }`}
                                title="Eliminar servicio"
                                aria-label="Eliminar servicio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* PRODUCTS (REPUESTOS) ROWS */}
                  {orderProducts.map((prod, idx) => {
                    const prdCode = prod.codigo || `REP-${String(idx + 1).padStart(3, "0")}`;
                    const prodQty = Number(prod.cantidad || 1);
                    const prodPrice = Number(prod.precio_unitario || 0);
                    const prodSubtotal = Number(prod.subtotal || (prodQty * prodPrice));

                    return (
                      <tr key={`prod-${prod.orden_producto_id || idx}`} className="hover:bg-[#1c2129]/60 transition-colors bg-[#0a0c10]/20">
                        {/* Código */}
                        <td className="p-3.5 pl-4 font-bold text-cyan-400 whitespace-nowrap">
                          {prdCode}
                        </td>

                        {/* Tipo / Descripción */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-100 font-sans text-xs flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>{prod.nombre || prod.producto_nombre || "Repuesto"}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">REPUESTO</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Cant: <strong>{prodQty}</strong> • Unit: RD$ {prodPrice.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                            {prod.observacion ? ` • ${prod.observacion}` : ""}
                          </div>
                        </td>

                        {/* Componente Afectado */}
                        <td className="p-3.5 whitespace-nowrap text-slate-500 text-xs italic">No aplica</td>

                        {/* Estado del Servicio */}
                        <td className="p-3.5 whitespace-nowrap text-slate-500 text-xs text-center">—</td>

                        {/* Precio Subtotal */}
                        <td className="p-3.5 text-right font-bold text-slate-100 whitespace-nowrap">
                          RD$ {prodSubtotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Fecha Inicio */}
                        <td className="p-3.5 text-center text-slate-500 whitespace-nowrap text-xs">—</td>

                        {/* Fecha Fin */}
                        <td className="p-3.5 text-center text-slate-500 whitespace-nowrap text-xs">—</td>

                        {/* Tiempo Transcurrido */}
                        <td className="p-3.5 text-center text-slate-500 whitespace-nowrap text-xs">—</td>

                        {/* Actions (Edit / Delete Product) */}
                        <td className="p-3.5 pr-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditItem(prod, "PRODUCTO")}
                              disabled={!isOrderInRepair}
                              className={`p-1.5 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-colors ${
                                !isOrderInRepair
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-slate-700 cursor-pointer"
                              }`}
                              title="Editar repuesto"
                              aria-label="Editar repuesto"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              disabled={!isOrderInRepair}
                              className={`p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg transition-colors ${
                                !isOrderInRepair
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-rose-500/20 cursor-pointer"
                              }`}
                              title="Eliminar repuesto"
                              aria-label="Eliminar repuesto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UNIFIED MODAL SHELL FOR ADD / EDIT ITEM (Rendered via Portal to document.body) */}
      <WorkshopItemModalShell
        open={itemModalOpen}
        title={
          isEditing
            ? itemType === "PRODUCTO"
              ? "EDITAR REPUESTO"
              : "EDITAR SERVICIO"
            : "AGREGAR REPUESTO O SERVICIO"
        }
        description="Selecciona si deseas registrar un servicio o un repuesto en la orden."
        onClose={() => setItemModalOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end font-sans">
            <button
              type="button"
              onClick={() => setItemModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            {refreshFailed ? (
              <button
                type="button"
                onClick={async () => {
                  setSubmitting(true);
                  setModalError(null);
                  try {
                    await onRefresh();
                    setPendingNewComponent(null);
                    setShowInlineComponentForm(false);
                    setExistingComponentSuggestionId(null);
                    setItemModalOpen(false);
                    setRefreshFailed(false);
                    showSuccessToast("Vista actualizada exitosamente.");
                  } catch (err) {
                    setModalError("El servicio fue creado correctamente, pero no se pudo actualizar la vista.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 font-mono uppercase"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Reintentar actualización</span>
              </button>
            ) : (
              <button
                type="submit"
                form="workshop-item-form"
                disabled={submitting}
                className="px-5 py-2 bg-[#bfce7f] hover:bg-[#aab86e] text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 font-mono uppercase"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {isEditing
                    ? "Guardar Cambios"
                    : itemType === "PRODUCTO"
                    ? "Agregar Repuesto"
                    : formConfirmAdicional
                    ? "Confirmar y Agregar Servicio"
                    : "Agregar Servicio"}
                </span>
              </button>
            )}
          </div>
        }
      >
        <form id="workshop-item-form" onSubmit={handleSubmitItemForm} className="space-y-4 font-mono text-xs">
          <fieldset disabled={refreshFailed || submitting} className="space-y-4 w-full">
          {/* Type Switcher */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5 font-semibold uppercase">Tipo de Ítem *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isEditing}
                onClick={() => {
                  setItemType("SERVICIO");
                  setModalError(null);
                }}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  itemType === "SERVICIO"
                    ? "bg-[#bfce7f]/20 border-[#bfce7f] text-[#bfce7f]"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                } ${isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Wrench className="w-4 h-4" />
                <span>Servicio</span>
              </button>

              <button
                type="button"
                disabled={isEditing}
                onClick={() => {
                  setItemType("PRODUCTO");
                  setModalError(null);
                }}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                  itemType === "PRODUCTO"
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                } ${isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Package className="w-4 h-4" />
                <span>Repuesto</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {modalError && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex flex-col gap-2 font-mono">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
              {existingComponentSuggestionId && (
                <div className="pt-2 border-t border-rose-800/60 flex items-center justify-between font-sans">
                  <span className="text-[11px] text-rose-300">¿Deseas usar el componente de esa categoría ya registrado en esta bicicleta?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormBicicletaComponenteId(existingComponentSuggestionId);
                      setPendingNewComponent(null);
                      setShowInlineComponentForm(false);
                      setExistingComponentSuggestionId(null);
                      setModalError(null);
                    }}
                    className="px-3 py-1 bg-[#bfce7f] hover:bg-[#aab86e] text-slate-950 font-bold rounded-lg text-xs font-mono uppercase cursor-pointer shrink-0"
                  >
                    Usar el componente existente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FORM GRID */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* FIELDS WHEN TYPE IS "SERVICIO" */}
            {itemType === "SERVICIO" && (
              <>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Tipo de Servicio *</label>
                  <select
                    value={formTipoServicioId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormTipoServicioId(val);
                      const ts = tiposServicio.find(t => String(t.tipo_servicio_id) === val);
                      if (ts && ts.precio_base) {
                        setFormPrecioUnitario(String(ts.precio_base));
                      }
                    }}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  >
                    <option value="">-- Seleccionar servicio --</option>
                    {tiposServicio.map((t) => (
                      <option key={t.tipo_servicio_id} value={t.tipo_servicio_id}>
                        {t.nombre} (RD$ {Number(t.precio_base || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Componente Afectado with Inline Creator */}
                <div className="md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase">Componente Afectado (Opcional)</label>
                    {canCreateInlineComponent && !showInlineComponentForm && !pendingNewComponent && (
                      <button
                        type="button"
                        onClick={handleOpenInlineComponentForm}
                        className="text-[11px] text-[#bfce7f] hover:underline flex items-center gap-1 font-mono cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>No encuentro el componente · Agregalo</span>
                      </button>
                    )}
                  </div>

                  <select
                    value={formBicicletaComponenteId || ""}
                    onChange={(e) => {
                      setFormBicicletaComponenteId(e.target.value);
                      if (e.target.value) {
                        setPendingNewComponent(null);
                        setShowInlineComponentForm(false);
                      }
                    }}
                    disabled={loadingComponents || Boolean(pendingNewComponent)}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#bfce7f] disabled:opacity-60"
                  >
                    <option value="">Sin componente específico (Servicio General)</option>

                    {bicycleComponents.length > 0 && (
                      <optgroup label="Componentes de la bicicleta">
                        {bicycleComponents.map((c) => {
                          const compId = c.bicicleta_componente_id;
                          const marcaMod = [c.marca, c.modelo].filter(Boolean).join(" ");
                          const healthText = `${c.estado_nombre} (${c.porcentaje_salud}% salud)`;
                          const label = `${c.categoria_nombre}${marcaMod ? ` — ${marcaMod}` : ""} — ${healthText}${c.numero_serie ? ` (SN: ${c.numero_serie})` : ""}`;
                          return (
                            <option key={compId} value={compId}>
                              {label}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {loadingComponents && <option value="" disabled>Cargando componentes de la bicicleta…</option>}
                  </select>

                  {/* CARD: NUEVO COMPONENTE PENDIENTE DE GUARDAR */}
                  {pendingNewComponent && (
                    <div className="mt-2 p-3 bg-[#bfce7f]/10 border border-[#bfce7f]/40 rounded-xl space-y-2 font-mono text-xs shadow-lg animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-[#bfce7f]/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#bfce7f]" />
                          <span className="font-bold text-[#bfce7f] uppercase text-[11px]">
                            NUEVO COMPONENTE — PENDIENTE DE GUARDAR
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleEditPendingComponent}
                            className="text-[10px] text-[#bfce7f] hover:underline cursor-pointer"
                          >
                            Editar borrador
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={handleRemovePendingComponent}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Quitar borrador
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <div>
                          <span className="text-slate-400 font-semibold block">Categoría:</span>
                          <span className="font-bold text-slate-100">{pendingNewComponent.categoria_nombre}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block">Marca:</span>
                          <span>{pendingNewComponent.marca || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block">Estado actual:</span>
                          <span>{pendingNewComponent.estado_nombre} ({pendingNewComponent.porcentaje_salud}% salud)</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block">Número de serie:</span>
                          <span>{pendingNewComponent.numero_serie || "—"}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-amber-300/90 italic pt-1 border-t border-[#bfce7f]/20">
                        Este componente se registrará cuando agregues el servicio.
                      </p>
                    </div>
                  )}

                  {/* Error Messages */}
                  {componentsError && (
                    <p className="text-[11px] text-rose-400 font-mono mt-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      <span>{componentsError}</span>
                    </p>
                  )}

                  {/* INLINE NEW COMPONENT FORM (LOCAL DRAFT ONLY) */}
                  {canCreateInlineComponent && showInlineComponentForm && (
                    <div className="mt-3 rounded-xl border border-[#bfce7f]/40 bg-slate-950/90 p-4 space-y-3 font-mono text-xs shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="font-bold text-[#bfce7f] uppercase text-[11px] flex items-center gap-1.5">
                          <Sparkles size={14} /> REGISTRAR NUEVO COMPONENTE DE LA BICICLETA
                        </h4>
                        <button
                          type="button"
                          onClick={handleCancelInlineComponentForm}
                          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                          title="Cancelar registro de componente"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                        El componente se registrará cuando agregues el servicio.
                      </p>

                      {allCategoriesRegistered && (
                        <div className="p-2.5 bg-amber-950/80 border border-amber-500/50 rounded-lg text-amber-200 text-[11px] flex items-center gap-2 font-mono">
                          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                          <span>Esta bicicleta ya tiene registrados todos los tipos de componentes disponibles.</span>
                        </div>
                      )}

                      {newComponentErrors.general && (
                        <div className="p-2 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200 text-[11px] flex items-center gap-1.5 font-mono">
                          <AlertCircle size={13} className="text-rose-400 shrink-0" />
                          <span>{newComponentErrors.general}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {/* Categoría */}
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Categoría *</label>
                          <select
                            value={newComponentDraft.categoria_componente_id}
                            disabled={allCategoriesRegistered}
                            onChange={(e) => setNewComponentDraft(prev => ({ ...prev, categoria_componente_id: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none ${newComponentErrors.categoria_componente_id ? "border-rose-500" : "border-slate-800 focus:border-[#bfce7f]"} disabled:opacity-50 cursor-pointer`}
                          >
                            <option value="">-- Seleccionar categoría --</option>
                            {categoriasComponenteCatalog.map((cat) => {
                              const catId = Number(cat.categoria_componente_id);
                              const isAlreadyRegistered = existingCategoryIds.has(catId);
                              return (
                                <option
                                  key={catId}
                                  value={catId}
                                  disabled={isAlreadyRegistered}
                                >
                                  {cat.nombre} {cat.codigo ? `(${cat.codigo})` : ""}{isAlreadyRegistered ? " — Ya registrada en esta bicicleta" : ""}
                                </option>
                              );
                            })}
                          </select>
                          {newComponentErrors.categoria_componente_id && (
                            <p className="text-[10px] text-rose-400 mt-0.5 font-mono">{newComponentErrors.categoria_componente_id}</p>
                          )}
                        </div>

                        {/* Estado de Uso */}
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Estado de Uso *</label>
                          <select
                            value={newComponentDraft.estado_componente_id}
                            onChange={(e) => setNewComponentDraft(prev => ({ ...prev, estado_componente_id: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none ${newComponentErrors.estado_componente_id ? "border-rose-500" : "border-slate-800 focus:border-[#bfce7f]"}`}
                          >
                            <option value="">-- Seleccionar estado --</option>
                            {estadosComponenteCatalog.map((est) => {
                              const salud = est.nivel_desgaste !== undefined ? Math.max(0, 100 - Number(est.nivel_desgaste)) : 100;
                              return (
                                <option key={est.estado_componente_id} value={est.estado_componente_id}>
                                  {est.nombre} ({salud}% salud)
                                </option>
                              );
                            })}
                          </select>
                          {newComponentErrors.estado_componente_id && (
                            <p className="text-[10px] text-rose-400 mt-0.5">{newComponentErrors.estado_componente_id}</p>
                          )}
                        </div>

                        {/* Marca */}
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Marca (Opcional)</label>
                          <input
                            type="text"
                            placeholder="Ej. Shimano, SRAM, Fox"
                            value={newComponentDraft.marca}
                            onChange={(e) => setNewComponentDraft(prev => ({ ...prev, marca: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                          />
                        </div>

                        {/* Número de Serie */}
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Número de Serie (Opcional)</label>
                          <input
                            type="text"
                            placeholder="SN-123456"
                            value={newComponentDraft.numero_serie}
                            onChange={(e) => setNewComponentDraft(prev => ({ ...prev, numero_serie: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none ${newComponentErrors.numero_serie ? "border-rose-500" : "border-slate-800 focus:border-[#bfce7f]"}`}
                          />
                          {newComponentErrors.numero_serie && (
                            <p className="text-[10px] text-rose-400 mt-0.5">{newComponentErrors.numero_serie}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 font-sans">
                        <button
                          type="button"
                          onClick={handleCancelInlineComponentForm}
                          className="px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineComponentLocal}
                          className="px-3.5 py-1.5 bg-[#bfce7f] hover:bg-[#aab86e] text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer font-mono uppercase flex items-center gap-1.5"
                        >
                          <span>Agregar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-1">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    value={formCantidad}
                    onChange={(e) => setFormCantidad(e.target.value)}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Precio Catálogo (RD$) *</label>
                  <input
                    type="number"
                    readOnly={true}
                    value={formPrecioUnitario}
                    placeholder="0.00"
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Precio vigente del catálogo (No editable)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Diagnóstico / Observación</label>
                  <textarea
                    rows={2}
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                    placeholder="Observaciones iniciales o diagnóstico..."
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#bfce7f] font-sans text-xs"
                  />
                </div>

                {/* Nuevo Estado del Componente (SOLO en Edición de Servicio EN_PROCESO o PAUSADO con componente) */}
                {showFinalComponentStateField && (
                  <div className="md:col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Nuevo estado del componente (al finalizar)</label>
                    {(!estadosComponenteCatalog || estadosComponenteCatalog.length === 0) ? (
                      <p className="text-[11px] text-rose-400 font-mono py-1">No fue posible cargar los estados del componente.</p>
                    ) : (
                      <select
                        value={formNuevoEstadoComponenteId}
                        onChange={(e) => setFormNuevoEstadoComponenteId(e.target.value)}
                        className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                      >
                        <option value="">-- Seleccionar nuevo estado resultante --</option>
                        {estadosComponenteCatalog.map((ec) => (
                          <option key={ec.estado_componente_id} value={ec.estado_componente_id}>
                            {ec.nombre} (Desgaste: {ec.nivel_desgaste}%)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Resultado de Solo Lectura si el servicio está COMPLETADO */}
                {isEditing && itemType === "SERVICIO" && String(editingItem?.estado_servicio_codigo || "").toUpperCase() === "COMPLETADO" && editingItem?.nuevo_estado_componente_nombre && (
                  <div className="md:col-span-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono">
                    <span className="font-semibold block uppercase text-[10px] text-emerald-400">Estado Resultante Aplicado:</span>
                    <span className="font-bold">{editingItem.nuevo_estado_componente_nombre}</span>
                  </div>
                )}
              </>
            )}

            {/* FIELDS WHEN TYPE IS "PRODUCTO" (REPUESTO) */}
            {itemType === "PRODUCTO" && (
              <>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Producto / Repuesto *</label>
                  <select
                    value={formProductoId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormProductoId(val);
                      const prod = productosList.find(p => String(p.producto_id) === val);
                      if (prod) {
                        setFormPrecioUnitario(String(prod.precio_venta || prod.precio || 0));
                      }
                    }}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Seleccionar repuesto del catálogo --</option>
                    {productosList.map((p) => {
                      const stock = Number(p.stock_disponible ?? 9999);
                      const isOutOfStock = stock <= 0;
                      return (
                        <option key={p.producto_id} value={p.producto_id} disabled={isOutOfStock}>
                          [{p.codigo || `REP-${p.producto_id}`}] {p.nombre} - Stock: {stock} {p.unidad_medida || "UND"} (RD$ {Number(p.precio_venta || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}){isOutOfStock ? " [SIN EXISTENCIA]" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    value={formCantidad}
                    onChange={(e) => setFormCantidad(e.target.value)}
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Precio Catálogo (RD$) *</label>
                  <input
                    type="number"
                    readOnly={true}
                    value={formPrecioUnitario}
                    placeholder="0.00"
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Precio vigente del catálogo (No editable)</p>
                </div>

                <div className="md:col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center font-mono">
                  <span className="text-slate-400 font-semibold uppercase text-[11px]">Subtotal Estimado:</span>
                  <span className="text-sm font-bold text-cyan-300">
                    RD$ {((parseFloat(formCantidad || "0") || 0) * (parseFloat(formPrecioUnitario || "0") || 0)).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">Observaciones (Opcional)</label>
                  <textarea
                    rows={2}
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                    placeholder="Notas adicionales..."
                    className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-sans text-xs"
                  />
                </div>
              </>
            )}
          </div>
          </fieldset>
        </form>
      </WorkshopItemModalShell>

      {/* MODAL FOR MISSING COMPONENT RESULTING STATUS ON SERVICE FINISH */}
      <WorkshopItemModalShell
        open={completeComponentModalOpen && Boolean(completeTargetService)}
        title="Selecciona el estado final del componente"
        maxWidth="520px"
        onClose={() => setCompleteComponentModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2 font-sans">
            <button
              type="button"
              onClick={() => setCompleteComponentModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="complete-component-form"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-mono uppercase cursor-pointer"
            >
              Confirmar y Finalizar
            </button>
          </div>
        }
      >
        {completeTargetService && (
          <form id="complete-component-form" onSubmit={handleSaveCompleteComponentStatus} className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <p className="text-slate-400 text-[11px]">Servicio:</p>
              <p className="font-bold text-slate-100">{completeTargetService.tipo_servicio_nombre}</p>
              {completeTargetService.componente && (
                <p className="text-[11px] text-emerald-400 pt-1 border-t border-slate-800 mt-1">
                  Componente: {completeTargetService.componente.categoria} - {completeTargetService.componente.marca} {completeTargetService.componente.modelo}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase">
                Estado Resultante del Componente *
              </label>
              <select
                value={selectedFinalStateId}
                onChange={(e) => setSelectedFinalStateId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-400"
              >
                <option value="">-- Seleccionar estado final --</option>
                {estadosComponenteCatalog.map((ec) => (
                  <option key={ec.estado_componente_id} value={ec.estado_componente_id}>
                    {ec.nombre} (Desgaste: {ec.nivel_desgaste}%)
                  </option>
                ))}
              </select>
            </div>
          </form>
        )}
      </WorkshopItemModalShell>

      {/* CONFIRMATION MODAL */}
      <WorkshopItemModalShell
        open={confirmModalOpen}
        title={confirmModalTitle || "Confirmación"}
        maxWidth="440px"
        onClose={() => setConfirmModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2 font-sans">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmModalOpen(false);
                if (confirmModalOnConfirm) confirmModalOnConfirm();
              }}
              className={`px-5 py-2 font-bold text-slate-950 rounded-xl text-xs font-mono uppercase cursor-pointer ${
                confirmModalType === "finish"
                  ? "bg-emerald-400 hover:bg-emerald-300"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              Confirmar
            </button>
          </div>
        }
      >
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${confirmModalType === "finish" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
            {confirmModalType === "finish" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <p className="text-xs text-slate-200 font-sans leading-relaxed">
            {confirmModalMessage}
          </p>
        </div>
      </WorkshopItemModalShell>
    </div>
  );
}
