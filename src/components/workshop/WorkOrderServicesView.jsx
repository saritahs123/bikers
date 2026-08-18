"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Wrench,
  Package,
  Clock,
  User,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  FileText,
  ChevronDown,
  X,
  AlertTriangle,
  Play,
  Pause,
  Printer,
  ShieldCheck,
  CheckSquare,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw
} from "lucide-react";
import { getServiceStateRules } from "@/lib/workshop-state-machine";

export default function WorkOrderServicesView({ ordenId, services = [], onRefresh, order, backUrl, onStartRepair = null }) {
  const [tiposServicio, setTiposServicio] = useState([]);
  const [productosList, setProductosList] = useState([]);
  const [mecanicosCatalog, setMecanicosCatalog] = useState([]);
  const [estadosServicio, setEstadosServicio] = useState([
    { estado_orden_servicio_id: 1, nombre: "Pendiente", codigo: "PENDIENTE" },
    { estado_orden_servicio_id: 2, nombre: "En Proceso", codigo: "EN_PROCESO" },
    { estado_orden_servicio_id: 3, nombre: "Completado", codigo: "COMPLETADO" },
    { estado_orden_servicio_id: 4, nombre: "Cancelado", codigo: "CANCELADO" },
    { estado_orden_servicio_id: 5, nombre: "Suspendido", codigo: "SUSPENDIDO" }
  ]);

  const [estadosAprobacion] = useState([
    { estado_aprobacion_id: 1, nombre: "Pendiente Autorización", codigo: "PENDIENTE" },
    { estado_aprobacion_id: 2, nombre: "Aprobado", codigo: "APROBADO" },
    { estado_aprobacion_id: 3, nombre: "Rechazado", codigo: "RECHAZADO" }
  ]);

  // Selected Service for detail view panel
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  // Modal states
  const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
  const [editServiceModalOpen, setEditServiceModalOpen] = useState(false);
  const [addLaborModalOpen, setAddLaborModalOpen] = useState(false);
  const [editLaborModalOpen, setEditLaborModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);

  // Form inputs - Add/Edit Service
  const [editingService, setEditingService] = useState(null);
  const [newTipoServicioId, setNewTipoServicioId] = useState("");
  const [newMecanicoId, setNewMecanicoId] = useState("");
  const [newPrecioAcordado, setNewPrecioAcordado] = useState("");
  const [newObservaciones, setNewObservaciones] = useState("");
  const [confirmAdicional, setConfirmAdicional] = useState(false);
  const [motivoAdicional, setMotivoAdicional] = useState("");

  // Edit Service Reassignment states
  const [editConfirmReasignar, setEditConfirmReasignar] = useState(false);
  const [editMotivoReasignar, setEditMotivoReasignar] = useState("");

  // Finish Service Without Labor Modal states
  const [finishNoLaborModalOpen, setFinishNoLaborModalOpen] = useState(false);
  const [finishNoLaborService, setFinishNoLaborService] = useState(null);
  const [finishNoLaborMotivo, setFinishNoLaborMotivo] = useState("");
  const [finishNoLaborConfirm, setFinishNoLaborConfirm] = useState(false);

  // Track processing service ID for per-button loading state
  const [processingServiceId, setProcessingServiceId] = useState(null);

  // Form inputs - Labor
  const [laborDesc, setLaborDesc] = useState("");
  const [laborHorasEst, setLaborHorasEst] = useState("1");
  const [laborHorasReal, setLaborHorasReal] = useState("1");
  const [laborCostoHora, setLaborCostoHora] = useState("0");

  // Form inputs - Edit Labor
  const [editLaborId, setEditLaborId] = useState(null);
  const [editLaborDesc, setEditLaborDesc] = useState("");
  const [editLaborHoras, setEditLaborHoras] = useState("");
  const [editLaborCostoHora, setEditLaborCostoHora] = useState("");

  // Form inputs - Add Product
  const [prodProductoId, setProdProductoId] = useState("");
  const [prodCantidad, setProdCantidad] = useState("1");
  const [prodPrecio, setProdPrecio] = useState("");

  // Custom Confirm Modal States
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalOnConfirm, setConfirmModalOnConfirm] = useState(null);
  const [confirmModalType, setConfirmModalType] = useState("delete"); // "delete" | "finish"

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    if (typeof msg === "object" && msg !== null && msg.text) {
      setToast(msg);
    } else {
      setToast({ text: String(msg || ""), type });
    }
    setTimeout(() => setToast(null), 4500);
  };

  const showErrorToast = (msg) => showToast(msg, "error");
  const showSuccessToast = (msg) => showToast(msg, "success");

  const askConfirmation = (title, message, onConfirm, type = "delete") => {
    setConfirmModalTitle(title);
    setConfirmModalMessage(message);
    setConfirmModalOnConfirm(() => onConfirm);
    setConfirmModalType(type);
    setConfirmModalOpen(true);
  };

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const catalogosRes = await fetch("/api/taller/catalogos");
        if (catalogosRes.ok) {
          const cData = await catalogosRes.json();
          setTiposServicio(cData.tipos_servicio || cData.data?.tipos_servicio || []);
          setProductosList(cData.productos || cData.data?.productos || []);
          setMecanicosCatalog(cData.mecanicos || cData.data?.mecanicos || []);
          if (cData.estados_servicio || cData.data?.estados_servicio) {
            setEstadosServicio(cData.estados_servicio || cData.data?.estados_servicio);
          }
        }
      } catch (err) {
        console.error("Error loading catalogs in WorkOrderServicesView:", err);
      }
    }
    loadCatalogs();
  }, []);

  const getServId = (s) => (s ? Number(s.servicio_id ?? s.orden_servicio_id) : null);

  // Auto-select initial service for detail side panel
  useEffect(() => {
    if (services.length > 0 && (!selectedServiceId || !services.some(s => getServId(s) === Number(selectedServiceId)))) {
      setSelectedServiceId(getServId(services[0]));
    }
  }, [services]);

  const activeSelectedService = services.find(s => getServId(s) === Number(selectedServiceId)) || services[0] || null;

  // Live Timer Counter (HH:MM:SS) reading cronometro contract
  const [liveSeconds, setLiveSeconds] = useState(0);

  const formatSecondsToHHMMSS = (totalSec) => {
    const s = Math.max(0, Math.floor(Number(totalSec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  useEffect(() => {
    const cron = activeSelectedService?.cronometro;
    if (!cron) {
      setLiveSeconds(0);
      return;
    }

    const segundosAcumulados = Number(cron.segundos_acumulados || 0);

    if (!cron.activo || !cron.fecha_inicio_sesion) {
      setLiveSeconds(segundosAcumulados);
      return;
    }

    const startMs = new Date(cron.fecha_inicio_sesion).getTime();

    const updateTimer = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setLiveSeconds(segundosAcumulados + elapsedSec);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [
    activeSelectedService?.servicio_id,
    activeSelectedService?.cronometro?.activo,
    activeSelectedService?.cronometro?.fecha_inicio_sesion,
    activeSelectedService?.cronometro?.segundos_acumulados
  ]);

  // Calculate KPIs
  const kpiPendientes = services.filter(s => s.estado_servicio_id === 1 || s.estado_servicio_codigo === "PENDIENTE").length;
  const kpiAprobando = services.filter(s => s.estado_aprobacion_id === 1 || s.estado_aprobacion_codigo === "PENDIENTE").length;
  const kpiEnProceso = services.filter(s => s.estado_servicio_id === 2 || s.estado_servicio_codigo === "EN_PROCESO").length;
  const kpiCompletados = services.filter(s => s.estado_servicio_id === 3 || s.estado_servicio_codigo === "COMPLETADO").length;

  // Calculate Order Total
  const totalOrdenCalculado = services.reduce((sum, s) => {
    const pBase = Number(s.precio_acordado || s.precio_unitario || 0);
    const prodSum = (s.productos || []).reduce((pSum, p) => pSum + Number(p.subtotal || 0), 0);
    const moSum = (s.mano_obra || []).reduce((mSum, m) => mSum + Number(m.subtotal || (Number(m.horas_trabajadas || 1) * Number(m.costo_hora || 0))), 0);
    return sum + pBase + prodSum + moSum;
  }, 0);

  // Helper to format worked time string
  const getWorkedTimeString = (manoObraList = []) => {
    const totalMinutes = manoObraList.reduce((sum, m) => {
      if (m.minutos_trabajados !== undefined && m.minutos_trabajados !== null) {
        return sum + Number(m.minutos_trabajados);
      }
      return sum + Math.round((Number(m.horas_trabajadas) || 0) * 60);
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    const hStr = String(hours).padStart(2, "0");
    const mStr = String(minutes).padStart(2, "0");
    return `${hStr}:${mStr}:00`;
  };

  // Add Service Handler
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newTipoServicioId) {
      setModalError("Por favor selecciona un tipo de servicio.");
      return;
    }
    const parsedPrecio = parseFloat(newPrecioAcordado);
    if (newPrecioAcordado !== "" && (isNaN(parsedPrecio) || parsedPrecio < 0)) {
      setModalError("El precio acordado debe ser un monto válido no negativo.");
      return;
    }

    const orderStateId = Number(order?.estado_orden_id || order?.estado_id || 0);
    if (orderStateId === 5) {
      if (!newMecanicoId) {
        setModalError("Para agregar un servicio a una orden en Reparación, debes seleccionar un mecánico asignado.");
        return;
      }
      if (!confirmAdicional || !motivoAdicional.trim()) {
        setModalError("Para agregar un servicio adicional en una orden en Reparación se requiere confirmación explícita y motivo obligatorio.");
        return;
      }
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "AGREGAR_SERVICIO",
          tipo_servicio_id: parseInt(newTipoServicioId, 10),
          mecanico_usuario_id: newMecanicoId ? parseInt(newMecanicoId, 10) : null,
          usuario_id: newMecanicoId ? parseInt(newMecanicoId, 10) : null,
          precio_unitario: newPrecioAcordado !== "" ? parsedPrecio : null,
          precio_acordado: newPrecioAcordado !== "" ? parsedPrecio : null,
          observaciones: newObservaciones,
          confirmar: confirmAdicional,
          motivo: motivoAdicional,
          confirmar_servicio_adicional: confirmAdicional,
          motivo_servicio_adicional: motivoAdicional
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "CONFIRMATION_REQUIRED") {
          throw new Error("Para agregar un servicio adicional en una orden en Reparación se requiere confirmación explícita y motivo obligatorio.");
        }
        throw new Error(data.message || data.error || "Error al agregar servicio a la orden.");
      }

      setAddServiceModalOpen(false);
      setNewTipoServicioId("");
      setNewMecanicoId("");
      setNewPrecioAcordado("");
      setNewObservaciones("");
      setConfirmAdicional(false);
      setMotivoAdicional("");
      setModalError(null);
      showToast("Servicio agregado exitosamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Service Modal
  const openEditServiceModal = (svc) => {
    const mecId = svc.mecanico_usuario_id || svc.usuario_id;
    setEditingService(svc);
    setNewMecanicoId(mecId ? String(mecId) : "");
    setNewPrecioAcordado(svc.precio_acordado !== null && svc.precio_acordado !== undefined ? String(svc.precio_acordado) : String(svc.precio_unitario || ""));
    setNewObservaciones(svc.observacion_tecnica || svc.observaciones || "");
    setEditConfirmReasignar(false);
    setEditMotivoReasignar("");
    setModalError(null);
    setEditServiceModalOpen(true);
  };

  // Update Service Handler
  const handleUpdateService = async (e) => {
    e.preventDefault();
    if (!editingService) return;

    const targetServId = getServId(editingService);
    if (!targetServId) {
      setModalError("ID de servicio no válido.");
      return;
    }

    const parsedPrecio = parseFloat(newPrecioAcordado);
    if (newPrecioAcordado !== "" && (isNaN(parsedPrecio) || parsedPrecio < 0)) {
      setModalError("El precio acordado debe ser un monto válido no negativo.");
      return;
    }

    const initialMecId = editingService.mecanico_usuario_id || editingService.usuario_id;
    const selectedMecId = newMecanicoId ? parseInt(newMecanicoId, 10) : null;
    const isMecChanged = selectedMecId !== (initialMecId ? Number(initialMecId) : null);
    const orderStateId = Number(order?.estado_orden_id || order?.estado_id || 0);

    if (isMecChanged && orderStateId === 5 && Boolean(initialMecId)) {
      if (!editConfirmReasignar || !editMotivoReasignar.trim()) {
        setModalError("Para reasignar el mecánico de un servicio en una orden en Reparación se requiere confirmación explícita y motivo obligatorio.");
        return;
      }
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        precio_acordado: newPrecioAcordado !== "" ? parsedPrecio : null,
        precio_unitario: newPrecioAcordado !== "" ? parsedPrecio : null,
        observaciones: newObservaciones,
        observacion_tecnica: newObservaciones
      };

      if (isMecChanged) {
        payload.usuario_id = selectedMecId;
        payload.mecanico_usuario_id = selectedMecId;
        if (orderStateId === 5 && Boolean(initialMecId)) {
          payload.confirmar_reasignacion = editConfirmReasignar;
          payload.motivo_reasignacion = editMotivoReasignar.trim();
        }
      }

      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${targetServId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = {};
      }

      if (!res.ok) {
        const msg = res.status === 403 || data.error === 'FORBIDDEN'
          ? 'No tienes permiso para realizar esta acción.'
          : (data.message || data.error || 'Error al actualizar servicio.');
        throw new Error(msg);
      }

      setEditServiceModalOpen(false);
      setEditingService(null);
      showSuccessToast("Servicio actualizado correctamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Single Unified Handler for Service Operational Actions
  const handleExecuteServiceAction = async (svc, actionName, extraPayload = {}) => {
    if (!svc) return;
    const sId = getServId(svc) || selectedServiceId;
    if (!sId) return;

    const currentOrderState = Number(order?.estado_orden_id || order?.estado_id || 0);
    if (currentOrderState === 1) {
      showErrorToast("Primero debes iniciar la reparación de la orden.");
      return;
    }

    setSubmitting(true);
    setProcessingServiceId(sId);

    let targetStateId = null;
    if (actionName === "INICIAR_SERVICIO" || actionName === "REANUDAR_SERVICIO") targetStateId = 2;
    else if (actionName === "PAUSAR_SERVICIO") targetStateId = 5;
    else if (actionName === "FINALIZAR_SERVICIO") targetStateId = 3;

    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${sId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: actionName,
          estado_orden_servicio_id: targetStateId,
          estado_servicio_id: targetStateId,
          ...extraPayload
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return;
        }
        if (res.status === 403) {
          showErrorToast("No tienes permiso para realizar esta acción.");
          return;
        }
        if (res.status === 409) {
          showErrorToast(data.message || "Transición de estado no permitida.");
          return;
        }
        if (res.status === 422) {
          showErrorToast(data.message || "Asigna un mecánico antes de iniciar el servicio.");
          return;
        }
        showErrorToast(data.message || data.error || "Error al actualizar el servicio.");
        return;
      }

      let successMsg = "Estado del servicio actualizado.";
      if (actionName === "INICIAR_SERVICIO") successMsg = "Servicio iniciado correctamente.";
      else if (actionName === "PAUSAR_SERVICIO") successMsg = "Trabajo pausado y tiempo acumulado.";
      else if (actionName === "REANUDAR_SERVICIO") successMsg = "Trabajo reanudado correctamente.";
      else if (actionName === "FINALIZAR_SERVICIO") successMsg = "Servicio finalizado exitosamente.";

      showSuccessToast(successMsg);
      if (onRefresh) onRefresh();
    } catch (err) {
      showErrorToast(err.message || "Error al actualizar el servicio.");
    } finally {
      setSubmitting(false);
      setProcessingServiceId(null);
    }
  };

  // Unified Handler for Finishing a Service (used by row button and side panel)
  const handleFinishServiceClick = (svc) => {
    if (!svc) return;
    const sId = getServId(svc);
    const orderStateId = Number(order?.estado_orden_id || order?.estado_id || 5);
    const servStateId = Number(svc.estado_servicio_id);
    const hasMechanic = Boolean(svc.mecanico_usuario_id || svc.usuario_id);

    if (orderStateId === 8) {
      showErrorToast("La orden se encuentra Entregada y está en solo lectura.");
      return;
    }
    if (servStateId !== 2) {
      showErrorToast("El servicio debe estar En Proceso para poder finalizarlo.");
      return;
    }
    if (!hasMechanic) {
      showErrorToast("Debes asignar un mecánico antes de finalizar el servicio.");
      return;
    }

    // Check if labor/time exists
    const laborCount = svc.mano_obra ? svc.mano_obra.length : 0;
    if (laborCount === 0) {
      setFinishNoLaborService(svc);
      setFinishNoLaborMotivo("");
      setFinishNoLaborConfirm(false);
      setFinishNoLaborModalOpen(true);
      return;
    }

    // Positive Finish Confirmation modal
    askConfirmation(
      "Finalizar servicio",
      `¿Confirmas que el servicio "${svc.tipo_servicio_nombre}" fue terminado?\n\nDespués de finalizar quedará en modo de solo lectura.`,
      () => executeFinishService(sId),
      "finish"
    );
  };

  const executeFinishService = async (sId, extraPayload = {}) => {
    const targetService = services.find(s => getServId(s) === Number(sId)) || activeSelectedService;
    await handleExecuteServiceAction(targetService, "FINALIZAR_SERVICIO", extraPayload);
    setFinishNoLaborModalOpen(false);
    setFinishNoLaborService(null);
  };

  const handleFinishNoLaborSubmit = (e) => {
    e.preventDefault();
    if (!finishNoLaborService) return;
    if (!finishNoLaborConfirm || !finishNoLaborMotivo.trim()) {
      setModalError("Para finalizar un servicio sin mano de obra se requiere confirmación explícita y motivo obligatorio.");
      return;
    }
    const sId = getServId(finishNoLaborService);
    executeFinishService(sId, {
      confirmar_sin_mano_obra: true,
      motivo_sin_mano_obra: finishNoLaborMotivo.trim()
    });
  };

  // Form inputs - Reopen Service
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenService, setReopenService] = useState(null);
  const [reopenMotivo, setReopenMotivo] = useState("");

  const openReopenServiceModal = (svc) => {
    setReopenService(svc);
    setReopenMotivo("");
    setModalError(null);
    setReopenModalOpen(true);
  };

  const handleReopenServiceSubmit = async (e) => {
    e.preventDefault();
    if (!reopenService || !reopenMotivo.trim()) {
      setModalError("Indica obligatoriamente el motivo de la reapertura.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const sId = getServId(reopenService);
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${sId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_servicio_id: 2,
          estado_servicio_id: 2,
          motivo_reapertura: reopenMotivo,
          motivo: reopenMotivo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = res.status === 403 || data.error === 'FORBIDDEN'
          ? 'No tienes permiso para realizar esta acción.'
          : (data.message || data.error || 'Error al reabrir el servicio.');
        throw new Error(msg);
      }
      setReopenModalOpen(false);
      setReopenService(null);
      setReopenMotivo("");
      showToast("Servicio reabierto exitosamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Form inputs - Reassign Mechanic
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignServId, setReassignServId] = useState(null);
  const [reassignNewMecId, setReassignNewMecId] = useState("");
  const [reassignMotivo, setReassignMotivo] = useState("");
  const [reassignConfirm, setReassignConfirm] = useState(false);

  // Mechanic Direct Change Handler
  const handleMechanicChange = async (servicioId, newMecId) => {
    const targetServ = services.find((s) => getServId(s) === Number(servicioId));
    const currentMecId = targetServ?.mecanico_usuario_id || targetServ?.usuario_id;
    const isReassign = currentMecId && Number(currentMecId) > 0 && newMecId && Number(newMecId) !== Number(currentMecId);

    // If reassigning an already assigned mechanic while order is in REPARACION (5), open confirmation modal
    if (Number(order?.estado_orden_id || order?.estado_id || 0) === 5 && isReassign) {
      setReassignServId(servicioId);
      setReassignNewMecId(newMecId);
      setReassignMotivo("");
      setReassignConfirm(false);
      setModalError(null);
      setReassignModalOpen(true);
      return;
    }

    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: newMecId ? parseInt(newMecId, 10) : null,
          mecanico_usuario_id: newMecId ? parseInt(newMecId, 10) : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = res.status === 403 || data.error === 'FORBIDDEN'
          ? 'No tienes permiso para realizar esta acción.'
          : (data.message || data.error || 'Error al asignar mecánico.');
        showErrorToast(msg);
        return;
      }
      showSuccessToast("Mecánico asignado correctamente.");
      onRefresh();
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleConfirmReassignMechanic = async (e) => {
    e.preventDefault();
    if (!reassignConfirm || !reassignMotivo.trim()) {
      setModalError("Debes marcar la confirmación e indicar el motivo de la reasignación.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${reassignServId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: parseInt(reassignNewMecId, 10),
          mecanico_usuario_id: parseInt(reassignNewMecId, 10),
          confirmar_reasignacion: true,
          motivo_reasignacion: reassignMotivo.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = res.status === 403 || data.error === 'FORBIDDEN'
          ? 'No tienes permiso para realizar esta acción.'
          : (data.message || data.error || 'Error al reasignar mecánico.');
        throw new Error(msg);
      }
      setReassignModalOpen(false);
      showSuccessToast("Mecánico reasignado correctamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Service Status Change Handler
  const handleServiceStatusChange = async (servicioId, newEstadoId) => {
    try {
      const parsedState = parseInt(newEstadoId, 10);
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_servicio_id: parsedState,
          estado_servicio_id: parsedState
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = res.status === 403 || data.error === 'FORBIDDEN'
          ? 'No tienes permiso para realizar esta acción.'
          : (data.message || data.error || 'Error al cambiar estado del servicio.');
        throw new Error(msg);
      }
      showToast("Estado del servicio actualizado.");
      onRefresh();
    } catch (err) {
      showToast(err.message);
    }
  };

  // Service Delete Handler
  const handleDeleteService = (servicioId, svcNombre) => {
    askConfirmation(
      "Eliminar Servicio de la Orden",
      `¿Estás seguro de eliminar el servicio "${svcNombre || 'seleccionado'}" de esta orden de trabajo?`,
      async () => {
        try {
          const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = res.status === 403 || data.error === 'FORBIDDEN'
              ? 'No tienes permiso para realizar esta acción.'
              : (data.message || data.error || 'Error al eliminar servicio.');
            throw new Error(msg);
          }
          showToast("Servicio eliminado de la orden.");
          onRefresh();
        } catch (err) {
          showToast(err.message);
        }
      }
    );
  };

  // Add Labor Handler
  const handleAddLabor = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || !laborDesc.trim()) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${selectedServiceId}/mano-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalle_mano_obra: laborDesc.trim(),
          descripcion: laborDesc.trim(),
          horas_estimadas: laborHorasEst,
          horas_reales: laborHorasReal,
          costo_hora: laborCostoHora
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Error al agregar mano de obra.");
      setAddLaborModalOpen(false);
      setLaborDesc("");
      setLaborHorasEst("1");
      setLaborHorasReal("1");
      setLaborCostoHora("0");
      setModalError(null);
      showToast("Mano de obra registrada exitosamente.");
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Labor Handler
  const openEditLaborModal = (servicioId, laborItem) => {
    setSelectedServiceId(servicioId);
    setEditLaborId(laborItem.orden_servicio_mano_obra_id || laborItem.mano_obra_id || laborItem.id);
    setEditLaborDesc(laborItem.detalle_mano_obra || laborItem.descripcion || laborItem.observacion || "");
    setEditLaborHoras(String(laborItem.horas_reales || laborItem.horas_trabajadas || 1));
    setEditLaborCostoHora(String(laborItem.costo_hora || 0));
    setModalError(null);
    setEditLaborModalOpen(true);
  };

  const handleUpdateLabor = async (e) => {
    e.preventDefault();
    if (!editLaborDesc.trim()) {
      setModalError("La descripción del trabajo es requerida.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${selectedServiceId}/mano-obra`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mano_obra_id: editLaborId,
          detalle_mano_obra: editLaborDesc.trim(),
          descripcion: editLaborDesc.trim(),
          horas_reales: parseFloat(editLaborHoras),
          costo_hora: parseFloat(editLaborCostoHora)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Error al actualizar mano de obra.");

      setEditLaborModalOpen(false);
      showToast("Mano de obra actualizada.");
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Labor Handler
  const handleDeleteLabor = (servicioId, manoObraId, laborDesc) => {
    askConfirmation(
      "Eliminar Mano de Obra",
      `¿Estás seguro de eliminar este registro de mano de obra "${laborDesc || 'de la orden'}"?`,
      async () => {
        try {
          const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}/mano-obra?mano_obra_id=${manoObraId}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = res.status === 403 || data.error === 'FORBIDDEN'
              ? 'No tienes permiso para realizar esta acción.'
              : (data.message || data.error || 'Error al eliminar mano de obra.');
            throw new Error(msg);
          }
          showToast("Mano de obra eliminada.");
          onRefresh();
        } catch (err) {
          showToast(err.message);
        }
      }
    );
  };

  // Open Add Product Modal with initialized catalog selection
  const openAddProductModal = (servicioId) => {
    setSelectedServiceId(servicioId);
    if (productosList && productosList.length > 0) {
      setProdProductoId(String(productosList[0].producto_id));
      setProdPrecio(String(productosList[0].precio_venta || "0"));
    } else {
      setProdProductoId("");
      setProdPrecio("");
    }
    setProdCantidad("1");
    setModalError(null);
    setAddProductModalOpen(true);
  };

  // Add Product Handler
  const handleAddProduct = async (e) => {
    e.preventDefault();
    const productoId = Number(prodProductoId);
    if (!Number.isInteger(productoId) || productoId <= 0) {
      setModalError("Selecciona un producto del inventario.");
      return;
    }

    const qty = parseInt(prodCantidad, 10);
    if (isNaN(qty) || qty <= 0) {
      setModalError("La cantidad debe ser mayor a 0.");
      return;
    }

    const price = parseFloat(prodPrecio);
    if (isNaN(price) || price < 0) {
      setModalError("El precio unitario no puede ser negativo.");
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${selectedServiceId}/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: productoId,
          cantidad: qty,
          precio_unitario: price
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.message || data.error || "Error al asociar producto.");

      setAddProductModalOpen(false);
      setProdProductoId("");
      setProdCantidad("1");
      setProdPrecio("");
      setModalError(null);
      showToast("Producto asociado al servicio.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = (servicioId, ordenProductoId, prodNombre) => {
    askConfirmation(
      "Eliminar Producto del Servicio",
      `¿Estás seguro de eliminar el producto "${prodNombre || 'asociado'}" de este servicio?`,
      async () => {
        try {
          const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}/productos?orden_producto_id=${ordenProductoId}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = res.status === 403 || data.error === 'FORBIDDEN'
              ? 'No tienes permiso para realizar esta acción.'
              : (data.message || data.error || 'Error al eliminar producto del servicio.');
            throw new Error(msg);
          }
          showToast("Producto eliminado del servicio.");
          onRefresh();
        } catch (err) {
          showToast(err.message);
        }
      }
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            width: 'min(380px, calc(100vw - 32px))',
            minWidth: '280px',
            whiteSpace: 'normal',
            wordBreak: 'normal',
            overflowWrap: 'break-word'
          }}
          className={`p-4 rounded-xl shadow-2xl font-mono text-xs flex items-start gap-3 border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 ${
            toast.type === "error"
              ? "bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/50"
              : "bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/50"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold block text-xs uppercase tracking-wider mb-0.5 font-mono">
              {toast.type === "error" ? "Error u Operación" : "Confirmación"}
            </span>
            <span className="leading-relaxed font-sans text-xs block text-slate-200">{toast.text}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors ml-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-[#161a21] p-5 border border-[#2d3748] rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-100 font-mono tracking-tight">Gestión de Servicios</h2>
            <span className="px-2.5 py-1 bg-[#84924a]/20 text-[#bfce7f] border border-[#bfce7f]/40 rounded-md font-mono text-xs font-bold">
              {order?.codigo_orden || `OT-${ordenId}`}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Bicicleta: <strong className="text-slate-200">{order?.bicicleta_marca ? `${order.bicicleta_marca} ${order.bicicleta_modelo || ""}` : "Bicicleta de Taller"}</strong> | Cliente: <strong className="text-slate-200">{order?.cliente_nombre || "Cliente"}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {backUrl && (
            <Link
              href={backUrl}
              className="px-4 py-2 bg-[#1c2129] hover:bg-[#252c37] border border-[#2d3748] text-slate-200 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              VOLVER AL DETALLE DE LA OT
            </Link>
          )}
          <button
            onClick={() => {
              setModalError(null);
              setAddServiceModalOpen(true);
            }}
            className="px-4 py-2 bg-[#84924a] hover:brightness-110 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 border-t border-[#a6b66b] shadow-md"
          >
            <Plus className="w-4 h-4" />
            AGREGAR SERVICIO
          </button>
        </div>
      </div>

      {/* RECIBIDA Warning Banner */}
      {Number(order?.estado_orden_id || order?.estado_id || 0) === 1 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-300 font-sans text-xs shadow-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="block font-bold text-amber-200 text-sm font-mono mb-0.5">Orden en Recibida</strong>
              <span>Primero debes iniciar la reparación de la orden para poder iniciar el trabajo en sus servicios.</span>
            </div>
          </div>
          {onStartRepair && (
            <button
              onClick={onStartRepair}
              className="px-4 py-2 bg-[#bfce7f] hover:bg-[#a6b66b] text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shrink-0 shadow-lg cursor-pointer font-extrabold uppercase tracking-wider"
            >
              <Wrench className="w-4 h-4" />
              INICIAR REPARACIÓN AHORA
            </button>
          )}
        </div>
      )}

      {/* Main Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Detalle de Servicios Table (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-[#1c2129] border-b border-[#2d3748] flex items-center justify-between">
              <h3 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#bfce7f]" />
                Detalle de Servicios
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {services.length} {services.length === 1 ? "servicio registrado" : "servicios registrados"}
              </span>
            </div>

            {services.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-mono text-xs space-y-3">
                <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No hay servicios registrados en esta orden de trabajo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-[#0a0c10]/60 border-b border-[#2d3748] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="p-3.5 pl-4">Código</th>
                      <th className="p-3.5">Tipo / Descripción</th>
                      <th className="p-3.5">Mecánico</th>
                      <th className="p-3.5">ESTADO DEL SERVICIO</th>
                      <th className="p-3.5 text-right">Precio (RD$)</th>
                      <th className="p-3.5 pr-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3748]/60">
                    {services.map((svc, idx) => {
                      const sId = getServId(svc) || (idx + 1);
                      const isSelected = Number(sId) === Number(selectedServiceId);
                      const srvCode = `SRV-${String(idx + 1).padStart(3, "0")}`;

                      return (
                        <tr
                          key={sId}
                          onClick={() => setSelectedServiceId(sId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#84924a]/10 border-l-4 border-l-[#bfce7f]"
                              : "hover:bg-[#1c2129]/60"
                          }`}
                        >
                          {/* Code */}
                          <td className="p-3.5 pl-4 font-mono font-bold text-[#bfce7f] whitespace-nowrap">
                            {srvCode}
                          </td>

                          {/* Name & Desc */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-100 font-sans">{svc.tipo_servicio_nombre}</div>
                            {svc.observacion_tecnica || svc.tipo_servicio_descripcion ? (
                              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                                {svc.observacion_tecnica || svc.tipo_servicio_descripcion}
                              </div>
                            ) : null}
                          </td>

                          {/* Mechanic Select */}
                          <td className="p-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={(svc.mecanico_usuario_id || svc.usuario_id) ? String(svc.mecanico_usuario_id || svc.usuario_id) : ""}
                              onChange={(e) => handleMechanicChange(svc.orden_servicio_id || svc.servicio_id, e.target.value)}
                              className="bg-[#0a0c10] border border-[#2d3748] rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-[#bfce7f]"
                            >
                              <option value="">Sin asignar</option>
                              {mecanicosCatalog.map((m) => (
                                <option key={m.usuario_id} value={String(m.usuario_id)}>
                                  {m.nombre_completo}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Service Status Badge */}
                          <td className="p-3.5 whitespace-nowrap space-y-1" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const rules = getServiceStateRules(svc.estado_servicio_id, svc.mecanico_usuario_id || svc.usuario_id, Number(order?.estado_orden_id || order?.estado_id || 5));
                              return (
                                <span className={`px-2.5 py-1 border rounded-md text-[10px] font-mono font-bold inline-block ${rules.badgeClass}`}>
                                  {rules.badgeLabel}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Price */}
                          <td className="p-3.5 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                            RD$ {Number(svc.precio_acordado || svc.precio_unitario || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 pr-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Service Modal button */}
                              <button
                                onClick={() => openEditServiceModal(svc)}
                                className="p-1.5 text-slate-400 hover:text-slate-200 bg-[#1c2129] hover:bg-[#252c37] border border-[#2d3748] rounded-lg transition-colors"
                                title="Editar servicio"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteService(sId, svc.tipo_servicio_nombre)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#1c2129] hover:bg-rose-500/10 border border-[#2d3748] hover:border-rose-500/30 rounded-lg transition-colors"
                                title="Eliminar servicio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer Total */}
            <div className="p-4 bg-[#1c2129] border-t border-[#2d3748] flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400 uppercase font-semibold">
                Mostrando {services.length} de {services.length} servicios
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase font-bold">TOTAL GENERAL OT:</span>
                <span className="text-[#bfce7f] font-black text-base">
                  RD$ {(Number(order?.total_orden ?? totalOrdenCalculado)).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detalle del Servicio Activo Side Panel (1/3) */}
        <div className="space-y-4">
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 space-y-5 shadow-xl sticky top-4">
            <div className="border-b border-[#2d3748] pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#bfce7f]" />
                Detalle del Servicio Seleccionado
              </h3>
              {activeSelectedService && (
                <span className="text-[11px] font-mono text-[#bfce7f] font-bold">
                  ID #{activeSelectedService.orden_servicio_id}
                </span>
              )}
            </div>

            {activeSelectedService ? (() => {
              const actId = getServId(activeSelectedService);
              const activeRules = getServiceStateRules(
                activeSelectedService.estado_servicio_id,
                activeSelectedService.mecanico_usuario_id || activeSelectedService.usuario_id,
                Number(order?.estado_orden_id || order?.estado_id || 5)
              );
              const actHasOpenSession = Boolean(
                activeSelectedService.cronometro?.activo ?? activeSelectedService.en_proceso_cronometro
              );

              return (
                <div className="space-y-4">
                  {/* Service Header Info */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-base font-bold text-slate-100 font-sans">
                        {activeSelectedService.tipo_servicio_nombre}
                      </h4>
                      <span className={`px-2 py-0.5 border rounded-md text-[10px] font-mono font-bold ${activeRules.badgeClass}`}>
                        {activeRules.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                      {activeSelectedService.observacion_tecnica || activeSelectedService.tipo_servicio_descripcion || "Sin observaciones técnicas registradas."}
                    </p>
                  </div>

                  {/* Worked Time & Live Cronómetro Box */}
                  <div className="p-4 bg-[#0a0c10] border border-[#2d3748] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock className={`w-5 h-5 ${actHasOpenSession ? "text-emerald-400 animate-pulse" : "text-[#bfce7f]"}`} />
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                            {actHasOpenSession ? "Cronómetro activo" : "Tiempo trabajado"}
                          </span>
                          <span className="text-xl font-black font-mono text-slate-100 tracking-wider">
                            {formatSecondsToHHMMSS(liveSeconds)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-slate-400 block uppercase">
                          {actHasOpenSession ? "Tiempo de la sesión actual" : "Tiempo acumulado"}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {formatSecondsToHHMMSS(activeSelectedService.cronometro?.segundos_acumulados || 0)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Mano de Obra Registrada Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#2d3748] pb-1.5">
                      <span className="text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-[#bfce7f]" /> Mano de Obra Registrada
                      </span>
                      {activeRules.canAddLabor ? (
                        <button
                          onClick={() => {
                            setSelectedServiceId(actId);
                            setLaborDesc("");
                            setLaborHorasEst("1");
                            setLaborHorasReal("1");
                            setLaborCostoHora("0");
                            setModalError(null);
                            setAddLaborModalOpen(true);
                          }}
                          className="text-[11px] font-mono text-[#bfce7f] hover:underline flex items-center gap-1"
                        >
                          + Agregar Mano de Obra
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">
                          {activeSelectedService.estado_servicio_id === 5 ? "Reanuda para agregar" : "No disponible"}
                        </span>
                      )}
                    </div>

                    {activeSelectedService.mano_obra && activeSelectedService.mano_obra.length > 0 ? (
                      <div className="space-y-2">
                        {activeSelectedService.mano_obra.map((m) => {
                          const mId = m.orden_servicio_mano_obra_id || m.mano_obra_id || m.id;
                          return (
                            <div
                              key={mId}
                              className="p-2.5 bg-[#1c2129] border border-[#2d3748] rounded-xl flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <Wrench className="w-3.5 h-3.5 text-[#bfce7f] shrink-0" />
                                <div className="truncate">
                                  <span className="truncate text-slate-200 block font-semibold">
                                    {m.detalle_mano_obra?.trim()}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {m.horas_trabajadas || m.horas_reales || (m.minutos_trabajados ? (m.minutos_trabajados / 60).toFixed(1) : 1)} hr(s)
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-[#bfce7f]">
                                  RD$ {Number(m.subtotal || m.costo_total || (Number(m.horas_trabajadas || 1) * Number(m.costo_hora || 0))).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </span>
                                {activeRules.canAddLabor && (
                                  <>
                                    <button
                                      onClick={() => openEditLaborModal(actId, m)}
                                      className="text-slate-500 hover:text-slate-200 transition-colors p-1"
                                      title="Editar mano de obra"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLabor(actId, mId, m.detalle_mano_obra || m.descripcion || m.observacion)}
                                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                      title="Eliminar mano de obra"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-center font-mono">
                        Sin registros de mano de obra.
                      </p>
                    )}
                  </div>

                  {/* Associated Spare Parts / Products Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#2d3748] pb-1.5">
                      <span className="text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-sky-400" /> Repuestos Asociados
                      </span>
                      {activeRules.canAddProduct ? (
                        <button
                          onClick={() => openAddProductModal(actId)}
                          className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                        >
                          + Agregar Repuesto
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">
                          {activeSelectedService.estado_servicio_id === 5 ? "Reanuda para agregar" : "No disponible"}
                        </span>
                      )}
                    </div>

                    {activeSelectedService.productos && activeSelectedService.productos.length > 0 ? (
                      <div className="space-y-2">
                        {activeSelectedService.productos.map((prod) => {
                          const pId = prod.orden_producto_id || prod.producto_id || prod.id;
                          return (
                            <div
                              key={pId}
                              className="p-2.5 bg-[#1c2129] border border-[#2d3748] rounded-xl flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="truncate text-slate-200">{prod.producto_nombre} (x{prod.cantidad})</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-sky-400">
                                  RD$ {Number(prod.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </span>
                                {activeRules.canAddProduct && (
                                  <button
                                    onClick={() => handleDeleteProduct(actId, pId, prod.producto_nombre)}
                                    className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                    title="Eliminar repuesto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-center font-mono">
                        Sin repuestos o productos asociados.
                      </p>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="pt-3 border-t border-[#2d3748] space-y-2">
                    {/* PENDIENTE (1) -> INICIAR_SERVICIO */}
                    {Number(activeSelectedService.estado_servicio_id) === 1 && (
                      activeRules.requiresMechanicToStart ? (
                        <div className="space-y-1">
                          <button
                            disabled
                            className="w-full py-2.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-xl font-mono text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Play className="w-4 h-4" /> Iniciar Servicio
                          </button>
                          <p className="text-[11px] font-mono text-amber-400 text-center">
                            Asigna un mecánico antes de iniciar el servicio.
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleExecuteServiceAction(activeSelectedService, "INICIAR_SERVICIO")}
                          disabled={submitting || processingServiceId === actId}
                          className="w-full py-2.5 bg-[#84924a] hover:brightness-110 text-white font-bold rounded-xl font-mono text-xs transition-all flex items-center justify-center gap-2 border-t border-[#a6b66b]"
                        >
                          {processingServiceId === actId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Iniciar Servicio
                        </button>
                      )
                    )}

                    {/* EN_PROCESO (2) -> PAUSAR_SERVICIO or FINALIZAR_SERVICIO */}
                    {Number(activeSelectedService.estado_servicio_id) === 2 && (
                      <>
                        <button
                          onClick={() => handleExecuteServiceAction(activeSelectedService, "PAUSAR_SERVICIO")}
                          disabled={submitting || processingServiceId === actId}
                          className="w-full py-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl font-mono text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          {processingServiceId === actId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                          Pausar Trabajo
                        </button>

                        <button
                          onClick={() => handleFinishServiceClick(activeSelectedService)}
                          disabled={submitting || processingServiceId === actId}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl font-mono text-xs transition-all flex items-center justify-center gap-2 border-t border-emerald-400 disabled:opacity-50"
                        >
                          {processingServiceId === actId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Finalizar Servicio
                        </button>
                      </>
                    )}

                    {/* PAUSADO (5 or 4) -> REANUDAR_SERVICIO */}
                    {(Number(activeSelectedService.estado_servicio_id) === 5 || Number(activeSelectedService.estado_servicio_id) === 4) && (
                      <button
                        onClick={() => handleExecuteServiceAction(activeSelectedService, "REANUDAR_SERVICIO")}
                        disabled={submitting || processingServiceId === actId}
                        className="w-full py-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl font-mono text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        {processingServiceId === actId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 text-amber-300" />
                        )}
                        Reanudar Trabajo
                      </button>
                    )}

                    {/* COMPLETADO (3) -> Reabrir (if canReopen) */}
                    {Number(activeSelectedService.estado_servicio_id) === 3 && activeRules.canReopen && (
                      <button
                        onClick={() => openReopenServiceModal(activeSelectedService)}
                        className="w-full py-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4 text-indigo-300" /> Reabrir Servicio
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <p className="text-xs text-slate-500 italic text-center p-4 font-mono">
                Selecciona un servicio de la tabla para ver su detalle.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Agregar Servicio */}
      {addServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#bfce7f]" />
                Agregar Servicio a la Orden
              </h3>
              <button
                type="button"
                onClick={() => setAddServiceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddService} className="space-y-4 text-xs font-sans">
              {Number(order?.estado_orden_id || order?.estado_id || 5) === 5 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 text-amber-300">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Orden en Reparación: Servicio Adicional</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90 font-mono">
                    La orden está en Reparación. Añadir un servicio adicional requiere mecánico asignado, confirmación y motivo explicativo.
                  </p>
                  <div className="pt-2 border-t border-amber-500/20 space-y-2 font-mono">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-amber-200">
                      <input
                        type="checkbox"
                        checked={confirmAdicional}
                        onChange={(e) => setConfirmAdicional(e.target.checked)}
                        className="rounded border-amber-500/50 bg-[#0a0c10] text-[#bfce7f] focus:ring-0"
                      />
                      Confirmar adición de servicio adicional
                    </label>
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-200/90 mb-1 font-sans">Motivo del servicio adicional *</label>
                      <input
                        type="text"
                        value={motivoAdicional}
                        onChange={(e) => setMotivoAdicional(e.target.value)}
                        placeholder="Ej: Detectado desgaste extra durante la revisión técnica"
                        className="w-full p-2 bg-[#0a0c10] border border-amber-500/40 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Tipo de Servicio *</label>
                <select
                  required
                  value={newTipoServicioId}
                  onChange={(e) => {
                    setNewTipoServicioId(e.target.value);
                    const found = tiposServicio.find((t) => String(t.tipo_servicio_id) === String(e.target.value));
                    if (found) setNewPrecioAcordado(found.precio_base);
                  }}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                >
                  <option value="">-- Selecciona un Servicio --</option>
                  {tiposServicio.map((t) => (
                    <option key={t.tipo_servicio_id} value={t.tipo_servicio_id}>
                      {t.nombre} (RD$ {parseFloat(t.precio_base || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Mecánico Responsable</label>
                <select
                  value={newMecanicoId}
                  onChange={(e) => setNewMecanicoId(e.target.value)}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono"
                >
                  <option value="">-- Sin mecánico asignado --</option>
                  {mecanicosCatalog.map((m) => (
                    <option key={m.usuario_id} value={String(m.usuario_id)}>
                      {m.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Precio Acordado (RD$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrecioAcordado}
                  onChange={(e) => setNewPrecioAcordado(e.target.value)}
                  placeholder="Monto acordado..."
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Observaciones / Notas Técnicas</label>
                <textarea
                  rows={3}
                  value={newObservaciones}
                  onChange={(e) => setNewObservaciones(e.target.value)}
                  placeholder="Instrucciones o notas adicionales para este servicio..."
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] leading-relaxed"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setAddServiceModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 flex items-center gap-2 font-mono text-xs border-t border-[#a6b66b]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Guardando..." : "Guardar Servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Editar Servicio */}
      {editServiceModalOpen && editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#bfce7f]" />
                Editar Servicio — {editingService.tipo_servicio_nombre}
              </h3>
              <button
                type="button"
                onClick={() => setEditServiceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateService} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Mecánico Responsable</label>
                <select
                  value={newMecanicoId}
                  onChange={(e) => setNewMecanicoId(e.target.value)}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono"
                >
                  <option value="">-- Sin mecánico asignado --</option>
                  {mecanicosCatalog.map((m) => (
                    <option key={m.usuario_id} value={String(m.usuario_id)}>
                      {m.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selMecId = newMecanicoId ? parseInt(newMecanicoId, 10) : null;
                const initMecId = editingService.mecanico_usuario_id || editingService.usuario_id;
                const isMecChanged = selMecId !== (initMecId ? Number(initMecId) : null);
                const orderStateId = Number(order?.estado_orden_id || order?.estado_id || 5);

                if (isMecChanged && orderStateId === 5 && Boolean(initMecId)) {
                  return (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 text-amber-300 font-sans">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Reasignación de Mecánico en Reparación</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-200/90 font-mono">
                        Estás cambiando el mecánico asignado en una orden en Reparación. Debes confirmar y proporcionar un motivo obligatorio.
                      </p>
                      <div className="pt-2 border-t border-amber-500/20 space-y-2 font-mono">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-amber-200">
                          <input
                            type="checkbox"
                            checked={editConfirmReasignar}
                            onChange={(e) => setEditConfirmReasignar(e.target.checked)}
                            className="rounded border-amber-500/50 bg-[#0a0c10] text-[#bfce7f] focus:ring-0"
                          />
                          Confirmo la reasignación
                        </label>
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-200/90 mb-1 font-sans">Motivo de la reasignación *</label>
                          <input
                            type="text"
                            value={editMotivoReasignar}
                            onChange={(e) => setEditMotivoReasignar(e.target.value)}
                            placeholder="Ej: Reasignación por especialidad / disponibilidad"
                            className="w-full p-2 bg-[#0a0c10] border border-amber-500/40 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400 font-sans"
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Precio Acordado (RD$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrecioAcordado}
                  onChange={(e) => setNewPrecioAcordado(e.target.value)}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Observaciones / Notas Técnicas</label>
                <textarea
                  rows={3}
                  value={newObservaciones}
                  onChange={(e) => setNewObservaciones(e.target.value)}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] leading-relaxed"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setEditServiceModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 flex items-center gap-2 font-mono text-xs border-t border-[#a6b66b]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Actualizando..." : "Actualizar Servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Registrar Mano de Obra */}
      {addLaborModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#bfce7f]" />
                Registrar Mano de Obra
              </h3>
              <button
                type="button"
                onClick={() => setAddLaborModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddLabor} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Descripción del Trabajo *</label>
                <input
                  required
                  type="text"
                  value={laborDesc}
                  onChange={(e) => setLaborDesc(e.target.value)}
                  placeholder="ej. Diagnóstico, cambio de sellos y desangrado"
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Horas Est.</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={laborHorasEst}
                    onChange={(e) => setLaborHorasEst(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Horas Reales</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={laborHorasReal}
                    onChange={(e) => setLaborHorasReal(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Costo/Hora (RD$)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={laborCostoHora}
                    onChange={(e) => setLaborCostoHora(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setAddLaborModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 flex items-center gap-2 font-mono text-xs border-t border-[#a6b66b]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Guardando..." : "Guardar Mano de Obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Editar Mano de Obra */}
      {editLaborModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#bfce7f]" />
                Editar Mano de Obra
              </h3>
              <button
                type="button"
                onClick={() => setEditLaborModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateLabor} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Descripción del Trabajo *</label>
                <input
                  required
                  type="text"
                  value={editLaborDesc}
                  onChange={(e) => setEditLaborDesc(e.target.value)}
                  placeholder="Detalle del trabajo realizado..."
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Horas Trabajadas</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={editLaborHoras}
                    onChange={(e) => setEditLaborHoras(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Costo/Hora (RD$)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editLaborCostoHora}
                    onChange={(e) => setEditLaborCostoHora(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setEditLaborModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 flex items-center gap-2 font-mono text-xs border-t border-[#a6b66b]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Actualizando..." : "Actualizar Mano de Obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Asociar Producto */}
      {addProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                Asociar Producto / Repuesto
              </h3>
              <button
                type="button"
                onClick={() => setAddProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedServiceId && (
              <div className="p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl flex items-center justify-between font-mono text-xs">
                <span className="text-slate-400 font-semibold">Servicio Receptor:</span>
                <span className="font-bold text-[#bfce7f]">
                  {services.find((s) => getServId(s) === Number(selectedServiceId))?.tipo_servicio_nombre || `Servicio #${selectedServiceId}`}
                </span>
              </div>
            )}

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Producto del Inventario *</label>
                <select
                  required
                  value={prodProductoId}
                  onChange={(e) => {
                    setProdProductoId(e.target.value);
                    const found = productosList.find((p) => String(p.producto_id) === String(e.target.value));
                    if (found) setProdPrecio(found.precio_venta);
                  }}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="">-- Selecciona un Producto --</option>
                  {productosList.map((p) => (
                    <option key={p.producto_id} value={p.producto_id}>
                      {p.nombre} (RD$ {parseFloat(p.precio_venta || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Cantidad *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={prodCantidad}
                    onChange={(e) => setProdCantidad(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold font-sans">Precio Unitario (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodPrecio}
                    onChange={(e) => setProdPrecio(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl flex justify-between items-center font-mono text-xs">
                <span className="text-slate-400 font-semibold uppercase">Subtotal Calculado:</span>
                <span className="font-bold text-sky-400 text-sm">
                  RD$ {(parseFloat(prodCantidad || 0) * parseFloat(prodPrecio || 0)).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setAddProductModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:brightness-110 flex items-center gap-2 font-mono text-xs border-t border-sky-400"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Asociando..." : "Asociar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Finalizar servicio sin mano de obra */}
      {finishNoLaborModalOpen && finishNoLaborService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-amber-500/40 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "540px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Finalizar Servicio Sin Mano de Obra
              </h3>
              <button
                type="button"
                onClick={() => setFinishNoLaborModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleFinishNoLaborSubmit} className="space-y-4 text-xs font-sans">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 text-amber-300">
                <p className="text-[11px] leading-relaxed text-amber-200/90 font-mono">
                  El servicio <strong>"{finishNoLaborService.tipo_servicio_nombre}"</strong> no registra horas ni mano de obra trabajada. Para finalizarlo, debes confirmar explícitamente y justificar el motivo.
                </p>
                <div className="pt-2 border-t border-amber-500/20 space-y-2 font-mono">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-amber-200">
                    <input
                      type="checkbox"
                      checked={finishNoLaborConfirm}
                      onChange={(e) => setFinishNoLaborConfirm(e.target.checked)}
                      className="rounded border-amber-500/50 bg-[#0a0c10] text-[#bfce7f] focus:ring-0"
                    />
                    Confirmo la finalización sin mano de obra
                  </label>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-200/90 mb-1 font-sans">
                      Motivo explicativo obligatorio *
                    </label>
                    <input
                      type="text"
                      required
                      value={finishNoLaborMotivo}
                      onChange={(e) => setFinishNoLaborMotivo(e.target.value)}
                      placeholder="Ej: Servicio incluido en paquete preliminar / No requirió tiempo adicional"
                      className="w-full p-2.5 bg-[#0a0c10] border border-amber-500/40 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400 font-sans"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setFinishNoLaborModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 font-mono text-xs border-t border-emerald-400 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar y Finalizar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Confirmación (Eliminación o Finalización) */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className={`bg-[#161a21] border rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100 animate-in fade-in zoom-in duration-150 ${
              confirmModalType === "finish" ? "border-emerald-500/40" : "border-[#2d3748]"
            }`}
            style={{ width: "100%", maxWidth: "480px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                {confirmModalType === "finish" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}
                {confirmModalTitle || (confirmModalType === "finish" ? "Finalizar servicio" : "Confirmación Requerida")}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed whitespace-pre-line">
              {confirmModalMessage}
            </div>

            <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs hover:bg-[#1c2129] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setConfirmModalOpen(false);
                  if (confirmModalOnConfirm) {
                    await confirmModalOnConfirm();
                  }
                }}
                className={`px-5 py-2.5 text-white font-bold rounded-xl flex items-center gap-2 font-mono text-xs transition-colors border-t ${
                  confirmModalType === "finish"
                    ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-400"
                    : "bg-rose-600 hover:bg-rose-500 border-rose-400"
                }`}
              >
                {confirmModalType === "finish" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar finalización
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirmar Eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Reabrir Servicio */}
      {reopenModalOpen && reopenService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "540px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-400" />
                Reabrir Servicio — {reopenService.tipo_servicio_nombre}
              </h3>
              <button
                type="button"
                onClick={() => setReopenModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-1.5 text-indigo-300">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Acción de Control de Calidad</span>
              </div>
              <p className="text-[11px] leading-relaxed text-indigo-200/90 font-mono">
                La reapertura de un servicio completado cambiará su estado a En Proceso y requiere indicar obligatoriamente el motivo explicativo.
              </p>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleReopenServiceSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Motivo de Reapertura *</label>
                <textarea
                  required
                  rows={3}
                  value={reopenMotivo}
                  onChange={(e) => setReopenMotivo(e.target.value)}
                  placeholder="Ej: Se requiere revisión adicional debido a leve fricción detectada en prueba de ruta..."
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-indigo-400 leading-relaxed font-sans"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setReopenModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 font-mono text-xs transition-all border-t border-indigo-400"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Reabriendo..." : "Confirmar Reapertura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Reasignar Mecánico en Reparación */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "540px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                Reasignar Mecánico Responsable
              </h3>
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-amber-300 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Orden en Reparación: Reasignación de Mecánico</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/90 font-sans">
                Para cambiar el mecánico asignado en un servicio en Reparación se requiere confirmación explícita y motivo obligatorio.
              </p>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Error al validar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmReassignMechanic} className="space-y-4 text-xs font-sans">
              <div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-200 font-mono">
                  <input
                    type="checkbox"
                    checked={reassignConfirm}
                    onChange={(e) => setReassignConfirm(e.target.checked)}
                    className="rounded border-amber-500/50 bg-[#0a0c10] text-[#bfce7f] focus:ring-0"
                  />
                  Confirmar reasignación de mecánico en este servicio
                </label>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Motivo de Reasignación *</label>
                <input
                  type="text"
                  required
                  value={reassignMotivo}
                  onChange={(e) => setReassignMotivo(e.target.value)}
                  placeholder="Ej: Reasignación por rotación de turno / especialidad técnica"
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 font-mono text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center gap-2 font-mono text-xs transition-all border-t border-amber-400"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {submitting ? "Guardando..." : "Confirmar Reasignación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
