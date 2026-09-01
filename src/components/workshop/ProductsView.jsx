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
  QrCode
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function ProductsView() {
  const [data, setData] = useState([]);
  const [lookups, setLookups] = useState({
    tipos: [],
    categorias: [],
    marcas: [],
    unidades: []
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
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    codigo_producto: "",
    codigo_barra: "",
    nombre: "",
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
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

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
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        codigo_producto: item.codigo_producto || "",
        codigo_barra: item.codigo_barra || "",
        nombre: item.nombre || "",
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
    } else {
      setEditingItem(null);
      setFormData({
        codigo_producto: "",
        codigo_barra: "",
        nombre: "",
        descripcion: "",
        tipo_producto_id: lookups.tipos.length > 0 ? String(lookups.tipos[0].id) : "",
        categoria_producto_id: lookups.categorias.length > 0 ? String(lookups.categorias[0].id) : "",
        marca_producto_id: lookups.marcas.length > 0 ? String(lookups.marcas[0].id) : "",
        unidad_medida_id: lookups.unidades.length > 0 ? String(lookups.unidades[0].id) : "",
        imagen_url: "",
        costo_actual: 0,
        precio_venta: 0,
        stock_minimo: 5,
        stock_maximo: "",
        requiere_serial: false,
        activo: true
      });
    }
    setErrors({});
    setIsDrawerOpen(true);
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
          ...item,
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

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/taller/productos/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        if (res.status === 409 || json.error === "PRODUCT_IN_USE" || json.code === "PRODUCT_IN_USE") {
          showToast(
            "Este producto posee movimientos o registros asociados y no puede eliminarse. Puedes desactivarlo.",
            "warning"
          );
        } else {
          showToast(json.message || json.error || "Error al eliminar el producto.", "error");
        }
        setIsDeletingModalOpen(false);
        return;
      }

      showToast("Producto eliminado correctamente del catálogo.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
      setIsDeletingModalOpen(false);
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
      (item.tipo_producto_nombre || "").toLowerCase().includes(queryStr);

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
      
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : toastMessage.type === "warning"
              ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
              : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
          }`}
        >
          {toastMessage.type === "error" ? (
            <XCircle size={18} className="text-rose-400 shrink-0" />
          ) : toastMessage.type === "warning" ? (
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          )}
          <span className="leading-snug">{toastMessage.text}</span>
        </div>
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
            onClick={() => handleOpenDrawer()}
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
            placeholder="Buscar por código, código de barra, nombre, marca..."
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
                onClick={() => handleOpenDrawer()}
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
                    onClick={() => handleSort("precio_venta")}
                    className="p-4 cursor-pointer hover:text-foreground select-none text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Precio Venta</span>
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
                    <td className="p-4 text-right">
                      <div className="font-bold text-emerald-400">
                        RD$ {Number(item.precio_venta).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-foreground-muted mt-0.5">
                        Costo: RD$ {Number(item.costo_actual).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
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
                            onClick={() => {
                              setItemToDelete(item);
                              setIsDeletingModalOpen(true);
                            }}
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
            <div className="w-screen max-w-lg bg-card border-l border-border shadow-2xl flex flex-col font-sans">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface-subtle">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                    <Package size={20} />
                  </div>
                  <div>
                    <h2 className="font-mono text-base font-bold text-foreground">
                      {editingItem ? "Editar Producto" : "Nuevo Producto en Catálogo"}
                    </h2>
                    <p className="font-mono text-xs text-foreground-muted">
                      {editingItem ? `ID: ${editingItem.id} • SKU: ${editingItem.codigo_producto}` : "Maestro central de productos"}
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

              {/* Drawer Form Body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 font-mono text-xs custom-scrollbar">
                
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
                    <span>{isSaving ? "Guardando..." : editingItem ? "Actualizar" : "Crear Producto"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN                                      */}
      {/* ========================================================================= */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(3px)" }}
            onClick={() => !isDeleting && setIsDeletingModalOpen(false)}
          />

          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-[460px] shadow-2xl z-10 font-sans space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">¿Confirmar Eliminación?</h3>
                <p className="text-xs text-foreground-muted font-mono">Verificación de dependencias de inventario.</p>
              </div>
            </div>

            <p className="text-xs text-foreground-secondary font-mono leading-relaxed">
              ¿Estás seguro de que deseas eliminar del catálogo el producto{" "}
              <strong className="text-foreground">{itemToDelete.nombre}</strong> (Código: {itemToDelete.codigo_producto})?
            </p>

            <div className="bg-surface border border-border rounded-xl p-3 text-[11px] font-mono text-foreground-muted">
              Si este producto posee existencias registradas, movimientos en kardex, órdenes de compra o fue utilizado en órdenes de trabajo, el sistema bloqueará la eliminación física para garantizar la integridad histórica.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeletingModalOpen(false);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 bg-surface border border-border rounded-xl text-foreground-secondary hover:text-foreground font-bold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                <span>{isDeleting ? "Eliminando..." : "Eliminar Producto"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
