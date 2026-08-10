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
  ArrowLeft
} from "lucide-react";

export default function WorkOrderServicesView({ ordenId, services = [], onRefresh, order, backUrl }) {
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
  const [newEstadoAprobacionId, setNewEstadoAprobacionId] = useState("2");

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

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const askConfirmation = (title, message, onConfirm) => {
    setConfirmModalTitle(title);
    setConfirmModalMessage(message);
    setConfirmModalOnConfirm(() => onConfirm);
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

  // Auto-select initial service for detail side panel
  useEffect(() => {
    if (services.length > 0 && (!selectedServiceId || !services.some(s => s.orden_servicio_id === selectedServiceId))) {
      setSelectedServiceId(services[0].orden_servicio_id);
    }
  }, [services]);

  const activeSelectedService = services.find(s => s.orden_servicio_id === selectedServiceId) || services[0] || null;

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
    const totalHours = manoObraList.reduce((sum, m) => sum + Number(m.horas_trabajadas || 1), 0);
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
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

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_servicio_id: parseInt(newTipoServicioId, 10),
          usuario_id: newMecanicoId ? parseInt(newMecanicoId, 10) : null,
          precio_acordado: newPrecioAcordado !== "" ? parsedPrecio : null,
          observaciones: newObservaciones
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar servicio a la orden.");

      setAddServiceModalOpen(false);
      setNewTipoServicioId("");
      setNewMecanicoId("");
      setNewPrecioAcordado("");
      setNewObservaciones("");
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
    setEditingService(svc);
    setNewMecanicoId(svc.usuario_id ? String(svc.usuario_id) : "");
    setNewPrecioAcordado(svc.precio_acordado !== null && svc.precio_acordado !== undefined ? String(svc.precio_acordado) : String(svc.precio_unitario || ""));
    setNewObservaciones(svc.observacion_tecnica || svc.observaciones || "");
    setNewEstadoAprobacionId(String(svc.estado_aprobacion_id || 2));
    setModalError(null);
    setEditServiceModalOpen(true);
  };

  // Update Service Handler
  const handleUpdateService = async (e) => {
    e.preventDefault();
    if (!editingService) return;

    const parsedPrecio = parseFloat(newPrecioAcordado);
    if (newPrecioAcordado !== "" && (isNaN(parsedPrecio) || parsedPrecio < 0)) {
      setModalError("El precio acordado debe ser un monto válido no negativo.");
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${editingService.orden_servicio_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: newMecanicoId ? parseInt(newMecanicoId, 10) : null,
          precio_acordado: newPrecioAcordado !== "" ? parsedPrecio : null,
          observaciones: newObservaciones,
          estado_aprobacion_id: parseInt(newEstadoAprobacionId, 10)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar servicio.");

      setEditServiceModalOpen(false);
      setEditingService(null);
      showToast("Servicio actualizado correctamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Mechanic Direct Change Handler
  const handleMechanicChange = async (servicioId, newMecId) => {
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: newMecId ? parseInt(newMecId, 10) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asignar mecánico.");
      showToast("Mecánico actualizado correctamente.");
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  // Service Status Change Handler
  const handleServiceStatusChange = async (servicioId, newEstadoId) => {
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_servicio_id: parseInt(newEstadoId, 10)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado del servicio.");
      showToast("Estado del servicio actualizado.");
      onRefresh();
    } catch (err) {
      alert(err.message);
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
          if (!res.ok) throw new Error(data.error || "Error al eliminar servicio.");
          showToast("Servicio eliminado de la orden.");
          onRefresh();
        } catch (err) {
          alert(err.message);
        }
      }
    );
  };

  // Add Labor Handler
  const handleAddLabor = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || !laborDesc) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}/servicios/${selectedServiceId}/mano-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: laborDesc,
          horas_estimadas: laborHorasEst,
          horas_reales: laborHorasReal,
          costo_hora: laborCostoHora
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar mano de obra.");
      setAddLaborModalOpen(false);
      setLaborDesc("");
      setLaborHorasEst("1");
      setLaborHorasReal("1");
      setLaborCostoHora("0");
      setModalError(null);
      showToast("Mano de obra registrada exitosamente.");
      onRefresh();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Labor Handler
  const openEditLaborModal = (servicioId, laborItem) => {
    setSelectedServiceId(servicioId);
    setEditLaborId(laborItem.orden_servicio_mano_obra_id);
    setEditLaborDesc(laborItem.descripcion || laborItem.observacion || "");
    setEditLaborHoras(String(laborItem.horas_trabajadas || 1));
    setEditLaborCostoHora(String(laborItem.costo_hora || 0));
    setModalError(null);
    setEditLaborModalOpen(true);
  };

  const handleUpdateLabor = async (e) => {
    e.preventDefault();
    if (!editLaborDesc) {
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
          descripcion: editLaborDesc,
          horas_reales: parseFloat(editLaborHoras),
          costo_hora: parseFloat(editLaborCostoHora)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar mano de obra.");

      setEditLaborModalOpen(false);
      showToast("Mano de obra actualizada.");
      onRefresh();
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
          if (!res.ok) throw new Error(data.error || "Error al eliminar mano de obra.");
          showToast("Mano de obra eliminada.");
          onRefresh();
        } catch (err) {
          alert(err.message);
        }
      }
    );
  };

  // Add Product Handler
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || !prodProductoId) {
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
          producto_id: parseInt(prodProductoId, 10),
          cantidad: qty,
          precio_unitario: price
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asociar producto.");

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
          if (!res.ok) throw new Error(data.error || "Error al eliminar producto del servicio.");
          showToast("Producto eliminado del servicio.");
          onRefresh();
        } catch (err) {
          alert(err.message);
        }
      }
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-emerald-600 text-white rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
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
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#1c2129] hover:bg-[#252c37] border border-[#2d3748] text-slate-200 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            Imprimir OT
          </button>
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

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* KPI 1: Pendientes */}
        <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              Pendientes
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-amber-400">{kpiPendientes}</span>
              <span className="text-xs font-mono text-slate-400">Servicios</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Aprobando */}
        <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              Aprobando
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-sky-400">{kpiAprobando}</span>
              <span className="text-xs font-mono text-slate-400">Autorización</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: En Proceso */}
        <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              En Proceso
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-[#bfce7f]">{kpiEnProceso}</span>
              <span className="text-xs font-mono text-slate-400">Activos</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#84924a]/20 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f]">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Completados */}
        <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              Completados
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-emerald-400">{kpiCompletados}</span>
              <span className="text-xs font-mono text-slate-400">Listos</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

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
                <button
                  onClick={() => setAddServiceModalOpen(true)}
                  className="px-4 py-2 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 font-mono text-xs"
                >
                  + AGREGAR PRIMER SERVICIO
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-[#0a0c10]/60 border-b border-[#2d3748] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="p-3.5 pl-4">Código</th>
                      <th className="p-3.5">Tipo / Descripción</th>
                      <th className="p-3.5">Mecánico</th>
                      <th className="p-3.5">Estado / Aprobación</th>
                      <th className="p-3.5 text-right">Precio (RD$)</th>
                      <th className="p-3.5 pr-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3748]/60">
                    {services.map((svc, idx) => {
                      const isSelected = svc.orden_servicio_id === selectedServiceId;
                      const srvCode = `SRV-${String(idx + 1).padStart(3, "0")}`;

                      return (
                        <tr
                          key={svc.orden_servicio_id}
                          onClick={() => setSelectedServiceId(svc.orden_servicio_id)}
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
                              value={svc.usuario_id ? String(svc.usuario_id) : ""}
                              onChange={(e) => handleMechanicChange(svc.orden_servicio_id, e.target.value)}
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

                          {/* Service & Approval Status */}
                          <td className="p-3.5 whitespace-nowrap space-y-1" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-flex items-center">
                              <select
                                value={svc.estado_servicio_id || 1}
                                onChange={(e) => handleServiceStatusChange(svc.orden_servicio_id, e.target.value)}
                                className={`px-2 py-0.5 border rounded-md text-[10px] font-mono font-bold appearance-none pr-5 cursor-pointer focus:outline-none transition-colors ${
                                  svc.estado_servicio_id === 2 || svc.estado_servicio_codigo === "EN_PROCESO"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                    : svc.estado_servicio_id === 3 || svc.estado_servicio_codigo === "COMPLETADO"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : svc.estado_servicio_id === 4 || svc.estado_servicio_codigo === "CANCELADO"
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                    : "bg-[#1c2129] text-slate-300 border-[#2d3748]"
                                }`}
                              >
                                {estadosServicio.map((st) => (
                                  <option key={st.estado_orden_servicio_id} value={st.estado_orden_servicio_id} className="bg-[#161a21] text-slate-200">
                                    {st.nombre}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-1" />
                            </div>

                            {/* Approval Status Badge */}
                            <div className="text-[10px] font-mono">
                              {svc.estado_aprobacion_id === 2 || svc.estado_aprobacion_codigo === "APROBADO" ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Aprobado
                                </span>
                              ) : svc.estado_aprobacion_id === 3 || svc.estado_aprobacion_codigo === "RECHAZADO" ? (
                                <span className="text-rose-400 flex items-center gap-1">
                                  <X className="w-3 h-3" /> Rechazado
                                </span>
                              ) : (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pendiente Autorización
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="p-3.5 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                            RD$ {Number(svc.precio_acordado || svc.precio_unitario || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 pr-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Quick play/pause status toggle */}
                              <button
                                onClick={() =>
                                  handleServiceStatusChange(
                                    svc.orden_servicio_id,
                                    svc.estado_servicio_id === 2 ? 1 : 2
                                  )
                                }
                                className={`p-1.5 rounded-lg border transition-all ${
                                  svc.estado_servicio_id === 2
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                    : "bg-[#1c2129] text-slate-400 border-[#2d3748] hover:text-[#bfce7f]"
                                }`}
                                title={svc.estado_servicio_id === 2 ? "Pausar servicio" : "Iniciar servicio"}
                              >
                                {svc.estado_servicio_id === 2 ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>

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
                                onClick={() => handleDeleteService(svc.orden_servicio_id, svc.tipo_servicio_nombre)}
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
                <span className="text-base font-black text-[#bfce7f]">
                  RD$ {totalOrdenCalculado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
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

            {activeSelectedService ? (
              <div className="space-y-4">
                {/* Service Header Info */}
                <div>
                  <h4 className="text-base font-bold text-slate-100 font-sans">
                    {activeSelectedService.tipo_servicio_nombre}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    {activeSelectedService.observacion_tecnica || activeSelectedService.tipo_servicio_descripcion || "Sin observaciones técnicas registradas."}
                  </p>
                </div>

                {/* Worked Time Box */}
                <div className="p-4 bg-[#0a0c10] border border-[#2d3748] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-[#bfce7f]" />
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                        Tiempo Registrado
                      </span>
                      <span className="text-lg font-black font-mono text-slate-100">
                        {getWorkedTimeString(activeSelectedService.mano_obra || [])}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedServiceId(activeSelectedService.orden_servicio_id);
                      setLaborDesc("");
                      setLaborHorasEst("1");
                      setLaborHorasReal("1");
                      setLaborCostoHora("0");
                      setModalError(null);
                      setAddLaborModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-[#84924a]/20 text-[#bfce7f] hover:bg-[#84924a]/30 border border-[#bfce7f]/30 rounded-lg text-xs font-mono font-bold transition-all"
                  >
                    + Registrar
                  </button>
                </div>

                {/* Associated Spare Parts / Products Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-[#2d3748] pb-1.5">
                    <span className="text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-sky-400" /> Repuestos Asociados
                    </span>
                    <button
                      onClick={() => {
                        setSelectedServiceId(activeSelectedService.orden_servicio_id);
                        setModalError(null);
                        setAddProductModalOpen(true);
                      }}
                      className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                    >
                      + Agregar Repuesto
                    </button>
                  </div>

                  {activeSelectedService.productos && activeSelectedService.productos.length > 0 ? (
                    <div className="space-y-2">
                      {activeSelectedService.productos.map((prod) => (
                        <div
                          key={prod.orden_producto_id}
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
                            <button
                              onClick={() => handleDeleteProduct(activeSelectedService.orden_servicio_id, prod.orden_producto_id, prod.producto_nombre)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              title="Eliminar repuesto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-3 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-center font-mono">
                      Sin repuestos o productos asociados.
                    </p>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="pt-3 border-t border-[#2d3748] space-y-2">
                  {activeSelectedService.estado_servicio_id === 2 ? (
                    <button
                      onClick={() => handleServiceStatusChange(activeSelectedService.orden_servicio_id, 1)}
                      className="w-full py-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl font-mono text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Pause className="w-4 h-4" /> Pausar Trabajo
                    </button>
                  ) : (
                    <button
                      onClick={() => handleServiceStatusChange(activeSelectedService.orden_servicio_id, 2)}
                      className="w-full py-2.5 bg-[#1c2129] hover:bg-[#252c37] border border-[#2d3748] text-slate-200 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 text-[#bfce7f]" /> Iniciar Trabajo
                    </button>
                  )}

                  {activeSelectedService.estado_servicio_id !== 3 && (
                    <button
                      onClick={() => handleServiceStatusChange(activeSelectedService.orden_servicio_id, 3)}
                      className="w-full py-2.5 bg-[#84924a] hover:brightness-110 text-white font-bold rounded-xl font-mono text-xs transition-all flex items-center justify-center gap-2 border-t border-[#a6b66b]"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Finalizar Servicio
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-center p-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-slate-300 mb-1 font-semibold">Estado de Aprobación</label>
                  <select
                    value={newEstadoAprobacionId}
                    onChange={(e) => setNewEstadoAprobacionId(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono"
                  >
                    {estadosAprobacion.map((ap) => (
                      <option key={ap.estado_aprobacion_id} value={String(ap.estado_aprobacion_id)}>
                        {ap.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  {services.find((s) => s.orden_servicio_id === selectedServiceId)?.tipo_servicio_nombre || `Servicio #${selectedServiceId}`}
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

      {/* MODAL 6: Confirmación Eliminación */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative my-auto shrink-0 z-10 font-sans text-slate-100 animate-in fade-in zoom-in duration-150"
            style={{ width: "100%", maxWidth: "480px", boxSizing: "border-box" }}
          >
            <div className="flex items-center justify-between border-b border-[#2d3748] pb-4">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                {confirmModalTitle || "Confirmación Requerida"}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
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
                onClick={async () => {
                  setConfirmModalOpen(false);
                  if (confirmModalOnConfirm) {
                    await confirmModalOnConfirm();
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2 font-mono text-xs transition-colors border-t border-rose-400"
              >
                <Trash2 className="w-4 h-4" />
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
