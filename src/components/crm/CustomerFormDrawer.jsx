"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  User,
  Building2,
  X,
  Save,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import {
  formatCedula,
  formatRnc,
  formatDominicanPhone,
  validateCedula,
  validateRnc,
  validateDominicanPhone,
  normalizeDigits
} from "@/lib/crm/customerValidation";

export {
  formatCedula,
  formatRnc,
  formatDominicanPhone,
  validateCedula,
  validateRnc,
  validateDominicanPhone,
  normalizeDigits
};

export default function CustomerFormDrawer({
  isOpen = false,
  editingItem = null,
  onClose,
  onSuccess,
  showToast
}) {
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    identificacion: "",
    tipo_cliente: "PERSONA",
    telefono_principal: "",
    telefono_secundario: "",
    correo: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    pais: "República Dominicana",
    fecha_nacimiento: "",
    genero: "",
    contacto_whatsapp: true,
    contacto_email: true,
    notas: ""
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setIsSaving(false);
      if (editingItem) {
        const isEmpresa = (editingItem.tipo_cliente || "").toUpperCase() === "EMPRESA";
        const formattedIdent = isEmpresa
          ? formatRnc(editingItem.identificacion || editingItem.rnc || editingItem.cedula || "")
          : formatCedula(editingItem.identificacion || editingItem.cedula || editingItem.rnc || "");
        const formattedPhone = formatDominicanPhone(editingItem.telefono_principal || "");

        setFormData({
          nombre: editingItem.nombre || "",
          apellido: editingItem.apellido || "",
          identificacion: formattedIdent,
          tipo_cliente: isEmpresa ? "EMPRESA" : "PERSONA",
          telefono_principal: formattedPhone,
          telefono_secundario: editingItem.telefono_secundario ? formatDominicanPhone(editingItem.telefono_secundario) : "",
          correo: editingItem.correo || "",
          direccion: editingItem.direccion || "",
          ciudad: editingItem.ciudad || "",
          provincia: editingItem.provincia || "",
          pais: editingItem.pais || "República Dominicana",
          fecha_nacimiento: editingItem.fecha_nacimiento ? String(editingItem.fecha_nacimiento).substring(0, 10) : "",
          genero: editingItem.genero || "",
          contacto_whatsapp: editingItem.contacto_whatsapp !== false,
          contacto_email: editingItem.contacto_email !== false,
          notas: editingItem.notas || ""
        });
      } else {
        setFormData({
          nombre: "",
          apellido: "",
          identificacion: "",
          tipo_cliente: "PERSONA",
          telefono_principal: "",
          telefono_secundario: "",
          correo: "",
          direccion: "",
          ciudad: "",
          provincia: "",
          pais: "República Dominicana",
          fecha_nacimiento: "",
          genero: "",
          contacto_whatsapp: true,
          contacto_email: true,
          notas: ""
        });
      }
    }
  }, [isOpen, editingItem]);

  if (!isOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  const validateForm = () => {
    const newErrors = {};
    const isEmpresa = formData.tipo_cliente?.toUpperCase() === "EMPRESA";

    if (!formData.nombre || !formData.nombre.trim()) {
      newErrors.nombre = isEmpresa
        ? "La Razón Social / Nombre de Empresa es obligatoria."
        : "El Nombre es obligatorio.";
    }

    const phoneErr = validateDominicanPhone(formData.telefono_principal);
    if (phoneErr) newErrors.telefono_principal = phoneErr;

    if (formData.identificacion && formData.identificacion.trim()) {
      const identErr = isEmpresa ? validateRnc(formData.identificacion) : validateCedula(formData.identificacion);
      if (identErr) newErrors.identificacion = identErr;
    }

    if (formData.correo && formData.correo.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.correo.trim())) {
        newErrors.correo = "El formato de correo electrónico es inválido.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const targetId = editingItem?.id || editingItem?.cliente_id;
      const url = editingItem ? `/api/crm/clientes/${targetId}` : "/api/crm/clientes";
      const method = editingItem ? "PUT" : "POST";

      const payload = {
        ...formData,
        nombre: formData.nombre.trim(),
        apellido: (formData.apellido || "").trim(),
        identificacion: normalizeDigits(formData.identificacion),
        telefono_principal: formData.telefono_principal.trim(),
        telefono_secundario: (formData.telefono_secundario || "").trim(),
        correo: (formData.correo || "").trim().toLowerCase(),
        direccion: (formData.direccion || "").trim(),
        ciudad: (formData.ciudad || "").trim(),
        provincia: (formData.provincia || "").trim(),
        pais: (formData.pais || "República Dominicana").trim(),
        notas: (formData.notas || "").trim()
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json().catch(() => null);

      if (res.ok && (result?.success || result?.cliente_id || result?.id || result?.data)) {
        const savedData = result?.data || result;
        const msg = editingItem
          ? "Cliente actualizado exitosamente."
          : "Cliente registrado exitosamente.";
        if (showToast) showToast(msg, "success");
        if (onSuccess) onSuccess(savedData);
        if (onClose) onClose();
      } else {
        const errMsg = result?.message || result?.error || "Error al procesar el cliente.";
        if (result?.field && errors[result.field] === undefined) {
          setErrors((prev) => ({ ...prev, [result.field]: errMsg }));
        }
        if (showToast) showToast(errMsg, "error");
      }
    } catch (err) {
      console.error("Error saving customer:", err);
      if (showToast) showToast("Error de conexión al guardar el cliente.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const drawerContent = (
    <div className="fixed inset-0 z-[999999] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => !isSaving && onClose && onClose()}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          style={{
            width: "100vw",
            maxWidth: "540px",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000000
          }}
          className="bg-card border-l border-border shadow-2xl font-sans"
        >
          {/* Header */}
          <div className="p-5 border-b border-border bg-surface flex items-start justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <span>{editingItem ? "Editar Cliente" : "Registrar Nuevo Cliente"}</span>
              </h2>
              <p className="text-xs text-foreground-muted mt-0.5 font-mono">
                {editingItem
                  ? "Modifique la información registrada del cliente."
                  : "Complete el formulario para crear un nuevo cliente en el CRM."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => !isSaving && onClose && onClose()}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-6 font-mono text-xs">
            {/* Tipo de Cliente Selector */}
            <div className="space-y-2">
              <label className="block text-foreground-secondary font-bold uppercase text-[11px]">
                Tipo de Cliente <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, tipo_cliente: "PERSONA", identificacion: "" }));
                    setErrors((prev) => ({ ...prev, identificacion: null }));
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.tipo_cliente === "PERSONA"
                      ? "bg-primary-muted border-primary text-primary"
                      : "bg-surface border-border text-foreground-muted hover:text-foreground"
                  }`}
                >
                  <User size={15} />
                  <span>Persona Física</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, tipo_cliente: "EMPRESA", identificacion: "" }));
                    setErrors((prev) => ({ ...prev, identificacion: null }));
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.tipo_cliente === "EMPRESA"
                      ? "bg-info-muted border-info text-info"
                      : "bg-surface border-border text-foreground-muted hover:text-foreground"
                  }`}
                >
                  <Building2 size={15} />
                  <span>Empresa</span>
                </button>
              </div>
            </div>

            {/* Sección 1: Datos de Identidad */}
            <div className="space-y-4 pt-2 border-t border-border-subtle">
              <h3 className="text-primary font-bold uppercase tracking-wider text-[11px] pb-1">
                1. Identidad
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={formData.tipo_cliente === "EMPRESA" ? "sm:col-span-2" : ""}>
                  <label className="block text-foreground-secondary mb-1 font-semibold">
                    {formData.tipo_cliente === "EMPRESA" ? "Razón Social / Nombre" : "Nombre"}{" "}
                    <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder={formData.tipo_cliente === "EMPRESA" ? "Ej: Distribuidora Ride Lab SRL" : "Ej: Mateo"}
                    className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none transition-all ${
                      errors.nombre ? "border-error focus:border-error" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.nombre && <p className="text-error text-[10px] mt-1">{errors.nombre}</p>}
                </div>

                {formData.tipo_cliente !== "EMPRESA" && (
                  <div>
                    <label className="block text-foreground-secondary mb-1 font-semibold">Apellido</label>
                    <input
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      placeholder="Ej: Rodríguez"
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-foreground-secondary mb-1 font-semibold">
                    {formData.tipo_cliente === "EMPRESA" ? "RNC (9 dígitos)" : "Cédula de Identidad (11 dígitos)"}
                  </label>
                  <input
                    type="text"
                    value={formData.identificacion}
                    onChange={(e) => {
                      const isEmp = formData.tipo_cliente === "EMPRESA";
                      const formatted = isEmp ? formatRnc(e.target.value) : formatCedula(e.target.value);
                      setFormData((prev) => ({ ...prev, identificacion: formatted }));
                      const err = isEmp ? validateRnc(formatted) : validateCedula(formatted);
                      setErrors((prev) => ({ ...prev, identificacion: err }));
                    }}
                    placeholder={formData.tipo_cliente === "EMPRESA" ? "Ej: 1-01-12345-6" : "Ej: 001-1234567-8"}
                    className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none font-mono ${
                      errors.identificacion ? "border-error focus:border-error" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.identificacion && <p className="text-error text-[10px] mt-1">{errors.identificacion}</p>}
                </div>
              </div>
            </div>

            {/* Sección 2: Contacto y Ubicación */}
            <div className="space-y-4 pt-2 border-t border-border-subtle">
              <h3 className="text-primary font-bold uppercase tracking-wider text-[11px] pb-1">
                2. Contacto y Ubicación
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground-secondary mb-1 font-semibold">
                    Teléfono Principal <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.telefono_principal}
                    onChange={(e) => {
                      const formatted = formatDominicanPhone(e.target.value);
                      setFormData((prev) => ({ ...prev, telefono_principal: formatted }));
                      const err = validateDominicanPhone(formatted);
                      setErrors((prev) => ({ ...prev, telefono_principal: err }));
                    }}
                    placeholder="Ej: 809-555-1234"
                    className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none font-mono ${
                      errors.telefono_principal ? "border-error focus:border-error" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.telefono_principal && <p className="text-error text-[10px] mt-1">{errors.telefono_principal}</p>}
                </div>

                <div>
                  <label className="block text-foreground-secondary mb-1 font-semibold">Teléfono Secundario</label>
                  <input
                    type="text"
                    value={formData.telefono_secundario}
                    onChange={(e) => setFormData({ ...formData, telefono_secundario: formatDominicanPhone(e.target.value) })}
                    placeholder="Ej: 829-555-5678"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-foreground-secondary mb-1 font-semibold">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    placeholder="Ej: cliente@correo.com"
                    className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none ${
                      errors.correo ? "border-error focus:border-error" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.correo && <p className="text-error text-[10px] mt-1">{errors.correo}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-foreground-secondary mb-1 font-semibold">Dirección</label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Ej: Av. Winston Churchill #105"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-foreground-secondary mb-1 font-semibold">Ciudad</label>
                  <input
                    type="text"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    placeholder="Ej: Santo Domingo"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-foreground-secondary mb-1 font-semibold">Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    placeholder="Ej: Distrito Nacional"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Sección 3: Preferencias y Notas */}
            <div className="space-y-4 pt-2 border-t border-border-subtle">
              <h3 className="text-primary font-bold uppercase tracking-wider text-[11px] pb-1">
                3. Preferencias de Notificación & Notas
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.contacto_whatsapp}
                    onChange={(e) => setFormData({ ...formData, contacto_whatsapp: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-surface"
                  />
                  <span className="text-foreground text-xs font-semibold">
                    Permitir notificaciones y cotizaciones por WhatsApp
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.contacto_email}
                    onChange={(e) => setFormData({ ...formData, contacto_email: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-surface"
                  />
                  <span className="text-foreground text-xs font-semibold">
                    Permitir facturas y estados por Correo Electrónico
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-foreground-secondary mb-1 font-semibold">Notas Internas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Información adicional relevante del cliente..."
                  rows={2}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-surface flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onClose && onClose()}
              className="px-4 py-2.5 bg-surface border border-border hover:bg-hover text-foreground-muted hover:text-foreground font-mono text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2.5 bg-primary-button-bg text-primary-foreground hover:bg-primary-button-hover font-mono text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{editingItem ? "Actualizar Cliente" : "Guardar Cliente"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
