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
  Save, 
  RefreshCw, 
  Shield, 
  Info,
  Upload, 
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
  validateRequiredText 
} from "@/lib/validations";
import SecurityConfirmDialog from "@/components/security/SecurityConfirmDialog";

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
    color_identificador: "#5c701b",
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
    setFormData({
      rnc: "",
      codigo: "",
      nombre_comercial: "",
      alias: "",
      tipo_empresa_id: "",
      empresa_padre_id: "",
      logotipo_url: "",
      estado: "Activo",
      color_identificador: "#5c701b",
      direccion: "",
      telefono: "",
      email: "",
      descripcion: ""
    });
    setFormErrors({
      rnc: "",
      nombre_comercial: "",
      tipo_empresa_id: "",
      telefono: "",
      email: "",
      logotipo_url: ""
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const initial = {
      rnc: item.rnc || "",
      codigo: item.codigo || "",
      nombre_comercial: item.nombre_comercial || "",
      alias: item.alias || "",
      tipo_empresa_id: item.tipo_empresa_id !== null && item.tipo_empresa_id !== undefined ? String(item.tipo_empresa_id) : "",
      empresa_padre_id: item.empresa_padre_id !== null && item.empresa_padre_id !== undefined ? String(item.empresa_padre_id) : "",
      logotipo_url: item.logotipo_url || "",
      estado: item.estado || "Activo",
      color_identificador: item.color_identificador || "#5c701b",
      direccion: item.direccion || "",
      telefono: item.telefono || "",
      email: item.email || "",
      descripcion: item.descripcion || ""
    };
    setFormData(initial);
    validateCurrentForm(initial);
    setIsDrawerOpen(true);
  };

  const handleLogoUploadSim = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField("logotipo_url", reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateCurrentForm()) {
      showToast("Por favor revise los campos con error.");
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
      item => item.id,
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

    showToast("Archivo CSV de Empresas exportado.");
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
        className={`px-5 py-4 cursor-pointer select-none hover:text-foreground text-foreground-secondary transition-colors group/head ${extraClass}`}
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
            <Building2 size={12} className="text-primary" />
            <span>Seguridad</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">Empresas</h1>
          <p className="text-sm text-foreground-muted mt-1">Gestión administrativa de empresas, sucursales y entidades del sistema.</p>
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
            <span>Crear Nuevo</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => { setStatusFilter("Todos"); setPage(1); }}
          className={`p-6 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer transition-all border ${
            statusFilter === "Todos" ? "bg-primary/10 border-primary" : "bg-card border-border hover:border-primary/40"
          }`}
        >
          <div>
            <p className="font-mono text-[11px] text-foreground-muted uppercase tracking-widest font-bold">Total Empresas</p>
            <p className="text-3xl font-black text-foreground font-mono mt-1">{String(totalCount).padStart(2, '0')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-subtle border border-border flex items-center justify-center text-primary">
            <Building2 size={24} />
          </div>
        </div>

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
            placeholder="Buscar por código, RNC, nombre o alias..."
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
                <th className="px-5 py-4 text-right sticky right-0 bg-surface-subtle shadow-[-8px_0_12px_rgba(0,0,0,0.06)] z-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-foreground-muted font-mono">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    Cargando catálogo de empresas...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-foreground-muted font-mono italic">
                    No se encontraron registros de empresas.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr 
                    key={item.id} 
                    className="group hover:bg-hover transition-colors whitespace-nowrap"
                  >
                    <td className="px-5 py-4 font-mono text-primary font-bold">
                      {item.id}
                    </td>
                    <td className="px-5 py-4 font-mono text-foreground-secondary">
                      {item.codigo || "-"}
                    </td>
                    <td className="px-5 py-4 font-mono text-foreground font-bold">
                      {item.rnc}
                    </td>
                    <td className="px-5 py-4 font-bold text-foreground text-sm">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-border"
                          style={{ backgroundColor: item.color_identificador || '#5c701b' }}
                          title={`Color: ${item.color_identificador}`}
                        />
                        {item.logotipo_url ? (
                          <img 
                            src={item.logotipo_url} 
                            alt={item.nombre_comercial} 
                            className="w-6 h-6 rounded-md object-cover border border-border"
                          />
                        ) : null}
                        <span>{item.nombre_comercial}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary italic">
                      {item.alias || "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-subtle text-foreground-secondary border border-border font-mono text-[10px]">
                        {item.tipo_empresa_nombre || "General"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-foreground-muted font-mono">
                      {item.empresa_padre_nombre || "Ninguna"}
                    </td>
                    <td className="px-5 py-4 font-mono text-foreground-secondary">
                      {item.telefono || "-"}
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary">
                      {item.email || "-"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        (item.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-surface-subtle text-foreground-muted border-border"
                      }`}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-foreground-muted">
                      {item.fecha_registro ? String(item.fecha_registro).substring(0, 10) : "-"}
                    </td>
                    <td className="px-5 py-4 text-right sticky right-0 bg-card group-hover:bg-hover shadow-[-8px_0_12px_rgba(0,0,0,0.06)] z-10 transition-colors">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 bg-surface hover:bg-primary/20 text-foreground-secondary hover:text-primary border border-border hover:border-primary/40 rounded-lg transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setItemToDelete(item); setIsDeletingModalOpen(true); }}
                          className="p-2 bg-surface hover:bg-error/20 text-foreground-secondary hover:text-error border border-border hover:border-error/40 rounded-lg transition-all cursor-pointer"
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
        <div className="bg-surface-subtle p-4 border-t border-border flex items-center justify-between font-mono text-xs">
          <p className="text-foreground-muted text-[11px]">
            Mostrando <span className="text-foreground font-bold">{paginatedData.length}</span> de <span className="text-foreground font-bold">{filteredData.length}</span> registros
          </p>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-surface border border-border text-foreground-secondary rounded-lg hover:bg-hover hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                type="button"
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  page === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-foreground-secondary hover:bg-hover hover:text-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-surface border border-border text-foreground-secondary rounded-lg hover:bg-hover hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                  {editingItem ? "Editar Empresa" : "Nueva Empresa"}
                </h2>
                <p className="text-xs text-foreground-muted mt-0.5 font-sans">
                  {editingItem ? "Modifica la información registrada de la empresa." : "Completa todos los campos para registrar una nueva empresa."}
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
              
              {/* SECCIÓN 1: INFORMACIÓN GENERAL */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs text-primary font-bold tracking-wider uppercase border-b border-border pb-1 flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>Información General</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* RNC */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      RNC *
                    </label>
                    <input 
                      type="text"
                      required
                      maxLength={11}
                      value={formData.rnc}
                      onChange={(e) => handleRncChange(e.target.value)}
                      placeholder="Ej. 101123456 o 13145678901"
                      className={`w-full bg-input border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                        formErrors.rnc ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                      }`}
                    />
                    {formErrors.rnc && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                        <AlertCircle size={12} className="shrink-0 text-error" />
                        <span>{formErrors.rnc}</span>
                      </div>
                    )}
                  </div>

                  {/* CÓDIGO */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      Código
                    </label>
                    <input 
                      type="text"
                      value={formData.codigo}
                      onChange={(e) => updateField("codigo", e.target.value)}
                      placeholder="Ej. EMP-001"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  {/* NOMBRE COMERCIAL */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      Nombre Comercial *
                    </label>
                    <input 
                      type="text"
                      required
                      value={formData.nombre_comercial}
                      onChange={(e) => updateField("nombre_comercial", e.target.value)}
                      placeholder="Ej. Ride Lab Taller Santo Domingo S.R.L."
                      className={`w-full bg-input border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                        formErrors.nombre_comercial ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                      }`}
                    />
                    {formErrors.nombre_comercial && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                        <AlertCircle size={12} className="shrink-0 text-error" />
                        <span>{formErrors.nombre_comercial}</span>
                      </div>
                    )}
                  </div>

                  {/* ALIAS */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      Alias
                    </label>
                    <input 
                      type="text"
                      value={formData.alias}
                      onChange={(e) => updateField("alias", e.target.value)}
                      placeholder="Ej. Ride Lab SD"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: ORGANIZACIÓN Y CONTACTO */}
              <div className="space-y-3 pt-1">
                <h3 className="font-mono text-xs text-primary font-bold tracking-wider uppercase border-b border-border pb-1 flex items-center gap-1.5">
                  <Shield size={13} />
                  <span>Organización y Contacto</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* TIPO DE EMPRESA */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      Tipo de Empresa *
                    </label>
                    <select 
                      required
                      value={formData.tipo_empresa_id !== null && formData.tipo_empresa_id !== undefined ? String(formData.tipo_empresa_id) : ""}
                      onChange={(e) => updateField("tipo_empresa_id", e.target.value)}
                      className={`w-full bg-input border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none transition-all ${
                        formErrors.tipo_empresa_id ? "border-error focus:border-error" : "border-border focus:border-primary"
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
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                        <AlertCircle size={12} className="shrink-0 text-error" />
                        <span>{formErrors.tipo_empresa_id}</span>
                      </div>
                    )}
                  </div>

                  {/* EMPRESA PADRE */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      Empresa Padre
                    </label>
                    <select 
                      value={formData.empresa_padre_id !== null && formData.empresa_padre_id !== undefined ? String(formData.empresa_padre_id) : ""}
                      onChange={(e) => updateField("empresa_padre_id", e.target.value)}
                      className="w-full bg-input border border-border rounded-xl px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
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
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Phone size={11} className="text-foreground-muted" />
                      <span>Teléfono</span>
                    </label>
                    <input 
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="Ej. (809) 555-0199"
                      className={`w-full bg-input border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                        formErrors.telefono ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                      }`}
                    />
                    {formErrors.telefono && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                        <AlertCircle size={12} className="shrink-0 text-error" />
                        <span>{formErrors.telefono}</span>
                      </div>
                    )}
                  </div>

                  {/* EMAIL */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Mail size={11} className="text-foreground-muted" />
                      <span>Email</span>
                    </label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="contacto@ridelab.com"
                      className={`w-full bg-input border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                        formErrors.email ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                      }`}
                    />
                    {formErrors.email && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                        <AlertCircle size={12} className="shrink-0 text-error" />
                        <span>{formErrors.email}</span>
                      </div>
                    )}
                  </div>

                  {/* DIRECCIÓN */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block flex items-center gap-1">
                      <MapPin size={11} className="text-foreground-muted" />
                      <span>Dirección</span>
                    </label>
                    <input 
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ej. Av. 27 de Febrero #145, Santo Domingo"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: UBICACIÓN Y VISUALIZACIÓN */}
              <div className="space-y-3 pt-1">
                <h3 className="font-mono text-xs text-primary font-bold tracking-wider uppercase border-b border-border pb-1 flex items-center gap-1.5">
                  <Palette size={13} />
                  <span>Elementos Visuales</span>
                </h3>

                {/* LOGOTIPO URL */}
                <div className="space-y-1">
                  <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block flex items-center gap-1">
                    <ImageIcon size={11} className="text-foreground-muted" />
                    <span>Logotipo (Ruta / URL)</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={formData.logotipo_url}
                      onChange={(e) => updateField("logotipo_url", e.target.value)}
                      placeholder="Ej. /uploads/logo.png o https://..."
                      className={`flex-1 bg-input border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none transition-all ${
                        formErrors.logotipo_url ? "border-error focus:border-error text-error" : "border-border focus:border-primary"
                      }`}
                    />
                    <label className="px-3 py-2 bg-surface hover:bg-hover border border-border text-foreground-secondary hover:text-foreground rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors">
                      <Upload size={13} />
                      <span>Subir</span>
                      <input type="file" accept="image/*" onChange={handleLogoUploadSim} className="hidden" />
                    </label>
                  </div>
                  {formErrors.logotipo_url && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-mono">
                      <AlertCircle size={12} className="shrink-0 text-error" />
                      <span>{formErrors.logotipo_url}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* COLOR IDENTIFICADOR */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block flex items-center gap-1">
                      <Palette size={11} className="text-foreground-muted" />
                      <span>Color Identificador</span>
                    </label>
                    <div className="flex items-center gap-2 bg-input border border-border rounded-xl p-1">
                      <input 
                        type="color"
                        value={formData.color_identificador}
                        onChange={(e) => setFormData({ ...formData, color_identificador: e.target.value })}
                        className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer p-0 shrink-0"
                      />
                      <input 
                        type="text"
                        value={formData.color_identificador}
                        onChange={(e) => setFormData({ ...formData, color_identificador: e.target.value })}
                        placeholder="#5c701b"
                        className="w-full bg-transparent text-xs font-mono text-foreground focus:outline-none uppercase"
                      />
                    </div>
                  </div>

                  {/* ESTADO INICIAL */}
                  <div className="space-y-1">
                    <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                      ESTADO INICIAL
                    </label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div 
                        onClick={() => setFormData({ ...formData, estado: "Activo" })}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          (formData.estado || "").toUpperCase() === "ACTIVO" 
                            ? "bg-primary/10 border-2 border-primary" 
                            : "bg-input border-border hover:border-primary/40"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          (formData.estado || "").toUpperCase() === "ACTIVO" 
                            ? "border-primary" 
                            : "border-foreground-muted"
                        }`}>
                          {(formData.estado || "").toUpperCase() === "ACTIVO" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-foreground leading-tight">Activo</p>
                          <p className="text-[8px] text-foreground-muted">Visible</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => setFormData({ ...formData, estado: "Inactivo" })}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                          (formData.estado || "").toUpperCase() === "INACTIVO" 
                            ? "bg-error/10 border-2 border-error" 
                            : "bg-input border-border hover:border-error/40"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          (formData.estado || "").toUpperCase() === "INACTIVO" 
                            ? "border-error" 
                            : "border-foreground-muted"
                        }`}>
                          {(formData.estado || "").toUpperCase() === "INACTIVO" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-error" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-foreground leading-tight">Inactivo</p>
                          <p className="text-[8px] text-foreground-muted">Oculto</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: DESCRIPCIÓN */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[11px] text-foreground-secondary font-bold tracking-wider uppercase block">
                    DESCRIPCIÓN
                  </label>
                  <span className="text-[9px] font-mono text-foreground-muted">
                    {formData.descripcion.length} / 500
                  </span>
                </div>
                <textarea 
                  rows={2.5}
                  maxLength={500}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Breve descripción del objeto o propósito comercial de la empresa..."
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary resize-none transition-all"
                />
              </div>

              {/* Info Notice Box */}
              <div className="p-3 bg-surface-subtle border border-border rounded-xl flex items-center gap-2.5">
                <Info size={16} className="text-primary shrink-0" />
                <p className="text-[11px] text-foreground-secondary leading-tight font-sans">
                  Asegúrese de que el RNC sea único en el sistema para evitar duplicados fiscales.
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
                disabled={isSaving || Object.values(formErrors).some(Boolean)}
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
        title="¿Eliminar Empresa?"
        description={`¿Está seguro que desea eliminar permanentemente la empresa "${itemToDelete?.nombre_comercial || itemToDelete?.razon_social || ''}"? Esta acción es irreversible.`}
        confirmLabel="Eliminar"
        isLoading={isSaving}
        loadingLabel="Eliminando..."
        details={itemToDelete ? [
          { label: 'Nombre Comercial', value: itemToDelete.nombre_comercial || itemToDelete.razon_social },
          { label: 'RNC', value: itemToDelete.rnc, isCode: true }
        ] : null}
      />
    </div>
  );
}
