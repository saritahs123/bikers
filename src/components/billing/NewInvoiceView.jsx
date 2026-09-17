"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Receipt,
  User,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Package,
  X,
  Lock,
  Bike,
  Printer
} from "lucide-react";
import CustomerFormDrawer from "@/components/crm/CustomerFormDrawer";
import ProductCreateModal from "@/components/products/ProductCreateModal";
import SelectWorkOrderModal from "@/components/billing/SelectWorkOrderModal";
import InvoicePrintSelectorModal from "@/components/billing/InvoicePrintSelectorModal";

export default function NewInvoiceView() {
  // Modal Crear Producto
  const [isCreateProductModalOpen, setIsCreateProductModalOpen] = useState(false);
  const [canCreateProduct, setCanCreateProduct] = useState(true);

  // Modal Crear Cliente CRM
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [canCreateClient, setCanCreateClient] = useState(true);

  // Modal Traer Orden de Trabajo (FAC-3)
  const [isSelectWorkOrderModalOpen, setIsSelectWorkOrderModalOpen] = useState(false);
  const [ordenTrabajo, setOrdenTrabajo] = useState(null);

  // Modal de Impresión Post-Factura (Sección 18-21)
  const [createdInvoice, setCreatedInvoice] = useState(null); // { factura_id, codigo_factura }
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [loadingPrintData, setLoadingPrintData] = useState(false);

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

  // Cabecera de la factura (Tipo Factura en Cliente, Almacén y Fecha automáticos)
  const [tipoFacturaId, setTipoFacturaId] = useState("");
  const [observacion, setObservacion] = useState("");

  // Cliente seleccionado y búsqueda
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const clientDropdownRef = useRef(null);

  // Formulario para agregar línea de producto (Almacén interno transparente)
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lineAlmacenId, setLineAlmacenId] = useState("");
  const [lineCantidad, setLineCantidad] = useState("1");
  const [linePrecio, setLinePrecio] = useState("");
  const [lineDescuento, setLineDescuento] = useState("0");
  const productDropdownRef = useRef(null);

  // Detalle multiproducto
  const [lineas, setLineas] = useState([]);

  // Condición de Venta y Pago Automático (FIX-FAC-NEW-2)
  const [condicionVenta, setCondicionVenta] = useState("CONTADO"); // CONTADO | CREDITO
  const [tipoPagoId, setTipoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [pagoReferencia, setPagoReferencia] = useState("");

  // Control de dropdowns: cerrar uno al abrir otro (regla 5)
  const openClientDropdown = useCallback(() => {
    setProductDropdownOpen(false);
    setClientDropdownOpen(true);
  }, []);

  const openProductDropdown = useCallback(() => {
    setClientDropdownOpen(false);
    setProductDropdownOpen(true);
  }, []);

  // Click outside y tecla Escape para cerrar dropdowns de forma segura sin race conditions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setClientDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setClientDropdownOpen(false);
        setProductDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
      setTipoFacturaId((prev) => {
        if (prev) return prev;
        const ventaDirecta = (data.tipos_factura || []).find((tf) => tf.codigo === "VENTA_DIRECTA");
        if (ventaDirecta) return String(ventaDirecta.tipo_factura_id);
        if ((data.tipos_factura || []).length > 0) return String(data.tipos_factura[0].tipo_factura_id);
        return "";
      });

      // Tipo de pago por defecto (priorizar EFECTIVO)
      setTipoPagoId((prev) => {
        if (prev) return prev;
        const efectivo = (data.tipos_pago || []).find((tp) => tp.codigo === "EFECTIVO");
        if (efectivo) return String(efectivo.tipo_pago_id);
        if ((data.tipos_pago || []).length > 0) return String(data.tipos_pago[0].tipo_pago_id);
        return "";
      });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudieron cargar los catálogos del módulo de facturación.",
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, []);

  // Verificar permisos de productos (TALLER.puede_crear)
  useEffect(() => {
    const checkProductPermissions = async () => {
      try {
        const res = await fetch("/api/taller/productos");
        const permCrear = res.headers.get("x-perm-crear");
        if (permCrear !== null) {
          setCanCreateProduct(permCrear === "true");
        } else if (res.ok) {
          const data = await res.json();
          if (data.canCreate !== undefined) {
            setCanCreateProduct(Boolean(data.canCreate));
          }
        }
      } catch {
        // En caso de error de red mantener fallback
      }
    };
    checkProductPermissions();
  }, []);

  // Verificar permisos de clientes en CRM (x-perm-crear)
  useEffect(() => {
    const checkCrmPermissions = async () => {
      try {
        const res = await fetch("/api/crm/clientes");
        const permCrear = res.headers.get("x-perm-crear");
        if (permCrear !== null) {
          setCanCreateClient(permCrear === "true");
        }
      } catch {
        // En caso de error de red mantener fallback
      }
    };
    checkCrmPermissions();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalogos();
  }, [loadCatalogos]);

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
    if (createdInvoice) setCreatedInvoice(null);
    setSelectedClient(client);
    setClientSearch("");
    setClientDropdownOpen(false);
  };

  // Limpiar cliente
  const handleClearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
  };

  // Callback cuando se crea cliente nuevo desde CustomerFormDrawer
  const handleCustomerCreated = useCallback(async (newClient) => {
    setIsCreateCustomerModalOpen(false);

    try {
      const res = await fetch("/api/crm/clientes");
      if (res.ok) {
        const data = await res.json();
        const clientList = Array.isArray(data) ? data : (data?.data || []);
        setClientes(clientList);
      }
    } catch (err) {
      console.error("Error refrescando clientes:", err);
    }

    if (newClient) {
      const cid = newClient.cliente_id || newClient.id;
      const formattedClient = {
        cliente_id: cid,
        id: cid,
        nombre_completo:
          newClient.nombre_completo ||
          `${newClient.nombre || ""} ${newClient.apellido || ""}`.trim() ||
          "Nuevo Cliente",
        identificacion: newClient.identificacion || "",
        telefono_principal: newClient.telefono_principal || "",
        correo: newClient.correo || "",
      };

      setClientes((prev) => {
        const exists = prev.some((c) => String(c.cliente_id) === String(cid));
        return exists ? prev : [formattedClient, ...prev];
      });

      setSelectedClient(formattedClient);
      setClientSearch("");
      setClientDropdownOpen(false);
    }
  }, []);

  // Resolver almacén automáticamente usando stock disponible y reglas de inventario
  const resolveProductAlmacen = useCallback((product) => {
    if (!product) return null;

    const existenciasConStock = (product.existencias || []).filter(
      (e) => Number(e.cantidad_disponible || 0) > 0
    );

    // 1. Si el producto tiene stock en un solo almacén: usar ese
    if (existenciasConStock.length === 1) {
      return Number(existenciasConStock[0].almacen_id);
    }

    // 2. Si tiene stock en varios almacenes: usar el almacén con mayor stock disponible
    if (existenciasConStock.length > 1) {
      const sorted = [...existenciasConStock].sort((a, b) => {
        const diff = Number(b.cantidad_disponible || 0) - Number(a.cantidad_disponible || 0);
        if (diff !== 0) return diff;
        return Number(a.almacen_id || 0) - Number(b.almacen_id || 0);
      });
      return Number(sorted[0].almacen_id);
    }

    // 3. Si no tiene stock disponible en ningún almacén: fallback al primer almacén asignado o catálogo general
    if (product.existencias && product.existencias.length > 0) {
      return Number(product.existencias[0].almacen_id);
    }

    if (almacenes && almacenes.length > 0) {
      return Number(almacenes[0].almacen_id);
    }

    return null;
  }, [almacenes]);

  // Stock disponible del producto seleccionado en el almacén resuelto
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

  // Seleccionar producto para el formulario de línea (resuelve almacén internamente)
  const handleSelectProduct = useCallback((product) => {
    if (createdInvoice) setCreatedInvoice(null);
    setSelectedProduct(product);
    setProductSearch("");
    setProductDropdownOpen(false);
    setLinePrecio(String(product.precio_venta || "0"));
    setLineCantidad("1");
    setLineDescuento("0");
    const autoAlmId = resolveProductAlmacen(product);
    setLineAlmacenId(autoAlmId ? String(autoAlmId) : "");
  }, [resolveProductAlmacen, createdInvoice]);

  // Callback cuando se crea producto nuevo desde ProductCreateModal
  const handleProductCreated = useCallback(async (newProduct) => {
    setIsCreateProductModalOpen(false);

    let freshCatalogProducts = [];
    try {
      const res = await fetch("/api/facturacion/catalogos");
      if (res.ok) {
        const data = await res.json();
        freshCatalogProducts = data.productos || [];
        setProductos(freshCatalogProducts);
      }
    } catch (err) {
      console.error("Error refrescando productos:", err);
    }

    if (newProduct) {
      const pid = newProduct.producto_id || newProduct.id;
      const match = freshCatalogProducts.find((p) => String(p.producto_id) === String(pid));
      if (match) {
        handleSelectProduct(match);
      } else {
        handleSelectProduct(newProduct);
      }
    }
  }, [handleSelectProduct]);

  // Agregar línea a la tabla (almacén transparente)
  const handleAddLine = (e) => {
    e.preventDefault();
    if (createdInvoice) setCreatedInvoice(null);

    if (!selectedProduct) {
      setFeedback({ type: "error", message: "Selecciona un producto para agregar a la factura." });
      return;
    }

    const resolvedAlmacenId = lineAlmacenId || resolveProductAlmacen(selectedProduct);
    if (!resolvedAlmacenId) {
      setFeedback({ type: "error", message: "No se pudo determinar el almacén para el producto seleccionado." });
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

    // Validar disponibilidad previa en el almacén resuelto
    if (cant > selectedProductStock) {
      setFeedback({
        type: "error",
        message: `Stock insuficiente: El producto solo tiene ${selectedProductStock} disponible(s) en almacén. Solicitado: ${cant}.`,
      });
      return;
    }

    const subtotalLinea = parseFloat(((cant * prec) - desc).toFixed(2));
    const targetAlm = almacenes.find((a) => String(a.almacen_id) === String(resolvedAlmacenId));

    const nuevaLinea = {
      tempId: `${selectedProduct.producto_id}-${resolvedAlmacenId}-${Date.now()}`,
      tipo_linea: "PRODUCTO",
      producto_id: selectedProduct.producto_id,
      almacen_id: Number(resolvedAlmacenId),
      almacen_nombre: targetAlm ? targetAlm.nombre : `Almacén #${resolvedAlmacenId}`,
      codigo: selectedProduct.codigo_producto,
      descripcion: selectedProduct.nombre,
      cantidad: cant,
      precio_unitario: prec,
      descuento: desc,
      subtotal: subtotalLinea,
      costo_unitario: selectedProduct.costo_actual,
      permite_decimales: selectedProduct.permite_decimales,
      stock_disponible: selectedProductStock,
      isFromOrder: false,
    };

    setLineas((prev) => [...prev, nuevaLinea]);
    setSelectedProduct(null);
    setLineAlmacenId("");
    setLineCantidad("1");
    setLinePrecio("");
    setLineDescuento("0");
    setFeedback(null);
  };

  // Modificar cantidad, precio o descuento en línea editable
  const handleUpdateLineField = (tempId, field, value) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l;
        // Si la línea proviene de OT y es SERVICIO o REPUESTO, es inmutable (Sección 13)
        if (l.isFromOrder && (l.tipo_linea === "SERVICIO" || l.tipo_linea === "REPUESTO")) {
          return l;
        }
        const numVal = Number(value);
        if (field === "cantidad") {
          if (!l.permite_decimales && (!Number.isInteger(numVal) || numVal % 1 !== 0)) {
            setFeedback({
              type: "error",
              message: `El producto ${l.descripcion} no permite cantidades decimales. Debe ingresar un número entero.`,
            });
            return l;
          }
        }
        const updated = { ...l, [field]: isNaN(numVal) ? 0 : numVal };
        const sub = Math.max(0, (updated.cantidad * updated.precio_unitario) - (updated.descuento || 0));
        updated.subtotal = parseFloat(sub.toFixed(2));
        return updated;
      })
    );
  };

  // Eliminar línea (solo líneas editables, no SERVICIO/REPUESTO de OT)
  const handleRemoveLine = (tempId) => {
    setLineas((prev) =>
      prev.filter((l) => {
        if (l.tempId !== tempId) return true;
        if (l.isFromOrder && (l.tipo_linea === "SERVICIO" || l.tipo_linea === "REPUESTO")) {
          return true; // No permitir eliminar
        }
        return false;
      })
    );
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

  // Cálculo de devuelta para EFECTIVO (Sección 6 y 7)
  const isEfectivo = useMemo(() => {
    const tp = tiposPago.find((t) => String(t.tipo_pago_id) === String(tipoPagoId));
    return tp && String(tp.codigo).toUpperCase() === "EFECTIVO";
  }, [tiposPago, tipoPagoId]);

  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const devuelta = useMemo(() => {
    if (!isEfectivo || totalFactura <= 0) return 0;
    return parseFloat((montoRecibidoNum - totalFactura).toFixed(2));
  }, [isEfectivo, montoRecibidoNum, totalFactura]);

  // Cargar Orden de Trabajo seleccionada (FAC-3)
  const handleSelectWorkOrder = (ot) => {
    if (createdInvoice) setCreatedInvoice(null);
    setOrdenTrabajo(ot);

    // 1. Cliente vinculado a la OT
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

    // 2. Tipo Factura ORDEN_TRABAJO
    const otTipo = tiposFactura.find((tf) => tf.codigo === "ORDEN_TRABAJO");
    if (otTipo) {
      setTipoFacturaId(String(otTipo.tipo_factura_id));
    }

    // 3. Servicios facturables (Inmutables)
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

    // 4. Repuestos consumidos (Inmutables)
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

    // Conservar líneas de productos manuales adicionales ya agregadas
    const manualLines = lineas.filter((l) => !l.isFromOrder);

    setLineas([...serviceLines, ...spareLines, ...manualLines]);
    setFeedback({
      type: "success",
      message: `Orden de Trabajo ${ot.codigo_orden} cargada con ${serviceLines.length} servicio(s) y ${spareLines.length} repuesto(s) consumido(s).`,
    });
  };

  // Desvincular Orden de Trabajo (Sección 17)
  const handleDetachOrder = () => {
    setOrdenTrabajo(null);
    setSelectedClient(null); // Desvincular cliente bloqueado de OT
    setLineas((prev) => prev.filter((l) => !l.isFromOrder)); // Conservar productos adicionales manuales
    const vdT = tiposFactura.find((tf) => tf.codigo === "VENTA_DIRECTA");
    if (vdT) {
      setTipoFacturaId(String(vdT.tipo_factura_id));
    }
    setFeedback(null);
  };

  // Submit Generar Factura (Sección 11 y 12)
  const handleSubmitFactura = async () => {
    if (submitting) return;

    if (lineas.length === 0) {
      setFeedback({ type: "error", message: "Agrega al menos un producto o servicio a la factura antes de generar." });
      return;
    }

    if (totalFactura <= 0) {
      setFeedback({ type: "error", message: "El total de la factura debe ser mayor a 0." });
      return;
    }

    if (!tipoFacturaId) {
      setFeedback({ type: "error", message: "No se ha determinado el tipo de factura." });
      return;
    }

    // Validaciones para CONTADO (Sección 6 y 26)
    if (condicionVenta === "CONTADO") {
      if (!tipoPagoId) {
        setFeedback({ type: "error", message: "Selecciona el tipo de pago para la venta al contado." });
        return;
      }
      if (isEfectivo && montoRecibidoNum < totalFactura) {
        setFeedback({
          type: "error",
          message: `El monto recibido (RD$ ${montoRecibidoNum.toFixed(2)}) no puede ser menor al total de la factura (RD$ ${totalFactura.toFixed(2)}).`,
        });
        return;
      }
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        tipo_factura_id: Number(tipoFacturaId),
        cliente_id: selectedClient ? selectedClient.cliente_id : null,
        orden_trabajo_id: ordenTrabajo ? ordenTrabajo.orden_trabajo_id : null,
        observacion: observacion.trim() || null,
        condicion_venta: condicionVenta,
        pago:
          condicionVenta === "CONTADO"
            ? {
                tipo_pago_id: Number(tipoPagoId),
                monto_recibido: isEfectivo ? montoRecibidoNum : totalFactura,
                referencia: pagoReferencia.trim() || null,
              }
            : null,
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

      const facturaId = data.factura?.factura_id;
      const codigoFactura = data.factura?.codigo_factura || `FAC-${facturaId}`;

      // Guardar factura creada para permitir impresión inmediata (Sección 18 y 21)
      setCreatedInvoice({
        factura_id: facturaId,
        codigo_factura: codigoFactura,
      });

      setFeedback({
        type: "success",
        message: `Factura ${codigoFactura} generada exitosamente con salida de inventario y estado ${data.factura?.estado || (condicionVenta === "CONTADO" ? "PAGADA" : "PENDIENTE")}.`,
      });

      // Limpiar formulario tras éxito manteniendo createdInvoice
      setOrdenTrabajo(null);
      setLineas([]);
      setSelectedClient(null);
      setSelectedProduct(null);
      setObservacion("");
      setMontoRecibido("");
      setPagoReferencia("");
      setCondicionVenta("CONTADO");
      await loadCatalogos();
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        message: err.message || "Ocurrió un error inesperado al generar la factura.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Obtener factura recién creada para imprimir con InvoicePrintSelectorModal (Sección 19 y 20)
  const handlePrintCreatedInvoice = async (facturaId) => {
    const targetId = facturaId || createdInvoice?.factura_id;
    if (!targetId) return;

    try {
      setLoadingPrintData(true);
      const res = await fetch(`/api/facturacion/facturas/${targetId}`);
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.message || "No se pudo cargar la información de la factura para imprimir.");
      }
      setPrintInvoiceData(json.data);
      setIsPrintModalOpen(true);
    } catch (err) {
      console.error("Error al preparar impresión:", err);
      setFeedback({
        type: "error",
        message: err.message || "Error al preparar la impresión de la factura.",
      });
    } finally {
      setLoadingPrintData(false);
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

      {/* Banner de Factura Recién Generada con Botón Imprimir (Sección 18) */}
      {createdInvoice && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold text-sm text-foreground">
                ✓ Factura {createdInvoice.codigo_factura} generada exitosamente.
              </p>
              <p className="text-xs text-foreground-muted mt-0.5">
                Puedes imprimir el comprobante fiscal/ticket térmico o continuar con una nueva factura.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handlePrintCreatedInvoice(createdInvoice.factura_id)}
              disabled={loadingPrintData}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{loadingPrintData ? "Preparando..." : "IMPRIMIR"}</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatedInvoice(null)}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              title="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                Líneas de servicios y repuestos consumidos cargadas desde Taller (inmutables). Puedes agregar productos adicionales.
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
          {/* Card: Cliente (CRM) y Tipo de Factura */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Cliente (CRM)</h2>
              </div>
              <div className="flex items-center gap-2">
                {loadingCatalogos && (
                  <span className="text-[10px] text-foreground-muted font-mono animate-pulse">Cargando datos...</span>
                )}
                <label className="text-xs text-foreground-secondary font-medium whitespace-nowrap">
                  Tipo de Factura:
                </label>
                <select
                  value={tipoFacturaId}
                  onChange={(e) => {
                    if (!ordenTrabajo) {
                      setTipoFacturaId(e.target.value);
                    }
                  }}
                  disabled={Boolean(ordenTrabajo)}
                  className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/30 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground-secondary">
                  Cliente <span className="text-[11px] text-foreground-muted font-normal">(Opcional para venta al consumidor)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1" ref={clientDropdownRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        openClientDropdown();
                      }}
                      onFocus={openClientDropdown}
                      placeholder="Buscar cliente por nombre, cédula o teléfono..."
                      className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />

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

                  {canCreateClient && (
                    <button
                      type="button"
                      onClick={() => setIsCreateCustomerModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-primary border border-primary/30 hover:border-primary transition-all cursor-pointer whitespace-nowrap shadow-sm shrink-0"
                      title="Crear nuevo cliente"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nuevo Cliente</span>
                    </button>
                  )}
                </div>
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
            </div>

            {/* Buscador de Producto con botón Crear Producto */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground-secondary mb-1">
                Seleccionar Producto <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1" ref={productDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  <input
                    type="text"
                    value={selectedProduct ? `${selectedProduct.codigo_producto} — ${selectedProduct.nombre}` : productSearch}
                    onChange={(e) => {
                      setSelectedProduct(null);
                      setLineAlmacenId("");
                      setProductSearch(e.target.value);
                      openProductDropdown();
                    }}
                    onFocus={openProductDropdown}
                    placeholder="Buscar producto por código, nombre o código de barra..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
                  />
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setLineAlmacenId("");
                        setProductSearch("");
                        setProductDropdownOpen(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}

                  {productDropdownOpen && !selectedProduct && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto text-xs font-mono">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((p) => {
                          const autoAlmId = resolveProductAlmacen(p);
                          const exist = (p.existencias || []).find(
                            (e) => String(e.almacen_id) === String(autoAlmId)
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

                {canCreateProduct && (
                  <button
                    type="button"
                    onClick={() => setIsCreateProductModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-primary border border-primary/30 hover:border-primary transition-all cursor-pointer whitespace-nowrap shadow-sm shrink-0"
                    title="Crear nuevo producto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Crear producto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inputs de Línea: Cantidad, Precio Venta, Descuento (Almacén transparente) */}
            <form onSubmit={handleAddLine} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Cantidad {selectedProduct && `(Disp: ${selectedProductStock})`}
                </label>
                <input
                  type="number"
                  step={selectedProduct?.permite_decimales ? "0.01" : "1"}
                  min={selectedProduct?.permite_decimales ? "0.01" : "1"}
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

            {/* Tabla Multiproducto de Detalle (Líneas OT inmutables, productos editables) */}
            <div className="border border-border rounded-lg overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface border-b border-border font-mono text-[11px] text-foreground-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">TIPO</th>
                      <th className="py-2.5 px-3">CÓDIGO</th>
                      <th className="py-2.5 px-3">CONCEPTO / DESCRIPCIÓN</th>
                      <th className="py-2.5 px-3 text-right">CANT.</th>
                      <th className="py-2.5 px-3 text-right">PRECIO</th>
                      <th className="py-2.5 px-3 text-right">DESC.</th>
                      <th className="py-2.5 px-3 text-right">IMPORTE</th>
                      <th className="py-2.5 px-3 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lineas.length > 0 ? (
                      lineas.map((l) => {
                        const isImmutable = Boolean(
                          l.isFromOrder && (l.tipo_linea === "SERVICIO" || l.tipo_linea === "REPUESTO")
                        );

                        return (
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
                            <td className="py-2 px-3 text-right">
                              {isImmutable ? (
                                <span className="text-foreground-secondary font-mono px-2 py-0.5">
                                  {l.cantidad}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  step={l.permite_decimales ? "0.01" : "1"}
                                  min={l.permite_decimales ? "0.01" : "1"}
                                  value={l.cantidad}
                                  onChange={(e) => handleUpdateLineField(l.tempId, "cantidad", e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {isImmutable ? (
                                <span className="text-foreground-secondary font-mono px-2 py-0.5">
                                  {Number(l.precio_unitario).toFixed(2)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={l.precio_unitario}
                                  onChange={(e) => handleUpdateLineField(l.tempId, "precio_unitario", e.target.value)}
                                  className="w-20 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {isImmutable ? (
                                <span className="text-foreground-secondary font-mono px-2 py-0.5">
                                  {Number(l.descuento || 0).toFixed(2)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={l.descuento}
                                  onChange={(e) => handleUpdateLineField(l.tempId, "descuento", e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right text-xs bg-input border border-border rounded text-foreground font-mono focus:outline-none focus:border-primary"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-foreground">
                              RD$ {Number(l.subtotal || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isImmutable ? (
                                <span
                                  className="p-1 inline-flex text-foreground-muted"
                                  title="Proviene de la Orden de Trabajo"
                                >
                                  <Lock className="w-3.5 h-3.5 text-primary" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(l.tempId)}
                                  className="p-1 rounded text-foreground-muted hover:text-error hover:bg-hover transition-colors cursor-pointer"
                                  title="Eliminar producto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-foreground-muted text-xs font-sans">
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

        {/* COLUMNA DERECHA (span 4): Resumen de Totales, Condición de Venta y Generar Factura */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card 1: Resumen de Totales (Sección 9 y 10) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 font-sans">
              <h3 className="text-sm font-bold text-foreground">Resumen de Totales</h3>
              {totalFactura > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    condicionVenta === "CONTADO"
                      ? "bg-success/15 border-success/40 text-success"
                      : "bg-surface-subtle border-border text-foreground-muted"
                  }`}
                >
                  {condicionVenta === "CONTADO" ? "PAGADA" : "PENDIENTE"}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border bg-surface-subtle border-border text-foreground-muted">
                  PENDIENTE DE GENERAR
                </span>
              )}
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
            </div>
          </div>

          {/* Card 2: Condición de Venta y Cobro (Sección 2, 4, 5, 6, 8) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-bold text-foreground">Condición de Venta</h3>
              <span className="text-[11px] font-mono text-foreground-muted">
                {condicionVenta}
              </span>
            </div>

            {/* Selector Segmentado: CONTADO / CRÉDITO */}
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-2">
                Modalidad Comercial:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setCondicionVenta("CONTADO")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    condicionVenta === "CONTADO"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground hover:bg-hover"
                  }`}
                >
                  CONTADO
                </button>
                <button
                  type="button"
                  onClick={() => setCondicionVenta("CREDITO")}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    condicionVenta === "CREDITO"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground hover:bg-hover"
                  }`}
                >
                  CRÉDITO
                </button>
              </div>
            </div>

            {/* Si es CONTADO: Mostrar Tipo de Pago, Monto Recibido y Referencia */}
            {condicionVenta === "CONTADO" ? (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                    Tipo de Pago <span className="text-error">*</span>
                  </label>
                  <select
                    value={tipoPagoId}
                    onChange={(e) => setTipoPagoId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {tiposPago.map((tp) => (
                      <option key={tp.tipo_pago_id} value={tp.tipo_pago_id}>
                        {tp.nombre} ({tp.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Si Efectivo: Monto Recibido y Devuelta */}
                {isEfectivo ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-foreground-secondary">
                          Monto Recibido (RD$) <span className="text-error">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (totalFactura > 0) setMontoRecibido(String(totalFactura));
                          }}
                          disabled={totalFactura <= 0}
                          className="text-[10px] font-mono text-primary hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Cobro exacto (RD$ {totalFactura.toFixed(2)})
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-2 text-xs bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5 font-mono">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-foreground-secondary font-sans">Devuelta:</span>
                        <span
                          className={`text-sm font-bold ${
                            totalFactura <= 0
                              ? "text-foreground-muted"
                              : devuelta >= 0
                              ? "text-emerald-400"
                              : "text-error"
                          }`}
                        >
                          RD$ {totalFactura > 0 && devuelta >= 0 ? devuelta.toFixed(2) : "0.00"}
                        </span>
                      </div>
                      {totalFactura > 0 && montoRecibidoNum > 0 && devuelta < 0 && (
                        <p className="text-[11px] text-error font-sans">
                          El monto recibido es menor al total de la factura (faltan RD$ {Math.abs(devuelta).toFixed(2)})
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-surface border border-border text-xs font-mono">
                    <div className="flex justify-between text-foreground-secondary">
                      <span>Monto a cobrar:</span>
                      <span className="font-bold text-foreground">RD$ {totalFactura.toFixed(2)}</span>
                    </div>
                  </div>
                )}

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
              </div>
            ) : (
              /* Si es CRÉDITO */
              <div className="p-3.5 rounded-lg bg-surface border border-border/80 text-xs space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span>Venta a Crédito</span>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  La factura se generará en estado <strong className="text-amber-400">PENDIENTE</strong> con balance total de{" "}
                  <strong className="text-foreground font-mono">RD$ {totalFactura.toFixed(2)}</strong>. No se registrará pago inicial.
                </p>
                <p className="text-[10px] text-foreground-muted border-t border-border/50 pt-1.5">
                  Los pagos posteriores se registrarán desde Facturas → Registrar Pago (FAC-4).
                </p>
              </div>
            )}
          </div>

          {/* Botón Principal Generar Factura */}
          <button
            type="button"
            onClick={handleSubmitFactura}
            disabled={
              submitting ||
              lineas.length === 0 ||
              totalFactura <= 0 ||
              (condicionVenta === "CONTADO" && isEfectivo && montoRecibidoNum < totalFactura)
            }
            className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
              submitting ||
              lineas.length === 0 ||
              totalFactura <= 0 ||
              (condicionVenta === "CONTADO" && isEfectivo && montoRecibidoNum < totalFactura)
                ? "bg-surface-subtle text-foreground-muted border border-border cursor-not-allowed opacity-60"
                : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary/20 cursor-pointer"
            }`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Generar Factura</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Modal: Crear Cliente CRM */}
      <CustomerFormDrawer
        isOpen={isCreateCustomerModalOpen}
        presentation="modal"
        onClose={() => setIsCreateCustomerModalOpen(false)}
        onSuccess={handleCustomerCreated}
      />

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

      {/* Modal de Impresión de Factura (Sección 19-20: Reutiliza Modelo 1 y Modelo 2) */}
      {isPrintModalOpen && printInvoiceData && (
        <InvoicePrintSelectorModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintInvoiceData(null);
          }}
          invoiceData={printInvoiceData}
        />
      )}
    </div>
  );
}
