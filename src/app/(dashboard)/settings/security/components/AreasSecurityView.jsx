"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Layers, 
  Search, 
  Download, 
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
  AlertCircle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function AreasSecurityView() {
  const [data, setData] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;
  const [mounted, setMounted] = useState(false);

  // Drawer / Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    departamento_id: "",
    nombre: "",
    estado: "ACTIVO"
  });
  const [nameError, setNameError] = useState("");
  const [deptError, setDeptError] = useState("");
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
    fetchDepartamentos();
  }, []);

  const validateForm = (nombreVal = formData.nombre, deptVal = formData.departamento_id) => {
    let valid = true;
    const nameRes = validateRequiredText(nombreVal, "El Nombre del Área", 100);
    if (!nameRes.isValid) {
      setNameError(nameRes.message);
      valid = false;
    } else {
      setNameError("");
    }

    if (!deptVal) {
      setDeptError("Debe seleccionar un Departamento.");
      valid = false;
    } else {
      setDeptError("");
    }

    return valid;
  };

  const handleNameChange = (val) => {
    setFormData(prev => ({ ...prev, nombre: val }));
    validateForm(val, formData.departamento_id);
  };

  const handleDeptChange = (val) => {
    setFormData(prev => ({ ...prev, departamento_id: val }));
    validateForm(formData.nombre, val);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/areas');
      if (res.ok) {
        const result = await res.json();
        setData(result || []);
      }
    } catch (e) {
      console.error("Error fetching areas:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartamentos = async () => {
    try {
      const res = await fetch('/api/departamentos');
      if (res.ok) {
        const result = await res.json();
        setDepartamentos(result || []);
      }
    } catch (e) {
      console.error("Error fetching departamentos:", e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      departamento_id: "",
      nombre: "",
      estado: "ACTIVO"
    });
    setNameError("");
    setDeptError("");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      departamento_id: item.departamento_id || "",
      nombre: item.nombre || "",
      estado: item.estado ? item.estado.toUpperCase() : "ACTIVO"
    });
    validateForm(item.nombre || "", item.departamento_id || "");
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      showToast("Complete los campos obligatorios.");
      return;
    }

    const cleanNombre = (formData.nombre || '').trim();

    try {
      setIsSaving(true);
      const payload = {
        departamento_id: Number(formData.departamento_id),
        nombre: cleanNombre,
        estado: formData.estado
      };

      if (editingItem) {
        const res = await fetch(`/api/areas/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al actualizar el área.");
        }
        showToast("Área actualizada correctamente.");
      } else {
        const res = await fetch('/api/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al registrar el área.");
        }
        showToast("Área creada correctamente.");
      }

      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving area:", err);
      showToast(err.message || "Error al procesar la solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/areas/${itemToDelete.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo eliminar el área.");
      }

      showToast("Área eliminada correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting area:", err);
      showToast(err.message || "Error al eliminar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const exportToExcel = () => {
    if (!data || data.length === 0) {
      showToast("No hay datos para exportar.");
      return;
    }

    const headers = ["ID", "Departamento", "Nombre del Area", "Estado", "Fecha Creacion", "Fecha Actualizacion"];
    const rows = filteredData.map(item => [
      item.id,
      `"${(item.departamento_nombre || "").replace(/"/g, '""')}"`,
      `"${(item.nombre || "").replace(/"/g, '""')}"`,
      `"${item.estado || ""}"`,
      `"${item.fecha_creacion || ""}"`,
      `"${item.fecha_actualizacion || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Areas_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Archivo CSV de Áreas exportado.");
  };

  // Filtered dataset
  const filteredData = data.filter(item => {
    const s = (search || "").trim().toLowerCase();

    const matchesSearch = !s || [
      item.id,
      item.nombre,
      item.departamento_nombre,
      item.estado
    ].some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(s));

    const itemStatus = (item.estado || "ACTIVO").toString().trim().toUpperCase();
    const filterStatus = (statusFilter || "Todos").toString().trim().toUpperCase();

    const matchesStatus = 
      filterStatus === "TODOS" || 
      (filterStatus === "ACTIVOS" && (itemStatus === "ACTIVO" || itemStatus === "ACTIVOS" || itemStatus === "1" || itemStatus === "TRUE")) ||
      (filterStatus === "INACTIVOS" && (itemStatus === "INACTIVO" || itemStatus === "INACTIVOS" || itemStatus === "0" || itemStatus === "FALSE"));

    return matchesSearch && matchesStatus;
  });

  const sortedData = React.useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (!sortColumn) return 0;
      let valA = a[sortColumn] ?? "";
      let valB = b[sortColumn] ?? "";

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== "" && String(valB).trim() !== "") {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === "asc" ? -1 : 1;
      if (strA > strB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const totalCount = data.length;
  const activeCount = data.filter(i => {
    const st = (i.estado || "").toString().trim().toUpperCase();
    return st === "ACTIVO" || st === "ACTIVOS" || st === "1" || st === "TRUE";
  }).length;
  const inactiveCount = data.filter(i => {
    const st = (i.estado || "").toString().trim().toUpperCase();
    return st === "INACTIVO" || st === "INACTIVOS" || st === "0" || st === "FALSE";
  }).length;

  const renderSortableHeader = (label, columnKey, extraClass = "") => {
    const isSorted = sortColumn === columnKey;
    return (
      <th 
        onClick={() => handleSort(columnKey)}
        className={`px-6 py-4 cursor-pointer select-none hover:text-foreground text-foreground-secondary transition-colors group/head ${extraClass}`}
      >
        <div className={`flex items-center gap-1.5 ${extraClass.includes('text-center') ? 'justify-center' : ''}`}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp size={13} className="text-primary shrink-0" />
            ) : (
              <ArrowDown size={13} className="text-primary shrink-0" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-foreground-disabled group-hover/head:text-foreground-muted opacity-50 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full space-y-6 font-sans text-foreground animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[999999] bg-primary text-primary-foreground px-5 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Main Action Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-subtle border border-border text-primary text-[11px] font-mono font-bold tracking-wider uppercase mb-2 shadow-sm">
            <Shield size={12} className="text-primary" />
            <span>Seguridad</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">Áreas</h1>
          <p className="text-sm text-foreground-muted mt-1">Gestión administrativa de áreas subordinadas a departamentos.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-surface-subtle hover:bg-hover border border-border text-foreground font-mono text-xs rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} className="text-primary" />
            <span>Exportar Excel</span>
          </button>

          <button 
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2 bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Crear Nueva</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div 
          onClick={() => { setStatusFilter("Todos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer transition-all border ${
            statusFilter === "Todos" ? "bg-primary/10 border-primary" : "bg-card border-border hover:border-primary/40"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-foreground-muted uppercase tracking-widest font-bold">Total Áreas</p>
            <p className="text-3xl font-black text-foreground font-mono mt-1">{String(totalCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-subtle border border-border flex items-center justify-center text-primary">
            <Layers size={24} />
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => { setStatusFilter("Activos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer transition-all border ${
            statusFilter === "Activos" ? "bg-success/10 border-success" : "bg-card border-border hover:border-success/40"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-foreground-muted uppercase tracking-widest font-bold">Activas</p>
            <p className="text-3xl font-black text-success font-mono mt-1">{String(activeCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center text-success">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => { setStatusFilter("Inactivos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer transition-all border ${
            statusFilter === "Inactivos" ? "bg-error/10 border-error" : "bg-card border-border hover:border-error/40"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-foreground-muted uppercase tracking-widest font-bold">Inactivas</p>
            <p className="text-3xl font-black text-error font-mono mt-1">{String(inactiveCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-error/15 border border-error/30 flex items-center justify-center text-error">
            <XCircle size={24} />
          </div>
        </div>
      </div>

      {/* Table Filter Bar */}
      <div className="bg-card border border-border p-4 rounded-t-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-2xl">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input 
            type="text"
            placeholder="Buscar por área, departamento o estado..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-input border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-foreground-muted font-bold">Filtrar por Estado:</span>
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-input border border-border rounded-xl px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          >
            <option value="Todos">Todos</option>
            <option value="Activos">Activos</option>
            <option value="Inactivos">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="border border-border bg-card rounded-b-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-subtle border-b border-border font-mono text-[11px] text-primary tracking-wider whitespace-nowrap">
                {renderSortableHeader("ID", "id")}
                {renderSortableHeader("Departamento", "departamento_nombre")}
                {renderSortableHeader("Nombre del Área", "nombre")}
                {renderSortableHeader("Estado", "estado", "text-center")}
                {renderSortableHeader("Fecha de Creación", "fecha_creacion")}
                {renderSortableHeader("Fecha de Actualización", "fecha_actualizacion")}
                <th className="px-6 py-4 text-right sticky right-0 bg-surface-subtle shadow-[-8px_0_12px_rgba(0,0,0,0.06)] z-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-foreground-muted font-mono">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    Cargando áreas...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-foreground-muted font-mono italic">
                    No se encontraron registros de áreas.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr 
                    key={item.id} 
                    className="group hover:bg-hover transition-colors whitespace-nowrap"
                  >
                    <td className="px-6 py-4 font-mono text-primary font-bold">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {item.departamento_nombre || "-"}
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium text-sm">
                      {item.nombre}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        (item.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-surface-subtle text-foreground-muted border-border"
                      }`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-foreground-muted">
                      {item.fecha_creacion ? String(item.fecha_creacion).substring(0, 10) : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-foreground-muted">
                      {item.fecha_actualizacion ? String(item.fecha_actualizacion).substring(0, 10) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-card group-hover:bg-hover shadow-[-8px_0_12px_rgba(0,0,0,0.06)] z-10 transition-colors">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 bg-surface hover:bg-primary/20 text-foreground-secondary hover:text-primary border border-border hover:border-primary/40 rounded-lg transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          className="p-2 bg-surface hover:bg-error/20 text-foreground-secondary hover:text-error border border-border hover:border-error/40 rounded-lg transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border bg-surface-subtle flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <p className="text-foreground-muted">
            Mostrando <span className="text-foreground font-bold">{paginatedData.length}</span> de <span className="text-foreground font-bold">{filteredData.length}</span> registros
          </p>
          
          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button 
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg font-bold transition-all cursor-pointer ${
                  page === p 
                    ? "bg-primary text-primary-foreground" 
                    : "border border-border bg-surface text-foreground-secondary hover:bg-hover hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
            <button 
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* PORTAL FOR SIDE DRAWER MODAL */}
      {mounted && isDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Side Drawer Card */}
          <div 
            style={{ 
              position: 'relative', 
              width: '540px', 
              maxWidth: '95vw', 
              height: '100vh', 
              display: 'flex', 
              flexDirection: 'column', 
              zIndex: 1000000 
            }}
            className="font-sans bg-surface-elevated border-l border-border shadow-2xl text-foreground"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-border bg-surface-subtle flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold font-sans text-foreground tracking-tight">
                  {editingItem ? "Editar Área" : "Nueva Área"}
                </h2>
                <p className="text-xs text-foreground-muted mt-0.5 font-sans">
                  {editingItem ? "Modifica los datos del área seleccionada." : "Completa los campos para registrar una nueva área."}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDrawerOpen(false)} 
                className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg hover:bg-hover transition-colors cursor-pointer"
                aria-label="Cerrar drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* DEPARTAMENTO SELECTOR */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                  DEPARTAMENTO *
                </label>
                <select
                  value={formData.departamento_id}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className={`w-full bg-input border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none transition-all ${
                    deptError ? "border-error focus:border-error" : "border-border focus:border-primary"
                  }`}
                >
                  <option value="">Seleccione un Departamento...</option>
                  {departamentos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
                {deptError && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                    <AlertCircle size={12} className="shrink-0 text-error" />
                    <span>{deptError}</span>
                  </div>
                )}
              </div>

              {/* NOMBRE DEL ÁREA */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                  NOMBRE DEL ÁREA *
                </label>
                <input 
                  type="text"
                  required
                  maxLength={100}
                  value={formData.nombre}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Taller Mecánico, Mostrador, Almacén"
                  className={`w-full bg-input border rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                    nameError ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                  }`}
                />
                {nameError && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                    <AlertCircle size={12} className="shrink-0 text-error" />
                    <span>{nameError}</span>
                  </div>
                )}
              </div>

              {/* ESTADO INICIAL */}
              <div className="space-y-1 pt-2">
                <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                  ESTADO INICIAL
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Activo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "ACTIVO" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      (formData.estado || "").toUpperCase() === "ACTIVO" 
                        ? "bg-primary/10 border-2 border-primary" 
                        : "bg-input border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      (formData.estado || "").toUpperCase() === "ACTIVO" 
                        ? "border-primary" 
                        : "border-foreground-muted"
                    }`}>
                      {(formData.estado || "").toUpperCase() === "ACTIVO" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">Activo</p>
                      <p className="text-[10px] text-foreground-muted mt-0.5">Visible en el sistema</p>
                    </div>
                  </div>

                  {/* Inactivo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "INACTIVO" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      (formData.estado || "").toUpperCase() === "INACTIVO" 
                        ? "bg-error/10 border-2 border-error" 
                        : "bg-input border-border hover:border-error/40"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      (formData.estado || "").toUpperCase() === "INACTIVO" 
                        ? "border-error" 
                        : "border-foreground-muted"
                    }`}>
                      {(formData.estado || "").toUpperCase() === "INACTIVO" && (
                        <div className="w-2 h-2 rounded-full bg-error" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">Inactivo</p>
                      <p className="text-[10px] text-foreground-muted mt-0.5">Oculto temporalmente</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Notice Box */}
              <div className="p-3 bg-surface-subtle border border-border rounded-xl flex items-center gap-2.5 mt-4">
                <Info size={16} className="text-primary shrink-0" />
                <p className="text-[11px] text-foreground-secondary leading-tight font-sans">
                  Las áreas permiten una subdivisión operativa dentro de los departamentos organizacionales.
                </p>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-surface-subtle flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-2.5 border border-border bg-surface text-foreground hover:bg-hover transition-all font-mono text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={isSaving || !!nameError || !!deptError || !formData.nombre.trim() || !formData.departamento_id}
                className="flex-1 py-2.5 bg-primary-button-bg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-mono text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE MODAL */}
      <SecurityConfirmDialog
        isOpen={mounted && isDeletingModalOpen && !!itemToDelete}
        onClose={() => setIsDeletingModalOpen(false)}
        onConfirm={handleDelete}
        variant="danger"
        title="¿Eliminar Área?"
        description={`¿Está seguro que desea eliminar permanentemente el área "${itemToDelete?.nombre || ''}"? Esta acción es irreversible.`}
        confirmLabel="Eliminar"
        isLoading={isSaving}
        loadingLabel="Eliminando..."
        details={itemToDelete ? [
          { label: 'Área', value: itemToDelete.nombre },
          { label: 'Departamento', value: itemToDelete.departamento_nombre },
          { label: 'Código', value: itemToDelete.id, isCode: true }
        ] : null}
      />
    </div>
  );
}
