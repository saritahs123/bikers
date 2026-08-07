"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Building2, 
  Search, 
  Download, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ListFilter,
  Save,
  Check,
  RefreshCw,
  Shield,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import { validateRNC } from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

export default function CompanyTypesSecurityView() {
  const [data, setData] = useState([]);
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
    nombre: "",
    descripcion: "",
    estado: "Activo"
  });
  const [nameError, setNameError] = useState("");
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchTypes();
  }, []);

  const validateForm = (nombreVal = formData.nombre) => {
    const val = validateRequiredText(nombreVal, "El Nombre", 100);
    if (!val.isValid) {
      setNameError(val.message);
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (val) => {
    setFormData(prev => ({ ...prev, nombre: val }));
    validateForm(val);
  };

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tipos-empresa');
      if (res.ok) {
        const result = await res.json();
        setData(result || []);
      }
    } catch (e) {
      console.error("Error fetching tipos de empresa:", e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      nombre: "",
      descripcion: "",
      estado: "Activo"
    });
    setNameError("");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      estado: item.estado || "Activo"
    });
    validateForm(item.nombre || "");
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      showToast("El nombre es obligatorio.");
      return;
    }

    try {
      setIsSaving(true);
      if (editingItem) {
        // Update DB
        const res = await fetch(`/api/tipos-empresa/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al actualizar");
        }
        showToast("Tipo Empresa actualizada correctamente.");
      } else {
        // Create DB
        const res = await fetch('/api/tipos-empresa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al crear");
        }
        showToast("Tipo Empresa creada correctamente.");
      }
      setIsDrawerOpen(false);
      await fetchTypes();
    } catch (err) {
      console.error("Error saving tipo de empresa:", err);
      showToast("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const res = await fetch(`/api/tipos-empresa/${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al eliminar");
      }
      showToast("Tipo Empresa eliminada correctamente.");
      await fetchTypes();
    } catch (e) {
      console.error("Error deleting item:", e);
      showToast("Error: " + e.message);
    } finally {
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const exportToExcel = () => {
    const headers = ["ID", "Nombre", "Descripción", "Estado", "Fecha de Creación", "Fecha de Actualización"];
    const rows = sortedData.map(i => [
      i.id,
      `"${i.nombre}"`,
      `"${i.descripcion || ''}"`,
      i.estado,
      i.fecha_creacion || '',
      i.fecha_actualizacion || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tipos_de_Empresa_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Archivo CSV/Excel generado con éxito.");
  };

  // Filtered dataset (Searches across all fields & filters by status)
  const filteredData = data.filter(item => {
    const s = (search || "").trim().toLowerCase();

    // 1. Search filter: If search is empty, allow all. Otherwise check any property
    const matchesSearch = !s || [
      item.id,
      item.nombre,
      item.descripcion
    ].some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(s));

    // 2. Status filter
    const itemStatus = (item.estado || "Activo").toString().trim().toUpperCase();
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
        className={`px-6 py-4 cursor-pointer select-none hover:text-white transition-colors group/head ${extraClass}`}
      >
        <div className={`flex items-center gap-1.5 ${extraClass.includes('text-center') ? 'justify-center' : ''}`}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp size={13} className="text-[#bfce7f] shrink-0" />
            ) : (
              <ArrowDown size={13} className="text-[#bfce7f] shrink-0" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-slate-500 group-hover/head:text-slate-300 opacity-50 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full space-y-6 font-sans text-[#e4e3d9] animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[999999] bg-[#bfce7f] text-[#2b3400] px-5 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Main Action Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#161a21] border border-[#2d3748] text-[#bfce7f] text-[11px] font-mono font-bold tracking-wider uppercase mb-2 shadow-sm">
            <Shield size={12} className="text-[#bfce7f]" />
            <span>Seguridad</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Tipos de Empresa</h1>
          <p className="text-sm text-slate-400 mt-1">Gestión administrativa de las figuras jurídicas del sistema.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-[#161a21] hover:bg-[#212631] border border-[#2d3748] text-white font-mono text-xs rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} className="text-[#bfce7f]" />
            <span>Exportar Excel</span>
          </button>

          <button 
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2 bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] font-mono text-xs font-black rounded-xl shadow-lg shadow-[#bfce7f]/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Crear Nuevo</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div 
          onClick={() => { setStatusFilter("Todos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Todos" ? "bg-[#1f2633] border-[#bfce7f]" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Total Tipos</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{String(totalCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#212631] border border-[#2d3748] flex items-center justify-center text-[#bfce7f]">
            <ListFilter size={24} />
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => { setStatusFilter("Activos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Activos" ? "bg-[#bfce7f]/10 border-[#bfce7f]" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Activos</p>
            <p className="text-3xl font-black text-[#bfce7f] font-mono mt-1">{String(activeCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#bfce7f]/10 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f]">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => { setStatusFilter("Inactivos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Inactivos" ? "bg-rose-500/10 border-rose-500" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Inactivos</p>
            <p className="text-3xl font-black text-rose-400 font-mono mt-1">{String(inactiveCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <XCircle size={24} />
          </div>
        </div>
      </div>

      {/* Table Filter Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] p-4 rounded-t-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-2xl">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Filtrar por nombre o descripción..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f] shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400 font-bold">Filtrar por Estado:</span>
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#bfce7f]"
          >
            <option value="Todos">Todos</option>
            <option value="Activos">Activos</option>
            <option value="Inactivos">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="border border-[#2d3748] bg-[#0e1117] rounded-b-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1b2029] border-b border-[#2d3748] font-mono text-[11px] text-[#bfce7f] tracking-wider">
                {renderSortableHeader("ID", "id")}
                {renderSortableHeader("Nombre", "nombre")}
                {renderSortableHeader("Descripción", "descripcion")}
                {renderSortableHeader("Estado", "estado", "text-center")}
                {renderSortableHeader("Fecha de Creación", "fecha_creacion")}
                {renderSortableHeader("Fecha de Actualización", "fecha_actualizacion")}
                <th className="px-6 py-4 text-right sticky right-0 bg-[#1b2029] shadow-[-8px_0_12px_rgba(0,0,0,0.6)] z-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin text-[#bfce7f] mx-auto mb-2" size={24} />
                    Cargando tipos de empresa...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono italic">
                    No se encontraron registros de tipos de empresa.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    className={`group ${idx % 2 === 0 ? 'bg-[#161a21]' : 'bg-[#1c2129]'} hover:bg-[#252c38] transition-colors`}
                  >
                    <td className="px-6 py-4 font-mono text-[#bfce7f] font-bold">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">
                      {item.nombre}
                    </td>
                    <td className="px-6 py-4 text-slate-300 italic max-w-md">
                      {item.descripcion || "Sin descripción registrada."}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        (item.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/40"
                          : "bg-slate-700/40 text-slate-400 border-slate-600"
                      }`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {item.fecha_creacion ? String(item.fecha_creacion).substring(0, 10) : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {item.fecha_actualizacion ? String(item.fecha_actualizacion).substring(0, 10) : "-"}
                    </td>
                    <td className={`px-6 py-4 text-right sticky right-0 ${idx % 2 === 0 ? 'bg-[#161a21]' : 'bg-[#1c2129]'} group-hover:bg-[#252c38] shadow-[-8px_0_12px_rgba(0,0,0,0.6)] z-10 transition-colors`}>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 bg-[#212631] hover:bg-[#bfce7f]/20 text-slate-300 hover:text-[#bfce7f] border border-[#2d3748] hover:border-[#bfce7f]/40 rounded-lg transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setItemToDelete(item); setIsDeletingModalOpen(true); }}
                          className="p-2 bg-[#212631] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#2d3748] hover:border-rose-500/40 rounded-lg transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-[#161a21] p-4 border-t border-[#2d3748] flex items-center justify-between font-mono text-xs">
          <p className="text-slate-400 text-[11px]">
            Mostrando {paginatedData.length} de {filteredData.length} registros
          </p>

          <div className="flex gap-1.5">
            <button 
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-[#0e1117] border border-[#2d3748] text-slate-300 rounded hover:bg-[#212631] disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                type="button"
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 border rounded text-xs cursor-pointer ${
                  page === i + 1
                    ? "border-[#bfce7f] bg-[#bfce7f]/20 text-[#bfce7f] font-bold"
                    : "border-[#2d3748] bg-[#0e1117] text-slate-400 hover:bg-[#212631]"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-[#0e1117] border border-[#2d3748] text-slate-300 rounded hover:bg-[#212631] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* PORTAL FOR SIDE DRAWER MODAL (CREATE / EDIT) */}
      {mounted && isDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Dark Overlay Backdrop */}
          <div 
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Side Drawer Card */}
          <div 
            style={{ 
              position: 'relative', 
              width: '450px', 
              maxWidth: '90vw', 
              height: '100vh', 
              backgroundColor: '#161a21', 
              borderLeft: '1px solid #2d3748', 
              boxShadow: '-10px 0 30px rgba(0,0,0,0.6)', 
              display: 'flex', 
              flexDirection: 'column', 
              zIndex: 1000000 
            }}
            className="font-sans"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#2d3748] bg-[#0e1117] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {editingItem ? "Editar Tipo de Empresa" : "Nuevo Tipo de Empresa"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {editingItem ? "Modifica los campos para actualizar el registro." : "Completa los campos para añadir un registro."}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDrawerOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#212631] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* NOMBRE DEL TIPO */}
              <div className="space-y-2">
                <label className="font-mono text-[11px] text-slate-300 font-bold tracking-wider uppercase block">
                  NOMBRE DEL TIPO *
                </label>
                <input 
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Sociedad Anónima"
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    nameError ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {nameError && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-rose-400 font-mono">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{nameError}</span>
                  </div>
                )}
              </div>

              {/* DESCRIPCIÓN */}
              <div className="space-y-2">
                <label className="font-mono text-[11px] text-slate-300 font-bold tracking-wider uppercase block">
                  DESCRIPCIÓN
                </label>
                <textarea 
                  rows={4}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Breve descripción de las características legales..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f] resize-none transition-all"
                />
              </div>

              {/* ESTADO INICIAL / ESTADO DEL REGISTRO */}
              <div className="space-y-2">
                <label className="font-mono text-[11px] text-slate-300 font-bold tracking-wider uppercase block">
                  ESTADO INICIAL
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Activo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "Activo" })}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      (formData.estado || "").toUpperCase() === "ACTIVO" 
                        ? "bg-[#bfce7f]/15 border-2 border-[#bfce7f]" 
                        : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      (formData.estado || "").toUpperCase() === "ACTIVO" 
                        ? "border-[#bfce7f]" 
                        : "border-slate-500"
                    }`}>
                      {(formData.estado || "").toUpperCase() === "ACTIVO" && (
                        <div className="w-2 h-2 rounded-full bg-[#bfce7f]"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">Activo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Visible en catálogos</p>
                    </div>
                  </div>

                  {/* Inactivo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "Inactivo" })}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      (formData.estado || "").toUpperCase() === "INACTIVO" 
                        ? "bg-rose-500/15 border-2 border-rose-400" 
                        : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      (formData.estado || "").toUpperCase() === "INACTIVO" 
                        ? "border-rose-400" 
                        : "border-slate-500"
                    }`}>
                      {(formData.estado || "").toUpperCase() === "INACTIVO" && (
                        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">Inactivo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Oculto temporalmente</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Notice Box */}
              <div className="p-3.5 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-start gap-3">
                <Info size={18} className="text-[#bfce7f] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  Asegúrese de que el nombre sea único en el sistema para evitar duplicados en la base de datos de catálogos maestros.
                </p>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-[#2d3748] bg-[#0e1117] flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-3 border border-[#2d3748] bg-[#161a21] text-white hover:bg-[#212631] transition-all font-mono text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={isSaving || !!nameError || !formData.nombre.trim()}
                className="flex-1 py-3 bg-[#bfce7f] hover:bg-[#a8b868] disabled:opacity-50 disabled:cursor-not-allowed text-[#1d1f18] font-mono text-xs font-black rounded-xl transition-all shadow-lg shadow-[#bfce7f]/20 flex items-center justify-center gap-1.5 cursor-pointer"
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
        title="¿Eliminar Tipo de Empresa?"
        description={`¿Está seguro que desea eliminar permanentemente el tipo "${itemToDelete?.nombre || itemToDelete?.tipo_empresa || ''}"? Esta acción es irreversible.`}
        confirmLabel="Eliminar"
        isLoading={isSubmitting}
        loadingLabel="Eliminando..."
        details={itemToDelete ? [
          { label: 'Tipo de Empresa', value: itemToDelete.nombre || itemToDelete.tipo_empresa },
          { label: 'Código', value: itemToDelete.codigo, isCode: true }
        ] : null}
      />
    </div>
  );
}

