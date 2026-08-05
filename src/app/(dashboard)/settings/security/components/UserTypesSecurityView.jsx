"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  UserCheck, 
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

export default function UserTypesSecurityView() {
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
    codigo: "",
    nombre: "",
    descripcion: "",
    nivel_acceso: 1,
    estado: "ACTIVO"
  });

  const [formErrors, setFormErrors] = useState({
    codigo: "",
    nombre: "",
    nivel_acceso: ""
  });

  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const validateForm = (dataObj = formData) => {
    const errors = { codigo: "", nombre: "", nivel_acceso: "" };
    let valid = true;

    const codRes = validateRequiredText(dataObj.codigo, "El Código", 50);
    if (!codRes.isValid) {
      errors.codigo = codRes.message;
      valid = false;
    }

    const nameRes = validateRequiredText(dataObj.nombre, "El Nombre", 100);
    if (!nameRes.isValid) {
      errors.nombre = nameRes.message;
      valid = false;
    }

    const nivelNum = parseInt(dataObj.nivel_acceso, 10);
    if (isNaN(nivelNum) || nivelNum < 1) {
      errors.nivel_acceso = "El Nivel de Acceso debe ser un número entero mayor o igual a 1.";
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const updateField = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      validateForm(next);
      return next;
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tipos-usuario');
      if (res.ok) {
        const result = await res.json();
        setData(result || []);
      }
    } catch (e) {
      console.error("Error fetching tipos de usuario:", e);
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
    const initialData = {
      codigo: "",
      nombre: "",
      descripcion: "",
      nivel_acceso: 1,
      estado: "ACTIVO"
    };
    setFormData(initialData);
    setFormErrors({ codigo: "", nombre: "", nivel_acceso: "" });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const initialData = {
      codigo: item.codigo || "",
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      nivel_acceso: item.nivel_acceso !== undefined && item.nivel_acceso !== null ? Number(item.nivel_acceso) : 1,
      estado: item.estado ? item.estado.toUpperCase() : "ACTIVO"
    };
    setFormData(initialData);
    validateForm(initialData);
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      showToast("Por favor complete correctamente los campos obligatorios.");
      return;
    }

    const cleanCodigo = (formData.codigo || '').trim();
    const cleanNombre = (formData.nombre || '').trim();
    const cleanDesc = (formData.descripcion || '').trim();
    const nivelAccesoNum = parseInt(formData.nivel_acceso, 10);

    try {
      setIsSaving(true);
      const payload = {
        codigo: cleanCodigo,
        nombre: cleanNombre,
        descripcion: cleanDesc,
        nivel_acceso: nivelAccesoNum,
        estado: formData.estado
      };

      if (editingItem) {
        const res = await fetch(`/api/tipos-usuario/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al actualizar el tipo de usuario.");
        }
        showToast("Tipo de Usuario actualizado correctamente.");
      } else {
        const res = await fetch('/api/tipos-usuario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al registrar el tipo de usuario.");
        }
        showToast("Tipo de Usuario creado correctamente.");
      }
      setIsDrawerOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Error saving tipo de usuario:", err);
      showToast("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const res = await fetch(`/api/tipos-usuario/${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al eliminar el tipo de usuario.");
      }
      showToast("Tipo de Usuario eliminado correctamente.");
      await fetchData();
    } catch (e) {
      console.error("Error deleting tipo de usuario:", e);
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
    const headers = ["ID", "Código", "Nombre", "Nivel de Acceso", "Descripción", "Estado", "Fecha de Creación", "Fecha de Actualización"];
    const rows = sortedData.map(i => [
      i.id,
      `"${i.codigo || ''}"`,
      `"${i.nombre || ''}"`,
      i.nivel_acceso,
      `"${i.descripcion || ''}"`,
      i.estado,
      i.fecha_creacion || '',
      i.fecha_actualizacion || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tipos_de_Usuario_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Archivo CSV/Excel de Tipos de Usuario exportado.");
  };

  // Filtered dataset (Searches across codigo, nombre, descripcion, and estado)
  const filteredData = data.filter(item => {
    const s = (search || "").trim().toLowerCase();

    const matchesSearch = !s || [
      item.id,
      item.codigo,
      item.nombre,
      item.descripcion,
      item.nivel_acceso,
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
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Tipos de Usuario</h1>
          <p className="text-sm text-slate-400 mt-1">Gestión administrativa de los perfiles y niveles de acceso de los usuarios.</p>
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
            <UserCheck size={24} />
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
            placeholder="Buscar por código, nombre, descripción o estado..."
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
              <tr className="bg-[#1b2029] border-b border-[#2d3748] font-mono text-[11px] text-[#bfce7f] tracking-wider whitespace-nowrap">
                {renderSortableHeader("ID", "id")}
                {renderSortableHeader("Código", "codigo")}
                {renderSortableHeader("Nombre", "nombre")}
                {renderSortableHeader("Nivel de Acceso", "nivel_acceso", "text-center")}
                {renderSortableHeader("Estado", "estado", "text-center")}
                {renderSortableHeader("Fecha de Creación", "fecha_creacion")}
                {renderSortableHeader("Fecha de Actualización", "fecha_actualizacion")}
                <th className="px-6 py-4 text-right sticky right-0 bg-[#1b2029] shadow-[-8px_0_12px_rgba(0,0,0,0.6)] z-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin text-[#bfce7f] mx-auto mb-2" size={24} />
                    Cargando tipos de usuario...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono italic">
                    No se encontraron registros de tipos de usuario.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    className={`group ${idx % 2 === 0 ? 'bg-[#161a21]' : 'bg-[#1c2129]'} hover:bg-[#252c38] transition-colors whitespace-nowrap`}
                  >
                    <td className="px-6 py-4 font-mono text-[#bfce7f] font-bold">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-slate-300">
                      {item.codigo}
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">
                      {item.nombre}
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-black text-slate-200">
                      <span className="px-2.5 py-1 bg-[#212631] border border-[#2d3748] rounded-lg text-xs">
                        Nivel {item.nivel_acceso}
                      </span>
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
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          className="p-2 bg-[#212631] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#2d3748] hover:border-rose-500/40 rounded-lg transition-all cursor-pointer"
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
        <div className="p-4 border-t border-[#2d3748] bg-[#161a21] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <p className="text-slate-400">
            Mostrando <span className="text-white font-bold">{paginatedData.length}</span> de <span className="text-white font-bold">{filteredData.length}</span> registros
          </p>
          
          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-[#2d3748] bg-[#0e1117] text-slate-300 hover:text-white hover:bg-[#212631] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                    ? "bg-[#bfce7f] text-[#1d1f18]" 
                    : "border border-[#2d3748] bg-[#0e1117] text-slate-300 hover:bg-[#212631] hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
            <button 
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-[#2d3748] bg-[#0e1117] text-slate-300 hover:text-white hover:bg-[#212631] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)' }} 
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Side Drawer Card */}
          <div 
            style={{ 
              position: 'relative', 
              width: '540px', 
              maxWidth: '95vw', 
              height: '100vh', 
              backgroundColor: '#161a21', 
              borderLeft: '1px solid #2d3748', 
              boxShadow: '-10px 0 35px rgba(0,0,0,0.7)', 
              display: 'flex', 
              flexDirection: 'column', 
              zIndex: 1000000 
            }}
            className="font-sans"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#2d3748] bg-[#0e1117] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {editingItem ? "Editar Tipo de Usuario" : "Nuevo Tipo de Usuario"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItem ? "Modifica los datos del perfil seleccionado." : "Completa los campos para registrar un nuevo tipo de usuario."}
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
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* CÓDIGO Y NOMBRE EN 2 COLUMNAS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                    CÓDIGO *
                  </label>
                  <input 
                    type="text"
                    required
                    maxLength={50}
                    value={formData.codigo}
                    onChange={(e) => updateField("codigo", e.target.value)}
                    placeholder="Ej. ADMIN, MECANICO"
                    className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                      formErrors.codigo ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                    }`}
                  />
                  {formErrors.codigo && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.codigo}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                    NOMBRE *
                  </label>
                  <input 
                    type="text"
                    required
                    maxLength={100}
                    value={formData.nombre}
                    onChange={(e) => updateField("nombre", e.target.value)}
                    placeholder="Ej. Administrador del Sistema"
                    className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                      formErrors.nombre ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                    }`}
                  />
                  {formErrors.nombre && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.nombre}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* NIVEL DE ACCESO */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  NIVEL DE ACCESO *
                </label>
                <input 
                  type="number"
                  min="1"
                  required
                  value={formData.nivel_acceso}
                  onChange={(e) => updateField("nivel_acceso", e.target.value)}
                  placeholder="1"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formErrors.nivel_acceso ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {formErrors.nivel_acceso && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{formErrors.nivel_acceso}</span>
                  </div>
                )}
              </div>

              {/* ESTADO INICIAL */}
              <div className="space-y-1 pt-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  ESTADO INICIAL
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Activo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "ACTIVO" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
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
                      <p className="text-[10px] text-slate-400 mt-0.5">Permite vinculación de usuarios</p>
                    </div>
                  </div>

                  {/* Inactivo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, estado: "INACTIVO" })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
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

              {/* DESCRIPCIÓN */}
              <div className="space-y-1 pt-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  DESCRIPCIÓN
                </label>
                <textarea 
                  rows={3}
                  maxLength={500}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Detalles sobre las responsabilidades o permisos asignados a este perfil..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f] resize-none"
                />
              </div>

              {/* Info Notice Box */}
              <div className="p-3 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-center gap-2.5 mt-3">
                <Info size={16} className="text-[#bfce7f] shrink-0" />
                <p className="text-[11px] text-slate-300 leading-tight">
                  Los códigos y nombres de los tipos de usuario deben ser únicos en la plataforma.
                </p>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-2.5 border border-[#2d3748] bg-[#161a21] text-white hover:bg-[#212631] transition-all font-mono text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={isSaving || Object.values(formErrors).some(Boolean) || !formData.codigo.trim() || !formData.nombre.trim()}
                className="flex-1 py-2.5 bg-[#bfce7f] hover:bg-[#a8b868] disabled:opacity-50 disabled:cursor-not-allowed text-[#1d1f18] font-mono text-xs font-black rounded-xl transition-all shadow-lg shadow-[#bfce7f]/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PORTAL FOR CONFIRM DELETE MODAL */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: '16px' }}>
          <div 
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setIsDeletingModalOpen(false)}
          />
          <div 
            style={{ 
              position: 'relative', 
              width: '420px', 
              maxWidth: '90vw', 
              backgroundColor: '#161a21', 
              border: '1px solid #2d3748', 
              borderRadius: '16px', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)', 
              padding: '24px', 
              textAlign: 'center', 
              zIndex: 1000000,
              margin: 'auto'
            }}
            className="font-sans"
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Tipo de Usuario?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              ¿Está seguro que desea eliminar permanentemente el tipo de usuario <strong className="text-white">{itemToDelete?.nombre || ''}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDeletingModalOpen(false)}
                className="flex-1 py-2.5 bg-[#212631] text-white text-xs font-bold rounded-xl border border-[#2d3748] hover:bg-[#2d3748] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
