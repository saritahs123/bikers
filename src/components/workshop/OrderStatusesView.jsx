"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  GitCommit, 
  Search, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Save, 
  RefreshCw, 
  Shield, 
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Lock,
  Workflow,
  Sparkles
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

const PRESET_COLORS = [
  "#64748B", // Slate
  "#3B82F6", // Blue
  "#EAB308", // Yellow
  "#F97316", // Orange
  "#84924A", // Olive Green (Ride Lab)
  "#8B5CF6", // Purple
  "#22C55E", // Green
  "#16A34A", // Emerald
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#EF4444", // Red
  "#6366F1"  // Indigo
];

export default function OrderStatusesView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("orden_visual");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // RBAC Permissions header state
  const [permissions, setPermissions] = useState({
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_eliminar: true
  });

  // Drawer / Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    color_estado: "#64748B",
    orden_visual: 0,
    permite_edicion: true,
    activo: true
  });

  const [formErrors, setFormErrors] = useState({});
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/taller/estados-orden");
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);

        setPermissions({
          puede_ver: res.headers.get("x-perm-ver") !== "false",
          puede_crear: res.headers.get("x-perm-crear") === "true",
          puede_editar: res.headers.get("x-perm-editar") === "true",
          puede_eliminar: res.headers.get("x-perm-eliminar") === "true"
        });
      }
    } catch (e) {
      console.error("Error fetching estados de orden:", e);
      showToast("Error de conexión al obtener los estados de orden.", "error");
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
    const isCanonical = editingItem?.es_estructural;

    // Validate Codigo (for non-canonical states or creation)
    if (!isCanonical) {
      const codeRes = validateRequiredText(formData.codigo, "El Código", 50);
      if (!codeRes.isValid) {
        errs.codigo = codeRes.message;
      } else if (!/^[A-Z0-9_-]+$/.test(formData.codigo.trim().toUpperCase())) {
        errs.codigo = "El código solo puede contener mayúsculas, números, guiones y guiones bajos.";
      }
    }

    // Validate Nombre
    const nameRes = validateRequiredText(formData.nombre, "El Nombre", 100);
    if (!nameRes.isValid) {
      errs.nombre = nameRes.message;
    }

    // Validate Descripcion
    if (formData.descripcion && formData.descripcion.length > 300) {
      errs.descripcion = "La descripción no puede superar los 300 caracteres.";
    }

    // Validate Orden Visual
    if (
      formData.orden_visual === "" ||
      formData.orden_visual === null ||
      isNaN(Number(formData.orden_visual)) ||
      Number(formData.orden_visual) < 0
    ) {
      errs.orden_visual = "El orden visual debe ser un número entero mayor o igual a cero.";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    const nextOrder = data.length > 0
      ? Math.max(...data.map(d => Number(d.orden_visual) || 0)) + 1
      : 1;

    setFormData({
      codigo: "",
      nombre: "",
      descripcion: "",
      color_estado: "#64748B",
      orden_visual: nextOrder,
      permite_edicion: true,
      activo: true
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      codigo: item.codigo || "",
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      color_estado: item.color_estado || "#64748B",
      orden_visual: item.orden_visual !== undefined ? item.orden_visual : 0,
      permite_edicion: item.permite_edicion !== undefined ? Boolean(item.permite_edicion) : true,
      activo: item.activo !== false
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      showToast("Por favor corrige los campos indicados.", "error");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        codigo: (formData.codigo || "").trim().toUpperCase(),
        nombre: (formData.nombre || "").trim(),
        descripcion: (formData.descripcion || "").trim() || null,
        color_estado: formData.color_estado || "#64748B",
        orden_visual: parseInt(formData.orden_visual, 10) || 0,
        permite_edicion: Boolean(formData.permite_edicion),
        activo: Boolean(formData.activo)
      };

      if (editingItem) {
        const res = await fetch(`/api/taller/estados-orden/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.message || resData.error || "Error al actualizar el estado de orden.");
        }
        showToast("Estado de orden actualizado correctamente.");
      } else {
        const res = await fetch("/api/taller/estados-orden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.message || resData.error || "Error al crear el estado de orden.");
        }
        showToast("Estado de orden creado exitosamente.");
      }

      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save error:", err);
      showToast(err.message || "Error al procesar la solicitud.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/taller/estados-orden/${itemToDelete.id}`, {
        method: "DELETE"
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || resData.error || "No se pudo eliminar el estado de orden.");
      }

      showToast("Estado de orden eliminado correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      showToast(err.message || "Error al eliminar el estado.", "error");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
    }
  };

  // Sorting and Filtering
  const filteredData = data.filter((item) => {
    const matchesSearch =
      (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.codigo || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.descripcion || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Activos" && item.activo === true) ||
      (statusFilter === "Inactivos" && item.activo === false);

    return matchesSearch && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    if (sortColumn === "orden_visual" || sortColumn === "id" || sortColumn === "estado_orden_id") {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    aVal = (aVal || "").toString().toLowerCase();
    bVal = (bVal || "").toString().toLowerCase();
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-mono backdrop-blur-md ${
            toastMessage.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-950/50"
              : "bg-surface text-foreground border-primary/40 shadow-slate-950/50"
          }`}>
            {toastMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="font-semibold">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                ESTADOS DE ORDEN DE TRABAJO
              </h1>
              <p className="text-xs text-foreground-muted font-mono mt-0.5">
                Configuración y catálogo de estados del flujo de órdenes de taller.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-surface-muted hover:bg-hover border border-border text-foreground-muted hover:text-foreground rounded-xl text-xs transition-colors cursor-pointer"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
            <button
              onClick={handleOpenCreate}
              disabled={!permissions.puede_crear}
              className={`flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold font-mono text-xs rounded-xl shadow-sm transition-all ${
                permissions.puede_crear
                  ? "hover:bg-primary-hover cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>NUEVO ESTADO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Functional Notice */}
      <div className="bg-surface border border-border/80 rounded-2xl p-4 flex items-start gap-3 text-xs font-sans text-foreground-muted shadow-sm">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          <strong className="text-foreground font-semibold">Nota informativa:</strong> Los estados adicionales creados en este catálogo no forman parte automáticamente de las transiciones operativas del Taller.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-muted border border-border rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["Todos", "Activos", "Inactivos"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-surface-muted hover:bg-hover text-foreground-muted hover:text-foreground border border-border"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-surface-muted/60 border-b border-border text-foreground-muted font-mono text-[11px] uppercase tracking-wider">
                <th
                  onClick={() => handleSort("orden_visual")}
                  className="p-3.5 pl-4 cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Orden</span>
                    {sortColumn === "orden_visual" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("codigo")}
                  className="p-3.5 cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Código</span>
                    {sortColumn === "codigo" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("nombre")}
                  className="p-3.5 cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Nombre / Color</span>
                    {sortColumn === "nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3.5">Descripción</th>
                <th className="p-3.5 text-center">Tipo / Flujo</th>
                <th className="p-3.5 text-center">Permite Edición</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 pr-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-foreground-muted italic font-sans text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Cargando estados de orden de trabajo...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-foreground-muted italic font-sans text-xs">
                    No se encontraron estados de orden que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-surface-muted/40 transition-colors">
                      {/* Orden Visual */}
                      <td className="p-3.5 pl-4 font-bold text-foreground-muted whitespace-nowrap">
                        #{item.orden_visual}
                      </td>

                      {/* Código */}
                      <td className="p-3.5 font-bold text-primary whitespace-nowrap">
                        {item.codigo}
                      </td>

                      {/* Nombre con Badge de Color */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-sm"
                            style={{ backgroundColor: item.color_estado || "#64748B" }}
                          />
                          <span className="font-bold font-sans text-foreground">{item.nombre}</span>
                        </div>
                      </td>

                      {/* Descripción */}
                      <td className="p-3.5 text-foreground-muted text-[11px] font-sans max-w-xs truncate">
                        {item.descripcion || <span className="italic text-foreground-muted/60">Sin descripción</span>}
                      </td>

                      {/* Tipo / Flujo */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {item.estado_inicial ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                            INICIAL
                          </span>
                        ) : item.estado_final ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            FINAL
                          </span>
                        ) : (
                          <span className="text-[10px] text-foreground-muted">Proceso</span>
                        )}
                      </td>

                      {/* Permite Edición */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {item.permite_edicion ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            SÍ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            BLOQUEADO
                          </span>
                        )}
                      </td>

                      {/* Estado Activo */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {item.activo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted text-foreground-muted border border-border text-[10px] font-bold">
                            <XCircle className="w-3 h-3" /> INACTIVO
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 pr-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            disabled={!permissions.puede_editar}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              permissions.puede_editar
                                ? "bg-surface-muted hover:bg-hover border-border text-foreground cursor-pointer"
                                : "opacity-40 cursor-not-allowed border-transparent text-foreground-muted"
                            }`}
                            title="Editar estado"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setIsDeletingModalOpen(true);
                            }}
                            disabled={!permissions.puede_eliminar || item.es_estructural}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.es_estructural
                                ? "opacity-30 cursor-not-allowed bg-surface-muted border-border text-foreground-muted"
                                : permissions.puede_eliminar
                                ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 cursor-pointer"
                                : "opacity-40 cursor-not-allowed border-transparent text-foreground-muted"
                            }`}
                            title={
                              item.es_estructural
                                ? "Este estado del sistema está protegido contra eliminación"
                                : "Eliminar estado"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border bg-surface-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-foreground-muted">
          <span>
            Mostrando <strong>{paginatedData.length}</strong> de <strong>{filteredData.length}</strong> estados
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span>
              Página <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Modal for Create / Edit */}
      {mounted && isDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSaving && setIsDrawerOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-surface border-l border-border h-full flex flex-col z-10 shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted/40">
              <div className="flex items-center gap-2.5">
                <Workflow className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">
                    {editingItem ? "EDITAR ESTADO DE ORDEN" : "NUEVO ESTADO DE ORDEN"}
                  </h3>
                  <p className="text-[11px] text-foreground-muted font-mono">
                    {editingItem ? `Modificando registro #${editingItem.id}` : "Registrar nuevo estado de orden"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                disabled={isSaving}
                className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg hover:bg-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 text-xs font-mono">
              {editingItem?.es_estructural && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-amber-300 text-[11px]">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Estado del Sistema Protegido:</strong> El código y las propiedades principales de este estado están protegidos para asegurar la integridad operativa del taller.
                  </div>
                </div>
              )}

              {/* Codigo */}
              <div className="space-y-1.5">
                <label className="block text-foreground font-semibold flex items-center justify-between">
                  <span>CÓDIGO <span className="text-rose-400">*</span></span>
                  {editingItem?.es_estructural && (
                    <span className="text-[10px] text-amber-400 font-normal">Solo Lectura</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  disabled={editingItem?.es_estructural || isSaving}
                  placeholder="EJ: EN_ESPERA, PRESUPUESTADA"
                  className={`w-full bg-surface-muted border rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase transition-colors ${
                    editingItem?.es_estructural
                      ? "opacity-60 cursor-not-allowed border-border text-foreground-muted bg-surface"
                      : formErrors.codigo
                      ? "border-rose-500 focus:border-rose-500 text-foreground"
                      : "border-border focus:border-primary text-foreground"
                  }`}
                />
                {formErrors.codigo && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-sans mt-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.codigo}
                  </p>
                )}
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="block text-foreground font-semibold">
                  NOMBRE VISUAL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  disabled={isSaving}
                  placeholder="EJ: En Espera de Piezas"
                  className={`w-full bg-surface-muted border rounded-xl px-3.5 py-2.5 text-xs font-sans transition-colors ${
                    formErrors.nombre ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary text-foreground"
                  }`}
                />
                {formErrors.nombre && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-sans mt-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.nombre}
                  </p>
                )}
              </div>

              {/* Color Estado */}
              <div className="space-y-2">
                <label className="block text-foreground font-semibold">
                  COLOR DEL BADGE / IDENTIFICADOR
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl shrink-0 border border-white/20 shadow-md flex items-center justify-center text-white"
                    style={{ backgroundColor: formData.color_estado }}
                  >
                    <Sparkles className="w-3.5 h-3.5 opacity-80" />
                  </div>
                  <input
                    type="text"
                    value={formData.color_estado}
                    onChange={(e) => setFormData({ ...formData, color_estado: e.target.value.toUpperCase() })}
                    placeholder="#64748B"
                    className="w-32 bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground uppercase focus:border-primary"
                  />
                  <span className="text-[11px] text-foreground-muted font-sans">
                    Formato hexadecimal
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_estado: c })}
                      className={`w-6 h-6 rounded-lg transition-transform hover:scale-110 border ${
                        formData.color_estado === c ? "border-white scale-110 shadow-md ring-2 ring-primary/40" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Orden Visual */}
              <div className="space-y-1.5">
                <label className="block text-foreground font-semibold">
                  ORDEN VISUAL (POSICIÓN) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.orden_visual}
                  onChange={(e) => setFormData({ ...formData, orden_visual: e.target.value })}
                  disabled={isSaving}
                  className={`w-full bg-surface-muted border rounded-xl px-3.5 py-2.5 text-xs font-mono transition-colors ${
                    formErrors.orden_visual ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary text-foreground"
                  }`}
                />
                {formErrors.orden_visual && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-sans mt-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.orden_visual}
                  </p>
                )}
              </div>

              {/* Descripcion */}
              <div className="space-y-1.5">
                <label className="block text-foreground font-semibold">
                  DESCRIPCIÓN OPERATIVA
                </label>
                <textarea
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  disabled={isSaving}
                  placeholder="Explicación del estado dentro del ciclo de vida de la orden..."
                  className="w-full bg-surface-muted border border-border rounded-xl px-3.5 py-2.5 text-xs font-sans text-foreground focus:border-primary transition-colors resize-none"
                />
                {formErrors.descripcion && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-sans mt-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.descripcion}
                  </p>
                )}
              </div>

              {/* Permite Edicion & Activo Toggles */}
              <div className="pt-2 border-t border-border space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="font-bold text-foreground">Permite Edición</span>
                    <p className="text-[10px] text-foreground-muted font-sans mt-0.5">
                      Determina si las órdenes en este estado pueden ser modificadas técnicamente.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.permite_edicion}
                    onChange={(e) => setFormData({ ...formData, permite_edicion: e.target.checked })}
                    disabled={isSaving}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="font-bold text-foreground">Estado Activo</span>
                    <p className="text-[10px] text-foreground-muted font-sans mt-0.5">
                      Disponible para selección y visualización en filtros del sistema.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    disabled={
                      isSaving ||
                      (editingItem?.es_estructural && [1, 5, 7, 8].includes(Number(editingItem.id)))
                    }
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-border bg-surface-muted/40 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-hover text-foreground-muted hover:text-foreground font-mono text-xs transition-colors cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold font-mono text-xs rounded-xl shadow-sm hover:bg-primary-hover transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>GUARDANDO...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>GUARDAR ESTADO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Delete */}
      <SecurityConfirmDialog
        isOpen={isDeletingModalOpen}
        onClose={() => {
          setIsDeletingModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="ELIMINAR ESTADO DE ORDEN"
        message={`¿Estás seguro de que deseas eliminar permanentemente el estado "${itemToDelete?.nombre || ''}" (${itemToDelete?.codigo || ''})? Esta acción verificará primero que no existan órdenes ni historial vinculados.`}
        confirmText="ELIMINAR ESTADO"
        type="danger"
      />
    </div>
  );
}
