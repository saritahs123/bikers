"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  ExternalLink,
  RotateCcw,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Warehouse,
  Building2,
  Search,
  ChevronDown,
  Info,
  MoreVertical,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export default function InventoryEntriesView() {
  // Catalogs state
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ultimasEntradas, setUltimasEntradas] = useState([]);
  const [errorEntradas, setErrorEntradas] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [almacenId, setAlmacenId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");

  // Product search filter
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Alerts / Notifications
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message, details }

  // Load catalogs
  const loadCatalogos = useCallback(async () => {
    try {
      setLoadingCatalogos(true);
      const res = await fetch("/api/inventario/catalogos");
      if (!res.ok) throw new Error("Error al cargar catálogos");
      const data = await res.json();
      setAlmacenes(data.almacenes || []);
      setProductos(data.productos || []);

      if ((data.almacenes || []).length > 0 && !almacenId) {
        setAlmacenId(String(data.almacenes[0].almacen_id));
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: "No se pudieron cargar los catálogos de inventario.",
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [almacenId]);

  // Load recent entries (differentiating error from empty)
  const loadUltimasEntradas = useCallback(async () => {
    try {
      setLoadingEntradas(true);
      setErrorEntradas(null);
      const res = await fetch("/api/inventario/entradas?limit=5");
      if (res.ok) {
        const data = await res.json();
        setUltimasEntradas(data.entradas || []);
        setErrorEntradas(null);
      } else {
        setUltimasEntradas([]);
        setErrorEntradas("No se pudieron cargar las últimas entradas.");
      }
    } catch (err) {
      console.warn("Error al cargar últimas entradas:", err);
      setUltimasEntradas([]);
      setErrorEntradas("No se pudieron cargar las últimas entradas.");
    } finally {
      setLoadingEntradas(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogos();
    loadUltimasEntradas();
  }, [loadCatalogos, loadUltimasEntradas]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Available suppliers for selected product (admin.producto_proveedor)
  const productSuppliers = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.proveedores || [];
  }, [selectedProduct]);

  // Selected existence for chosen warehouse
  const selectedStockInfo = useMemo(() => {
    if (!selectedProduct || !almacenId) {
      return { actual: 0, reservado: 0, disponible: 0, costoPromedio: selectedProduct?.costo_actual || 0 };
    }
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenId)
    );
    return {
      actual: ex ? ex.cantidad_actual : 0,
      reservado: ex ? ex.cantidad_reservada : 0,
      disponible: ex ? ex.cantidad_disponible : 0,
      costoPromedio: ex ? ex.costo_promedio : (selectedProduct.costo_actual || 0),
    };
  }, [selectedProduct, almacenId]);

  // Handle product selection: auto-suggest primary supplier & purchase cost
  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);

    const sups = prod.proveedores || [];
    if (sups.length > 0) {
      const primary = sups.find((s) => s.proveedor_principal) || sups[0];
      setProveedorId(String(primary.proveedor_id));
      if (primary.costo_compra > 0) {
        setCostoUnitario(String(primary.costo_compra));
      } else if (prod.costo_actual > 0) {
        setCostoUnitario(String(prod.costo_actual));
      } else {
        setCostoUnitario("");
      }
    } else {
      setProveedorId("");
      if (prod.costo_actual > 0) {
        setCostoUnitario(String(prod.costo_actual));
      } else {
        setCostoUnitario("");
      }
    }
  };

  // When supplier changes, suggest cost if configured
  const handleSupplierChange = (e) => {
    const newSupId = e.target.value;
    setProveedorId(newSupId);
    if (selectedProduct && newSupId) {
      const match = (selectedProduct.proveedores || []).find(
        (s) => String(s.proveedor_id) === String(newSupId)
      );
      if (match && match.costo_compra > 0) {
        setCostoUnitario(String(match.costo_compra));
      }
    }
  };

  // Calculations for summary card
  const cantidadNum = parseFloat(cantidad) || 0;
  const costoUnitarioNum = parseFloat(costoUnitario) || 0;
  const costoTotal = cantidadNum * costoUnitarioNum;
  const stockActual = selectedStockInfo.actual;
  const stockProyectado = stockActual + cantidadNum;

  // Projected PMP estimate
  const pmpProyectado = useMemo(() => {
    if (stockActual <= 0 || selectedStockInfo.costoPromedio <= 0) {
      return costoUnitarioNum > 0 ? costoUnitarioNum : selectedStockInfo.costoPromedio;
    }
    if (cantidadNum <= 0 || costoUnitarioNum <= 0) {
      return selectedStockInfo.costoPromedio;
    }
    const valAnt = stockActual * selectedStockInfo.costoPromedio;
    const valEnt = cantidadNum * costoUnitarioNum;
    return (valAnt + valEnt) / (stockActual + cantidadNum);
  }, [stockActual, selectedStockInfo.costoPromedio, cantidadNum, costoUnitarioNum]);

  // Reset form
  const handleReset = () => {
    setProductoId("");
    setProductSearch("");
    setProveedorId("");
    setCantidad("");
    setCostoUnitario("");
    setReferencia("");
    setObservacion("");
    setFeedback(null);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona un almacén." });
      return;
    }
    if (!productoId) {
      setFeedback({ type: "error", message: "Selecciona un producto para la entrada." });
      return;
    }
    if (!proveedorId) {
      setFeedback({
        type: "error",
        message: "Debes seleccionar un proveedor asociado al producto.",
      });
      return;
    }
    if (cantidadNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad a ingresar debe ser mayor a 0." });
      return;
    }
    if (costoUnitarioNum < 0) {
      setFeedback({ type: "error", message: "El costo unitario no puede ser negativo." });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `ENT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/inventario/entradas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          almacenId: Number(almacenId),
          proveedorId: Number(proveedorId),
          productoId: Number(productoId),
          cantidad: cantidadNum,
          costoUnitario: costoUnitarioNum,
          referencia: referencia.trim() || null,
          observacion: observacion.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al registrar la entrada");
      }

      setFeedback({
        type: "success",
        message: `Entrada registrada exitosamente. Nuevo stock: ${data.movimiento.stockNuevo} ${selectedProduct?.unidad_medida?.codigo || "UND"}.`,
      });

      // Reload catalogs and entries
      await loadCatalogos();
      await loadUltimasEntradas();

      // Reset fields but keep warehouse
      setProductoId("");
      setProductSearch("");
      setProveedorId("");
      setCantidad("");
      setCostoUnitario("");
      setReferencia("");
      setObservacion("");
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al registrar la entrada.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productos.slice(0, 20);
    const q = productSearch.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_producto?.toLowerCase().includes(q) ||
        p.nombre?.toLowerCase().includes(q) ||
        p.marca_nombre?.toLowerCase().includes(q) ||
        p.codigo_barra?.toLowerCase().includes(q)
    );
  }, [productos, productSearch]);

  return (
    <div className="space-y-6">
      {/* 1. Header Superior & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-1">
            <Link href="/inventory/summary" className="hover:text-foreground transition-colors">
              Inventario
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-medium">Entradas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Entradas de Inventario
              </h1>
              <p className="text-xs md:text-sm text-foreground-muted">
                Registra la mercancía que ingresa al inventario por compras u otras operaciones.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inventory/movements"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground-secondary hover:text-foreground border border-border transition-all shadow-xs"
          >
            <Clock className="w-4 h-4 text-foreground-muted" />
            <span>Ver movimientos</span>
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all ${
            feedback.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-success mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-error mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Cuerpo Principal: 2 Columnas (Formulario + Resumen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card Izquierda: Formulario (65%) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm relative">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-5">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Registrar Entrada por Compra
              </h2>
              <p className="text-xs text-foreground-muted">
                Completa los datos de la entrada de inventario.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fila 1: Almacén y Proveedor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Almacén <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenId}
                    onChange={(e) => setAlmacenId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {almacenes.map((a) => (
                      <option key={a.almacen_id} value={a.almacen_id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Proveedor <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={proveedorId}
                    onChange={handleSupplierChange}
                    disabled={!selectedProduct || productSuppliers.length === 0}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {!selectedProduct ? (
                      <option value="">Selecciona un producto primero...</option>
                    ) : productSuppliers.length === 0 ? (
                      <option value="">Sin proveedores asociados</option>
                    ) : (
                      <>
                        <option value="">Seleccionar proveedor...</option>
                        {productSuppliers.map((s) => (
                          <option key={s.proveedor_id} value={s.proveedor_id}>
                            {s.codigo_proveedor} - {s.nombre_comercial}{" "}
                            {s.proveedor_principal ? "(Principal)" : ""}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Fila 2: Selector de Producto con búsqueda */}
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                Producto <span className="text-error">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => setProductDropdownOpen(true)}
                  placeholder="Buscar producto por código, nombre o marca..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Dropdown de productos */}
                {productDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-xl divide-y divide-border">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-xs text-foreground-muted text-center">
                        No se encontraron productos coincidentes.
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <div
                          key={p.producto_id}
                          onClick={() => handleSelectProduct(p)}
                          className="p-2.5 hover:bg-surface-subtle/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-foreground mr-2">
                              {p.codigo_producto}
                            </span>
                            <span className="text-foreground-secondary">{p.nombre}</span>
                            <div className="text-[11px] text-foreground-muted">
                              {p.marca_nombre || "Genérico"} | {p.categoria_nombre || "General"}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-foreground-muted">
                            PMP: RD${" "}
                            {p.costo_actual ? Number(p.costo_actual).toFixed(2) : "0.00"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta de Producto Seleccionado */}
            {selectedProduct && (
              <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedProduct.imagen_url ? (
                      <img
                        src={selectedProduct.imagen_url}
                        alt={selectedProduct.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-foreground-muted" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tracking-wide">
                      {selectedProduct.codigo_producto}
                    </p>
                    <p className="text-foreground-secondary text-xs font-medium">
                      {selectedProduct.nombre}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {selectedProduct.marca_nombre || "Sin marca"} |{" "}
                      {selectedProduct.categoria_nombre || "General"} | Unidad:{" "}
                      <span className="text-foreground font-medium">
                        {selectedProduct.unidad_medida?.codigo || "UND"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-6">
                  <div>
                    <span className="text-[11px] text-foreground-muted block">
                      Stock actual (en almacén)
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedStockInfo.actual}{" "}
                      <span className="text-xs font-normal text-foreground-muted">
                        {selectedProduct.unidad_medida?.codigo || "UND"}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-foreground-muted block">
                      Costo promedio actual
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      RD$ {selectedStockInfo.costoPromedio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso si el producto no tiene proveedores asociados */}
            {selectedProduct && productSuppliers.length === 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <span>Este producto no tiene proveedores asociados.</span>
                </div>
                <Link
                  href="/inventory/suppliers"
                  className="text-warning hover:underline font-medium flex items-center gap-1"
                >
                  <span>Configurar proveedores</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Fila 3: Cantidad y Costo Unitario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Cantidad <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step={selectedProduct?.unidad_medida?.permite_decimales ? "0.01" : "1"}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none">
                    {selectedProduct?.unidad_medida?.codigo || "UND"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Costo unitario <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none font-semibold">
                    RD$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Fila 4: Referencia / Documento & Observación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Referencia / Documento
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej. FAC-001234"
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground-secondary">
                    Observación
                  </label>
                  <span className="text-[10px] text-foreground-muted">
                    {observacion.length}/200
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Compra a proveedor..."
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleReset}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground-secondary hover:text-foreground border border-border transition-all disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              <button
                type="submit"
                disabled={submitting || !selectedProduct || productSuppliers.length === 0}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{submitting ? "Registrando..." : "Registrar Entrada"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Card Derecha: Resumen de la Operación (35%) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-border mb-5">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Resumen de la Operación
                </h2>
                <p className="text-xs text-foreground-muted">
                  Vista previa del impacto en el inventario.
                </p>
              </div>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                {/* Mini card producto */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                  <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedProduct.imagen_url ? (
                      <img
                        src={selectedProduct.imagen_url}
                        alt={selectedProduct.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-foreground-muted" />
                    )}
                  </div>
                  <div className="truncate">
                    <span className="text-[11px] font-bold text-primary font-mono block">
                      {selectedProduct.codigo_producto}
                    </span>
                    <p className="text-xs font-medium text-foreground truncate">
                      {selectedProduct.nombre}
                    </p>
                    <p className="text-[10px] text-foreground-muted">
                      {selectedProduct.marca_nombre || "Marca"} |{" "}
                      {selectedProduct.categoria_nombre || "Categoría"}
                    </p>
                  </div>
                </div>

                {/* Métricas de Stock */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-foreground-secondary">
                    <span>Stock actual</span>
                    <span className="font-semibold text-foreground">
                      {stockActual} {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-success">
                    <span>Cantidad a ingresar</span>
                    <span className="font-semibold">
                      + {cantidadNum} {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-foreground font-bold pt-1 border-t border-border">
                    <span>Stock proyectado</span>
                    <span className="text-sm text-success">
                      {stockProyectado} {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border my-3" />

                {/* Métricas de Costo */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-foreground-secondary">
                    <span>Costo unitario</span>
                    <span className="font-semibold text-foreground">
                      RD$ {costoUnitarioNum.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-foreground font-bold pt-1 border-t border-border">
                    <span>Costo total de la entrada</span>
                    <span className="text-sm text-foreground">
                      RD$ {costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border my-3" />

                {/* Métricas de PMP */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-foreground-secondary">
                    <span>PMP actual</span>
                    <span className="font-semibold text-foreground">
                      RD$ {selectedStockInfo.costoPromedio.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-primary font-semibold pt-1 border-t border-border">
                    <span className="flex items-center gap-1">
                      <span>PMP proyectado (estimado)</span>
                      <Info className="w-3.5 h-3.5 text-foreground-muted" />
                    </span>
                    <span className="text-sm font-bold">
                      RD$ {pmpProyectado.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-foreground-muted text-xs">
                Selecciona un producto para visualizar el resumen proyectado de la operación.
              </div>
            )}
          </div>

          {/* Nota informativa inferior */}
          <div className="mt-6 p-3 rounded-xl bg-surface border border-border text-[11px] text-foreground-muted flex items-start gap-2">
            <Info className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
            <span>
              El PMP proyectado es solo informativo. El cálculo definitivo se realiza en el servidor.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sección Inferior: Tabla "Últimas Entradas" con Estados Diferenciados */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Últimas Entradas
              </h3>
              <p className="text-[11px] text-foreground-muted">
                Las 5 entradas más recientes registradas en el sistema.
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements?tipo=ENT_COMPRA"
            className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            <span>Ver todas</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-foreground-muted font-semibold">
                <th className="py-2.5 px-3 font-medium">Fecha</th>
                <th className="py-2.5 px-3 font-medium">Producto</th>
                <th className="py-2.5 px-3 font-medium">Almacén</th>
                <th className="py-2.5 px-3 font-medium text-right">Cantidad</th>
                <th className="py-2.5 px-3 font-medium text-right">Costo Unitario</th>
                <th className="py-2.5 px-3 font-medium text-right">Costo Total</th>
                <th className="py-2.5 px-3 font-medium">Referencia</th>
                <th className="py-2.5 px-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingEntradas ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-foreground-muted text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Cargando entradas recientes...</span>
                    </div>
                  </td>
                </tr>
              ) : errorEntradas ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 text-error">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errorEntradas}</span>
                      </div>
                      <button
                        type="button"
                        onClick={loadUltimasEntradas}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground bg-surface hover:bg-hover border border-border rounded-md shadow-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : ultimasEntradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-foreground-muted text-xs">
                    No se registran entradas recientes en el sistema.
                  </td>
                </tr>
              ) : (
                ultimasEntradas.map((ent) => (
                  <tr key={ent.id} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="py-3 px-3 text-foreground-muted whitespace-nowrap">
                      {new Date(ent.fecha).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">
                      <span className="text-primary font-mono font-semibold mr-1.5">
                        {ent.productoCodigo}
                      </span>
                      <span className="text-foreground-secondary">{ent.productoNombre}</span>
                    </td>
                    <td className="py-3 px-3 text-foreground-secondary">{ent.almacenNombre}</td>
                    <td className="py-3 px-3 text-right font-semibold text-success">
                      + {ent.cantidad}
                    </td>
                    <td className="py-3 px-3 text-right text-foreground-muted">
                      RD$ {ent.costoUnitario.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-foreground">
                      RD$ {ent.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-foreground-muted">{ent.referencia}</td>
                    <td className="py-3 px-3 text-foreground-muted">{ent.usuario}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
