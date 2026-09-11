"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Bike,
  Package,
  TrendingDown,
  TrendingUp,
  MinusCircle,
  PlusCircle,
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
  FileText,
  BarChart2,
  ExternalLink,
  MoreVertical,
  Layers,
  Tag,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

export default function InventoryAdjustmentsView() {
  // Tabs: "SALIDA" | "AJU_POS" | "AJU_NEG"
  const [activeTab, setActiveTab] = useState("SALIDA");

  // Catálogos
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [errorMovimientos, setErrorMovimientos] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cabecera de la operación
  const [almacenId, setAlmacenId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [referenciaGeneral, setReferenciaGeneral] = useState("");
  const [observacionGeneral, setObservacionGeneral] = useState("");

  // Líneas temporales de la operación multiproducto
  const [lineas, setLineas] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  // Formulario para agregar/editar una línea
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");

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

  // Cargar movimientos recientes según la pestaña
  const loadMovimientos = useCallback(async (tab) => {
    try {
      setLoadingMovimientos(true);
      setErrorMovimientos(null);
      // Para SALIDA consultamos todos los ajustes y salidas recientes (mostrando badges variados como en la imagen de referencia)
      // Para AJU_POS o AJU_NEG filtramos específicamente
      const url =
        tab === "SALIDA"
          ? `/api/inventario/ajustes?limit=5`
          : `/api/inventario/ajustes?tipo=${tab}&limit=5`;

      const res = await fetch(url);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMovimientos(activeTab);
  }, [activeTab, loadMovimientos]);

  // Producto seleccionado en el editor
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Almacén seleccionado
  const selectedAlmacen = useMemo(() => {
    if (!almacenId) return null;
    return almacenes.find((a) => String(a.almacen_id) === String(almacenId)) || null;
  }, [almacenes, almacenId]);

  // Stock details para el producto y almacén seleccionado
  const stockInfo = useMemo(() => {
    if (!selectedProduct || !almacenId) {
      return { actual: 0, reservado: 0, disponible: 0, costoPromedio: selectedProduct?.costo_actual || 0 };
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

    if (activeTab === "AJU_POS") {
      const ex = (prod.existencias || []).find((e) => String(e.almacen_id) === String(almacenId));
      const cost = ex ? Number(ex.costo_promedio) : (prod.costo_actual || 0);
      setCostoUnitario(cost > 0 ? String(cost) : "0.00");
    }
  };

  const resetLineForm = () => {
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setCostoUnitario("");
    setEditingIndex(null);
  };

  // Cambio de pestaña: limpia líneas si existen con confirmación
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    if (lineas.length > 0) {
      if (!window.confirm("Cambiar de operación descartará las líneas agregadas. ¿Deseas continuar?")) {
        return;
      }
    }
    setActiveTab(newTab);
    setLineas([]);
    resetLineForm();
    setMotivo("");
    setReferenciaGeneral("");
    setObservacionGeneral("");
    setFeedback(null);
  };

  // Agregar o actualizar línea temporal
  const handleAddLine = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback(null);

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona primero un almacén." });
      return;
    }
    if (!selectedProduct) {
      setFeedback({ type: "error", message: "Selecciona un producto para agregar." });
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0." });
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

    // Para SALIDA y AJU_NEG: validar stock disponible (respetando reservas)
    const isSalidaOrNegativo = activeTab === "SALIDA" || activeTab === "AJU_NEG";
    if (isSalidaOrNegativo && cantNum > stockInfo.disponible) {
      setFeedback({
        type: "error",
        message: `Stock disponible insuficiente para '${selectedProduct.nombre}'. Disponible: ${stockInfo.disponible}, Solicitado: ${cantNum}.`,
      });
      return;
    }

    let costoNum = stockInfo.costoPromedio;
    if (activeTab === "AJU_POS") {
      costoNum = parseFloat(costoUnitario);
      if (isNaN(costoNum) || costoNum < 0) {
        setFeedback({ type: "error", message: "El costo unitario no puede ser negativo en ajuste positivo." });
        return;
      }
    }

    // Validar duplicados
    const duplicateIndex = lineas.findIndex(
      (l, idx) => l.productoId === selectedProduct.producto_id && idx !== editingIndex
    );
    if (duplicateIndex >= 0) {
      setFeedback({
        type: "error",
        message: "Este producto ya está agregado. Edita la línea existente o modifica la cantidad.",
      });
      return;
    }

    const stockProy =
      activeTab === "AJU_POS" ? stockInfo.actual + cantNum : stockInfo.actual - cantNum;

    const newLine = {
      productoId: selectedProduct.producto_id,
      codigoProducto: selectedProduct.codigo_producto,
      nombreProducto: selectedProduct.nombre,
      marca: selectedProduct.marca_nombre || "Genérico",
      unidad: selectedProduct.unidad_medida?.codigo || "UND",
      permiteDecimales: permiteDec,
      cantidad: cantNum,
      costoUnitario: costoNum,
      costoTotal: Number((cantNum * costoNum).toFixed(2)),
      stockActual: stockInfo.actual,
      stockReservado: stockInfo.reservado,
      stockDisponible: stockInfo.disponible,
      stockProyectado: stockProy,
    };

    if (editingIndex !== null) {
      const updated = [...lineas];
      updated[editingIndex] = newLine;
      setLineas(updated);
      setFeedback({ type: "success", message: "Línea actualizada." });
    } else {
      setLineas((prev) => [...prev, newLine]);
      setFeedback({ type: "success", message: `Producto '${selectedProduct.nombre}' agregado a la lista.` });
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
      if (activeTab === "AJU_POS") {
        setCostoUnitario(String(l.costoUnitario));
      }
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
    const totalValor = lineas.reduce((acc, l) => acc + l.costoTotal, 0);
    return { totalLineas, totalUnidades, totalValor };
  }, [lineas]);

  const handleResetAll = () => {
    if (lineas.length > 0) {
      if (!window.confirm("¿Estás seguro de que deseas limpiar toda la operación? Se perderán las líneas agregadas.")) {
        return;
      }
    }
    setLineas([]);
    resetLineForm();
    setMotivo("");
    setReferenciaGeneral("");
    setObservacionGeneral("");
    setFeedback(null);
  };

  // Submit batch atómico en PostgreSQL
  const handleSubmitOperation = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback(null);

    // Si no hay líneas en la lista temporal, pero hay un producto completo en el formulario, intentar agregarlo automáticamente
    let batchLines = [...lineas];
    if (batchLines.length === 0) {
      if (selectedProduct && parseFloat(cantidad) > 0) {
        const cantNum = parseFloat(cantidad);
        const isSalidaOrNegativo = activeTab === "SALIDA" || activeTab === "AJU_NEG";
        if (isSalidaOrNegativo && cantNum > stockInfo.disponible) {
          setFeedback({
            type: "error",
            message: `Stock disponible insuficiente. Disponible: ${stockInfo.disponible}, Solicitado: ${cantNum}.`,
          });
          return;
        }
        let cUnit = stockInfo.costoPromedio;
        if (activeTab === "AJU_POS") {
          cUnit = parseFloat(costoUnitario);
          if (isNaN(cUnit) || cUnit < 0) {
            setFeedback({ type: "error", message: "Indica un costo unitario válido." });
            return;
          }
        }
        batchLines.push({
          productoId: selectedProduct.producto_id,
          codigoProducto: selectedProduct.codigo_producto,
          nombreProducto: selectedProduct.nombre,
          marca: selectedProduct.marca_nombre || "Genérico",
          unidad: selectedProduct.unidad_medida?.codigo || "UND",
          cantidad: cantNum,
          costoUnitario: cUnit,
          costoTotal: Number((cantNum * cUnit).toFixed(2)),
        });
      }
    }

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona un almacén." });
      return;
    }
    if (!motivo.trim()) {
      setFeedback({ type: "error", message: "El motivo de la operación es obligatorio." });
      return;
    }
    if (batchLines.length === 0) {
      setFeedback({ type: "error", message: "Selecciona un producto e indica la cantidad antes de registrar." });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `${activeTab}-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        tipo: activeTab,
        almacenId: Number(almacenId),
        motivo: motivo.trim(),
        observacion: observacionGeneral.trim() || null,
        referencia: referenciaGeneral.trim() || null,
        lineas: batchLines.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          costoUnitario: activeTab === "AJU_POS" ? l.costoUnitario : null,
        })),
      };

      const res = await fetch("/api/inventario/ajustes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar la operación.");
      }

      setFeedback({
        type: "success",
        message: `${data.mensaje || "Operación registrada exitosamente."} Código: ${data.codigoMovimiento}`,
      });

      setLineas([]);
      resetLineForm();
      setMotivo("");
      setReferenciaGeneral("");
      setObservacionGeneral("");
      await loadCatalogos();
      await loadMovimientos(activeTab);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al registrar la operación.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Datos para el Resumen Derecho
  const activeProductForSummary = useMemo(() => {
    if (selectedProduct) {
      const cantNum = parseFloat(cantidad) || 0;
      let cost = stockInfo.costoPromedio;
      if (activeTab === "AJU_POS") {
        cost = parseFloat(costoUnitario) || stockInfo.costoPromedio;
      }
      const isPos = activeTab === "AJU_POS";
      const stockProy = isPos ? stockInfo.actual + cantNum : stockInfo.actual - cantNum;
      return {
        isEditing: true,
        producto: selectedProduct,
        codigo: selectedProduct.codigo_producto,
        nombre: selectedProduct.nombre,
        unidad: selectedProduct.unidad_medida?.codigo || "UND",
        stockActual: stockInfo.actual,
        cantidad: cantNum,
        stockProyectado: stockProy,
        costoUnitario: cost,
        costoTotal: Number((cantNum * cost).toFixed(2)),
        pmpActual: stockInfo.costoPromedio,
        pmpProyectado: isPos && (stockInfo.actual + cantNum > 0)
          ? Number(((stockInfo.actual * stockInfo.costoPromedio + cantNum * cost) / (stockInfo.actual + cantNum)).toFixed(2))
          : stockInfo.costoPromedio,
      };
    } else if (lineas.length > 0) {
      const last = lineas[lineas.length - 1];
      return {
        isEditing: false,
        producto: null,
        codigo: last.codigoProducto,
        nombre: last.nombreProducto,
        unidad: last.unidad,
        stockActual: last.stockActual,
        cantidad: last.cantidad,
        stockProyectado: last.stockProyectado,
        costoUnitario: last.costoUnitario,
        costoTotal: last.costoTotal,
        pmpActual: last.costoUnitario,
        pmpProyectado: last.costoUnitario,
      };
    }
    return null;
  }, [selectedProduct, cantidad, costoUnitario, stockInfo, activeTab, lineas]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER EXACTO SEGÚN REFERENCIA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
            <Link href="/inventory/summary" className="hover:text-foreground transition-colors">
              Inventario
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-medium">Salidas y Ajustes</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
              <Bike className="w-7 h-7" />
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

      {/* 2. TABS DE OPERACIÓN EXACTOS SEGÚN REFERENCIAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* TAB SALIDA */}
        <button
          type="button"
          onClick={() => handleTabChange("SALIDA")}
          className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "SALIDA"
              ? "bg-red-950/20 border-red-500/70 shadow-sm ring-1 ring-red-500/30"
              : "bg-surface border-border hover:bg-hover text-foreground-secondary opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`p-2.5 rounded-lg flex items-center justify-center ${
              activeTab === "SALIDA"
                ? "bg-red-500 text-white shadow-xs"
                : "bg-surface-subtle text-foreground-muted"
            }`}
          >
            <ArrowRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Salida</div>
            <div className="text-[11px] text-foreground-muted">Disminuye el inventario</div>
          </div>
        </button>

        {/* TAB AJUSTE POSITIVO */}
        <button
          type="button"
          onClick={() => handleTabChange("AJU_POS")}
          className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "AJU_POS"
              ? "bg-emerald-950/20 border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/30"
              : "bg-surface border-border hover:bg-hover text-foreground-secondary opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`p-2.5 rounded-lg flex items-center justify-center ${
              activeTab === "AJU_POS"
                ? "bg-emerald-500 text-white shadow-xs"
                : "bg-surface-subtle text-foreground-muted"
            }`}
          >
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Ajuste Positivo</div>
            <div className="text-[11px] text-foreground-muted">Aumenta el inventario</div>
          </div>
        </button>

        {/* TAB AJUSTE NEGATIVO */}
        <button
          type="button"
          onClick={() => handleTabChange("AJU_NEG")}
          className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === "AJU_NEG"
              ? "bg-amber-950/20 border-amber-500/80 shadow-sm ring-1 ring-amber-500/30"
              : "bg-surface border-border hover:bg-hover text-foreground-secondary opacity-75 hover:opacity-100"
          }`}
        >
          <div
            className={`p-2.5 rounded-lg flex items-center justify-center ${
              activeTab === "AJU_NEG"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-surface-subtle text-foreground-muted"
            }`}
          >
            <MinusCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Ajuste Negativo</div>
            <div className="text-[11px] text-foreground-muted">Disminuye el inventario</div>
          </div>
        </button>
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

      {/* 3. LAYOUT PRINCIPAL DE 2 COLUMNAS IDÉNTICO A LAS IMÁGENES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (Card de Operación) */}
        <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm space-y-5">
          {/* Encabezado del Formulario según pestaña */}
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            {activeTab === "SALIDA" && (
              <>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Registrar Salida Manual</h2>
                  <p className="text-xs text-foreground-muted">
                    Registra una salida de inventario por consumo, venta u otro motivo operativo
                  </p>
                </div>
              </>
            )}
            {activeTab === "AJU_POS" && (
              <>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Registrar Ajuste Positivo</h2>
                  <p className="text-xs text-foreground-muted">
                    Aumenta el inventario por regularización, conteo físico, corrección, etc.
                  </p>
                </div>
              </>
            )}
            {activeTab === "AJU_NEG" && (
              <>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <MinusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Registrar Ajuste Negativo</h2>
                  <p className="text-xs text-foreground-muted">
                    Disminuye el inventario por daño, merma, pérdida, error de registro, etc.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Formulario Principal */}
          <form onSubmit={handleAddLine} className="space-y-4">
            {activeTab === "SALIDA" ? (
              /* TAB SALIDA: Orden visual requerido: Almacén y Referencia en Cabecera */
              <>
                {/* FILA 1: Almacén * (Izquierda) y Referencia / Documento (Derecha) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Almacén */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                      Almacén <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                      <select
                        value={almacenId}
                        onChange={(e) => {
                          if (lineas.length > 0) {
                            if (
                              !window.confirm(
                                "Cambiar el almacén recalculará o descartará las líneas actuales. ¿Continuar?"
                              )
                            ) {
                              return;
                            }
                            setLineas([]);
                            resetLineForm();
                          }
                          setAlmacenId(e.target.value);
                        }}
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

                  {/* Referencia / Documento común a la operación */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                      Referencia / Documento
                    </label>
                    <input
                      type="text"
                      value={referenciaGeneral}
                      onChange={(e) => setReferenciaGeneral(e.target.value)}
                      placeholder="SAL-2026-010, Documento #, etc."
                      className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* FILA 2: Producto Selector */}
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
                            const ex = (p.existencias || []).find(
                              (e) => String(e.almacen_id) === String(almacenId)
                            );
                            const disp = ex ? ex.cantidad_actual - (ex.cantidad_reservada || 0) : 0;
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
                                  Disp: {disp} {p.unidad_medida?.codigo || "UND"}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info Pill debajo del selector de Producto */}
                  {selectedProduct && (
                    <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-400">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Unidad: <strong>{selectedProduct?.unidad_medida?.codigo || "UND"}</strong>
                      </span>
                      <span className="text-sky-600">|</span>
                      <span>
                        Stock actual: <strong>{stockInfo.actual}</strong>
                      </span>
                      <span className="text-sky-600">|</span>
                      <span>
                        Costo prom.:{" "}
                        <strong>
                          RD$ {stockInfo.costoPromedio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* FILA 3: Cantidad y Motivo */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Cantidad */}
                  <div className="md:col-span-4">
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

                  {/* Motivo */}
                  <div className="md:col-span-8">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-foreground-secondary">
                        Motivo <span className="text-error">*</span>
                      </label>
                      <span className="text-[10px] text-foreground-muted font-mono">
                        {motivo.length}/200
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={200}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Venta de mostrador, consumo interno..."
                      className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* FILA 4: Observación (opcional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-foreground-secondary">
                      Observación (opcional)
                    </label>
                    <span className="text-[10px] text-foreground-muted font-mono">
                      {observacionGeneral.length}/500
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={500}
                    value={observacionGeneral}
                    onChange={(e) => setObservacionGeneral(e.target.value)}
                    placeholder="Observaciones adicionales de la salida..."
                    className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </>
            ) : (
              /* AJUSTE POSITIVO Y AJUSTE NEGATIVO (Diseño restaurado intacto según Sección 11) */
              <>
                {/* FILA 1: Almacén y Producto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Almacén */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                      Almacén <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                      <select
                        value={almacenId}
                        onChange={(e) => {
                          if (lineas.length > 0) {
                            if (
                              !window.confirm(
                                "Cambiar el almacén recalculará o descartará las líneas actuales. ¿Continuar?"
                              )
                            ) {
                              return;
                            }
                            setLineas([]);
                            resetLineForm();
                          }
                          setAlmacenId(e.target.value);
                        }}
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

                  {/* Producto Selector */}
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
                              const ex = (p.existencias || []).find(
                                (e) => String(e.almacen_id) === String(almacenId)
                              );
                              const disp = ex ? ex.cantidad_actual - (ex.cantidad_reservada || 0) : 0;
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
                                    Disp: {disp} {p.unidad_medida?.codigo || "UND"}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Info Pill debajo del selector de Producto */}
                    {selectedProduct && (
                      <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-400">
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          Unidad: <strong>{selectedProduct?.unidad_medida?.codigo || "UND"}</strong>
                        </span>
                        <span className="text-sky-600">|</span>
                        <span>
                          Stock actual: <strong>{stockInfo.actual}</strong>
                        </span>
                        <span className="text-sky-600">|</span>
                        <span>
                          Costo prom.:{" "}
                          <strong>
                            RD$ {stockInfo.costoPromedio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FILA 2: Específica de AJU_POS o AJU_NEG */}
                {activeTab === "AJU_POS" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                          Costo unitario <span className="text-error">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={costoUnitario}
                            onChange={(e) => setCostoUnitario(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-foreground-secondary">
                          Motivo del ajuste <span className="text-error">*</span>
                        </label>
                        <span className="text-[10px] text-foreground-muted font-mono">
                          {motivo.length}/200
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={200}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Conteo físico - inventario mensual, corrección..."
                        className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "AJU_NEG" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                          Stock resultante
                        </label>
                        <div className="px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground flex items-center justify-between font-mono">
                          <span>
                            {stockInfo.actual} &nbsp;—&nbsp; {parseFloat(cantidad) || 0}
                          </span>
                          <span className="font-bold text-red-500">
                            = {stockInfo.actual - (parseFloat(cantidad) || 0)}{" "}
                            {selectedProduct?.unidad_medida?.codigo || "UND"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-foreground-secondary">
                          Motivo del ajuste <span className="text-error">*</span>
                        </label>
                        <span className="text-[10px] text-foreground-muted font-mono">
                          {motivo.length}/200
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={200}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Producto dañado en transporte, merma..."
                        className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* FILA 3: Referencia y Observación para Ajustes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">
                      Referencia / Documento
                    </label>
                    <input
                      type="text"
                      value={referenciaGeneral}
                      onChange={(e) => setReferenciaGeneral(e.target.value)}
                      placeholder="Ej. Factura #1234, OT-5678, AJU-2025-01..."
                      className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-foreground-secondary">
                        Observación (opcional)
                      </label>
                      <span className="text-[10px] text-foreground-muted font-mono">
                        {observacionGeneral.length}/500
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={500}
                      value={observacionGeneral}
                      onChange={(e) => setObservacionGeneral(e.target.value)}
                      placeholder="Observaciones adicionales..."
                      className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            {/* BOTONES DE ACCIÓN INFERIORES DEL CARD */}
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

                {/* Botón Registrar según color de pestaña de la referencia */}
                <button
                  type="button"
                  onClick={handleSubmitOperation}
                  disabled={submitting || (lineas.length === 0 && (!selectedProduct || !cantidad))}
                  className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === "SALIDA"
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : activeTab === "AJU_POS"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  {activeTab === "SALIDA" && <ArrowRight className="w-4 h-4" />}
                  {activeTab === "AJU_POS" && <Plus className="w-4 h-4" />}
                  {activeTab === "AJU_NEG" && <MinusCircle className="w-4 h-4" />}
                  <span>
                    {submitting
                      ? "Registrando..."
                      : activeTab === "SALIDA"
                      ? "Registrar Salida"
                      : activeTab === "AJU_POS"
                      ? "Registrar Ajuste Positivo"
                      : "Registrar Ajuste Negativo"}
                  </span>
                </button>
              </div>
            </div>

            {/* TABLA DISCRETA DE LÍNEAS MULTIPRODUCTO DENTRO DEL CARD */}
            {lineas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Líneas listas para registrar ({lineas.length})
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
                        {activeTab === "AJU_POS" && <th className="p-2.5 text-right">Costo</th>}
                        <th className="p-2.5 text-right">Proyectado</th>
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
                          <td className="p-2.5 text-right font-bold">
                            <span className={activeTab === "AJU_POS" ? "text-emerald-500" : "text-red-500"}>
                              {activeTab === "AJU_POS" ? `+${l.cantidad}` : `-${l.cantidad}`} {l.unidad}
                            </span>
                          </td>
                          {activeTab === "AJU_POS" && (
                            <td className="p-2.5 text-right font-mono text-foreground-muted">
                              RD$ {l.costoUnitario.toFixed(2)}
                            </td>
                          )}
                          <td className="p-2.5 text-right font-mono font-bold text-foreground">
                            {l.stockProyectado} {l.unidad}
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

        {/* COLUMNA DERECHA: Resumen de la Operación / Resumen del Ajuste */}
        <div className="lg:col-span-4 self-start bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground">
              {activeTab === "SALIDA" ? "Resumen de la Operación" : "Resumen del Ajuste"}
            </h2>
          </div>

          {/* Tarjeta compacta del producto seleccionado */}
          {activeProductForSummary ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center flex-shrink-0 text-foreground-muted">
                  <Package className="w-6 h-6 text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground truncate text-sm">
                    {activeProductForSummary.nombre}
                  </h4>
                  <div className="text-xs text-foreground-muted font-mono mb-1">
                    {activeProductForSummary.codigo}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-foreground-secondary">
                    <Warehouse className="w-3.5 h-3.5 text-foreground-muted" />
                    <span>{selectedAlmacen?.nombre || "Almacén Principal"}</span>
                  </div>
                </div>
              </div>

              {/* Lista de métricas idéntica a las imágenes */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>Stock actual:</span>
                  <span className="font-bold text-foreground">
                    {activeProductForSummary.stockActual} {activeProductForSummary.unidad}
                  </span>
                </div>

                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>
                    {activeTab === "SALIDA"
                      ? "Cantidad a salir:"
                      : activeTab === "AJU_POS"
                      ? "Cantidad a agregar:"
                      : "Cantidad a reducir:"}
                  </span>
                  <span
                    className={`font-bold ${
                      activeTab === "AJU_POS" ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {activeTab === "AJU_POS" ? "+" : "-"} {activeProductForSummary.cantidad}{" "}
                    {activeProductForSummary.unidad}
                  </span>
                </div>

                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>Stock proyectado:</span>
                  <span
                    className={`font-bold ${
                      activeTab === "AJU_NEG" ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    {activeProductForSummary.stockProyectado} {activeProductForSummary.unidad}
                  </span>
                </div>

                <div className="h-px bg-border my-2" />

                {/* Métricas de Costo / PMP */}
                {activeTab === "SALIDA" && (
                  <>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Costo promedio actual:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.costoUnitario.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Valor de la salida:</span>
                      <span className="font-bold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.costoTotal.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>PMP proyectado:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.pmpProyectado.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </>
                )}

                {activeTab === "AJU_POS" && (
                  <>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Costo unitario:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.costoUnitario.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Costo total del ajuste:</span>
                      <span className="font-bold text-emerald-500 font-mono">
                        RD${" "}
                        {activeProductForSummary.costoTotal.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>PMP actual:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.pmpActual.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>PMP proyectado (estimado):</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.pmpProyectado.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </>
                )}

                {activeTab === "AJU_NEG" && (
                  <>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Costo promedio actual:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.costoUnitario.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>Valor del ajuste:</span>
                      <span className="font-bold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.costoTotal.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-foreground-secondary">
                      <span>PMP después del ajuste:</span>
                      <span className="font-semibold text-foreground font-mono">
                        RD${" "}
                        {activeProductForSummary.pmpProyectado.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Callouts específicos por tipo de operación según imágenes de referencia */}
              {activeTab === "AJU_NEG" ? (
                <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-[11px] text-red-400 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-400">
                      Este ajuste disminuirá el inventario de forma permanente.
                    </div>
                    <div className="text-red-400/80">
                      Verifique que la información sea correcta antes de continuar.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/30 text-[11px] text-sky-400 flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <span>
                    El PMP proyectado es solo informativo. El cálculo definitivo lo realiza el sistema al
                    registrar {activeTab === "SALIDA" ? "la salida" : "el ajuste"}.
                  </span>
                </div>
              )}

              {/* Resumen multiproducto discreto si hay varias líneas */}
              {lineas.length > 0 && (
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-foreground-muted">
                  <span>
                    Líneas en lote: <strong>{lineas.length}</strong>
                  </span>
                  <span>
                    Total unidades: <strong>{totales.totalUnidades}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-foreground-muted">
              Selecciona un producto para previsualizar el impacto en el inventario.
            </div>
          )}
        </div>
      </div>

      {/* 4. TABLA HISTÓRICA INFERIOR EXACTA SEGÚN REFERENCIAS */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                activeTab === "SALIDA"
                  ? "bg-purple-500/10 text-purple-500"
                  : activeTab === "AJU_POS"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {activeTab === "SALIDA"
                  ? "Últimas Salidas y Ajustes"
                  : activeTab === "AJU_POS"
                  ? "Últimos Ajustes Positivos"
                  : "Últimos Ajustes Negativos"}
              </h2>
              <p className="text-[11px] text-foreground-muted">
                {activeTab === "SALIDA"
                  ? "Mostrando los últimos 5 movimientos de salida y ajuste"
                  : activeTab === "AJU_POS"
                  ? "Mostrando los 5 ajustes positivos más recientes"
                  : "Mostrando los 5 ajustes negativos más recientes"}
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground bg-surface border border-border rounded-lg font-medium transition-colors"
          >
            <span>Ver todos</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {loadingMovimientos ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            Cargando historial de movimientos...
          </div>
        ) : errorMovimientos ? (
          <div className="p-6 text-center text-xs text-error">{errorMovimientos}</div>
        ) : movimientos.length === 0 ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            No hay movimientos registrados recientemente para esta categoría.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "SALIDA" ? (
              // Tabla para SALIDA (Image 2): Fecha, Código Movimiento, Tipo, Producto, Almacén, Cant. Movimiento, Stock Anterior, Stock Nuevo, Referencia, Usuario
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Código Movimiento</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Almacén</th>
                    <th className="p-3 text-right">Cantidad</th>
                    <th className="p-3 text-right">Stock Anterior</th>
                    <th className="p-3 text-right">Stock Nuevo</th>
                    <th className="p-3">Referencia</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movimientos.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="p-3 text-foreground-muted whitespace-nowrap">
                        {new Date(m.fecha).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {m.codigoMovimiento && m.codigoMovimiento !== "-" ? (
                          <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                            {m.codigoMovimiento}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-foreground-muted">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.tipoCodigo === "SAL_MANUAL"
                              ? "bg-red-500/15 text-red-400 border border-red-500/30"
                              : m.tipoCodigo === "AJU_POS"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {m.tipoCodigo === "SAL_MANUAL" ? "SALIDA" : m.tipoCodigo}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        <span className="font-mono font-bold mr-1.5">{m.productoCodigo}</span>
                        <span>- {m.productoNombre}</span>
                      </td>
                      <td className="p-3 text-foreground-secondary">{m.almacenNombre}</td>
                      <td className="p-3 text-right font-bold font-mono">
                        <span className={m.naturaleza === "ENTRADA" ? "text-emerald-500" : "text-red-500"}>
                          {m.naturaleza === "ENTRADA" ? `+${m.cantidad}` : `-${m.cantidad}`}
                        </span>
                      </td>
                      <td className="p-3 text-right text-foreground-muted font-mono">
                        {m.stockAnterior !== null ? m.stockAnterior : "—"}
                      </td>
                      <td className="p-3 text-right text-foreground font-mono font-semibold">
                        {m.stockNuevo !== null ? m.stockNuevo : "—"}
                      </td>
                      <td className="p-3 text-foreground-muted truncate max-w-[150px]">
                        {m.referencia || m.motivo || "—"}
                      </td>
                      <td className="p-3 text-foreground-secondary whitespace-nowrap">
                        {m.usuario}
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
            ) : (
              // Tabla para AJUSTE POSITIVO y NEGATIVO (Images 3 y 4): Fecha, Código Movimiento, Producto, Almacén, Cantidad, Costo Unit., Valor Total, Motivo, Referencia, Usuario
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Código Movimiento</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Almacén</th>
                    <th className="p-3 text-right">Cantidad</th>
                    <th className="p-3 text-right">Costo Unit.</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Referencia</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movimientos.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="p-3 text-foreground-muted whitespace-nowrap">
                        {new Date(m.fecha).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {m.codigoMovimiento && m.codigoMovimiento !== "-" ? (
                          <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                            {m.codigoMovimiento}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-foreground-muted">—</span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        <span className="font-mono font-bold mr-1.5">{m.productoCodigo}</span>
                        <span>- {m.productoNombre}</span>
                      </td>
                      <td className="p-3 text-foreground-secondary">{m.almacenNombre}</td>
                      <td className="p-3 text-right font-bold font-mono">
                        <span className={m.naturaleza === "ENTRADA" ? "text-emerald-500" : "text-red-500"}>
                          {m.naturaleza === "ENTRADA" ? `+${m.cantidad}` : `-${m.cantidad}`}
                        </span>
                      </td>
                      <td className="p-3 text-right text-foreground-muted font-mono">
                        RD$ {Number(m.costoUnitario || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-foreground font-mono font-bold">
                        RD$ {Number(m.costoTotal || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-foreground-muted truncate max-w-[150px]">
                        {m.motivo || "—"}
                      </td>
                      <td className="p-3 font-mono text-foreground-muted">
                        {m.referencia || "—"}
                      </td>
                      <td className="p-3 text-foreground-secondary whitespace-nowrap">
                        {m.usuario}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
