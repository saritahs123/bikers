"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Package,
  Calendar,
  Clock,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Warehouse,
  Search,
  ChevronDown,
  Info,
  ArrowRight,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
  MoreVertical,
  BarChart2,
} from "lucide-react";

export default function InventoryTransfersView() {
  // Catálogos
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [errorTransferencias, setErrorTransferencias] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cabecera de la operación
  const [almacenOrigenId, setAlmacenOrigenId] = useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = useState("");
  const [referenciaGeneral, setReferenciaGeneral] = useState("");
  const [observacionGeneral, setObservacionGeneral] = useState("");

  // Líneas temporales de la transferencia multiproducto
  const [lineas, setLineas] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  // Formulario para agregar/editar una línea
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");

  // Dropdown de búsqueda de productos
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState(null);

  // Fecha y hora actual en vivo
  const [currentTime, setCurrentTime] = useState({
    dateStr: "",
    timeStr: "",
  });

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
      setCurrentTime({
        dateStr: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        timeStr,
      });
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar catálogos
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
        setAlmacenOrigenId((prev) => {
          if (prev && alms.some((a) => String(a.almacen_id) === String(prev))) return prev;
          return String(alms[0].almacen_id);
        });
        setAlmacenDestinoId((prev) => {
          const currentOrigin = almacenOrigenId || String(alms[0].almacen_id);
          if (prev && String(prev) !== currentOrigin && alms.some((a) => String(a.almacen_id) === String(prev))) {
            return prev;
          }
          const alt = alms.find((a) => String(a.almacen_id) !== currentOrigin);
          return alt ? String(alt.almacen_id) : "";
        });
      } else if (alms.length === 1) {
        setAlmacenOrigenId(String(alms[0].almacen_id));
        setAlmacenDestinoId("");
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "No se pudieron cargar los catálogos." });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [almacenOrigenId]);

  // Cargar transferencias recientes
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

  // Almacenes disponibles para destino (excluye estrictamente el de origen)
  const almacenesDestino = useMemo(() => {
    if (!almacenOrigenId) return almacenes;
    return almacenes.filter((a) => String(a.almacen_id) !== String(almacenOrigenId));
  }, [almacenes, almacenOrigenId]);

  // Manejar cambio de origen
  const handleOrigenChange = (newOrigenId) => {
    if (lineas.length > 0) {
      if (!window.confirm("Cambiar el almacén de origen descartará las líneas agregadas. ¿Continuar?")) {
        return;
      }
      setLineas([]);
      resetLineForm();
    }
    setAlmacenOrigenId(newOrigenId);

    if (String(almacenDestinoId) === String(newOrigenId)) {
      const alternate = almacenes.find((a) => String(a.almacen_id) !== String(newOrigenId));
      setAlmacenDestinoId(alternate ? String(alternate.almacen_id) : "");
    }
  };

  // Intercambiar almacenes
  const handleSwapWarehouses = () => {
    if (!almacenOrigenId || !almacenDestinoId) return;
    if (lineas.length > 0) {
      if (!window.confirm("Intercambiar almacenes descartará las líneas actuales agregadas. ¿Continuar?")) {
        return;
      }
      setLineas([]);
      resetLineForm();
    }
    const temp = almacenOrigenId;
    setAlmacenOrigenId(almacenDestinoId);
    setAlmacenDestinoId(temp);
  };

  // Producto seleccionado actualmente
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Stock en origen
  const stockOrigen = useMemo(() => {
    if (!selectedProduct || !almacenOrigenId) {
      return { actual: 0, reservado: 0, disponible: 0 };
    }
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenOrigenId)
    );
    const act = ex ? Number(ex.cantidad_actual) : 0;
    const res = ex ? Number(ex.cantidad_reservada) : 0;
    return { actual: act, reservado: res, disponible: act - res };
  }, [selectedProduct, almacenOrigenId]);

  // Stock en destino
  const stockDestino = useMemo(() => {
    if (!selectedProduct || !almacenDestinoId) {
      return { actual: 0 };
    }
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenDestinoId)
    );
    return { actual: ex ? Number(ex.cantidad_actual) : 0 };
  }, [selectedProduct, almacenDestinoId]);

  // Búsqueda de productos
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productos.slice(0, 30);
    const q = productSearch.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_producto?.toLowerCase().includes(q) ||
        p.nombre?.toLowerCase().includes(q) ||
        p.marca_nombre?.toLowerCase().includes(q) ||
        p.codigo_barra?.toLowerCase().includes(q)
    );
  }, [productos, productSearch]);

  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);
  };

  const resetLineForm = () => {
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setEditingIndex(null);
  };

  // Agregar línea temporal
  const handleAddLine = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback(null);

    if (!almacenOrigenId || !almacenDestinoId) {
      setFeedback({ type: "error", message: "Selecciona los almacenes de origen y destino." });
      return;
    }
    if (almacenOrigenId === almacenDestinoId) {
      setFeedback({ type: "error", message: "Los almacenes de origen y destino deben ser diferentes." });
      return;
    }
    if (!selectedProduct) {
      setFeedback({ type: "error", message: "Selecciona un producto para transferir." });
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad a transferir debe ser mayor a 0." });
      return;
    }

    const permiteDec = Boolean(selectedProduct?.unidad_medida?.permite_decimales);
    if (!permiteDec && !Number.isInteger(cantNum)) {
      setFeedback({
        type: "error",
        message: `La unidad ${selectedProduct?.unidad_medida?.codigo || "UND"} no permite decimales. Ingrese un número entero.`,
      });
      return;
    }

    if (cantNum > stockOrigen.disponible) {
      setFeedback({
        type: "error",
        message: `Stock disponible insuficiente en origen para '${selectedProduct.nombre}'. Disponible: ${stockOrigen.disponible}, Solicitado: ${cantNum}.`,
      });
      return;
    }

    // Validar duplicados
    const duplicateIndex = lineas.findIndex(
      (l, idx) => l.productoId === selectedProduct.producto_id && idx !== editingIndex
    );
    if (duplicateIndex >= 0) {
      setFeedback({
        type: "error",
        message: "Este producto ya está agregado en la transferencia. Modifica la cantidad o edita la línea.",
      });
      return;
    }

    const newLine = {
      productoId: selectedProduct.producto_id,
      codigoProducto: selectedProduct.codigo_producto,
      nombreProducto: selectedProduct.nombre,
      marca: selectedProduct.marca_nombre || "Genérico",
      unidad: selectedProduct.unidad_medida?.codigo || "UND",
      permiteDecimales: permiteDec,
      cantidad: cantNum,
      stockOrigenActual: stockOrigen.actual,
      stockOrigenDisponible: stockOrigen.disponible,
      stockOrigenProyectado: stockOrigen.actual - cantNum,
      stockDestinoActual: stockDestino.actual,
      stockDestinoProyectado: stockDestino.actual + cantNum,
    };

    if (editingIndex !== null) {
      const updated = [...lineas];
      updated[editingIndex] = newLine;
      setLineas(updated);
      setFeedback({ type: "success", message: "Línea de transferencia actualizada." });
    } else {
      setLineas((prev) => [...prev, newLine]);
      setFeedback({ type: "success", message: `Producto '${selectedProduct.nombre}' agregado a la transferencia.` });
    }

    resetLineForm();
  };

  const handleEditLine = (index) => {
    const l = lineas[index];
    const prod = productos.find((p) => p.producto_id === l.productoId);
    if (prod) {
      setProductoId(String(prod.producto_id));
      setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
      setCantidad(String(l.cantidad));
      setEditingIndex(index);
      setFeedback(null);
    }
  };

  const handleDeleteLine = (index) => {
    setLineas((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      resetLineForm();
    }
  };

  const totales = useMemo(() => {
    const totalLineas = lineas.length;
    const totalUnidades = lineas.reduce((acc, l) => acc + l.cantidad, 0);
    return { totalLineas, totalUnidades };
  }, [lineas]);

  const handleResetAll = () => {
    if (lineas.length > 0) {
      if (!window.confirm("¿Estás seguro de que deseas limpiar toda la transferencia? Se descartarán las líneas agregadas.")) {
        return;
      }
    }
    setLineas([]);
    resetLineForm();
    setReferenciaGeneral("");
    setObservacionGeneral("");
    setFeedback(null);
  };

  // Submit batch atómico en PostgreSQL
  const handleSubmitBatch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback(null);

    let batchLines = [...lineas];
    if (batchLines.length === 0) {
      if (selectedProduct && parseFloat(cantidad) > 0) {
        const cantNum = parseFloat(cantidad);
        if (cantNum > stockOrigen.disponible) {
          setFeedback({
            type: "error",
            message: `Stock disponible insuficiente en origen. Disponible: ${stockOrigen.disponible}, Solicitado: ${cantNum}.`,
          });
          return;
        }
        batchLines.push({
          productoId: selectedProduct.producto_id,
          codigoProducto: selectedProduct.codigo_producto,
          nombreProducto: selectedProduct.nombre,
          marca: selectedProduct.marca_nombre || "Genérico",
          unidad: selectedProduct.unidad_medida?.codigo || "UND",
          cantidad: cantNum,
        });
      }
    }

    if (!almacenOrigenId || !almacenDestinoId) {
      setFeedback({ type: "error", message: "Selecciona los almacenes de origen y destino." });
      return;
    }
    if (almacenOrigenId === almacenDestinoId) {
      setFeedback({ type: "error", message: "Los almacenes de origen y destino deben ser distintos." });
      return;
    }
    if (batchLines.length === 0) {
      setFeedback({ type: "error", message: "Selecciona un producto e indica la cantidad antes de registrar la transferencia." });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `TRF-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        almacenOrigenId: Number(almacenOrigenId),
        almacenDestinoId: Number(almacenDestinoId),
        referencia: referenciaGeneral.trim() || null,
        observacion: observacionGeneral.trim() || null,
        lineas: batchLines.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
        })),
      };

      const res = await fetch("/api/inventario/transferencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar la transferencia.");
      }

      setFeedback({
        type: "success",
        message: `${data.mensaje || "Transferencia realizada exitosamente."} Código: ${data.codigoMovimiento}`,
      });

      setLineas([]);
      resetLineForm();
      setReferenciaGeneral("");
      setObservacionGeneral("");
      await loadCatalogos();
      await loadTransferencias();
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al registrar la transferencia.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const almOrigenObj = useMemo(
    () => almacenes.find((a) => String(a.almacen_id) === String(almacenOrigenId)),
    [almacenes, almacenOrigenId]
  );
  const almDestinoObj = useMemo(
    () => almacenes.find((a) => String(a.almacen_id) === String(almacenDestinoId)),
    [almacenes, almacenDestinoId]
  );

  // Datos para el Resumen Derecho
  const activeProductForSummary = useMemo(() => {
    if (selectedProduct) {
      const cantNum = parseFloat(cantidad) || 0;
      return {
        isEditing: true,
        producto: selectedProduct,
        codigo: selectedProduct.codigo_producto,
        nombre: selectedProduct.nombre,
        unidad: selectedProduct.unidad_medida?.codigo || "UND",
        cantidad: cantNum,
        origenActual: stockOrigen.actual,
        origenProyectado: stockOrigen.actual - cantNum,
        destinoActual: stockDestino.actual,
        destinoProyectado: stockDestino.actual + cantNum,
      };
    } else if (lineas.length > 0) {
      const last = lineas[lineas.length - 1];
      return {
        isEditing: false,
        producto: null,
        codigo: last.codigoProducto,
        nombre: last.nombreProducto,
        unidad: last.unidad,
        cantidad: last.cantidad,
        origenActual: last.stockOrigenActual,
        origenProyectado: last.stockOrigenProyectado,
        destinoActual: last.stockDestinoActual,
        destinoProyectado: last.stockDestinoProyectado,
      };
    }
    return null;
  }, [selectedProduct, cantidad, stockOrigen, stockDestino, lineas]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER EXACTO SEGÚN REFERENCIA IMAGE 5 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
            <Link href="/inventory/summary" className="hover:text-foreground transition-colors">
              Inventario
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-medium">Transferencias</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <ArrowLeftRight className="w-7 h-7" />
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

        {/* Live Clock / Calendar widget & Ver movimientos */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs shadow-2xs">
            <Calendar className="w-4 h-4 text-foreground-muted" />
            <div>
              <div className="text-[10px] text-foreground-muted">{currentTime.dateStr || "—"}</div>
              <div className="text-xs font-bold text-foreground">
                {currentTime.timeStr || "—"}{" "}
                <span className="text-[10px] font-normal text-foreground-muted">America/Santo Domingo</span>
              </div>
            </div>
          </div>

          <Link
            href="/inventory/movements"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground-secondary hover:text-foreground border border-border transition-all shadow-2xs"
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
            <p className="font-semibold">{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. LAYOUT PRINCIPAL DE 2 COLUMNAS IDÉNTICO A LA REFERENCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Card Registrar Transferencia */}
        <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm space-y-5">
          {/* Encabezado del Card */}
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Registrar Transferencia</h2>
              <p className="text-xs text-foreground-muted">
                Transfiere productos entre almacenes de la empresa.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddLine} className="space-y-4">
            {/* FILA 1: Almacén Origen, Botón Swap, Almacén Destino */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* Almacén Origen */}
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                  Almacén Origen <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenOrigenId}
                    onChange={(e) => handleOrigenChange(e.target.value)}
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
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-foreground-muted">
                    <Info className="w-3 h-3 text-sky-400" />
                    <span>
                      Stock disponible:{" "}
                      <strong className="text-foreground">{stockOrigen.disponible} {selectedProduct?.unidad_medida?.codigo || "UND"}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Botón Swap en el centro */}
              <div className="md:col-span-2 flex justify-center items-center pt-6">
                <button
                  type="button"
                  onClick={handleSwapWarehouses}
                  disabled={almacenesDestino.length === 0 || !almacenDestinoId}
                  className="w-9 h-9 rounded-full bg-surface hover:bg-hover border border-border flex items-center justify-center text-foreground-muted hover:text-foreground transition-all cursor-pointer shadow-xs disabled:opacity-40"
                  title="Intercambiar almacenes"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Almacén Destino */}
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                  Almacén Destino <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenDestinoId}
                    onChange={(e) => setAlmacenDestinoId(e.target.value)}
                    disabled={almacenesDestino.length === 0}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {almacenesDestino.length === 0 ? (
                      <option value="" disabled>
                        No hay otros almacenes disponibles
                      </option>
                    ) : (
                      almacenesDestino.map((a) => (
                        <option key={a.almacen_id} value={a.almacen_id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {selectedProduct && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-foreground-muted">
                    <Info className="w-3 h-3 text-sky-400" />
                    <span>
                      Stock actual en destino:{" "}
                      <strong className="text-foreground">{stockDestino.actual} {selectedProduct?.unidad_medida?.codigo || "UND"}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* FILA 2: Referencia / Documento */}
            <div>
              <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                Referencia / Documento <span className="text-foreground-muted font-normal text-[11px]">(opcional)</span>
              </label>
              <input
                type="text"
                value={referenciaGeneral}
                onChange={(e) => setReferenciaGeneral(e.target.value)}
                placeholder="TRF-2026-005, GUIA-98, etc."
                className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* FILA 3: Producto */}
            <div>
              <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
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
                  placeholder="Buscar producto por SKU, nombre..."
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
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-xl divide-y divide-border">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-xs text-foreground-muted text-center">
                        No se encontraron productos coincidentes.
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const exOrg = (p.existencias || []).find(
                          (e) => String(e.almacen_id) === String(almacenOrigenId)
                        );
                        const dispOrg = exOrg ? exOrg.cantidad_actual - (exOrg.cantidad_reservada || 0) : 0;
                        return (
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
                            <span className="text-[11px] text-foreground-muted font-mono">
                              Disp en origen: {dispOrg} {p.unidad_medida?.codigo || "UND"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Info Pill de Producto idéntica a Image 5 */}
              {selectedProduct && (
                <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-400">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Unidad: <strong>{selectedProduct?.unidad_medida?.codigo || "UND"}</strong>
                  </span>
                  <span className="text-sky-600">|</span>
                  <span>
                    Stock en origen: <strong>{stockOrigen.actual}</strong>
                  </span>
                  <span className="text-sky-600">|</span>
                  <span>
                    Stock en destino: <strong>{stockDestino.actual}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* FILA 4: Cantidad y Caja Especial de Stock Proyectado (Exacta a Image 5) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cantidad */}
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                  Cantidad <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={selectedProduct?.unidad_medida?.permite_decimales ? "0.01" : "1"}
                    step={selectedProduct?.unidad_medida?.permite_decimales ? "any" : "1"}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none">
                    {selectedProduct?.unidad_medida?.codigo || "Unidades"}
                  </span>
                </div>
              </div>

              {/* Caja de Stock Proyectado (2 Columnas con divisor y números coloreados rojo/verde) */}
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                  Stock proyectado
                </label>
                <div className="px-3.5 py-2 text-xs bg-input border border-border rounded-lg flex items-center justify-around divide-x divide-border">
                  <div className="pr-4 flex items-center gap-2">
                    <span className="text-foreground-muted text-[11px]">Origen:</span>
                    <span className="font-mono text-xs">
                      {stockOrigen.actual} &rarr;{" "}
                      <strong className="text-red-500 font-bold">
                        {stockOrigen.actual - (parseFloat(cantidad) || 0)}
                      </strong>
                    </span>
                  </div>
                  <div className="pl-4 flex items-center gap-2">
                    <span className="text-foreground-muted text-[11px]">Destino:</span>
                    <span className="font-mono text-xs">
                      {stockDestino.actual} &rarr;{" "}
                      <strong className="text-emerald-500 font-bold">
                        {stockDestino.actual + (parseFloat(cantidad) || 0)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FILA 5: Observación */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-foreground-secondary">
                  Observación <span className="text-foreground-muted font-normal text-[11px]">(opcional)</span>
                </label>
                <span className="text-[10px] text-foreground-muted font-mono">
                  {observacionGeneral.length}/200
                </span>
              </div>
              <input
                type="text"
                maxLength={200}
                value={observacionGeneral}
                onChange={(e) => setObservacionGeneral(e.target.value)}
                placeholder="Transferencia por redistribución de inventario..."
                className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* BOTONES DE ACCIÓN INFERIORES */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetAll}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground-secondary border border-border transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Botón discreto para multiproducto */}
                <button
                  type="button"
                  onClick={handleAddLine}
                  disabled={!selectedProduct || !cantidad || parseFloat(cantidad) <= 0}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingIndex !== null ? "Actualizar línea" : "+ Agregar a lista"}</span>
                </button>

                {/* Botón Registrar Transferencia (Púrpura exacto según referencia) */}
                <button
                  type="button"
                  onClick={handleSubmitBatch}
                  disabled={submitting || (lineas.length === 0 && (!selectedProduct || !cantidad))}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{submitting ? "Transfiriendo..." : "Registrar Transferencia"}</span>
                </button>
              </div>
            </div>

            {/* TABLA DISCRETA DE LÍNEAS MULTIPRODUCTO DENTRO DEL CARD */}
            {lineas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Productos a transferir en este lote ({lineas.length})
                  </span>
                  <span className="text-[11px] text-foreground-muted">
                    Total unidades: <strong>{totales.totalUnidades}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto border border-border rounded-lg max-h-48">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                        <th className="p-2.5">Producto</th>
                        <th className="p-2.5 text-right">Cant.</th>
                        <th className="p-2.5 text-right">Origen (proy)</th>
                        <th className="p-2.5 text-right">Destino (proy)</th>
                        <th className="p-2.5 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lineas.map((l, idx) => (
                        <tr key={l.productoId} className="hover:bg-surface-subtle/50">
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-foreground mr-1.5">
                              {l.codigoProducto}
                            </span>
                            <span className="text-foreground-secondary">{l.nombreProducto}</span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground">
                            {l.cantidad} {l.unidad}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-red-400">
                            {l.stockOrigenProyectado} {l.unidad}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-400">
                            {l.stockDestinoProyectado} {l.unidad}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditLine(idx)}
                                className="p-1 text-foreground-muted hover:text-foreground cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLine(idx)}
                                className="p-1 text-error/70 hover:text-error cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* COLUMNA DERECHA: Resumen de la Transferencia (Tarjetas Origen y Destino lado a lado con conector) */}
        <div className="lg:col-span-4 self-start bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground">Resumen de la Transferencia</h2>
          </div>

          {activeProductForSummary ? (
            <div className="space-y-4 text-xs">
              {/* Mini card de producto */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center flex-shrink-0 text-foreground-muted">
                  <Package className="w-6 h-6 text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground truncate text-sm">
                    {activeProductForSummary.nombre}
                  </h4>
                  <div className="text-xs text-foreground-muted font-mono mb-0.5">
                    {activeProductForSummary.codigo}
                  </div>
                  <div className="text-[11px] text-foreground-muted">
                    Unidad: <strong>{activeProductForSummary.unidad}</strong>
                  </div>
                </div>
              </div>

              {/* DOS TARJETAS LADO A LADO: ORIGEN (VERDE) & DESTINO (AZUL) CON FLECHA AL CENTRO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                {/* Tarjeta Origen (Verde) */}
                <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Almacén Origen</span>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {almOrigenObj?.codigo || "ALM-01"}
                  </div>
                  <div className="text-[11px] text-foreground-muted truncate">
                    {almOrigenObj?.nombre || "Principal"}
                  </div>

                  <div className="pt-2 border-t border-emerald-500/20 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Stock actual:</span>
                      <span className="font-semibold text-foreground">
                        {activeProductForSummary.origenActual} {activeProductForSummary.unidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Cantidad a transferir:</span>
                      <span className="font-bold text-red-400">
                        - {activeProductForSummary.cantidad} {activeProductForSummary.unidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Stock después:</span>
                      <span className="font-bold text-red-400">
                        {activeProductForSummary.origenProyectado} {activeProductForSummary.unidad}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tarjeta Destino (Azul) */}
                <div className="p-3 rounded-xl border border-sky-500/40 bg-sky-950/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px]">
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Almacén Destino</span>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {almDestinoObj?.codigo || "ALM-02"}
                  </div>
                  <div className="text-[11px] text-foreground-muted truncate">
                    {almDestinoObj?.nombre || "Secundario"}
                  </div>

                  <div className="pt-2 border-t border-sky-500/20 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Stock actual:</span>
                      <span className="font-semibold text-foreground">
                        {activeProductForSummary.destinoActual} {activeProductForSummary.unidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Cantidad a recibir:</span>
                      <span className="font-bold text-emerald-400">
                        + {activeProductForSummary.cantidad} {activeProductForSummary.unidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-muted">
                      <span>Stock después:</span>
                      <span className="font-bold text-emerald-400">
                        {activeProductForSummary.destinoProyectado} {activeProductForSummary.unidad}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Callout Púrpura de Atomicidad exacto según Image 5 */}
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>
                  La transferencia se realizará de forma atómica. Se generarán dos movimientos:{" "}
                  <strong>TRAS_SAL</strong> y <strong>TRAS_ENT</strong> con el mismo UUID de transferencia.
                </span>
              </div>

              {/* Resumen multiproducto discreto */}
              {lineas.length > 0 && (
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-foreground-muted">
                  <span>
                    Productos en transferencia: <strong>{lineas.length}</strong>
                  </span>
                  <span>
                    Total unidades: <strong>{totales.totalUnidades}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-foreground-muted">
              Selecciona un producto para previsualizar el impacto de la transferencia entre almacenes.
            </div>
          )}
        </div>
      </div>

      {/* 3. TABLA HISTÓRICA INFERIOR EXACTA SEGÚN REFERENCIA IMAGE 5 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Últimas Transferencias</h2>
              <p className="text-[11px] text-foreground-muted">
                Mostrando las 5 transferencias más recientes
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground bg-surface border border-border rounded-lg font-medium transition-colors"
          >
            <span>Ver todas</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {loadingTransferencias ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            Cargando historial de transferencias...
          </div>
        ) : errorTransferencias ? (
          <div className="p-6 text-center text-xs text-error">{errorTransferencias}</div>
        ) : transferencias.length === 0 ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            No hay transferencias registradas recientemente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Origen</th>
                  <th className="p-3">Destino</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3">Referencia</th>
                  <th className="p-3">UUID</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transferencias.map((t) => (
                  <tr key={t.uuid || Math.random()} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="p-3 text-foreground-muted whitespace-nowrap">
                      {new Date(t.fecha).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <span className="font-mono font-bold mr-1.5">{t.productoCodigo}</span>
                      <span>- {t.productoNombre}</span>
                    </td>
                    <td className="p-3 text-foreground-secondary">
                      <span className="font-semibold text-foreground">{t.origenCodigo}</span>
                    </td>
                    <td className="p-3 text-foreground-secondary">
                      <span className="font-semibold text-foreground">{t.destinoCodigo}</span>
                    </td>
                    <td className="p-3 text-right font-bold font-mono text-foreground">
                      {t.cantidad}
                    </td>
                    <td className="p-3 font-mono text-foreground-muted truncate max-w-[120px]">
                      {t.referencia || "—"}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-purple-400 truncate max-w-[120px]" title={t.uuid}>
                      {t.uuid ? `${t.uuid.substring(0, 18)}...` : "—"}
                    </td>
                    <td className="p-3 text-foreground-secondary whitespace-nowrap">
                      {t.usuario}
                    </td>
                    <td className="p-3 text-center">
                      <button className="text-foreground-muted hover:text-foreground cursor-pointer">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
