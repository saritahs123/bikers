"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Receipt,
  FileText,
  Warehouse,
  User,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  DollarSign,
  Wrench,
  Package,
  X,
  Lock,
  Bike
} from "lucide-react";
import ProductCreateModal from "@/components/products/ProductCreateModal";
import SelectWorkOrderModal from "@/components/billing/SelectWorkOrderModal";

export default function NewInvoiceView() {
  // Modal Crear Producto
  const [isCreateProductModalOpen, setIsCreateProductModalOpen] = useState(false);
  const [canCreateProduct, setCanCreateProduct] = useState(false);

  // Modal Traer Orden de Trabajo (FAC-3)
  const [isSelectWorkOrderModalOpen, setIsSelectWorkOrderModalOpen] = useState(false);
  const [ordenTrabajo, setOrdenTrabajo] = useState(null);

  // Catálogos
  const [tiposFactura, setTiposFactura] = useState([]);
  const [tiposPago, setTiposPago] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [permisos, setPermisos] = useState(null);

  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Cabecera de la factura
  const [tipoFacturaId, setTipoFacturaId] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [observacion, setObservacion] = useState("");

  // Cliente seleccionado y búsqueda
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const clientSearchRef = useRef(null);

  // Formulario para agregar línea de producto
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lineAlmacenId, setLineAlmacenId] = useState("");
  const [lineCantidad, setLineCantidad] = useState("1");
  const [linePrecio, setLinePrecio] = useState("");
  const [lineDescuento, setLineDescuento] = useState("0");
  const productSearchRef = useRef(null);

  // Detalle multiproducto
  const [lineas, setLineas] = useState([]);

  // Pagos múltiples
  const [tipoPagoId, setTipoPagoId] = useState("");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagos, setPagos] = useState([]);

  // Cargar catálogos
  const loadCatalogos = useCallback(async () => {
    try {
      setLoadingCatalogos(true);
      const res = await fetch("/api/facturacion/catalogos");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.message || "No se pudieron cargar los catálogos del módulo de facturación.",
        });
        return;
      }

      setTiposFactura(data.tipos_factura || []);
      setTiposPago(data.tipos_pago || []);
      setAlmacenes(data.almacenes || []);
      setProductos(data.productos || []);
      setClientes(data.clientes || []);
      setPermisos(data.permisos || null);

      // Tipo Factura VENTA_DIRECTA por defecto
      const ventaDirecta = (data.tipos_factura || []).find((tf) => tf.codigo === "VENTA_DIRECTA");
      if (ventaDirecta) {
        setTipoFacturaId(String(ventaDirecta.tipo_factura_id));
      } else if ((data.tipos_factura || []).length > 0) {
        setTipoFacturaId(String(data.tipos_factura[0].tipo_factura_id));
      }

      // Almacén por defecto
      if ((data.almacenes || []).length > 0 && !almacenId) {
        const defaultAlm = String(data.almacenes[0].almacen_id);
        setAlmacenId(defaultAlm);
        setLineAlmacenId(defaultAlm);
      }

      // Tipo de pago por defecto
      if ((data.tipos_pago || []).length > 0 && !tipoPagoId) {
        setTipoPagoId(String(data.tipos_pago[0].tipo_pago_id));
      }
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudieron cargar los catálogos del módulo de facturación.",
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [almacenId, tipoPagoId]);

  // Verificar permisos de productos
  useEffect(() => {
    const checkProductPermissions = async () => {
      try {
        const res = await fetch("/api/taller/productos");
        if (res.ok) {
          const data = await res.json();
          if (data.canCreate !== undefined) {
            setCanCreateProduct(Boolean(data.canCreate));
          }
        }
      } catch {
        setCanCreateProduct(false);
      }
    };
    checkProductPermissions();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalogos();
  }, [loadCatalogos]);

  // Sincronizar almacén de línea con almacén general si no ha cambiado
  const handleGeneralAlmacenChange = (newAlmacenId) => {
    setAlmacenId(newAlmacenId);
    setLineAlmacenId(newAlmacenId);
  };

  // Filtrar clientes
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientes.slice(0, 10);
    const term = clientSearch.toLowerCase().trim();
    return clientes
      .filter((c) => {
        const nom = (c.nombre_completo || "").toLowerCase();
        const iden = (c.identificacion || "").toLowerCase();
        const tel = (c.telefono_principal || "").toLowerCase();
        const cor = (c.correo || "").toLowerCase();
        return nom.includes(term) || iden.includes(term) || tel.includes(term) || cor.includes(term);
      })
      .slice(0, 15);
  }, [clientes, clientSearch]);

  // Seleccionar cliente
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch("");
    setClientDropdownOpen(false);
  };

  // Limpiar cliente
  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
  };

  // Stock disponible del producto seleccionado en el almacén de línea
  const selectedProductStock = useMemo(() => {
    if (!selectedProduct || !lineAlmacenId) return 0;
    const exist = (selectedProduct.existencias || []).find(
      (e) => String(e.almacen_id) === String(lineAlmacenId)
    );
    return exist ? Number(exist.cantidad_disponible || 0) : 0;
  }, [selectedProduct, lineAlmacenId]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productos.slice(0, 10);
    const term = productSearch.toLowerCase().trim();
    return productos
      .filter((p) => {
        const cod = (p.codigo_producto || "").toLowerCase();
        const nom = (p.nombre || "").toLowerCase();
        const bar = (p.codigo_barra || "").toLowerCase();
        return cod.includes(term) || nom.includes(term) || bar.includes(term);
      })
      .slice(0, 15);
  }, [productos, productSearch]);

  // Seleccionar producto para el formulario de línea
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setProductSearch("");
    setProductDropdownOpen(false);
    setLinePrecio(String(product.precio_venta || "0"));
    setLineCantidad("1");
    setLineDescuento("0");
  };

  // Callback cuando se crea producto nuevo desde ProductCreateModal
  const handleProductCreated = async (newProduct) => {
    setIsCreateProductModalOpen(false);
    await loadCatalogos();
    if (newProduct) {
      handleSelectProduct(newProduct);
    }
  };

  // Agregar línea a la tabla
  const handleAddLine = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      setFeedback({ type: "error", message: "Selecciona un producto para agregar a la factura." });
      return;
    }
    if (!lineAlmacenId) {
      setFeedback({ type: "error", message: "Selecciona el almacén de origen del producto." });
      return;
    }

    const cant = Number(lineCantidad);
    const prec = Number(linePrecio);
    const desc = Number(lineDescuento || 0);

    if (isNaN(cant) || cant <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0." });
      return;
    }

    if (!selectedProduct.permite_decimales && (!Number.isInteger(cant) || cant % 1 !== 0)) {
      setFeedback({
        type: "error",
        message: `El producto ${selectedProduct.nombre} no permite cantidades decimales.`,
      });
      return;
    }

    if (isNaN(prec) || prec < 0) {
      setFeedback({ type: "error", message: "El precio no puede ser negativo." });
      return;
    }

    if (isNaN(desc) || desc < 0) {
      setFeedback({ type: "error", message: "El descuento no puede ser negativo." });
      return;
    }

    if (desc > cant * prec) {
      setFeedback({ type: "error", message: "El descuento no puede ser mayor al total bruto de la línea." });
      return;
    }

    // Validar disponibilidad previa en el almacén seleccionado
    if (cant > selectedProductStock) {
      setFeedback({
        type: "error",
        message: `Stock insuficiente: El producto solo tiene ${selectedProductStock} disponible(s) en este almacén. Solicitado: ${cant}.`,
      });
      return;
    }

    const subtotalLinea = parseFloat(((cant * prec) - desc).toFixed(2));
    const targetAlm = almacenes.find((a) => String(a.almacen_id) === String(lineAlmacenId));

    const nuevaLinea = {
      tempId: `${selectedProduct.producto_id}-${lineAlmacenId}-${Date.now()}`,
      tipo_linea: "PRODUCTO",
      producto_id: selectedProduct.producto_id,
      almacen_id: Number(lineAlmacenId),
      almacen_nombre: targetAlm ? targetAlm.nombre : `Almacén #${lineAlmacenId}`,
      codigo: selectedProduct.codigo_producto,
      descripcion: selectedProduct.nombre,
      cantidad: cant,
      precio_unitario: prec,
      descuento: desc,
      subtotal: subtotalLinea,
      costo_unitario: selectedProduct.costo_actual,
      permite_decimales: selectedProduct.permite_decimales,
      stock_disponible: selectedProductStock,
    };

    setLineas((prev) => [...prev, nuevaLinea]);
    setSelectedProduct(null);
    setLineCantidad("1");
    setLinePrecio("");
    setLineDescuento("0");
    setFeedback(null);
  };

  // Modificar cantidad o precio en línea existente
  const handleUpdateLineField = (tempId, field, value) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l;
        const numVal = Number(value);
        const updated = { ...l, [field]: isNaN(numVal) ? 0 : numVal };
        const sub = Math.max(0, (updated.cantidad * updated.precio_unitario) - (updated.descuento || 0));
        updated.subtotal = parseFloat(sub.toFixed(2));
        return updated;
      })
    );
  };

  // Eliminar línea
  const handleRemoveLine = (tempId) => {
    setLineas((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  // Cálculos de Totales en tiempo real
  const subtotalGeneral = useMemo(() => {
    return parseFloat(
      lineas.reduce((acc, l) => acc + (l.cantidad * l.precio_unitario), 0).toFixed(2)
    );
  }, [lineas]);

  const descuentoGeneral = useMemo(() => {
    return parseFloat(lineas.reduce((acc, l) => acc + (l.descuento || 0), 0).toFixed(2));
  }, [lineas]);

  const impuestoGeneral = 0.00; // En FAC-2: impuesto = 0

  const totalFactura = useMemo(() => {
    return Math.max(0, parseFloat((subtotalGeneral - descuentoGeneral + impuestoGeneral).toFixed(2)));
  }, [subtotalGeneral, descuentoGeneral, impuestoGeneral]);

  // Pagos
  const totalPagado = useMemo(() => {
    return parseFloat(pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0).toFixed(2));
  }, [pagos]);

  const balancePendiente = useMemo(() => {
    return Math.max(0, parseFloat((totalFactura - totalPagado).toFixed(2)));
  }, [totalFactura, totalPagado]);

  // Estado financiero de la factura calculado en tiempo real
  const estadoCalculado = useMemo(() => {
    if (totalFactura <= 0) {
      return totalPagado > 0 ? "PAGADA" : "PENDIENTE";
    }
    if (totalPagado >= totalFactura) {
      return "PAGADA";
    }
    if (totalPagado > 0) {
      return "PARCIAL";
    }
    return "PENDIENTE";
  }, [totalFactura, totalPagado]);

  // Agregar pago
  const handleAddPago = (e) => {
    e.preventDefault();
    const montoNum = Number(pagoMonto);

    if (isNaN(montoNum) || montoNum <= 0) {
      setFeedback({ type: "error", message: "El monto del pago debe ser mayor a 0." });
      return;
    }

    if (!tipoPagoId) {
      setFeedback({ type: "error", message: "Selecciona un tipo de pago." });
      return;
    }

    const nuevoTotalPagado = parseFloat((totalPagado + montoNum).toFixed(2));
    if (nuevoTotalPagado > totalFactura) {
      setFeedback({
        type: "error",
        message: `El pago de RD$ ${montoNum.toFixed(2)} excede el balance pendiente (RD$ ${balancePendiente.toFixed(2)}).`,
      });
      return;
    }

    const tp = tiposPago.find((t) => String(t.tipo_pago_id) === String(tipoPagoId));

    const nuevoPago = {
      tempId: `PAGO-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tipo_pago_id: Number(tipoPagoId),
      tipo_pago_codigo: tp ? tp.codigo : "PAGO",
      tipo_pago_nombre: tp ? tp.nombre : "Pago",
      monto: montoNum,
      referencia: pagoReferencia.trim() || null,
    };

    setPagos((prev) => [...prev, nuevoPago]);
    setPagoMonto("");
    setPagoReferencia("");
    setFeedback(null);
  };

  // Helper para poner el balance pendiente completo en el input de pago
  const handleSetMaxPago = () => {
    if (balancePendiente > 0) {
      setPagoMonto(String(balancePendiente));
    }
  };

  // Eliminar pago
  const handleRemovePago = (tempId) => {
    setPagos((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  // Cargar Orden de Trabajo seleccionada (FAC-3)
  const handleSelectWorkOrder = (ot) => {
    setOrdenTrabajo(ot);

    // 1. Cliente vinculado a la OT (Regla 6)
    if (ot.cliente) {
      setSelectedClient({
        cliente_id: ot.cliente.cliente_id,
        nombre_completo: ot.cliente.nombre_completo,
        identificacion: ot.cliente.identificacion,
        telefono_principal: ot.cliente.telefono_principal,
        correo: ot.cliente.correo,
      });
      setClientSearch("");
      setClientDropdownOpen(false);
    }

    // 2. Tipo Factura ORDEN_TRABAJO (Regla 5)
    const otTipo = tiposFactura.find((tf) => tf.codigo === "ORDEN_TRABAJO");
    if (otTipo) {
      setTipoFacturaId(String(otTipo.tipo_factura_id));
    }

    // 3. Servicios facturables (Regla 7)
    const serviceLines = (ot.servicios || []).map((s) => ({
      tempId: `SRV-${s.orden_servicio_id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tipo_linea: "SERVICIO",
      tipo_servicio_id: s.tipo_servicio_id,
      orden_servicio_id: s.orden_servicio_id,
      producto_id: null,
      almacen_id: null,
      almacen_nombre: "Taller (Servicio)",
      codigo: s.codigo,
      descripcion: s.descripcion,
      cantidad: Number(s.cantidad),
      precio_unitario: Number(s.precio_unitario),
      descuento: Number(s.descuento || 0),
      subtotal: Number(s.subtotal),
      costo_unitario: null,
      permite_decimales: false,
      isFromOrder: true,
    }));

    // 4. Repuestos consumidos (utilizado = true) (Regla 8 y 19)
    const spareLines = (ot.repuestos || []).map((r) => ({
      tempId: `REP-${r.orden_producto_id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tipo_linea: "REPUESTO",
      producto_id: r.producto_id,
      orden_producto_id: r.orden_producto_id,
      tipo_servicio_id: null,
      orden_servicio_id: null,
      almacen_id: r.almacen_id || null,
      almacen_nombre: r.almacen_id ? `Almacén #${r.almacen_id}` : "Consumo Taller",
      codigo: r.codigo,
      descripcion: r.descripcion,
      cantidad: Number(r.cantidad),
      precio_unitario: Number(r.precio_unitario),
      descuento: Number(r.descuento || 0),
      subtotal: Number(r.subtotal),
      costo_unitario: r.costo_unitario != null ? Number(r.costo_unitario) : null,
      permite_decimales: false,
      isFromOrder: true,
    }));

    setLineas([...serviceLines, ...spareLines]);
    setFeedback({
      type: "success",
      message: `Orden de Trabajo ${ot.codigo_orden} cargada con ${serviceLines.length} servicio(s) y ${spareLines.length} repuesto(s) consumido(s).`,
    });
  };

  // Desvincular Orden de Trabajo
  const handleDetachOrder = () => {
    setOrdenTrabajo(null);
    setLineas((prev) => prev.filter((l) => !l.isFromOrder));
    const vdT = tiposFactura.find((tf) => tf.codigo === "VENTA_DIRECTA");
    if (vdT) {
      setTipoFacturaId(String(vdT.tipo_factura_id));
    }
    setFeedback(null);
  };

  // Submit Guardar Factura
  const handleSubmitFactura = async () => {
    if (submitting) return;

    if (lineas.length === 0) {
      setFeedback({ type: "error", message: "Agrega al menos un producto a la factura antes de guardar." });
      return;
    }

    if (!tipoFacturaId) {
      setFeedback({ type: "error", message: "No se ha determinado el tipo de factura." });
      return;
    }

    if (totalPagado > totalFactura) {
      setFeedback({ type: "error", message: "El total de pagos no puede ser superior al total de la factura." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        tipo_factura_id: Number(tipoFacturaId),
        cliente_id: selectedClient ? selectedClient.cliente_id : null,
        orden_trabajo_id: ordenTrabajo ? ordenTrabajo.orden_trabajo_id : null,
        observacion: observacion.trim() || null,
        lineas: lineas.map((l) => ({
          tipo_linea: l.tipo_linea || "PRODUCTO",
          almacen_id: l.almacen_id || null,
          producto_id: l.producto_id || null,
          tipo_servicio_id: l.tipo_servicio_id || null,
          orden_servicio_id: l.orden_servicio_id || null,
          orden_producto_id: l.orden_producto_id || null,
          codigo: l.codigo || null,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
          descuento: Number(l.descuento || 0),
          costo_unitario: l.costo_unitario != null ? Number(l.costo_unitario) : null,
        })),
        pagos_iniciales: pagos.map((p) => ({
          tipo_pago_id: p.tipo_pago_id,
          monto: p.monto,
          referencia: p.referencia,
        })),
      };

      const res = await fetch("/api/facturacion/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "OT_YA_FACTURADA" || (res.status === 409 && data.error !== "STOCK_INSUFICIENTE")) {
          throw new Error(data.message || "La orden de trabajo ya cuenta con una factura activa.");
        }
        if (res.status === 409 || data.error === "STOCK_INSUFICIENTE") {
          throw new Error(data.message || "Stock insuficiente en almacén para completar la venta.");
        }
        throw new Error(data.message || "Error al procesar la factura.");
      }

      setFeedback({
        type: "success",
        message: `Factura ${data.factura?.codigo_factura || ""} guardada exitosamente con salida de inventario y estado ${data.factura?.estado || estadoCalculado}.`,
      });

      // Limpiar formulario tras éxito
      setOrdenTrabajo(null);
      setLineas([]);
      setPagos([]);
      setSelectedClient(null);
      setSelectedProduct(null);
      setObservacion("");
      await loadCatalogos();
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al guardar la factura.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Icono para tipo de pago
  const getPagoIcon = (codigo) => {
    switch (String(codigo).toUpperCase()) {
      case "EFECTIVO":
        return <Banknote className="w-4 h-4 text-emerald-400" />;
      case "TARJETA":
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case "TRANSFERENCIA":
        return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1 font-mono">
            <Link href="/billing" className="hover:text-primary transition-colors">
              Facturación
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Nueva Factura</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            <span>Nueva Factura</span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Venta directa de productos y servicios con salida automática de inventario
          </p>
        </div>

        {/* Botón Traer Orden de Trabajo (FAC-3 habilitado) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSelectWorkOrderModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-foreground border border-border transition-all cursor-pointer shadow-sm hover:border-primary/50"
          >
            <Wrench className="w-4 h-4 text-primary" />
            <span>Traer Orden de Trabajo</span>
          </button>
        </div>
      </div>

      {/* Banner de OT Vinculada */}
      {ordenTrabajo && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/30 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono flex-wrap">
                <span className="font-bold text-foreground">OT {ordenTrabajo.codigo_orden}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {ordenTrabajo.estado?.nombre || "LISTA ENTREGA"}
                </span>
                {ordenTrabajo.bicicleta && (
                  <span className="text-foreground-secondary font-sans flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-primary" />
                    {ordenTrabajo.bicicleta.marca} {ordenTrabajo.bicicleta.modelo}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-foreground-muted mt-0.5 font-sans">
                Líneas de servicios y repuestos consumidos cargadas desde Taller. Puedes agregar productos adicionales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDetachOrder}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface border border-border text-foreground hover:bg-hover hover:text-error transition-colors self-end sm:self-center cursor-pointer"
            title="Desvincular Orden de Trabajo"
          >
            ✕ Desvincular OT
          </button>
        </div>
      )}

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

      {/* 2. Cuerpo Principal en 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (span 8): Datos de Factura, Cliente, Productos y Líneas */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Card: Datos Generales */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Datos de la Venta</h2>
              </div>
              <div className="flex items-center gap-2">
                {loadingCatalogos && (
                  <span className="text-[10px] text-foreground-muted font-mono animate-pulse">Cargando datos...</span>
                )}
                <select
                  value={tipoFacturaId}
                  onChange={(e) => setTipoFacturaId(e.target.value)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/30 focus:outline-none cursor-pointer"
                >
                  {tiposFactura.map((tf) => (
                    <option key={tf.tipo_factura_id} value={tf.tipo_factura_id} className="bg-surface text-foreground font-sans">
                      {tf.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {permisos && !permisos.puede_crear && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-lg">
                Tu rol de usuario no cuenta con permisos para crear facturas.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Almacén General */}
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Almacén de Despacho <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <select
                    value={almacenId}
                    onChange={(e) => handleGeneralAlmacenChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    {almacenes.map((a) => (
                      <option key={a.almacen_id} value={a.almacen_id}>
                        {a.codigo} — {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                  Fecha de Factura
                </label>
                <input
                  type="text"
                  disabled
                  value={new Date().toLocaleDateString("es-DO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  className="w-full px-3.5 py-2 text-xs bg-surface/50 border border-border rounded-lg text-foreground-muted font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card: Cliente */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Cliente (CRM)</h2>
              </div>
              <span className="text-[11px] text-foreground-muted">Opcional para venta al consumidor</span>
            </div>

            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-primary/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">
                      {selectedClient.nombre_completo}
                    </span>
                    {selectedClient.identificacion && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-foreground-muted border border-border">
                        {selectedClient.identificacion}
                      </span>
                    )}
                    {ordenTrabajo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                        <Lock className="w-3 h-3" /> OT {ordenTrabajo.codigo_orden}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-foreground-muted flex-wrap">
                    {selectedClient.telefono_principal && (
                      <span>Tel: {selectedClient.telefono_principal}</span>
                    )}
                    {selectedClient.correo && (
                      <span>Correo: {selectedClient.correo}</span>
                    )}
                  </div>
                </div>
                {ordenTrabajo ? (
                  <div
                    className="p-1.5 text-foreground-muted"
                    title={`El cliente está vinculado a la Orden de Trabajo ${ordenTrabajo.codigo_orden} y no puede modificarse`}
                  >
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearClient}
                    className="p-1 rounded text-foreground-muted hover:text-error hover:bg-hover transition-colors cursor-pointer"
                    title="Cambiar cliente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative" ref={clientSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setClientDropdownOpen(true);
                    }}
                    onFocus={() => setClientDropdownOpen(true)}
                    placeholder="Buscar cliente por nombre, cédula o teléfono..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                </div>

                {clientDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto font-mono text-xs">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c) => (
                        <div
                          key={c.cliente_id}
                          onClick={() => handleSelectClient(c)}
                          className="px-3.5 py-2 hover:bg-hover cursor-pointer border-b border-border/40 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-foreground font-sans">
                              {c.nombre_completo}
                            </div>
                            <div className="text-[10px] text-foreground-muted">
                              {c.identificacion || "Sin RNC/Cédula"} • Tel: {c.telefono_principal || "N/A"}
                            </div>
                          </div>
                          <span className="text-[10px] text-primary">Seleccionar</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-center text-foreground-muted text-[11px]">
                        No se encontraron clientes con ese criterio.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: Agregar Producto y Detalle Multiproducto */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Agregar Productos</h2>
              </div>
              {canCreateProduct && (
                <button
                  type="button"
                  onClick={() => setIsCreateProductModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear producto</span>
                </button>
              )}
            </div>

            {/* Buscador de Producto */}
            <div className="relative" ref={productSearchRef}>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">
                Seleccionar Producto <span className="text-error">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                <input
                  type="text"
                  value={selectedProduct ? `${selectedProduct.codigo_producto} — ${selectedProduct.nombre}` : productSearch}
                  onChange={(e) => {
                    setSelectedProduct(null);
                    setProductSearch(e.target.value);
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => setProductDropdownOpen(true)}
                  placeholder="Buscar producto por código, nombre o código de barra..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setProductSearch("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>

              {productDropdownOpen && !selectedProduct && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto text-xs font-mono">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => {
                      const exist = (p.existencias || []).find(
                        (e) => String(e.almacen_id) === String(lineAlmacenId)
                      );
                      const disp = exist ? Number(exist.cantidad_disponible || 0) : 0;

                      return (
                        <div
                          key={p.producto_id}
                          onClick={() => handleSelectProduct(p)}
                          className="px-3.5 py-2 hover:bg-hover cursor-pointer border-b border-border/40 last:border-0 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground font-sans">
                              <span className="text-primary mr-2 font-mono">{p.codigo_producto}</span>
                              {p.nombre}
                            </div>
                            <div className="text-[10px] text-foreground-muted">
                              Precio: RD$ {Number(p.precio_venta || 0).toFixed(2)} • Disp:{" "}
                              <span className={disp > 0 ? "text-emerald-400 font-bold" : "text-error font-bold"}>
                                {disp} {p.unidad_codigo || "UND"}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-primary">Elegir</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-center text-foreground-muted text-[11px]">
                      No se encontraron productos disponibles.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inputs de Línea: Cantidad, Precio Venta, Descuento, Almacén */}
            <form onSubmit={handleAddLine} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Almacén Línea
                </label>
                <select
                  value={lineAlmacenId}
                  onChange={(e) => setLineAlmacenId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                >
                  {almacenes.map((a) => (
                    <option key={a.almacen_id} value={a.almacen_id}>
                      {a.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Cantidad {selectedProduct && `(Disp: ${selectedProductStock})`}
                </label>
                <input
                  type="number"
                  step={selectedProduct?.permite_decimales ? "0.01" : "1"}
                  min="0.01"
                  value={lineCantidad}
                  onChange={(e) => setLineCantidad(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Precio Unitario (RD$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={linePrecio}
                  onChange={(e) => setLinePrecio(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Descuento (RD$)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lineDescuento}
                    onChange={(e) => setLineDescuento(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors whitespace-nowrap cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </form>

            {/* Tabla Multiproducto de Detalle */}
            <div className="border border-border rounded-lg overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface border-b border-border font-mono text-[11px] text-foreground-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">TIPO</th>
                      <th className="py-2.5 px-3">CÓDIGO</th>
                      <th className="py-2.5 px-3">CONCEPTO / DESCRIPCIÓN</th>
                      <th className="py-2.5 px-3">ALMACÉN / ORIGEN</th>
                      <th className="py-2.5 px-3 text-right">CANT.</th>
                      <th className="py-2.5 px-3 text-right">PRECIO</th>
                      <th className="py-2.5 px-3 text-right">DESC.</th>
                      <th className="py-2.5 px-3 text-right">IMPORTE</th>
                      <th className="py-2.5 px-3 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lineas.length > 0 ? (
                      lineas.map((l) => (
                        <tr key={l.tempId} className="hover:bg-hover/40 transition-colors font-mono">
                          <td className="py-2 px-3">
                            {l.tipo_linea === "SERVICIO" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                SERVICIO
                              </span>
                            )}
                            {l.tipo_linea === "REPUESTO" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                REPUESTO OT
                              </span>
                            )}
                            {(!l.tipo_linea || l.tipo_linea === "PRODUCTO") && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                PRODUCTO
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-primary font-semibold">{l.codigo || "—"}</td>
                          <td className="py-2 px-3 font-sans font-medium text-foreground">
                            {l.descripcion}
                            {l.isFromOrder && ordenTrabajo && (
                              <span className="ml-2 text-[10px] font-mono text-foreground-muted">
                                (OT #{ordenTrabajo.codigo_orden})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-foreground-muted">{l.almacen_nombre || "—"}</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step={l.permite_decimales ? "0.01" : "1"}
                              min="0.01"
                              value={l.cantidad}
                              onChange={(e) => handleUpdateLineField(l.tempId, "cantidad", e.target.value)}
                              className="w-16 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={l.precio_unitario}
                              onChange={(e) => handleUpdateLineField(l.tempId, "precio_unitario", e.target.value)}
                              className="w-20 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={l.descuento}
                              onChange={(e) => handleUpdateLineField(l.tempId, "descuento", e.target.value)}
                              className="w-16 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-foreground">
                            RD$ {Number(l.subtotal || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(l.tempId)}
                              className="p-1 rounded text-foreground-muted hover:text-error hover:bg-hover transition-colors cursor-pointer"
                              title="Eliminar línea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-foreground-muted text-xs font-sans">
                          No hay líneas agregadas a la factura todavía. Puedes traer una Orden de Trabajo o agregar productos directamente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Observaciones opcionales */}
            <div className="pt-2">
              <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                Observación / Nota interna
              </label>
              <textarea
                rows={2}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Comentarios sobre la factura o entrega..."
                className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (span 4): Resumen, Pagos, Totales y Guardar */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card: Resumen Financiero y Totales */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 font-sans">
              <h3 className="text-sm font-bold text-foreground">Resumen de Totales</h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  estadoCalculado === "PAGADA"
                    ? "bg-success/15 border-success/40 text-success"
                    : estadoCalculado === "PARCIAL"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                    : "bg-surface-subtle border-border text-foreground-muted"
                }`}
              >
                {estadoCalculado}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-foreground-secondary">
                <span>Subtotal Bruto:</span>
                <span>RD$ {subtotalGeneral.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-foreground-secondary">
                <span>Descuento Total:</span>
                <span className="text-amber-400">- RD$ {descuentoGeneral.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-foreground-secondary">
                <span>Impuestos:</span>
                <span>RD$ 0.00</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-foreground font-sans">
                <span>Total Factura:</span>
                <span className="text-primary font-mono">RD$ {totalFactura.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-400 font-semibold pt-1">
                <span>Monto Pagado:</span>
                <span>RD$ {totalPagado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-foreground font-bold">
                <span>Balance Pendiente:</span>
                <span className={balancePendiente > 0 ? "text-error" : "text-foreground-muted"}>
                  RD$ {balancePendiente.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Pagos Múltiples */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Registro de Pagos</h3>
              </div>
              <span className="text-[11px] font-mono text-foreground-muted">Múltiples métodos</span>
            </div>

            {/* Formulario Agregar Pago */}
            <form onSubmit={handleAddPago} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Tipo de Pago
                </label>
                <select
                  value={tipoPagoId}
                  onChange={(e) => setTipoPagoId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                >
                  {tiposPago.map((tp) => (
                    <option key={tp.tipo_pago_id} value={tp.tipo_pago_id}>
                      {tp.nombre} ({tp.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-foreground-secondary">
                    Monto (RD$)
                  </label>
                  {balancePendiente > 0 && (
                    <button
                      type="button"
                      onClick={handleSetMaxPago}
                      className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      Pagar pendiente (RD$ {balancePendiente.toFixed(2)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Referencia / Nota (opcional)
                </label>
                <input
                  type="text"
                  value={pagoReferencia}
                  onChange={(e) => setPagoReferencia(e.target.value)}
                  placeholder="Ej. # Voucher, Transf. 9940"
                  className="w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover border border-border text-foreground transition-colors cursor-pointer"
              >
                + Registrar Pago
              </button>
            </form>

            {/* Lista de Pagos Registrados */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-foreground-secondary">
                Pagos Aplicados ({pagos.length}):
              </div>
              {pagos.length > 0 ? (
                <div className="space-y-1.5">
                  {pagos.map((p) => (
                    <div
                      key={p.tempId}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        {getPagoIcon(p.tipo_pago_codigo)}
                        <div>
                          <span className="font-bold text-foreground">{p.tipo_pago_nombre}</span>
                          {p.referencia && (
                            <span className="text-[10px] text-foreground-muted ml-2">
                              Ref: {p.referencia}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">
                          RD$ {Number(p.monto).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePago(p.tempId)}
                          className="p-1 rounded text-foreground-muted hover:text-error cursor-pointer"
                          title="Eliminar pago"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-[11px] text-foreground-muted border border-dashed border-border rounded-lg">
                  Sin pagos iniciales. La factura se creará en estado PENDIENTE.
                </div>
              )}
            </div>
          </div>

          {/* Botón Principal Guardar Factura */}
          <button
            type="button"
            onClick={handleSubmitFactura}
            disabled={submitting || lineas.length === 0}
            className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
              submitting || lineas.length === 0
                ? "bg-surface-subtle text-foreground-muted border border-border cursor-not-allowed opacity-60"
                : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary/20 cursor-pointer"
            }`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Guardando Factura...</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Guardar Factura</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Crear Producto RBAC */}
      <ProductCreateModal
        open={isCreateProductModalOpen}
        isOpen={isCreateProductModalOpen}
        onClose={() => setIsCreateProductModalOpen(false)}
        onProductCreated={handleProductCreated}
      />

      {/* Modal Traer Orden de Trabajo (FAC-3) */}
      <SelectWorkOrderModal
        isOpen={isSelectWorkOrderModalOpen}
        onClose={() => setIsSelectWorkOrderModalOpen(false)}
        onSelectOrder={handleSelectWorkOrder}
      />
    </div>
  );
}
