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
  RefreshCw,
  Shield,
  Info,
  Upload,
  Globe,
  Phone,
  Mail,
  MapPin,
  Palette,
  Image as ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle
} from "lucide-react";
import { 
  validateRNC, 
  formatPhoneDR, 
  validatePhoneDR, 
  validateEmail, 
  validateURL, 
  validateRequiredText 
} from "@/lib/validations";

export default function CompaniesSecurityView() {
  const [data, setData] = useState([]);
  const [tiposEmpresa, setTiposEmpresa] = useState([]);
  const [empresasPadre, setEmpresasPadre] = useState([]);
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
    rnc: "",
    codigo: "",
    nombre_comercial: "",
    alias: "",
    tipo_empresa_id: "",
    empresa_padre_id: "",
    logotipo_url: "",
    estado: "Activo",
    color_identificador: "#bfce7f",
    direccion: "",
    telefono: "",
    email: "",
    descripcion: ""
  });

  const [formErrors, setFormErrors] = useState({
    rnc: "",
    nombre_comercial: "",
    tipo_empresa_id: "",
    telefono: "",
    email: "",
    logotipo_url: ""
  });

  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
    fetchHelpers();
  }, []);

  const validateCurrentForm = (dataObj = formData) => {
    const errors = {
      rnc: "",
      nombre_comercial: "",
      tipo_empresa_id: "",
      telefono: "",
      email: "",
      logotipo_url: ""
    };

    const rncVal = validateRNC(dataObj.rnc, true);
    if (!rncVal.isValid) errors.rnc = rncVal.message;

    const nameVal = validateRequiredText(dataObj.nombre_comercial, "El Nombre Comercial", 100);
    if (!nameVal.isValid) errors.nombre_comercial = nameVal.message;

    if (!dataObj.tipo_empresa_id) errors.tipo_empresa_id = "Debe seleccionar un Tipo de Empresa.";

    const phoneVal = validatePhoneDR(dataObj.telefono, false);
    if (!phoneVal.isValid) errors.telefono = phoneVal.message;

    const emailVal = validateEmail(dataObj.email, false);
    if (!emailVal.isValid) errors.email = emailVal.message;

    // Logotipo (Ruta / URL) format validation is ignored as requested
    errors.logotipo_url = "";

    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const updateField = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      validateCurrentForm(next);
      return next;
    });
  };

  const handleRncChange = (val) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 11);
    updateField("rnc", digitsOnly);
  };

  const handlePhoneChange = (val) => {
    const { formatted } = formatPhoneDR(val);
    updateField("telefono", formatted);
  };

  const handleEmailChange = (val) => {
    updateField("email", val.trim().toLowerCase());
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/empresas');
      if (res.ok) {
        const result = await res.json();
        setData(result || []);
      }
    } catch (e) {
      console.error("Error fetching empresas:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpers = async () => {
    try {
      const res = await fetch('/api/empresas/helpers');
      if (res.ok) {
        const result = await res.json();
        setTiposEmpresa(result.tiposEmpresa || []);
        setEmpresasPadre(result.empresasPadre || []);
      }
    } catch (e) {
      console.error("Error fetching helpers:", e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    const initialData = {
      rnc: "",
      codigo: "",
      nombre_comercial: "",
      alias: "",
      tipo_empresa_id: tiposEmpresa.length > 0 ? String(tiposEmpresa[0].tipo_empresa_id) : "",
      empresa_padre_id: "",
      logotipo_url: "",
      estado: "Activo",
      color_identificador: "#bfce7f",
      direccion: "",
      telefono: "",
      email: "",
      descripcion: ""
    };
    setFormData(initialData);
    setFormErrors({ rnc: "", nombre_comercial: "", tipo_empresa_id: "", telefono: "", email: "", logotipo_url: "" });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const initialData = {
      rnc: item.rnc || "",
      codigo: item.codigo || "",
      nombre_comercial: item.nombre_comercial || "",
      alias: item.alias || "",
      tipo_empresa_id: item.tipo_empresa_id !== undefined && item.tipo_empresa_id !== null ? String(item.tipo_empresa_id) : "",
      empresa_padre_id: item.empresa_padre_id !== undefined && item.empresa_padre_id !== null ? String(item.empresa_padre_id) : "",
      logotipo_url: item.logotipo_url || "",
      estado: item.estado || "Activo",
      color_identificador: item.color_identificador || "#bfce7f",
      direccion: item.direccion || "",
      telefono: item.telefono ? formatPhoneDR(item.telefono).formatted : "",
      email: item.email || "",
      descripcion: item.descripcion || ""
    };
    setFormData(initialData);
    validateCurrentForm(initialData);
    setIsDrawerOpen(true);
  };

  const handleLogoUploadSim = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fakeUrl = URL.createObjectURL(file);
      updateField("logotipo_url", fakeUrl);
      showToast(`Vista previa cargada: ${file.name}`);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateCurrentForm()) {
      showToast("Por favor corrija los errores de validación antes de guardar.");
      return;
    }

    try {
      setIsSaving(true);
      if (editingItem) {
        const res = await fetch(`/api/empresas/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al actualizar la empresa.");
        }
        showToast("Empresa actualizada correctamente.");
      } else {
        const res = await fetch('/api/empresas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al registrar la empresa.");
        }
        showToast("Empresa creada correctamente.");
      }
      setIsDrawerOpen(false);
      await fetchData();
      await fetchHelpers();
    } catch (err) {
      console.error("Error saving empresa:", err);
      showToast("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const res = await fetch(`/api/empresas/${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al eliminar la empresa.");
      }
      showToast("Empresa eliminada correctamente.");
      await fetchData();
      await fetchHelpers();
    } catch (e) {
      console.error("Error deleting empresa:", e);
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
    const headers = [
      "ID", "Código", "RNC", "Nombre Comercial", "Alias", 
      "Tipo Empresa", "Empresa Padre", "Teléfono", "Email", "Estado", "Fecha Registro"
    ];
    const rows = sortedData.map(i => [
      i.id,
      `"${i.codigo || ''}"`,
      `"${i.rnc || ''}"`,
      `"${i.nombre_comercial || ''}"`,
      `"${i.alias || ''}"`,
      `"${i.tipo_empresa_nombre || ''}"`,
      `"${i.empresa_padre_nombre || ''}"`,
      `"${i.telefono || ''}"`,
      `"${i.email || ''}"`,
      i.estado,
      i.fecha_registro || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Empresas_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Archivo CSV/Excel de Empresas exportado.");
  };

  const filteredData = data.filter(item => {
    const s = (search || "").trim().toLowerCase();
    
    const matchesSearch = !s || [
      item.id,
      item.codigo,
      item.rnc,
      item.nombre_comercial,
      item.alias,
      item.tipo_empresa_nombre,
      item.empresa_padre_nombre,
      item.telefono,
      item.email,
      item.direccion,
      item.descripcion
    ].some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(s));

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
        className={`px-5 py-4 cursor-pointer select-none hover:text-white transition-colors group/head ${extraClass}`}
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
            <Building2 size={12} className="text-[#bfce7f]" />
            <span>Seguridad</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Empresas</h1>
          <p className="text-sm text-slate-400 mt-1">Gestión administrativa de empresas, sucursales y entidades del sistema.</p>
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
        <div 
          onClick={() => { setStatusFilter("Todos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Todos" ? "bg-[#1f2633] border-[#bfce7f]" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Total Empresas</p>
            <p className="text-3xl font-black text-white font-mono mt-1">{String(totalCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#212631] border border-[#2d3748] flex items-center justify-center text-[#bfce7f]">
            <Building2 size={24} />
          </div>
        </div>

        <div 
          onClick={() => { setStatusFilter("Activos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Activos" ? "bg-[#bfce7f]/10 border-[#bfce7f]" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Activas</p>
            <p className="text-3xl font-black text-[#bfce7f] font-mono mt-1">{String(activeCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#bfce7f]/10 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f]">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div 
          onClick={() => { setStatusFilter("Inactivos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all border ${
            statusFilter === "Inactivos" ? "bg-rose-500/10 border-rose-500" : "bg-[#161a21] border-[#2d3748] hover:border-slate-600"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest font-bold">Inactivas</p>
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
            placeholder="Buscar por código, RNC, nombre o alias..."
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
                {renderSortableHeader("RNC", "rnc")}
                {renderSortableHeader("Nombre Comercial", "nombre_comercial")}
                {renderSortableHeader("Alias", "alias")}
                {renderSortableHeader("Tipo Empresa", "tipo_empresa_nombre")}
                {renderSortableHeader("Empresa Padre", "empresa_padre_nombre")}
                {renderSortableHeader("Teléfono", "telefono")}
                {renderSortableHeader("Email", "email")}
                {renderSortableHeader("Estado", "estado", "text-center")}
                {renderSortableHeader("Fecha Registro", "fecha_registro")}
                <th className="px-5 py-4 text-right sticky right-0 bg-[#1b2029] shadow-[-8px_0_12px_rgba(0,0,0,0.6)] z-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/50">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin text-[#bfce7f] mx-auto mb-2" size={24} />
                    Cargando catálogo de empresas...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-mono italic">
                    No se encontraron registros de empresas.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    className={`group ${idx % 2 === 0 ? 'bg-[#161a21]' : 'bg-[#1c2129]'} hover:bg-[#252c38] transition-colors whitespace-nowrap`}
                  >
                    <td className="px-5 py-4 font-mono text-[#bfce7f] font-bold">
                      {item.id}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      {item.codigo || "-"}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-200 font-bold">
                      {item.rnc}
                    </td>
                    <td className="px-5 py-4 font-bold text-white text-sm">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20"
                          style={{ backgroundColor: item.color_identificador || '#bfce7f' }}
                          title={`Color: ${item.color_identificador}`}
                        />
                        {item.logotipo_url ? (
                          <img 
                            src={item.logotipo_url} 
                            alt={item.nombre_comercial} 
                            className="w-6 h-6 rounded-md object-cover border border-[#2d3748]"
                          />
                        ) : null}
                        <span>{item.nombre_comercial}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 italic">
                      {item.alias || "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#212631] text-slate-300 border border-[#2d3748] font-mono text-[10px]">
                        {item.tipo_empresa_nombre || "General"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono">
                      {item.empresa_padre_nombre || "Ninguna"}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      {item.telefono || "-"}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {item.email || "-"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        (item.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/40"
                          : "bg-slate-700/40 text-slate-400 border-slate-600"
                      }`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">
                      {item.fecha_registro ? String(item.fecha_registro).substring(0, 10) : "-"}
                    </td>
                    <td className={`px-5 py-4 text-right sticky right-0 shadow-[-8px_0_12px_rgba(0,0,0,0.6)] z-10 ${
                      idx % 2 === 0 ? 'bg-[#161a21]' : 'bg-[#1c2129]'
                    } group-hover:bg-[#252c38] transition-colors`}>
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
                  {editingItem ? "Editar Empresa" : "Nueva Empresa"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItem ? "Modifica la información registrada de la empresa." : "Completa todos los campos para registrar una nueva empresa."}
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

            {/* Drawer Form Body - Balanced 2-Column Grid (NO TRUNCATION & ZERO VOID) */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              
              {/* SECCIÓN 1: INFORMACIÓN GENERAL */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs text-[#bfce7f] font-bold tracking-wider uppercase border-b border-[#2d3748] pb-1 flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>Información General</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* RNC */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      RNC *
                    </label>
                    <input 
                      type="text"
                      required
                      maxLength={11}
                      value={formData.rnc}
                      onChange={(e) => handleRncChange(e.target.value)}
                      placeholder="Ej. 101123456 o 13145678901"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                        formErrors.rnc ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {formErrors.rnc && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{formErrors.rnc}</span>
                      </div>
                    )}
                  </div>

                  {/* CÓDIGO */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      Código
                    </label>
                    <input 
                      type="text"
                      value={formData.codigo}
                      onChange={(e) => updateField("codigo", e.target.value)}
                      placeholder="Ej. EMP-001"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  {/* NOMBRE COMERCIAL (Full Width 2 cols) */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      Nombre Comercial *
                    </label>
                    <input 
                      type="text"
                      required
                      value={formData.nombre_comercial}
                      onChange={(e) => updateField("nombre_comercial", e.target.value)}
                      placeholder="Ej. Bikers Fort Taller Santo Domingo S.R.L."
                      className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                        formErrors.nombre_comercial ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {formErrors.nombre_comercial && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{formErrors.nombre_comercial}</span>
                      </div>
                    )}
                  </div>

                  {/* ALIAS (Full Width 2 cols) */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      Alias
                    </label>
                    <input 
                      type="text"
                      value={formData.alias}
                      onChange={(e) => updateField("alias", e.target.value)}
                      placeholder="Ej. Bikers Fort SD"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: ORGANIZACIÓN Y CONTACTO */}
              <div className="space-y-3 pt-1">
                <h3 className="font-mono text-xs text-[#bfce7f] font-bold tracking-wider uppercase border-b border-[#2d3748] pb-1 flex items-center gap-1.5">
                  <Shield size={13} />
                  <span>Organización y Contacto</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* TIPO DE EMPRESA */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      Tipo de Empresa *
                    </label>
                    <select 
                      required
                      value={formData.tipo_empresa_id !== null && formData.tipo_empresa_id !== undefined ? String(formData.tipo_empresa_id) : ""}
                      onChange={(e) => updateField("tipo_empresa_id", e.target.value)}
                      className={`w-full bg-[#0e1117] border rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none transition-all ${
                        formErrors.tipo_empresa_id ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    >
                      <option value="">-- Seleccionar --</option>
                      {tiposEmpresa.map((t) => (
                        <option key={t.tipo_empresa_id} value={String(t.tipo_empresa_id)}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                    {formErrors.tipo_empresa_id && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{formErrors.tipo_empresa_id}</span>
                      </div>
                    )}
                  </div>

                  {/* EMPRESA PADRE */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      Empresa Padre
                    </label>
                    <select 
                      value={formData.empresa_padre_id !== null && formData.empresa_padre_id !== undefined ? String(formData.empresa_padre_id) : ""}
                      onChange={(e) => updateField("empresa_padre_id", e.target.value)}
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#bfce7f]"
                    >
                      <option value="">-- Ninguna (Matriz) --</option>
                      {empresasPadre
                        .filter(p => !editingItem || String(p.empresa_id) !== String(editingItem.id))
                        .map((p) => (
                          <option key={p.empresa_id} value={String(p.empresa_id)}>
                            {p.nombre_comercial}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* TELÉFONO */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" />
                      <span>Teléfono</span>
                    </label>
                    <input 
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="Ej. (809) 555-0199"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                        formErrors.telefono ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {formErrors.telefono && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{formErrors.telefono}</span>
                      </div>
                    )}
                  </div>

                  {/* EMAIL */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Mail size={11} className="text-slate-400" />
                      <span>Email</span>
                    </label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="contacto@bikersfort.com"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                        formErrors.email ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {formErrors.email && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{formErrors.email}</span>
                      </div>
                    )}
                  </div>

                  {/* DIRECCIÓN (Full Width 2 cols) */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" />
                      <span>Dirección</span>
                    </label>
                    <input 
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ej. Av. 27 de Febrero #145, Santo Domingo"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: UBICACIÓN Y VISUALIZACIÓN */}
              <div className="space-y-3 pt-1">
                <h3 className="font-mono text-xs text-[#bfce7f] font-bold tracking-wider uppercase border-b border-[#2d3748] pb-1 flex items-center gap-1.5">
                  <Palette size={13} />
                  <span>Elementos Visuales</span>
                </h3>

                {/* LOGOTIPO URL */}
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
                    <ImageIcon size={11} className="text-slate-400" />
                    <span>Logotipo (Ruta / URL)</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={formData.logotipo_url}
                      onChange={(e) => updateField("logotipo_url", e.target.value)}
                      placeholder="Ej. /uploads/logo.png o https://..."
                      className={`flex-1 bg-[#0e1117] border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                        formErrors.logotipo_url ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    <label className="px-3 py-2 bg-[#212631] border border-[#2d3748] hover:border-[#bfce7f]/40 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0">
                      <Upload size={13} />
                      <span>Subir</span>
                      <input type="file" accept="image/*" onChange={handleLogoUploadSim} className="hidden" />
                    </label>
                  </div>
                  {formErrors.logotipo_url && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.logotipo_url}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* COLOR IDENTIFICADOR */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Palette size={11} className="text-slate-400" />
                      <span>Color Identificador</span>
                    </label>
                    <div className="flex items-center gap-2 bg-[#0e1117] border border-[#2d3748] rounded-xl p-1">
                      <input 
                        type="color"
                        value={formData.color_identificador}
                        onChange={(e) => setFormData({ ...formData, color_identificador: e.target.value })}
                        className="w-7 h-7 rounded-lg bg-[#0e1117] border-0 cursor-pointer p-0 shrink-0"
                      />
                      <input 
                        type="text"
                        value={formData.color_identificador}
                        onChange={(e) => setFormData({ ...formData, color_identificador: e.target.value })}
                        placeholder="#bfce7f"
                        className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                      />
                    </div>
                  </div>

                  {/* ESTADO INICIAL */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                      ESTADO INICIAL
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div 
                        onClick={() => setFormData({ ...formData, estado: "Activo" })}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          (formData.estado || "").toUpperCase() === "ACTIVO" 
                            ? "bg-[#bfce7f]/15 border-2 border-[#bfce7f]" 
                            : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          (formData.estado || "").toUpperCase() === "ACTIVO" 
                            ? "border-[#bfce7f]" 
                            : "border-slate-500"
                        }`}>
                          {(formData.estado || "").toUpperCase() === "ACTIVO" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#bfce7f]"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white leading-tight">Activo</p>
                          <p className="text-[8px] text-slate-400">Visible</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setFormData({ ...formData, estado: "Inactivo" })}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          (formData.estado || "").toUpperCase() === "INACTIVO" 
                            ? "bg-rose-500/15 border-2 border-rose-400" 
                            : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          (formData.estado || "").toUpperCase() === "INACTIVO" 
                            ? "border-rose-400" 
                            : "border-slate-500"
                        }`}>
                          {(formData.estado || "").toUpperCase() === "INACTIVO" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white leading-tight">Inactivo</p>
                          <p className="text-[8px] text-slate-400">Oculto</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: DESCRIPCIÓN */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                    DESCRIPCIÓN
                  </label>
                  <span className="text-[9px] font-mono text-slate-400">
                    {formData.descripcion.length} / 500
                  </span>
                </div>
                <textarea 
                  rows={2.5}
                  maxLength={500}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Breve descripción del objeto o propósito comercial de la empresa..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f] resize-none transition-all"
                />
              </div>

              {/* Info Notice Box */}
              <div className="p-3 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-center gap-2.5">
                <Info size={16} className="text-[#bfce7f] shrink-0" />
                <p className="text-[11px] text-slate-300 leading-tight">
                  Asegúrese de que el RNC sea único en el sistema para evitar duplicados fiscales.
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
                disabled={isSaving || Object.values(formErrors).some(Boolean)}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
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
              zIndex: 1000000 
            }}
            className="font-sans"
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Empresa?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              ¿Está seguro que desea eliminar permanentemente la empresa <strong className="text-white">{itemToDelete?.nombre_comercial || ''}</strong>?
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
