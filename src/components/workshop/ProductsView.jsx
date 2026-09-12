"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  RefreshCw,
  Info,
  ArrowUpDown,
  AlertCircle,
  AlertTriangle,
  Check,
  Ban,
  Filter,
  Power,
  EyeOff,
  DollarSign,
  Tag,
  Boxes,
  Barcode,
  Layers,
  Archive,
  QrCode,
  Truck,
  Star,
  Building2,
  Phone,
  Mail,
  Calendar
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import ProductCreateModal from "@/components/products/ProductCreateModal";

export default function ProductsView() {
  const [data, setData] = useState([]);
  const [lookups, setLookups] = useState({
    tipos: [],
    categorias: [],
    marcas: [],
    unidades: [],
    proveedores: []
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // RBAC permissions from server response headers
  const [permissions, setPermissions] = useState({
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_eliminar: true,
    puede_exportar: true
  });

  // Drawer / Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    codigo_producto: "",
    codigo_barra: "",
    nombre: "",
    proveedor_id: "",
    descripcion: "",
    tipo_producto_id: "",
    categoria_producto_id: "",
    marca_producto_id: "",
    unidad_medida_id: "",
    imagen_url: "",
    costo_actual: 0,
    precio_venta: 0,
    stock_minimo: 0,
    stock_maximo: "",
    requiere_serial: false,
    activo: true
  });

  const [errors, setErrors] = useState({});
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Tab Proveedores del Producto (admin.producto_proveedor)
  const [productDrawerTab, setProductDrawerTab] = useState("general"); // "general" | "proveedores"
  const [productSuppliers, setProductSuppliers] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [editingSupplierRelation, setEditingSupplierRelation] = useState(null);
  const [supplierRelForm, setSupplierRelForm] = useState({
    proveedor_id: "",
    costo_compra: "",
    moneda: "DOP",
    codigo_producto_proveedor: "",
    tiempo_entrega_dias: "3",
    proveedor_principal: false,
    observacion: ""
  });
  const [supplierRelErrors, setSupplierRelErrors] = useState({});
  const [isSavingSupplierRel, setIsSavingSupplierRel] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/taller/productos");
      if (res.ok) {
        const permVer = res.headers.get("x-perm-ver") !== "false";
        const permCrear = res.headers.get("x-perm-crear") === "true";
        const permEditar = res.headers.get("x-perm-editar") === "true";
        const permEliminar = res.headers.get("x-perm-eliminar") === "true";
        const permExportar = res.headers.get("x-perm-exportar") === "true";

        setPermissions({
          puede_ver: permVer,
          puede_crear: permCrear,
          puede_editar: permEditar,
          puede_eliminar: permEliminar,
          puede_exportar: permExportar
        });

        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setData(result.data);
          if (result.lookups) {
            setLookups(result.lookups);
          }
        } else if (Array.isArray(result)) {
          setData(result);
        } else {
          setData([]);
        }
      } else {
        showToast("Error al cargar el catálogo de productos.", "error");
      }
    } catch (err) {
      console.error("Error fetching productos:", err);
      showToast("Error de conexión al cargar productos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return String(dateStr).substring(0, 10);
    }
  };

  const validateForm = () => {
    const errs = {};

    const codigoRes = validateRequiredText(formData.codigo_producto, "El Código del Producto", 50);
    if (!codigoRes.isValid) {
      errs.codigo_producto = codigoRes.message;
    }

    if (formData.codigo_barra && formData.codigo_barra.length > 100) {
      errs.codigo_barra = "El Código de Barra no puede exceder 100 caracteres.";
    }

    const nameRes = validateRequiredText(formData.nombre, "El Nombre del Producto", 200);
    if (!nameRes.isValid) {
      errs.nombre = nameRes.message;
    }

    if (!formData.tipo_producto_id) {
      errs.tipo_producto_id = "Debe seleccionar un Tipo de Producto.";
    }

    if (!formData.categoria_producto_id) {
      errs.categoria_producto_id = "Debe seleccionar una Categoría de Producto.";
    }

    if (!formData.unidad_medida_id) {
      errs.unidad_medida_id = "Debe seleccionar una Unidad de Medida.";
    }

    if (
      formData.costo_actual === "" ||
      formData.costo_actual === null ||
      isNaN(Number(formData.costo_actual)) ||
      Number(formData.costo_actual) < 0
    ) {
      errs.costo_actual = "El Costo Actual debe ser mayor o igual a 0.";
    }

    if (
      formData.precio_venta === "" ||
      formData.precio_venta === null ||
      isNaN(Number(formData.precio_venta)) ||
      Number(formData.precio_venta) < 0
    ) {
      errs.precio_venta = "El Precio de Venta debe ser mayor o igual a 0.";
    }

    if (
      formData.stock_minimo === "" ||
      formData.stock_minimo === null ||
      isNaN(Number(formData.stock_minimo)) ||
      Number(formData.stock_minimo) < 0
    ) {
      errs.stock_minimo = "El Stock Mínimo debe ser mayor o igual a 0.";
    }

    if (
      formData.stock_maximo !== "" &&
      formData.stock_maximo !== null &&
      (isNaN(Number(formData.stock_maximo)) || Number(formData.stock_maximo) < Number(formData.stock_minimo))
    ) {
      errs.stock_maximo = "El Stock Máximo no puede ser menor al Stock Mínimo.";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast("Por favor complete los campos obligatorios del producto.", "warning");
    }
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = (item = null) => {
    if (!item) {
      setIsCreateModalOpen(true);
      return;
    }
    setEditingItem(item);
    setProductDrawerTab("general");
    setFormData({
      codigo_producto: item.codigo_producto || "",
      codigo_barra: item.codigo_barra || "",
      nombre: item.nombre || "",
      proveedor_id: item.proveedor_principal_id ? String(item.proveedor_principal_id) : "",
      descripcion: item.descripcion || "",
      tipo_producto_id: item.tipo_producto_id ? String(item.tipo_producto_id) : "",
      categoria_producto_id: item.categoria_producto_id ? String(item.categoria_producto_id) : "",
      marca_producto_id: item.marca_producto_id ? String(item.marca_producto_id) : "",
      unidad_medida_id: item.unidad_medida_id ? String(item.unidad_medida_id) : "",
      imagen_url: item.imagen_url || "",
      costo_actual: item.costo_actual !== undefined ? item.costo_actual : 0,
      precio_venta: item.precio_venta !== undefined ? item.precio_venta : 0,
      stock_minimo: item.stock_minimo !== undefined ? item.stock_minimo : 0,
      stock_maximo: item.stock_maximo !== null && item.stock_maximo !== undefined ? item.stock_maximo : "",
      requiere_serial: Boolean(item.requiere_serial),
      activo: item.activo !== false
    });
    loadProductSuppliers(item.id);
    setErrors({});
    setIsDrawerOpen(true);
  };

  const loadProductSuppliers = async (productId) => {
    setLoadingSuppliers(true);
    try {
      const res = await fetch(`/api/inventario/productos/${productId}/proveedores`);
      if (res.ok) {
        const json = await res.json();
        const provList = json.proveedores || [];
        setProductSuppliers(provList);
        setAvailableSuppliers(json.catalogo_proveedores || []);
        const primary = provList.find((p) => p.proveedor_principal);
        if (primary) {
          setFormData((prev) => ({ ...prev, proveedor_id: String(primary.proveedor_id) }));
        }
      }
    } catch (err) {
      console.error("Error loading product suppliers:", err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleOpenAddSupplierModal = (relation = null) => {
    if (relation) {
      setEditingSupplierRelation(relation);
      setSupplierRelForm({
        proveedor_id: String(relation.proveedor_id),
        costo_compra: String(relation.costo_compra || 0),
        moneda: relation.moneda || "DOP",
        codigo_producto_proveedor: relation.codigo_producto_proveedor || "",
        tiempo_entrega_dias: relation.tiempo_entrega_dias !== null ? String(relation.tiempo_entrega_dias) : "",
        proveedor_principal: Boolean(relation.proveedor_principal),
        observacion: relation.observacion || ""
      });
    } else {
      setEditingSupplierRelation(null);
      setSupplierRelForm({
        proveedor_id: availableSuppliers.length > 0 ? String(availableSuppliers[0].proveedor_id) : "",
        costo_compra: String(formData.costo_actual || 0),
        moneda: "DOP",
        codigo_producto_proveedor: "",
        tiempo_entrega_dias: "3",
        proveedor_principal: false,
        observacion: ""
      });
    }
    setSupplierRelErrors({});
    setIsAddSupplierModalOpen(true);
  };

  const handleSaveSupplierRelation = async (e) => {
    if (e) e.preventDefault();
    const errs = {};

    if (!supplierRelForm.proveedor_id) {
      errs.proveedor_id = "Debe seleccionar un proveedor.";
    }
    if (
      supplierRelForm.costo_compra === "" ||
      isNaN(Number(supplierRelForm.costo_compra)) ||
      Number(supplierRelForm.costo_compra) < 0
    ) {
      errs.costo_compra = "El costo de compra debe ser mayor o igual a 0.";
    }

    setSupplierRelErrors(errs);
    if (Object.keys(errs).length > 0 || isSavingSupplierRel) return;

    setIsSavingSupplierRel(true);
    try {
      if (editingSupplierRelation) {
        const res = await fetch(`/api/inventario/producto-proveedor/${editingSupplierRelation.producto_proveedor_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            costo_compra: Number(supplierRelForm.costo_compra),
            moneda: supplierRelForm.moneda,
            codigo_producto_proveedor: supplierRelForm.codigo_producto_proveedor,
            tiempo_entrega_dias: supplierRelForm.tiempo_entrega_dias !== "" ? Number(supplierRelForm.tiempo_entrega_dias) : null,
            proveedor_principal: supplierRelForm.proveedor_principal,
            observacion: supplierRelForm.observacion
          })
        });
        const json = await res.json();
        if (!res.ok) {
          showToast(json.message || "Error al actualizar condiciones con proveedor.", "error");
          return;
        }
        showToast("Condiciones comerciales actualizadas exitosamente.");
      } else {
        const res = await fetch(`/api/inventario/productos/${editingItem.id}/proveedores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proveedor_id: Number(supplierRelForm.proveedor_id),
            costo_compra: Number(supplierRelForm.costo_compra),
            moneda: supplierRelForm.moneda,
            codigo_producto_proveedor: supplierRelForm.codigo_producto_proveedor,
            tiempo_entrega_dias: supplierRelForm.tiempo_entrega_dias !== "" ? Number(supplierRelForm.tiempo_entrega_dias) : null,
            proveedor_principal: supplierRelForm.proveedor_principal,
            observacion: supplierRelForm.observacion
          })
        });
        const json = await res.json();
        if (!res.ok) {
          showToast(json.message || "Error al asociar proveedor al producto.", "error");
          return;
        }
        showToast("Proveedor asociado exitosamente.");
      }

      setIsAddSupplierModalOpen(false);
      loadProductSuppliers(editingItem.id);
    } catch (err) {
      console.error("Error saving supplier relation:", err);
      showToast("Error de conexión al guardar relación con proveedor.", "error");
    } finally {
      setIsSavingSupplierRel(false);
    }
  };

  const handleInactivateSupplierRelation = async (rel) => {
    try {
      const res = await fetch(`/api/inventario/producto-proveedor/${rel.producto_proveedor_id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Relación comercial con proveedor inactivada exitosamente.");
        loadProductSuppliers(editingItem.id);
      } else {
        const json = await res.json();
        showToast(json.message || "Error al inactivar relación.", "error");
      }
    } catch (err) {
      console.error("Error inactivating supplier relation:", err);
      showToast("Error de conexión al inactivar relación.", "error");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm() || isSaving) return;

    setIsSaving(true);
    try {
      const url = editingItem
        ? `/api/taller/productos/${editingItem.id}`
        : "/api/taller/productos";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_producto: formData.codigo_producto.trim().toUpperCase(),
          codigo_barra: formData.codigo_barra.trim() || null,
          nombre: formData.nombre.trim(),
          proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id, 10) : null,
          descripcion: formData.descripcion.trim() || null,
          tipo_producto_id: parseInt(formData.tipo_producto_id, 10),
          categoria_producto_id: parseInt(formData.categoria_producto_id, 10),
          marca_producto_id: formData.marca_producto_id ? parseInt(formData.marca_producto_id, 10) : null,
          unidad_medida_id: parseInt(formData.unidad_medida_id, 10),
          imagen_url: formData.imagen_url.trim() || null,
          costo_actual: parseFloat(formData.costo_actual) || 0,
          precio_venta: parseFloat(formData.precio_venta) || 0,
          stock_minimo: parseFloat(formData.stock_minimo) || 0,
          stock_maximo: formData.stock_maximo !== "" ? parseFloat(formData.stock_maximo) : null,
          requiere_serial: Boolean(formData.requiere_serial),
          activo: Boolean(formData.activo),
          estado: formData.activo ? "ACTIVO" : "INACTIVO"
        })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || "No se pudo guardar el producto.");
      }

      showToast(
        editingItem
          ? "Producto actualizado correctamente en el catálogo."
          : "Producto creado exitosamente en el catálogo."
      );
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      setErrors(prev => ({ ...prev, general: err.message }));
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item) => {
    if (isTogglingStatus) return;
    setIsTogglingStatus(true);
    try {
      const nextStatus = item.activo === false;
      const res = await fetch(`/api/taller/productos/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activo: nextStatus,
          estado: nextStatus ? "ACTIVO" : "INACTIVO"
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Error al cambiar estado.");

      showToast(
        nextStatus
          ? `Producto "${item.nombre}" reactivado con éxito.`
          : `Producto "${item.nombre}" desactivado.`
      );
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleOpenDeleteModal = async (item) => {
    setItemToDelete(item);
    setLoadingDependencies(true);
    setDeleteDependencies(null);
    setIsDeletingModalOpen(true);

    try {
      const res = await fetch(`/api/taller/productos/${item.id}?check_dependencies=true`);
      if (res.ok) {
        const json = await res.json();
        setDeleteDependencies(json.data);
      } else {
        setDeleteDependencies({ can_delete: false, referencias: [], total_dependencies: 0 });
      }
    } catch (err) {
      console.error("Error checking dependencies:", err);
      setDeleteDependencies({ can_delete: false, referencias: [], total_dependencies: 0 });
    } finally {
      setLoadingDependencies(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/taller/productos/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();

      setIsDeletingModalOpen(false);

      if (!res.ok || json.success === false) {
        showToast(json.message || json.error || "Error al eliminar el producto.", "error");
        return;
      }

      showToast("Producto eliminado correctamente del catálogo.");
      setItemToDelete(null);
      setDeleteDependencies(null);
      fetchData();
    } catch (err) {
      setIsDeletingModalOpen(false);
      showToast(err.message || "Error de conexión al eliminar.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & Sort Logic
  const filteredData = data.filter((item) => {
    const queryStr = search.toLowerCase();
    const matchesSearch =
      (item.codigo_producto || "").toLowerCase().includes(queryStr) ||
      (item.codigo_barra || "").toLowerCase().includes(queryStr) ||
      (item.nombre || "").toLowerCase().includes(queryStr) ||
      (item.descripcion || "").toLowerCase().includes(queryStr) ||
      (item.marca_producto_nombre || "").toLowerCase().includes(queryStr) ||
      (item.categoria_producto_nombre || "").toLowerCase().includes(queryStr) ||
      (item.tipo_producto_nombre || "").toLowerCase().includes(queryStr) ||
      (item.proveedor_principal_nombre || "").toLowerCase().includes(queryStr);

    const matchesCategory =
      categoryFilter === "TODAS" ||
      String(item.categoria_producto_id) === String(categoryFilter);

    const matchesType =
      typeFilter === "TODOS" ||
      String(item.tipo_producto_id) === String(typeFilter);

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "ACTIVO" && item.activo !== false) ||
      (statusFilter === "INACTIVO" && item.activo === false);

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn] ?? "";
    let bVal = b[sortColumn] ?? "";

    if (
      sortColumn === "id" ||
      sortColumn === "precio_venta" ||
      sortColumn === "costo_actual" ||
      sortColumn === "stock_actual" ||
      sortColumn === "stock_minimo"
    ) {
      return sortDirection === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    }

    if (sortColumn === "fecha_registro") {
      const aTime = aVal ? new Date(aVal).getTime() : 0;
      const bTime = bVal ? new Date(bVal).getTime() : 0;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    }

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = sortedData.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Real KPIs (Factual Metrics)
  const totalProducts = data.length;
  const activeProducts = data.filter((p) => p.activo !== false).length;
  const deactivatedProducts = data.filter((p) => p.activo === false).length;
  const criticalStockProducts = data.filter(
    (p) => (p.activo !== false) && Number(p.stock_actual || 0) <= Number(p.stock_minimo || 0)
  ).length;

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">

      {/* Toast Notification (Premium Floating Design) */}
      {mounted && toastMessage && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", top: "24px", right: "24px", zIndex: 99999999 }}
          className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 font-sans text-xs animate-in slide-in-from-top-3 duration-300 max-w-md bg-card/95 backdrop-blur-xl ${
            toastMessage.type === "error"
              ? "border-rose-500/40 text-foreground shadow-rose-500/10"
              : toastMessage.type === "warning"
              ? "border-amber-500/40 text-foreground shadow-amber-500/10"
              : "border-emerald-500/40 text-foreground shadow-emerald-500/10"
          }`}
        >
          <div className={`p-2 rounded-xl shrink-0 ${
            toastMessage.type === "error"
              ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
              : toastMessage.type === "warning"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          }`}>
            {toastMessage.type === "error" ? (
              <XCircle size={18} />
            ) : toastMessage.type === "warning" ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <p className="font-semibold text-foreground text-xs leading-snug">
              {toastMessage.text}
            </p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>,
        document.body
      )}

      {/* Header Bar */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-primary mb-1">
            <span>TALLER</span>
            <span>/</span>
            <span className="text-foreground font-bold">Catálogo Maestro</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Package className="text-primary" size={28} />
            <span>Catálogo de Productos</span>
          </h1>
          <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
            Maestro central de repuestos, lubricantes, consumibles y componentes de taller.
          </p>
        </div>

        {permissions.puede_crear && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:opacity-90 text-primary-foreground font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} />
            <span>Nuevo Producto</span>
          </button>
        )}
      </div>

      {/* Real KPI Cards (4 Factual Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Boxes size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Total Productos
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {totalProducts}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Productos Activos
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {activeProducts}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <EyeOff size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Desactivados
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {deactivatedProducts}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            criticalStockProducts > 0
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Stock Crítico (Activos)
            </span>
            <span className={`font-mono text-2xl font-black ${criticalStockProducts > 0 ? "text-rose-400" : "text-foreground"}`}>
              {criticalStockProducts}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por código, código de barra, nombre, marca, proveedor..."
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-xl px-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="TODAS">Todas las Categorías</option>
            {lookups.categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-xl px-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="TODOS">Todos los Tipos</option>
            {lookups.tipos.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.nombre}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-xl px-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="Todos">Todos los estados</option>
            <option value="ACTIVO">Solo Activos</option>
            <option value="INACTIVO">Solo Inactivos</option>
          </select>

          <button
            onClick={fetchData}
            title="Refrescar catálogo"
            className="p-2.5 bg-background border border-border hover:border-primary/50 text-foreground-secondary hover:text-primary rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Table / Data View */}
      <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden font-mono text-xs">
        {loading ? (
          <div className="p-12 text-center text-foreground-muted flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-primary" size={28} />
            <p>Cargando catálogo de productos...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted space-y-3">
            <AlertCircle size={32} className="mx-auto text-foreground-muted opacity-50" />
            <p className="text-sm font-bold text-foreground">No hay productos registrados en el catálogo.</p>
            <p className="text-xs max-w-md mx-auto">
              {search || statusFilter !== "Todos" || categoryFilter !== "TODAS" || typeFilter !== "TODOS"
                ? "No se encontraron productos con los filtros seleccionados."
                : "Comienza registrando repuestos y productos maestros para el taller."}
            </p>
            {permissions.puede_crear && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow"
              >
                <Plus size={16} />
                <span>Crear Producto</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-[11px] text-foreground-muted uppercase tracking-wider">
                  <th
                    onClick={() => handleSort("codigo_producto")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Código / Barra</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("nombre")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Producto</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("categoria_producto_nombre")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Categoría / Tipo</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("proveedor_principal_nombre")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Proveedor</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("precio_venta")}
                    className="p-4 cursor-pointer hover:text-foreground select-none text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Precio Venta</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("fecha_registro")}
                    className="p-4 cursor-pointer hover:text-foreground select-none text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Fecha Creación</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("activo")}
                    className="p-4 cursor-pointer hover:text-foreground select-none text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Estado</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4 text-right select-none">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-hover/50 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-bold text-primary">{item.codigo_producto}</div>
                      {item.codigo_barra && (
                        <div className="text-[10px] text-foreground-muted flex items-center gap-1 mt-0.5">
                          <Barcode size={12} className="opacity-70" />
                          <span>{item.codigo_barra}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-foreground font-sans text-sm">
                        {item.nombre}
                      </div>
                      <div className="text-foreground-muted text-[11px] flex items-center gap-2 mt-0.5">
                        {item.marca_producto_nombre && (
                          <span className="text-foreground-secondary font-bold">
                            {item.marca_producto_nombre}
                          </span>
                        )}
                        <span>•</span>
                        <span>{item.unidad_medida_nombre}</span>
                        {item.requiere_serial && (
                          <span className="px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold">
                            SERIAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
                          {item.categoria_producto_nombre}
                        </span>
                        <span className="text-[10px] text-foreground-muted">
                          {item.tipo_producto_nombre}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {item.proveedor_principal_nombre ? (
                        <div className="flex items-center gap-1.5 text-foreground-secondary font-sans text-xs">
                          <Truck size={13} className="text-primary shrink-0" />
                          <span className="font-medium truncate max-w-[160px]" title={item.proveedor_principal_nombre}>
                            {item.proveedor_principal_nombre}
                          </span>
                        </div>
                      ) : (
                        <span className="text-foreground-muted italic text-[11px]">
                          Sin proveedor
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-emerald-400">
                        RD$ {Number(item.precio_venta).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-foreground-muted mt-0.5">
                        Costo: RD$ {Number(item.costo_actual).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="text-foreground-secondary font-mono text-[11px] flex items-center justify-center gap-1.5">
                        <Calendar size={12} className="text-foreground-muted shrink-0" />
                        <span>{formatDate(item.fecha_registro)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          item.activo !== false
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {item.activo !== false ? (
                          <>
                            <Check size={12} /> Activo
                          </>
                        ) : (
                          <>
                            <Ban size={12} /> Inactivo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {permissions.puede_editar && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              disabled={isTogglingStatus}
                              title={item.activo !== false ? "Desactivar producto" : "Activar producto"}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                item.activo !== false
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                            >
                              <Power size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer(item)}
                              title="Editar producto"
                              className="p-1.5 rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated transition-all cursor-pointer"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                        {permissions.puede_eliminar && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(item)}
                            title="Eliminar producto"
                            className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && sortedData.length > 0 && (
          <div className="p-4 bg-surface border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-foreground-muted">
            <span>
              Mostrando {paginatedData.length} de {sortedData.length} productos filtrados
            </span>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-1.5 text-foreground">
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DRAWER LATERAL: CREAR / EDITAR PRODUCTO                                    */}
      {/* ========================================================================= */}
      {mounted && isDrawerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => !isSaving && setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col font-sans">

              {/* Drawer Header */}
              <div className="p-6 border-b border-border bg-surface-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                      <Package size={20} />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-foreground">
                        Editar Producto
                      </h2>
                      <p className="font-mono text-xs text-foreground-muted">
                        {editingItem ? `ID: ${editingItem.id} • SKU: ${editingItem.codigo_producto}` : "Edición integral de producto"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    disabled={isSaving}
                    className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-hover transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs when editing product */}
                {editingItem && (
                  <div className="flex items-center gap-2 border-b border-border -mb-6 pt-1">
                    <button
                      type="button"
                      onClick={() => setProductDrawerTab("general")}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        productDrawerTab === "general"
                          ? "border-primary text-primary"
                          : "border-transparent text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      DATOS GENERALES
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductDrawerTab("proveedores")}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                        productDrawerTab === "proveedores"
                          ? "border-primary text-primary"
                          : "border-transparent text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      <Truck size={14} />
                      <span>PROVEEDORES</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface border border-border text-foreground-secondary">
                        {productSuppliers.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer Body: General or Proveedores */}
              {productDrawerTab === "general" ? (
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 font-mono text-xs custom-scrollbar">

                {/* General Error Banner if save failed */}
                {errors.general && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="font-sans font-medium">{errors.general}</span>
                  </div>
                )}

                {/* Notice: Stock is managed via Inventory */}
                <div className="bg-surface border border-border rounded-xl p-3.5 flex items-start gap-3 text-[11px] text-foreground-secondary">
                  <Info size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Gestión de Catálogo Maestro</p>
                    <p className="text-foreground-muted mt-0.5">
                      Las existencias físicas y movimientos se gestionan en Almacenes e Inventario. Aquí se configuran los parámetros maestros, precios y límites.
                    </p>
                  </div>
                </div>

                {/* Section: Identificación */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider block border-b border-border/50 pb-1">
                    1. Identificación y Nombre
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Código / SKU <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.codigo_producto}
                        onChange={(e) => setFormData({ ...formData, codigo_producto: e.target.value.toUpperCase() })}
                        placeholder="Ej. REP-001, CAD-12V"
                        maxLength={50}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted uppercase focus:outline-none ${
                          errors.codigo_producto ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.codigo_producto && <p className="text-rose-400 text-[11px] mt-1">{errors.codigo_producto}</p>}
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Código de Barra / EAN
                      </label>
                      <input
                        type="text"
                        value={formData.codigo_barra}
                        onChange={(e) => setFormData({ ...formData, codigo_barra: e.target.value })}
                        placeholder="Ej. 742100889201"
                        maxLength={100}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none ${
                          errors.codigo_barra ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.codigo_barra && <p className="text-rose-400 text-[11px] mt-1">{errors.codigo_barra}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Nombre del Producto <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej. Cadena Shimano Deore 12 Velocidades"
                        maxLength={200}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none ${
                          errors.nombre ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.nombre && <p className="text-rose-400 text-[11px] mt-1">{errors.nombre}</p>}
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Proveedor
                      </label>
                      <select
                        value={formData.proveedor_id || ""}
                        onChange={(e) => setFormData({ ...formData, proveedor_id: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {((lookups.proveedores && lookups.proveedores.length > 0) ? lookups.proveedores : availableSuppliers).map((prov) => (
                          <option key={prov.proveedor_id} value={prov.proveedor_id}>
                            {prov.nombre_comercial} {prov.codigo_proveedor ? `(${prov.codigo_proveedor})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-foreground-secondary font-bold mb-1.5">
                      Descripción Técnica
                    </label>
                    <textarea
                      rows={2}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Especificaciones técnicas, compatibilidad y notas..."
                      className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>

                {/* Section: Clasificación */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider block border-b border-border/50 pb-1">
                    2. Clasificación y Taxonomía
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Tipo de Producto <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={formData.tipo_producto_id}
                        onChange={(e) => setFormData({ ...formData, tipo_producto_id: e.target.value })}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none cursor-pointer ${
                          errors.tipo_producto_id ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      >
                        <option value="">Seleccione tipo...</option>
                        {lookups.tipos.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            {tp.nombre}
                          </option>
                        ))}
                      </select>
                      {errors.tipo_producto_id && <p className="text-rose-400 text-[10px] mt-1">{errors.tipo_producto_id}</p>}
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Categoría <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={formData.categoria_producto_id}
                        onChange={(e) => setFormData({ ...formData, categoria_producto_id: e.target.value })}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none cursor-pointer ${
                          errors.categoria_producto_id ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      >
                        <option value="">Seleccione categoría...</option>
                        {lookups.categorias.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.nombre}
                          </option>
                        ))}
                      </select>
                      {errors.categoria_producto_id && <p className="text-rose-400 text-[10px] mt-1">{errors.categoria_producto_id}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Marca
                      </label>
                      <select
                        value={formData.marca_producto_id}
                        onChange={(e) => setFormData({ ...formData, marca_producto_id: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="">(Sin Marca / Genérico)</option>
                        {lookups.marcas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Unidad de Medida <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={formData.unidad_medida_id}
                        onChange={(e) => setFormData({ ...formData, unidad_medida_id: e.target.value })}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none cursor-pointer ${
                          errors.unidad_medida_id ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      >
                        <option value="">Seleccione unidad...</option>
                        {lookups.unidades.map((um) => (
                          <option key={um.id} value={um.id}>
                            {um.nombre} ({um.codigo})
                          </option>
                        ))}
                      </select>
                      {errors.unidad_medida_id && <p className="text-rose-400 text-[10px] mt-1">{errors.unidad_medida_id}</p>}
                    </div>
                  </div>
                </div>

                {/* Section: Precios y Parámetros de Stock */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider block border-b border-border/50 pb-1">
                    3. Precios y Parámetros Operativos
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Costo Actual (DOP)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-bold text-xs">RD$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.costo_actual}
                          onChange={(e) => setFormData({ ...formData, costo_actual: e.target.value })}
                          className={`w-full bg-background border rounded-xl pl-12 pr-3 py-2.5 text-foreground focus:outline-none ${
                            errors.costo_actual ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                          }`}
                        />
                      </div>
                      {errors.costo_actual && <p className="text-rose-400 text-[10px] mt-1">{errors.costo_actual}</p>}
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Precio Venta (DOP) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-bold text-xs">RD$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.precio_venta}
                          onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                          className={`w-full bg-background border rounded-xl pl-12 pr-3 py-2.5 text-foreground focus:outline-none ${
                            errors.precio_venta ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                          }`}
                        />
                      </div>
                      {errors.precio_venta && <p className="text-rose-400 text-[10px] mt-1">{errors.precio_venta}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Stock Mínimo (Alerta)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stock_minimo}
                        onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none ${
                          errors.stock_minimo ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.stock_minimo && <p className="text-rose-400 text-[10px] mt-1">{errors.stock_minimo}</p>}
                    </div>

                    <div>
                      <label className="block text-foreground-secondary font-bold mb-1.5">
                        Stock Máximo (Opcional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stock_maximo}
                        onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value })}
                        placeholder="Ilimitado"
                        className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none ${
                          errors.stock_maximo ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.stock_maximo && <p className="text-rose-400 text-[10px] mt-1">{errors.stock_maximo}</p>}
                    </div>
                  </div>
                </div>

                {/* Flags Checkboxes */}
                <div className="bg-surface border border-border rounded-xl p-3.5 space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiere_serial}
                      onChange={(e) => setFormData({ ...formData, requiere_serial: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-foreground font-bold block">Requiere Número de Serial</span>
                      <span className="text-foreground-muted text-[10px]">Exige número de serie individual por unidad en inventario</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer pt-1 border-t border-border/50">
                    <input
                      type="checkbox"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-foreground font-bold block">Producto Activo</span>
                      <span className="text-foreground-muted text-[10px]">Disponible en catálogo para presupuestos y órdenes de trabajo</span>
                    </div>
                  </label>
                </div>

                {/* Drawer Footer Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    disabled={isSaving}
                    className="px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-foreground-secondary hover:text-foreground font-bold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg flex items-center gap-2 cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
                  </button>
                </div>
              </form>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col font-sans">
                  {/* Toolbar */}
                  <div className="p-4 border-b border-border bg-surface/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Proveedores Asignados</h3>
                      <p className="text-[11px] text-foreground-muted">
                        Suplidores comerciales autorizados para este producto y sus costos de compra
                      </p>
                    </div>

                    {permissions.puede_crear && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddSupplierModal()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
                      >
                        <Plus size={14} />
                        <span>Asociar Proveedor</span>
                      </button>
                    )}
                  </div>

                  {/* Table of suppliers for this product */}
                  <div className="flex-1 p-4">
                    {loadingSuppliers ? (
                      <div className="p-8 text-center text-xs text-foreground-muted flex flex-col items-center gap-2">
                        <RefreshCw size={20} className="animate-spin text-primary" />
                        <span>Cargando proveedores del producto...</span>
                      </div>
                    ) : productSuppliers.length === 0 ? (
                      <div className="p-12 text-center text-foreground-muted flex flex-col items-center gap-2 border border-dashed border-border rounded-2xl">
                        <Truck size={28} className="opacity-30" />
                        <p className="text-xs font-semibold text-foreground">Este producto no tiene proveedores asociados.</p>
                        <p className="text-[11px]">Haga clic en &quot;+ Asociar Proveedor&quot; para registrar su suplidor comercial.</p>
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-surface text-foreground-muted font-medium">
                              <th className="p-3 pl-4">PROVEEDOR</th>
                              <th className="p-3 text-right">COSTO COMPRA</th>
                              <th className="p-3 text-center">ENTREGA</th>
                              <th className="p-3 text-center">PRINCIPAL</th>
                              <th className="p-3 text-center">ESTADO</th>
                              <th className="p-3 pr-4 text-right">ACCIONES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {productSuppliers.map((pr) => (
                              <tr key={pr.producto_proveedor_id} className="hover:bg-surface/50">
                                <td className="p-3 pl-4">
                                  <div>
                                    <p className="font-semibold text-foreground">{pr.nombre_comercial}</p>
                                    <p className="text-[10px] font-mono text-foreground-muted">
                                      {pr.codigo_proveedor}
                                      {pr.codigo_producto_proveedor ? ` • Ref: ${pr.codigo_producto_proveedor}` : ""}
                                    </p>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-foreground">
                                  {pr.moneda} {pr.costo_compra.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center text-foreground-secondary font-mono">
                                  {pr.tiempo_entrega_dias !== null ? `${pr.tiempo_entrega_dias}d` : "—"}
                                </td>
                                <td className="p-3 text-center">
                                  {pr.proveedor_principal ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                      <Star size={10} className="fill-amber-400" />
                                      <span>Principal</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-foreground-muted">Secundario</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      pr.estado === "ACTIVO"
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                    }`}
                                  >
                                    {pr.estado}
                                  </span>
                                </td>
                                <td className="p-3 pr-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddSupplierModal(pr)}
                                      title="Editar condiciones con proveedor"
                                      className="p-1 rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated cursor-pointer"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    {pr.estado === "ACTIVO" && (
                                      <button
                                        type="button"
                                        onClick={() => handleInactivateSupplierRelation(pr)}
                                        title="Inactivar relación con proveedor"
                                        className="p-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN                                      */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL ÚNICO: ELIMINACIÓN / AUDITORÍA DE DEPENDENCIAS DE PRODUCTO           */}
      {/* ========================================================================= */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          {/* Backdrop */}
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => {
              if (!isDeleting) {
                setIsDeletingModalOpen(false);
                setItemToDelete(null);
                setDeleteDependencies(null);
              }
            }}
          />

          <div className="relative bg-card border border-border rounded-3xl p-6 sm:p-7 w-full max-w-[540px] shadow-2xl z-10 font-sans space-y-5 animate-in zoom-in-95 duration-200">
            {loadingDependencies ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-primary mx-auto" />
                <p className="text-sm font-bold text-foreground">Verificando dependencias e integridad...</p>
                <p className="text-xs text-foreground-muted font-mono">
                  Auditando proveedores, existencias en almacén y órdenes de trabajo.
                </p>
              </div>
            ) : deleteDependencies && !deleteDependencies.can_delete ? (
              /* CASO 1: TIENE DEPENDENCIAS ASOCIADAS -> BLOQUEO CON VALIDACIONES RESUMIDAS */
              <>
                {/* Header */}
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400 shrink-0 shadow-inner">
                    <AlertTriangle size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                        Bloqueo por Integridad
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeletingModalOpen(false);
                          setItemToDelete(null);
                          setDeleteDependencies(null);
                        }}
                        className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground mt-1">
                      No se puede eliminar este producto
                    </h3>
                    <p className="text-xs text-foreground-muted">
                      El producto tiene vínculos activos en la operación del taller o almacén.
                    </p>
                  </div>
                </div>

                {/* Product Card */}
                <div className="bg-surface border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary shrink-0">
                      <Package size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">
                        {itemToDelete.nombre}
                      </p>
                      <p className="text-xs font-mono text-primary font-semibold">
                        Código: {itemToDelete.codigo_producto}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
                    itemToDelete.activo !== false
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}>
                    {itemToDelete.activo !== false ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {/* References Summary */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary block">
                    Registros asociados encontrados:
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {deleteDependencies.referencias && deleteDependencies.referencias.length > 0 ? (
                      deleteDependencies.referencias.map((ref, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-surface border border-border/80 rounded-xl flex items-start gap-3"
                        >
                          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 shrink-0 mt-0.5">
                            {ref.tipo === "proveedores" && <Truck size={14} />}
                            {ref.tipo === "ordenes" && <Layers size={14} />}
                            {ref.tipo === "movimientos" && <RefreshCw size={14} />}
                            {ref.tipo === "existencias" && <Boxes size={14} />}
                            {ref.tipo === "compras" && <Tag size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                {ref.label}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                                {ref.cantidad} {ref.cantidad === 1 ? "registro" : "registros"}
                              </span>
                            </div>
                            {ref.detalles && ref.detalles.length > 0 && (
                              <div className="text-[11px] text-foreground-muted mt-1 space-y-0.5">
                                {ref.detalles.map((det, dIdx) => (
                                  <p key={dIdx} className="truncate">• {det}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-surface border border-border rounded-xl text-xs text-foreground-muted">
                        El producto posee registros asociados en compras, almacenes, órdenes o proveedores.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendation Notice */}
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
                  <Info size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Para garantizar la integridad histórica y contable, no es posible borrarlo de forma definitiva. En su lugar, puedes <strong className="text-foreground">desactivarlo</strong> para retirarlo del catálogo visible.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeletingModalOpen(false);
                      setItemToDelete(null);
                      setDeleteDependencies(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-semibold text-foreground-secondary hover:text-foreground hover:bg-hover transition-all cursor-pointer"
                  >
                    Entendido / Cerrar
                  </button>
                  {itemToDelete.activo !== false && (
                    <button
                      type="button"
                      disabled={isTogglingStatus}
                      onClick={async () => {
                        const prod = itemToDelete;
                        setIsDeletingModalOpen(false);
                        setItemToDelete(null);
                        setDeleteDependencies(null);
                        await handleToggleStatus(prod);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Power size={14} />
                      <span>Desactivar Producto</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* CASO 2: NO TIENE DEPENDENCIAS -> CONFIRMACIÓN DE ELIMINACIÓN DIRECTA */
              <>
                {/* Header */}
                <div className="flex items-start gap-3.5 text-rose-400">
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl shrink-0">
                    <AlertCircle size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                        Sin dependencias
                      </span>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => {
                          setIsDeletingModalOpen(false);
                          setItemToDelete(null);
                          setDeleteDependencies(null);
                        }}
                        className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground mt-1">
                      ¿Confirmar Eliminación?
                    </h3>
                    <p className="text-xs text-foreground-muted">
                      Este producto no posee dependencias registradas y puede eliminarse.
                    </p>
                  </div>
                </div>

                {/* Product Card */}
                <div className="bg-surface border border-border rounded-2xl p-3.5 flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">
                      {itemToDelete.nombre}
                    </p>
                    <p className="text-xs font-mono text-primary font-semibold">
                      Código: {itemToDelete.codigo_producto}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-foreground-secondary leading-relaxed">
                  ¿Estás seguro de que deseas eliminar del catálogo el producto{" "}
                  <strong className="text-foreground">{itemToDelete.nombre}</strong>? Esta acción no se puede deshacer.
                </p>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setIsDeletingModalOpen(false);
                      setItemToDelete(null);
                      setDeleteDependencies(null);
                    }}
                    className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-semibold text-foreground-secondary hover:text-foreground hover:bg-hover transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                    <span>{isDeleting ? "Eliminando..." : "Eliminar Producto"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Asociar / Editar Proveedor desde Producto */}
      {mounted && isAddSupplierModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {editingSupplierRelation ? "Editar Condiciones con Proveedor" : "Asociar Proveedor al Producto"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierRelation} className="space-y-3.5 font-sans">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Proveedor <span className="text-rose-400">*</span>
                </label>
                {editingSupplierRelation ? (
                  <input
                    type="text"
                    disabled
                    value={editingSupplierRelation.nombre_comercial}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-xl text-foreground font-medium opacity-80"
                  />
                ) : (
                  <select
                    value={supplierRelForm.proveedor_id}
                    onChange={(e) => setSupplierRelForm({ ...supplierRelForm, proveedor_id: e.target.value })}
                    className={`w-full px-3 py-2 text-xs bg-input border rounded-xl text-foreground focus:outline-none transition-all ${
                      supplierRelErrors.proveedor_id ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    {availableSuppliers.map((pr) => (
                      <option key={pr.proveedor_id} value={pr.proveedor_id}>
                        {pr.codigo_proveedor} — {pr.nombre_comercial}
                      </option>
                    ))}
                  </select>
                )}
                {supplierRelErrors.proveedor_id && <p className="text-[11px] text-rose-400 mt-1">{supplierRelErrors.proveedor_id}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Costo de Compra <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={supplierRelForm.costo_compra}
                      onChange={(e) => setSupplierRelForm({ ...supplierRelForm, costo_compra: e.target.value })}
                      placeholder="0.00"
                      className={`w-full pl-7 pr-3 py-2 text-xs bg-input border rounded-xl text-foreground font-mono focus:outline-none transition-all ${
                        supplierRelErrors.costo_compra ? "border-rose-500" : "border-border focus:border-primary"
                      }`}
                    />
                  </div>
                  {supplierRelErrors.costo_compra && <p className="text-[11px] text-rose-400 mt-1">{supplierRelErrors.costo_compra}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Moneda</label>
                  <select
                    value={supplierRelForm.moneda}
                    onChange={(e) => setSupplierRelForm({ ...supplierRelForm, moneda: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="DOP">DOP (RD$)</option>
                    <option value="USD">USD (US$)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Código en Proveedor</label>
                  <input
                    type="text"
                    value={supplierRelForm.codigo_producto_proveedor}
                    onChange={(e) => setSupplierRelForm({ ...supplierRelForm, codigo_producto_proveedor: e.target.value })}
                    placeholder="Ref. en catálogo suplidor"
                    className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Tiempo entrega (días)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={supplierRelForm.tiempo_entrega_dias}
                    onChange={(e) => setSupplierRelForm({ ...supplierRelForm, tiempo_entrega_dias: e.target.value })}
                    placeholder="Ej. 3"
                    className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-foreground">Proveedor Principal</p>
                  <p className="text-[10px] text-foreground-muted">Máximo un proveedor principal activo por producto</p>
                </div>
                <input
                  type="checkbox"
                  checked={supplierRelForm.proveedor_principal}
                  onChange={(e) => setSupplierRelForm({ ...supplierRelForm, proveedor_principal: e.target.checked })}
                  className="w-4 h-4 text-primary rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={supplierRelForm.observacion}
                  onChange={(e) => setSupplierRelForm({ ...supplierRelForm, observacion: e.target.value })}
                  placeholder="Notas comerciales de compra, empaque, volumen..."
                  className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  disabled={isSavingSupplierRel}
                  className="px-3.5 py-2 border border-border rounded-xl text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplierRel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSupplierRel ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{isSavingSupplierRel ? "Guardando..." : "Guardar Condiciones"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Reutilizable de Creación de Producto (Unificado para Catálogo y Entradas) */}
      <ProductCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProductCreated={(newProd) => {
          fetchData();
          showToast(`Producto '${newProd?.nombre || newProd?.codigo_producto || ""}' registrado exitosamente.`);
        }}
      />
    </div>
  );
}
