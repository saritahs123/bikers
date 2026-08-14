"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bike,
  User,
  Shield,
  Paperclip,
  Save,
  X,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function BikeFormDrawer({
  isOpen = false,
  editingItem = null,
  clientes = [],
  preselectedClienteId = null,
  preselectedClienteName = "",
  lockCliente = false,
  onClose,
  onSuccess,
  showToast
}) {
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    cliente_id: "",
    marca: "",
    modelo: "",
    tipo_bicicleta: "MTB",
    ano: new Date().getFullYear(),
    color: "",
    talla: "M",
    numero_serie_cuadro: "",
    kilometraje_actual: 0,
    descripcion: "",
    notas_tecnicas: ""
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state whenever drawer opens or editingItem / preselectedClienteId changes
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setFormError(null);
      setIsSaving(false);

      if (editingItem) {
        setFormData({
          cliente_id: editingItem.cliente_id ? String(editingItem.cliente_id) : "",
          marca: editingItem.marca || "",
          modelo: editingItem.modelo || "",
          tipo_bicicleta: editingItem.tipo_bicicleta || "MTB",
          ano: editingItem.ano || new Date().getFullYear(),
          color: editingItem.color || "",
          talla: editingItem.talla || "M",
          numero_serie_cuadro: editingItem.numero_serie_cuadro || "",
          kilometraje_actual: editingItem.kilometraje_actual || 0,
          descripcion: editingItem.descripcion || "",
          notas_tecnicas: editingItem.notas_tecnicas || ""
        });
      } else {
        const defaultClient = preselectedClienteId
          ? String(preselectedClienteId)
          : (clientes.length > 0 ? String(clientes[0].id || clientes[0].cliente_id) : "");

        setFormData({
          cliente_id: defaultClient,
          marca: "",
          modelo: "",
          tipo_bicicleta: "MTB",
          ano: new Date().getFullYear(),
          color: "",
          talla: "M",
          numero_serie_cuadro: "",
          kilometraje_actual: 0,
          descripcion: "",
          notas_tecnicas: ""
        });
      }
    }
  }, [isOpen, editingItem, preselectedClienteId, clientes]);

  // Sync async loaded clients when drawer is open and client selection is not locked
  useEffect(() => {
    if (isOpen && !editingItem && !lockCliente && !preselectedClienteId && !formData.cliente_id && clientes.length > 0) {
      const firstId = clientes[0].id || clientes[0].cliente_id;
      if (firstId) {
        setFormData((prev) => ({ ...prev, cliente_id: String(firstId) }));
      }
    }
  }, [isOpen, editingItem, lockCliente, preselectedClienteId, formData.cliente_id, clientes]);

  if (!isOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  const validateForm = () => {
    const errs = {};

    const targetClienteId = lockCliente ? preselectedClienteId : formData.cliente_id;
    if (!targetClienteId) {
      errs.cliente_id = "Debe seleccionar un cliente propietario.";
    }

    const marcaRes = validateRequiredText(formData.marca, "La Marca", 100);
    if (!marcaRes.isValid) errs.marca = marcaRes.message;

    const modeloRes = validateRequiredText(formData.modelo, "El Modelo", 100);
    if (!modeloRes.isValid) errs.modelo = modeloRes.message;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      const firstErr = Object.values(errors)[0] || "Existen campos requeridos incompletos.";
      setFormError(firstErr);
      if (showToast) showToast(firstErr, "error");
      return;
    }

    setIsSaving(true);
    try {
      const targetClienteId = lockCliente ? preselectedClienteId : formData.cliente_id;
      const payload = {
        ...formData,
        cliente_id: targetClienteId ? (isNaN(Number(targetClienteId)) ? targetClienteId : Number(targetClienteId)) : null,
        ano: Number(formData.ano) || new Date().getFullYear(),
        kilometraje_actual: Number(formData.kilometraje_actual) || 0
      };

      const isEdit = Boolean(editingItem?.id || editingItem?.bicicleta_id);
      const targetId = editingItem?.id || editingItem?.bicicleta_id;
      const url = isEdit ? `/api/crm/bicicletas/${targetId}` : "/api/crm/bicicletas";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.error) {
        const msg = json?.error || json?.message || `No fue posible guardar la bicicleta (${res.status})`;
        setFormError(msg);
        if (showToast) showToast(msg, "error");
        return;
      }

      const savedBike = json?.data || json;
      const successMsg = isEdit ? "Bicicleta actualizada correctamente" : "Bicicleta registrada correctamente";
      if (showToast) showToast(successMsg, "success");

      if (onSuccess) {
        onSuccess(savedBike);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("Error in BikeFormDrawer handleSubmit:", err);
      const msg = "Error inesperado al conectar con el servidor.";
      setFormError(msg);
      if (showToast) showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const matchedClient = clientes.find(
    (c) => String(c.id || c.cliente_id) === String(formData.cliente_id || preselectedClienteId)
  );
  const clientDisplayName = preselectedClienteName || matchedClient?.nombre_completo || (matchedClient ? `${matchedClient.nombre || ""} ${matchedClient.apellido || ""}`.trim() : `Cliente #${preselectedClienteId || formData.cliente_id}`);

  const drawerContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', justifyContent: 'flex-end' }} className="font-mono text-xs">
      {/* Overlay Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
        onClick={() => !isSaving && onClose && onClose()}
      />

      {/* Side Drawer Card */}
      <div
        style={{
          position: 'relative',
          width: '560px',
          maxWidth: '95vw',
          height: '100vh',
          backgroundColor: '#161a21',
          borderLeft: '1px solid #2d3748',
          boxShadow: '-10px 0 35px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000000
        }}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#2d3748] bg-[#0e1117] flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#bfce7f]/10 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f] shrink-0">
              <Bike size={20} />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white">
                {editingItem ? "Editar Bicicleta" : "Registrar Nueva Bicicleta"}
              </h2>
              <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                {editingItem ? "Modifique los datos técnicos del activo" : "Complete los datos técnicos y vincule el cliente"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isSaving && onClose && onClose()}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#212631] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body with Custom Scrollbar */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {formError && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 font-mono text-xs flex items-center gap-3 shadow-md">
              <AlertTriangle size={18} className="text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Cliente Propietario */}
          <div className="space-y-2 bg-[#0e1117]/60 border border-[#2d3748] rounded-xl p-4">
            <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-1.5">
              <User size={14} /> 1. Cliente Propietario <span className="text-rose-400">*</span>
            </h3>

            {lockCliente || preselectedClienteId ? (
              <div className="w-full bg-[#0e1117] border border-[#bfce7f]/40 rounded-xl px-3.5 py-2.5 text-white font-bold flex items-center justify-between mt-2">
                <span className="flex items-center gap-2">
                  <User size={14} className="text-[#bfce7f]" />
                  {clientDisplayName}
                </span>
                <span className="text-[9px] bg-[#bfce7f]/20 text-[#bfce7f] border border-[#bfce7f]/40 px-2 py-0.5 rounded font-mono font-bold uppercase">
                  BLOQUEADO
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 mb-1">Seleccionar Cliente <span className="text-rose-400">*</span></label>
                <select
                  data-invalid={errors.cliente_id ? "true" : undefined}
                  value={formData.cliente_id}
                  onChange={(e) => {
                    setFormData({ ...formData, cliente_id: e.target.value });
                    if (errors.cliente_id) setErrors((prev) => ({ ...prev, cliente_id: null }));
                  }}
                  className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                    errors.cliente_id ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                >
                  <option value="">-- Seleccionar Propietario --</option>
                  {clientes.map((c) => (
                    <option key={c.id || c.cliente_id} value={c.id || c.cliente_id}>
                      {c.nombre_completo || `${c.nombre || ""} ${c.apellido || ""}`} ({c.correo || c.telefono_principal || `ID: ${c.id || c.cliente_id}`})
                    </option>
                  ))}
                </select>
                {errors.cliente_id && <p className="text-rose-400 text-[10px] mt-1">{errors.cliente_id}</p>}
              </div>
            )}
          </div>

          {/* 2. Especificaciones de la Bicicleta */}
          <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-xl p-4">
            <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-1.5">
              <Bike size={14} /> 2. Especificaciones Técnicas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-300 mb-1">Marca <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  data-invalid={errors.marca ? "true" : undefined}
                  value={formData.marca}
                  onChange={(e) => {
                    setFormData({ ...formData, marca: e.target.value });
                    if (errors.marca) setErrors((prev) => ({ ...prev, marca: null }));
                  }}
                  placeholder="Ej: Specialized, Trek"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2 text-white focus:outline-none ${
                    errors.marca ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.marca && <p className="text-rose-400 text-[10px] mt-1">{errors.marca}</p>}
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Modelo <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  data-invalid={errors.modelo ? "true" : undefined}
                  value={formData.modelo}
                  onChange={(e) => {
                    setFormData({ ...formData, modelo: e.target.value });
                    if (errors.modelo) setErrors((prev) => ({ ...prev, modelo: null }));
                  }}
                  placeholder="Ej: Stumpjumper, Fuel EX 8"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2 text-white focus:outline-none ${
                    errors.modelo ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.modelo && <p className="text-rose-400 text-[10px] mt-1">{errors.modelo}</p>}
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Tipo de Bicicleta</label>
                <select
                  value={formData.tipo_bicicleta}
                  onChange={(e) => setFormData({ ...formData, tipo_bicicleta: e.target.value })}
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                >
                  <option value="MTB">MTB (Montaña)</option>
                  <option value="ROAD">Road (Ruta)</option>
                  <option value="E-BIKE">E-Bike (Eléctrica)</option>
                  <option value="GRAVEL">Gravel</option>
                  <option value="ENDURO">Enduro</option>
                  <option value="CITY">Urbana / Ciudad</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Año</label>
                <input
                  type="number"
                  value={formData.ano}
                  onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  placeholder="2026"
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Color</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Ej: Negro Mate / Rojo"
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Talla Cuadro</label>
                <input
                  type="text"
                  value={formData.talla}
                  onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                  placeholder="Ej: M, L, 54cm"
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>
            </div>
          </div>

          {/* 3. Identificación Técnica & Odómetro */}
          <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-xl p-4">
            <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-1.5">
              <Shield size={14} /> 3. Serie & Odómetro
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-300 mb-1">N° Serie Cuadro (VIN)</label>
                <input
                  type="text"
                  value={formData.numero_serie_cuadro}
                  onChange={(e) => setFormData({ ...formData, numero_serie_cuadro: e.target.value })}
                  placeholder="Ej: TRK-12345"
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Kilometraje Actual (KM)</label>
                <input
                  type="number"
                  value={formData.kilometraje_actual}
                  onChange={(e) => setFormData({ ...formData, kilometraje_actual: e.target.value })}
                  placeholder="0"
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>
            </div>
          </div>

          {/* 4. Observaciones */}
          <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-xl p-4">
            <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-1.5">
              <Paperclip size={14} /> 4. Observaciones & Notas
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Descripción General</label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción general..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Notas Técnicas u Observaciones</label>
                <textarea
                  rows={2}
                  value={formData.notas_tecnicas}
                  onChange={(e) => setFormData({ ...formData, notas_tecnicas: e.target.value })}
                  placeholder="Notas de taller o accesorios..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex justify-end gap-3 shrink-0 font-mono">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onClose && onClose()}
            className="px-4 py-2 bg-[#212631] text-white border border-[#2d3748] rounded-xl hover:bg-[#2d3748] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="px-5 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
            <span>{editingItem ? "Guardar Cambios" : "Guardar Bicicleta"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
