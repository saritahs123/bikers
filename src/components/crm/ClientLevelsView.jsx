"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Award,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  Save,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Percent,
  Users,
  Eye,
  Lock
} from "lucide-react";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function ClientLevelsView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("porciento_descuento");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // Permisos RBAC efectivos (Fase 6.4.13: Fail-safe defaults)
  const [permissions, setPermissions] = useState({
    puede_ver: false,
    puede_crear: false,
    puede_editar: false,
    puede_eliminar: false,
    puede_exportar: false
  });

  // Drawer / Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    porciento_descuento: 0,
    descripcion: "",
    activo: true
  });
  const [nameError, setNameError] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/niveles-cliente");
      if (res.ok) {
        const permVer = res.headers.get("x-perm-ver");
        const permCrear = res.headers.get("x-perm-crear");
        const permEditar = res.headers.get("x-perm-editar");
        const permEliminar = res.headers.get("x-perm-eliminar");
        const permExportar = res.headers.get("x-perm-exportar");

        if (permVer !== null) {
          setPermissions({
            puede_ver: permVer !== "false",
            puede_crear: permCrear === "true",
            puede_editar: permEditar === "true",
            puede_eliminar: permEliminar === "true",
            puede_exportar: permExportar === "true"
          });
        }

        const json = await res.json();
        setData(json.data || []);
      }
    } catch (e) {
      console.error("Error fetching niveles de cliente:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchData();
  }, [fetchData]);

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const validateForm = () => {
    let isValid = true;
    const name = formData.nombre.trim();
    if (!name) {
      setNameError("El nombre del nivel es obligatorio.");
      isValid = false;
    } else if (name.length < 2 || name.length > 100) {
      setNameError("El nombre debe tener entre 2 y 100 caracteres.");
      isValid = false;
    } else {
      setNameError("");
    }

    const disc = Number(formData.porciento_descuento);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      setDiscountError("El descuento debe estar entre 0% y 100%.");
      isValid = false;
    } else {
      setDiscountError("");
    }

    return isValid;
  };

  const handleOpenCreate = () => {
    if (!permissions.puede_crear) {
      showToast("No tienes permisos para crear niveles de cliente.", "error");
      return;
    }
    setEditingItem(null);
    setFormData({
      nombre: "",
      porciento_descuento: 0,
      descripcion: "",
      activo: true
    });
    setNameError("");
    setDiscountError("");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    if (!permissions.puede_editar && !permissions.puede_ver) {
      showToast("No tienes permisos para consultar o editar niveles de cliente.", "error");
      return;
    }
    setEditingItem(item);
    setFormData({
      nombre: item.nombre || "",
      porciento_descuento: Number(item.porciento_descuento || 0),
      descripcion: item.descripcion || "",
      activo: item.activo !== false
    });
    setNameError("");
    setDiscountError("");
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingItem && !permissions.puede_editar) {
      showToast("No tienes permisos para modificar niveles de cliente.", "error");
      return;
    }
    if (!editingItem && !permissions.puede_crear) {
      showToast("No tienes permisos para crear niveles de cliente.", "error");
      return;
    }

    if (!validateForm()) return;

    try {
      setIsSaving(true);
      const url = editingItem
        ? `/api/crm/niveles-cliente/${editingItem.nivel_cliente_id}`
        : "/api/crm/niveles-cliente";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Error al procesar el nivel de cliente");
      }

      showToast(editingItem ? "Nivel actualizado exitosamente" : "Nivel creado exitosamente");
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message || "Error al guardar el nivel", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (item) => {
    if (!permissions.puede_eliminar) {
      showToast("No tienes permisos para eliminar niveles de cliente.", "error");
      return;
    }
    setItemToDelete(item);
    setIsDeletingModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (!permissions.puede_eliminar) {
      showToast("No tienes permisos para eliminar niveles de cliente.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/crm/niveles-cliente/${itemToDelete.nivel_cliente_id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Error al eliminar nivel");
      }
      showToast(json.message || "Nivel eliminado correctamente");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.message || "Error al eliminar nivel", "error");
    }
  };

  // Sorting & Filtering
  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        (item.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.descripcion || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "Todos"
          ? true
          : statusFilter === "Activos"
          ? item.activo === true
          : item.activo === false;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, page, itemsPerPage]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 font-mono text-xs border animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
          }`}
        >
          {toastMessage.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-500 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              Niveles de Clientes
            </h1>
            <p className="text-xs text-foreground-muted font-mono mt-0.5">
              Gestión del catálogo de niveles de clientes y porcentajes de descuento
            </p>
          </div>
        </div>

        {permissions.puede_crear && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-mono text-xs font-bold uppercase rounded-xl transition-all shadow-md shadow-primary/20 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Nivel</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-disabled" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-mono text-xs">
          <span className="text-foreground-muted text-[11px]">Estado:</span>
          {["Todos", "Activos", "Inactivos"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-primary/10 border-primary/40 text-primary font-bold"
                  : "bg-surface-subtle border-border text-foreground-muted hover:text-foreground hover:bg-hover"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            type="button"
            onClick={fetchData}
            title="Refrescar lista"
            className="p-2 bg-surface-subtle hover:bg-hover border border-border rounded-lg text-foreground-muted hover:text-foreground transition-colors cursor-pointer ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-subtle select-none font-mono text-[11px] text-foreground-secondary uppercase tracking-wider">
                <th
                  onClick={() => handleSort("nombre")}
                  className="py-3.5 px-4 font-bold cursor-pointer hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nombre del Nivel</span>
                    {sortColumn === "nombre" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("porciento_descuento")}
                  className="py-3.5 px-4 font-bold cursor-pointer hover:text-primary transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Descuento (%)</span>
                    {sortColumn === "porciento_descuento" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 font-bold">Descripción</th>
                <th className="py-3.5 px-4 font-bold text-center">Clientes Asignados</th>
                <th
                  onClick={() => handleSort("activo")}
                  className="py-3.5 px-4 font-bold cursor-pointer hover:text-primary transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Estado</span>
                    {sortColumn === "activo" ? (
                      sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-foreground-muted font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Cargando niveles de clientes...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-foreground-disabled font-mono">
                    No se encontraron niveles de clientes configurados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.nivel_cliente_id} className="hover:bg-hover transition-colors group">
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        <span>{item.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-500">
                      {item.porciento_descuento > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                          {item.porciento_descuento}%
                        </span>
                      ) : (
                        <span className="text-foreground-muted font-medium">0%</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-foreground-muted max-w-xs truncate">
                      {item.descripcion || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-subtle border border-border text-foreground-secondary text-[11px]">
                        <Users className="w-3 h-3 text-foreground-muted" />
                        {item.clientes_count || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border ${
                          item.activo
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                            : "bg-surface-subtle border-border text-foreground-disabled"
                        }`}
                      >
                        {item.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {permissions.puede_editar && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg border border-border bg-surface-subtle hover:bg-hover text-foreground-secondary hover:text-foreground transition-colors cursor-pointer"
                            title="Editar nivel"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!permissions.puede_editar && permissions.puede_ver && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg border border-border bg-surface-subtle hover:bg-hover text-foreground-secondary hover:text-foreground transition-colors cursor-pointer"
                            title="Consultar nivel"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.puede_eliminar && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 rounded-lg border border-border bg-surface-subtle hover:bg-rose-500/10 hover:border-rose-500/30 text-foreground-secondary hover:text-rose-500 transition-colors cursor-pointer"
                            title="Eliminar o desactivar nivel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs font-mono bg-surface-subtle">
            <span className="text-foreground-muted">
              Página {page} de {totalPages} ({sortedData.length} registros)
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal / Drawer Crear o Editar */}
      {isDrawerOpen && (() => {
        const canSave = editingItem ? permissions.puede_editar : permissions.puede_crear;
        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transition-colors">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-500">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground font-mono">
                        {editingItem ? (canSave ? "Editar Nivel de Cliente" : "Consultar Nivel de Cliente") : "Crear Nivel de Cliente"}
                      </h3>
                      {!canSave && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                          <Lock className="w-3 h-3" />
                          <span>Solo Lectura</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-muted font-mono">
                      {editingItem ? `Nivel #${editingItem.nivel_cliente_id}` : "Nuevo registro en catálogo"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-mono font-bold text-foreground mb-1 uppercase tracking-wider">
                    Nombre del Nivel *
                  </label>
                  <input
                    type="text"
                    disabled={!canSave}
                    readOnly={!canSave}
                    placeholder="Ej: VIP, DIAMANTE, INTERMEDIO, BÁSICO"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className={`w-full bg-surface-subtle border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${
                      !canSave ? "opacity-60 cursor-not-allowed border-border" : nameError ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {nameError && <p className="text-[11px] text-rose-500 font-mono mt-1">{nameError}</p>}
                </div>

                {/* Porcentaje de Descuento */}
                <div>
                  <label className="block text-xs font-mono font-bold text-foreground mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Porcentaje de Descuento (0% - 100%) *</span>
                    <span className="text-emerald-500 font-black">{formData.porciento_descuento}%</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        disabled={!canSave}
                        readOnly={!canSave}
                        value={formData.porciento_descuento}
                        onChange={(e) => setFormData(prev => ({ ...prev, porciento_descuento: e.target.value }))}
                        className={`w-full bg-surface-subtle border rounded-xl px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none transition-colors ${
                          !canSave ? "opacity-60 cursor-not-allowed border-border" : discountError ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-primary"
                        }`}
                      />
                      <Percent className="w-4 h-4 text-foreground-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    disabled={!canSave}
                    value={formData.porciento_descuento || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, porciento_descuento: Number(e.target.value) }))}
                    className={`w-full mt-2 accent-primary ${canSave ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  />
                  {discountError && <p className="text-[11px] text-rose-500 font-mono mt-1">{discountError}</p>}
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-mono font-bold text-foreground mb-1 uppercase tracking-wider">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canSave}
                    readOnly={!canSave}
                    placeholder="Detalles sobre beneficios, requisitos o aplicación del nivel..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                    className={`w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors ${
                      !canSave ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  />
                </div>

                {/* Estado Activo */}
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <div>
                    <span className="text-xs font-mono font-bold text-foreground block">Nivel Activo</span>
                    <span className="text-[11px] text-foreground-muted font-mono">
                      Los niveles inactivos no pueden asignarse a nuevos clientes ni otorgan descuento
                    </span>
                  </div>
                  <label className={`relative inline-flex items-center ${canSave ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <input
                      type="checkbox"
                      disabled={!canSave}
                      checked={formData.activo}
                      onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-subtle peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    disabled={isSaving}
                    className="px-4 py-2 text-xs font-mono font-bold text-foreground-muted hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer"
                  >
                    {canSave ? "Cancelar" : "Cerrar"}
                  </button>
                  {canSave && (
                    <button
                      type="submit"
                      disabled={isSaving || !!nameError || !formData.nombre.trim()}
                      className="px-5 py-2 text-xs font-mono font-bold text-primary-foreground bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{editingItem ? "Actualizar Nivel" : "Guardar Nivel"}</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Confirmar Eliminación */}
      <SecurityConfirmDialog
        isOpen={isDeletingModalOpen}
        onClose={() => {
          setIsDeletingModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Nivel de Cliente?"
        message={`¿Estás seguro de que deseas eliminar el nivel "${itemToDelete?.nombre}"? Si hay clientes asociados, el nivel se desactivará automáticamente para preservar la integridad histórica.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
