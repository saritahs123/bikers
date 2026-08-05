"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Layers,
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
  AlertCircle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";

export default function ComponentCategoriesView() {
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
      const res = await fetch("/api/crm/component-categories");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        showToast("Error al cargar las categorías de componentes.", "error");
      }
    } catch (err) {
      console.error("Error fetching categorías:", err);
      showToast("Error de conexión al cargar categorías.", "error");
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
    const codigoRes = validateRequiredText(formData.codigo, "El Código de la Categoría", 50);
    if (!codigoRes.isValid) {
      errs.codigo = codigoRes.message;
    }

    // Nombre validation
    const nameRes = validateRequiredText(formData.nombre, "El Nombre de la Categoría", 100);
    if (!nameRes.isValid) {
      errs.nombre = nameRes.message;
    }

    // Descripción max length
    if (formData.descripcion && formData.descripcion.length > 300) {
      errs.descripcion = "La Descripción no puede exceder los 300 caracteres.";
    }

    // Orden Visual validation
    if (formData.orden_visual === "" || formData.orden_visual === null || isNaN(Number(formData.orden_visual)) || Number(formData.orden_visual) < 0) {
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
        orden_visual: item.orden_visual !== undefined ? item.orden_visual : 0,
        activo: item.activo !== false
      });
    } else {
      setEditingItem(null);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
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
        ? `/api/crm/component-categories/${editingItem.id}`
        : "/api/crm/component-categories";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo guardar la categoría.");
      }

      showToast(
        editingItem
          ? "Categoría actualizada correctamente."
          : "Categoría creada exitosamente."
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
      const res = await fetch(`/api/crm/component-categories/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar la categoría.");

      showToast("Categoría eliminada correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Filter & Sort Logic
  const filteredData = data.filter((item) => {
    const query = search.toLowerCase();
    const matchesSearch =
      (item.codigo || "").toLowerCase().includes(query) ||
      (item.nombre || "").toLowerCase().includes(query) ||
      (item.descripcion || "").toLowerCase().includes(query);

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
            <span className="text-white font-bold">Categorías Componentes</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
            Catálogo de Categorías de Componentes
          </h1>
          <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
            Administración de grupos y clasificaciones de partes de bicicletas.
          </p>
        </div>

        <button
          onClick={() => handleOpenDrawer()}
          className="bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={18} />
          Nueva Categoría
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
                <th className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase">
                  DESCRIPCIÓN
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
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando categorías de componentes...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No se encontraron categorías registradas.
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

                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {item.descripcion || "—"}
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
                          title="Editar categoría"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          title="Eliminar categoría"
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
            Mostrando {paginatedData.length} de {sortedData.length} categorías
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

      {/* PORTAL FOR SIDE DRAWER MODAL (Identical to DepartmentsSecurityView) */}
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
                  <Layers size={20} className="text-[#bfce7f]" />
                  {editingItem ? "Editar Categoría de Componente" : "Nueva Categoría de Componente"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItem ? "Modifica los campos de la categoría seleccionada." : "Completa la información para registrar una nueva categoría."}
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
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar font-mono text-xs">
              
              {/* CÓDIGO */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  CÓDIGO *
                </label>
                <input 
                  type="text"
                  required
                  maxLength={50}
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ej. CAT-DRIVETRAIN, CAT-[#bfce7f]"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    errors.codigo ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.codigo && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{errors.codigo}</span>
                  </div>
                )}
              </div>

              {/* NOMBRE */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  NOMBRE DE LA CATEGORÍA *
                </label>
                <input 
                  type="text"
                  required
                  maxLength={100}
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Transmisión & Cambios, Suspensión"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    errors.nombre ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.nombre && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{errors.nombre}</span>
                  </div>
                )}
              </div>

              {/* DESCRIPCIÓN */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  DESCRIPCIÓN
                </label>
                <textarea 
                  rows={3}
                  maxLength={300}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción opcional de la categoría..."
                  className={`w-full bg-[#0e1e17] bg-[#0e1117] border rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    errors.descripcion ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.descripcion && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{errors.descripcion}</span>
                  </div>
                )}
              </div>

              {/* ORDEN VISUAL */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  ORDEN VISUAL *
                </label>
                <input 
                  type="number"
                  required
                  min={0}
                  value={formData.orden_visual}
                  onChange={(e) => setFormData({ ...formData, orden_visual: e.target.value })}
                  placeholder="0"
                  className={`w-full bg-[#0e1117] border rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    errors.orden_visual ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                  }`}
                />
                {errors.orden_visual && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-400 font-mono">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{errors.orden_visual}</span>
                  </div>
                )}
              </div>

              {/* ESTADO INICIAL (OPCIONES IGUALES A DEPARTAMENTOS) */}
              <div className="space-y-1 pt-2">
                <label className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase block">
                  ESTADO INICIAL
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Activo Option */}
                  <div 
                    onClick={() => setFormData({ ...formData, activo: true })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      formData.activo !== false 
                        ? "bg-[#bfce7f]/15 border-2 border-[#bfce7f]" 
                        : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.activo !== false 
                        ? "border-[#bfce7f]" 
                        : "border-slate-500"
                    }`}>
                      {formData.activo !== false && (
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
                    onClick={() => setFormData({ ...formData, activo: false })}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                      formData.activo === false 
                        ? "bg-rose-500/15 border-2 border-rose-400" 
                        : "bg-[#0e1117] border-[#2d3748] hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.activo === false 
                        ? "border-rose-400" 
                        : "border-slate-500"
                    }`}>
                      {formData.activo === false && (
                        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">Inactivo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Oculto del sistema</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN DEL SISTEMA */}
              {editingItem && (
                <div className="pt-3 border-t border-[#2d3748] space-y-1 font-mono text-[10px] text-slate-400">
                  <p className="font-bold text-slate-300">INFORMACIÓN DEL SISTEMA</p>
                  <p>ID Registro: #{editingItem.id}</p>
                  <p>Fecha Creación: {editingItem.fecha_creacion || "—"}</p>
                  {editingItem.fecha_modificacion && <p>Última Modificación: {editingItem.fecha_modificacion}</p>}
                </div>
              )}

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-[#2d3748] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#2d3748] bg-[#0e1117] text-slate-300 text-xs font-bold hover:bg-[#212631] hover:text-white transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#bfce7f] text-[#1d1f18] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{editingItem ? "Guardar Cambios" : "Crear Categoría"}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      {isDeletingModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle size={24} />
              <h3 className="text-base font-bold text-white">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-300">
              ¿Está seguro de que desea eliminar la categoría{" "}
              <strong className="text-white">{itemToDelete.nombre}</strong> ({itemToDelete.codigo})? Esta acción actualizará la base de datos.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDeletingModalOpen(false)}
                className="px-4 py-2 bg-[#2d3748] text-white rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-500 transition-colors cursor-pointer"
              >
                Eliminar Categoría
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
