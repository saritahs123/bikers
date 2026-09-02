"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wrench,
  User,
  Bike,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  DollarSign,
  Package,
  History,
  ClipboardList,
  Edit,
  RotateCcw,
  Check,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X,
  Info
} from "lucide-react";
import WorkOrderServicesView from "./WorkOrderServicesView";
import WorkOrderHistoryView from "./WorkOrderHistoryView";

export default function WorkOrderDetailView({ ordenId, onBack }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleBackClick = () => {
    const returnTo = searchParams ? searchParams.get("return_to") : null;
    const isSafeInternalReturn =
      typeof returnTo === "string" &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.includes("://");

    if (isSafeInternalReturn) {
      router.push(returnTo);
      return;
    }

    if (onBack) {
      onBack();
    } else {
      router.push("/work-orders");
    }
  };

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [baseVivo, setBaseVivo] = useState(0);
  const [receivedAtMonotonic, setReceivedAtMonotonic] = useState(0);
  const [tickerTimestamp, setTickerTimestamp] = useState(0);

  const hasActiveService = React.useMemo(() => {
    if (order?.tiempo_total_confiable === false) {
      return false;
    }
    return (order?.servicios || []).some(
      (s) => s.estado_servicio_codigo === "EN_PROCESO" || Number(s.estado_servicio_id) === 2
    );
  }, [order?.servicios, order?.tiempo_total_confiable]);

  const incompleteServices = React.useMemo(() => {
    return (order?.servicios || [])
      .filter((s) => s.activo !== false)
      .filter((service) => {
        const id = Number(service.estado_servicio_id || service.estado_id || 0);
        const code = String(
          service.estado_servicio_codigo ||
          service.estado_codigo ||
          service.estado ||
          ""
        ).trim().toUpperCase();
        const name = String(
          service.estado_servicio_nombre ||
          service.estado_nombre ||
          ""
        ).trim().toUpperCase();

        const isClosed =
          id === 3 || // 3 = COMPLETADO
          id === 4 || // 4 = CANCELADO
          ["COMPLETADO", "FINALIZADO", "CANCELADO", "ANULADO", "INACTIVO"].includes(code) ||
          ["COMPLETADO", "FINALIZADO", "CANCELADO", "ANULADO", "INACTIVO"].includes(name);

        return !isClosed;
      });
  }, [order?.servicios]);

  const hasIncompleteServices = incompleteServices.length > 0;

  useEffect(() => {
    if (!hasActiveService) return;

    const interval = setInterval(() => {
      setTickerTimestamp(performance.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveService]);

  const segundosEnVivo = React.useMemo(() => {
    if (!hasActiveService) {
      return Number(order?.total_tiempo_transcurrido_vivo ?? 0);
    }
    const elapsedAfterResponse = Math.max(0, Math.floor((tickerTimestamp - receivedAtMonotonic) / 1000));
    return baseVivo + elapsedAfterResponse;
  }, [baseVivo, receivedAtMonotonic, hasActiveService, tickerTimestamp, order?.total_tiempo_transcurrido_vivo]);

  const formatFriendlyDuration = (totalSeconds) => {
    const secs = Number(totalSeconds || 0);
    if (secs <= 0) return "0 s";

    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const remainingSeconds = secs % 60;

    if (hours > 0) {
      if (minutes > 0) {
        return `${hours} h ${minutes} min`;
      }
      return `${hours} h`;
    }

    if (minutes > 0) {
      if (remainingSeconds > 0) {
        return `${minutes} min ${remainingSeconds} s`;
      }
      return `${minutes} min`;
    }

    return `${remainingSeconds} s`;
  };
  const [activeTab, setActiveTab] = useState("resumen"); // 'resumen' | 'servicios' | 'historial'

  // Change status & edit order modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [catalogs, setCatalogs] = useState({ estados: [], mecanicos: [] });
  const [newStatusId, setNewStatusId] = useState("");
  const [newMecanicoId, setNewMecanicoId] = useState("");
  const [newPrioridadId, setNewPrioridadId] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  const [selectedServiceToReopen, setSelectedServiceToReopen] = useState("");
  const [personaRecibeInput, setPersonaRecibeInput] = useState("");
  const [confirmarEntregaCheck, setConfirmarEntregaCheck] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Dedicated Reopen Repair Modal State
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenSelectedServiceId, setReopenSelectedServiceId] = useState("");
  const [submittingReopen, setSubmittingReopen] = useState(false);
  const [reopenModalError, setReopenModalError] = useState(null);

  // Next actions checklist local state
  const [nextTasks, setNextTasks] = useState([]);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [showAddTaskInput, setShowAddTaskInput] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchOrderDetail = useCallback(async (isSilent = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isSilent && !order) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`, { signal: controller.signal });
      const payload = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return;
        }

        let title = "No pudimos cargar la orden";
        let message = payload.message || payload.error || "No se pudo cargar la orden de trabajo.";
        if (res.status === 400) {
          title = "Identificador de orden inválido";
          message = payload.message || "Identificador de orden inválido.";
        } else if (res.status === 403) {
          title = "No tienes permiso para consultar esta orden";
          message = payload.message || "No tienes permiso para consultar esta orden.";
        } else if (res.status === 404) {
          title = "La orden solicitada no existe";
          message = payload.message || "La orden solicitada no existe.";
        } else if (res.status === 500) {
          title = "No pudimos cargar la orden";
          message = payload.message || "No pudimos cargar la orden. Inténtalo nuevamente.";
        }

        setError({
          status: res.status,
          title,
          message
        });
        return;
      }

      const orderData = payload?.data ?? payload?.order ?? payload;

      if (!orderData || typeof orderData !== "object" || !orderData.orden_id) {
        setError({
          status: 500,
          title: "No pudimos cargar la orden",
          message: "La respuesta del servidor no contiene los datos esperados."
        });
        return;
      }

      setOrder(orderData);
      setBaseVivo(Number(orderData.total_tiempo_transcurrido_vivo || 0));
      const monotonicNow = performance.now();
      setReceivedAtMonotonic(monotonicNow);
      setTickerTimestamp(monotonicNow);
      setNewStatusId(String(orderData.estado_orden_id));
      let mecId = orderData.mecanico_usuario_id ? String(orderData.mecanico_usuario_id) : "";
      setNewMecanicoId(mecId);
      setNewPrioridadId(orderData.prioridad_id ? String(orderData.prioridad_id) : "2");

      // Initialize next actions dynamically from order services & state
      if (orderData.servicios && orderData.servicios.length > 0) {
        const generatedTasks = orderData.servicios.map((s, idx) => ({
          id: s.orden_servicio_id || idx + 1,
          text: `Ejecutar ${s.tipo_servicio_nombre || "Servicio de Taller"}`,
          done: s.estado_servicio_codigo === "COMPLETADO" || s.estado_servicio_id === 4
        }));
        generatedTasks.push({
          id: "delivery-notify",
          text: `Notificar a ${orderData.cliente_nombre || "cliente"} para retiro`,
          done: orderData.estado_orden_id >= 7
        });
        setNextTasks(generatedTasks);
      } else {
        setNextTasks([
          { id: 1, text: "Realizar inspección inicial y diagnóstico", done: orderData.estado_orden_id > 1 },
          { id: 2, text: "Generar presupuesto y solicitar aprobación", done: orderData.estado_orden_id > 2 },
          { id: 3, text: `Notificar a ${orderData.cliente_nombre || "cliente"} para retiro`, done: orderData.estado_orden_id >= 7 }
        ]);
      }

      // Fetch catalogs strictly from /api/taller/catalogos
      const catRes = await fetch("/api/taller/catalogos", { signal: controller.signal });
      if (catRes.ok) {
        const catData = await catRes.json();
        setCatalogs({
          estados: [
            { estado_orden_id: 1, codigo: "RECIBIDA", nombre: "Recibida" },
            { estado_orden_id: 5, codigo: "REPARACION", nombre: "En Reparación" },
            { estado_orden_id: 7, codigo: "LISTA_ENTREGA", nombre: "Lista para Entrega" },
            { estado_orden_id: 8, codigo: "ENTREGADA", nombre: "Entregada" }
          ],
          prioridades: [
            { prioridad_id: 1, nombre: "Baja" },
            { prioridad_id: 2, nombre: "Normal" },
            { prioridad_id: 3, nombre: "Alta" },
            { prioridad_id: 4, nombre: "Urgente" }
          ],
          mecanicos: catData.mecanicos || catData.data?.mecanicos || []
        });
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("fetchOrderDetail Error:", err);
      if (!isSilent) {
        setError({
          status: 500,
          title: "Error de conexión",
          message: err.message || "No pudimos cargar la orden. Inténtalo nuevamente."
        });
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [ordenId]);

  const refreshSilently = () => fetchOrderDetail(true);

  useEffect(() => {
    if (ordenId) {
      fetchOrderDetail(false);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [ordenId, fetchOrderDetail]);

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg, type = "success", title = null, duration = 4500, subtext = null) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (typeof msg === "object" && msg !== null && msg.text) {
      setToast(msg);
      toastTimeoutRef.current = setTimeout(() => setToast(null), msg.duration || duration);
    } else {
      setToast({ text: String(msg || ""), type, title, subtext });
      toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
    }
  };

  const showErrorToast = (msg, title = "Error u Operación", duration = 5000) => showToast(msg, "error", title, duration);
  const showWarningToast = (msg, title = "Aviso de Operación", duration = 6500, subtext = null) => showToast(msg, "warning", title, duration, subtext);
  const showInfoToast = (msg, title = "Información", duration = 7500, subtext = null) => showToast(msg, "info", title, duration, subtext);
  const showSuccessToast = (msg, title = "Confirmación", duration = 4500) => showToast(msg, "success", title, duration);

  const [loadingStateChange, setLoadingStateChange] = useState(false);

  const handleTransitionState = async (targetStateId, notes = "") => {
    if (loadingStateChange) return;

    if ((targetStateId === 7 || targetStateId === 8) && hasIncompleteServices) {
      showInfoToast(
        "Para avanzar a Lista para Entrega o Entregar la orden, primero debes completar todos los servicios pendientes de la orden.",
        "SERVICIOS PENDIENTES",
        8000,
        `Servicios pendientes: ${incompleteServices.map(s => s.codigo_servicio || s.tipo_servicio_nombre || 'Servicio').join(', ')}`
      );
      return;
    }

    setLoadingStateChange(true);
    setModalError(null);
    try {
      const payload = targetStateId === 7 
        ? { accion: "MARCAR_LISTA_ENTREGA", estado_orden_id: 7, observacion_cambio_estado: notes }
        : { estado_orden_id: targetStateId, observacion_cambio_estado: notes };

      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        const errorKey = data.error;
        const msg = data.message || data.title || "No se pudo cambiar el estado de la orden.";

        if (errorKey === "ORDER_HAS_INCOMPLETE_SERVICES" || errorKey === "ORDER_NOT_READY_FOR_DELIVERY") {
          const incompletos = data?.data?.servicios_incompletos || data?.servicios_incompletos || [];
          const codes = incompletos.map(s => s.codigo_servicio).filter(Boolean).join(", ");
          const subtext = codes ? `Servicios pendientes: ${codes}` : null;
          showInfoToast(
            "Para marcar la orden como lista para entrega, primero debes completar todos los servicios pendientes, en proceso o pausados.",
            "ORDEN CON SERVICIOS PENDIENTES",
            8000,
            subtext
          );
        } else if (errorKey === "ORDER_NOT_IN_REPAIR") {
          showInfoToast(
            data.message || "La orden debe estar en Reparación para modificar sus servicios o repuestos.",
            "ORDEN NO ESTÁ EN REPARACIÓN",
            6500
          );
        } else if (errorKey === "INVALID_SERVICE_TRANSITION" || errorKey === "TRANSITION_NOT_ALLOWED") {
          showInfoToast(
            data.message || "La transición de estado solicitada no está permitida en este momento.",
            "RESTRICCIÓN DE PROCESO",
            6500
          );
        } else {
          showErrorToast(msg);
        }

        setModalError({ title: "No se pudo cambiar el estado", description: msg });
        return;
      }
      showSuccessToast(data.message || "Estado de la orden actualizado.");
      await fetchOrderDetail(true);
    } catch (err) {
      showErrorToast("Error al conectar con el servidor.");
      setModalError({ title: "Error de conexión", description: "Error al cambiar el estado de la orden." });
    } finally {
      setLoadingStateChange(false);
    }
  };

  const handleConfirmReopen = async (e) => {
    if (e) e.preventDefault();
    if (submittingReopen) return;
    if (!reopenReason.trim()) {
      setReopenModalError("El motivo de reapertura es obligatorio.");
      return;
    }

    setSubmittingReopen(true);
    setReopenModalError(null);

    try {
      const payload = {
        estado_orden_id: 5,
        accion: "REABRIR_REPARACION",
        motivo_reapertura: reopenReason.trim(),
        observacion: reopenReason.trim()
      };

      if (reopenSelectedServiceId) {
        payload.orden_servicio_id = parseInt(reopenSelectedServiceId, 10);
      }

      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(res.ok ? "Respuesta inválida del servidor." : `Error del servidor (${res.status})`);
      }

      if (!res.ok) {
        setReopenModalError(data?.message || data?.error || "No fue posible reabrir la reparación.");
        return;
      }

      setReopenModalOpen(false);
      setReopenReason("");
      setReopenSelectedServiceId("");
      await fetchOrderDetail(true);
      setActiveTab("servicios");
      showInfoToast(
        "La orden volvió a Reparación. Ya puedes agregar o modificar servicios y repuestos.",
        "REPARACIÓN REABIERTA",
        7000
      );
    } catch (err) {
      console.error("handleConfirmReopen Error:", err);
      setReopenModalError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSubmittingReopen(false);
    }
  };

  const handleUpdateOrderState = async (e) => {
    e.preventDefault();
    if (updatingStatus) return;
    setUpdatingStatus(true);
    setModalError(null);
    try {
      const parsedStatus = parseInt(newStatusId, 10);
      const payload = {
        estado_orden_id: parsedStatus,
        prioridad_id: newPrioridadId ? parseInt(newPrioridadId, 10) : null,
        prioridad_orden_id: newPrioridadId ? parseInt(newPrioridadId, 10) : null,
        observacion_interna: changeNotes || undefined,
        observacion_cambio_estado: changeNotes || undefined
      };

      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        const errorKey = data.error;

        if (errorKey === "ORDER_HAS_INCOMPLETE_SERVICES" || errorKey === "ORDER_NOT_READY_FOR_DELIVERY") {
          const incompletos = data?.data?.servicios_incompletos || data?.servicios_incompletos || [];
          const codes = incompletos.map(s => s.codigo_servicio).filter(Boolean).join(", ");
          const subtext = codes ? `Servicios pendientes: ${codes}` : null;
          showInfoToast(
            "Para marcar la orden como lista para entrega, primero debes completar todos los servicios pendientes, en proceso o pausados.",
            "ORDEN CON SERVICIOS PENDIENTES",
            8000,
            subtext
          );
        } else if (errorKey === "ORDER_NOT_IN_REPAIR") {
          showInfoToast(
            data.message || "La orden debe estar en Reparación para modificar sus servicios o repuestos.",
            "ORDEN NO ESTÁ EN REPARACIÓN",
            6500
          );
        } else if (errorKey === "INVALID_SERVICE_TRANSITION" || errorKey === "TRANSITION_NOT_ALLOWED") {
          showInfoToast(
            data.message || "La transición de estado solicitada no está permitida en este momento.",
            "RESTRICCIÓN DE PROCESO",
            6500
          );
        }

        let errTitle = data.title || "No pudimos guardar los cambios";
        let errDesc = data.message || "Inténtalo nuevamente en unos momentos.";

        if (res.status === 401) {
          errTitle = "Tu sesión ha expirado";
          errDesc = "Inicia sesión nuevamente para continuar.";
        } else if (res.status === 403) {
          errTitle = "Acceso denegado";
          errDesc = data.message || "No tienes permiso para editar esta orden.";
        } else if (res.status === 409) {
          errTitle = "Transición no permitida";
          errDesc = data.message || "Transición de estado no permitida.";
        }

        setModalError({ title: errTitle, description: errDesc });
        return;
      }

      setStatusModalOpen(false);
      setChangeNotes("");
      setModalError(null);
      showSuccessToast(data.message || "Orden de trabajo actualizada.");
      refreshSilently();
    } catch (err) {
      setModalError({
        title: "No pudimos guardar los cambios",
        description: "Inténtalo nuevamente en unos momentos."
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const toggleTask = (id) => {
    setNextTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    setNextTasks((prev) => [
      ...prev,
      { id: Date.now(), text: newTaskInput.trim(), done: false }
    ]);
    setNewTaskInput("");
    setShowAddTaskInput(false);
  };



  if (loading || (!order && !error)) {
    return (
      <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
        <span className="text-xs">Cargando Detalle de Orden de Trabajo...</span>
      </div>
    );
  }

  if (error) {
    const errorTitle = (error && typeof error === 'object') ? (error.title || "No pudimos cargar la orden") : "No pudimos cargar la orden";
    const errorMessage = (error && typeof error === 'object') ? (error.message || "No se pudo recuperar la orden solicitada.") : (typeof error === 'string' ? error : "No se pudo recuperar la orden solicitada.");
    const isRetryable = error && typeof error === 'object' && error.status === 500;

    const handleBackToList = () => {
      handleBackClick();
    };

    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex flex-col gap-3 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <div>
              <span className="font-bold text-sm block font-sans text-rose-200">{errorTitle}</span>
              <span className="text-rose-300 text-xs font-sans">{errorMessage}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRetryable && (
              <button
                onClick={() => fetchOrderDetail()}
                disabled={loading}
                className="px-4 py-2 bg-[#bfce7f] hover:bg-[#a6b66b] text-slate-950 rounded-xl font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Cargando...</span>
                  </>
                ) : (
                  "Reintentar"
                )}
              </button>
            )}
            <button
              onClick={handleBackToList}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl font-bold uppercase transition-colors"
            >
              Volver al Listado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine current pipeline step index
  const currentStepId = order.estado_orden_id || 1;
  const pipelineSteps = [
    { id: 1, key: "RECIBIDA", label: "Recibida", icon: Check },
    { id: 5, key: "REPARACION", label: "Reparación", icon: Wrench },
    { id: 7, key: "LISTA_ENTREGA", label: "Lista para Entrega", icon: Truck },
    { id: 8, key: "ENTREGADA", label: "Entregada", icon: ShieldCheck }
  ];

  // Extract services, labor items, and products from live backend API or order object
  const servicesList = (order.resumen_financiero?.servicios || order.servicios || []).map((s) => ({
    servicio_id: s.servicio_id,
    descripcion: s.tipo_servicio_nombre || s.descripcion_servicio || s.descripcion || "Servicio",
    observacion_tecnica: s.observacion_tecnica || s.observaciones || s.motivo_sin_mano_obra || s.diagnostico_preliminar || "",
    mecanico_nombre: s.mecanico_nombre || "Sin asignar",
    estado_nombre: s.estado_servicio_nombre || "Pendiente",
    cantidad: Number(s.cantidad || 1),
    precio_unitario: Number(s.precio_unitario || s.precio_acordado || 0),
    descuento: Number(s.valor_descuento || 0),
    subtotal: Number(s.subtotal || s.precio_acordado || 0)
  }));

  const rawLabor = order.resumen_financiero?.mano_obra ||
    (order.servicios || []).flatMap((s) => (s.mano_obra || []));

  const laborList = rawLabor
    .filter((m) => Boolean(m.detalle_mano_obra && String(m.detalle_mano_obra).trim() !== ""))
    .map((m) => ({
      mano_obra_id: m.mano_obra_id || m.id,
      servicio_id: m.orden_servicio_id,
      detalle_mano_obra: String(m.detalle_mano_obra).trim(),
      horas_reales: Number(m.horas_reales || m.horas_trabajadas || 1),
      costo_hora: Number(m.costo_hora || 0),
      subtotal: Number(m.subtotal || m.costo_total || (Number(m.horas_trabajadas || 1) * Number(m.costo_hora || 0)))
    }));

  const productsList = order.resumen_financiero?.productos ||
    [
      ...(order.productos || order.repuestos || []),
      ...(order.servicios || []).flatMap((s) => s.productos || [])
    ].filter((p, idx, self) => self.findIndex(x => (x.orden_producto_id || x.id) === (p.orden_producto_id || p.id)) === idx)
    .map((p) => ({
      orden_producto_id: p.orden_producto_id || p.id,
      producto_nombre: p.producto_nombre || p.nombre || "Producto / Repuesto",
      cantidad: Number(p.cantidad || 1),
      precio_unitario: Number(p.precio_unitario || 0),
      descuento: Number(p.valor_descuento || 0),
      subtotal: Number(p.subtotal || 0)
    }));

  const financialItems = [
    ...servicesList.map((s) => ({
      nombre: s.descripcion || s.tipo_servicio_nombre || "Servicio",
      cantidad: Number(s.cantidad || 1),
      precio: Number(s.precio_unitario || 0),
      total: Number(s.subtotal || 0)
    })),
    ...laborList.map((m) => ({
      nombre: `Mano de Obra: ${m.detalle_mano_obra || m.descripcion || "Mano de Obra"}`,
      cantidad: Number(m.horas_reales || m.horas_trabajadas || 1),
      precio: Number(m.costo_hora || 0),
      total: Number(m.subtotal || 0)
    })),
    ...productsList.map((p) => ({
      nombre: p.producto_nombre || p.nombre || "Producto / Repuesto",
      cantidad: Number(p.cantidad || 1),
      precio: Number(p.precio_unitario || 0),
      total: Number(p.subtotal || 0)
    }))
  ];

  const subtotalServicios = Number(order.subtotal_servicios ?? servicesList.reduce((acc, s) => acc + Number(s.subtotal || 0), 0));
  const subtotalManoObra = Number(order.subtotal_mano_obra ?? laborList.reduce((acc, m) => acc + Number(m.subtotal || 0), 0));
  const subtotalProductos = Number(order.subtotal_productos ?? order.subtotal_repuestos ?? productsList.reduce((acc, p) => acc + Number(p.subtotal || 0), 0));

  const totalDescuentos = Number(order.descuento_servicios || 0) + Number(order.descuento_productos || 0) + Number(order.otros_descuentos || 0);
  const subtotalBruto = Number(order.subtotal_bruto ?? (subtotalServicios + subtotalManoObra + subtotalProductos));
  const subtotalNeto = Number(order.subtotal_neto ?? (subtotalBruto - totalDescuentos));
  const impuesto = Number(order.impuesto || 0);
  const totalEstimado = Number(order.total_orden ?? (subtotalNeto + impuesto));

  const formatDuration = (totalSeconds) => {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours} h ${minutes} min ${remainingSeconds} s`;
    }

    if (minutes > 0) {
      return `${minutes} min ${remainingSeconds} s`;
    }

    return `${remainingSeconds} s`;
  };

  // Dynamic Metrics reading order.progreso contract
  const repairProgressPercent = Math.min(
    100,
    Math.max(0, Number(order.progreso?.porcentaje ?? order.progreso_porcentaje ?? 0))
  );

  const horasRegistradasText = formatFriendlyDuration(segundosEnVivo);

  const horasEstimadasText = order.horas_estimadas !== undefined && order.horas_estimadas !== null
    ? `${Number(order.horas_estimadas).toFixed(1)} h`
    : "N/A";

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
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
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors ml-1 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap font-mono">
            <button
              onClick={handleBackClick}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 uppercase tracking-wider font-semibold mr-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> VOLVER
            </button>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">
              DETALLE DE ORDEN
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1c2129] text-slate-200 text-[10px] uppercase font-bold border border-[#2d3748]">
              {order.estado_nombre || "EN PROCESO"}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] uppercase font-bold border border-rose-500/30">
              {order.prioridad_nombre || "NORMAL"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 font-mono tracking-tight">
            {order.codigo_orden}
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {Number(order.estado_orden_id) === 1 && (
            <button
              onClick={() => handleTransitionState(5)}
              disabled={loadingStateChange}
              className="flex items-center gap-2 px-4 py-2 bg-[#bfce7f] text-slate-950 hover:bg-[#a6b66b] rounded-xl transition-all font-mono text-xs font-extrabold uppercase tracking-wider border-t border-[#d8e899] shadow-lg shadow-[#bfce7f]/20 disabled:opacity-50 cursor-pointer"
            >
              {loadingStateChange ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wrench className="w-4 h-4" />
              )}
              INICIAR REPARACIÓN
            </button>
          )}
          {Number(order.estado_orden_id) === 5 && (
            <button
              onClick={() => handleTransitionState(7)}
              disabled={loadingStateChange || hasIncompleteServices}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white hover:bg-sky-600 rounded-xl transition-all font-mono text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={
                hasIncompleteServices
                  ? `No se puede marcar lista para entrega: hay ${incompleteServices.length} servicio(s) pendiente(s).`
                  : "Marcar orden lista para entrega"
              }
            >
              {loadingStateChange ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              MARCAR LISTA PARA ENTREGA
            </button>
          )}
          {Number(order.estado_orden_id) === 7 && (
            <>
              <button
                onClick={() => {
                  setReopenReason("");
                  setReopenSelectedServiceId("");
                  setReopenModalError(null);
                  setReopenModalOpen(true);
                }}
                disabled={loadingStateChange}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded-xl transition-all font-mono text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                REABRIR REPARACIÓN
              </button>
              <button
                onClick={() => handleTransitionState(8)}
                disabled={loadingStateChange || hasIncompleteServices || Boolean(order.facturado)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all font-mono text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={
                  hasIncompleteServices
                    ? `La orden tiene ${incompleteServices.length} servicio(s) pendiente(s). Reabre la reparación y complétalo antes de entregar.`
                    : "Entregar orden al cliente"
                }
              >
                {loadingStateChange ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                ENTREGAR A CLIENTE
              </button>
            </>
          )}
          {Number(order.estado_orden_id) === 8 && (
            <span className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-xl font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              ORDEN ENTREGADA
            </span>
          )}


          <button
            onClick={() => {
              setNewStatusId(String(order.estado_orden_id || 1));
              let initialMecId = order.mecanico_usuario_id ? String(order.mecanico_usuario_id) : "";
              if (!initialMecId && order.mecanico_nombre && catalogs.mecanicos) {
                const match = catalogs.mecanicos.find((m) => m.nombre_completo === order.mecanico_nombre);
                if (match) initialMecId = String(match.usuario_id);
              }
              setNewMecanicoId(initialMecId);
              setNewPrioridadId(order.prioridad_id ? String(order.prioridad_id) : "2");
              setChangeNotes("");
              setModalError(null);
              setStatusModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#84924a] text-white rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold uppercase tracking-wider border-t border-[#a6b66b] shadow-lg shadow-[#84924a]/20"
          >
            <Edit className="w-4 h-4" />
            EDITAR OT
          </button>
        </div>
      </div>

      {/* Progress Pipeline Stepper */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-[5%] right-[5%] top-1/2 h-1 bg-[#2d3748] -z-0 -translate-y-1/2"></div>
          {pipelineSteps.map((step) => {
            const StepIcon = step.icon;
            const isCompleted = step.id < currentStepId;
            const isActive = step.id === currentStepId;

            return (
              <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 w-1/6">
                <div
                  className={`flex items-center justify-center transition-all ${
                    isActive
                      ? "w-10 h-10 rounded-full bg-[#bfce7f] text-slate-950 border-2 border-[#161a21] shadow-[0_0_12px_rgba(191,206,127,0.4)]"
                      : isCompleted
                      ? "w-8 h-8 rounded-full bg-[#84924a] text-white border-2 border-[#161a21]"
                      : "w-8 h-8 rounded-full bg-[#1c2129] text-slate-500 border border-[#2d3748]"
                  }`}
                >
                  <StepIcon className={isActive ? "w-5 h-5" : "w-4 h-4"} />
                </div>
                <span
                  className={`font-mono text-[10px] tracking-wider uppercase ${
                    isActive
                      ? "text-[#bfce7f] font-bold"
                      : isCompleted
                      ? "text-slate-200 font-semibold"
                      : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-[#2d3748] flex gap-2 overflow-x-auto custom-scrollbar pb-1">
        <button
          onClick={() => setActiveTab("resumen")}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeTab === "resumen"
              ? "text-[#bfce7f] border-[#bfce7f] font-bold bg-[#bfce7f]/5 rounded-t-lg"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          RESUMEN
        </button>
        <button
          onClick={() => setActiveTab("servicios")}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeTab === "servicios"
              ? "text-[#bfce7f] border-[#bfce7f] font-bold bg-[#bfce7f]/5 rounded-t-lg"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          SERVICIOS ({order.servicios?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
            activeTab === "historial"
              ? "text-[#bfce7f] border-[#bfce7f] font-bold bg-[#bfce7f]/5 rounded-t-lg"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          HISTORIAL ({order.historial?.length || 0})
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Column (8/12 width) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Row 1: Client & Bike Bento Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Card */}
              <div className="bg-[#161a21] border border-[#2d3748] p-5 rounded-xl hover:border-slate-500 transition-colors">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2d3748]">
                  <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                    CLIENTE
                  </h3>
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#1c2129] border border-[#2d3748] flex items-center justify-center text-[#bfce7f] shrink-0 font-mono text-lg font-bold">
                    {order.cliente_nombre ? order.cliente_nombre.substring(0, 2).toUpperCase() : "CL"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-base font-sans">
                      {order.cliente_nombre}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {order.cliente_telefono || "Sin teléfono registrado"}
                    </div>
                    <div className="text-[11px] text-[#bfce7f] font-mono font-semibold mt-1">
                      Socio Premium
                    </div>
                  </div>
                </div>
              </div>

              {/* Bike Card */}
              <div className="bg-[#161a21] border border-[#2d3748] p-5 rounded-xl hover:border-slate-500 transition-colors">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2d3748]">
                  <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                    EQUIPO (BICICLETA)
                  </h3>
                  <Bike className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#1c2129] border border-[#2d3748] flex items-center justify-center text-slate-300 shrink-0">
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-base font-sans">
                      {order.bicicleta_marca} {order.bicicleta_modelo}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {order.bicicleta_ano || "N/A"} • {order.tipo_bicicleta || "Bicicleta"} • {order.bicicleta_color || "Color Estándar"}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1 uppercase tracking-wider">
                      SN: {order.bicicleta_serie || "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Technical Diagnostic Panel */}
            <div className="bg-[#161a21] border border-[#2d3748] p-6 rounded-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#2d3748]">
                <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                  DIAGNÓSTICO
                </h3>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {order.descripcion_cliente || order.diagnostico_inicial || order.motivo_ingreso || "Sin diagnóstico registrado."}
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold uppercase">Progreso de Reparación</span>
                  <span className="text-[#bfce7f] font-bold">
                    {repairProgressPercent % 1 === 0 ? Math.round(repairProgressPercent) : repairProgressPercent.toFixed(1)}% COMPLETADO
                  </span>
                </div>
                {/* Segmented Progress Bar */}
                <div className="h-4 w-full bg-[#1c2129] border border-[#2d3748] rounded overflow-hidden relative">
                  <div
                    className="h-full bg-[#84924a] relative transition-all duration-500"
                    style={{ width: `${repairProgressPercent}%` }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(to right, transparent, transparent 10px, rgba(0,0,0,0.2) 10px, rgba(0,0,0,0.2) 12px)"
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#bfce7f]" />
                  <span>Tiempo transcurrido total: <strong aria-live="polite" className="text-slate-200">{horasRegistradasText}</strong></span>
                </div>
              </div>
              {order?.tiempo_total_confiable === false && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 flex items-start gap-2 max-w-xl font-mono text-[11px] leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase tracking-wider mb-0.5">Inconsistencia de Sesiones Detectada</span>
                    <span className="text-slate-300">Hay múltiples temporizadores activos simultáneamente para el mismo servicio (IDs: {JSON.stringify(order?.servicios_con_sesiones_duplicadas)}). Se ha congelado el cálculo del tiempo en vivo para evitar valores erróneos.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Financial Summary Table */}
            <div className="bg-[#161a21] border border-[#2d3748] rounded-xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-[#2d3748] flex items-center justify-between bg-[#1c2129]">
                <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-widest">
                  RESUMEN FINANCIERO
                </h3>
                <DollarSign className="w-4 h-4 text-[#bfce7f]" />
              </div>

              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-[#161a21] border-b border-[#2d3748] text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-5">CONCEPTO / DETALLE</th>
                    <th className="py-3 px-5 text-right">CANT</th>
                    <th className="py-3 px-5 text-right">PRECIO UNIT.</th>
                    <th className="py-3 px-5 text-right">TOTAL (RD$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]">
                  {servicesList.length === 0 && productsList.length === 0 ? (
                    <tr className="bg-[#1c2129]">
                      <td colSpan={4} className="py-6 text-center text-slate-500 font-mono">
                        No hay servicios ni productos registrados en esta orden.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* GROUP 1: SERVICIOS */}
                      <tr className="bg-[#1c2129]/80 border-t border-[#2d3748]">
                        <td colSpan={4} className="py-2.5 px-5 font-bold text-[#bfce7f] text-[11px] uppercase tracking-wider">
                          SERVICIOS
                        </td>
                      </tr>
                      {servicesList.length === 0 ? (
                        <tr className="bg-[#161a21]">
                          <td colSpan={4} className="py-2 px-5 text-slate-500 italic">
                            Sin servicios registrados
                          </td>
                        </tr>
                      ) : (
                        servicesList.map((s, idx) => {
                          const techNote = (s.observacion_tecnica || s.observaciones || "").trim();
                          return (
                            <tr key={`s-${idx}`} className="bg-[#161a21]">
                              <td className="py-2.5 px-5 pl-7">
                                <div className="font-medium text-slate-200">
                                  {s.descripcion || s.tipo_servicio_nombre || "Servicio de Taller"}
                                </div>
                                {techNote ? (
                                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                                    <span className="text-[#bfce7f] font-semibold">Nota técnica:</span> {techNote}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-5 text-right text-slate-400">{s.cantidad}</td>
                              <td className="py-2.5 px-5 text-right text-slate-400">
                                RD$ {(Number(s.precio_unitario) || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-5 text-right font-semibold text-slate-200">
                                RD$ {(Number(s.subtotal) || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* GROUP 2: PRODUCTOS / REPUESTOS */}
                      <tr className="bg-[#1c2129]/80 border-t border-[#2d3748]">
                        <td colSpan={4} className="py-2.5 px-5 font-bold text-cyan-400 text-[11px] uppercase tracking-wider">
                          PRODUCTOS / REPUESTOS
                        </td>
                      </tr>
                      {productsList.length === 0 ? (
                        <tr className="bg-[#161a21]">
                          <td colSpan={4} className="py-2 px-5 text-slate-500 italic">
                            Sin productos registrados
                          </td>
                        </tr>
                      ) : (
                        productsList.map((p, idx) => (
                          <tr key={`p-${idx}`} className="bg-[#161a21]">
                            <td className="py-2.5 px-5 font-medium text-slate-200 pl-7">
                              {p.producto_nombre || p.nombre || "Producto / Repuesto"}
                            </td>
                            <td className="py-2.5 px-5 text-right text-slate-400">{p.cantidad}</td>
                            <td className="py-2.5 px-5 text-right text-slate-400">
                              RD$ {(Number(p.precio_unitario) || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-5 text-right font-semibold text-slate-200">
                              RD$ {(Number(p.subtotal) || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>

              <div className="p-5 bg-[#1c2129] border-t-2 border-[#2d3748] flex justify-between items-center font-mono text-xs">
                <span className="text-base font-bold text-[#bfce7f] uppercase tracking-wider">TOTAL GENERAL:</span>
                <span className="text-xl font-extrabold text-[#bfce7f]">
                  RD$ {totalEstimado.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column (4/12 width) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Assigned Mechanic Card (Singular: MECÁNICO RESPONSABLE per Section 5) */}
            <div className="bg-[#161a21] border border-[#2d3748] p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#2d3748]">
                <Wrench className="w-4 h-4 text-[#bfce7f]" />
                <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                  MECÁNICO RESPONSABLE
                </h3>
              </div>
              {order.mecanico_id || order.mecanico_nombre ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1c2129] border border-[#2d3748] flex items-center justify-center font-mono font-bold text-xs text-[#bfce7f] shrink-0">
                    {order.mecanico?.iniciales || (order.mecanico_nombre ? order.mecanico_nombre.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase() : "MC")}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100 font-sans">
                      {order.mecanico_nombre || order.mecanico?.nombre_completo}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {order.mecanico?.cargo_nombre || "Técnico de Taller"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs text-amber-400 font-mono font-bold">
                    Sin asignar
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-normal">
                    Se asignará al usuario que inicie la reparación.
                  </p>
                </div>
              )}
            </div>


            {/* Spare Parts Alert Card */}
            {order.alertas_repuestos && order.alertas_repuestos.length > 0 ? (
              order.alertas_repuestos.map((alertItem, idx) => (
                <div key={idx} className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <h3 className="font-mono text-xs font-bold text-rose-400 uppercase tracking-wider">
                      ALERTA DE REPUESTO
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    El producto {alertItem.producto_nombre} (SKU: {alertItem.producto_sku}) presenta un nivel crítico de stock ({alertItem.stock_actual} en inventario, mínimo {alertItem.stock_minimo}).
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-[#161a21] border border-[#2d3748] p-5 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                    ESTADO DE REPUESTOS
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Sin alertas de repuestos ni faltantes de stock.
                  </p>
                </div>
              </div>
            )}

            {/* Recommended Actions Card */}
            <div className="bg-[#1c2129] border border-[#2d3748] p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d3748]">
                <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-widest">
                  ACCIONES SUGERIDAS
                </h3>
                <span className="text-[10px] text-slate-400 font-mono bg-[#161a21] px-2 py-0.5 rounded border border-[#2d3748]">
                  Sugerencias
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Recomendaciones operativas calculadas automáticamente según el estado de la orden y sus servicios.
              </p>

              <div className="flex flex-col gap-2.5">
                {nextTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-start gap-3 p-3 bg-[#161a21] border border-[#2d3748] rounded-lg cursor-pointer hover:border-slate-500 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                      className="mt-0.5 rounded border-[#2d3748] bg-[#0a0c10] text-[#bfce7f] focus:ring-0"
                    />
                    <span
                      className={`text-xs ${
                        task.done ? "line-through text-slate-500 font-mono" : "text-slate-200 font-sans"
                      }`}
                    >
                      {task.text}
                    </span>
                  </label>
                ))}
              </div>

              {showAddTaskInput ? (
                <form onSubmit={handleAddTask} className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Escribe una nueva tarea..."
                    className="w-full p-2 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-xs text-slate-200 focus:border-[#bfce7f] outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setShowAddTaskInput(false)}
                      className="px-3 py-1 text-slate-400 hover:text-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-[#84924a] text-white font-bold rounded-lg hover:brightness-110"
                    >
                      Agregar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddTaskInput(true)}
                  className="w-full py-2 border border-[#2d3748] rounded-lg font-mono text-xs font-bold text-slate-300 hover:bg-[#161a21] hover:text-white transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4 text-slate-400" />
                  AGREGAR TAREA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === "servicios" && (
        <WorkOrderServicesView ordenId={ordenId} services={order.servicios || []} onRefresh={refreshSilently} order={order} />
      )}

      {/* History Tab */}
      {activeTab === "historial" && <WorkOrderHistoryView history={order.historial || []} />}

      {/* Status & Edit Order Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100"
            style={{ width: "100%", maxWidth: "580px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#bfce7f]" />
                Editar Orden de Trabajo — {order.codigo_orden}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setStatusModalOpen(false);
                  setModalError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-0.5">
                  <span className="font-bold text-rose-200 block text-sm">
                    {typeof modalError === 'object' ? modalError.title : 'No se pudo actualizar'}
                  </span>
                  <span className="text-rose-300 text-xs block leading-relaxed whitespace-normal break-words">
                    {typeof modalError === 'object' ? modalError.description : String(modalError)}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateOrderState} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Estado de la Orden</label>
                  <select
                    value={newStatusId}
                    onChange={(e) => setNewStatusId(e.target.value)}
                    disabled={Number(order.estado_orden_id) === 8}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {Number(order.estado_orden_id) === 1 && (
                      <>
                        <option value="1">1 - Recibida (Estado actual)</option>
                        <option value="5">5 - En Reparación</option>
                      </>
                    )}
                    {Number(order.estado_orden_id) === 5 && (
                      <>
                        <option value="5">5 - En Reparación (Estado actual)</option>
                        <option value="7" disabled={hasIncompleteServices}>
                          7 - Lista para Entrega {hasIncompleteServices ? " (Servicios pendientes)" : ""}
                        </option>
                      </>
                    )}
                    {Number(order.estado_orden_id) === 7 && (
                      <>
                        <option value="7">7 - Lista para Entrega (Estado actual)</option>
                        <option value="5">5 - En Reparación (Reabrir)</option>
                        <option value="8" disabled={hasIncompleteServices}>
                          8 - Entregada {hasIncompleteServices ? " (Servicios pendientes)" : ""}
                        </option>
                      </>
                    )}
                    {Number(order.estado_orden_id) === 8 && (
                      <option value="8">8 - Entregada (Finalizada)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Prioridad</label>
                  <select
                    value={newPrioridadId}
                    onChange={(e) => setNewPrioridadId(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                  >
                    {catalogs.prioridades?.length > 0 ? (
                      catalogs.prioridades.map((p) => (
                        <option key={p.prioridad_id} value={String(p.prioridad_id)}>
                          {p.nombre}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">Baja</option>
                        <option value="2">Normal</option>
                        <option value="3">Alta</option>
                        <option value="4">Urgente</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Observaciones / Notas del Cambio</label>
                      <textarea
                        rows={3}
                        value={changeNotes}
                        onChange={(e) => setChangeNotes(e.target.value)}
                        placeholder="Escribe observaciones o notas internas relativas a los cambios..."
                        className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] text-xs resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2d3748]">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalOpen(false);
                          setModalError(null);
                        }}
                        className="px-4 py-2 bg-[#1c2129] border border-[#2d3748] text-slate-300 rounded-xl hover:bg-[#252b36] transition-colors font-mono text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={updatingStatus}
                        className="px-5 py-2 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 transition-all font-mono text-xs flex items-center gap-2 border-t border-[#a6b66b] disabled:opacity-50 cursor-pointer"
                      >
                        {updatingStatus ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar cambios"
                        )}
                      </button>
                    </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED REOPEN REPAIR MODAL */}
      {reopenModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-repair-modal-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!submittingReopen) {
                setReopenModalOpen(false);
                setReopenModalError(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#161a21] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2d3748] bg-[#0a0c10]/60 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shrink-0 mt-0.5">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="reopen-repair-modal-title" className="text-base font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
                    REABRIR REPARACIÓN
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    La orden volverá al estado En Reparación para permitir modificaciones en sus servicios y repuestos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!submittingReopen) {
                    setReopenModalOpen(false);
                    setReopenModalError(null);
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Error Banner */}
            {reopenModalError && (
              <div className="mx-5 mt-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-sans flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-0.5">
                  <span className="font-bold text-rose-200 block text-xs">Error al reabrir orden</span>
                  <span className="text-rose-300 text-xs block leading-relaxed">{reopenModalError}</span>
                </div>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleConfirmReopen} className="p-5 space-y-4 text-xs font-sans">
              {/* Order State Transition Badges */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#0a0c10]/80 border border-[#2d3748] rounded-xl font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Orden</span>
                  <span className="font-bold text-slate-200">{order.codigo_orden}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Estado Actual</span>
                  <span className="font-semibold text-emerald-400">Lista para Entrega</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Estado Destino</span>
                  <span className="font-semibold text-amber-400">En Reparación</span>
                </div>
              </div>

              {/* Services Contextual Condition */}
              {(() => {
                const activeServices = (order?.servicios || []).filter(s => s.activo !== false);
                const closedServices = activeServices.filter(s => {
                  const code = String(s.estado_servicio_codigo || s.estado_codigo || s.estado || "").toUpperCase();
                  return code === "COMPLETADO" || code === "FINALIZADO" || Number(s.estado_servicio_id) === 3;
                });

                if (activeServices.length === 0) {
                  return (
                    <div className="p-3.5 bg-sky-950/30 border border-sky-500/30 rounded-xl text-sky-200 text-xs flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed font-sans text-xs">
                        Esta orden no tiene servicios registrados. Al reabrirla podrás agregar servicios o repuestos desde la pestaña <strong>Servicios</strong>.
                      </p>
                    </div>
                  );
                }

                if (closedServices.length > 0) {
                  return (
                    <div className="space-y-1.5 font-mono text-xs">
                      <label className="block text-slate-300 font-semibold">
                        Servicio que también deseas reabrir (opcional)
                      </label>
                      <select
                        value={reopenSelectedServiceId}
                        onChange={(e) => setReopenSelectedServiceId(e.target.value)}
                        className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 text-xs focus:outline-none focus:border-[#bfce7f]"
                      >
                        <option value="">-- Reabrir solo la orden (sin seleccionar servicio) --</option>
                        {closedServices.map((s, idx) => (
                          <option key={s.orden_servicio_id || s.servicio_id || idx} value={String(s.orden_servicio_id || s.servicio_id)}>
                            #{s.orden_servicio_id || s.servicio_id} - {s.tipo_servicio_nombre || s.descripcion_servicio || "Servicio"} ({s.mecanico_nombre || "Sin mecánico asignado"})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Motivo de reapertura (Obligatorio) */}
              <div className="space-y-1.5">
                <label className="block text-slate-200 font-semibold font-mono text-xs">
                  Motivo de reapertura <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => {
                    setReopenReason(e.target.value);
                    if (reopenModalError) setReopenModalError(null);
                  }}
                  required
                  placeholder="Indica por qué es necesario reabrir esta orden…"
                  className="w-full p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-amber-400 text-xs resize-none font-sans"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2d3748]">
                <button
                  type="button"
                  onClick={() => {
                    setReopenModalOpen(false);
                    setReopenModalError(null);
                  }}
                  disabled={submittingReopen}
                  className="px-4 py-2 bg-[#1c2129] border border-[#2d3748] text-slate-300 rounded-xl hover:bg-[#252b36] transition-colors font-mono text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReopen || !reopenReason.trim()}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-all font-mono text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submittingReopen ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reabriendo...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Confirmar reapertura
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Printable Document Section (Visible ONLY on print) */}
      <div id="printable-work-order" className="hidden print:block p-8 bg-white text-slate-900 font-sans text-xs max-w-4xl mx-auto leading-relaxed">
        {/* Institutional Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-mono">BIKER'S FORT CORE</h1>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5">Taller & Tienda Especializada | C/ Principal #45, Santiago, R.D.</p>
            <p className="text-[11px] text-slate-600">RNC: 1-32-45678-9 • Tel: +1 (809) 555-0192 • info@bikersfortcore.com</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold font-mono text-slate-900">ORDEN DE TRABAJO</div>
            <div className="text-lg font-bold font-mono text-emerald-800">{order.codigo_orden}</div>
            <div className="text-[11px] text-slate-600 font-mono mt-1">
              Fecha Emisión: {new Date(order.fecha_ingreso || Date.now()).toLocaleDateString("es-DO")}
            </div>
            <div className="flex justify-end gap-1.5 mt-1 text-[10px] font-mono">
              <span className="px-2 py-0.5 border border-slate-400 font-bold uppercase">{order.estado_nombre}</span>
              <span className="px-2 py-0.5 border border-slate-400 font-bold uppercase">{order.prioridad_nombre}</span>
            </div>
          </div>
        </div>

        {/* Client & Bike Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-slate-300 p-4 rounded-lg">
            <h2 className="font-bold font-mono text-slate-900 border-b border-slate-200 pb-1.5 mb-2 uppercase tracking-wider text-[11px]">DATOS DEL CLIENTE</h2>
            <div className="space-y-1">
              <p><strong className="text-slate-700">Nombre:</strong> {order.cliente_nombre}</p>
              <p><strong className="text-slate-700">Teléfono:</strong> {order.cliente_telefono || "N/A"}</p>
              <p><strong className="text-slate-700">Correo:</strong> {order.cliente_correo || "N/A"}</p>
            </div>
          </div>

          <div className="border border-slate-300 p-4 rounded-lg">
            <h2 className="font-bold font-mono text-slate-900 border-b border-slate-200 pb-1.5 mb-2 uppercase tracking-wider text-[11px]">DATOS DEL EQUIPO (BICICLETA)</h2>
            <div className="space-y-1">
              <p><strong className="text-slate-700">Marca / Modelo:</strong> {order.bicicleta_marca} {order.bicicleta_modelo}</p>
              <p><strong className="text-slate-700">Año / Tipo / Color:</strong> {order.bicicleta_ano || "N/A"} • {order.tipo_bicicleta || "MTB"} • {order.bicicleta_color || "N/A"}</p>
              <p><strong className="text-slate-700">Número de Serie:</strong> <span className="font-mono">{order.bicicleta_serie || "N/A"}</span></p>
            </div>
          </div>
        </div>

        {/* Technical inspection info */}
        <div className="border border-slate-300 p-4 rounded-lg mb-6 space-y-2">
          <h2 className="font-bold font-mono text-slate-900 border-b border-slate-200 pb-1.5 mb-2 uppercase tracking-wider text-[11px]">DATOS DE RECEPCIÓN Y REVISIÓN TÉCNICA</h2>
          <p><strong className="text-slate-700">Recepción Asignada:</strong> {order.codigo_recepcion || "N/A"} • <strong className="text-slate-700">Mecánicos Asignados:</strong> {order.mecanicos && order.mecanicos.length > 0 ? order.mecanicos.map((m) => m.nombre).join(", ") : "Sin mecánicos asignados"}</p>
          <p><strong className="text-slate-700">Observaciones Técnicas:</strong> {order.diagnostico_inicial || order.motivo_ingreso || "Sin observaciones técnicas registradas."}</p>
        </div>

        {/* Services Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold font-mono text-slate-900 uppercase tracking-wider text-[11px]">1. SERVICIOS</h2>
            <span className="text-xs font-mono font-bold text-slate-700">Subtotal servicios: RD$ {subtotalServicios.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
          </div>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] uppercase">
                <th className="p-2 border-r border-slate-300">Servicio</th>
                <th className="p-2 border-r border-slate-300">Mecánico Responsable</th>
                <th className="p-2 border-r border-slate-300 text-center">Estado</th>
                <th className="p-2 text-right">Subtotal (RD$)</th>
              </tr>
            </thead>
            <tbody>
              {servicesList.length === 0 ? (
                <tr><td colSpan={4} className="p-3 text-center text-slate-500 font-mono text-xs">No hay servicios registrados en esta orden.</td></tr>
              ) : (
                servicesList.map((svc, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-medium">{svc.descripcion}</td>
                    <td className="p-2 border-r border-slate-200">{svc.mecanico_nombre || "Sin asignar"}</td>
                    <td className="p-2 border-r border-slate-200 text-center uppercase text-[10px]">{svc.estado_nombre || "Pendiente"}</td>
                    <td className="p-2 text-right font-mono font-bold">RD$ {Number(svc.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Labor Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold font-mono text-slate-900 uppercase tracking-wider text-[11px]">2. MANO DE OBRA</h2>
            <span className="text-xs font-mono font-bold text-slate-700">Subtotal mano de obra: RD$ {subtotalManoObra.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
          </div>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] uppercase">
                <th className="p-2 border-r border-slate-300">Detalle de Mano de Obra</th>
                <th className="p-2 border-r border-slate-300 text-right">Horas Reales</th>
                <th className="p-2 border-r border-slate-300 text-right">Costo / Hora (RD$)</th>
                <th className="p-2 text-right">Subtotal (RD$)</th>
              </tr>
            </thead>
            <tbody>
              {laborList.length === 0 ? (
                <tr><td colSpan={4} className="p-3 text-center text-slate-500 font-mono text-xs">No hay mano de obra registrada en esta orden.</td></tr>
              ) : (
                laborList.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-medium">{m.detalle_mano_obra}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{m.horas_reales} hr(s)</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">RD$ {Number(m.costo_hora || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono font-bold">RD$ {Number(m.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Products Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold font-mono text-slate-900 uppercase tracking-wider text-[11px]">3. PRODUCTOS / REPUESTOS</h2>
            <span className="text-xs font-mono font-bold text-slate-700">Subtotal productos: RD$ {subtotalProductos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
          </div>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] uppercase">
                <th className="p-2 border-r border-slate-300">Producto / Repuesto</th>
                <th className="p-2 border-r border-slate-300 text-right">Cant.</th>
                <th className="p-2 border-r border-slate-300 text-right">Precio Unit. (RD$)</th>
                <th className="p-2 text-right">Subtotal (RD$)</th>
              </tr>
            </thead>
            <tbody>
              {productsList.length === 0 ? (
                <tr><td colSpan={4} className="p-3 text-center text-slate-500 font-mono text-xs">No hay repuestos registrados en esta orden.</td></tr>
              ) : (
                productsList.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-medium">{item.producto_nombre}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{item.cantidad}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">RD$ {Number(item.precio_unitario || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono font-bold">RD$ {Number(item.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end mb-8">
          <div className="w-80 border border-slate-300 p-4 rounded-lg bg-slate-50 space-y-2 font-mono text-xs">
            <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wider text-[11px]">RESUMEN FINANCIERO</h3>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Servicios:</span>
              <span>RD$ {subtotalServicios.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Mano de Obra:</span>
              <span>RD$ {subtotalManoObra.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Repuestos:</span>
              <span>RD$ {subtotalProductos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-semibold border-t border-slate-200 pt-1.5">
              <span>Subtotal Bruto:</span>
              <span>RD$ {subtotalBruto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Descuentos:</span>
              <span>RD$ {totalDescuentos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Impuestos:</span>
              <span>RD$ {impuesto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-slate-900 font-black border-t-2 border-slate-400 pt-2 text-sm">
              <span>TOTAL GENERAL:</span>
              <span>RD$ {totalEstimado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-300 text-center font-mono text-[10px]">
          <div>
            <div className="border-b border-slate-400 mb-2 h-12"></div>
            <p className="font-bold text-slate-800">Firma del Cliente</p>
            <p className="text-slate-500">{order.cliente_nombre}</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 h-12"></div>
            <p className="font-bold text-slate-800">Firma del Técnico</p>
            <p className="text-slate-500">{order.mecanico_nombre || "Mecánico Taller"}</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 h-12"></div>
            <p className="font-bold text-slate-800">Responsable de Taller</p>
            <p className="text-slate-500">Biker's Fort Core</p>
          </div>
        </div>
      </div>
    </div>
  );
}
