"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  BarChart3,
  Clock,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Warehouse,
  User,
  Search,
  ChevronDown,
  Info,
  ArrowRight,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Eye,
  Check,
} from "lucide-react";

export default function InventoryEntriesView() {
  // Catálogos
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [ultimasEntradas, setUltimasEntradas] = useState([]);
  const [errorEntradas, setErrorEntradas] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cabecera de la operación
  const [almacenId, setAlmacenId] = useState("");
  const [proveedorGeneralId, setProveedorGeneralId] = useState(""); // Proveedor general opcional
  const [observacionGeneral, setObservacionGeneral] = useState("");

  // Líneas temporales del lote multiproducto
  const [lineas, setLineas] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  // Formulario para editar/agregar una línea
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [referenciaLinea, setReferenciaLinea] = useState("");
  const [lineProveedorId, setLineProveedorId] = useState(""); // Proveedor específico de la línea

  // Búsqueda de productos
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // Alertas / Feedback
  const [feedback, setFeedback] = useState(null);

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

      // Proveedores generales
      if (data.proveedores && data.proveedores.length > 0) {
        setProveedores(data.proveedores);
      } else {
        const provMap = new Map();
        (data.productos || []).forEach((p) => {
          (p.proveedores || []).forEach((pr) => {
            if (!provMap.has(String(pr.proveedor_id))) {
              provMap.set(String(pr.proveedor_id), {
                proveedor_id: pr.proveedor_id,
                codigo_proveedor: pr.codigo_proveedor,
                nombre_comercial: pr.nombre_comercial,
              });
            }
          });
        });
        setProveedores(Array.from(provMap.values()));
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

  // Cargar últimas entradas
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

  // Almacén seleccionado
  const selectedAlmacen = useMemo(() => {
    if (!almacenId) return null;
    return almacenes.find((a) => String(a.almacen_id) === String(almacenId)) || null;
  }, [almacenes, almacenId]);

  // Producto seleccionado actualmente en el formulario de línea
  const selectedProduct = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.producto_id) === String(productoId)) || null;
  }, [productos, productoId]);

  // Proveedores asociados al producto actual
  const productProviders = useMemo(() => {
    return selectedProduct?.proveedores || [];
  }, [selectedProduct]);

  // Proveedor efectivo de la línea actual
  const effectiveLineProvider = useMemo(() => {
    if (lineProveedorId) {
      const match = productProviders.find((p) => String(p.proveedor_id) === String(lineProveedorId));
      if (match) return match;
      return proveedores.find((p) => String(p.proveedor_id) === String(lineProveedorId)) || null;
    }
    if (proveedorGeneralId) {
      return proveedores.find((p) => String(p.proveedor_id) === String(proveedorGeneralId)) || null;
    }
    return null;
  }, [lineProveedorId, proveedorGeneralId, productProviders, proveedores]);

  // Existencia en el almacén seleccionado para el producto actual
  const selectedStockInfo = useMemo(() => {
    if (!selectedProduct || !almacenId) {
      return { actual: 0, reservado: 0, disponible: 0, costoPromedio: selectedProduct?.costo_actual || 0 };
    }
    const ex = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(almacenId)
    );
    return {
      actual: ex ? Number(ex.cantidad_actual) : 0,
      reservado: ex ? Number(ex.cantidad_reservada) : 0,
      disponible: ex ? Number(ex.cantidad_disponible) : 0,
      costoPromedio: ex ? Number(ex.costo_promedio) : (selectedProduct.costo_actual || 0),
    };
  }, [selectedProduct, almacenId]);

  const cantidadNum = parseFloat(cantidad) || 0;
  const costoUnitarioNum = parseFloat(costoUnitario) || 0;
  const subtotalLinea = cantidadNum * costoUnitarioNum;
  const stockProyectado = selectedStockInfo.actual + cantidadNum;

  // Cálculo de PMP estimado de la línea
  const pmpProyectado = useMemo(() => {
    if (selectedStockInfo.actual <= 0 || selectedStockInfo.costoPromedio <= 0) {
      return costoUnitarioNum > 0 ? costoUnitarioNum : selectedStockInfo.costoPromedio;
    }
    if (cantidadNum <= 0 || costoUnitarioNum <= 0) {
      return selectedStockInfo.costoPromedio;
    }
    const valorActual = selectedStockInfo.actual * selectedStockInfo.costoPromedio;
    const valorEntrada = cantidadNum * costoUnitarioNum;
    const nuevoTotal = selectedStockInfo.actual + cantidadNum;
    return nuevoTotal > 0 ? (valorActual + valorEntrada) / nuevoTotal : selectedStockInfo.costoPromedio;
  }, [selectedStockInfo, cantidadNum, costoUnitarioNum]);

  // Filtrado de productos en el buscador (Habilitado sin requerir proveedor)
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

  // Manejar selección de producto según reglas funcionales INV-2C.3
  const handleSelectProduct = (prod) => {
    setProductoId(String(prod.producto_id));
    setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
    setProductDropdownOpen(false);

    const provs = prod.proveedores || [];
    let resolvedProvId = "";
    let suggestedCost = prod.costo_actual || 0;

    // CASO A: Producto tiene proveedor_principal activo
    const principal = provs.find((p) => p.proveedor_principal);
    if (principal) {
      resolvedProvId = String(principal.proveedor_id);
      if (principal.costo_compra > 0) suggestedCost = principal.costo_compra;
    } else if (provs.length === 1) {
      // CASO B: Producto tiene exactamente un proveedor activo
      resolvedProvId = String(provs[0].proveedor_id);
      if (provs[0].costo_compra > 0) suggestedCost = provs[0].costo_compra;
    } else if (provs.length > 1) {
      // CASO C: Varios proveedores y ninguno principal -> primer proveedor sugerido
      resolvedProvId = String(provs[0].proveedor_id);
      if (provs[0].costo_compra > 0) suggestedCost = provs[0].costo_compra;
    } else if (proveedorGeneralId) {
      // CASO D: Producto sin proveedor -> usa proveedor general opcional si existe
      resolvedProvId = String(proveedorGeneralId);
    } else {
      // CASO E: Sin proveedor asociado y sin proveedor general
      resolvedProvId = "";
    }

    setLineProveedorId(resolvedProvId);
    setCostoUnitario(suggestedCost > 0 ? String(suggestedCost) : "");
  };

  // Reset del formulario de una línea
  const resetLineForm = () => {
    setProductoId("");
    setProductSearch("");
    setCantidad("");
    setCostoUnitario("");
    setReferenciaLinea("");
    setLineProveedorId("");
    setEditingIndex(null);
  };

  // Agregar o actualizar línea en la lista temporal
  const handleAddOrUpdateLine = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFeedback(null);

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona primero un almacén de destino." });
      return;
    }
    if (!selectedProduct) {
      setFeedback({ type: "error", message: "Selecciona un producto para la entrada." });
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

    const costoNum = parseFloat(costoUnitario);
    if (isNaN(costoNum) || costoNum < 0) {
      setFeedback({ type: "error", message: "El costo unitario no puede ser negativo." });
      return;
    }

    // Validar duplicados en el lote actual
    const duplicateIndex = lineas.findIndex(
      (l, idx) => l.productoId === selectedProduct.producto_id && idx !== editingIndex
    );
    if (duplicateIndex >= 0) {
      setFeedback({
        type: "error",
        message: "Este producto ya está agregado en la entrada. Edita la línea existente o consolida la cantidad.",
      });
      return;
    }

    const provName = effectiveLineProvider
      ? (effectiveLineProvider.nombre_comercial || effectiveLineProvider.nombre)
      : (proveedorGeneralId ? (proveedores.find(p => String(p.proveedor_id) === String(proveedorGeneralId))?.nombre_comercial || "General") : "—");

    const newLine = {
      productoId: selectedProduct.producto_id,
      codigoProducto: selectedProduct.codigo_producto,
      nombreProducto: selectedProduct.nombre,
      imagenUrl: selectedProduct.imagen_url,
      marca: selectedProduct.marca_nombre || "Genérico",
      tipo: selectedProduct.tipo_nombre || selectedProduct.categoria_nombre || "General",
      unidad: selectedProduct.unidad_medida?.codigo || "pza",
      permiteDecimales: permiteDec,
      proveedorId: lineProveedorId ? Number(lineProveedorId) : (proveedorGeneralId ? Number(proveedorGeneralId) : null),
      proveedorNombre: provName,
      cantidad: cantNum,
      costoUnitario: costoNum,
      costoTotal: Number((cantNum * costoNum).toFixed(2)),
      subtotal: Number((cantNum * costoNum).toFixed(2)),
      referencia: referenciaLinea.trim() || null,
      stockActual: selectedStockInfo.actual,
      stockProyectado: selectedStockInfo.actual + cantNum,
    };

    if (editingIndex !== null) {
      const updated = [...lineas];
      updated[editingIndex] = newLine;
      setLineas(updated);
      setFeedback({ type: "success", message: "Línea actualizada correctamente." });
    } else {
      setLineas((prev) => [...prev, newLine]);
    }

    resetLineForm();
  };

  // Cargar línea para edición
  const handleEditLine = (index) => {
    const l = lineas[index];
    const prod = productos.find((p) => p.producto_id === l.productoId);
    if (prod) {
      setProductoId(String(prod.producto_id));
      setProductSearch(`${prod.codigo_producto} - ${prod.nombre}`);
      setCantidad(String(l.cantidad));
      setCostoUnitario(String(l.costoUnitario));
      setReferenciaLinea(l.referencia || "");
      setLineProveedorId(l.proveedorId ? String(l.proveedorId) : "");
      setEditingIndex(index);
      setFeedback(null);
    }
  };

  // Eliminar línea
  const handleDeleteLine = (index) => {
    setLineas((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      resetLineForm();
    }
  };

  // Totales acumulados del lote
  const totales = useMemo(() => {
    const totalLineas = lineas.length;
    const totalUnidades = lineas.reduce((acc, l) => acc + l.cantidad, 0);
    const totalCosto = lineas.reduce((acc, l) => acc + l.costoTotal, 0);
    return { totalLineas, totalUnidades, totalCosto };
  }, [lineas]);

  // Limpiar todo
  const handleResetAll = () => {
    if (lineas.length > 0) {
      if (!window.confirm("¿Deseas limpiar toda la entrada? Se descartarán las líneas agregadas.")) {
        return;
      }
    }
    setLineas([]);
    resetLineForm();
    setObservacionGeneral("");
    setFeedback(null);
  };

  // Confirmar y registrar entrada atómica en PostgreSQL
  const handleSubmitBatch = async () => {
    setFeedback(null);

    if (!almacenId) {
      setFeedback({ type: "error", message: "Selecciona un almacén de destino." });
      return;
    }

    // Si hay un producto en el formulario pero no se ha agregado a la tabla, agregarlo automáticamente
    let batchLines = [...lineas];
    if (batchLines.length === 0 && selectedProduct && cantidadNum > 0) {
      const provName = effectiveLineProvider
        ? (effectiveLineProvider.nombre_comercial || effectiveLineProvider.nombre)
        : (proveedorGeneralId ? (proveedores.find(p => String(p.proveedor_id) === String(proveedorGeneralId))?.nombre_comercial || "General") : "—");

      batchLines = [
        {
          productoId: selectedProduct.producto_id,
          codigoProducto: selectedProduct.codigo_producto,
          nombreProducto: selectedProduct.nombre,
          imagenUrl: selectedProduct.imagen_url,
          marca: selectedProduct.marca_nombre || "Genérico",
          tipo: selectedProduct.tipo_nombre || selectedProduct.categoria_nombre || "General",
          unidad: selectedProduct.unidad_medida?.codigo || "pza",
          permiteDecimales: Boolean(selectedProduct?.unidad_medida?.permite_decimales),
          proveedorId: lineProveedorId ? Number(lineProveedorId) : (proveedorGeneralId ? Number(proveedorGeneralId) : null),
          proveedorNombre: provName,
          cantidad: cantidadNum,
          costoUnitario: costoUnitarioNum,
          costoTotal: Number((cantidadNum * costoUnitarioNum).toFixed(2)),
          subtotal: Number((cantidadNum * costoUnitarioNum).toFixed(2)),
          referencia: referenciaLinea.trim() || null,
          stockActual: selectedStockInfo.actual,
          stockProyectado: selectedStockInfo.actual + cantidadNum,
        },
      ];
    }

    if (batchLines.length === 0) {
      setFeedback({ type: "error", message: "Agrega al menos una línea de producto antes de registrar la entrada." });
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `ENT-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        almacenId: Number(almacenId),
        proveedorId: proveedorGeneralId ? Number(proveedorGeneralId) : null,
        observacion: observacionGeneral.trim() || null,
        lineas: batchLines.map((l) => ({
          productoId: l.productoId,
          proveedorId: l.proveedorId,
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
          referencia: l.referencia,
        })),
      };

      const res = await fetch("/api/inventario/entradas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al procesar la entrada de inventario.");
      }

      setFeedback({
        type: "success",
        message: `Entrada registrada exitosamente con código ${data.codigoMovimiento}.`,
      });

      setLineas([]);
      resetLineForm();
      setObservacionGeneral("");
      await loadCatalogos();
      await loadUltimasEntradas();
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

  // Objeto para preview en el card derecho (del producto seleccionado en formulario o primera línea agregada)
  const activePreview = useMemo(() => {
    if (selectedProduct) {
      return {
        imagen: selectedProduct.imagen_url,
        codigo: selectedProduct.codigo_producto,
        nombre: selectedProduct.nombre,
        marcaTipo: `${selectedProduct.marca_nombre || "General"} | ${selectedProduct.tipo_nombre || selectedProduct.categoria_nombre || "Transmisión"}`,
        unidad: selectedProduct.unidad_medida?.codigo || "pza",
        stockActual: selectedStockInfo.actual,
        cantidadIngreso: cantidadNum,
        stockProyectado,
        costoUnitario: costoUnitarioNum,
        costoTotal: subtotalLinea,
        pmpActual: selectedStockInfo.costoPromedio,
        pmpProyectado,
      };
    }
    if (lineas.length > 0) {
      const l = lineas[0];
      return {
        imagen: l.imagenUrl,
        codigo: l.codigoProducto,
        nombre: l.nombreProducto,
        marcaTipo: `${l.marca} | ${l.tipo}`,
        unidad: l.unidad,
        stockActual: l.stockActual,
        cantidadIngreso: l.cantidad,
        stockProyectado: l.stockProyectado,
        costoUnitario: l.costoUnitario,
        costoTotal: l.costoTotal,
        pmpActual: l.costoUnitario,
        pmpProyectado: l.costoUnitario,
      };
    }
    return null;
  }, [selectedProduct, selectedStockInfo, cantidadNum, costoUnitarioNum, subtotalLinea, stockProyectado, pmpProyectado, lineas]);

  return (
    <div className="space-y-6">
      {/* 1. Header Superior & Breadcrumb (Imagen 1) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-1 font-sans">
            <Link href="/inventory/summary" className="hover:text-foreground transition-colors">
              Inventario
            </Link>
            <span>&gt;</span>
            <span className="text-foreground-secondary font-medium">Entradas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-primary shadow-xs">
              <Package className="w-6 h-6 text-lime-400" />
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
            <Eye className="w-4 h-4 text-foreground-muted" />
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

      {/* 2. Cuerpo Principal en 2 Columnas (Imagen 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Card "Registrar Entrada por Compra" */}
        <div className="lg:col-span-7 xl:col-span-8 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm space-y-5">
          {/* Header del Card */}
          <div className="flex items-center gap-2.5 pb-2">
            <ShoppingCart className="w-5 h-5 text-lime-400" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Registrar Entrada por Compra</h2>
              <p className="text-xs text-foreground-muted">
                Completa los datos de la entrada de inventario.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddOrUpdateLine} className="space-y-4">
            {/* Fila 1: Almacén * y Proveedor (General opcional) */}
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
                  Proveedor
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={proveedorGeneralId}
                    onChange={(e) => setProveedorGeneralId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="">Seleccionar proveedor (opcional)...</option>
                    {proveedores.map((pr) => (
                      <option key={pr.proveedor_id} value={pr.proveedor_id}>
                        {pr.codigo_proveedor ? `${pr.codigo_proveedor} - ` : ""}
                        {pr.nombre_comercial}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Fila 2: Producto * */}
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
                        const stockActual = ex ? Number(ex.cantidad_actual) : 0;
                        const mainProv = (p.proveedores || []).find((pr) => pr.proveedor_principal) || p.proveedores?.[0];

                        return (
                          <div
                            key={p.producto_id}
                            onClick={() => handleSelectProduct(p)}
                            className="p-2.5 hover:bg-surface-subtle/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                {p.imagen_url ? (
                                  <img src={p.imagen_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-4 h-4 text-foreground-muted" />
                                )}
                              </div>
                              <div>
                                <span className="font-mono font-semibold text-primary mr-2">
                                  {p.codigo_producto}
                                </span>
                                <span className="text-foreground">{p.nombre}</span>
                                {mainProv && (
                                  <span className="text-[11px] text-foreground-muted block">
                                    Prov: {mainProv.nombre_comercial}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] text-foreground-muted font-mono">
                              Stock: {stockActual} {p.unidad_medida?.codigo || "UND"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Tarjeta de preview horizontal del producto (Imagen 1) */}
              {selectedProduct && (
                <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedProduct.imagen_url ? (
                        <img src={selectedProduct.imagen_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-foreground-muted" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-foreground font-mono text-xs tracking-tight">
                        {selectedProduct.codigo_producto}
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        {selectedProduct.nombre}
                      </p>
                      <p className="text-[11px] text-foreground-muted">
                        {[
                          selectedProduct.marca_nombre,
                          selectedProduct.tipo_nombre || selectedProduct.categoria_nombre,
                          `Unidad: ${selectedProduct.unidad_medida?.codigo || "pza"}`
                        ].filter(Boolean).join(" | ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-foreground-muted pl-1 sm:pl-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-foreground-muted">Stock actual (en almacén)</p>
                      <p className="font-bold text-foreground text-sm font-mono">
                        {selectedStockInfo.actual} {selectedProduct.unidad_medida?.codigo || "pza"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-foreground-muted">Costo promedio actual</p>
                      <p className="font-bold text-foreground text-sm font-mono">
                        RD$ {selectedStockInfo.costoPromedio.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selector o indicador de Proveedor de la línea (CASO C / D) */}
              {selectedProduct && productProviders.length > 1 && !productProviders.some(p => p.proveedor_principal) && (
                <div className="mt-2 p-2 rounded-lg bg-surface border border-border flex items-center justify-between text-xs">
                  <span className="text-foreground-secondary text-[11px]">Proveedor para este producto:</span>
                  <select
                    value={lineProveedorId}
                    onChange={(e) => {
                      setLineProveedorId(e.target.value);
                      const m = productProviders.find(p => String(p.proveedor_id) === String(e.target.value));
                      if (m && m.costo_compra > 0) setCostoUnitario(String(m.costo_compra));
                    }}
                    className="px-2.5 py-1 text-xs bg-input border border-border rounded text-foreground cursor-pointer"
                  >
                    {productProviders.map((pr) => (
                      <option key={pr.proveedor_id} value={pr.proveedor_id}>
                        {pr.codigo_proveedor ? `${pr.codigo_proveedor} - ` : ""}{pr.nombre_comercial}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Fila 3: Cantidad * y Costo unitario * */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
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
                    className="w-full pl-3 pr-12 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none">
                    {selectedProduct?.unidad_medida?.codigo || "pza"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Costo unitario <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted pointer-events-none font-semibold">
                    RD$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Fila 4: Referencia / Documento y Observación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Referencia / Documento
                </label>
                <input
                  type="text"
                  value={referenciaLinea}
                  onChange={(e) => setReferenciaLinea(e.target.value)}
                  placeholder="FAC-001234"
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground-secondary">
                    Observación
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
                  placeholder="Compra a proveedor Shimano - Mayo 2024"
                  className="w-full px-3.5 py-2.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Barra de Acciones del Formulario (Imagen 1) */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetAll}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              {/* Botón multiproducto discreto: agregar línea a lote */}
              <button
                type="submit"
                disabled={!selectedProduct || cantidadNum <= 0}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-primary border border-primary/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingIndex !== null ? "Actualizar Producto" : "Agregar a la Entrada"}</span>
              </button>

              {/* Botón Principal: Registrar Entrada (Estilo lime-yellow Imagen 1) */}
              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={submitting || (lineas.length === 0 && !selectedProduct)}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-lime-400 hover:bg-lime-500 text-black shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 text-black stroke-[3]" />
                <span>{submitting ? "Registrando..." : "Registrar Entrada"}</span>
              </button>
            </div>
          </form>

          {/* Listado de Líneas Agregadas Multiproducto (Discreto, dentro del card) */}
          {lineas.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Líneas Agregadas</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {lineas.length}
                  </span>
                </h3>
                <span className="text-[11px] text-foreground-muted font-mono">
                  {totales.totalUnidades} unidades · RD$ {totales.totalCosto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface border-b border-border text-foreground-muted font-semibold">
                    <tr>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3">Proveedor</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3 text-right">Costo Unit.</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-3">Referencia</th>
                      <th className="py-2 px-3 text-center w-16">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lineas.map((l, index) => (
                      <tr
                        key={l.productoId}
                        className={`hover:bg-surface-subtle/60 transition-colors ${
                          editingIndex === index ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-2 px-3 font-medium text-foreground">
                          <span className="font-mono font-bold text-primary mr-1.5">{l.codigoProducto}</span>
                          <span>{l.nombreProducto}</span>
                        </td>
                        <td className="py-2 px-3 text-foreground-secondary text-[11px]">
                          {l.proveedorNombre || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                          {l.cantidad} {l.unidad}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-foreground-muted">
                          RD$ {l.costoUnitario.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          RD$ {l.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 font-mono text-foreground-secondary text-[11px]">
                          {l.referencia || "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditLine(index)}
                              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLine(index)}
                              className="p-1 rounded text-error/70 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                              title="Eliminar"
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
        </div>

        {/* COLUMNA DERECHA: Card "Resumen de la Operación" (Exacto Imagen 1) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm space-y-4 self-start">
          {/* Header del Resumen */}
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <BarChart3 className="w-5 h-5 text-lime-400" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Resumen de la Operación</h2>
              <p className="text-[11px] text-foreground-muted">Vista previa del impacto en el inventario.</p>
            </div>
          </div>

          {activePreview ? (
            <div className="space-y-4 text-xs">
              {/* Card de Producto en Resumen (Imagen 1) */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border">
                <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {activePreview.imagen ? (
                    <img src={activePreview.imagen} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-foreground-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-mono font-bold text-foreground text-xs">{activePreview.codigo}</p>
                  <p className="font-semibold text-foreground text-xs truncate">{activePreview.nombre}</p>
                  <p className="text-[11px] text-foreground-muted truncate">{activePreview.marcaTipo}</p>
                </div>
              </div>

              {/* Métricas de Stock (Imagen 1) */}
              <div className="space-y-2 pt-1 border-b border-border pb-3">
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>Stock actual</span>
                  <span className="font-mono text-foreground font-medium">
                    {activePreview.stockActual} {activePreview.unidad}
                  </span>
                </div>
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>Cantidad a ingresar</span>
                  <span className="font-mono font-bold text-success">
                    + {activePreview.cantidadIngreso} {activePreview.unidad}
                  </span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-semibold">Stock proyectado</span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {activePreview.stockProyectado} {activePreview.unidad}
                  </span>
                </div>
              </div>

              {/* Métricas de Costo (Imagen 1) */}
              <div className="space-y-2 border-b border-border pb-3">
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>Costo unitario</span>
                  <span className="font-mono text-foreground font-medium">
                    RD$ {activePreview.costoUnitario.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-semibold">Costo total de la entrada</span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    RD$ {activePreview.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Métricas de PMP (Imagen 1) */}
              <div className="space-y-2 border-b border-border pb-3">
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>PMP actual</span>
                  <span className="font-mono text-foreground font-medium">
                    RD$ {activePreview.pmpActual.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sky-400">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">PMP proyectado (estimado)</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono font-bold text-sm">
                    RD$ {activePreview.pmpProyectado.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Callout Informativo (Imagen 1) */}
              <div className="p-3 rounded-xl bg-surface border border-border text-[11px] text-foreground-muted flex items-start gap-2.5">
                <Info className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
                <span>
                  El PMP proyectado es solo informativo. El cálculo definitivo se realiza en el servidor.
                </span>
              </div>

              {/* Totales de lote multiproducto si hay más de una línea */}
              {lineas.length > 0 && (
                <div className="pt-2 text-[11px] text-foreground-muted flex items-center justify-between">
                  <span>Total productos en lote: <strong className="text-foreground">{totales.totalLineas}</strong></span>
                  <span>Inversión lote: <strong className="text-foreground font-mono">RD$ {totales.totalCosto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</strong></span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-foreground-muted">
              Selecciona un producto en el formulario para visualizar el impacto proyectado en stock y costo promedio.
            </div>
          )}
        </div>
      </div>

      {/* 3. Card Inferior: "Últimas Entradas" (Exacto Imagen 1) */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shadow-xs">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Últimas Entradas
              </h2>
              <p className="text-[11px] text-foreground-muted">
                Las 5 entradas más recientes registradas en el sistema.
              </p>
            </div>
          </div>

          <Link
            href="/inventory/movements"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-colors"
          >
            <span>Ver todas</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingEntradas ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            Cargando historial de entradas...
          </div>
        ) : errorEntradas ? (
          <div className="p-6 text-center text-xs text-error">
            {errorEntradas}
          </div>
        ) : ultimasEntradas.length === 0 ? (
          <div className="p-8 text-center text-xs text-foreground-muted">
            No hay entradas registradas recientemente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface text-foreground-muted border-b border-border font-semibold">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Almacén</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-right">Costo Unitario</th>
                  <th className="p-3 text-right">Costo Total</th>
                  <th className="p-3">Referencia</th>
                  <th className="p-3">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ultimasEntradas.map((ent) => (
                  <tr key={ent.id} className="hover:bg-surface-subtle/60 transition-colors">
                    <td className="p-3 text-foreground-muted whitespace-nowrap font-mono text-[11px]">
                      {new Date(ent.fecha).toLocaleDateString("es-DO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <span className="font-mono font-bold text-primary mr-1.5">{ent.productoCodigo}</span>
                      <span>{ent.productoNombre}</span>
                    </td>
                    <td className="p-3 text-foreground-secondary">
                      {ent.proveedorNombre || "—"}
                    </td>
                    <td className="p-3 text-foreground-secondary">{ent.almacenNombre}</td>
                    <td className="p-3 text-right font-mono font-semibold text-foreground">
                      {ent.cantidad} pza
                    </td>
                    <td className="p-3 text-right text-foreground-muted font-mono">
                      RD$ {ent.costoUnitario.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      RD$ {ent.costoTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-foreground-secondary text-[11px]">{ent.referencia}</td>
                    <td className="p-3 text-foreground-secondary">{ent.usuario}</td>
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
