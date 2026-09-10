"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Tag,
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
  Package
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function ProductTypesView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("nombre");
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

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    estado: "ACTIVO"
  });

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
      const res = await fetch("/api/inventario/tipos-producto");
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
        showToast("Error al cargar los tipos de producto.", "error");
      }
    } catch (err) {
      console.error("Error fetching tipos-producto:", err);
      showToast("Error de conexión al cargar tipos de producto.", "error");
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
    const codRes = validateRequiredText(formData.codigo, "El Código del Tipo de Producto", 50);
    if (!codRes.isValid) errs.codigo = codRes.message;

    const nomRes = validateRequiredText(formData.nombre, "El Nombre del Tipo de Producto", 100);
    if (!nomRes.isValid) errs.nombre = nomRes.message;

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
        estado: item.estado || "ACTIVO"
      });
    } else {
      setEditingItem(null);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
        estado: "ACTIVO"
      });
    }
    setErrors({});
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm() || isSaving) return;

    setIsSaving(true);
    try {
      const url = editingItem
        ? `/api/inventario/tipos-producto/${editingItem.id}`
        : "/api/inventario/tipos-producto";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json.message || "Error al guardar el tipo de producto.", "error");
        return;
      }

      showToast(editingItem ? "Tipo de producto actualizado exitosamente." : "Tipo de producto creado exitosamente.");
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving tipo-producto:", err);
      showToast("Error de conexión al guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const nextEstado = item.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
      const res = await fetch(`/api/inventario/tipos-producto/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion,
          estado: nextEstado
        })
      });

      if (res.ok) {
        showToast(`Estado cambiado a ${nextEstado}.`);
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
      const res = await fetch(`/api/inventario/tipos-producto/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.message || "Tipo de producto eliminado exitosamente.");
        setIsDeletingModalOpen(false);
        setItemToDelete(null);
        fetchData();
      } else {
        showToast(json.message || "Error al eliminar tipo de producto.", "error");
        setIsDeletingModalOpen(false);
      }
    } catch (err) {
      console.error("Error deleting tipo-producto:", err);
      showToast("Error de conexión al eliminar.", "error");
      setIsDeletingModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and sort
  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      item.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      item.descripcion?.toLowerCase().includes(search.toLowerCase());

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
              <Tag size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Tipos de Producto</h1>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border border-border text-foreground-muted bg-surface">
                  Catálogo Global
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                Clasificación de alto nivel para inventario y taller (Repuestos, Accesorios, Bicicletas, etc.)
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
              <span>Nuevo Tipo</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-muted">Total Tipos</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{data.length}</p>
          </div>
          <div className="p-3 bg-surface rounded-xl text-foreground-muted border border-border">
            <Tag size={18} />
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
            placeholder="Buscar por código, nombre o descripción..."
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
            <span>Cargando catálogo de tipos de producto...</span>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted flex flex-col items-center gap-2">
            <Tag size={32} className="opacity-30" />
            <p className="text-sm font-medium text-foreground">No hay tipos de producto registrados.</p>
            <p className="text-xs">
              {search || statusFilter !== "Todos"
                ? "No se encontraron resultados para los filtros aplicados."
                : "Comienza registrando tu primer tipo de producto con el botón 'Nuevo Tipo'."}
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
                      if (sortColumn === "codigo") setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortColumn("codigo");
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
                      if (sortColumn === "nombre") setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortColumn("nombre");
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>NOMBRE</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-3.5">DESCRIPCIÓN</th>
                  <th className="p-3.5 text-center">PRODUCTOS</th>
                  <th className="p-3.5 text-center">ESTADO</th>
                  <th className="p-3.5 pr-5 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item) => (
                  <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3.5 pl-5 font-mono font-medium text-foreground">{item.codigo}</td>
                    <td className="p-3.5 font-medium text-foreground">{item.nombre}</td>
                    <td className="p-3.5 text-foreground-secondary max-w-xs truncate">{item.descripcion || "—"}</td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface border border-border text-foreground-secondary">
                        {item.total_productos}
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
                              title={item.estado === "ACTIVO" ? "Inactivar tipo" : "Activar tipo"}
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
                              title="Editar tipo"
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
                            title="Eliminar tipo de producto"
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
              Mostrando {paginatedData.length} de {sortedData.length} tipos filtrados
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

      {/* Drawer: Crear / Editar Tipo */}
      {mounted && isDrawerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => !isSaving && setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col font-sans">
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface-subtle">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                    <Tag size={20} />
                  </div>
                  <div>
                    <h2 className="font-mono text-base font-bold text-foreground">
                      {editingItem ? "Editar Tipo de Producto" : "Nuevo Tipo de Producto"}
                    </h2>
                    <p className="font-mono text-xs text-foreground-muted">
                      {editingItem ? `ID: ${editingItem.id} • ${editingItem.codigo}` : "Catálogo maestro global"}
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

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Código <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej. REP, ACC, BIC"
                    className={`w-full px-3 py-2 text-xs bg-input border rounded-xl font-mono text-foreground focus:outline-none transition-all ${
                      errors.codigo ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.codigo && <p className="text-[11px] text-rose-400 mt-1">{errors.codigo}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Nombre <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Repuesto, Accesorio, Bicicleta Completa"
                    className={`w-full px-3 py-2 text-xs bg-input border rounded-xl text-foreground focus:outline-none transition-all ${
                      errors.nombre ? "border-rose-500" : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.nombre && <p className="text-[11px] text-rose-400 mt-1">{errors.nombre}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Descripción</label>
                  <textarea
                    rows={3}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción funcional de este tipo de producto..."
                    className="w-full px-3 py-2 text-xs bg-input border border-border rounded-xl text-foreground focus:outline-none focus:border-primary transition-all resize-none"
                  />
                </div>

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
                  <span>{isSaving ? "Guardando..." : "Guardar Tipo"}</span>
                </button>
              </div>
            </div>
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
        title="¿Eliminar Tipo de Producto?"
        description={`¿Está seguro de que desea eliminar el tipo de producto "${itemToDelete?.nombre || ''}"? Esta acción no se puede deshacer si no posee productos vinculados.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
        loadingLabel="Eliminando..."
        details={itemToDelete ? [
          { label: 'Tipo de Producto', value: itemToDelete.nombre },
          { label: 'Código', value: itemToDelete.codigo, isCode: true },
          { label: 'Productos Asociados', value: String(itemToDelete.total_productos || 0) }
        ] : null}
      />
    </div>
  );
}
