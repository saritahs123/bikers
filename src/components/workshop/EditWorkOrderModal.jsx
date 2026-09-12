"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Edit,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  Wrench,
  User,
  Loader2,
  Search,
  Info,
  Package,
  FileText
} from "lucide-react";

let editWoTempCounter = 0;
const generateItemTempId = (prefix = "item") => {
  editWoTempCounter += 1;
  return `${prefix}_${Date.now()}_${editWoTempCounter}`;
};

export default function EditWorkOrderModal({ isOpen, ordenId, onClose, onSuccess }) {
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Order baseline data
  const [orderCode, setOrderCode] = useState("");
  const [selectedReceptionId, setSelectedReceptionId] = useState("");
  const [selectedReception, setSelectedReception] = useState(null);

  // Catalogs
  const [catalogs, setCatalogs] = useState({
    estados: [],
    prioridades: [],
    mecanicos: [],
    tipos_servicio: [],
    productos: [],
    almacenes: []
  });
  const [selectedAlmacenId, setSelectedAlmacenId] = useState("");

  // Receptions
  const [availableReceptions, setAvailableReceptions] = useState([]);

  // Clients & Bicycles Autocomplete States
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(-1);
  const clientComboboxRef = useRef(null);

  const [clientBicycles, setClientBicycles] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [loadingBikes, setLoadingBikes] = useState(false);

  // Parámetros Operativos
  const [selectedEstadoId, setSelectedEstadoId] = useState("");
  const [selectedPrioridadId, setSelectedPrioridadId] = useState("2");
  const [selectedMecanicoId, setSelectedMecanicoId] = useState("");
  const [diagnostico, setDiagnostico] = useState("");

  // Autocomplete Service State
  const [serviceSearch, setServiceSearch] = useState("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [activeServiceIndex, setActiveServiceIndex] = useState(-1);
  const serviceComboboxRef = useRef(null);

  // Autocomplete Product State
  const [productSearch, setProductSearch] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(-1);
  const productComboboxRef = useRef(null);

  // Unified Items List (Services + Products)
  const [itemsList, setItemsList] = useState([]);
  const [editingProductTempId, setEditingProductTempId] = useState(null);
  const [editingProductQuantity, setEditingProductQuantity] = useState("");
  const [editingProductError, setEditingProductError] = useState("");
  const editingQuantityInputRef = useRef(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientComboboxRef.current && !clientComboboxRef.current.contains(e.target)) {
        setIsClientDropdownOpen(false);
      }
      if (serviceComboboxRef.current && !serviceComboboxRef.current.contains(e.target)) {
        setIsServiceDropdownOpen(false);
      }
      if (productComboboxRef.current && !productComboboxRef.current.contains(e.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadOrderAndCatalogs = useCallback(async () => {
    setLoadingInit(true);
    setError("");
    try {
      const [resOrder, resCats, resRecs, resClients] = await Promise.all([
        fetch(`/api/taller/ordenes/${ordenId}`),
        fetch("/api/taller/catalogos"),
        fetch(`/api/taller/recepciones?disponibles_ot=true&para_orden_id=${ordenId}&limit=100`),
        fetch("/api/crm/clientes")
      ]);

      const orderJson = await resOrder.json();
      const catsJson = await resCats.json();
      const recsJson = await resRecs.json();
      const clientsJson = await resClients.json();

      if (!resOrder.ok) {
        throw new Error(orderJson.message || "No se pudo cargar la orden de trabajo.");
      }

      const orderData = orderJson.data || orderJson;
      setOrderCode(orderData.codigo_orden || `OT #${ordenId}`);
      setSelectedReceptionId(orderData.recepcion_id ? String(orderData.recepcion_id) : "");

      setSelectedEstadoId(orderData.estado_orden_id ? String(orderData.estado_orden_id) : "1");
      setSelectedPrioridadId(orderData.prioridad_id ? String(orderData.prioridad_id) : "2");
      setSelectedMecanicoId(
        orderData.mecanico_id || orderData.mecanico_usuario_id
          ? String(orderData.mecanico_id || orderData.mecanico_usuario_id)
          : ""
      );
      setDiagnostico(orderData.diagnostico_inicial || orderData.descripcion_cliente || "");

      // Setup Catalogs
      const catObj = catsJson?.data || catsJson || {};
      setCatalogs({
        estados: catObj.estados_orden_trabajo || [],
        prioridades: catObj.prioridades || [],
        mecanicos: catObj.mecanicos || [],
        tipos_servicio: catObj.tipos_servicio || [],
        productos: catObj.productos || [],
        almacenes: catObj.almacenes || []
      });

      if (catObj.almacenes?.length > 0) {
        setSelectedAlmacenId(String(catObj.almacenes[0].almacen_id));
      }

      // Setup Clients
      const clientArr = Array.isArray(clientsJson?.data)
        ? clientsJson.data
        : Array.isArray(clientsJson)
        ? clientsJson
        : [];
      setClients(clientArr);

      // Setup Receptions
      const recArr = Array.isArray(recsJson?.data)
        ? recsJson.data
        : Array.isArray(recsJson)
        ? recsJson
        : [];

      let finalRecs = [...recArr];
      if (
        orderData.recepcion_id &&
        !finalRecs.some((r) => Number(r.recepcion_id) === Number(orderData.recepcion_id))
      ) {
        finalRecs.unshift({
          recepcion_id: orderData.recepcion_id,
          codigo_recepcion: orderData.codigo_recepcion || `REC #${orderData.recepcion_id}`,
          cliente_id: orderData.cliente_id,
          cliente_nombre: orderData.cliente_nombre,
          cliente_telefono: orderData.cliente_telefono,
          cliente_correo: orderData.cliente_correo,
          bicicleta_id: orderData.bicicleta_id,
          bicicleta_resumen:
            `${orderData.bicicleta_marca || ""} ${orderData.bicicleta_modelo || ""}`.trim() ||
            "Bicicleta",
          bicicleta_serie: orderData.bicicleta_serie || "N/A",
          fecha_recepcion: orderData.fecha_ingreso
        });
      }
      setAvailableReceptions(finalRecs);

      // Active selected reception object
      const currentRecObj =
        finalRecs.find((r) => String(r.recepcion_id) === String(orderData.recepcion_id)) || {
          recepcion_id: orderData.recepcion_id,
          codigo_recepcion: orderData.codigo_recepcion || `REC #${orderData.recepcion_id}`,
          cliente_id: orderData.cliente_id,
          cliente_nombre: orderData.cliente_nombre,
          bicicleta_id: orderData.bicicleta_id,
          bicicleta_resumen: `${orderData.bicicleta_marca || ""} ${orderData.bicicleta_modelo || ""}`.trim() || "Bicicleta",
          bicicleta_serie: orderData.bicicleta_serie || "N/A",
          fecha_recepcion: orderData.fecha_ingreso
        };
      setSelectedReception(currentRecObj);

      // Initialize Selected Client
      const activeCli = clientArr.find(
        (c) => Number(c.cliente_id || c.id) === Number(orderData.cliente_id)
      ) || {
        cliente_id: orderData.cliente_id,
        nombre_completo: orderData.cliente_nombre || "Cliente",
        telefono_principal: orderData.cliente_telefono || ""
      };
      setSelectedClient(activeCli);
      setClientSearch(activeCli.nombre_completo || "");

      // Load Bicycles for active client
      if (orderData.cliente_id) {
        setLoadingBikes(true);
        try {
          const resBikes = await fetch(`/api/crm/bicicletas?cliente_id=${orderData.cliente_id}`);
          const bikesData = await resBikes.json();
          const bikesArr = Array.isArray(bikesData?.data)
            ? bikesData.data
            : Array.isArray(bikesData)
            ? bikesData
            : [];
          setClientBicycles(bikesArr);

          const activeBike = bikesArr.find(
            (b) => Number(b.bicicleta_id || b.id) === Number(orderData.bicicleta_id)
          ) || {
            bicicleta_id: orderData.bicicleta_id,
            marca: orderData.bicicleta_marca || "",
            modelo: orderData.bicicleta_modelo || "Bicicleta",
            numero_serie_cuadro: orderData.bicicleta_serie || ""
          };
          setSelectedBike(activeBike);
        } catch {
          setClientBicycles([]);
        } finally {
          setLoadingBikes(false);
        }
      }

      // Map existing Services and Products into itemsList
      const initialItems = [];
      const rawServices = orderData.servicios || [];
      rawServices.forEach((s) => {
        if (s.activo !== false) {
          initialItems.push({
            temp_id: s.orden_servicio_id ? `srv_${s.orden_servicio_id}` : generateItemTempId("srv"),
            orden_servicio_id: s.orden_servicio_id || s.servicio_id,
            type: "servicio",
            tipo_servicio_id: s.tipo_servicio_id || s.servicio_id,
            nombre: s.tipo_servicio_nombre || s.descripcion_servicio || s.descripcion || "Servicio",
            cantidad: 1,
            precio_unitario: Number(s.precio_unitario || s.precio_acordado || 0),
            subtotal: Number(s.subtotal || s.precio_acordado || s.precio_unitario || 0),
            observacion_tecnica: s.observacion_tecnica || ""
          });
        }
      });

      const rawProducts = orderData.productos || orderData.repuestos || [];
      rawProducts.forEach((p) => {
        const qty = Number(p.cantidad || 1);
        const pu = Number(p.precio_unitario || p.precio_venta || 0);
        initialItems.push({
          temp_id: p.orden_producto_id ? `prod_${p.orden_producto_id}` : generateItemTempId("prod"),
          orden_producto_id: p.orden_producto_id || p.id,
          type: "producto",
          producto_id: p.producto_id,
          almacen_id: p.almacen_id,
          almacen_nombre: p.almacen_nombre || catObj.almacenes?.find((a) => Number(a.almacen_id) === Number(p.almacen_id))?.nombre || null,
          almacen_codigo: p.almacen_codigo || catObj.almacenes?.find((a) => Number(a.almacen_id) === Number(p.almacen_id))?.codigo || null,
          nombre: p.producto_nombre || p.nombre || "Producto / Repuesto",
          cantidad: qty,
          precio_unitario: pu,
          subtotal: Math.round(qty * pu * 100) / 100,
          permite_decimales: Boolean(p.permite_decimales),
          observacion: p.observacion || ""
        });
      });

      setItemsList(initialItems);
    } catch (err) {
      console.error("Error cargando orden para editar:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoadingInit(false);
    }
  }, [ordenId]);

  // Fetch initial data when modal opens
  useEffect(() => {
    if (isOpen && ordenId) {
      let isMounted = true;
      const init = async () => {
        if (isMounted) {
          await loadOrderAndCatalogs();
        }
      };
      init();
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, ordenId, loadOrderAndCatalogs]);

  // Handle Reception Change: Pre-loads Client and Bike from reception, but keeps them editable
  const handleReceptionChange = async (e) => {
    const recId = e.target.value;
    setSelectedReceptionId(recId);
    const recObj = availableReceptions.find((r) => String(r.recepcion_id) === String(recId));
    setSelectedReception(recObj || null);

    if (recObj && recObj.cliente_id) {
      // Find client object in catalogs/clients
      let cliObj = clients.find(
        (c) => Number(c.cliente_id || c.id) === Number(recObj.cliente_id)
      );
      if (!cliObj) {
        cliObj = {
          cliente_id: recObj.cliente_id,
          nombre_completo: recObj.cliente_nombre || "Cliente",
          telefono_principal: recObj.cliente_telefono || ""
        };
      }
      setSelectedClient(cliObj);
      setClientSearch(cliObj.nombre_completo || "");

      // Load Bicycles for that client
      setLoadingBikes(true);
      try {
        const res = await fetch(`/api/crm/bicicletas?cliente_id=${recObj.cliente_id}`);
        const data = await res.json();
        const bikesArr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setClientBicycles(bikesArr);

        // Pre-select the bike from reception if found, otherwise auto-select if single bike
        const matchingBike = bikesArr.find(
          (b) => Number(b.bicicleta_id || b.id) === Number(recObj.bicicleta_id)
        );
        if (matchingBike) {
          setSelectedBike(matchingBike);
        } else if (bikesArr.length === 1) {
          setSelectedBike(bikesArr[0]);
        } else {
          setSelectedBike(null);
        }
      } catch {
        setClientBicycles([]);
        setSelectedBike(null);
      } finally {
        setLoadingBikes(false);
      }
    }
  };

  // Handle Manual Client Selection
  const handleSelectClient = async (cli) => {
    if (!cli) return;
    setSelectedClient(cli);
    setClientSearch(cli.nombre_completo || "");
    setIsClientDropdownOpen(false);
    setActiveClientIndex(-1);

    const targetCliId = cli.cliente_id || cli.id;
    setLoadingBikes(true);
    try {
      const res = await fetch(`/api/crm/bicicletas?cliente_id=${targetCliId}`);
      const data = await res.json();
      const bikesArr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setClientBicycles(bikesArr);

      // Check if current bike belongs to this new client
      if (
        selectedBike &&
        !bikesArr.some(
          (b) => Number(b.bicicleta_id || b.id) === Number(selectedBike.bicicleta_id || selectedBike.id)
        )
      ) {
        if (bikesArr.length === 1) {
          setSelectedBike(bikesArr[0]);
        } else {
          setSelectedBike(null);
        }
      } else if (!selectedBike && bikesArr.length === 1) {
        setSelectedBike(bikesArr[0]);
      }
    } catch {
      setClientBicycles([]);
      setSelectedBike(null);
    } finally {
      setLoadingBikes(false);
    }
  };

  // Check if current client or bike differs from the selected reception's baseline
  const isDataDivergentFromReception = useMemo(() => {
    if (!selectedReception) return false;
    const currentCliId = selectedClient?.cliente_id || selectedClient?.id;
    const currentBikeId = selectedBike?.bicicleta_id || selectedBike?.id;

    const recCliId = selectedReception.cliente_id;
    const recBikeId = selectedReception.bicicleta_id;

    if (recCliId && currentCliId && Number(recCliId) !== Number(currentCliId)) {
      return true;
    }
    if (recBikeId && currentBikeId && Number(recBikeId) !== Number(currentBikeId)) {
      return true;
    }
    return false;
  }, [selectedReception, selectedClient, selectedBike]);

  // Autocomplete Filter for Clients
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 8);
    const term = clientSearch.toLowerCase();
    return clients
      .filter((c) => {
        const nom = (c.nombre_completo || `${c.nombre || ""} ${c.apellido || ""}`).toLowerCase();
        const ident = (c.identificacion || "").toLowerCase();
        const tel = (c.telefono_principal || c.telefono || "").toLowerCase();
        return nom.includes(term) || ident.includes(term) || tel.includes(term);
      })
      .slice(0, 8);
  }, [clients, clientSearch]);

  // Autocomplete Filter for Services
  const filteredServices = useMemo(() => {
    const list = catalogs.tipos_servicio || [];
    if (!serviceSearch.trim()) return list.slice(0, 8);
    const term = serviceSearch.toLowerCase();
    return list
      .filter(
        (s) =>
          (s.nombre && s.nombre.toLowerCase().includes(term)) ||
          (s.codigo && s.codigo.toLowerCase().includes(term)) ||
          (s.descripcion && s.descripcion.toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [catalogs.tipos_servicio, serviceSearch]);

  // Autocomplete Filter for Products
  const filteredProducts = useMemo(() => {
    const list = catalogs.productos || [];
    if (!productSearch.trim()) return list.slice(0, 8);
    const term = productSearch.toLowerCase();
    return list
      .filter(
        (p) =>
          (p.nombre && p.nombre.toLowerCase().includes(term)) ||
          (p.codigo && p.codigo.toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [catalogs.productos, productSearch]);

  // Instant Add Service
  const handleSelectService = (serviceObj) => {
    if (!serviceObj) return;
    const price = Number(serviceObj.precio_base || serviceObj.precio || 0);
    const newItem = {
      temp_id: generateItemTempId("srv_new"),
      type: "servicio",
      tipo_servicio_id: serviceObj.tipo_servicio_id,
      nombre: serviceObj.nombre || "Servicio",
      cantidad: 1,
      precio_unitario: price,
      subtotal: price,
      observacion_tecnica: ""
    };
    setItemsList((prev) => [...prev, newItem]);
    setServiceSearch("");
    setIsServiceDropdownOpen(false);
    setActiveServiceIndex(-1);
  };

  // Instant Add Product
  const handleSelectProduct = (prodObj) => {
    if (!prodObj) return;
    const price = Number(prodObj.precio_venta || prodObj.precio || 0);
    const activeAlmId = selectedAlmacenId ? Number(selectedAlmacenId) : (catalogs.almacenes?.[0]?.almacen_id || undefined);
    const activeAlm = (catalogs.almacenes || []).find((a) => Number(a.almacen_id) === Number(activeAlmId));
    const newItem = {
      temp_id: generateItemTempId("prod_new"),
      type: "producto",
      producto_id: prodObj.producto_id,
      almacen_id: activeAlmId,
      almacen_nombre: activeAlm?.nombre || null,
      almacen_codigo: activeAlm?.codigo || null,
      nombre: prodObj.nombre || "Producto / Repuesto",
      cantidad: 1,
      precio_unitario: price,
      subtotal: price,
      permite_decimales: Boolean(prodObj.permite_decimales),
      observacion: ""
    };
    setItemsList((prev) => [...prev, newItem]);
    setProductSearch("");
    setIsProductDropdownOpen(false);
    setActiveProductIndex(-1);
  };

  const handleRemoveItem = (tempId) => {
    setItemsList((prev) => prev.filter((item) => item.temp_id !== tempId));
    if (editingProductTempId === tempId) {
      setEditingProductTempId(null);
      setEditingProductQuantity("");
      setEditingProductError("");
    }
  };

  // Pure snapshot helper: applies any pending quantity edit without mutating input items
  const applyPendingQuantityEdit = (items) => {
    if (!editingProductTempId) return items;
    const targetItem = items.find((it) => it.temp_id === editingProductTempId);
    if (!targetItem) return items;

    const rawVal = String(editingProductQuantity).trim();
    if (rawVal === "") {
      return items;
    }

    const parsed = Number(rawVal);
    if (isNaN(parsed) || parsed <= 0) {
      return items;
    }

    const allowsDecimals =
      targetItem.permite_decimales ??
      catalogs.productos?.find((cp) => cp.producto_id === targetItem.producto_id)?.permite_decimales ??
      false;

    if (!allowsDecimals && !Number.isInteger(parsed)) {
      return items;
    }

    const finalQty = allowsDecimals ? Math.round(parsed * 100) / 100 : Math.round(parsed);
    const pu = Number(targetItem.precio_unitario || 0);
    const newSubtotal = Math.round(finalQty * pu * 100) / 100;

    return items.map((it) => {
      if (it.temp_id === editingProductTempId) {
        return {
          ...it,
          cantidad: finalQty,
          subtotal: newSubtotal
        };
      }
      return it;
    });
  };

  const handleStartEditQuantity = (item) => {
    if (item.type !== "producto") return;
    setEditingProductTempId(item.temp_id);
    setEditingProductQuantity(String(item.cantidad));
    setEditingProductError("");
    setTimeout(() => {
      if (editingQuantityInputRef.current) {
        editingQuantityInputRef.current.focus();
        editingQuantityInputRef.current.select();
      }
    }, 50);
  };

  const handleSaveQuantity = (tempId) => {
    const targetId = tempId || editingProductTempId;
    if (!targetId) return;

    const rawVal = String(editingProductQuantity).trim();
    if (rawVal === "") {
      setEditingProductTempId(null);
      setEditingProductQuantity("");
      setEditingProductError("");
      return;
    }

    const parsed = Number(rawVal);
    if (isNaN(parsed) || parsed <= 0) {
      setEditingProductError("Cantidad inválida. Debe ser un número mayor a 0.");
      return;
    }

    const targetItem = itemsList.find((it) => it.temp_id === targetId);
    const allowsDecimals =
      targetItem?.permite_decimales ??
      catalogs.productos?.find((cp) => cp.producto_id === targetItem?.producto_id)?.permite_decimales ??
      false;

    if (!allowsDecimals && !Number.isInteger(parsed)) {
      setEditingProductError("Este producto no permite decimales. Ingrese un entero.");
      return;
    }

    const finalQty = allowsDecimals ? Math.round(parsed * 100) / 100 : Math.round(parsed);

    setItemsList((prev) =>
      prev.map((item) => {
        if (item.temp_id === targetId) {
          const pu = Number(item.precio_unitario || 0);
          return {
            ...item,
            cantidad: finalQty,
            subtotal: Math.round(finalQty * pu * 100) / 100
          };
        }
        return item;
      })
    );
    setEditingProductTempId(null);
    setEditingProductQuantity("");
    setEditingProductError("");
  };

  const handleCancelEditQuantity = () => {
    setEditingProductTempId(null);
    setEditingProductQuantity("");
    setEditingProductError("");
  };

  const handleQuickQuantityChange = (tempId, delta) => {
    setItemsList((prev) =>
      prev.map((item) => {
        if (item.temp_id === tempId && item.type === "producto") {
          const allowsDecimals =
            item.permite_decimales ??
            catalogs.productos?.find((cp) => cp.producto_id === item.producto_id)?.permite_decimales ??
            false;
          const currentQty = Number(item.cantidad) || 1;
          const step = allowsDecimals ? (Number.isInteger(currentQty) ? 1 : 0.5) : 1;
          const rawNew = currentQty + delta * step;
          const minQty = allowsDecimals ? 0.01 : 1;
          const finalQty = Math.max(minQty, allowsDecimals ? Math.round(rawNew * 100) / 100 : Math.round(rawNew));
          const pu = Number(item.precio_unitario || 0);

          if (editingProductTempId === tempId) {
            setEditingProductQuantity(String(finalQty));
            setEditingProductError("");
          }

          return {
            ...item,
            cantidad: finalQty,
            subtotal: Math.round(finalQty * pu * 100) / 100
          };
        }
        return item;
      })
    );
  };

  // Real-time calculated total reflecting ongoing edits safely
  const totalCalculado = useMemo(() => {
    return itemsList.reduce((acc, it) => {
      let subtotal = Number(it.subtotal) || 0;
      if (it.type === "producto" && editingProductTempId === it.temp_id) {
        const rawVal = String(editingProductQuantity).trim();
        const parsed = Number(rawVal);
        const allowsDecimals =
          it.permite_decimales ??
          catalogs.productos?.find((cp) => cp.producto_id === it.producto_id)?.permite_decimales ??
          false;
        const isValid = !isNaN(parsed) && parsed > 0 && (allowsDecimals || Number.isInteger(parsed));
        if (isValid) {
          const pu = Number(it.precio_unitario) || 0;
          subtotal = Math.round(parsed * pu * 100) / 100;
        }
      }
      return acc + subtotal;
    }, 0);
  }, [itemsList, editingProductTempId, editingProductQuantity, catalogs.productos]);

  // Submit full update to backend in atomic transaction
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;

    setError("");

    if (!selectedClient) {
      setError("Debe seleccionar un cliente válido.");
      return;
    }
    if (!selectedBike) {
      setError("Debe seleccionar una bicicleta válida para el cliente.");
      return;
    }

    // Canonical local resolution of pending quantity edit before constructing payload
    const currentItems = applyPendingQuantityEdit(itemsList);
    setItemsList(currentItems);
    setEditingProductTempId(null);
    setEditingProductQuantity("");
    setEditingProductError("");

    setSubmitting(true);

    try {
      const serviciosPayload = currentItems
        .filter((it) => it.type === "servicio")
        .map((s) => ({
          orden_servicio_id: s.orden_servicio_id || undefined,
          tipo_servicio_id: s.tipo_servicio_id,
          precio_unitario: s.precio_unitario,
          cantidad: 1,
          observacion_tecnica: s.observacion_tecnica || ""
        }));

      const productosPayload = currentItems
        .filter((it) => it.type === "producto")
        .map((p) => ({
          orden_producto_id: p.orden_producto_id || undefined,
          producto_id: p.producto_id,
          almacen_id: p.almacen_id || undefined,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
          observacion: p.observacion || ""
        }));

      const payload = {
        recepcion_id: selectedReceptionId ? parseInt(selectedReceptionId, 10) : undefined,
        cliente_id: selectedClient ? parseInt(selectedClient.cliente_id || selectedClient.id, 10) : undefined,
        bicicleta_id: selectedBike ? parseInt(selectedBike.bicicleta_id || selectedBike.id, 10) : undefined,
        estado_orden_id: selectedEstadoId ? parseInt(selectedEstadoId, 10) : undefined,
        prioridad_id: selectedPrioridadId ? parseInt(selectedPrioridadId, 10) : undefined,
        mecanico_id: selectedMecanicoId ? parseInt(selectedMecanicoId, 10) : null,
        diagnostico_inicial: diagnostico,
        servicios: serviciosPayload,
        productos: productosPayload
      };

      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "No se pudieron guardar los cambios.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error al guardar cambios de la orden:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] font-sans text-slate-100 relative my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#2d3748] flex items-center justify-between bg-[#12151b] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#bfce7f]/15 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f]">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
                Editar Orden de Trabajo — <span className="text-[#bfce7f]">{orderCode}</span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Edición de recepción, cliente, bicicleta, parámetros operativos, servicios y repuestos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1c2129] rounded-xl transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loadingInit ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3 font-mono">
            <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
            <span className="text-xs">Cargando información operativa de la orden...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            {error && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-rose-200 block">Error al actualizar</span>
                  <span className="leading-relaxed">{error}</span>
                </div>
              </div>
            )}

            {/* SECCIÓN 1: RECEPCIÓN Y DATOS PRINCIPALES */}
            <div className="bg-[#12151b] border border-[#2d3748] rounded-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d3748]">
                <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#bfce7f]" />
                  1. RECEPCIÓN Y DATOS PRINCIPALES
                </h3>
              </div>

              {/* Fila 1: Recepción Asociada */}
              <div className="space-y-1.5 font-mono text-xs">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Recepción Asociada <span className="text-[#bfce7f]">*</span>
                </label>
                <select
                  value={selectedReceptionId}
                  onChange={handleReceptionChange}
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs focus:outline-none transition-colors cursor-pointer"
                >
                  {availableReceptions.map((rec) => (
                    <option key={rec.recepcion_id} value={String(rec.recepcion_id)}>
                      {rec.codigo_recepcion} — {rec.cliente_nombre || "Cliente"} —{" "}
                      {rec.bicicleta_resumen || "Bicicleta"}{" "}
                      {rec.fecha_recepcion
                        ? `(${new Date(rec.fecha_recepcion).toLocaleDateString("es-DO")})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fila 2: Cliente y Bicicleta Editables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Cliente Combobox */}
                <div ref={clientComboboxRef} className="relative space-y-1.5">
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cliente <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      placeholder="Buscar cliente por nombre o teléfono..."
                      className="w-full bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl py-2.5 pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    {selectedClient && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
                        <Check size={14} />
                      </span>
                    )}
                  </div>

                  {isClientDropdownOpen && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#161a21] border border-[#2d3748] rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar font-mono text-xs">
                      {filteredClients.map((cli, idx) => (
                        <div
                          key={cli.cliente_id || cli.id}
                          onClick={() => handleSelectClient(cli)}
                          className={`p-2.5 hover:bg-[#1f242d] cursor-pointer flex items-center justify-between border-b border-[#2d3748]/50 last:border-b-0 ${
                            idx === activeClientIndex ? "bg-[#1f242d]" : ""
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-100 block">
                              {cli.nombre_completo || `${cli.nombre || ""} ${cli.apellido || ""}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Tel: {cli.telefono_principal || cli.telefono || "N/A"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bicicleta Select */}
                <div className="space-y-1.5 font-mono text-xs">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Bicicleta <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBike ? String(selectedBike.bicicleta_id || selectedBike.id) : ""}
                      onChange={(e) => {
                        const bikeId = e.target.value;
                        const bikeObj = clientBicycles.find(
                          (b) => String(b.bicicleta_id || b.id) === String(bikeId)
                        );
                        setSelectedBike(bikeObj || null);
                      }}
                      disabled={loadingBikes || clientBicycles.length === 0}
                      className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingBikes ? (
                        <option value="">Cargando bicicletas del cliente...</option>
                      ) : clientBicycles.length === 0 ? (
                        <option value="">Este cliente no tiene bicicletas registradas</option>
                      ) : (
                        <>
                          <option value="">-- Seleccionar Bicicleta --</option>
                          {clientBicycles.map((b) => (
                            <option
                              key={b.bicicleta_id || b.id}
                              value={String(b.bicicleta_id || b.id)}
                            >
                              {b.marca} {b.modelo} {b.color ? `• ${b.color}` : ""}{" "}
                              {b.numero_serie_cuadro ? `(SN: ${b.numero_serie_cuadro})` : ""}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Informative notice if client or bike differs from reception */}
              {isDataDivergentFromReception && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-300 text-xs flex items-start gap-2 font-sans animate-in fade-in duration-200">
                  <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                  <p className="leading-relaxed">
                    Los datos de cliente o bicicleta de esta orden difieren de la recepción asociada.
                  </p>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: PARÁMETROS OPERATIVOS */}
            <div className="bg-[#12151b] border border-[#2d3748] rounded-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d3748]">
                <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#bfce7f]" />
                  2. PARÁMETROS OPERATIVOS
                </h3>
              </div>

              {/* Fila Principal: Estado | Prioridad | Mecánico Asignado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                {/* Estado */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Estado
                  </label>
                  <select
                    value={selectedEstadoId}
                    onChange={(e) => setSelectedEstadoId(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs focus:outline-none cursor-pointer"
                  >
                    {catalogs.estados?.map((est) => (
                      <option key={est.estado_orden_id} value={String(est.estado_orden_id)}>
                        {est.codigo} — {est.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prioridad */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Prioridad
                  </label>
                  <select
                    value={selectedPrioridadId}
                    onChange={(e) => setSelectedPrioridadId(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs focus:outline-none cursor-pointer"
                  >
                    {catalogs.prioridades?.map((p) => (
                      <option
                        key={p.prioridad_id || p.prioridad_orden_trabajo_id}
                        value={String(p.prioridad_id || p.prioridad_orden_trabajo_id)}
                      >
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mecánico */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Mecánico Asignado
                  </label>
                  <select
                    value={selectedMecanicoId}
                    onChange={(e) => setSelectedMecanicoId(e.target.value)}
                    className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="">Por asignar</option>
                    {catalogs.mecanicos?.map((m) => (
                      <option key={m.usuario_id} value={String(m.usuario_id)}>
                        {m.nombre_completo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Debajo: Diagnóstico Inicial */}
              <div className="space-y-1.5 font-mono text-xs">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Diagnóstico Inicial
                </label>
                <textarea
                  rows={2}
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  placeholder="Descripción técnica o diagnóstico de la bicicleta..."
                  className="w-full p-2.5 bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl text-slate-200 text-xs resize-none font-sans focus:outline-none"
                />
              </div>
            </div>

            {/* SECCIÓN 3: SERVICIOS Y PRODUCTOS (BUSCADORES Y TABLA UNIFICADA) */}
            <div className="bg-[#12151b] border border-[#2d3748] rounded-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d3748]">
                <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#bfce7f]" />
                  3. SERVICIOS Y PRODUCTOS A UTILIZAR
                </h3>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {itemsList.length} Item(s) en la Orden
                </span>
              </div>

              {/* Buscadores Lado a Lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search Service */}
                <div ref={serviceComboboxRef} className="relative space-y-1.5">
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Buscar Servicio (Agregar a la orden)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => {
                        setServiceSearch(e.target.value);
                        setIsServiceDropdownOpen(true);
                      }}
                      onFocus={() => setIsServiceDropdownOpen(true)}
                      placeholder="Escribe el nombre del servicio..."
                      className="w-full bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl py-2.5 pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    {serviceSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setServiceSearch("");
                          setIsServiceDropdownOpen(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {isServiceDropdownOpen && filteredServices.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#161a21] border border-[#2d3748] rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar font-mono text-xs">
                      {filteredServices.map((svc, idx) => (
                        <div
                          key={svc.tipo_servicio_id}
                          onClick={() => handleSelectService(svc)}
                          className={`p-2.5 hover:bg-[#1f242d] cursor-pointer flex items-center justify-between border-b border-[#2d3748]/50 last:border-b-0 ${
                            idx === activeServiceIndex ? "bg-[#1f242d]" : ""
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-100 block">{svc.nombre}</span>
                            <span className="text-[10px] text-slate-400">{svc.codigo}</span>
                          </div>
                          <span className="font-bold text-[#bfce7f]">
                            RD${" "}
                            {Number(svc.precio_base || 0).toLocaleString("es-DO", {
                              minimumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Product */}
                <div ref={productComboboxRef} className="relative space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                      Buscar Producto / Repuesto
                    </label>
                    {catalogs.almacenes && catalogs.almacenes.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                          Almacén:
                        </label>
                        <select
                          value={selectedAlmacenId}
                          onChange={(e) => setSelectedAlmacenId(e.target.value)}
                          className="px-2 py-0.5 bg-[#0a0c10] border border-[#2d3748] rounded-lg text-[11px] text-slate-200 font-mono focus:outline-none focus:border-[#bfce7f] cursor-pointer"
                        >
                          {catalogs.almacenes.map((alm) => (
                            <option key={alm.almacen_id} value={alm.almacen_id}>
                              {alm.codigo} — {alm.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      placeholder="Escribe el nombre o código del producto..."
                      className="w-full bg-[#0a0c10] border border-[#2d3748] focus:border-[#bfce7f] rounded-xl py-2.5 pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearch("");
                          setIsProductDropdownOpen(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {isProductDropdownOpen && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#161a21] border border-[#2d3748] rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar font-mono text-xs">
                      {filteredProducts.map((prod, idx) => (
                        <div
                          key={prod.producto_id}
                          onClick={() => handleSelectProduct(prod)}
                          className={`p-2.5 hover:bg-[#1f242d] cursor-pointer flex items-center justify-between border-b border-[#2d3748]/50 last:border-b-0 ${
                            idx === activeProductIndex ? "bg-[#1f242d]" : ""
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-100 block">{prod.nombre}</span>
                            <span className="text-[10px] text-slate-400">{prod.codigo}</span>
                          </div>
                          <span className="font-bold text-cyan-400">
                            RD${" "}
                            {Number(prod.precio_venta || 0).toLocaleString("es-DO", {
                              minimumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error on product quantity inline edit */}
              {editingProductError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono">
                  {editingProductError}
                </div>
              )}

              {/* Unified Items Table */}
              <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#161a21]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#2d3748] bg-[#0a0c10] text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 w-24 text-center">TIPO</th>
                        <th className="py-2.5 px-4">DESCRIPCIÓN</th>
                        <th className="py-2.5 px-3 text-center w-24">CANTIDAD</th>
                        <th className="py-2.5 px-4 text-right w-32">PRECIO UNITARIO</th>
                        <th className="py-2.5 px-4 text-right w-32">SUBTOTAL</th>
                        <th className="py-2.5 px-3 text-center w-24">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3748]">
                      {itemsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                            No hay servicios ni productos agregados a esta orden de trabajo.
                          </td>
                        </tr>
                      ) : (
                        itemsList.map((item, index) => {
                          const isProduct = item.type === "producto";
                          const isEditingThis = editingProductTempId === item.temp_id;
                          const allowsDecimals =
                            item.permite_decimales ??
                            catalogs.productos?.find((cp) => cp.producto_id === item.producto_id)?.permite_decimales ??
                            false;

                          let rowSubtotal = Number(item.subtotal || 0);

                          if (isProduct && isEditingThis) {
                            const rawVal = String(editingProductQuantity).trim();
                            const parsed = Number(rawVal);
                            const isValid = !isNaN(parsed) && parsed > 0 && (allowsDecimals || Number.isInteger(parsed));
                            if (isValid) {
                              rowSubtotal = Math.round(parsed * Number(item.precio_unitario || 0) * 100) / 100;
                            }
                          }

                          return (
                            <tr key={item.temp_id} className="hover:bg-[#1f242d]/50 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                                {index + 1}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                    isProduct
                                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                      : "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/30"
                                  }`}
                                >
                                  {isProduct ? "PRODUCTO" : "SERVICIO"}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-100 font-sans">
                                <span className="font-semibold block">{item.nombre}</span>
                                {isProduct && (item.almacen_nombre || item.almacen_id) && (
                                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] px-1.5 py-0.2 bg-[#1f242d] border border-[#2d3748] rounded text-[#bfce7f] font-bold">
                                      {item.almacen_codigo || "ALM"}: {item.almacen_nombre || `Almacén #${item.almacen_id}`}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isProduct ? (
                                  isEditingThis ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        ref={editingQuantityInputRef}
                                        type="number"
                                        min={allowsDecimals ? "0.01" : "1"}
                                        step={allowsDecimals ? "0.01" : "1"}
                                        value={editingProductQuantity}
                                        onChange={(e) => {
                                          setEditingProductQuantity(e.target.value);
                                          setEditingProductError("");
                                        }}
                                        onBlur={() => handleSaveQuantity(item.temp_id)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSaveQuantity(item.temp_id);
                                          } else if (e.key === "Escape") {
                                            handleCancelEditQuantity();
                                          }
                                        }}
                                        className="w-14 bg-[#0a0c10] border border-[#bfce7f] rounded px-1 py-0.5 text-center text-xs font-bold text-slate-100 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSaveQuantity(item.temp_id)}
                                        className="p-1 bg-[#bfce7f] text-slate-950 rounded hover:brightness-110 cursor-pointer"
                                        title="Confirmar cantidad"
                                      >
                                        <Check size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={handleCancelEditQuantity}
                                        className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                                        title="Cancelar edición"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleQuickQuantityChange(item.temp_id, -1)}
                                        disabled={item.cantidad <= (allowsDecimals ? 0.01 : 1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-[#1f242d] hover:bg-[#2d3748] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer"
                                        title="Disminuir cantidad"
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditQuantity(item)}
                                        className="px-1.5 py-0.5 hover:bg-[#1f242d] rounded cursor-pointer font-bold text-slate-200 hover:text-[#bfce7f] transition-colors"
                                        title="Click para editar cantidad"
                                      >
                                        {item.cantidad}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickQuantityChange(item.temp_id, 1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-[#1f242d] hover:bg-[#2d3748] text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                                        title="Aumentar cantidad"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <span className="font-bold">{item.cantidad}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-300">
                                RD${" "}
                                {Number(item.precio_unitario || 0).toLocaleString("es-DO", {
                                  minimumFractionDigits: 2
                                })}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                                RD${" "}
                                {rowSubtotal.toLocaleString("es-DO", {
                                  minimumFractionDigits: 2
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isProduct && !isEditingThis && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditQuantity(item)}
                                      className="p-1.5 text-slate-400 hover:text-[#bfce7f] hover:bg-[#0a0c10] rounded-lg transition-colors cursor-pointer"
                                      title="Editar cantidad"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleRemoveItem(item.temp_id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#0a0c10] rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar de la orden"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total Footer */}
                <div className="p-4 border-t border-[#2d3748] bg-[#12151b] flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">
                    TOTAL ESTIMADO DE LA ORDEN:
                  </span>
                  <span className="text-base font-extrabold text-[#bfce7f]">
                    RD${" "}
                    {totalCalculado.toLocaleString("es-DO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2d3748] bg-[#12151b] -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 bg-[#1c2129] border border-[#2d3748] text-slate-300 rounded-xl hover:bg-[#252b36] transition-colors font-mono text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#84924a] text-white font-bold rounded-xl hover:brightness-110 transition-all font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-t border-[#a6b66b] shadow-lg shadow-[#84924a]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
