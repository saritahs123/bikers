"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  X,
  Check,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

export default function ProductCreateModal({
  isOpen = false,
  onClose = () => {},
  onProductCreated = () => {},
  initialData = {},
}) {
  const [mounted, setMounted] = useState(false);
  const [lookups, setLookups] = useState({
    tipos: [],
    categorias: [],
    marcas: [],
    unidades: [],
    proveedores: [],
  });
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const [formData, setFormData] = useState({
    codigo_producto: "",
    codigo_barra: "",
    nombre: "",
    proveedor_id: "",
    descripcion: "",
    tipo_producto_id: "",
    categoria_producto_id: "",
    marca_producto_id: "",
    unidad_medida_id: "",
    costo_actual: "",
    precio_venta: "",
    stock_minimo: "0",
    stock_maximo: "",
    requiere_serial: false,
    activo: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Cargar catálogos auxiliares necesarios para el formulario
  const loadLookups = useCallback(async () => {
    try {
      setLoadingLookups(true);
      const res = await fetch("/api/taller/productos");
      if (res.ok) {
        const json = await res.json();
        if (json.lookups) {
          setLookups({
            tipos: json.lookups.tipos || [],
            categorias: json.lookups.categorias || [],
            marcas: json.lookups.marcas || [],
            unidades: json.lookups.unidades || [],
            proveedores: json.lookups.proveedores || [],
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar lookups de producto:", err);
    } finally {
      setLoadingLookups(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLookups();
      setFormData({
        codigo_producto: initialData.codigo_producto || "",
        codigo_barra: initialData.codigo_barra || "",
        nombre: initialData.nombre || "",
        proveedor_id: initialData.proveedor_id ? String(initialData.proveedor_id) : "",
        descripcion: initialData.descripcion || "",
        tipo_producto_id: initialData.tipo_producto_id ? String(initialData.tipo_producto_id) : "",
        categoria_producto_id: initialData.categoria_producto_id ? String(initialData.categoria_producto_id) : "",
        marca_producto_id: initialData.marca_producto_id ? String(initialData.marca_producto_id) : "",
        unidad_medida_id: initialData.unidad_medida_id ? String(initialData.unidad_medida_id) : "",
        costo_actual: initialData.costo_actual !== undefined ? String(initialData.costo_actual) : "",
        precio_venta: initialData.precio_venta !== undefined ? String(initialData.precio_venta) : "",
        stock_minimo: initialData.stock_minimo !== undefined ? String(initialData.stock_minimo) : "0",
        stock_maximo: initialData.stock_maximo ? String(initialData.stock_maximo) : "",
        requiere_serial: Boolean(initialData.requiere_serial),
        activo: true,
      });
      setErrors({});
      setGeneralError("");
    }
  }, [isOpen, initialData, loadLookups]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const validate = () => {
    const errs = {};
    if (!formData.codigo_producto.trim()) {
      errs.codigo_producto = "El código / SKU es obligatorio.";
    } else if (formData.codigo_producto.trim().length > 50) {
      errs.codigo_producto = "El código no puede exceder 50 caracteres.";
    }

    if (formData.codigo_barra && formData.codigo_barra.trim().length > 100) {
      errs.codigo_barra = "El código de barra no puede exceder 100 caracteres.";
    }

    if (!formData.nombre.trim()) {
      errs.nombre = "El nombre del producto es obligatorio.";
    } else if (formData.nombre.trim().length > 200) {
      errs.nombre = "El nombre no puede exceder 200 caracteres.";
    }

    if (!formData.tipo_producto_id) {
      errs.tipo_producto_id = "Debe seleccionar un tipo de producto.";
    }

    if (!formData.categoria_producto_id) {
      errs.categoria_producto_id = "Debe seleccionar una categoría.";
    }

    if (!formData.unidad_medida_id) {
      errs.unidad_medida_id = "Debe seleccionar una unidad de medida.";
    }

    const costo = parseFloat(formData.costo_actual);
    if (formData.costo_actual !== "" && (isNaN(costo) || costo < 0)) {
      errs.costo_actual = "El costo debe ser mayor o igual a 0.";
    }

    const precio = parseFloat(formData.precio_venta);
    if (formData.precio_venta !== "" && (isNaN(precio) || precio < 0)) {
      errs.precio_venta = "El precio debe ser mayor o igual a 0.";
    }

    const sMin = parseFloat(formData.stock_minimo);
    if (formData.stock_minimo !== "" && (isNaN(sMin) || sMin < 0)) {
      errs.stock_minimo = "El stock mínimo debe ser mayor o igual a 0.";
    }

    const sMax = parseFloat(formData.stock_maximo);
    if (formData.stock_maximo !== "" && !isNaN(sMax)) {
      if (sMax < (isNaN(sMin) ? 0 : sMin)) {
        errs.stock_maximo = "El stock máximo no puede ser menor al stock mínimo.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");
    if (!validate() || isSaving) return;

    setIsSaving(true);
    try {
      const payload = {
        codigo_producto: formData.codigo_producto.trim().toUpperCase(),
        codigo_barra: formData.codigo_barra.trim() || null,
        nombre: formData.nombre.trim(),
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id, 10) : null,
        descripcion: formData.descripcion.trim() || null,
        tipo_producto_id: parseInt(formData.tipo_producto_id, 10),
        categoria_producto_id: parseInt(formData.categoria_producto_id, 10),
        marca_producto_id: formData.marca_producto_id ? parseInt(formData.marca_producto_id, 10) : null,
        unidad_medida_id: parseInt(formData.unidad_medida_id, 10),
        costo_actual: formData.costo_actual !== "" ? parseFloat(formData.costo_actual) : 0,
        precio_venta: formData.precio_venta !== "" ? parseFloat(formData.precio_venta) : 0,
        stock_minimo: formData.stock_minimo !== "" ? parseFloat(formData.stock_minimo) : 0,
        stock_maximo: formData.stock_maximo !== "" ? parseFloat(formData.stock_maximo) : null,
        requiere_serial: Boolean(formData.requiere_serial),
        activo: Boolean(formData.activo),
        estado: formData.activo ? "ACTIVO" : "INACTIVO",
      };

      const res = await fetch("/api/taller/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al crear el producto.");
      }

      // Notificar al componente padre con el producto recién creado
      onProductCreated(json.data || json);
      onClose();
    } catch (err) {
      console.error("Error al registrar producto:", err);
      setGeneralError(err.message || "No se pudo crear el producto.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Modal Dialog */}
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col z-10 overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-product-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Package size={20} />
            </div>
            <div>
              <h2 id="modal-product-title" className="text-base font-bold text-foreground">
                Nuevo Producto
              </h2>
              <p className="text-xs text-foreground-muted">
                Registro directo en el catálogo maestro sin crear stock inicial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="px-6 py-2.5 bg-surface border-b border-border text-[11px] text-foreground-secondary flex items-center gap-2">
          <Info size={14} className="text-primary shrink-0" />
          <span>El stock de este producto se originará exclusivamente al guardar la entrada.</span>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono custom-scrollbar">
          {generalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {loadingLookups ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-foreground-muted">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-sans">Cargando catálogos de producto...</span>
            </div>
          ) : (
            <>
              {/* Bloque 1: Identificación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Código / SKU <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.codigo_producto}
                    onChange={(e) => setFormData({ ...formData, codigo_producto: e.target.value.toUpperCase() })}
                    placeholder="Ej. REP-001"
                    maxLength={50}
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground placeholder-foreground-muted uppercase focus:outline-none ${
                      errors.codigo_producto ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.codigo_producto && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.codigo_producto}</p>
                  )}
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Código de Barra (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.codigo_barra}
                    onChange={(e) => setFormData({ ...formData, codigo_barra: e.target.value })}
                    placeholder="Ej. 742100889201"
                    maxLength={100}
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground placeholder-foreground-muted focus:outline-none ${
                      errors.codigo_barra ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.codigo_barra && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.codigo_barra}</p>
                  )}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                  Nombre del Producto <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Cadena Shimano Deore 12V"
                  maxLength={200}
                  className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground placeholder-foreground-muted focus:outline-none font-sans ${
                    errors.nombre ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                  }`}
                />
                {errors.nombre && (
                  <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.nombre}</p>
                )}
              </div>

              {/* Bloque 2: Clasificación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Tipo de Producto <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.tipo_producto_id}
                    onChange={(e) => setFormData({ ...formData, tipo_producto_id: e.target.value })}
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none cursor-pointer ${
                      errors.tipo_producto_id ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    <option value="">Seleccione tipo...</option>
                    {lookups.tipos.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.tipo_producto_id && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.tipo_producto_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Categoría <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.categoria_producto_id}
                    onChange={(e) => setFormData({ ...formData, categoria_producto_id: e.target.value })}
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none cursor-pointer ${
                      errors.categoria_producto_id ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    <option value="">Seleccione categoría...</option>
                    {lookups.categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.categoria_producto_id && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.categoria_producto_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Unidad de Medida <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.unidad_medida_id}
                    onChange={(e) => setFormData({ ...formData, unidad_medida_id: e.target.value })}
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none cursor-pointer ${
                      errors.unidad_medida_id ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    <option value="">Seleccione unidad...</option>
                    {lookups.unidades.map((um) => (
                      <option key={um.id} value={um.id}>
                        {um.nombre} ({um.codigo})
                      </option>
                    ))}
                  </select>
                  {errors.unidad_medida_id && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.unidad_medida_id}</p>
                  )}
                </div>
              </div>

              {/* Bloque 3: Marca y Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Marca
                  </label>
                  <select
                    value={formData.marca_producto_id}
                    onChange={(e) => setFormData({ ...formData, marca_producto_id: e.target.value })}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">(Sin Marca / Genérico)</option>
                    {lookups.marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Proveedor Principal (Opcional)
                  </label>
                  <select
                    value={formData.proveedor_id}
                    onChange={(e) => setFormData({ ...formData, proveedor_id: e.target.value })}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">(Sin Proveedor)</option>
                    {lookups.proveedores.map((pr) => (
                      <option key={pr.proveedor_id} value={pr.proveedor_id}>
                        {pr.nombre_comercial} {pr.codigo_proveedor ? `(${pr.codigo_proveedor})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloque 4: Costo y Precios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Costo Actual (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costo_actual}
                    onChange={(e) => setFormData({ ...formData, costo_actual: e.target.value })}
                    placeholder="0.00"
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none ${
                      errors.costo_actual ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.costo_actual && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.costo_actual}</p>
                  )}
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Precio Venta (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.precio_venta}
                    onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                    placeholder="0.00"
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none ${
                      errors.precio_venta ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.precio_venta && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.precio_venta}</p>
                  )}
                </div>
              </div>

              {/* Bloque 5: Límites de Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock_minimo}
                    onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    placeholder="0"
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none ${
                      errors.stock_minimo ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.stock_minimo && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.stock_minimo}</p>
                  )}
                </div>

                <div>
                  <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                    Stock Máximo (Opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock_maximo}
                    onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value })}
                    placeholder="Sin límite"
                    className={`w-full bg-input border rounded-lg px-3 py-2 text-foreground focus:outline-none ${
                      errors.stock_maximo ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.stock_maximo && (
                    <p className="text-rose-400 text-[10px] mt-1 font-sans">{errors.stock_maximo}</p>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-foreground-secondary font-bold mb-1 font-sans">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Notas adicionales o especificaciones..."
                  className="w-full bg-input border border-border rounded-lg p-2.5 text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary resize-none font-sans"
                />
              </div>

              {/* Requiere Serial */}
              <div className="flex items-center gap-2 pt-1 font-sans">
                <input
                  type="checkbox"
                  id="modal-requiere-serial"
                  checked={formData.requiere_serial}
                  onChange={(e) => setFormData({ ...formData, requiere_serial: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="modal-requiere-serial" className="text-xs text-foreground cursor-pointer select-none font-medium">
                  El producto requiere número de serie individual
                </label>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2 shrink-0 font-sans">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || loadingLookups}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Guardar Producto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
