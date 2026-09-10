"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ArrowRightLeft,
  ArrowRight,
  TrendingUp,
  Clock,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Warehouse,
  Search,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  RefreshCw,
} from "lucide-react";

export default function InventoryTransfersView() {
  // Catalogs
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [errorTransferencias, setErrorTransferencias] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [almacenOrigenId, setAlmacenOrigenId] = useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");

  // Product search dropdown
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState(null);

  // Clock
  const [currentDateTime, setCurrentDateTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-DO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("es-DO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      setCurrentDateTime(`${capitalized} | ${timeStr} | America/Santo Domingo`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load catalogs
  const loadCatalogos = useCallback(async () => {
    try {
      setLoadingCatalogos(true);
      const res = await fetch("/api/inventario/catalogos");
      if (!res.ok) throw new Error("Error al cargar catálogos");
      const data = await res.json();
      const alms = data.almacenes || [];
      setAlmacenes(alms);
      setProductos(data.productos || []);

      if (alms.length >= 2) {
        if (!almacenOrigenId) setAlmacenOrigenId(String(alms[0].almacen_id));
        if (!almacenDestinoId) setAlmacenDestinoId(String(alms[1].almacen_id));
      } else if (alms.length === 1) {
        if (!almacenOrigenId) setAlmacenOrigenId(String(alms[0].almacen_id));
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "No se pudieron cargar los catálogos." });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [almacenOrigenId, almacenDestinoId]);

  // Load recent transfers (differentiating error from empty)
  const loadTransferencias = useCallback(async () => {
    try {
      setLoadingTransferencias(true);
      setErrorTransferencias(null);
      const res = await fetch("/api/inventario/transferencias?limit=5");
      if (res.ok) {
        const data = await res.json();
        setTransferencias(data.transferencias || []);
        setErrorTransferencias(null);
      } else {
        setTransferencias([]);
        setErrorTransferencias("No se pudieron cargar las transferencias recientes.");
      }
    } catch (err) {
      console.warn("Error al consultar transferencias:", err);
      setTransferencias([]);
      setErrorTransferencias("No se pudieron cargar las transferencias recientes.");
    } finally {
      setLoadingTransferencias(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogos();
    loadTransferencias();
  }, [loadCatalogos, loadTransferencias]);

  // Swap warehouses
  const handleSwapWarehouses = () => {
    const temp = almacenOrigenId;
    setAlmacenOrigenId(almacenDestinoId);
    setAlmacenDestinoId(temp);
  };

  // Selected product
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Warehouses objects
  const almOrigenObj = useMemo(() => {
    return almacenes.find((a) => String(a.almacen_id) === String(almacenOrigenId)) || null;
  }, [almacenes, almacenOrigenId]);

  const almDestinoObj = useMemo(() => {
    return almacenes.find((a) => String(a.almacen_id) === String(almacenDestinoId)) || null;
  }, [almacenes, almacenDestinoId]);

  // Stock in origin and destination
  const stockOrigen = useMemo(() => {
    if (!selectedProduct || !almacenOrigenId) return { actual: 0, reservado: 0, disponible: 0 };
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenOrigenId)
    );
    const act = ex ? Number(ex.cantidad_actual) : 0;
    const res = ex ? Number(ex.cantidad_reservada) : 0;
    return { actual: act, reservado: res, disponible: act - res };
  }, [selectedProduct, almacenOrigenId]);

  const stockDestino = useMemo(() => {
    if (!selectedProduct || !almacenDestinoId) return { actual: 0, reservado: 0, disponible: 0 };
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenDestinoId)
    );
    const act = ex ? Number(ex.cantidad_actual) : 0;
    const res = ex ? Number(ex.cantidad_reservada) : 0;
    return { actual: act, reservado: res, disponible: act - res };
  }, [selectedProduct, almacenDestinoId]);

  // Calculations
  const cantidadNum = parseFloat(cantidad) || 0;
  const stockExcedido = cantidadNum > stockOrigen.disponible;

  const stockOrigenDespues = stockOrigen.actual - cantidadNum;
  const stockDestinoDespues = stockDestino.actual + cantidadNum;

  // Select product
  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);
  };

  // Reset form
  const handleReset = () => {
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setReferencia("");
    setObservacion("");
    setFeedback(null);
  };

  // Submit transfer
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!almacenOrigenId || !almacenDestinoId) {
      setFeedback({ type: "error", message: "Selecciona los almacenes de origen y destino." });
      return;
    }
    if (almacenOrigenId === almacenDestinoId) {
      setFeedback({
        type: "error",
        message: "El almacén de origen y destino deben ser diferentes.",
      });
      return;
    }
    if (!productoId) {
      setFeedback({ type: "error", message: "Selecciona un producto para transferir." });
      return;
    }
    if (cantidadNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad a transferir debe ser mayor a 0." });
      return;
    }
    if (stockExcedido) {
      setFeedback({
        type: "error",
        message: `La cantidad a transferir (${cantidadNum}) supera el stock disponible en origen (${stockOrigen.disponible}).`,
      });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/inventario/transferencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          almacenOrigenId: Number(almacenOrigenId),
          almacenDestinoId: Number(almacenDestinoId),
          productoId: Number(productoId),
          cantidad: cantidadNum,
          referencia: referencia.trim() || null,
          observacion: observacion.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar la transferencia");
      }

      setFeedback({
        type: "success",
        message: `Transferencia procesada atómicamente. Origen ahora tiene: ${stockOrigenDespues}, Destino: ${stockDestinoDespues}.`,
      });

      await loadCatalogos();
      await loadTransferencias();

      setProductoId("");
      setProductSearch("");
      setCantidad("");
      setReferencia("");
      setObservacion("");
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al realizar la transferencia.",
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
        p.marca_nombre?.toLowerCase().includes(q)
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
            <span className="text-foreground font-medium">Transferencias</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ArrowRightLeft className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Transferencias de Inventario
              </h1>
              <p className="text-xs md:text-sm text-foreground-muted">
                Mueve productos entre almacenes de la misma empresa
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-right">
          <div className="text-[11px] text-foreground-muted hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end">
              <Calendar className="w-3.5 h-3.5 text-foreground-muted" />
              <span>{currentDateTime}</span>
            </div>
          </div>
          <Link
            href="/inventory/movements"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground-secondary hover:text-foreground border border-border transition-all shadow-xs"
          >
            <span>Ver movimientos</span>
            <ArrowRight className="w-3.5 h-3.5 text-foreground-muted" />
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
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 2. Cuerpo Principal: 2 Columnas (Formulario + Resumen Gemelo) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Formulario (65%) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Registrar Transferencia</h2>
              <p className="text-xs text-foreground-muted">
                Transfiere productos entre almacenes de la empresa.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fila 1: Origen <-> Destino con botón Swap central */}
            <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
              {/* Almacén Origen */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Almacén Origen <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenOrigenId}
                    onChange={(e) => setAlmacenOrigenId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {almacenes.map((a) => (
                      <option key={a.almacen_id} value={a.almacen_id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedProduct && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Stock disponible:{" "}
                      <strong className="text-foreground">{stockOrigen.disponible}</strong>{" "}
                      {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>
                )}
              </div>

              {/* Botón Swap en el centro */}
              <div className="sm:col-span-1 flex justify-center pt-2 sm:pt-6">
                <button
                  type="button"
                  onClick={handleSwapWarehouses}
                  title="Intercambiar almacenes"
                  className="p-2 rounded-lg bg-surface hover:bg-hover text-foreground-secondary hover:text-foreground border border-border transition-all shadow-xs cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Almacén Destino */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Almacén Destino <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenDestinoId}
                    onChange={(e) => setAlmacenDestinoId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {almacenes.map((a) => (
                      <option key={a.almacen_id} value={a.almacen_id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedProduct && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Stock disponible:{" "}
                      <strong className="text-foreground">{stockDestino.disponible}</strong>{" "}
                      {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Fila 2: Producto */}
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
                  placeholder="Buscar producto por código o nombre..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {productDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl divide-y divide-border">
                    {filteredProducts.map((p) => (
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
                        </div>
                        <div className="text-[11px] text-foreground-muted">
                          {p.marca_nombre || "General"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info de stock bajo producto */}
              {selectedProduct && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-primary">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Unidad: {selectedProduct.unidad_medida?.codigo || "UND"} | Stock en origen:{" "}
                    <strong className="text-foreground">{stockOrigen.actual}</strong> | Stock en destino:{" "}
                    <strong className="text-foreground">{stockDestino.actual}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Fila 3: Cantidad y Stock Proyectado Gemelo */}
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
                    className={`w-full px-3.5 py-2.5 text-xs bg-input border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none transition-colors ${
                      stockExcedido
                        ? "border-error focus:border-error"
                        : "border-border focus:border-primary"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none">
                    {selectedProduct?.unidad_medida?.codigo || "Unidades"}
                  </span>
                </div>
                {stockExcedido && (
                  <p className="mt-1 text-[11px] text-error font-medium">
                    Supera el stock disponible en origen ({stockOrigen.disponible}).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Stock proyectado
                </label>
                <div className="px-3.5 py-2 text-xs bg-surface border border-border rounded-lg grid grid-cols-2 gap-2">
                  <div className="border-r border-border pr-2">
                    <span className="text-[10px] text-foreground-muted block">Origen:</span>
                    <span className="font-mono text-foreground-secondary">
                      {stockOrigen.actual} →{" "}
                      <strong
                        className={`${
                          stockOrigenDespues < 0 ? "text-error" : "text-error font-bold"
                        }`}
                      >
                        {stockOrigenDespues}
                      </strong>
                    </span>
                  </div>
                  <div className="pl-1">
                    <span className="text-[10px] text-foreground-muted block">Destino:</span>
                    <span className="font-mono text-foreground-secondary">
                      {stockDestino.actual} →{" "}
                      <strong className="text-success font-bold">
                        {stockDestinoDespues}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fila 4: Referencia y Observación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="TRF-2025-003"
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground-secondary">
                    Observación (opcional)
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
                  placeholder="Transferencia por redistribución..."
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Botones */}
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
                disabled={
                  submitting ||
                  !selectedProduct ||
                  stockExcedido ||
                  !almacenOrigenId ||
                  !almacenDestinoId ||
                  almacenOrigenId === almacenDestinoId
                }
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{submitting ? "Transfiriendo..." : "Registrar Transferencia"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Panel de Resumen Gemelo (35%) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-border mb-5">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Resumen de la Transferencia
                </h2>
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
                    <p className="text-xs font-semibold text-foreground truncate">
                      {selectedProduct.nombre}
                    </p>
                    <span className="text-[11px] text-foreground-muted font-mono block">
                      {selectedProduct.codigo_producto}
                    </span>
                    <p className="text-[10px] text-foreground-muted">
                      Unidad: {selectedProduct.unidad_medida?.codigo || "UND"}
                    </p>
                  </div>
                </div>

                {/* Dos Cards Gemelas: Origen y Destino */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card Origen */}
                  <div className="p-3 rounded-xl bg-surface border border-border space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-error font-semibold border-b border-border pb-1.5">
                      <Warehouse className="w-3.5 h-3.5" />
                      <span className="truncate">Almacén Origen</span>
                    </div>
                    <p className="text-[11px] text-foreground font-medium truncate">
                      {almOrigenObj?.nombre || "Origen"}
                    </p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-foreground-muted">
                        <span>Stock actual:</span>
                        <span className="text-foreground font-medium">{stockOrigen.actual}</span>
                      </div>
                      <div className="flex justify-between text-error font-medium">
                        <span>Cantidad a transferir:</span>
                        <span>- {cantidadNum}</span>
                      </div>
                      <div className="flex justify-between text-foreground font-bold border-t border-border pt-1">
                        <span>Stock después:</span>
                        <span className="text-error">{stockOrigenDespues}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Destino */}
                  <div className="p-3 rounded-xl bg-surface border border-border space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-success font-semibold border-b border-border pb-1.5">
                      <Warehouse className="w-3.5 h-3.5" />
                      <span className="truncate">Almacén Destino</span>
                    </div>
                    <p className="text-[11px] text-foreground font-medium truncate">
                      {almDestinoObj?.nombre || "Destino"}
                    </p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-foreground-muted">
                        <span>Stock actual:</span>
                        <span className="text-foreground font-medium">{stockDestino.actual}</span>
                      </div>
                      <div className="flex justify-between text-success font-medium">
                        <span>Cantidad a recibir:</span>
                        <span>+ {cantidadNum}</span>
                      </div>
                      <div className="flex justify-between text-foreground font-bold border-t border-border pt-1">
                        <span>Stock después:</span>
                        <span className="text-success">{stockDestinoDespues}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-foreground-muted text-xs">
                Selecciona un producto para visualizar el impacto de la transferencia.
              </div>
            )}
          </div>

          {/* Bloque informativo inferior sobre atomicidad */}
          <div className="mt-6 p-3.5 rounded-xl bg-surface border border-border text-[11px] text-foreground-muted flex items-start gap-2.5">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span>
              La transferencia se ejecuta en una sola transacción atómica. Si falla algún almacén, ningún stock se altera.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sección Inferior: Tabla "Últimas Transferencias" con Estados Diferenciados */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Últimas Transferencias
              </h3>
              <p className="text-[11px] text-foreground-muted">
                Mostrando las 5 transferencias más recientes
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements?tipo=TRAS_SAL"
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
                <th className="py-2.5 px-3 font-medium">Origen</th>
                <th className="py-2.5 px-3 font-medium">Destino</th>
                <th className="py-2.5 px-3 font-medium text-right">Cantidad</th>
                <th className="py-2.5 px-3 font-medium">Referencia</th>
                <th className="py-2.5 px-3 font-medium">UUID</th>
                <th className="py-2.5 px-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingTransferencias ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-foreground-muted text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Cargando transferencias...</span>
                    </div>
                  </td>
                </tr>
              ) : errorTransferencias ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 text-error">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errorTransferencias}</span>
                      </div>
                      <button
                        type="button"
                        onClick={loadTransferencias}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground bg-surface hover:bg-hover border border-border rounded-md shadow-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : transferencias.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-foreground-muted text-xs">
                    No se registran transferencias recientes.
                  </td>
                </tr>
              ) : (
                transferencias.map((t, idx) => (
                  <tr key={idx} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="py-3 px-3 text-foreground-muted whitespace-nowrap">
                      {new Date(t.fecha).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">
                      <span className="text-primary font-mono font-semibold mr-1.5">
                        {t.productoCodigo}
                      </span>
                      <span className="text-foreground-secondary">{t.productoNombre}</span>
                    </td>
                    <td className="py-3 px-3 text-foreground-secondary">{t.origenCodigo || t.origenNombre}</td>
                    <td className="py-3 px-3 text-foreground-secondary">{t.destinoCodigo || t.destinoNombre}</td>
                    <td className="py-3 px-3 text-right font-bold text-foreground">{t.cantidad}</td>
                    <td className="py-3 px-3 text-foreground-muted">{t.referencia}</td>
                    <td className="py-3 px-3 text-[10px] font-mono text-foreground-muted">
                      {t.uuid ? `${t.uuid.substring(0, 8)}...` : "-"}
                    </td>
                    <td className="py-3 px-3 text-foreground-muted">{t.usuario}</td>
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
