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
  AlertTriangle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function ComponentStatesView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/component-states");
      if (res.ok) {
        const result = await res.json();
        setData(result);
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

    // Nivel de Desgaste validation (0 - 100)
    if (
      formData.nivel_desgaste === "" ||
      formData.nivel_desgaste === null ||
      isNaN(Number(formData.nivel_desgaste)) ||
      Number(formData.nivel_desgaste) < 0 ||
      Number(formData.nivel_desgaste) > 100
    ) {
      errs.nivel_desgaste = "El Nivel de Desgaste es obligatorio y debe ser un número entre 0 y 100.";
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
        requiere_revision: item.requiere_revision === true,
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
        orden_visual: 0,
        activo: true
      });
    }
    setErrors({});
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const url = editingItem
        ? `/api/crm/component-states/${editingItem.id}`
        : "/api/crm/component-states";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo guardar el estado.");
      }

      showToast(
        editingItem
          ? "Estado de componente actualizado correctamente."
          : "Estado de componente creado exitosamente."
      );
      setIsDrawerOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/crm/component-states/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar el estado.");

      showToast("Estado de componente eliminado correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
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

    return matchesSearch && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortColumn] ?? "";
    let bVal = b[sortColumn] ?? "";

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
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#bfce7f] mb-1">
            <span>CRM</span>
            <span>/</span>
            <span className="text-white font-bold">Estados Componentes</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
            Catálogo de Estados de Componentes
          </h1>
          <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
            Administración de niveles de desgaste y requerimientos de revisión de partes.
          </p>
        </div>

        <button
          onClick={() => handleOpenDrawer()}
          className="bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={18} />
          Nuevo Estado
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre o descripción..."
            className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0e1117] border border-[#2d3748] rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#bfce7f] cursor-pointer"
          >
            <option value="Todos">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>

          <button
            onClick={fetchData}
            title="Refrescar datos"
            className="p-2.5 bg-[#0e1117] border border-[#2d3748] rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Data Table Card */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0e1117] border-b border-[#2d3748] select-none">
                <th
                  onClick={() => handleSort("id")}
                  className="py-3.5 px-5 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ID</span>
                    <ArrowUpDown size={13} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("codigo")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  CÓDIGO
                </th>
                <th
                  onClick={() => handleSort("nombre")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  NOMBRE
                </th>
                <th
                  onClick={() => handleSort("nivel_desgaste")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white text-center"
                >
                  NIVEL DESGASTE
                </th>
                <th
                  onClick={() => handleSort("requiere_revision")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white text-center"
                >
                  REQUIERE REVISIÓN
                </th>
                <th
                  onClick={() => handleSort("orden_visual")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white text-center"
                >
                  ORDEN VISUAL
                </th>
                <th className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase text-center">
                  ACTIVO
                </th>
                <th className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase">
                  FECHA CREACIÓN
                </th>
                <th className="py-3.5 px-5 text-right text-slate-400 font-bold text-[11px] uppercase">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando estados de componentes...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono">
                    No se encontraron estados registrados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#1f242d] transition-colors group"
                  >
                    <td className="py-3.5 px-5 font-bold text-[#bfce7f]">
                      #{item.id}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white">
                      {item.codigo}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white">
                      {item.nombre}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded border text-[11px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                        {item.nivel_desgaste}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          item.requiere_revision
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {item.requiere_revision ? "SÍ" : "NO"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-200">
                      {item.orden_visual}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          item.activo !== false
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {item.activo !== false ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {item.fecha_creacion || "—"}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDrawer(item)}
                          title="Editar estado"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          title="Eliminar estado"
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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

        {/* Table Footer & Pagination */}
        <div className="p-4 bg-[#0e1117] border-t border-[#2d3748] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-xs">
          <span className="text-slate-400">
            Mostrando {paginatedData.length} de {sortedData.length} estados
          </span>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-[#161a21] border border-[#2d3748] rounded-lg text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-slate-400">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-[#161a21] border border-[#2d3748] rounded-lg text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Siguiente
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
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity size={20} className="text-[#bfce7f]" />
                  {editingItem ? "Editar Estado de Componente" : "Nuevo Estado de Componente"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItem ? "Modifica los campos del estado seleccionado." : "Completa la información para registrar un nuevo estado de componente."}
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#2d3748] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              
              {/* CÓDIGO */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-2">
                  CÓDIGO DEL ESTADO <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.codigo}
                  onChange={(e) => {
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() });
                    if (errors.codigo) setErrors({ ...errors, codigo: null });
                  }}
                  placeholder="EJ. EXCELENTE, DESGASTADO, CRITICO"
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-2.5 font-mono text-xs text-white uppercase focus:outline-none ${
                    errors.codigo
                      ? "border-rose-500/80 focus:border-rose-500"
                      : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.codigo && (
                  <p className="text-rose-400 font-mono text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.codigo}
                  </p>
                )}
              </div>

              {/* NOMBRE */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-2">
                  NOMBRE DEL ESTADO <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.nombre}
                  onChange={(e) => {
                    setFormData({ ...formData, nombre: e.target.value });
                    if (errors.nombre) setErrors({ ...errors, nombre: null });
                  }}
                  placeholder="Ej. Excelente Estado / Desgaste Severo"
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none ${
                    errors.nombre
                      ? "border-rose-500/80 focus:border-rose-500"
                      : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.nombre && (
                  <p className="text-rose-400 font-mono text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.nombre}
                  </p>
                )}
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-2">
                  DESCRIPCIÓN
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={formData.descripcion}
                  onChange={(e) => {
                    setFormData({ ...formData, descripcion: e.target.value });
                    if (errors.descripcion) setErrors({ ...errors, descripcion: null });
                  }}
                  placeholder="Descripción opcional del estado de uso o desgaste..."
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none ${
                    errors.descripcion
                      ? "border-rose-500/80 focus:border-rose-500"
                      : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.descripcion && (
                  <p className="text-rose-400 font-mono text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.descripcion}
                  </p>
                )}
              </div>

              {/* NIVEL DE DESGASTE */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-2">
                  NIVEL DE DESGASTE (0% A 100%) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.nivel_desgaste}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setFormData({ ...formData, nivel_desgaste: val });
                    if (errors.nivel_desgaste) setErrors({ ...errors, nivel_desgaste: null });
                  }}
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none ${
                    errors.nivel_desgaste
                      ? "border-rose-500/80 focus:border-rose-500"
                      : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.nivel_desgaste && (
                  <p className="text-rose-400 font-mono text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.nivel_desgaste}
                  </p>
                )}
              </div>

              {/* REQUIERE REVISIÓN */}
              <div className="pt-2 pb-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.requiere_revision}
                    onChange={(e) => setFormData({ ...formData, requiere_revision: e.target.checked })}
                    className="w-4 h-4 rounded bg-[#0e1117] border-[#2d3748] text-[#bfce7f] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#bfce7f]"
                  />
                  <div>
                    <span className="text-xs font-mono font-bold text-white uppercase">REQUIERE REVISIÓN TÉCNICA</span>
                    <p className="text-[11px] text-slate-400 font-mono">Marca esta opción si las piezas en este estado requieren inspección prioritaria.</p>
                  </div>
                </label>
              </div>

              {/* ORDEN VISUAL */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-2">
                  ORDEN VISUAL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.orden_visual}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setFormData({ ...formData, orden_visual: val });
                    if (errors.orden_visual) setErrors({ ...errors, orden_visual: null });
                  }}
                  className={`w-full bg-[#0e1117] border rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none ${
                    errors.orden_visual
                      ? "border-rose-500/80 focus:border-rose-500"
                      : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.orden_visual && (
                  <p className="text-rose-400 font-mono text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} /> {errors.orden_visual}
                  </p>
                )}
              </div>

              {/* ESTADO ACTIVO */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 rounded bg-[#0e1117] border-[#2d3748] text-[#bfce7f] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#bfce7f]"
                  />
                  <span className="text-xs font-mono font-bold text-white uppercase">ESTADO REGISTRO ACTIVO</span>
                </label>
              </div>

              {/* System Audit Information */}
              {editingItem && (
                <div className="mt-6 pt-5 border-t border-[#2d3748] space-y-2 font-mono text-[11px] text-slate-400 bg-[#0e1117]/60 p-4 rounded-xl border">
                  <div className="flex items-center gap-2 font-bold text-slate-300 mb-1">
                    <Info size={14} className="text-[#bfce7f]" />
                    <span>Información del Sistema</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ID del Registro:</span>
                    <span className="text-white font-bold">#{editingItem.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fecha de Creación:</span>
                    <span className="text-white">{editingItem.fecha_creacion || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Última Modificación:</span>
                    <span className="text-white">{editingItem.fecha_modificacion || "—"}</span>
                  </div>
                </div>
              )}

              {/* Drawer Footer Buttons */}
              <div className="pt-6 border-t border-[#2d3748] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#2d3748] text-slate-300 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-mono text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="animate-spin" size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>{editingItem ? "Guardar Cambios" : "Crear Estado"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PORTAL FOR DELETE CONFIRMATION MODAL */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div 
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }} 
            onClick={() => setIsDeletingModalOpen(false)}
          />
          <div 
            style={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '440px', 
              backgroundColor: '#161a21', 
              border: '1px solid #2d3748', 
              borderRadius: '1rem', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', 
              padding: '1.5rem', 
              zIndex: 1000000 
            }}
            className="font-sans space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle size={24} />
              <h3 className="text-base font-bold text-white">Confirmar Eliminación</h3>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              ¿Está seguro de que desea eliminar el estado{" "}
              <strong className="text-white">"{itemToDelete.nombre}"</strong> ({itemToDelete.codigo})? Esta acción actualizará la base de datos.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsDeletingModalOpen(false)}
                className="px-4 py-2 bg-[#2d3748] text-white rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Eliminar Estado
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
