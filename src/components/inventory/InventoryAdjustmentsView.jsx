"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ArrowRight,
  Plus,
  Minus,
  TrendingDown,
  TrendingUp,
  Clock,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Warehouse,
  Search,
  ChevronDown,
  Info,
  Calendar,
  RefreshCw,
} from "lucide-react";

export default function InventoryAdjustmentsView() {
  // Tabs: "SALIDA" | "AJU_POS" | "AJU_NEG"
  const [activeTab, setActiveTab] = useState("SALIDA");

  // Catalogs
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [errorMovimientos, setErrorMovimientos] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [almacenId, setAlmacenId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");

  // Product search dropdown
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Notifications
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
      setAlmacenes(data.almacenes || []);
      setProductos(data.productos || []);

      if ((data.almacenes || []).length > 0 && !almacenId) {
        setAlmacenId(String(data.almacenes[0].almacen_id));
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "No se pudieron cargar los catálogos." });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [almacenId]);

  // Load recent movements for current tab (differentiating error from empty)
  const loadMovimientos = useCallback(async (tab) => {
    try {
      setLoadingMovimientos(true);
      setErrorMovimientos(null);
      const res = await fetch(`/api/inventario/ajustes?tipo=${tab}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setMovimientos(data.movimientos || []);
        setErrorMovimientos(null);
      } else {
        setMovimientos([]);
        setErrorMovimientos("No se pudieron cargar los movimientos recientes.");
      }
    } catch (err) {
      console.warn("Error al consultar movimientos:", err);
      setMovimientos([]);
      setErrorMovimientos("No se pudieron cargar los movimientos recientes.");
    } finally {
      setLoadingMovimientos(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    loadMovimientos(activeTab);
  }, [activeTab, loadMovimientos]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Selected warehouse name
  const selectedWarehouse = useMemo(() => {
    if (!almacenId) return null;
    return almacenes.find((a) => String(a.almacen_id) === String(almacenId)) || null;
  }, [almacenes, almacenId]);

  // Stock details for current product and warehouse
  const stockInfo = useMemo(() => {
    if (!selectedProduct || !almacenId) {
      return {
        actual: 0,
        reservado: 0,
        disponible: 0,
        costoPromedio: selectedProduct?.costo_actual || 0,
      };
    }
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenId)
    );
    const act = ex ? Number(ex.cantidad_actual) : 0;
    const res = ex ? Number(ex.cantidad_reservada) : 0;
    const disp = act - res;
    const cost = ex ? Number(ex.costo_promedio) : (selectedProduct.costo_actual || 0);
    return { actual: act, reservado: res, disponible: disp, costoPromedio: cost };
  }, [selectedProduct, almacenId]);

  // Calculations
  const cantidadNum = parseFloat(cantidad) || 0;
  const costoUnitarioNum = parseFloat(costoUnitario) || (stockInfo.costoPromedio || 0);

  // Available stock check for SALIDA and AJU_NEG
  const isExitOrNegative = activeTab === "SALIDA" || activeTab === "AJU_NEG";
  const stockExcedido = isExitOrNegative && cantidadNum > stockInfo.disponible;

  const stockProyectado = useMemo(() => {
    if (activeTab === "AJU_POS") {
      return stockInfo.actual + cantidadNum;
    }
    return stockInfo.actual - cantidadNum;
  }, [activeTab, stockInfo.actual, cantidadNum]);

  const disponibleProyectado = useMemo(() => {
    if (activeTab === "AJU_POS") {
      return stockInfo.disponible + cantidadNum;
    }
    return stockInfo.disponible - cantidadNum;
  }, [activeTab, stockInfo.disponible, cantidadNum]);

  // Projected PMP for AJU_POS
  const pmpProyectadoPositivo = useMemo(() => {
    if (activeTab !== "AJU_POS") return stockInfo.costoPromedio;
    if (stockInfo.actual <= 0 || stockInfo.costoPromedio <= 0) {
      return costoUnitarioNum > 0 ? costoUnitarioNum : stockInfo.costoPromedio;
    }
    if (cantidadNum <= 0 || costoUnitarioNum <= 0) {
      return stockInfo.costoPromedio;
    }
    const valAnt = stockInfo.actual * stockInfo.costoPromedio;
    const valEnt = cantidadNum * costoUnitarioNum;
    return (valAnt + valEnt) / (stockInfo.actual + cantidadNum);
  }, [activeTab, stockInfo.actual, stockInfo.costoPromedio, cantidadNum, costoUnitarioNum]);

  const valorOperacion = useMemo(() => {
    if (activeTab === "AJU_POS") {
      return cantidadNum * costoUnitarioNum;
    }
    return cantidadNum * stockInfo.costoPromedio;
  }, [activeTab, cantidadNum, costoUnitarioNum, stockInfo.costoPromedio]);

  // Handle product selection
  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);

    // If AJU_POS, suggest current cost
    if (prod.costo_actual > 0) {
      setCostoUnitario(String(prod.costo_actual));
    }
  };

  // Reset form
  const handleReset = () => {
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setCostoUnitario("");
    setMotivo("");
    setReferencia("");
    setObservacion("");
    setFeedback(null);
  };

  // Switch tab
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    handleReset();
  };

  // Submit operation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona un almacén." });
      return;
    }
    if (!productoId) {
      setFeedback({ type: "error", message: "Selecciona un producto." });
      return;
    }
    if (cantidadNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0." });
      return;
    }
    if (!motivo.trim()) {
      setFeedback({ type: "error", message: "El motivo es obligatorio." });
      return;
    }

    if (stockExcedido) {
      setFeedback({
        type: "error",
        message: "La cantidad solicitada supera el stock disponible no reservado.",
      });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `${activeTab}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/inventario/ajustes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          tipo: activeTab,
          almacenId: Number(almacenId),
          productoId: Number(productoId),
          cantidad: cantidadNum,
          costoUnitario: activeTab === "AJU_POS" ? costoUnitarioNum : null,
          motivo: motivo.trim(),
          referencia: referencia.trim() || null,
          observacion: observacion.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar la operación");
      }

      setFeedback({
        type: "success",
        message: `${data.mensaje || "Operación registrada exitosamente."} Nuevo stock: ${data.movimiento.stockNuevo} ${selectedProduct?.unidad_medida?.codigo || "UND"}.`,
      });

      await loadCatalogos();
      await loadMovimientos(activeTab);

      // Reset fields
      setProductoId("");
      setProductSearch("");
      setCantidad("");
      setCostoUnitario("");
      setMotivo("");
      setReferencia("");
      setObservacion("");
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error al registrar el movimiento.",
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
            <span className="text-foreground font-medium">Salidas y Ajustes</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Salidas y Ajustes de Inventario
              </h1>
              <p className="text-xs md:text-sm text-foreground-muted">
                Registra salidas manuales y ajustes de inventario
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

      {/* 2. Tabs Superiores tipo Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Tab 1: Salida */}
        <div
          onClick={() => handleTabChange("SALIDA")}
          className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
            activeTab === "SALIDA"
              ? "bg-card border-error/80 ring-1 ring-error/40 shadow-sm"
              : "bg-surface border-border hover:border-border-hover opacity-80 hover:opacity-100"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              activeTab === "SALIDA"
                ? "bg-error text-white font-bold"
                : "bg-error/10 text-error border border-error/20"
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground block">Salida</span>
            <span className="text-[11px] text-foreground-muted">Disminuye el inventario</span>
          </div>
        </div>

        {/* Tab 2: Ajuste Positivo */}
        <div
          onClick={() => handleTabChange("AJU_POS")}
          className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
            activeTab === "AJU_POS"
              ? "bg-card border-success/80 ring-1 ring-success/40 shadow-sm"
              : "bg-surface border-border hover:border-border-hover opacity-80 hover:opacity-100"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              activeTab === "AJU_POS"
                ? "bg-success text-white font-bold"
                : "bg-success/10 text-success border border-success/20"
            }`}
          >
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground block">Ajuste Positivo</span>
            <span className="text-[11px] text-foreground-muted">Aumenta el inventario</span>
          </div>
        </div>

        {/* Tab 3: Ajuste Negativo */}
        <div
          onClick={() => handleTabChange("AJU_NEG")}
          className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
            activeTab === "AJU_NEG"
              ? "bg-card border-warning/80 ring-1 ring-warning/40 shadow-sm"
              : "bg-surface border-border hover:border-border-hover opacity-80 hover:opacity-100"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              activeTab === "AJU_NEG"
                ? "bg-warning text-white font-bold"
                : "bg-warning/10 text-warning border border-warning/20"
            }`}
          >
            <Minus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground block">Ajuste Negativo</span>
            <span className="text-[11px] text-foreground-muted">Disminuye el inventario</span>
          </div>
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

      {/* 3. Cuerpo: 2 Columnas (Formulario + Resumen según Tab) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Formulario (65%) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
          {/* Título de Formulario dinámico por tab */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-border mb-5">
            {activeTab === "SALIDA" && (
              <>
                <div className="p-1.5 rounded-lg bg-error/10 text-error">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Registrar Salida Manual</h2>
                  <p className="text-xs text-foreground-muted">
                    Registra una salida de inventario por consumo, venta u otro motivo operativo
                  </p>
                </div>
              </>
            )}
            {activeTab === "AJU_POS" && (
              <>
                <div className="p-1.5 rounded-lg bg-success/10 text-success">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Registrar Ajuste Positivo</h2>
                  <p className="text-xs text-foreground-muted">
                    Aumenta el inventario por regularización, conteo físico, corrección, etc.
                  </p>
                </div>
              </>
            )}
            {activeTab === "AJU_NEG" && (
              <>
                <div className="p-1.5 rounded-lg bg-warning/10 text-warning">
                  <Minus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Registrar Ajuste Negativo</h2>
                  <p className="text-xs text-foreground-muted">
                    Disminuye el inventario por daño, merma, pérdida, error de registro, etc.
                  </p>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fila 1: Almacén y Producto */}
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
                    placeholder="Buscar por código o nombre..."
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

                {/* Resumen corto del producto bajo el selector */}
                {selectedProduct && (
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-primary">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Unidad: {selectedProduct.unidad_medida?.codigo || "UND"} | Stock actual:{" "}
                      <strong className="text-foreground">{stockInfo.actual}</strong>
                      {stockInfo.reservado > 0 && (
                        <span>
                          {" "}
                          (Reservado:{" "}
                          <strong className="text-warning">{stockInfo.reservado}</strong>,
                          Disponible:{" "}
                          <strong className="text-success">{stockInfo.disponible}</strong>)
                        </span>
                      )}{" "}
                      | Costo prom.: RD$ {stockInfo.costoPromedio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Fila 2: Cantidad y (Costo / Stock Resultante según Tab) */}
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
                    La cantidad solicitada supera el stock disponible no reservado ({stockInfo.disponible}).
                  </p>
                )}
              </div>

              {/* Si es AJU_POS: Costo unitario */}
              {activeTab === "AJU_POS" && (
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
                      placeholder="850.00"
                      className="w-full pl-12 pr-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Si es AJU_NEG: Caja visual de Stock Resultante */}
              {activeTab === "AJU_NEG" && (
                <div>
                  <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                    Stock resultante
                  </label>
                  <div className="px-3.5 py-2.5 text-xs bg-surface border border-border rounded-lg flex items-center gap-2 font-mono">
                    <span className="text-foreground">{stockInfo.actual}</span>
                    <span className="text-foreground-muted">-</span>
                    <span className="text-error">{cantidadNum}</span>
                    <span className="text-foreground-muted">=</span>
                    <span
                      className={`font-bold ${
                        stockProyectado < 0 ? "text-error" : "text-foreground"
                      }`}
                    >
                      {stockProyectado} {selectedProduct?.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Fila 3: Motivo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-foreground-secondary">
                  {activeTab === "SALIDA" ? "Motivo" : "Motivo del ajuste"}{" "}
                  <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-foreground-muted">{motivo.length}/200</span>
              </div>
              <input
                type="text"
                maxLength={200}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={
                  activeTab === "SALIDA"
                    ? "Ej. Venta de mostrador, consumo de taller..."
                    : activeTab === "AJU_POS"
                    ? "Ej. Conteo físico - inventario mensual, corrección..."
                    : "Ej. Producto dañado en transporte, merma, pérdida física..."
                }
                className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Fila 4: Referencia y Observación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  {activeTab === "SALIDA" ? "Referencia / Documento" : "Referencia (opcional)"}
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder={
                    activeTab === "SALIDA"
                      ? "Ej. Factura #1234, OT-5678..."
                      : activeTab === "AJU_POS"
                      ? "AJU-2025-005"
                      : "AJU-2025-010"
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground-secondary">
                    Observación (opcional)
                  </label>
                  <span className="text-[10px] text-foreground-muted">
                    {observacion.length}/500
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={500}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Observaciones adicionales..."
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
                disabled={submitting || !selectedProduct || stockExcedido || !motivo.trim()}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  activeTab === "SALIDA"
                    ? "bg-error hover:bg-error/90 text-white"
                    : activeTab === "AJU_POS"
                    ? "bg-success hover:bg-success/90 text-white"
                    : "bg-warning hover:bg-warning/90 text-white"
                }`}
              >
                {activeTab === "SALIDA" ? (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>{submitting ? "Registrando..." : "Registrar Salida"}</span>
                  </>
                ) : activeTab === "AJU_POS" ? (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>{submitting ? "Registrando..." : "Registrar Ajuste Positivo"}</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4" />
                    <span>{submitting ? "Registrando..." : "Registrar Ajuste Negativo"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Panel de Resumen (35%) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-border mb-5">
              {activeTab === "SALIDA" ? (
                <TrendingDown className="w-5 h-5 text-error" />
              ) : activeTab === "AJU_POS" ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-warning" />
              )}
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {activeTab === "SALIDA" ? "Resumen de la Operación" : "Resumen del Ajuste"}
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
                    <p className="text-[10px] text-primary">
                      {selectedWarehouse ? selectedWarehouse.nombre : "Almacén"}
                    </p>
                  </div>
                </div>

                {/* Métricas de Stock */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-foreground-secondary">
                    <span>Stock actual:</span>
                    <span className="font-semibold text-foreground">
                      {stockInfo.actual} {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>

                  {stockInfo.reservado > 0 && (
                    <div className="flex items-center justify-between text-warning">
                      <span>Stock reservado:</span>
                      <span className="font-semibold">
                        {stockInfo.reservado} {selectedProduct.unidad_medida?.codigo || "UND"}
                      </span>
                    </div>
                  )}

                  {stockInfo.reservado > 0 && (
                    <div className="flex items-center justify-between text-primary">
                      <span>Stock disponible:</span>
                      <span className="font-semibold">
                        {stockInfo.disponible} {selectedProduct.unidad_medida?.codigo || "UND"}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-between font-semibold ${
                      activeTab === "AJU_POS" ? "text-success" : "text-error"
                    }`}
                  >
                    <span>
                      {activeTab === "SALIDA"
                        ? "Cantidad a salir:"
                        : activeTab === "AJU_POS"
                        ? "Cantidad a agregar:"
                        : "Cantidad a reducir:"}
                    </span>
                    <span>
                      {activeTab === "AJU_POS" ? "+" : "-"} {cantidadNum}{" "}
                      {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-foreground font-bold pt-1 border-t border-border">
                    <span>Stock proyectado:</span>
                    <span
                      className={`text-sm ${
                        activeTab === "AJU_POS"
                          ? "text-success"
                          : stockProyectado < 0
                          ? "text-error"
                          : "text-foreground"
                      }`}
                    >
                      {stockProyectado} {selectedProduct.unidad_medida?.codigo || "UND"}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border my-3" />

                {/* Métricas de Costo y Valor */}
                <div className="space-y-2 text-xs">
                  {activeTab === "AJU_POS" ? (
                    <>
                      <div className="flex items-center justify-between text-foreground-secondary">
                        <span>Costo unitario:</span>
                        <span className="font-semibold text-foreground">
                          RD$ {costoUnitarioNum.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-foreground font-bold pt-1 border-t border-border">
                        <span>Costo total del ajuste:</span>
                        <span className="text-sm text-foreground">
                          RD$ {valorOperacion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-foreground-secondary">
                        <span>Costo promedio actual:</span>
                        <span className="font-semibold text-foreground">
                          RD$ {stockInfo.costoPromedio.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-foreground font-bold pt-1 border-t border-border">
                        <span>
                          {activeTab === "SALIDA" ? "Valor de la salida:" : "Valor del ajuste:"}
                        </span>
                        <span className="text-sm text-foreground">
                          RD$ {valorOperacion.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="h-px bg-border my-3" />

                {/* Métricas de PMP */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-foreground-secondary">
                    <span>
                      {activeTab === "AJU_POS" ? "PMP actual:" : "PMP proyectado:"}
                    </span>
                    <span className="font-semibold text-foreground">
                      RD$ {stockInfo.costoPromedio.toFixed(2)}
                    </span>
                  </div>

                  {activeTab === "AJU_POS" && (
                    <div className="flex items-center justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>PMP proyectado (estimado):</span>
                      <span className="text-sm font-bold">
                        RD$ {pmpProyectadoPositivo.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {activeTab === "AJU_NEG" && (
                    <div className="flex items-center justify-between text-foreground-secondary pt-1 border-t border-border">
                      <span>PMP después del ajuste:</span>
                      <span className="font-semibold text-foreground">
                        RD$ {stockInfo.costoPromedio.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-foreground-muted text-xs">
                Selecciona un producto para visualizar el resumen del movimiento.
              </div>
            )}
          </div>

          {/* Advertencia roja inferior para Ajuste Negativo */}
          {activeTab === "AJU_NEG" ? (
            <div className="mt-6 p-3 rounded-xl bg-error/10 border border-error/30 text-[11px] text-error flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <span>
                <strong>Este ajuste disminuirá el inventario de forma permanente.</strong> Verifique que la información sea correcta antes de continuar.
              </span>
            </div>
          ) : (
            <div className="mt-6 p-3 rounded-xl bg-surface border border-border text-[11px] text-foreground-muted flex items-start gap-2">
              <Info className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
              <span>
                El PMP proyectado es solo informativo. El cálculo definitivo lo realiza el sistema al registrar la operación.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Sección Inferior: Historial según Tab */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-surface text-foreground-muted">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {activeTab === "SALIDA"
                  ? "Últimas Salidas y Ajustes"
                  : activeTab === "AJU_POS"
                  ? "Últimos Ajustes Positivos"
                  : "Últimos Ajustes Negativos"}
              </h3>
              <p className="text-[11px] text-foreground-muted">
                Mostrando los 5 movimientos más recientes
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements"
            className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            <span>Ver todos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-foreground-muted font-semibold">
                <th className="py-2.5 px-3 font-medium">Fecha</th>
                {activeTab === "SALIDA" && <th className="py-2.5 px-3 font-medium">Tipo</th>}
                <th className="py-2.5 px-3 font-medium">Producto</th>
                <th className="py-2.5 px-3 font-medium">Almacén</th>
                <th className="py-2.5 px-3 font-medium text-right">Cantidad</th>
                {activeTab !== "SALIDA" && <th className="py-2.5 px-3 font-medium text-right">Costo Unit.</th>}
                {activeTab !== "SALIDA" && <th className="py-2.5 px-3 font-medium text-right">Valor Total</th>}
                {activeTab === "SALIDA" && <th className="py-2.5 px-3 font-medium text-right">Stock Anterior</th>}
                {activeTab === "SALIDA" && <th className="py-2.5 px-3 font-medium text-right">Stock Nuevo</th>}
                <th className="py-2.5 px-3 font-medium">Motivo</th>
                <th className="py-2.5 px-3 font-medium">Referencia</th>
                <th className="py-2.5 px-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingMovimientos ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-foreground-muted text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Cargando movimientos...</span>
                    </div>
                  </td>
                </tr>
              ) : errorMovimientos ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 text-error">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errorMovimientos}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadMovimientos(activeTab)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground bg-surface hover:bg-hover border border-border rounded-md shadow-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-foreground-muted text-xs">
                    No se registran movimientos recientes.
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="py-3 px-3 text-foreground-muted whitespace-nowrap">
                      {new Date(m.fecha).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Badge de tipo en Tab Salida */}
                    {activeTab === "SALIDA" && (
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            m.tipoCodigo === "SAL_MANUAL"
                              ? "bg-error/10 text-error border-error/30"
                              : m.tipoCodigo === "AJU_POS"
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-warning/10 text-warning border-warning/30"
                          }`}
                        >
                          {m.tipoCodigo === "SAL_MANUAL" ? "SALIDA" : m.tipoCodigo}
                        </span>
                      </td>
                    )}

                    <td className="py-3 px-3 font-medium text-foreground">
                      <span className="text-primary font-mono font-semibold mr-1.5">
                        {m.productoCodigo}
                      </span>
                      <span className="text-foreground-secondary">{m.productoNombre}</span>
                    </td>

                    <td className="py-3 px-3 text-foreground-secondary">{m.almacenNombre}</td>

                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        m.naturaleza === "SALIDA" || activeTab === "AJU_NEG"
                          ? "text-error"
                          : "text-success"
                      }`}
                    >
                      {m.naturaleza === "SALIDA" || activeTab === "AJU_NEG" ? "-" : "+"} {m.cantidad}
                    </td>

                    {activeTab !== "SALIDA" && (
                      <td className="py-3 px-3 text-right text-foreground-muted">
                        RD$ {m.costoUnitario.toFixed(2)}
                      </td>
                    )}

                    {activeTab !== "SALIDA" && (
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        RD$ {m.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                    )}

                    {activeTab === "SALIDA" && (
                      <td className="py-3 px-3 text-right text-foreground-muted">
                        {m.stockAnterior !== null ? m.stockAnterior : "-"}
                      </td>
                    )}

                    {activeTab === "SALIDA" && (
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        {m.stockNuevo !== null ? m.stockNuevo : "-"}
                      </td>
                    )}

                    <td className="py-3 px-3 text-foreground-secondary truncate max-w-[140px]">{m.motivo}</td>
                    <td className="py-3 px-3 text-foreground-muted">{m.referencia}</td>
                    <td className="py-3 px-3 text-foreground-muted">{m.usuario}</td>
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
