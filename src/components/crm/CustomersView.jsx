"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  User,
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
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  ArrowLeft,
  Download,
  CreditCard,
  Bike,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Building2,
  UserCheck,
  Eye,
  MapPin
} from "lucide-react";
import CustomerFormDrawer from "./CustomerFormDrawer";
import {
  normalizeDigits,
  formatCedula,
  formatRnc,
  formatDominicanPhone,
  validateCedula,
  validateRnc,
  validateDominicanPhone,
  getContactPreferenceLabel
} from "@/lib/crm/customerValidation";

export {
  normalizeDigits,
  formatCedula,
  formatRnc,
  formatDominicanPhone,
  validateCedula,
  validateRnc,
  validateDominicanPhone,
  getContactPreferenceLabel
};

export const getTipoClienteLabel = (tipo) => {
  if (!tipo) return "Persona";
  const str = String(tipo).trim().toUpperCase();
  if (str === "EMPRESA" || str === "JURIDICA" || str === "ORGANIZACION") return "Empresa";
  return "Persona";
};

// ============================================================================
// MAIN COMPONENT: CustomersView
// ============================================================================
export default function CustomersView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [bikesFilter, setBikesFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // RBAC permissions state
  const [permissions, setPermissions] = useState({
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_eliminar: true,
    puede_exportar: true
  });

  // Detail 360 View State
  const [detailUser, setDetailUser] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});

  // Form Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    identificacion: "",
    tipo_cliente: "PERSONA",
    telefono_principal: "",
    telefono_secundario: "",
    correo: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    pais: "República Dominicana",
    fecha_nacimiento: "",
    genero: "",
    contacto_whatsapp: true,
    contacto_email: true,
    notas: ""
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal States
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Global Toast
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/clientes");
      if (res.ok) {
        // Read RBAC permissions from headers
        const permVer = res.headers.get("x-perm-ver");
        const permCrear = res.headers.get("x-perm-crear");
        const permEditar = res.headers.get("x-perm-editar");
        const permEliminar = res.headers.get("x-perm-eliminar");
        const permExportar = res.headers.get("x-perm-exportar");

        if (permVer !== null) {
          setPermissions({
            puede_ver: permVer === "true",
            puede_crear: permCrear === "true",
            puede_editar: permEditar === "true",
            puede_eliminar: permEliminar === "true",
            puede_exportar: permExportar === "true"
          });
        }

        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } else if (res.status === 403) {
        setPermissions((prev) => ({ ...prev, puede_ver: false }));
        showToast("No tienes permisos suficientes para consultar el CRM.", "error");
        setData([]);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      showToast("Error al consultar el directorio de clientes.", "error");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (item = null) => {
    if (!permissions.puede_crear && !item) {
      showToast("No tienes permisos para crear clientes.", "error");
      return;
    }
    if (!permissions.puede_editar && item) {
      showToast("No tienes permisos para editar clientes.", "error");
      return;
    }

    if (item) {
      setEditingItem(item);
      const isEmpresa = (item.tipo_cliente || "").toUpperCase() === "EMPRESA";
      const formattedIdent = isEmpresa
        ? formatRnc(item.identificacion || item.rnc || item.cedula || "")
        : formatCedula(item.identificacion || item.cedula || item.rnc || "");
      const formattedPhone = formatDominicanPhone(item.telefono_principal || "");

      setFormData({
        nombre: item.nombre || "",
        apellido: item.apellido || "",
        identificacion: formattedIdent,
        tipo_cliente: isEmpresa ? "EMPRESA" : "PERSONA",
        telefono_principal: formattedPhone,
        telefono_secundario: item.telefono_secundario || "",
        correo: item.correo || "",
        direccion: item.direccion || "",
        ciudad: item.ciudad || "",
        provincia: item.provincia || "",
        pais: item.pais || "República Dominicana",
        fecha_nacimiento: item.fecha_nacimiento ? String(item.fecha_nacimiento).substring(0, 10) : "",
        genero: item.genero || "",
        contacto_whatsapp: item.contacto_whatsapp !== false,
        contacto_email: item.contacto_email !== false,
        notas: item.notas || ""
      });
    } else {
      setEditingItem(null);
      setFormData({
        nombre: "",
        apellido: "",
        identificacion: "",
        tipo_cliente: "PERSONA",
        telefono_principal: "",
        telefono_secundario: "",
        correo: "",
        direccion: "",
        ciudad: "",
        provincia: "",
        pais: "República Dominicana",
        fecha_nacimiento: "",
        genero: "",
        contacto_whatsapp: true,
        contacto_email: true,
        notas: ""
      });
    }
    setErrors({});
    setIsDrawerOpen(true);
  };

  const validateForm = () => {
    const newErrors = {};
    const isEmpresa = formData.tipo_cliente?.toUpperCase() === "EMPRESA";

    if (!formData.nombre || !formData.nombre.trim()) {
      newErrors.nombre = isEmpresa ? "La Razón Social / Nombre de Empresa es obligatoria." : "El Nombre es obligatorio.";
    }

    const phoneErr = validateDominicanPhone(formData.telefono_principal);
    if (phoneErr) newErrors.telefono_principal = phoneErr;

    if (formData.identificacion && formData.identificacion.trim()) {
      const identErr = isEmpresa ? validateRnc(formData.identificacion) : validateCedula(formData.identificacion);
      if (identErr) newErrors.identificacion = identErr;
    }

    if (formData.correo && formData.correo.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.correo.trim())) {
        newErrors.correo = "El formato de correo electrónico es inválido.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const targetId = editingItem?.id || editingItem?.cliente_id;
      const url = editingItem ? `/api/crm/clientes/${targetId}` : "/api/crm/clientes";
      const method = editingItem ? "PUT" : "POST";

      const payload = {
        ...formData,
        nombre: formData.nombre.trim(),
        apellido: (formData.apellido || "").trim(),
        identificacion: normalizeDigits(formData.identificacion),
        telefono_principal: formData.telefono_principal.trim(),
        telefono_secundario: (formData.telefono_secundario || "").trim(),
        correo: (formData.correo || "").trim().toLowerCase(),
        direccion: (formData.direccion || "").trim(),
        ciudad: (formData.ciudad || "").trim(),
        provincia: (formData.provincia || "").trim(),
        pais: (formData.pais || "").trim(),
        contacto_whatsapp: Boolean(formData.contacto_whatsapp),
        contacto_email: Boolean(formData.contacto_email),
        notas: (formData.notas || "").trim()
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al guardar el cliente.");
      }

      showToast(
        editingItem ? "Cliente actualizado exitosamente." : "Cliente registrado exitosamente.",
        "success"
      );
      setIsDrawerOpen(false);

      if (detailUser && (detailUser.id === targetId || detailUser.cliente_id === targetId)) {
        handleViewDetail({ id: targetId });
      }

      fetchData();
    } catch (err) {
      console.error("Error saving customer:", err);
      showToast(err.message || "Error al guardar el cliente.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id || itemToDelete.cliente_id;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crm/clientes/${targetId}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        if (res.status === 409 || json?.error === "CLIENT_HAS_DEPENDENCIES" || json?.code === "CLIENT_HAS_DEPENDENCIES") {
          showToast(
            "No es posible eliminar este cliente porque posee registros relacionados (bicicletas, órdenes de trabajo, recepciones o facturación). Puedes desactivarlo para conservar su historial.",
            "warning"
          );
        } else if (res.status === 403) {
          showToast("No tienes permisos suficientes para eliminar clientes.", "error");
        } else {
          showToast(json?.message || "No fue posible eliminar el cliente.", "error");
        }
        setIsDeletingModalOpen(false);
        return;
      }

      showToast("Cliente eliminado correctamente.", "success");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      if (detailUser && (detailUser.id === targetId || detailUser.cliente_id === targetId)) {
        setDetailUser(null);
      }
      fetchData();
    } catch (err) {
      console.error("Error deleting customer:", err);
      showToast("No fue posible eliminar el cliente. Inténtalo nuevamente.", "error");
      setIsDeletingModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDetail = async (item) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/crm/clientes/${item.id || item.cliente_id}`);
      if (res.ok) {
        const fullClient = await res.json();
        setDetailUser(fullClient);
      } else {
        setDetailUser(item);
      }
    } catch {
      setDetailUser(item);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "CL";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getTipoBadge = (tipo) => {
    const label = getTipoClienteLabel(tipo);
    if (label === "Empresa") {
      return (
        <span className="inline-flex items-center gap-1 bg-info-muted text-info border border-info/30 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider">
          <Building2 size={12} />
          <span>Empresa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-primary-muted text-primary border border-primary/30 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider">
        <User size={12} />
        <span>Persona</span>
      </span>
    );
  };

  // Filter & Sort Logic across the whole company dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (item.nombre_completo || "").toLowerCase().includes(query) ||
        (item.correo || "").toLowerCase().includes(query) ||
        (item.telefono_principal || "").toLowerCase().includes(query) ||
        (item.identificacion || "").toLowerCase().includes(query) ||
        (item.ciudad || "").toLowerCase().includes(query);

      const matchesTipo =
        tipoFilter === "Todos" ||
        getTipoClienteLabel(item.tipo_cliente).toUpperCase() === tipoFilter.toUpperCase();

      const bikeCount = Number(item.cantidad_bicicletas || 0);
      const matchesBikes =
        bikesFilter === "Todos" ||
        (bikesFilter === "Con Bicicletas" ? bikeCount > 0 : bikeCount === 0);

      return matchesSearch && matchesTipo && matchesBikes;
    });
  }, [data, search, tipoFilter, bikesFilter]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const numA = Number(aVal);
      const numB = Number(bVal);
      if (!isNaN(numA) && !isNaN(numB) && String(aVal).trim() !== "" && String(bVal).trim() !== "") {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return sortDirection === "asc" ? -1 : 1;
      if (strA > strB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const exportToExcel = () => {
    if (!permissions.puede_exportar) {
      showToast("No tienes permisos para exportar datos.", "error");
      return;
    }
    if (sortedData.length === 0) {
      showToast("No hay registros para exportar con los filtros actuales.", "warning");
      return;
    }

    const headers = [
      "ID",
      "Nombre Completo",
      "Tipo Cliente",
      "Identificación",
      "Teléfono",
      "Correo",
      "Ciudad",
      "Provincia",
      "Bicicletas Registradas",
      "Preferencia Contacto"
    ];

    const rows = sortedData.map((c) => [
      c.id || c.cliente_id,
      `"${(c.nombre_completo || "").replace(/"/g, '""')}"`,
      getTipoClienteLabel(c.tipo_cliente),
      `"${c.identificacion || ""}"`,
      `"${c.telefono_principal || ""}"`,
      `"${c.correo || ""}"`,
      `"${c.ciudad || ""}"`,
      `"${c.provincia || ""}"`,
      c.cantidad_bicicletas || 0,
      `"${getContactPreferenceLabel(c.contacto_whatsapp, c.contacto_email)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Clientes_RideLab_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Archivo CSV exportado exitosamente (${sortedData.length} registros filtrados).`, "success");
  };

  // Global Company Metrics Computations
  const totalCount = data.length;
  const personasCount = data.filter((c) => getTipoClienteLabel(c.tipo_cliente) === "Persona").length;
  const empresasCount = data.filter((c) => getTipoClienteLabel(c.tipo_cliente) === "Empresa").length;
  const withBikesCount = data.filter((c) => Number(c.cantidad_bicicletas || 0) > 0).length;

  const renderSortableHeader = (label, columnKey, extraClass = "") => {
    const isSorted = sortColumn === columnKey;
    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`px-5 py-3.5 cursor-pointer select-none text-foreground-secondary hover:text-foreground transition-colors group/head ${extraClass}`}
      >
        <div className={`flex items-center gap-1.5 ${extraClass.includes("text-center") ? "justify-center" : extraClass.includes("text-right") ? "justify-end" : ""}`}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === "asc" ? (
              <ArrowUp size={13} className="text-primary shrink-0" />
            ) : (
              <ArrowDown size={13} className="text-primary shrink-0" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-foreground-disabled group-hover/head:text-foreground-muted opacity-40 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full relative font-sans text-foreground animate-in fade-in duration-300">
      {/* Global Toast Notification Portal */}
      {mounted && toastMessage && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", top: "24px", right: "24px", zIndex: 2000000 }}
          className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error"
              ? "bg-error-muted border-error/50 text-error shadow-error/10"
              : toastMessage.type === "warning"
              ? "bg-warning-muted border-warning/50 text-warning shadow-warning/10"
              : toastMessage.type === "info"
              ? "bg-info-muted border-info/50 text-info shadow-info/10"
              : "bg-success-muted border-success/50 text-success shadow-success/10"
          }`}
        >
          {toastMessage.type === "error" ? (
            <XCircle size={18} className="text-error shrink-0" />
          ) : toastMessage.type === "warning" ? (
            <AlertTriangle size={18} className="text-warning shrink-0" />
          ) : toastMessage.type === "info" ? (
            <Info size={18} className="text-info shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-success shrink-0" />
          )}
          <span className="font-bold">{toastMessage.text}</span>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 1. CUSTOMER 360 DETAIL VIEW                                               */}
      {/* ========================================================================= */}
      {detailUser ? (
        <div className="max-w-[1550px] mx-auto space-y-6 pb-12">
          {/* Top Navigation & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => setDetailUser(null)}
              className="flex items-center gap-2 text-xs font-mono text-primary hover:text-foreground transition-all cursor-pointer bg-surface border border-border px-4 py-2.5 rounded-xl shadow-sm hover:bg-hover"
            >
              <ArrowLeft size={16} />
              <span>Volver al Directorio</span>
            </button>

            <div className="flex items-center gap-3">
              {permissions.puede_editar && (
                <button
                  onClick={() => handleOpenDrawer(detailUser)}
                  className="px-4 py-2.5 bg-surface border border-border text-foreground hover:border-primary rounded-xl transition-all cursor-pointer flex items-center gap-2 font-mono text-xs font-bold hover:bg-hover shadow-sm"
                >
                  <Edit2 size={14} className="text-primary" />
                  <span>Editar Cliente</span>
                </button>
              )}

              {permissions.puede_eliminar && (
                <button
                  onClick={() => {
                    setItemToDelete(detailUser);
                    setIsDeletingModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-error-muted border border-error/30 text-error hover:bg-error/20 rounded-xl transition-all cursor-pointer flex items-center gap-2 font-mono text-xs font-bold shadow-sm"
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </div>

          {/* Client Hero & Contact Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Hero Profile (8 cols) */}
            <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-md flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-primary font-mono text-2xl font-black shrink-0 shadow-inner">
                  {getInitials(detailUser.nombre_completo)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight truncate">
                      {detailUser.nombre_completo}
                    </h1>
                    <div>{getTipoBadge(detailUser.tipo_cliente)}</div>
                  </div>

                  <p className="text-foreground-muted font-mono text-xs mt-1">
                    ID: <strong className="text-foreground">BF-CL-{detailUser.id || detailUser.cliente_id}</strong> • Registrado el {detailUser.fecha_creacion ? String(detailUser.fecha_creacion).substring(0, 10) : "No registrado"}
                  </p>

                  {/* Identification & Quick Contact Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border-subtle">
                    <div>
                      <span className="block text-[10px] uppercase text-foreground-muted font-mono mb-0.5">Identificación</span>
                      <span className="text-xs font-bold text-foreground font-mono">
                        {detailUser.identificacion || "N/A"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-foreground-muted font-mono mb-0.5">Teléfono</span>
                      {detailUser.telefono_principal && String(detailUser.telefono_principal).trim() !== "" ? (
                        <a
                          href={`tel:${detailUser.telefono_principal}`}
                          className="text-xs font-bold text-primary hover:underline font-mono inline-flex items-center gap-1"
                        >
                          <Phone size={11} />
                          {detailUser.telefono_principal}
                        </a>
                      ) : (
                        <span className="text-xs text-foreground-muted font-mono">N/A</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-foreground-muted font-mono mb-0.5">Correo</span>
                      {detailUser.correo && String(detailUser.correo).includes("@") ? (
                        <a
                          href={`mailto:${detailUser.correo}`}
                          className="text-xs font-bold text-primary hover:underline font-mono inline-flex items-center gap-1 truncate block max-w-[140px]"
                          title={detailUser.correo}
                        >
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate">{detailUser.correo}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-foreground-muted font-mono">N/A</span>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-foreground-muted font-mono mb-0.5">Canal de Contacto</span>
                      <span className="text-xs font-bold text-foreground-secondary font-mono">
                        {getContactPreferenceLabel(detailUser.contacto_whatsapp, detailUser.contacto_email)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {detailUser.direccion && (
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-2 text-xs text-foreground-muted font-mono">
                  <MapPin size={13} className="text-primary shrink-0" />
                  <span>{detailUser.direccion}, {detailUser.ciudad || "República Dominicana"}</span>
                </div>
              )}
            </div>

            {/* Quick Metrics (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-card border border-border p-5 rounded-2xl shadow-md flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase text-foreground-muted font-mono">Total Gastado en Taller</span>
                  <span className="text-2xl font-extrabold text-primary font-mono mt-0.5 block">
                    RD$ {Number(detailUser.total_gastado || detailUser.total_gastado_taller || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary">
                  <CreditCard size={24} />
                </div>
              </div>

              <div className="bg-card border border-border p-5 rounded-2xl shadow-md flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase text-foreground-muted font-mono">Bicicletas Registradas</span>
                  <span className="text-2xl font-extrabold text-foreground font-mono mt-0.5 block">
                    {detailUser.bicicletas ? detailUser.bicicletas.length : (detailUser.cantidad_bicicletas || 0)}
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary">
                  <Bike size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION: BICICLETAS DEL CLIENTE                                           */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Bike className="text-primary" size={20} />
                <h2 className="text-lg font-bold text-foreground tracking-tight font-mono">
                  Bicicletas del Cliente
                </h2>
                <span className="text-xs bg-surface-subtle border border-border px-2.5 py-0.5 rounded-full font-mono text-foreground-muted">
                  {detailUser.bicicletas ? detailUser.bicicletas.length : 0}
                </span>
              </div>

              <a
                href={`/crm/bicycles`}
                className="text-xs font-mono font-bold text-primary hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <span>Ir al Catálogo de Bicicletas</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {(!detailUser.bicicletas || detailUser.bicicletas.length === 0) ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center font-mono space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-foreground-muted mx-auto">
                  <Bike size={22} />
                </div>
                <h3 className="text-foreground font-bold text-sm">Sin bicicletas registradas</h3>
                <p className="text-foreground-muted text-xs max-w-md mx-auto">
                  Este cliente no tiene bicicletas asignadas en el sistema actualmente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detailUser.bicicletas.map((bike) => (
                  <div
                    key={bike.id || bike.bicicleta_id}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-surface-subtle border border-border text-primary text-[10px] font-mono font-bold uppercase">
                          {bike.tipo_bicicleta || "MTB"}
                        </span>
                        <span className="text-[10px] font-mono text-foreground-muted">
                          {bike.ano || "Año N/A"} • Talla {bike.talla || "M"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-foreground tracking-tight">
                        {bike.marca} {bike.modelo}
                      </h3>

                      <div className="mt-3 space-y-1 text-xs text-foreground-muted font-mono">
                        <p>Color: <strong className="text-foreground-secondary">{bike.color || "No especificado"}</strong></p>
                        <p>Serial Cuadro: <strong className="text-foreground-secondary">{bike.numero_serie_cuadro || "Sin serial"}</strong></p>
                        <p>Salud Global: <span className="text-foreground-muted font-bold">Sin evaluación</span></p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-[10px] text-foreground-muted font-mono">
                        {bike.kilometraje_actual ? `${bike.kilometraje_actual} KM` : "0 KM"}
                      </span>

                      <a
                        href={`/crm/bicycles?id=${bike.id || bike.bicicleta_id}`}
                        className="px-3 py-1.5 bg-surface border border-border hover:border-primary text-primary hover:text-foreground text-xs font-mono font-bold rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <span>Ver Bicicleta</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* SECTION: HISTORIAL DE ÓRDENES DE TRABAJO                                  */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Wrench className="text-primary" size={20} />
                <h2 className="text-lg font-bold text-foreground tracking-tight font-mono">
                  Historial de Órdenes de Trabajo
                </h2>
                <span className="text-xs bg-surface-subtle border border-border px-2.5 py-0.5 rounded-full font-mono text-foreground-muted">
                  {detailUser.ordenes ? detailUser.ordenes.length : 0}
                </span>
              </div>
            </div>

            {(!detailUser.ordenes || detailUser.ordenes.length === 0) ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center font-mono space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-foreground-muted mx-auto">
                  <Wrench size={22} />
                </div>
                <h3 className="text-foreground font-bold text-sm">Sin órdenes de trabajo registradas</h3>
                <p className="text-foreground-muted text-xs max-w-md mx-auto">
                  No existen registros de servicios ni recepciones de taller para este cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {detailUser.ordenes.map((orden) => {
                  const otId = orden.id || orden.orden_trabajo_id;
                  const isExpanded = Boolean(expandedOrders[otId]);
                  const subServices = orden.sub_servicios || orden.ordenes_servicio || [];

                  return (
                    <div
                      key={otId}
                      className="bg-card border border-border rounded-2xl p-5 shadow-sm transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary shrink-0">
                            <Wrench size={20} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-extrabold text-sm text-foreground">
                                {orden.numero_orden || `OT-${otId}`}
                              </span>
                              <span className="px-2.5 py-0.5 rounded bg-surface-subtle border border-border text-[10px] font-mono font-bold uppercase text-foreground-secondary">
                                {orden.estado || "COMPLETADA"}
                              </span>
                            </div>

                            <p className="text-xs text-foreground-muted font-mono mt-1">
                              Bicicleta: <strong className="text-foreground">{orden.bicicleta_marca || ""} {orden.bicicleta_modelo || ""}</strong> • Fecha: {orden.fecha_creacion ? String(orden.fecha_creacion).substring(0, 10) : "No registrada"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-border-subtle">
                          <div className="text-left md:text-right">
                            <span className="block text-[10px] uppercase text-foreground-muted font-mono">Total</span>
                            <span className="text-sm font-extrabold text-primary font-mono">
                              RD$ {Number(orden.total_orden || orden.costo || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {subServices.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedOrders((prev) => ({ ...prev, [otId]: !prev[otId] }))}
                                className="px-3 py-2 bg-surface border border-border text-foreground-secondary hover:text-foreground text-xs font-mono rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>{isExpanded ? "Ocultar" : "Servicios"} ({subServices.length})</span>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (otId) {
                                  window.location.href = `/work-orders?order_id=${otId}`;
                                } else {
                                  showToast("No existe una orden de trabajo asociada a este registro.", "info");
                                }
                              }}
                              className="px-4 py-2 bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              <span>Ver Orden</span>
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sub-services breakdown */}
                      {isExpanded && subServices.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                          <h4 className="text-xs font-bold text-foreground-secondary font-mono uppercase tracking-wider">
                            Servicios Incluidos en la Orden:
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {subServices.map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between text-xs font-mono"
                              >
                                <div>
                                  <span className="font-bold text-foreground block">{sub.tipo_servicio_nombre || sub.nombre || "Servicio General"}</span>
                                  <span className="text-[11px] text-foreground-muted">{sub.mecanico_nombre || "Mecánico asignado"}</span>
                                </div>
                                <span className="font-bold text-primary">
                                  RD$ {Number(sub.precio || sub.costo || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. DIRECTORY MAIN VIEW (Listado de Clientes)                             */
        /* ========================================================================= */
        <div className="max-w-[1550px] mx-auto space-y-6">
          {/* Header Title & Actions Bar */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-subtle border border-border text-primary text-[11px] font-mono font-bold tracking-wider uppercase mb-2 shadow-sm">
                <Users size={12} className="text-primary" />
                <span>CRM / Clientes</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                Directorio de Clientes
              </h1>
              <p className="text-sm text-foreground-muted mt-1">
                Gestión integral de clientes, preferencias de contacto y activos registrados.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {permissions.puede_exportar && (
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-hover border border-border text-foreground font-mono text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <Download size={14} className="text-primary" />
                  <span>Exportar CSV ({sortedData.length})</span>
                </button>
              )}

              {permissions.puede_crear && (
                <button
                  type="button"
                  onClick={() => handleOpenDrawer()}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Añadir Cliente</span>
                </button>
              )}
            </div>
          </div>

          {/* Summary Metrics Bar (3 Cards - Global Company Totals) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-foreground-muted font-bold">
                Métricas Globales de la Empresa
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase text-foreground-muted font-mono font-bold">Total Clientes</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-foreground font-mono mt-1 block">
                    {totalCount}
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary">
                  <Users size={22} />
                </div>
              </div>

              <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase text-foreground-muted font-mono font-bold">Segmentación</span>
                  <span className="text-sm md:text-base font-bold text-foreground font-mono mt-1 block">
                    {personasCount} Personas • {empresasCount} Empresas
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary">
                  <UserCheck size={22} />
                </div>
              </div>

              <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase text-foreground-muted font-mono font-bold">Parque de Bicicletas</span>
                  <span className="text-sm md:text-base font-bold text-foreground font-mono mt-1 block">
                    {withBikesCount} con Bicicletas ({totalCount > 0 ? Math.round((withBikesCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="p-3 bg-surface-subtle border border-border rounded-xl text-primary">
                  <Bike size={22} />
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nombre, cédula, RNC, teléfono, correo o ciudad..."
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <select
                value={tipoFilter}
                onChange={(e) => {
                  setTipoFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-surface border border-border rounded-xl px-3.5 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="Todos">Todos los tipos</option>
                <option value="PERSONA">Personas</option>
                <option value="EMPRESA">Empresas</option>
              </select>

              <select
                value={bikesFilter}
                onChange={(e) => {
                  setBikesFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-surface border border-border rounded-xl px-3.5 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="Todos">Todos los activos</option>
                <option value="Con Bicicletas">Con Bicicletas</option>
                <option value="Sin Bicicletas">Sin Bicicletas</option>
              </select>

              {(search || tipoFilter !== "Todos" || bikesFilter !== "Todos") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTipoFilter("Todos");
                    setBikesFilter("Todos");
                    setPage(1);
                  }}
                  className="px-3 py-2.5 bg-surface border border-border hover:bg-hover rounded-xl text-xs font-mono text-foreground-muted hover:text-foreground flex items-center gap-1 cursor-pointer transition-all"
                >
                  <X size={14} />
                  <span>Limpiar</span>
                </button>
              )}

              <button
                type="button"
                onClick={fetchData}
                title="Actualizar datos"
                className="p-2.5 bg-surface border border-border hover:bg-hover rounded-xl text-foreground-muted hover:text-foreground transition-all cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Data Presentation: Table (Desktop) & Cards (Mobile) */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-surface border-b border-border select-none">
                    {renderSortableHeader("CLIENTE", "nombre_completo", "py-3.5 px-5")}
                    {renderSortableHeader("TIPO", "tipo_cliente", "py-3.5 px-4 text-center")}
                    {renderSortableHeader("IDENTIFICACIÓN", "identificacion", "py-3.5 px-4")}
                    {renderSortableHeader("CIUDAD", "ciudad", "py-3.5 px-4")}
                    {renderSortableHeader("BICIS", "cantidad_bicicletas", "py-3.5 px-4 text-center")}
                    <th className="py-3.5 px-4 text-foreground-secondary font-bold text-[11px] uppercase">
                      CONTACTO
                    </th>
                    <th className="py-3.5 px-5 text-right text-foreground-secondary font-bold text-[11px] uppercase">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-foreground-muted font-mono">
                        <RefreshCw className="animate-spin inline-block mr-2 text-primary" size={18} />
                        Cargando directorio de clientes...
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-foreground-muted font-mono">
                        {data.length === 0 ? (
                          <div className="space-y-3">
                            <Users size={32} className="mx-auto text-foreground-disabled opacity-60" />
                            <p className="text-foreground font-bold">No hay clientes registrados en su empresa.</p>
                            {permissions.puede_crear && (
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer()}
                                className="px-4 py-2 bg-primary-button-bg text-primary-foreground font-bold text-xs rounded-xl"
                              >
                                Añadir Primer Cliente
                              </button>
                            )}
                          </div>
                        ) : (
                          <p>No se encontraron clientes con los filtros aplicados.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => (
                      <tr
                        key={item.id || item.cliente_id}
                        onClick={() => handleViewDetail(item)}
                        className="hover:bg-hover transition-colors cursor-pointer group"
                      >
                        {/* Cliente */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-primary shrink-0 font-mono shadow-inner">
                              {getInitials(item.nombre_completo)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {item.nombre_completo}
                              </span>
                              <span className="text-[11px] text-foreground-muted truncate">
                                {item.correo || "Sin correo"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Tipo Cliente */}
                        <td className="py-3.5 px-4 text-center">
                          {getTipoBadge(item.tipo_cliente)}
                        </td>

                        {/* Identificación */}
                        <td className="py-3.5 px-4 text-foreground-secondary font-mono">
                          {item.identificacion || "—"}
                        </td>

                        {/* Ciudad */}
                        <td className="py-3.5 px-4 text-foreground-secondary">
                          {item.ciudad || "—"}
                        </td>

                        {/* Activos (Bicicletas) */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-foreground bg-surface border border-border px-2.5 py-0.5 rounded-lg text-xs">
                            <Bike size={12} className="text-primary" />
                            <span>{item.cantidad_bicicletas || 0}</span>
                          </span>
                        </td>

                        {/* Contacto */}
                        <td className="py-3.5 px-4 text-foreground-secondary">
                          <span className="block">{item.telefono_principal || "—"}</span>
                          <span className="text-[10px] text-foreground-muted">
                            {getContactPreferenceLabel(item.contacto_whatsapp, item.contacto_email)}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewDetail(item)}
                              title="Ver ficha 360"
                              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-all cursor-pointer"
                            >
                              <Eye size={15} />
                            </button>

                            {permissions.puede_editar && (
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer(item)}
                                title="Editar cliente"
                                className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-hover rounded-lg transition-all cursor-pointer"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}

                            {permissions.puede_eliminar && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemToDelete(item);
                                  setIsDeletingModalOpen(true);
                                }}
                                title="Eliminar cliente"
                                className="p-1.5 text-error hover:bg-error-muted rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 size={15} />
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

            {/* Mobile Card List (< 768px) */}
            <div className="block md:hidden divide-y divide-border">
              {loading ? (
                <div className="p-8 text-center text-foreground-muted font-mono text-xs">
                  <RefreshCw className="animate-spin inline-block mr-2 text-primary" size={18} />
                  Cargando clientes...
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="p-8 text-center text-foreground-muted font-mono text-xs">
                  No se encontraron clientes con los filtros aplicados.
                </div>
              ) : (
                paginatedData.map((item) => (
                  <div
                    key={item.id || item.cliente_id}
                    onClick={() => handleViewDetail(item)}
                    className="p-4 hover:bg-hover transition-colors space-y-3 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center font-bold text-primary shrink-0 font-mono">
                          {getInitials(item.nombre_completo)}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{item.nombre_completo}</h3>
                          <p className="text-[11px] text-foreground-muted font-mono">{item.correo || "Sin correo"}</p>
                        </div>
                      </div>
                      <div>{getTipoBadge(item.tipo_cliente)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-foreground-muted pt-1">
                      <div>
                        <span className="block text-[10px] uppercase">Teléfono:</span>
                        <span className="text-foreground font-bold">{item.telefono_principal || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">Bicicletas:</span>
                        <span className="text-foreground font-bold">{item.cantidad_bicicletas || 0} registradas</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-[11px] text-foreground-muted font-mono">{item.ciudad || "Rep. Dominicana"}</span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(item)}
                          className="px-3 py-1.5 bg-surface border border-border text-xs font-mono rounded-lg text-foreground"
                        >
                          Ver 360
                        </button>
                        {permissions.puede_editar && (
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(item)}
                            className="p-1.5 text-foreground hover:bg-hover rounded-lg"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {permissions.puede_eliminar && (
                          <button
                            type="button"
                            onClick={() => {
                              setItemToDelete(item);
                              setIsDeletingModalOpen(true);
                            }}
                            className="p-1.5 text-error hover:bg-error-muted rounded-lg"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-surface border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-xs">
              <span className="text-foreground-muted">
                Mostrando {paginatedData.length} de {sortedData.length} clientes filtrados (Total en empresa: {totalCount})
              </span>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 text-foreground-muted">
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SIDE DRAWER FORM (Crear / Editar Cliente)                              */}
      {/* ========================================================================= */}
      <CustomerFormDrawer
        isOpen={isDrawerOpen}
        editingItem={editingItem}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        showToast={showToast}
      />

      {/* ========================================================================= */}
      {/* 4. DELETE CONFIRMATION MODAL                                             */}
      {/* ========================================================================= */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(3px)" }}
            onClick={() => !isDeleting && setIsDeletingModalOpen(false)}
          />

          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-[460px] shadow-2xl z-10 font-sans space-y-4">
            <div className="flex items-center gap-3 text-error">
              <div className="p-3 bg-error-muted border border-error/30 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">¿Confirmar Eliminación?</h3>
                <p className="text-xs text-foreground-muted font-mono">Esta acción verificará dependencias activas.</p>
              </div>
            </div>

            <p className="text-xs text-foreground-secondary font-mono leading-relaxed">
              ¿Estás seguro de que deseas eliminar al cliente <strong className="text-foreground">{itemToDelete.nombre_completo}</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeletingModalOpen(false)}
                className="px-4 py-2 bg-surface border border-border rounded-xl text-foreground-secondary hover:text-foreground font-bold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-error text-white font-bold rounded-xl hover:bg-error/90 cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                <span>{isDeleting ? "Eliminando..." : "Eliminar Cliente"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
