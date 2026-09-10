"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Truck,
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
  Power,
  Phone,
  Mail,
  MapPin,
  Globe,
  Building2,
  Package,
  Star,
  Clock,
  DollarSign
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function SuppliersView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("nombre_comercial");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  const [permissions, setPermissions] = useState({
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_eliminar: true,
  });

  // Drawer / Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState("general"); // "general" | "productos"

  // Supplier General Form
  const [formData, setFormData] = useState({
    codigo_proveedor: "",
    nombre_comercial: "",
    nombre_contacto: "",
    telefono: "",
    correo: "",
    direccion: "",
    rnc: "",
    sitio_web: "",
    estado: "ACTIVO",
    observacion: ""
  });

  // Tab: Productos Asociados
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add Product Modal
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProductRelation, setEditingProductRelation] = useState(null);
  const [relationFormData, setRelationFormData] = useState({
    producto_id: "",
    costo_compra: "",
    moneda: "DOP",
    codigo_producto_proveedor: "",
    tiempo_entrega_dias: "",
    proveedor_principal: false,
    observacion: ""
  });
  const [relationErrors, setRelationErrors] = useState({});
  const [isSavingRelation, setIsSavingRelation] = useState(false);

  const [errors, setErrors] = useState({});
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventario/proveedores");
      if (res.ok) {
        setPermissions({
          puede_ver: res.headers.get("x-perm-ver") !== "false",
          puede_crear: res.headers.get("x-perm-crear") === "true",
          puede_editar: res.headers.get("x-perm-editar") === "true",
          puede_eliminar: res.headers.get("x-perm-eliminar") === "true",
        });

        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } else {
        showToast("Error al cargar proveedores.", "error");
      }
    } catch (err) {
      console.error("Error fetching proveedores:", err);
      showToast("Error de conexión al cargar proveedores.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const validateForm = () => {
    const errs = {};
    const codRes = validateRequiredText(formData.codigo_proveedor, "El Código de Proveedor", 50);
    if (!codRes.isValid) errs.codigo_proveedor = codRes.message;

    const nomRes = validateRequiredText(formData.nombre_comercial, "El Nombre Comercial", 150);
    if (!nomRes.isValid) errs.nombre_comercial = nomRes.message;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = async (item = null) => {
    if (item) {
      setEditingItem(item);
      setActiveTab("general");
      setFormData({
        codigo_proveedor: item.codigo_proveedor || "",
        nombre_comercial: item.nombre_comercial || "",
        nombre_contacto: item.nombre_contacto || "",
        telefono: item.telefono || "",
        correo: item.correo || "",
        direccion: item.direccion || "",
        rnc: item.rnc || "",
        sitio_web: item.sitio_web || "",
        estado: item.estado || "ACTIVO",
        observacion: item.observacion || ""
      });
      loadSupplierProducts(item.id);
    } else {
      setEditingItem(null);
      setActiveTab("general");
      setFormData({
        codigo_proveedor: "",
        nombre_comercial: "",
        nombre_contacto: "",
        telefono: "",
        correo: "",
        direccion: "",
        rnc: "",
        sitio_web: "",
        estado: "ACTIVO",
        observacion: ""
      });
      setSupplierProducts([]);
      setAvailableProducts([]);
    }
    setErrors({});
    setIsDrawerOpen(true);
  };

  const loadSupplierProducts = async (supplierId) => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/inventario/proveedores/${supplierId}/productos`);
      if (res.ok) {
        const json = await res.json();
        setSupplierProducts(json.productos || []);
        setAvailableProducts(json.catalogo_productos || []);
      }
    } catch (err) {
      console.error("Error loading supplier products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm() || isSaving) return;

    setIsSaving(true);
    try {
      const url = editingItem
        ? `/api/inventario/proveedores/${editingItem.id}`
        : "/api/inventario/proveedores";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || "Error al guardar el proveedor.", "error");
        return;
      }

      showToast(editingItem ? "Proveedor actualizado exitosamente." : "Proveedor creado exitosamente.");
      if (!editingItem && json.item?.proveedor_id) {
        setEditingItem({ ...json.item, id: json.item.proveedor_id });
        loadSupplierProducts(json.item.proveedor_id);
      } else {
        fetchData();
        setIsDrawerOpen(false);
      }
    } catch (err) {
      console.error("Error saving proveedor:", err);
      showToast("Error de conexión al guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const nextEstado = item.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
      const res = await fetch(`/api/inventario/proveedores/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_proveedor: item.codigo_proveedor,
          nombre_comercial: item.nombre_comercial,
          estado: nextEstado
        })
      });

      if (res.ok) {
        showToast(`Estado de ${item.nombre_comercial} cambiado a ${nextEstado}.`);
        fetchData();
      } else {
        const json = await res.json();
        showToast(json.message || "Error al cambiar estado.", "error");
      }
    } catch (err) {
      console.error("Error toggling status:", err);
      showToast("Error de conexión al cambiar estado.", "error");
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inventario/proveedores/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.message || "Proveedor eliminado exitosamente.");
        setIsDeletingModalOpen(false);
        setItemToDelete(null);
        fetchData();
      } else {
        showToast(json.message || "Error al eliminar proveedor.", "error");
        setIsDeletingModalOpen(false);
      }
    } catch (err) {
      console.error("Error deleting proveedor:", err);
      showToast("Error de conexión al eliminar.", "error");
      setIsDeletingModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RELATION MODAL LOGIC (PRODUCTOS DEL PROVEEDOR)
  // ---------------------------------------------------------------------------
  const handleOpenAddProductModal = (relation = null) => {
    if (relation) {
      setEditingProductRelation(relation);
      setRelationFormData({
        producto_id: String(relation.producto_id),
        costo_compra: String(relation.costo_compra || 0),
        moneda: relation.moneda || "DOP",
        codigo_producto_proveedor: relation.codigo_producto_proveedor || "",
        tiempo_entrega_dias: relation.tiempo_entrega_dias !== null ? String(relation.tiempo_entrega_dias) : "",
        proveedor_principal: Boolean(relation.proveedor_principal),
        observacion: relation.observacion || ""
      });
    } else {
      setEditingProductRelation(null);
      setRelationFormData({
        producto_id: availableProducts.length > 0 ? String(availableProducts[0].producto_id) : "",
        costo_compra: availableProducts.length > 0 ? String(availableProducts[0].costo_actual || 0) : "0",
        moneda: "DOP",
        codigo_producto_proveedor: "",
        tiempo_entrega_dias: "3",
        proveedor_principal: false,
        observacion: ""
      });
    }
    setRelationErrors({});
    setIsAddProductModalOpen(true);
  };

  const handleSaveRelation = async (e) => {
    if (e) e.preventDefault();
    const errs = {};

    if (!relationFormData.producto_id) {
      errs.producto_id = "Debe seleccionar un producto.";
    }
    if (
      relationFormData.costo_compra === "" ||
      isNaN(Number(relationFormData.costo_compra)) ||
      Number(relationFormData.costo_compra) < 0
    ) {
      errs.costo_compra = "El costo de compra debe ser mayor o igual a 0.";
    }

    setRelationErrors(errs);
    if (Object.keys(errs).length > 0 || isSavingRelation) return;

    setIsSavingRelation(true);
    try {
      if (editingProductRelation) {
        // Edit relation
        const res = await fetch(`/api/inventario/producto-proveedor/${editingProductRelation.producto_proveedor_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            costo_compra: Number(relationFormData.costo_compra),
            moneda: relationFormData.moneda,
            codigo_producto_proveedor: relationFormData.codigo_producto_proveedor,
            tiempo_entrega_dias: relationFormData.tiempo_entrega_dias !== "" ? Number(relationFormData.tiempo_entrega_dias) : null,
            proveedor_principal: relationFormData.proveedor_principal,
            observacion: relationFormData.observacion
          })
        });

        const json = await res.json();
        if (!res.ok) {
          showToast(json.message || "Error al actualizar relación.", "error");
          return;
        }
        showToast("Condiciones comerciales actualizadas exitosamente.");
      } else {
        // Create relation
        const res = await fetch(`/api/inventario/proveedores/${editingItem.id}/productos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto_id: Number(relationFormData.producto_id),
            costo_compra: Number(relationFormData.costo_compra),
            moneda: relationFormData.moneda,
            codigo_producto_proveedor: relationFormData.codigo_producto_proveedor,
            tiempo_entrega_dias: relationFormData.tiempo_entrega_dias !== "" ? Number(relationFormData.tiempo_entrega_dias) : null,
            proveedor_principal: relationFormData.proveedor_principal,
            observacion: relationFormData.observacion
          })
        });

        const json = await res.json();
        if (!res.ok) {
          showToast(json.message || "Error al asociar producto al proveedor.", "error");
          return;
        }
        showToast("Producto asociado al proveedor exitosamente.");
      }

      setIsAddProductModalOpen(false);
      loadSupplierProducts(editingItem.id);
      fetchData();
    } catch (err) {
      console.error("Error saving relation:", err);
      showToast("Error de conexión al guardar relación.", "error");
    } finally {
      setIsSavingRelation(false);
    }
  };

  const handleInactivateRelation = async (rel) => {
    try {
      const res = await fetch(`/api/inventario/producto-proveedor/${rel.producto_proveedor_id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Relación comercial inactivada exitosamente.");
        loadSupplierProducts(editingItem.id);
        fetchData();
      } else {
        const json = await res.json();
        showToast(json.message || "Error al inactivar relación.", "error");
      }
    } catch (err) {
      console.error("Error inactivating relation:", err);
      showToast("Error de conexión al inactivar relación.", "error");
    }
  };

  // Filter and sort
  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.codigo_proveedor?.toLowerCase().includes(search.toLowerCase()) ||
      item.nombre_comercial?.toLowerCase().includes(search.toLowerCase()) ||
      item.nombre_contacto?.toLowerCase().includes(search.toLowerCase()) ||
      item.rnc?.toLowerCase().includes(search.toLowerCase()) ||
      item.correo?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Activo" && item.estado === "ACTIVO") ||
      (statusFilter === "Inactivo" && item.estado === "INACTIVO");

    return matchesSearch && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let valA = a[sortColumn] ?? "";
    let valB = b[sortColumn] ?? "";
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const totalActivos = data.filter((i) => i.estado === "ACTIVO").length;
  const totalInactivos = data.filter((i) => i.estado === "INACTIVO").length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-[9999999] flex items-center gap-2 px-5 py-3 rounded-xl border shadow-2xl text-sm font-medium transition-all transform duration-300 ${
            toastMessage.type === "error"
              ? "bg-rose-950/95 border-rose-500/50 text-rose-200"
              : "bg-emerald-950/95 border-emerald-500/50 text-emerald-200"
          }`}
        >
          {toastMessage.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Catálogo de Proveedores</h1>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border border-border text-foreground-muted bg-surface">
                  Tenant Scoped
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                Registro de proveedores, contactos comerciales y catálogo de productos suministrados
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-elevated transition-all cursor-pointer"
            title="Refrescar catálogo"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refrescar</span>
          </button>

          {permissions.puede_crear && (
            <button
              type="button"
              onClick={() => handleOpenDrawer()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              <span>Nuevo Proveedor</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-muted">Total Proveedores</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{data.length}</p>
          </div>
          <div className="p-3 bg-surface rounded-xl text-foreground-muted border border-border">
            <Truck size={18} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-500 font-medium">Activos</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{totalActivos}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-500 font-medium">Inactivos</p>
            <p className="text-2xl font-bold text-rose-400 mt-0.5">{totalInactivos}</p>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
            <XCircle size={18} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por código, nombre, RNC, contacto o correo..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <span>Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-input border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Activo">Activos</option>
              <option value="Inactivo">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-foreground-muted flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span>Cargando proveedores...</span>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted flex flex-col items-center gap-2">
            <Truck size={32} className="opacity-30" />
            <p className="text-sm font-medium text-foreground">No hay proveedores registrados.</p>
            <p className="text-xs">
              {search || statusFilter !== "Todos"
                ? "No se encontraron resultados para los filtros aplicados."
                : "Comienza registrando tu primer proveedor con el botón 'Nuevo Proveedor'."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface text-foreground-muted font-medium">
                  <th
                    className="p-3.5 pl-5 cursor-pointer hover:text-foreground"
                    onClick={() => {
                      if (sortColumn === "codigo_proveedor") setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortColumn("codigo_proveedor");
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>CÓDIGO</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:text-foreground"
                    onClick={() => {
                      if (sortColumn === "nombre_comercial") setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortColumn("nombre_comercial");
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>PROVEEDOR</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-3.5">CONTACTO</th>
                  <th className="p-3.5">CORREO</th>
                  <th className="p-3.5 text-center">PRODUCTOS</th>
                  <th className="p-3.5 text-center">ESTADO</th>
                  <th className="p-3.5 pr-5 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3.5 pl-5 font-mono font-medium text-foreground">{item.codigo_proveedor}</td>
                    <td className="p-3.5 font-medium text-foreground">
                      <div>
                        <p>{item.nombre_comercial}</p>
                        {item.rnc && (
                          <span className="text-[10px] font-mono text-foreground-muted">RNC: {item.rnc}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-foreground-secondary">
                      <div>
                        <p>{item.nombre_contacto || "—"}</p>
                        {item.telefono && (
                          <span className="text-[10px] text-foreground-muted flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {item.telefono}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-foreground-secondary">
                      {item.correo ? (
                        <a href={`mailto:${item.correo}`} className="text-primary hover:underline flex items-center gap-1">
                          <Mail size={11} />
                          <span>{item.correo}</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-surface border border-border text-foreground-secondary">
                        <Package size={12} className="text-primary" />
                        <span>{item.total_productos}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.estado === "ACTIVO"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.estado === "ACTIVO" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        {item.estado}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {permissions.puede_editar && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              title={item.estado === "ACTIVO" ? "Inactivar proveedor" : "Activar proveedor"}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                item.estado === "ACTIVO"
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                            >
                              <Power size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer(item)}
                              title="Ver / Editar proveedor y productos"
                              className="p-1.5 rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated transition-all cursor-pointer"
                            >
                              <Edit2 size={13} />
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
                            title="Eliminar proveedor"
                            className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
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

        {/* Pagination */}
        {!loading && sortedData.length > 0 && (
          <div className="p-4 bg-surface border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-foreground-muted">
            <span>
              Mostrando {paginatedData.length} de {sortedData.length} proveedores filtrados
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

      {/* Drawer: Proveedor con Tabs (Datos Generales | Productos Asociados) */}
      {mounted && isDrawerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
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
                      <Truck size={20} />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-foreground">
                        {editingItem ? editingItem.nombre_comercial : "Nuevo Proveedor"}
                      </h2>
                      <p className="font-mono text-xs text-foreground-muted">
                        {editingItem ? `Código: ${editingItem.codigo_proveedor} • ID: ${editingItem.id}` : "Registro maestro de suplidores"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    disabled={isSaving}
                    className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Navigation Tabs (only if editing existing item) */}
                {editingItem && (
                  <div className="flex items-center gap-2 border-b border-border -mb-6 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("general")}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === "general"
                          ? "border-primary text-primary"
                          : "border-transparent text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      DATOS GENERALES
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("productos")}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "productos"
                          ? "border-primary text-primary"
                          : "border-transparent text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      <span>PRODUCTOS ASOCIADOS</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface border border-border text-foreground-secondary">
                        {supplierProducts.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: Datos Generales */}
              {activeTab === "general" && (
                <>
                  <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Código Proveedor <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.codigo_proveedor}
                          onChange={(e) => setFormData({ ...formData, codigo_proveedor: e.target.value.toUpperCase() })}
                          placeholder="Ej. PROV-001"
                          className={`w-full px-3 py-2 text-xs bg-input border rounded-xl font-mono text-foreground focus:outline-none transition-all ${
                            errors.codigo_proveedor ? "border-rose-500" : "border-border focus:border-primary"
                          }`}
                        />
                        {errors.codigo_proveedor && <p className="text-[11px] text-rose-400 mt-1">{errors.codigo_proveedor}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">RNC / Identificación</label>
                        <input
                          type="text"
                          value={formData.rnc}
                          onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                          placeholder="Ej. 101000000"
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl font-mono text-foreground focus:outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Nombre Comercial / Razón Social <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.nombre_comercial}
                        onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                        placeholder="Ej. Shimano Dominicana SRL"
                        className={`w-full px-3 py-2 text-xs bg-input border rounded-xl text-foreground focus:outline-none transition-all ${
                          errors.nombre_comercial ? "border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      {errors.nombre_comercial && <p className="text-[11px] text-rose-400 mt-1">{errors.nombre_comercial}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Contacto Principal</label>
                        <input
                          type="text"
                          value={formData.nombre_contacto}
                          onChange={(e) => setFormData({ ...formData, nombre_contacto: e.target.value })}
                          placeholder="Nombre del asesor o vendedor"
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Teléfono</label>
                        <input
                          type="text"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="Ej. 809-555-1000"
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Correo Electrónico</label>
                        <input
                          type="email"
                          value={formData.correo}
                          onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                          placeholder="ventas@proveedor.com"
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Sitio Web</label>
                        <input
                          type="url"
                          value={formData.sitio_web}
                          onChange={(e) => setFormData({ ...formData, sitio_web: e.target.value })}
                          placeholder="https://www.proveedor.com"
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Dirección Física</label>
                      <input
                        type="text"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Calle, número, sector, ciudad..."
                        className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">Estado</label>
                        <select
                          value={formData.estado}
                          onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="ACTIVO">ACTIVO</option>
                          <option value="INACTIVO">INACTIVO</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Observaciones</label>
                      <textarea
                        rows={2}
                        value={formData.observacion}
                        onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                        placeholder="Condiciones comerciales especiales, crédito, etc."
                        className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all resize-none"
                      />
                    </div>
                  </form>

                  <div className="p-4 border-t border-border bg-surface flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      disabled={isSaving}
                      className="px-4 py-2 border border-border rounded-xl text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-elevated cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>{isSaving ? "Guardando..." : "Guardar Proveedor"}</span>
                    </button>
                  </div>
                </>
              )}

              {/* Tab 2: Productos Asociados (admin.producto_proveedor) */}
              {activeTab === "productos" && (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* Toolbar */}
                  <div className="p-4 border-b border-border bg-surface/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">Productos Suministrados</h3>
                      <p className="text-[11px] text-foreground-muted">Catálogo de productos y condiciones comerciales con este proveedor</p>
                    </div>

                    {permissions.puede_crear && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddProductModal()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
                      >
                        <Plus size={14} />
                        <span>Asociar Producto</span>
                      </button>
                    )}
                  </div>

                  {/* List of associated products */}
                  <div className="flex-1 p-4">
                    {loadingProducts ? (
                      <div className="p-8 text-center text-xs text-foreground-muted flex flex-col items-center gap-2">
                        <RefreshCw size={20} className="animate-spin text-primary" />
                        <span>Cargando productos asociados...</span>
                      </div>
                    ) : supplierProducts.length === 0 ? (
                      <div className="p-12 text-center text-foreground-muted flex flex-col items-center gap-2 border border-dashed border-border rounded-2xl">
                        <Package size={28} className="opacity-30" />
                        <p className="text-xs font-semibold text-foreground">Este proveedor no tiene productos asociados.</p>
                        <p className="text-[11px]">Haga clic en "+ Asociar Producto" para registrar el catálogo que surte.</p>
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-surface text-foreground-muted font-medium">
                              <th className="p-3 pl-4">PRODUCTO</th>
                              <th className="p-3 text-right">COSTO COMPRA</th>
                              <th className="p-3 text-center">ENTREGA</th>
                              <th className="p-3 text-center">PRINCIPAL</th>
                              <th className="p-3 text-center">ESTADO</th>
                              <th className="p-3 pr-4 text-right">ACCIONES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {supplierProducts.map((p) => (
                              <tr key={p.producto_proveedor_id} className="hover:bg-surface/50">
                                <td className="p-3 pl-4">
                                  <div>
                                    <p className="font-semibold text-foreground">{p.producto_nombre}</p>
                                    <p className="text-[10px] font-mono text-foreground-muted">
                                      SKU: {p.codigo_producto} {p.marca_nombre ? `• ${p.marca_nombre}` : ""}
                                      {p.codigo_producto_proveedor ? ` • Ref: ${p.codigo_producto_proveedor}` : ""}
                                    </p>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-foreground">
                                  {p.moneda} {p.costo_compra.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center text-foreground-secondary font-mono">
                                  {p.tiempo_entrega_dias !== null ? `${p.tiempo_entrega_dias}d` : "—"}
                                </td>
                                <td className="p-3 text-center">
                                  {p.proveedor_principal ? (
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
                                      p.estado === "ACTIVO"
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                    }`}
                                  >
                                    {p.estado}
                                  </span>
                                </td>
                                <td className="p-3 pr-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddProductModal(p)}
                                      title="Editar condiciones"
                                      className="p-1 rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated cursor-pointer"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    {p.estado === "ACTIVO" && (
                                      <button
                                        type="button"
                                        onClick={() => handleInactivateRelation(p)}
                                        title="Inactivar relación"
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

      {/* Modal: Asociar / Editar Producto en Proveedor */}
      {mounted && isAddProductModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {editingProductRelation ? "Editar Relación Comercial" : "Asociar Producto a Proveedor"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRelation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Producto <span className="text-rose-400">*</span>
                </label>
                {editingProductRelation ? (
                  <input
                    type="text"
                    disabled
                    value={editingProductRelation.producto_nombre}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-xl text-foreground font-medium opacity-80"
                  />
                ) : (
                  <select
                    value={relationFormData.producto_id}
                    onChange={(e) => {
                      const selProd = availableProducts.find((p) => String(p.producto_id) === e.target.value);
                      setRelationFormData({
                        ...relationFormData,
                        producto_id: e.target.value,
                        costo_compra: selProd ? String(selProd.costo_actual || 0) : relationFormData.costo_compra
                      });
                    }}
                    className={`w-full px-3 py-2 text-xs bg-input border rounded-xl text-foreground focus:outline-none transition-all ${
                      relationErrors.producto_id ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    {availableProducts.map((p) => (
                      <option key={p.producto_id} value={p.producto_id}>
                        {p.codigo_producto} — {p.nombre} {p.marca_nombre ? `(${p.marca_nombre})` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {relationErrors.producto_id && <p className="text-[11px] text-rose-400 mt-1">{relationErrors.producto_id}</p>}
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
                      value={relationFormData.costo_compra}
                      onChange={(e) => setRelationFormData({ ...relationFormData, costo_compra: e.target.value })}
                      placeholder="0.00"
                      className={`w-full pl-7 pr-3 py-2 text-xs bg-input border rounded-xl text-foreground font-mono focus:outline-none transition-all ${
                        relationErrors.costo_compra ? "border-rose-500" : "border-border focus:border-primary"
                      }`}
                    />
                  </div>
                  {relationErrors.costo_compra && <p className="text-[11px] text-rose-400 mt-1">{relationErrors.costo_compra}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Moneda</label>
                  <select
                    value={relationFormData.moneda}
                    onChange={(e) => setRelationFormData({ ...relationFormData, moneda: e.target.value })}
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
                    value={relationFormData.codigo_producto_proveedor}
                    onChange={(e) => setRelationFormData({ ...relationFormData, codigo_producto_proveedor: e.target.value })}
                    placeholder="Ref. del catálogo suplidor"
                    className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Tiempo de entrega (días)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={relationFormData.tiempo_entrega_dias}
                    onChange={(e) => setRelationFormData({ ...relationFormData, tiempo_entrega_dias: e.target.value })}
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
                  checked={relationFormData.proveedor_principal}
                  onChange={(e) => setRelationFormData({ ...relationFormData, proveedor_principal: e.target.checked })}
                  className="w-4 h-4 text-primary rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={relationFormData.observacion}
                  onChange={(e) => setRelationFormData({ ...relationFormData, observacion: e.target.value })}
                  placeholder="Notas de precio por volumen, empaque, etc."
                  className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  disabled={isSavingRelation}
                  className="px-3.5 py-2 border border-border rounded-xl text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRelation}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSavingRelation ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{isSavingRelation ? "Guardando..." : "Guardar Relación"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      <SecurityConfirmDialog
        isOpen={mounted && isDeletingModalOpen && !!itemToDelete}
        onClose={() => {
          setIsDeletingModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        variant="danger"
        title="¿Eliminar Proveedor?"
        description={`¿Está seguro que desea eliminar al proveedor "${itemToDelete?.nombre_comercial || ''}"? Esta acción no se puede deshacer si no posee compras registradas.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
        loadingLabel="Eliminando..."
        details={itemToDelete ? [
          { label: 'Proveedor', value: itemToDelete.nombre_comercial },
          { label: 'Código', value: itemToDelete.codigo_proveedor, isCode: true },
          { label: 'Productos Asociados', value: String(itemToDelete.total_productos || 0) }
        ] : null}
      />
    </div>
  );
}
