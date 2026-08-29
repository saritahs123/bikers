"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
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
  Wrench,
  Check,
  Ban,
  Filter,
  Power,
  Gauge,
  EyeOff
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function ComponentStatesView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [revisionFilter, setRevisionFilter] = useState("Todos");
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
    nivel_desgaste: 0,
    requiere_revision: false,
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
      const res = await fetch("/api/crm/component-states");
      if (res.ok) {
        // Read authoritative permissions from headers
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
        setData(Array.isArray(result) ? result : []);
      } else {
        showToast("Error al cargar los estados de componentes.", "error");
      }
    } catch (err) {
      console.error("Error fetching estados:", err);
      showToast("Error de conexión al cargar estados.", "error");
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

    // Código validation
    const codigoRes = validateRequiredText(formData.codigo, "El Código del Estado", 50);
    if (!codigoRes.isValid) {
      errs.codigo = codigoRes.message;
    }

    // Nombre validation
    const nameRes = validateRequiredText(formData.nombre, "El Nombre del Estado", 100);
    if (!nameRes.isValid) {
      errs.nombre = nameRes.message;
    }

    // Descripción max length
    if (formData.descripcion && formData.descripcion.length > 300) {
      errs.descripcion = "La Descripción no puede exceder los 300 caracteres.";
    }

    // Nivel de Desgaste validation
    if (
      formData.nivel_desgaste === "" ||
      formData.nivel_desgaste === null ||
      isNaN(Number(formData.nivel_desgaste)) ||
      Number(formData.nivel_desgaste) < 0 ||
      Number(formData.nivel_desgaste) > 100
    ) {
      errs.nivel_desgaste = "El Nivel de Desgaste es obligatorio y debe ser un número entero entre 0 y 100.";
    }

    // Orden Visual validation
    if (
      formData.orden_visual === "" ||
      formData.orden_visual === null ||
      isNaN(Number(formData.orden_visual)) ||
      Number(formData.orden_visual) < 0
    ) {
      errs.orden_visual = "El Orden Visual es obligatorio y debe ser un número entero mayor o igual a cero.";
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
        nivel_desgaste: item.nivel_desgaste !== undefined ? item.nivel_desgaste : 0,
        requiere_revision: Boolean(item.requiere_revision),
        orden_visual: item.orden_visual !== undefined ? item.orden_visual : 0,
        activo: item.activo !== false
      });
    } else {
      setEditingItem(null);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
        nivel_desgaste: 0,
        requiere_revision: false,
        orden_visual: data.length > 0 ? Math.max(...data.map(d => Number(d.orden_visual) || 0)) + 1 : 1,
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
        ? `/api/crm/component-states/${editingItem.id}`
        : "/api/crm/component-states";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: formData.codigo.trim().toUpperCase(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || null,
          nivel_desgaste: parseInt(formData.nivel_desgaste, 10) || 0,
          requiere_revision: Boolean(formData.requiere_revision),
          orden_visual: parseInt(formData.orden_visual, 10) || 0,
          activo: Boolean(formData.activo)
        })
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || "No se pudo guardar el estado.");
      }

      showToast(
        editingItem
          ? "Estado actualizado correctamente."
          : "Estado creado exitosamente."
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
      const res = await fetch(`/api/crm/component-states/${item.id}`, {
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
          ? `Estado "${item.nombre}" reactivado con éxito.`
          : `Estado "${item.nombre}" desactivado.`
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
      const res = await fetch(`/api/crm/component-states/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al eliminar el estado.");
      }

      showToast("Estado eliminado correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
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
      (item.descripcion || "").toLowerCase().includes(queryStr);

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "ACTIVO" && item.activo !== false) ||
      (statusFilter === "INACTIVO" && item.activo === false);

    const matchesRevision =
      revisionFilter === "Todos" ||
      (revisionFilter === "SI" && Boolean(item.requiere_revision)) ||
      (revisionFilter === "NO" && !item.requiere_revision);

    return matchesSearch && matchesStatus && matchesRevision;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn] ?? "";
    let bVal = b[sortColumn] ?? "";

    if (sortColumn === "orden_visual" || sortColumn === "nivel_desgaste" || sortColumn === "component_count") {
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

  // Real KPIs (Factual Metrics Universe)
  const totalStates = data.length;
  const activeStates = data.filter((s) => s.activo !== false).length;
  const deactivatedStates = data.filter((s) => s.activo === false).length;
  const inUseStates = data.filter((s) => Number(s.component_count || 0) > 0).length;

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
          }`}
        >
          {toastMessage.type === "error" ? (
            <XCircle size={18} className="text-rose-400" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-primary mb-1">
            <span>CRM</span>
            <span>/</span>
            <span className="text-foreground font-bold">Catálogo de Estados</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-foreground tracking-tight">
            Estados de Componentes
          </h1>
          <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
            Escala técnica objetiva para calificar el nivel de desgaste y necesidad de revisión de piezas.
          </p>
        </div>

        {permissions.puede_crear && (
          <button
            onClick={() => handleOpenDrawer()}
            className="bg-primary hover:opacity-90 text-primary-foreground font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus size={18} />
            <span>Nuevo Estado</span>
          </button>
        )}
      </div>

      {/* Real KPI Cards (4 Factual Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Total Vigentes
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {totalStates}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              Activos
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {activeStates}
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
              {deactivatedStates}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-muted block">
              En Uso en Bicicletas
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {inUseStates}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por código, nombre o descripción..."
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="Todos">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Desactivados</option>
          </select>

          <select
            value={revisionFilter}
            onChange={(e) => {
              setRevisionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="Todos">Revisión: Todos</option>
            <option value="SI">Requiere Revisión</option>
            <option value="NO">Sin Revisión</option>
          </select>

          <button
            onClick={fetchData}
            title="Recargar catálogo"
            className="p-2.5 bg-background border border-border rounded-xl text-foreground-muted hover:text-foreground hover:border-primary transition-all cursor-pointer shrink-0"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-primary" : ""} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-foreground-muted font-mono min-h-[300px]">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <span className="text-xs">Cargando catálogo de estados...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-foreground-muted font-mono min-h-[300px]">
          <Activity size={40} className="text-foreground-muted/40" />
          <p className="text-sm font-bold text-foreground">No hay estados de componentes registrados.</p>
          {permissions.puede_crear && (
            <button
              onClick={() => handleOpenDrawer()}
              className="mt-2 bg-primary text-primary-foreground font-mono text-xs font-bold px-4 py-2 rounded-xl"
            >
              Registrar Primer Estado
            </button>
          )}
        </div>
      ) : sortedData.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-foreground-muted font-mono min-h-[300px]">
          <Filter size={40} className="text-foreground-muted/40" />
          <p className="text-sm font-bold text-foreground">No se encontraron estados con los filtros seleccionados.</p>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("Todos");
              setRevisionFilter("Todos");
            }}
            className="mt-2 text-primary hover:underline text-xs"
          >
            Limpiar filtros de búsqueda
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table (Visible on md and up) */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-xl font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface text-foreground-muted font-bold text-[11px] uppercase tracking-wider">
                    <th
                      className="p-4 cursor-pointer hover:text-foreground transition-colors w-20 text-center"
                      onClick={() => handleSort("orden_visual")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Orden</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="p-4 cursor-pointer hover:text-foreground transition-colors w-36"
                      onClick={() => handleSort("codigo")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Código</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="p-4 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("nombre")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Nombre</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="p-4 cursor-pointer hover:text-foreground transition-colors text-center w-36"
                      onClick={() => handleSort("nivel_desgaste")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Desgaste</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="p-4 text-center w-36">Requiere Revisión</th>
                    <th
                      className="p-4 cursor-pointer hover:text-foreground transition-colors text-center w-36"
                      onClick={() => handleSort("component_count")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Componentes</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="p-4 text-center w-32">Estado</th>
                    <th className="p-4 text-right w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedData.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-surface-elevated transition-colors group ${
                        item.activo === false ? "opacity-75 bg-surface/30" : ""
                      }`}
                    >
                      <td className="p-4 text-center font-bold text-foreground-muted">
                        #{item.orden_visual}
                      </td>
                      <td className="p-4 font-bold text-primary">
                        {item.codigo}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-foreground">{item.nombre}</div>
                        {item.descripcion && (
                          <div className="text-foreground-muted text-[11px] truncate max-w-xs mt-0.5">
                            {item.descripcion}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-surface border-border text-foreground">
                          <Gauge size={12} className="text-primary" />
                          <span>{item.nivel_desgaste}% desgaste</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {item.requiere_revision ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle size={11} />
                            <span>REVISIÓN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface text-foreground-muted border border-border">
                            <span>NORMAL</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            Number(item.component_count || 0) > 0
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : "bg-surface text-foreground-muted border-border"
                          }`}
                        >
                          <Wrench size={11} />
                          <span>{item.component_count || 0}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            item.activo !== false
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {item.activo !== false ? (
                            <>
                              <Check size={10} />
                              <span>ACTIVO</span>
                            </>
                          ) : (
                            <>
                              <Ban size={10} />
                              <span>DESACTIVADO</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Deactivate / Reactivate Toggle */}
                          {permissions.puede_editar && (
                            <button
                              onClick={() => handleToggleStatus(item)}
                              title={item.activo !== false ? "Desactivar estado" : "Reactivar estado"}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                item.activo !== false
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                              }`}
                            >
                              <Power size={14} />
                            </button>
                          )}

                          {permissions.puede_editar && (
                            <button
                              onClick={() => handleOpenDrawer(item)}
                              title="Editar estado"
                              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {permissions.puede_eliminar && (
                            <button
                              onClick={() => {
                                setItemToDelete(item);
                                setIsDeletingModalOpen(true);
                              }}
                              title="Eliminar estado"
                              className="p-1.5 text-foreground-muted hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Cards (Visible on screens < md / 390px) */}
          <div className="md:hidden space-y-3 font-mono text-xs">
            {paginatedData.map((item) => (
              <div
                key={item.id}
                className={`bg-card border border-border rounded-2xl p-4 shadow-lg space-y-3 ${
                  item.activo === false ? "opacity-80" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-foreground-muted block">
                      ORDEN #{item.orden_visual}
                    </span>
                    <h3 className="font-bold text-foreground text-sm">{item.nombre}</h3>
                    <span className="text-primary font-bold text-xs">{item.codigo}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      item.activo !== false
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {item.activo !== false ? "ACTIVO" : "DESACTIVADO"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-surface border-border text-foreground">
                    <Gauge size={11} className="text-primary" />
                    <span>{item.nivel_desgaste}% desgaste</span>
                  </span>

                  {item.requiere_revision && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <AlertTriangle size={11} />
                      <span>REVISIÓN</span>
                    </span>
                  )}
                </div>

                {item.descripcion && (
                  <p className="text-foreground-muted text-[11px] leading-relaxed">
                    {item.descripcion}
                  </p>
                )}

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                    <Wrench size={12} className="text-sky-400" />
                    <span>{item.component_count || 0} componentes</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {permissions.puede_editar && (
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                          item.activo !== false
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <Power size={12} />
                        <span>{item.activo !== false ? "Desactivar" : "Reactivar"}</span>
                      </button>
                    )}

                    {permissions.puede_editar && (
                      <button
                        onClick={() => handleOpenDrawer(item)}
                        className="p-1.5 bg-surface border border-border text-foreground font-bold rounded-lg hover:border-primary transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}

                    {permissions.puede_eliminar && (
                      <button
                        onClick={() => {
                          setItemToDelete(item);
                          setIsDeletingModalOpen(true);
                        }}
                        className="p-1.5 text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-lg hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs pt-2">
              <span className="text-foreground-muted">
                Mostrando {(page - 1) * itemsPerPage + 1} -{" "}
                {Math.min(page * itemsPerPage, sortedData.length)} de {sortedData.length} estados
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition-colors cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-2 text-foreground-muted">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface transition-colors cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Drawer Modal (createPortal) */}
      {mounted && isDrawerOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', justifyContent: 'flex-end' }} className="font-mono text-xs">
          {/* Overlay Backdrop */}
          <div
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => !isSaving && setIsDrawerOpen(false)}
          />

          {/* Side Drawer Content */}
          <div
            style={{
              position: 'relative',
              width: '560px',
              maxWidth: '95vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1000000
            }}
            className="bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="p-5 border-b border-border bg-surface flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingItem ? "Editar Estado de Componente" : "Registrar Nuevo Estado"}
                  </h2>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    {editingItem
                      ? "Modifique los parámetros técnicos del estado"
                      : "Complete los datos para agregar una nueva clasificación de condición técnica"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isSaving && setIsDrawerOpen(false)}
                className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-foreground-muted font-bold mb-1">
                  Código de Identificación <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ej: NUEVO, BUENO, DANADO"
                  className={`w-full bg-background border rounded-xl px-3 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary uppercase ${
                    errors.codigo ? "border-rose-500" : "border-border"
                  }`}
                />
                {errors.codigo && (
                  <span className="text-rose-400 text-[11px] mt-1 block flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.codigo}
                  </span>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-foreground-muted font-bold mb-1">
                  Nombre del Estado <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Desgaste Moderado"
                  className={`w-full bg-background border rounded-xl px-3 py-2.5 text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary ${
                    errors.nombre ? "border-rose-500" : "border-border"
                  }`}
                />
                {errors.nombre && (
                  <span className="text-rose-400 text-[11px] mt-1 block flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.nombre}
                  </span>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-foreground-muted font-bold mb-1">
                  Descripción Operativa
                </label>
                <textarea
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Explique las características que determinan este estado..."
                  className={`w-full bg-background border rounded-xl px-3 py-2 text-foreground placeholder-foreground-muted focus:outline-none focus:border-primary resize-none ${
                    errors.descripcion ? "border-rose-500" : "border-border"
                  }`}
                />
                {errors.descripcion && (
                  <span className="text-rose-400 text-[11px] mt-1 block flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.descripcion}
                  </span>
                )}
              </div>

              {/* Nivel de Desgaste (0-100) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-foreground-muted font-bold">
                    Nivel de Desgaste Estimado <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-primary font-bold text-xs">
                    {formData.nivel_desgaste}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.nivel_desgaste}
                    onChange={(e) => setFormData({ ...formData, nivel_desgaste: Number(e.target.value) })}
                    className="flex-1 accent-[#bfce7f] cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.nivel_desgaste}
                    onChange={(e) => setFormData({ ...formData, nivel_desgaste: e.target.value })}
                    className={`w-20 bg-background border rounded-xl px-3 py-2 text-foreground text-center focus:outline-none focus:border-primary ${
                      errors.nivel_desgaste ? "border-rose-500" : "border-border"
                    }`}
                  />
                </div>
                <span className="text-[10px] text-foreground-muted mt-1 block">
                  Porcentaje técnico de desgaste estimado (0% = Nuevo, 100% = Fin de vida útil).
                </span>
                {errors.nivel_desgaste && (
                  <span className="text-rose-400 text-[11px] mt-1 block flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.nivel_desgaste}
                  </span>
                )}
              </div>

              {/* Requiere Revisión */}
              <div className="p-3 bg-surface border border-border rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.requiere_revision}
                    onChange={(e) => setFormData({ ...formData, requiere_revision: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background"
                  />
                  <span className="font-bold text-foreground text-xs">Requiere Revisión Técnica</span>
                </label>
                <span className="text-[11px] text-foreground-muted block mt-1">
                  Marca de alerta técnica para indicar que las piezas con este estado deben ser evaluadas prioritariamente en el taller.
                </span>
              </div>

              {/* Orden Visual */}
              <div>
                <label className="block text-foreground-muted font-bold mb-1">
                  Orden de Visualización <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.orden_visual}
                  onChange={(e) => setFormData({ ...formData, orden_visual: e.target.value })}
                  className={`w-full bg-background border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary ${
                    errors.orden_visual ? "border-rose-500" : "border-border"
                  }`}
                />
                <span className="text-[10px] text-foreground-muted mt-1 block">
                  Posición relativa en selectores del taller.
                </span>
                {errors.orden_visual && (
                  <span className="text-rose-400 text-[11px] mt-1 block flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.orden_visual}
                  </span>
                )}
              </div>

              {/* Activo / Estado */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-background"
                  />
                  <span className="font-bold text-foreground text-xs">Estado Activo</span>
                </label>
                <span className="text-[11px] text-foreground-muted block mt-1">
                  Los estados desactivados no aparecen como opción para nuevas piezas de bicicleta.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground-muted hover:text-foreground font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>{editingItem ? "Actualizar Estado" : "Guardar Estado"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal (createPortal) */}
      {mounted && isDeletingModalOpen && itemToDelete && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} className="font-mono text-xs">
          <div
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => !isDeleting && setIsDeletingModalOpen(false)}
          />

          <div
            style={{ position: 'relative', width: '480px', maxWidth: '95vw', zIndex: 1000000 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Eliminar Estado</h3>
                <span className="text-[11px] text-foreground-muted">Confirmación de borrado en catálogo</span>
              </div>
            </div>

            <p className="text-foreground-muted leading-relaxed">
              ¿Estás seguro de que deseas eliminar el estado{" "}
              <strong className="text-foreground">{itemToDelete.nombre}</strong> (
              <span className="text-primary">{itemToDelete.codigo}</span>)?
            </p>

            {Number(itemToDelete.component_count || 0) > 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <AlertCircle size={14} /> Este estado tiene {itemToDelete.component_count} componente(s) vinculado(s).
                </span>
                <p className="text-amber-200/80">
                  La eliminación física está bloqueada para proteger la integridad histórica. Te sugerimos desactivarlo en su lugar.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-surface border border-border rounded-xl text-foreground-muted text-[11px] flex items-center gap-2">
                <Info size={14} className="text-primary shrink-0" />
                <span>Este estado no tiene componentes vinculados y puede eliminarse de forma segura.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeletingModalOpen(false);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 rounded-xl border border-border bg-surface text-foreground-muted hover:text-foreground font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                <span>Eliminar Estado</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
