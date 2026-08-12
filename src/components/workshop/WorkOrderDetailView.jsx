"use client";
import React, { useState, useEffect } from "react";
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
  Printer,
  Edit,
  Check,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X
} from "lucide-react";
import WorkOrderServicesView from "./WorkOrderServicesView";
import WorkOrderHistoryView from "./WorkOrderHistoryView";

export default function WorkOrderDetailView({ ordenId, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Next actions checklist local state
  const [nextTasks, setNextTasks] = useState([]);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [showAddTaskInput, setShowAddTaskInput] = useState(false);

  const fetchOrderDetail = async (isSilent = false) => {
    if (!isSilent && !order) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar la orden de trabajo.");

      const orderData = data.data;
      setOrder(orderData);
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
      const catRes = await fetch("/api/taller/catalogos");
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
      console.error("fetchOrderDetail Error:", err);
      if (!isSilent) setError(err.message || "Orden no encontrada.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const refreshSilently = () => fetchOrderDetail(true);

  useEffect(() => {
    if (ordenId) {
      fetchOrderDetail();
    }
  }, [ordenId]);

  const handleUpdateOrderState = async (e) => {
    e.preventDefault();
    setUpdatingStatus(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_id: parseInt(newStatusId, 10),
          mecanico_usuario_id: newMecanicoId ? parseInt(newMecanicoId, 10) : null,
          prioridad_id: newPrioridadId ? parseInt(newPrioridadId, 10) : null,
          observacion_cambio_estado: changeNotes || "Actualización desde Detalle",
          servicio_id_reabrir: selectedServiceToReopen ? parseInt(selectedServiceToReopen, 10) : null,
          persona_recibe: personaRecibeInput || null,
          confirmar_entrega: confirmarEntregaCheck
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.blockers && data.blockers.length > 0) {
          const blockerMsg = data.blockers
            .map((b) => `• ${b.tipo_servicio_nombre}: ${b.motivos.map(m => m === 'SERVICIO_PENDIENTE' ? 'estado Pendiente' : 'sin mano de obra').join(' y ')}.`)
            .join('\n');
          throw new Error(`${data.message || data.error}\n\nServicios que requieren atención:\n${blockerMsg}`);
        }
        throw new Error(data.error || data.message || "Error al actualizar la orden.");
      }

      setStatusModalOpen(false);
      setChangeNotes("");
      setModalError(null);
      refreshSilently();
    } catch (err) {
      setModalError(err.message);
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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-xl text-slate-400 gap-3 font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
        <span className="text-xs">Cargando Detalle de Orden de Trabajo...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex flex-col gap-3 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold text-sm block font-sans">Orden no encontrada</span>
              <span>{error || "No se pudo recuperar la orden solicitada."}</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl font-bold uppercase transition-colors"
          >
            Volver al Listado
          </button>
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

  // Financial Items List (services + products) from live backend API
  const financialItems = [
    ...(order.servicios || []).map((s) => {
      const cant = Number(s.cantidad || 1);
      const precioUnit = Number(s.precio_unitario || s.precio || 0);
      const sub = Number(s.subtotal || 0);
      const totalItem = sub > 0 ? sub : (cant * precioUnit);

      return {
        nombre: s.tipo_servicio_nombre || "Servicio de Mantenimiento",
        cantidad: cant,
        precio: precioUnit,
        total: totalItem,
        tipo: "SERVICIO"
      };
    }),
    ...(order.repuestos || order.productos || []).map((p) => {
      const cant = Number(p.cantidad || 1);
      const precioUnit = Number(p.precio_unitario || 0);
      const sub = Number(p.subtotal || 0);
      const totalItem = sub > 0 ? sub : (cant * precioUnit);

      return {
        nombre: p.producto_nombre || "Producto / Repuesto",
        cantidad: cant,
        precio: precioUnit,
        total: totalItem,
        tipo: "REPUESTO"
      };
    })
  ];

  // Calculated totals directly from order object or computed financial items
  const subtotalServicios = financialItems
    .filter((i) => i.tipo === "SERVICIO")
    .reduce((acc, item) => acc + item.total, 0);

  const subtotalProductos = financialItems
    .filter((i) => i.tipo === "REPUESTO")
    .reduce((acc, item) => acc + item.total, 0);

  const computedSum = subtotalServicios + subtotalProductos;
  const totalEstimado = Number(order.total_orden || 0) > 0 ? Number(order.total_orden) : computedSum;

  // Dynamic Metrics
  const repairProgressPercent = order.progreso_porcentaje ?? 0;
  const horasEstimadasText = order.horas_estimadas !== undefined ? `${order.horas_estimadas}h` : "N/A";
  const horasRegistradasText = order.horas_registradas !== undefined ? `${order.horas_registradas}h` : "0.0h";

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap font-mono">
            <button
              onClick={onBack}
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

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#161a21] border border-[#2d3748] text-slate-200 rounded-xl hover:border-slate-500 transition-colors font-mono text-xs font-semibold uppercase tracking-wider shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            IMPRIMIR
          </button>
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
                  OBSERVACIONES Y REVISIÓN TÉCNICA
                </h3>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {order.diagnostico_inicial || order.motivo_ingreso || "Sin diagnóstico técnico registrado."}
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold uppercase">Progreso de Reparación</span>
                  <span className="text-[#bfce7f] font-bold">{repairProgressPercent}% COMPLETADO</span>
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
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Horas estimadas: <strong className="text-slate-200">{horasEstimadasText}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#bfce7f]" />
                  <span>Horas registradas: <strong className="text-slate-200">{horasRegistradasText}</strong></span>
                </div>
              </div>
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
                    <th className="py-3 px-5">ÍTEM / SERVICIO</th>
                    <th className="py-3 px-5 text-right">CANT</th>
                    <th className="py-3 px-5 text-right">PRECIO UNIT.</th>
                    <th className="py-3 px-5 text-right">TOTAL (RD$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]">
                  {financialItems.length === 0 ? (
                    <tr className="bg-[#1c2129]">
                      <td colSpan={4} className="py-6 text-center text-slate-500 font-mono">
                        No hay servicios ni repuestos registrados en esta orden.
                      </td>
                    </tr>
                  ) : (
                    financialItems.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-[#1c2129]" : "bg-[#161a21]"}>
                        <td className="py-3 px-5 font-semibold text-slate-200">
                          {item.nombre}
                        </td>
                        <td className="py-3 px-5 text-right text-slate-400">{item.cantidad}</td>
                        <td className="py-3 px-5 text-right text-slate-400">
                          {item.precio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-bold text-slate-100">
                          {item.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="p-5 bg-[#1c2129] border-t-2 border-[#2d3748] flex justify-between items-center font-mono">
                <span className="text-base font-bold text-[#bfce7f] uppercase tracking-wider">TOTAL ESTIMADO:</span>
                <span className="text-xl font-extrabold text-[#bfce7f]">
                  RD$ {totalEstimado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column (4/12 width) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Assigned Mechanic Card */}
            {/* Consolidated Mechanics Bento Card */}
            <div className="bg-[#161a21] border border-[#2d3748] p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#2d3748]">
                <Wrench className="w-4 h-4 text-[#bfce7f]" />
                <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-widest">
                  MECÁNICOS ASIGNADOS
                </h3>
              </div>
              {(() => {
                const assignedMechanics = Array.from(
                  new Map(
                    (order.servicios || [])
                      .filter((s) => s.mecanico_usuario_id || s.usuario_id || s.mecanico_nombre)
                      .map((s) => [
                        s.mecanico_usuario_id || s.usuario_id || s.mecanico_nombre,
                        {
                          usuario_id: s.mecanico_usuario_id || s.usuario_id,
                          nombre: s.mecanico_nombre || `Mecánico #${s.mecanico_usuario_id || s.usuario_id}`
                        }
                      ])
                  ).values()
                );

                return assignedMechanics.length > 0 ? (
                  <div className="space-y-2.5">
                    {assignedMechanics.map((m, idx) => (
                      <div key={m.usuario_id || idx} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1c2129] border border-[#2d3748] flex items-center justify-center font-mono font-bold text-xs text-[#bfce7f] shrink-0">
                          {m.nombre
                            ? m.nombre
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()
                            : "RM"}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-100 font-sans">
                            {m.nombre}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Técnico de Taller
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono italic p-2">
                    Sin mecánicos asignados
                  </div>
                );
              })()}
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
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-sans flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">No se pudo actualizar</span>
                  <span>{modalError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateOrderState} className="space-y-4 text-xs font-sans">
              {(() => {
                const currentVt = order.validacion_transiciones?.find(v => String(v.estado_destino_id) === String(newStatusId));
                const isChangingState = String(newStatusId) !== String(order.estado_orden_id);
                const isBlocked = isChangingState && currentVt && !currentVt.permitida;

                return (
                  <>
                    {isBlocked && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          Transición bloqueada hacia {currentVt.nombre}
                        </div>
                        {currentVt.motivos_globales?.includes("SIN_SERVICIOS") && (
                          <p className="text-[11px] font-mono text-amber-200/90">• La orden no tiene servicios activos registrados.</p>
                        )}
                        {currentVt.blockers?.map((b) => (
                          <p key={b.orden_servicio_id} className="text-[11px] font-mono text-amber-200/90">
                            • Servicio #{b.orden_servicio_id} ({b.tipo_servicio_nombre}): {b.motivos.join(", ")}
                          </p>
                        ))}
                        {!currentVt.transicion_permitida && (
                          <p className="text-[11px] font-mono text-amber-200/90">• Transición no permitida en la matriz desde {order.estado_nombre}.</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Estado de la Orden</label>
                        <select
                          value={newStatusId}
                          onChange={(e) => setNewStatusId(e.target.value)}
                          className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f]"
                        >
                          {catalogs.estados?.map((e) => {
                            const vt = order.validacion_transiciones?.find(v => String(v.estado_destino_id) === String(e.estado_orden_id));
                            const isCurrent = String(e.estado_orden_id) === String(order.estado_orden_id);
                            const isDisabled = !isCurrent && vt && !vt.permitida;
                            let suffix = "";
                            if (!isCurrent) {
                              if (vt && !vt.transicion_permitida) suffix = " ❌ (No permitido)";
                              else if (vt && !vt.permitida) suffix = " ⚠️ (Bloqueado)";
                            }
                            return (
                              <option key={e.estado_orden_id} value={String(e.estado_orden_id)} disabled={isDisabled}>
                                {e.nombre}{suffix}
                              </option>
                            );
                          })}
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
                              <option value="1">Alta Prioridad</option>
                              <option value="2">Normal</option>
                              <option value="3">Baja Prioridad</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Return to repair conditional field: Select service to reopen */}
                    {String(order.estado_orden_id) === "7" && String(newStatusId) === "5" && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                        <label className="block text-amber-300 font-semibold font-mono text-[11px]">
                          * Servicio que requiere corrección y reanudación:
                        </label>
                        <select
                          value={selectedServiceToReopen}
                          onChange={(e) => setSelectedServiceToReopen(e.target.value)}
                          required
                          className="w-full p-2 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-slate-200 text-xs focus:outline-none focus:border-[#bfce7f]"
                        >
                          <option value="">-- Selecciona el servicio a reabrir --</option>
                          {(order.servicios || []).map((s) => (
                            <option key={s.orden_servicio_id} value={String(s.orden_servicio_id)}>
                              #{s.orden_servicio_id} - {s.tipo_servicio_nombre} ({s.mecanico_nombre})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Delivery confirmation conditional fields */}
                    {String(order.estado_orden_id) === "7" && String(newStatusId) === "8" && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                        <div>
                          <label className="block text-emerald-300 font-semibold font-mono text-[11px] mb-1">
                            Nombre de la persona que recibe la bicicleta:
                          </label>
                          <input
                            type="text"
                            value={personaRecibeInput}
                            onChange={(e) => setPersonaRecibeInput(e.target.value)}
                            placeholder={order.cliente_nombre || "Nombre del cliente / representante"}
                            className="w-full p-2 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-emerald-200 font-semibold text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmarEntregaCheck}
                            onChange={(e) => setConfirmarEntregaCheck(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 bg-slate-900"
                          />
                          <span>Confirmo que la bicicleta fue entregada conforme al cliente.</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        {String(newStatusId) === "5" && String(order.estado_orden_id) === "7" ? "* Motivo obligatorio de devolución a reparación:" : "Observación / Notas del Cambio"}
                      </label>
                      <textarea
                        rows={3}
                        value={changeNotes}
                        onChange={(e) => setChangeNotes(e.target.value)}
                        placeholder={String(newStatusId) === "5" && String(order.estado_orden_id) === "7" ? "Indica obligatoriamente el motivo para devolver la orden a reparación..." : "Justificación o notas del cambio..."}
                        required={String(newStatusId) === "5" && String(order.estado_orden_id) === "7"}
                        className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-slate-200 focus:outline-none focus:border-[#bfce7f] leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#2d3748]">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalOpen(false);
                          setModalError(null);
                        }}
                        className="px-4 py-2.5 text-slate-400 hover:text-slate-200 transition-colors font-mono text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={updatingStatus || isBlocked}
                        className={`px-5 py-2.5 font-bold rounded-xl transition-all flex items-center gap-2 border-t font-mono text-xs ${
                          isBlocked
                            ? "bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed"
                            : "bg-[#84924a] text-white hover:brightness-110 border-[#a6b66b]"
                        }`}
                      >
                        {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                        {updatingStatus ? "Guardando..." : "Guardar Cambios"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
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
          <h2 className="font-bold font-mono text-slate-900 mb-2 uppercase tracking-wider text-[11px]">SERVICIOS ASOCIADOS</h2>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] uppercase">
                <th className="p-2 border-r border-slate-300">Servicio</th>
                <th className="p-2 border-r border-slate-300">Mecánico Responsable</th>
                <th className="p-2 border-r border-slate-300 text-center">Estado</th>
                <th className="p-2 border-r border-slate-300 text-right">Tiempo Est.</th>
                <th className="p-2 text-right">Precio Acordado (RD$)</th>
              </tr>
            </thead>
            <tbody>
              {(!order.servicios || order.servicios.length === 0) ? (
                <tr><td colSpan={5} className="p-3 text-center text-slate-500">No hay servicios registrados en esta orden.</td></tr>
              ) : (
                order.servicios.map((svc, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-medium">{svc.tipo_servicio_nombre}</td>
                    <td className="p-2 border-r border-slate-200">{svc.mecanico_nombre || "Sin asignar"}</td>
                    <td className="p-2 border-r border-slate-200 text-center uppercase text-[10px]">{svc.estado_servicio_nombre || "Pendiente"}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{svc.tiempo_estimado_minutos ? `${(svc.tiempo_estimado_minutos/60).toFixed(1)}h` : "N/A"}</td>
                    <td className="p-2 text-right font-mono font-bold">RD$ {Number(svc.precio_acordado || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Products Table */}
        <div className="mb-6">
          <h2 className="font-bold font-mono text-slate-900 mb-2 uppercase tracking-wider text-[11px]">PRODUCTOS Y REPUESTOS</h2>
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
              {financialItems.filter(i => i.tipo === 'REPUESTO').length === 0 ? (
                <tr><td colSpan={4} className="p-3 text-center text-slate-500">No hay repuestos registrados en esta orden.</td></tr>
              ) : (
                financialItems.filter(i => i.tipo === 'REPUESTO').map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-medium">{item.nombre}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{item.cantidad}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">RD$ {item.precio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono font-bold">RD$ {item.total.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end mb-8">
          <div className="w-72 border border-slate-300 p-3 rounded-lg bg-slate-50 space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Servicios:</span>
              <span>RD$ {subtotalServicios.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Repuestos:</span>
              <span>RD$ {subtotalProductos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 pt-1.5 text-sm">
              <span>TOTAL ESTIMADO:</span>
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
