"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  Boxes,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Warehouse,
  Search,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Layers,
  FileCheck2,
} from "lucide-react";

export default function InventoryInitialView() {
  // Stepper: 1: Carga, 2: Revisión, 3: Procesamiento
  const [step, setStep] = useState(1);

  // Catalogs
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Header Operation State
  const [almacenId, setAlmacenId] = useState("");
  const [referenciaLote, setReferenciaLote] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Current line input form
  const [productoId, setProductoId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");

  // Batch items collection
  const [items, setItems] = useState([]);

  // Processing & Feedback state
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [processedResult, setProcessedResult] = useState(null);

  // Load catalogs on mount
  const loadCatalogos = useCallback(async () => {
    try {
      setLoadingCatalogos(true);
      const res = await fetch("/api/inventario/catalogos");
      if (!res.ok) throw new Error("Error al obtener catálogos.");
      const json = await res.json();
      const alms = json.almacenes || [];
      setAlmacenes(alms);
      setProductos(json.productos || []);
      setAlmacenId((prev) => prev || (alms.length > 0 ? String(alms[0].almacen_id) : ""));
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "No se pudieron cargar los datos de catálogos." });
    } finally {
      setLoadingCatalogos(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalogos();
  }, [loadCatalogos]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Handle product select
  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);

    if (prod.costo_actual > 0) {
      setCostoUnitario(String(prod.costo_actual));
    }
  };

  // Add line to batch
  const handleAddLine = () => {
    setFeedback(null);

    if (!productoId) {
      setFeedback({ type: "error", message: "Selecciona un producto." });
      return;
    }
    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona un almacén." });
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0." });
      return;
    }

    // Decimal validation
    if (!selectedProduct?.unidad_medida?.permite_decimales && cantNum % 1 !== 0) {
      setFeedback({
        type: "error",
        message: `La unidad ${selectedProduct?.unidad_medida?.codigo || "UND"} no permite cantidades decimales.`,
      });
      return;
    }

    const costoNum = parseFloat(costoUnitario);
    if (isNaN(costoNum) || costoNum < 0) {
      setFeedback({ type: "error", message: "El costo unitario debe ser igual o mayor a 0." });
      return;
    }

    // Duplicate check: same product + same warehouse
    const alreadyExists = items.some(
      (it) => String(it.productoId) === String(productoId) && String(it.almacenId) === String(almacenId)
    );

    if (alreadyExists) {
      setFeedback({
        type: "error",
        message: "Este producto ya fue agregado para este almacén en este lote.",
      });
      return;
    }

    const almObj = almacenes.find((a) => String(a.almacen_id) === String(almacenId));

    const newItem = {
      id: `${productoId}_${almacenId}_${Date.now()}`,
      productoId: Number(productoId),
      productoCodigo: selectedProduct.codigo_producto,
      productoNombre: selectedProduct.nombre,
      productoImagen: selectedProduct.imagen_url,
      unidadMedida: selectedProduct.unidad_medida?.codigo || "UND",
      almacenId: Number(almacenId),
      almacenCodigo: almObj?.codigo || "",
      almacenNombre: almObj?.nombre || "Almacén",
      cantidad: cantNum,
      costoUnitario: costoNum,
      costoTotal: Number((cantNum * costoNum).toFixed(2)),
    };

    setItems([...items, newItem]);

    // Reset line fields
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setCostoUnitario("");
  };

  // Remove line from batch
  const handleRemoveLine = (lineId) => {
    setItems(items.filter((it) => it.id !== lineId));
  };

  // Clear batch
  const handleClearBatch = () => {
    if (items.length > 0 && !window.confirm("¿Seguro que deseas limpiar todos los productos agregados?")) {
      return;
    }
    setItems([]);
    setReferenciaLote("");
    setObservaciones("");
    setFeedback(null);
  };

  // Totals calculations
  const totalProductos = items.length;
  const totalUnidades = useMemo(() => items.reduce((acc, it) => acc + it.cantidad, 0), [items]);
  const valorTotal = useMemo(() => items.reduce((acc, it) => acc + it.costoTotal, 0), [items]);
  const totalAlmacenesAfectados = useMemo(
    () => new Set(items.map((it) => it.almacenId)).size,
    [items]
  );

  // Confirm and process batch (Step 2 -> Step 3)
  const handleConfirmBatch = async () => {
    if (items.length === 0) return;

    setSubmitting(true);
    setFeedback(null);
    setStep(3);

    const idempotencyKey = `INV-INI-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/inventario/inventario-inicial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          referencia: referenciaLote.trim() || null,
          items: items.map((it) => ({
            productoId: it.productoId,
            almacenId: it.almacenId,
            cantidad: it.cantidad,
            costoUnitario: it.costoUnitario,
          })),
          observaciones: observaciones.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar el inventario inicial");
      }

      setProcessedResult(data);
      setFeedback({
        type: "success",
        message: data.mensaje || "Inventario inicial cargado correctamente.",
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error al procesar el inventario inicial.",
      });
      // Go back to review step on failure
      setStep(2);
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
            <span>Configuración</span>
            <span>&gt;</span>
            <span className="text-foreground-secondary font-medium">Inventario Inicial</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Inventario Inicial
              </h1>
              <p className="text-xs text-foreground-muted">
                Registra el inventario físico inicial de tus productos por almacén. Se crearán automáticamente las existencias y los movimientos correspondientes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inventory/stock"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Link>
        </div>
      </div>

      {/* 2. Stepper Horizontal de 3 Pasos */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Paso 1 */}
          <div
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
              step === 1 ? "bg-primary/10 border border-primary/30" : "opacity-75"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : step > 1
                  ? "bg-success text-white"
                  : "bg-surface border border-border text-foreground-muted"
              }`}
            >
              {step > 1 ? "✓" : "1"}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">1. Carga de productos</p>
              <p className="text-[11px] text-foreground-muted">Ingresa los productos y cantidades</p>
            </div>
          </div>

          {/* Paso 2 */}
          <div
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
              step === 2 ? "bg-primary/10 border border-primary/30" : "opacity-75"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : step > 2
                  ? "bg-success text-white"
                  : "bg-surface border border-border text-foreground-muted"
              }`}
            >
              {step > 2 ? "✓" : "2"}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">2. Revisar y confirmar</p>
              <p className="text-[11px] text-foreground-muted">Valida la información</p>
            </div>
          </div>

          {/* Paso 3 */}
          <div
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
              step === 3 ? "bg-primary/10 border border-primary/30" : "opacity-75"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 3
                  ? "bg-success text-white"
                  : "bg-surface border border-border text-foreground-muted"
              }`}
            >
              3
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">3. Procesamiento</p>
              <p className="text-[11px] text-foreground-muted">Se registran los movimientos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs transition-all ${
            feedback.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
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

      {/* ===================== PASO 1: CARGA DE PRODUCTOS ===================== */}
      {step === 1 && (
        <>
          {/* Card Formulario Superior: Cabecera y Agregar productos */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Datos de la Operación y Productos
            </h2>

            {/* SECCIÓN CABECERA: Almacén y Referencia / Documento / Lote */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border">
              {/* Almacén */}
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
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

              {/* Referencia / Documento / Lote */}
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                  Referencia / Documento / Lote <span className="text-foreground-muted font-normal text-[11px]">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={referenciaLote}
                  onChange={(e) => setReferenciaLote(e.target.value)}
                  placeholder="Ej. INI-001, LOTE-2026-A, ACTA-04..."
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* SECCIÓN LÍNEA: Producto, Cantidad, Costo Unitario, Botón Agregar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              {/* Producto */}
              <div className="lg:col-span-5 relative">
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
                    placeholder="Buscar producto por nombre o código..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
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
                            {p.unidad_medida?.codigo || "UND"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad */}
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Cantidad <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min={selectedProduct?.unidad_medida?.permite_decimales ? "0.01" : "1"}
                  step={selectedProduct?.unidad_medida?.permite_decimales ? "any" : "1"}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Costo Unitario (RD$) */}
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Costo unitario (RD$) <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Botón Agregar */}
              <div className="lg:col-span-1">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabla Productos en Inventario Inicial */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-foreground">
                Productos en inventario inicial
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {items.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-border text-foreground-muted font-semibold">
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3 font-medium">Producto</th>
                    <th className="py-2.5 px-3 font-medium">Código</th>
                    <th className="py-2.5 px-3 font-medium">Almacén</th>
                    <th className="py-2.5 px-3 font-medium text-right">Cantidad</th>
                    <th className="py-2.5 px-3 font-medium text-right">Costo unitario</th>
                    <th className="py-2.5 px-3 font-medium text-right">Costo total</th>
                    <th className="py-2.5 px-3 font-medium text-center w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-foreground-muted text-xs">
                        No hay productos agregados en el lote. Completa los campos arriba y haz clic en Agregar.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-surface-subtle/60 transition-colors">
                        <td className="py-3 px-3 text-foreground-muted">{idx + 1}</td>
                        <td className="py-3 px-3 font-medium text-foreground flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {it.productoImagen ? (
                              <img src={it.productoImagen} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-foreground-muted" />
                            )}
                          </div>
                          <span>{it.productoNombre}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-primary">{it.productoCodigo}</td>
                        <td className="py-3 px-3 text-foreground-secondary">{it.almacenNombre}</td>
                        <td className="py-3 px-3 text-right font-bold text-foreground">
                          {it.cantidad} {it.unidadMedida}
                        </td>
                        <td className="py-3 px-3 text-right text-foreground-muted">
                          RD$ {it.costoUnitario.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-success">
                          RD$ {it.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(it.id)}
                            title="Eliminar fila"
                            className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totales y Observaciones */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6 pt-3 border-t border-border">
              <div className="text-right text-xs">
                <span className="text-foreground-muted mr-2">Total productos:</span>
                <span className="font-bold text-foreground text-sm mr-6">{totalProductos}</span>
                <span className="text-foreground-muted mr-2">Valor total:</span>
                <span className="font-bold text-success text-sm">
                  RD$ {valorTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                Observaciones
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej. Conteo físico inicial del almacén principal..."
                className="w-full px-3.5 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Botones de navegación del Paso 1 */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleClearBatch}
                disabled={items.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={items.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3 Tarjetas Informativas Replicadas con Theme Engine Ride Lab */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card A */}
            <div className="p-4 rounded-xl bg-card border border-primary/30 text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Info className="w-4 h-4" />
                <span>¿Qué hace este proceso?</span>
              </div>
              <ul className="text-foreground-secondary space-y-1 list-disc pl-4 text-[11px]">
                <li>Crea los registros en existencias_producto si todavía no existen.</li>
                <li>Registra un movimiento de tipo &quot;INV_INICIAL&quot; por cada producto.</li>
                <li>Actualiza las cantidades y el costo promedio de cada producto por almacén.</li>
                <li>Deja un historial completo y auditable.</li>
              </ul>
            </div>

            {/* Card B */}
            <div className="p-4 rounded-xl bg-card border border-success/30 text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-success font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importante</span>
              </div>
              <ul className="text-foreground-secondary space-y-1 list-disc pl-4 text-[11px]">
                <li>Usa cantidades reales de tu conteo físico.</li>
                <li>El costo unitario debe ser el costo de adquisición o valorización.</li>
                <li>Este proceso normalmente se usa una sola vez, al iniciar el sistema.</li>
                <li>Después de esto, todos los movimientos se registran de forma normal (compras, ajustes, etc.).</li>
              </ul>
            </div>

            {/* Card C */}
            <div className="p-4 rounded-xl bg-card border border-warning/30 text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-warning font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Nota</span>
              </div>
              <p className="text-foreground-secondary text-[11px] leading-relaxed">
                Si encuentras diferencias después de este proceso, utiliza Ajuste de Inventario, no vuelvas a usar Inventario Inicial.
              </p>
            </div>
          </div>

          {/* Bloque Inferior: ¿Qué ocurre en el sistema? */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-foreground-muted tracking-wide uppercase">
              ¿Qué ocurre en el sistema?
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Paso 1 */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Ingresas los productos</h4>
                  <p className="text-[11px] text-foreground-muted">Producto, almacén, cantidad y costo unitario.</p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Se crean los movimientos</h4>
                  <p className="text-[11px] text-foreground-muted">
                    Un registro por producto en movimientos_inventario con tipo INV_INICIAL.
                  </p>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Se actualizan las existencias</h4>
                  <p className="text-[11px] text-foreground-muted">
                    Se crea o actualiza el registro con cantidad, costo promedio y fecha.
                  </p>
                </div>
              </div>

              {/* Resultado */}
              <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-success">Resultado</h4>
                  <p className="text-[11px] text-foreground-secondary">
                    Inventario inicial cargado correctamente y listo para operar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== PASO 2: REVISAR Y CONFIRMAR ===================== */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">
                Revisión del Inventario Inicial
              </h2>
              <p className="text-xs text-foreground-muted">
                Verifica cuidadosamente los productos y cantidades antes de procesar la apertura de inventario.
              </p>
            </div>

            {/* Tarjetas Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-lg bg-surface border border-border">
                <span className="text-xs text-foreground-muted block">Total Productos</span>
                <span className="text-lg font-bold text-foreground">{totalProductos}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-surface border border-border">
                <span className="text-xs text-foreground-muted block">Almacenes afectados</span>
                <span className="text-lg font-bold text-primary">{totalAlmacenesAfectados}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-surface border border-border">
                <span className="text-xs text-foreground-muted block">Total Unidades</span>
                <span className="text-lg font-bold text-foreground">{totalUnidades}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-surface border border-border">
                <span className="text-xs text-foreground-muted block">Valor Total Inicial</span>
                <span className="text-lg font-bold text-success">
                  RD$ {valorTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Referencia de Lote si existe */}
            {referenciaLote && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface border border-border text-xs">
                <span className="text-foreground-muted">Referencia / Documento / Lote:</span>
                <span className="font-mono font-bold text-foreground">{referenciaLote}</span>
              </div>
            )}

            {/* Tabla Resumen */}
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                    <th className="p-3 font-medium">Producto</th>
                    <th className="p-3 font-medium">Código</th>
                    <th className="p-3 font-medium">Almacén</th>
                    <th className="p-3 font-medium text-right">Cantidad</th>
                    <th className="p-3 font-medium text-right">Costo</th>
                    <th className="p-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="p-3 font-medium text-foreground">{it.productoNombre}</td>
                      <td className="p-3 font-mono font-semibold text-primary">{it.productoCodigo}</td>
                      <td className="p-3 text-foreground-secondary">{it.almacenNombre}</td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {it.cantidad} {it.unidadMedida}
                      </td>
                      <td className="p-3 text-right text-foreground-muted">
                        RD$ {it.costoUnitario.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-semibold text-success">
                        RD$ {it.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Advertencia Obligatoria */}
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning space-y-1">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span>Advertencia de Confirmación</span>
              </div>
              <p className="text-foreground-secondary">
                Este proceso registrará los saldos iniciales de inventario y generará movimientos INV_INICIAL.
                No utilices este proceso para correcciones posteriores. Para diferencias posteriores utiliza Ajustes de Inventario.
              </p>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border shadow-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Carga</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmBatch}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Procesar Inventario Inicial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PASO 3: PROCESAMIENTO Y RESULTADO ===================== */}
      {step === 3 && (
        <div className="bg-card border border-border rounded-xl p-8 shadow-xs text-center space-y-6">
          {submitting ? (
            <div className="py-12 space-y-4">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-base font-semibold text-foreground">Procesando inventario inicial...</h2>
              <p className="text-xs text-foreground-muted">
                Registrando movimientos INV_INICIAL y creando saldos de existencias de forma atómica.
              </p>
            </div>
          ) : processedResult ? (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto border border-success/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-foreground">
                  ¡Inventario Inicial Procesado Exitosamente!
                </h2>
                <p className="text-xs text-foreground-muted mt-1">
                  {processedResult.mensaje}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-surface border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-foreground-muted block">Código Movimiento:</span>
                  <span className="font-mono font-bold text-primary">
                    {processedResult.codigoMovimiento || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Lote / Documento:</span>
                  <span className="font-mono font-semibold text-foreground-secondary">
                    {processedResult.referenciaLote || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Productos:</span>
                  <span className="font-bold text-foreground">{processedResult.totalProductos}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Valor total:</span>
                  <span className="font-bold text-success">
                    RD$ {processedResult.totalValor?.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Link
                  href="/inventory/stock"
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-xs"
                >
                  Ver Existencias
                </Link>
                <Link
                  href="/inventory/movements"
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-colors shadow-xs"
                >
                  Ver Movimientos
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setReferenciaLote("");
                    setObservaciones("");
                    setProcessedResult(null);
                    setStep(1);
                  }}
                  className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover border border-border transition-colors cursor-pointer"
                >
                  Cargar Otro Lote
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
