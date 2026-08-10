"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  ListFilter,
  Wrench,
  Clock,
  User,
  Bike,
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  CheckCircle2,
  ArrowRight,
  Move,
  X
} from "lucide-react";

export default function WorkOrdersKanbanView({ onViewDetail, onOpenNewModal, onToggleList }) {
  const [orders, setOrders] = useState([]);
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drag & Drop State
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverStatusId, setDragOverStatusId] = useState(null);

  // Status Change Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingMoveOrder, setPendingMoveOrder] = useState(null);
  const [targetStatusId, setTargetStatusId] = useState(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchKanbanData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/taller/ordenes?limit=100");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar órdenes de trabajo.");

      setOrders(data.data || []);
      if (data.catalogs?.estados) {
        // Sort states by orden_visual
        const sortedEstados = [...data.catalogs.estados].sort((a, b) => (a.orden || a.orden_visual || 0) - (b.orden || b.orden_visual || 0));
        setEstados(sortedEstados);
      }
    } catch (err) {
      console.error("fetchKanbanData Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanbanData();
  }, []);

  // HTML5 Drag & Drop Handlers
  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.setData("application/json", JSON.stringify(order));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, statusId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStatusId !== statusId) {
      setDragOverStatusId(statusId);
    }
  };

  const handleDragLeave = (e, statusId) => {
    e.preventDefault();
    if (dragOverStatusId === statusId) {
      setDragOverStatusId(null);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverStatusId(null);
    let orderToMove = draggedOrder;

    if (!orderToMove) {
      try {
        const dataStr = e.dataTransfer.getData("application/json");
        if (dataStr) orderToMove = JSON.parse(dataStr);
      } catch (err) {
        console.error("Drop Data Parse Error:", err);
      }
    }

    if (!orderToMove) return;

    if (orderToMove.estado_orden_id === targetId) {
      setDraggedOrder(null);
      return;
    }

    setPendingMoveOrder(orderToMove);
    setTargetStatusId(targetId);
    setChangeNotes("");
    setConfirmModalOpen(true);
    setDraggedOrder(null);
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setDragOverStatusId(null);
  };

  // Accessible Fallback Select Move
  const handleSelectMove = (order, newStatusId) => {
    const sId = parseInt(newStatusId, 10);
    if (order.estado_orden_id === sId) return;
    setPendingMoveOrder(order);
    setTargetStatusId(sId);
    setChangeNotes("");
    setConfirmModalOpen(true);
  };

  // Confirm Status Change API Call
  const handleConfirmStatusChange = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!pendingMoveOrder || !targetStatusId) return;

    const targetId = pendingMoveOrder.orden_id || pendingMoveOrder.orden_trabajo_id;
    if (!targetId) {
      alert("Error: ID de la orden no especificado.");
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_id: targetStatusId,
          estado_anterior_esperado_id: pendingMoveOrder.estado_orden_id,
          observacion_cambio_estado: changeNotes || "Movimiento en Tablero Kanban"
        })
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("Conflicto: La orden fue modificada por otro usuario simultáneamente. Se recargarán los datos.");
        }
        throw new Error(json.error || "Error al actualizar el estado de la orden.");
      }

      setConfirmModalOpen(false);
      const targetStateObj = estados.find(s => s.estado_orden_id === targetStatusId);
      setSuccessMessage(`Orden ${pendingMoveOrder.codigo_orden} movida exitosamente a "${targetStateObj?.nombre || 'nuevo estado'}".`);
      
      setTimeout(() => setSuccessMessage(""), 4000);
      setPendingMoveOrder(null);
      setTargetStatusId(null);
      await fetchKanbanData();
    } catch (err) {
      alert(`Error en transición: ${err.message}`);
      await fetchKanbanData();
    } finally {
      setUpdating(false);
    }
  };

  const getPrioridadBadge = (nombre, color) => {
    const colorStyle = color ? { color: color, borderColor: `${color}40`, backgroundColor: `${color}15` } : {};
    return (
      <span
        className="px-2 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1 w-fit select-none"
        style={colorStyle}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || "#64748B" }}></span>
        {nombre}
      </span>
    );
  };

  // Divide states into 2 rows of 4 columns each for 100% width fit
  const row1States = estados.slice(0, 4);
  const row2States = estados.slice(4, 8);

  const renderColumn = (estado) => {
    const columnOrders = orders.filter(o => o.estado_orden_id === estado.estado_orden_id);
    const isDragTarget = dragOverStatusId === estado.estado_orden_id;

    return (
      <div
        key={estado.estado_orden_id}
        onDragOver={(e) => handleDragOver(e, estado.estado_orden_id)}
        onDragLeave={(e) => handleDragLeave(e, estado.estado_orden_id)}
        onDrop={(e) => handleDrop(e, estado.estado_orden_id)}
        className={`flex flex-col bg-slate-900/60 border rounded-2xl p-3.5 transition-all min-h-[220px] ${
          isDragTarget
            ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30 scale-[1.01]"
            : "border-slate-800"
        }`}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 shrink-0 min-h-[42px]">
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: estado.color_estado || estado.color || "#64748B" }}
            ></span>
            <h3 className="text-xs font-bold text-slate-200 tracking-wide font-sans leading-tight whitespace-normal break-words flex-1">
              {estado.nombre}
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-full shrink-0">
            {columnOrders.length}
          </span>
        </div>

        {/* Drop Target Hint indicator when dragging */}
        {isDragTarget && (
          <div className="mb-3 p-2 bg-emerald-500/20 border border-dashed border-emerald-400/50 rounded-xl text-[11px] text-emerald-300 text-center font-medium animate-pulse">
            Soltar aquí para mover a {estado.nombre}
          </div>
        )}

        {/* Column Cards Container */}
        <div className="flex-1 space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar overflow-x-hidden">
          {columnOrders.length === 0 ? (
            <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-600 text-center p-3">
              <span className="text-[11px]">Sin órdenes en este estado</span>
            </div>
          ) : (
            columnOrders.map((ord) => {
              const isBeingDragged = draggedOrder?.orden_id === ord.orden_id;
              return (
                <div
                  key={ord.orden_id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, ord)}
                  onDragEnd={handleDragEnd}
                  className={`bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2.5 transition-all shadow-md group cursor-grab active:cursor-grabbing select-none relative overflow-x-hidden ${
                    isBeingDragged ? "opacity-40 border-dashed border-emerald-400 scale-95" : ""
                  }`}
                >
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-mono font-extrabold text-emerald-400 flex items-center gap-1">
                      <Move className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      {ord.codigo_orden}
                    </span>
                    {getPrioridadBadge(ord.prioridad_nombre, ord.prioridad_color)}
                  </div>

                  {/* Customer & Bike Info */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{ord.cliente_nombre}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                      <Bike className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{ord.bicicleta_marca} {ord.bicicleta_modelo}</span>
                    </div>
                  </div>

                  {/* Financial & Reception */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                      {ord.codigo_recepcion}
                    </span>
                    <span className="font-bold text-slate-200">
                      ${parseFloat(ord.total_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* Bottom Actions: View Detail + Accessible Move Dropdown */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      onClick={() => onViewDetail(ord.orden_id)}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors shrink-0"
                      title="Ver detalle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalle
                    </button>

                    {/* Accessible Move Select Fallback */}
                    <select
                      value={ord.estado_orden_id}
                      onChange={(e) => handleSelectMove(ord, e.target.value)}
                      className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 max-w-[120px] truncate"
                    >
                      {estados.map(s => (
                        <option key={s.estado_orden_id} value={s.estado_orden_id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const getTargetStateObj = () => {
    return estados.find(s => s.estado_orden_id === targetStatusId);
  };

  const getPreviousStateObj = () => {
    if (!pendingMoveOrder) return null;
    return estados.find(s => s.estado_orden_id === pendingMoveOrder.estado_orden_id);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
        <span className="hover:text-slate-300 transition-colors cursor-pointer" onClick={onToggleList}>Taller</span>
        <span>/</span>
        <span className="hover:text-slate-300 transition-colors cursor-pointer" onClick={onToggleList}>Órdenes de Trabajo</span>
        <span>/</span>
        <span className="text-emerald-400 font-semibold">Vista Kanban</span>
      </div>

      {/* Header Bar Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Vista Kanban
              <span className="text-xs px-2.5 py-0.5 bg-slate-800 text-emerald-400 border border-slate-700 rounded-full font-mono font-medium">
                {orders.length} Órdenes
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Arrastra las tarjetas entre columnas para actualizar el flujo de reparación en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleList}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow-sm"
          >
            <ListFilter className="w-4 h-4 text-emerald-400" />
            Vista Tabla
          </button>
          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-400/20"
          >
            <Plus className="w-4 h-4" />
            Nueva orden de trabajo
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
          <span className="text-xs font-medium">Cargando tablero Kanban...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-semibold block">Error al cargar datos</span>
            <span className="text-rose-300/80">{error}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: States 1 to 4 */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Fase Inicial (1 a 4)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
              {row1States.map(renderColumn)}
            </div>
          </div>

          {/* Row 2: States 5 to 8 */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Fase Final & Entrega (5 a 8)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
              {row2States.map(renderColumn)}
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop State Change Confirmation Modal */}
      {confirmModalOpen && pendingMoveOrder && targetStatusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl min-w-[420px] max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Move className="w-4 h-4 text-emerald-400" />
                Confirmar Transición de Estado
              </h3>
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Orden de Trabajo:</span>
                <span className="font-mono font-bold text-emerald-400">{pendingMoveOrder.codigo_orden}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cliente / Bicicleta:</span>
                <span className="text-slate-200 font-medium truncate max-w-[200px]">
                  {pendingMoveOrder.cliente_nombre} • {pendingMoveOrder.bicicleta_marca}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block">Estado Anterior</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold text-[11px]">
                    {getPreviousStateObj()?.nombre || 'Estado Origen'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block">Estado Nuevo</span>
                  <span
                    className="px-2 py-0.5 rounded font-semibold text-[11px] text-slate-950 font-bold"
                    style={{ backgroundColor: getTargetStateObj()?.color_estado || "#10B981" }}
                  >
                    {getTargetStateObj()?.nombre || 'Estado Destino'}
                  </span>
                </div>
              </div>
            </div>

            {/* Motivo / Observación Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Motivo / Observación del Cambio <span className="text-slate-500">(Opcional)</span>:
              </label>
              <textarea
                rows={2}
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="Ej. Diagnóstico finalizado, cliente aprueba reparación..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={updating}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={updating}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-400/20 disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar Transición"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
