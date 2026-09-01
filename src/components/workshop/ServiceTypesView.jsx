"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Wrench,
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
  Check,
  Ban,
  Filter,
  Power,
  EyeOff,
  Clock,
  DollarSign,
  FileCheck,
  Stethoscope,
  Layers
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function ServiceTypesView() {
  const [data, setData] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("orden_visual");
  const [sortDirection, setSortDirection] = useState("asc");
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
    codigo: "",
    nombre: "",
    descripcion: "",
    categoria_servicio_id: "",
    duracion_estimada_horas: 1.0,
    precio_base: 0,
    requiere_diagnostico: false,
    requiere_aprobacion_cliente: false,
    orden_visual: 0,
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
      const res = await fetch("/api/taller/tipos-servicio");
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
          setCategorias(result.categorias || []);
        } else if (Array.isArray(result)) {
          setData(result);
        } else {
          setData([]);
        }
      } else {
        showToast("Error al cargar los tipos de servicio.", "error");
      }
    } catch (err) {
      console.error("Error fetching tipos de servicio:", err);
      showToast("Error de conexión al cargar tipos de servicio.", "error");
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

    const codigoRes = validateRequiredText(formData.codigo, "El Código del Tipo de Servicio", 50);
    if (!codigoRes.isValid) {
      errs.codigo = codigoRes.message;
    }

    const nameRes = validateRequiredText(formData.nombre, "El Nombre del Tipo de Servicio", 150);
    if (!nameRes.isValid) {
      errs.nombre = nameRes.message;
    }

    if (!formData.categoria_servicio_id) {
      errs.categoria_servicio_id = "Debe seleccionar una Categoría de Servicio.";
    }

    if (formData.descripcion && formData.descripcion.length > 500) {
      errs.descripcion = "La Descripción no puede exceder los 500 caracteres.";
    }

    if (
      formData.duracion_estimada_horas === "" ||
      formData.duracion_estimada_horas === null ||
      isNaN(Number(formData.duracion_estimada_horas)) ||
      Number(formData.duracion_estimada_horas) < 0
    ) {
      errs.duracion_estimada_horas = "La Duración Estimada debe ser mayor o igual a 0.";
    }

    if (
      formData.precio_base === "" ||
      formData.precio_base === null ||
      isNaN(Number(formData.precio_base)) ||
      Number(formData.precio_base) < 0
    ) {
      errs.precio_base = "El Precio Base debe ser mayor o igual a 0.00.";
    }

    if (
      formData.orden_visual === "" ||
      formData.orden_visual === null ||
      isNaN(Number(formData.orden_visual)) ||
      Number(formData.orden_visual) < 0
    ) {
      errs.orden_visual = "El Orden Visual debe ser un entero mayor o igual a cero.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        codigo: item.codigo || "",
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        categoria_servicio_id: item.categoria_servicio_id ? String(item.categoria_servicio_id) : "",
        duracion_estimada_horas: item.duracion_estimada_horas !== undefined ? item.duracion_estimada_horas : 1.0,
        precio_base: item.precio_base !== undefined ? item.precio_base : 0,
        requiere_diagnostico: Boolean(item.requiere_diagnostico),
        requiere_aprobacion_cliente: Boolean(item.requiere_aprobacion_cliente),
        orden_visual: item.orden_visual !== undefined ? item.orden_visual : 0,
        activo: item.activo !== false
      });
    } else {
      setEditingItem(null);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
        categoria_servicio_id: categorias.length > 0 ? String(categorias[0].categoria_servicio_id) : "",
        duracion_estimada_horas: 1.0,
        precio_base: 0,
        requiere_diagnostico: false,
        requiere_aprobacion_cliente: false,
        orden_visual: data.length > 0 ? Math.max(...data.map((d) => Number(d.orden_visual) || 0)) + 1 : 1,
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
        ? `/api/taller/tipos-servicio/${editingItem.id}`
        : "/api/taller/tipos-servicio";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: formData.codigo.trim().toUpperCase(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || null,
          categoria_servicio_id: parseInt(formData.categoria_servicio_id, 10),
          duracion_estimada_horas: parseFloat(formData.duracion_estimada_horas) || 0,
          precio_base: parseFloat(formData.precio_base) || 0,
          requiere_diagnostico: Boolean(formData.requiere_diagnostico),
          requiere_aprobacion_cliente: Boolean(formData.requiere_aprobacion_cliente),
          orden_visual: parseInt(formData.orden_visual, 10) || 0,
          activo: Boolean(formData.activo)
        })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || "No se pudo guardar el tipo de servicio.");
      }

      showToast(
        editingItem
          ? "Tipo de servicio actualizado correctamente."
          : "Tipo de servicio creado exitosamente."
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
      const res = await fetch(`/api/taller/tipos-servicio/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          activo: nextStatus
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Error al cambiar estado.");

      showToast(
        nextStatus
          ? `Tipo de servicio "${item.nombre}" reactivado con éxito.`
          : `Tipo de servicio "${item.nombre}" desactivado.`
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
      const res = await fetch(`/api/taller/tipos-servicio/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        if (res.status === 409 || json.error === "SERVICE_TYPE_IN_USE" || json.code === "SERVICE_TYPE_IN_USE") {
          showToast(
            "Este tipo de servicio está siendo utilizado en órdenes de trabajo o recepciones y no puede eliminarse. Puedes desactivarlo para evitar que sea utilizado en nuevos registros.",
            "warning"
          );
        } else {
          showToast(json.message || json.error || "Error al eliminar el tipo de servicio.", "error");
        }
        setIsDeletingModalOpen(false);
        return;
      }

      showToast("Tipo de servicio eliminado correctamente.");
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
      (item.codigo || "").toLowerCase().includes(queryStr) ||
      (item.nombre || "").toLowerCase().includes(queryStr) ||
      (item.descripcion || "").toLowerCase().includes(queryStr) ||
      (item.categoria_nombre || "").toLowerCase().includes(queryStr);

    const matchesCategory =
      categoryFilter === "TODAS" ||
      String(item.categoria_servicio_id) === String(categoryFilter);

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "ACTIVO" && item.activo !== false) ||
      (statusFilter === "INACTIVO" && item.activo === false);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn] ?? "";
    let bVal = b[sortColumn] ?? "";

    if (
      sortColumn === "orden_visual" ||
      sortColumn === "precio_base" ||
      sortColumn === "duracion_estimada_horas" ||
      sortColumn === "uso_count"
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
  const totalTypes = data.length;
  const activeTypes = data.filter((s) => s.activo !== false).length;
  const deactivatedTypes = data.filter((s) => s.activo === false).length;
  const inUseTypes = data.filter((s) => Number(s.uso_count || 0) > 0).length;

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
            <span className="text-foreground font-bold">Catálogo Operativo</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Wrench className="text-primary" size={28} />
            <span>Tipos de Servicio</span>
          </h1>
          <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
            Catálogo oficial de servicios técnicos, mantenimientos y calibraciones para el taller.
          </p>
        </div>

        {permissions.puede_crear && (
          <button
            onClick={() => handleOpenDrawer()}
            className="bg-primary hover:opacity-90 text-primary-foreground font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} />
            <span>Nuevo Tipo de Servicio</span>
          </button>
        )}
      </div>

      {/* Real KPI Cards (4 Factual Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Total Servicios
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {totalTypes}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Servicios Activos
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {activeTypes}
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
              {deactivatedTypes}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              En Uso Operativo
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {inUseTypes}
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
            placeholder="Buscar por código, servicio o descripción..."
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
            {categorias.map((cat) => (
              <option key={cat.categoria_servicio_id} value={cat.categoria_servicio_id}>
                {cat.nombre}
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
            <p>Cargando catálogo de tipos de servicio...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted space-y-3">
            <AlertCircle size={32} className="mx-auto text-foreground-muted opacity-50" />
            <p className="text-sm font-bold text-foreground">No hay tipos de servicio registrados.</p>
            <p className="text-xs max-w-md mx-auto">
              {search || statusFilter !== "Todos" || categoryFilter !== "TODAS"
                ? "No se encontraron registros con los filtros seleccionados."
                : "Comienza registrando los tipos de servicio técnico para el taller."}
            </p>
            {permissions.puede_crear && (
              <button
                onClick={() => handleOpenDrawer()}
                className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow"
              >
                <Plus size={16} />
                <span>Crear Tipo de Servicio</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-[11px] text-foreground-muted uppercase tracking-wider">
                  <th
                    onClick={() => handleSort("orden_visual")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>#</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("codigo")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Código</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("nombre")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Tipo de Servicio</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("categoria_nombre")}
                    className="p-4 cursor-pointer hover:text-foreground select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Categoría</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("precio_base")}
                    className="p-4 cursor-pointer hover:text-foreground select-none text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Precio Base</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-4 select-none text-center">Requisitos</th>
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
                    <td className="p-4 text-foreground-muted font-bold">
                      {item.orden_visual}
                    </td>
                    <td className="p-4 font-bold text-primary">
                      {item.codigo}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-foreground font-sans text-sm">
                        {item.nombre}
                      </div>
                      {item.descripcion && (
                        <div className="text-foreground-muted text-[11px] line-clamp-1 max-w-sm">
                          {item.descripcion}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
                        {item.categoria_nombre}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-400">
                      RD$ {Number(item.precio_base).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.requiere_diagnostico && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold" title="Requiere diagnóstico técnico inicial">
                            DIAG
                          </span>
                        )}
                        {item.requiere_aprobacion_cliente && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold" title="Requiere aprobación previa del cliente">
                            APROB
                          </span>
                        )}
                        {!item.requiere_diagnostico && !item.requiere_aprobacion_cliente && (
                          <span className="text-foreground-muted opacity-40">-</span>
                        )}
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
                              title={item.activo !== false ? "Desactivar servicio" : "Activar servicio"}
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
                              title="Editar tipo de servicio"
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
                            title="Eliminar tipo de servicio"
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
              Mostrando {paginatedData.length} de {sortedData.length} tipos de servicio filtrados
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
      {/* DRAWER LATERAL: CREAR / EDITAR TIPO DE SERVICIO                            */}
      {/* ========================================================================= */}
      {mounted && isDrawerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => !isSaving && setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col font-sans">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface-subtle">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h2 className="font-mono text-base font-bold text-foreground">
                      {editingItem ? "Editar Tipo de Servicio" : "Nuevo Tipo de Servicio"}
                    </h2>
                    <p className="font-mono text-xs text-foreground-muted">
                      {editingItem ? `ID: ${editingItem.id}` : "Catálogo operativo del taller"}
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
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs custom-scrollbar">
                
                {/* Código */}
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1.5">
                    Código <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej. MANT_BASIC, PURGA_FRENOS"
                    maxLength={50}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted uppercase focus:outline-none ${
                      errors.codigo ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.codigo && <p className="text-rose-400 text-[11px] mt-1">{errors.codigo}</p>}
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1.5">
                    Nombre del Servicio <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Mantenimiento Completo"
                    maxLength={150}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none ${
                      errors.nombre ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.nombre && <p className="text-rose-400 text-[11px] mt-1">{errors.nombre}</p>}
                </div>

                {/* Categoría de Servicio */}
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1.5">
                    Categoría de Servicio <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.categoria_servicio_id}
                    onChange={(e) => setFormData({ ...formData, categoria_servicio_id: e.target.value })}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none cursor-pointer ${
                      errors.categoria_servicio_id ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  >
                    <option value="">Seleccione una categoría...</option>
                    {categorias.map((cat) => (
                      <option key={cat.categoria_servicio_id} value={cat.categoria_servicio_id}>
                        {cat.nombre} ({cat.codigo})
                      </option>
                    ))}
                  </select>
                  {errors.categoria_servicio_id && (
                    <p className="text-rose-400 text-[11px] mt-1">{errors.categoria_servicio_id}</p>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Detalles de las tareas incluidas en este tipo de servicio..."
                    maxLength={500}
                    className={`w-full bg-background border rounded-xl p-3 text-foreground placeholder-foreground-muted focus:outline-none resize-none ${
                      errors.descripcion ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.descripcion && <p className="text-rose-400 text-[11px] mt-1">{errors.descripcion}</p>}
                </div>

                {/* Duración Estimada y Precio Base */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-foreground-secondary font-bold mb-1.5">
                      Duración (Horas)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={14} />
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.duracion_estimada_horas}
                        onChange={(e) => setFormData({ ...formData, duracion_estimada_horas: e.target.value })}
                        className={`w-full bg-background border rounded-xl pl-9 pr-3 py-2.5 text-foreground focus:outline-none ${
                          errors.duracion_estimada_horas ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                    </div>
                    {errors.duracion_estimada_horas && (
                      <p className="text-rose-400 text-[10px] mt-1">{errors.duracion_estimada_horas}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-foreground-secondary font-bold mb-1.5">
                      Precio Base (DOP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-bold text-xs">RD$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.precio_base}
                        onChange={(e) => setFormData({ ...formData, precio_base: e.target.value })}
                        className={`w-full bg-background border rounded-xl pl-12 pr-3 py-2.5 text-foreground focus:outline-none ${
                          errors.precio_base ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                    </div>
                    {errors.precio_base && (
                      <p className="text-rose-400 text-[10px] mt-1">{errors.precio_base}</p>
                    )}
                  </div>
                </div>

                {/* Orden Visual */}
                <div>
                  <label className="block text-foreground-secondary font-bold mb-1.5">
                    Orden Visual
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.orden_visual}
                    onChange={(e) => setFormData({ ...formData, orden_visual: e.target.value })}
                    className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none ${
                      errors.orden_visual ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.orden_visual && <p className="text-rose-400 text-[11px] mt-1">{errors.orden_visual}</p>}
                </div>

                {/* Flags Checkboxes */}
                <div className="bg-surface border border-border rounded-xl p-3.5 space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiere_diagnostico}
                      onChange={(e) => setFormData({ ...formData, requiere_diagnostico: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-foreground font-bold block">Requiere Diagnóstico Técnico</span>
                      <span className="text-foreground-muted text-[10px]">Exige checklist previo antes de iniciar trabajos</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiere_aprobacion_cliente}
                      onChange={(e) => setFormData({ ...formData, requiere_aprobacion_cliente: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <div>
                      <span className="text-foreground font-bold block">Requiere Aprobación del Cliente</span>
                      <span className="text-foreground-muted text-[10px]">El presupuesto debe ser validado por el cliente</span>
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
                      <span className="text-foreground font-bold block">Servicio Activo</span>
                      <span className="text-foreground-muted text-[10px]">Disponible para recepciones y órdenes de trabajo</span>
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
                    <span>{isSaving ? "Guardando..." : editingItem ? "Actualizar" : "Crear Servicio"}</span>
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
                <p className="text-xs text-foreground-muted font-mono">Esta acción verificará dependencias activas.</p>
              </div>
            </div>

            <p className="text-xs text-foreground-secondary font-mono leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente el tipo de servicio{" "}
              <strong className="text-foreground">{itemToDelete.nombre}</strong> (Código: {itemToDelete.codigo})?
            </p>

            <div className="bg-surface border border-border rounded-xl p-3 text-[11px] font-mono text-foreground-muted">
              Si este servicio posee recepciones u órdenes de trabajo registradas, el sistema bloqueará la eliminación para proteger el historial operativo del taller.
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
                <span>{isDeleting ? "Eliminando..." : "Eliminar Servicio"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
