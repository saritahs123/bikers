"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  ChevronDown,
  AlertCircle
} from "lucide-react";

export default function WorkOrderProductsSection({
  stepNumber = 5,
  productsCatalog = [],
  productosList = [],
  onChange = () => {},
  readOnly = false
}) {
  const [productSearch, setProductSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [currentCantidad, setCurrentCantidad] = useState("1");
  const [currentPrecio, setCurrentPrecio] = useState("");
  const [editingTempId, setEditingTempId] = useState(null);
  const [draftErrors, setDraftErrors] = useState({ producto_id: "", cantidad: "", precio_unitario: "" });

  const comboboxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter catalog by search query
  const filteredProducts = useMemo(() => {
    if (!productSearch || !productSearch.trim()) {
      return productsCatalog.slice(0, 30);
    }
    const q = productSearch.toLowerCase().trim();
    return productsCatalog
      .filter((p) => {
        const nombre = (p.nombre || "").toLowerCase();
        const codigo = (p.codigo || p.codigo_producto || "").toLowerCase();
        const barra = (p.codigo_barra || "").toLowerCase();
        return nombre.includes(q) || codigo.includes(q) || barra.includes(q);
      })
      .slice(0, 30);
  }, [productsCatalog, productSearch]);

  const handleSelectProduct = (prod) => {
    if (!prod) return;
    setSelectedProduct(prod);
    setProductSearch("");
    setIsDropdownOpen(false);
    setActiveIdx(-1);

    // Auto-preload unit sale price from product
    const price = prod.precio_venta !== undefined && prod.precio_venta !== null
      ? parseFloat(String(prod.precio_venta)).toFixed(2)
      : "0.00";
    setCurrentPrecio(price);

    // Reset default quantity if empty or invalid
    if (!currentCantidad || parseFloat(currentCantidad) <= 0) {
      setCurrentCantidad("1");
    }

    setDraftErrors((prev) => ({ ...prev, producto_id: "" }));
  };

  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
    setProductSearch("");
    setCurrentPrecio("");
    setCurrentCantidad("1");
    setIsDropdownOpen(false);
    setEditingTempId(null);
    setDraftErrors({ producto_id: "", cantidad: "", precio_unitario: "" });
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < filteredProducts.length) {
        handleSelectProduct(filteredProducts[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const handleAddOrUpdateProduct = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const errs = { producto_id: "", cantidad: "", precio_unitario: "" };
    let hasError = false;

    if (!selectedProduct) {
      errs.producto_id = "Debe seleccionar un producto o repuesto.";
      hasError = true;
    }

    const cantNum = parseFloat(currentCantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      errs.cantidad = "La cantidad debe ser mayor a 0.";
      hasError = true;
    } else if (selectedProduct && !selectedProduct.permite_decimales && !Number.isInteger(cantNum)) {
      errs.cantidad = "Este producto solo permite cantidades enteras.";
      hasError = true;
    }

    const priceNum = parseFloat(currentPrecio);
    if (isNaN(priceNum) || priceNum < 0) {
      errs.precio_unitario = "El precio unitario no es válido.";
      hasError = true;
    }

    if (hasError) {
      setDraftErrors(errs);
      return;
    }

    const prodId = Number(selectedProduct.producto_id || selectedProduct.id);
    const prodCodigo = selectedProduct.codigo || selectedProduct.codigo_producto || `PROD-${prodId}`;
    const prodNombre = selectedProduct.nombre || "Producto";
    const subtotal = cantNum * priceNum;

    let updatedList;
    if (editingTempId) {
      // Update existing edited item
      updatedList = productosList.map((p) => {
        if (p.tempId === editingTempId) {
          return {
            ...p,
            producto_id: prodId,
            codigo: prodCodigo,
            codigo_producto: prodCodigo,
            nombre: prodNombre,
            cantidad: cantNum,
            precio_unitario: priceNum.toFixed(2),
            subtotal: subtotal.toFixed(2),
            unidad_medida: selectedProduct.unidad_medida || "UND",
            permite_decimales: Boolean(selectedProduct.permite_decimales),
            stock_disponible: selectedProduct.stock_disponible ?? null
          };
        }
        return p;
      });
    } else {
      // Check if product already exists in list -> accumulate quantity
      const existingIdx = productosList.findIndex((p) => Number(p.producto_id) === prodId);
      if (existingIdx >= 0) {
        const existing = productosList[existingIdx];
        const newQty = Number(existing.cantidad) + cantNum;
        const newSubtotal = newQty * Number(existing.precio_unitario);
        updatedList = productosList.map((p, idx) =>
          idx === existingIdx
            ? {
                ...p,
                cantidad: newQty,
                subtotal: newSubtotal.toFixed(2)
              }
            : p
        );
      } else {
        const newItem = {
          tempId: "prod_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          producto_id: prodId,
          codigo: prodCodigo,
          codigo_producto: prodCodigo,
          nombre: prodNombre,
          cantidad: cantNum,
          precio_unitario: priceNum.toFixed(2),
          subtotal: subtotal.toFixed(2),
          unidad_medida: selectedProduct.unidad_medida || "UND",
          permite_decimales: Boolean(selectedProduct.permite_decimales),
          stock_disponible: selectedProduct.stock_disponible ?? null
        };
        updatedList = [...productosList, newItem];
      }
    }

    onChange(updatedList);

    // Reset sub-form
    setSelectedProduct(null);
    setProductSearch("");
    setCurrentCantidad("1");
    setCurrentPrecio("");
    setEditingTempId(null);
    setDraftErrors({ producto_id: "", cantidad: "", precio_unitario: "" });
  };

  const handleEditProductClick = (item) => {
    setEditingTempId(item.tempId);
    const prodObj = productsCatalog.find((p) => Number(p.producto_id || p.id) === Number(item.producto_id)) || {
      producto_id: item.producto_id,
      codigo: item.codigo,
      nombre: item.nombre,
      precio_venta: item.precio_unitario,
      unidad_medida: item.unidad_medida,
      permite_decimales: item.permite_decimales,
      stock_disponible: item.stock_disponible
    };
    setSelectedProduct(prodObj);
    setCurrentCantidad(String(item.cantidad));
    setCurrentPrecio(String(item.precio_unitario));
    setDraftErrors({ producto_id: "", cantidad: "", precio_unitario: "" });
  };

  const handleDeleteProductClick = (tempId) => {
    const updated = productosList.filter((p) => p.tempId !== tempId);
    onChange(updated);
    if (editingTempId === tempId) {
      handleClearSelectedProduct();
    }
  };

  const totalProductos = useMemo(() => {
    return productosList.reduce((acc, p) => acc + (Number(p.subtotal) || 0), 0);
  }, [productosList]);

  return (
    <div className="space-y-2.5 pt-1.5 border-t border-border-subtle">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground-secondary block">
          {stepNumber}. Productos a Utilizar
        </label>
        {totalProductos > 0 && (
          <span className="text-xs font-mono text-primary font-bold">
            Subtotal Repuestos: RD$ {totalProductos.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="p-2.5 sm:p-3 bg-surface border border-border rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-foreground-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Package size={13} className="text-primary" />
              <span>{editingTempId ? "Editar Producto Seleccionado" : "Agregar Producto"}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Producto Combobox Selector */}
            <div className="sm:col-span-6">
              <label className="block text-[10px] sm:text-[11px] text-foreground-muted mb-0.5 font-semibold">
                Producto / Repuesto <span className="text-error">*</span>
              </label>

              {!selectedProduct ? (
                <div className="relative" ref={comboboxRef}>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setIsDropdownOpen(true);
                        setActiveIdx(-1);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={handleKeyDown}
                      placeholder="Buscar por código o nombre de producto..."
                      className={`w-full pl-8.5 pr-8 py-1.5 sm:py-2 bg-card border rounded-xl text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary transition-all font-mono ${
                        draftErrors.producto_id ? "border-error focus:border-error" : "border-border"
                      }`}
                    />
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-center text-foreground-muted text-xs">
                          Sin coincidencias encontradas
                        </div>
                      ) : (
                        filteredProducts.map((prod, idx) => (
                          <div
                            key={prod.producto_id || prod.id}
                            onClick={() => handleSelectProduct(prod)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer border-b border-border-subtle last:border-0 transition-colors gap-2.5 ${
                              activeIdx === idx ? "bg-hover text-foreground" : "hover:bg-hover"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-primary shrink-0">
                                <Package size={13} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-foreground text-xs leading-snug break-words">
                                  {prod.nombre}
                                </p>
                                <p className="text-[10px] text-foreground-muted truncate">
                                  {prod.codigo || prod.codigo_producto} · Disponible: {Number(prod.stock_disponible || 0)} {prod.unidad_medida || "UND"}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-primary font-mono shrink-0 whitespace-nowrap ml-2">
                              RD$ {Number(prod.precio_venta || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-1.5 sm:p-2 bg-card border border-border rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-primary-muted border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0 font-mono">
                      <Package size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground text-xs leading-snug break-words">
                        {selectedProduct.nombre}
                      </p>
                      <p className="text-[10px] text-foreground-muted font-mono truncate">
                        {selectedProduct.codigo || selectedProduct.codigo_producto} · Stock: {Number(selectedProduct.stock_disponible || 0)} {selectedProduct.unidad_medida || "UND"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedProduct}
                    className="p-1 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                    title="Cambiar producto"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {draftErrors.producto_id && (
                <p className="text-error text-[10px] mt-0.5">{draftErrors.producto_id}</p>
              )}
            </div>

            {/* Cantidad */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] sm:text-[11px] text-foreground-muted mb-0.5 font-semibold">
                Cantidad <span className="text-error">*</span>
              </label>
              <input
                type="number"
                step={selectedProduct?.permite_decimales ? "0.01" : "1"}
                min="0.01"
                value={currentCantidad}
                onChange={(e) => {
                  setCurrentCantidad(e.target.value);
                  setDraftErrors((prev) => ({ ...prev, cantidad: "" }));
                }}
                placeholder="1"
                className={`w-full py-1.5 px-2 bg-card border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary font-mono ${
                  draftErrors.cantidad ? "border-error focus:border-error" : "border-border"
                }`}
              />
              {draftErrors.cantidad && (
                <p className="text-error text-[10px] mt-0.5">{draftErrors.cantidad}</p>
              )}
            </div>

            {/* Precio Unitario */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] sm:text-[11px] text-foreground-muted mb-0.5 font-semibold">
                Precio Unitario (RD$) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentPrecio}
                onChange={(e) => {
                  setCurrentPrecio(e.target.value);
                  setDraftErrors((prev) => ({ ...prev, precio_unitario: "" }));
                }}
                placeholder="0.00"
                className={`w-full py-1.5 px-2 bg-card border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary font-mono ${
                  draftErrors.precio_unitario ? "border-error focus:border-error" : "border-border"
                }`}
              />
              {draftErrors.precio_unitario && (
                <p className="text-error text-[10px] mt-0.5">{draftErrors.precio_unitario}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            {editingTempId && (
              <button
                type="button"
                onClick={handleClearSelectedProduct}
                className="px-2.5 py-1.5 text-xs text-foreground-muted hover:text-foreground cursor-pointer font-mono"
              >
                Cancelar Edición
              </button>
            )}
            <button
              type="button"
              onClick={handleAddOrUpdateProduct}
              className="px-3.5 py-1.5 bg-primary-button-bg text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary-button-hover transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm font-mono"
            >
              <Plus size={13} />
              <span>{editingTempId ? "Actualizar Producto" : "+ Agregar Producto"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Lista de Productos Agregados */}
      {productosList.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] sm:text-[11px] font-bold text-foreground-secondary uppercase tracking-wider font-mono">
            Productos Agregados ({productosList.length})
          </p>
          <div className="space-y-1.5">
            {productosList.map((prod) => (
              <div
                key={prod.tempId}
                className="p-2 sm:p-2.5 bg-card border border-primary/20 rounded-xl flex items-center justify-between gap-2.5 text-xs shadow-sm hover:border-primary/40 transition-all font-mono"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-primary-muted border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0">
                    <Package size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate text-xs">{prod.nombre}</p>
                    <p className="text-[10px] text-foreground-muted truncate">
                      {prod.cantidad} {prod.unidad_medida || "UND"} × RD$ {Number(prod.precio_unitario || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-primary text-xs whitespace-nowrap">
                    RD$ {Number(prod.subtotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-1 border-l border-border pl-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditProductClick(prod)}
                        className="p-1 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors cursor-pointer"
                        title="Editar producto"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProductClick(prod.tempId)}
                        className="p-1 text-foreground-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
