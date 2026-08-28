"use client";

import React, { useState, useEffect } from "react";
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
  Phone,
  Mail,
  Award,
  ArrowLeft,
  Download,
  CreditCard,
  Bike,
  ChevronRight,
  Wrench,
  Calendar,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Check,
  Package
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import BicyclesView from "@/components/crm/BicyclesView";
import BikeFormDrawer from "@/components/crm/BikeFormDrawer";

// Helper functions for Dominican Cédula, RNC, and Phone
export const normalizeDigits = (value) => {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
};

export const formatCedula = (value) => {
  const digits = normalizeDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10, 11)}`;
};

export const formatRnc = (value) => {
  const digits = normalizeDigits(value).slice(0, 9);
  if (digits.length <= 1) return digits;
  if (digits.length <= 3) return `${digits.slice(0, 1)}-${digits.slice(1)}`;
  if (digits.length <= 8) return `${digits.slice(0, 1)}-${digits.slice(1, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 1)}-${digits.slice(1, 3)}-${digits.slice(3, 8)}-${digits.slice(8, 9)}`;
};

export const formatDominicanPhone = (value) => {
  if (!value) return "";
  const str = String(value).trim();
  const hasPlusOne = str.startsWith("+1") || str.startsWith("+ 1");
  const digits = normalizeDigits(value);

  if ((digits.startsWith("1") && digits.length > 10) || hasPlusOne) {
    const main10 = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);
    if (main10.length <= 3) return `+1 ${main10}`;
    if (main10.length <= 6) return `+1 ${main10.slice(0, 3)}-${main10.slice(3)}`;
    return `+1 ${main10.slice(0, 3)}-${main10.slice(3, 6)}-${main10.slice(6, 10)}`;
  } else {
    const main10 = digits.slice(0, 10);
    if (main10.length <= 3) return main10;
    if (main10.length <= 6) return `${main10.slice(0, 3)}-${main10.slice(3)}`;
    return `${main10.slice(0, 3)}-${main10.slice(3, 6)}-${main10.slice(6, 10)}`;
  }
};

export const validateCedula = (value) => {
  if (!value || !value.trim()) return null;
  const digits = normalizeDigits(value);
  if (digits.length !== 11) {
    return "La Cédula debe contener 11 dígitos.";
  }
  return null;
};

export const validateRnc = (value) => {
  if (!value || !value.trim()) return null;
  const digits = normalizeDigits(value);
  if (digits.length !== 9) {
    return "El RNC debe contener 9 dígitos.";
  }
  return null;
};

export const validateDominicanPhone = (value) => {
  if (!value || !value.trim()) {
    return "El Teléfono Principal es obligatorio.";
  }
  const digits = normalizeDigits(value);
  const main10 = digits.startsWith("1") && digits.length >= 11 ? digits.slice(1) : digits;
  if (main10.length !== 10) {
    return "El teléfono debe contener 10 dígitos.";
  }
  const areaCode = main10.slice(0, 3);
  const validAreaCodes = ["809", "829", "849"];
  if (!validAreaCodes.includes(areaCode)) {
    return "Introduce un teléfono válido de República Dominicana (809, 829, 849).";
  }
  return null;
};

export const getContactPreferenceLabel = (whatsapp, email) => {
  const isWhatsapp = Boolean(whatsapp);
  const isEmail = Boolean(email);

  if (isWhatsapp && isEmail) return "WhatsApp / Email";
  if (isWhatsapp) return "WhatsApp";
  if (isEmail) return "Email";
  return "No especificado";
};

export default function CustomersView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // Detail 360 View State
  const [detailUser, setDetailUser] = useState(null);
  const [selectedBikeId, setSelectedBikeId] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});

  // Form Modal States
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
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Bike Drawer Modal States
  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [bikeFormData, setBikeFormData] = useState({
    marca: "",
    modelo: "",
    tipo_bicicleta: "MTB",
    ano: new Date().getFullYear(),
    color: "",
    talla: "M",
    numero_serie_cuadro: "",
    descripcion: "",
    kilometraje_actual: 0,
    notas_tecnicas: ""
  });
  const [bikeErrors, setBikeErrors] = useState({});
  const [isSavingBike, setIsSavingBike] = useState(false);
  const [bikeModalError, setBikeModalError] = useState(null);

  const handleOpenAddBikeModal = () => {
    setBikeFormData({
      marca: "",
      modelo: "",
      tipo_bicicleta: "MTB",
      ano: new Date().getFullYear(),
      color: "",
      talla: "M",
      numero_serie_cuadro: "",
      descripcion: "",
      kilometraje_actual: 0,
      notas_tecnicas: ""
    });
    setBikeErrors({});
    setBikeModalError(null);
    setIsBikeModalOpen(true);
  };

  const handleSaveBike = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setBikeModalError(null);

    const errs = {};
    const marcaRes = validateRequiredText(bikeFormData.marca, "La Marca", 100);
    if (!marcaRes.isValid) errs.marca = marcaRes.message;

    const modeloRes = validateRequiredText(bikeFormData.modelo, "El Modelo", 100);
    if (!modeloRes.isValid) errs.modelo = modeloRes.message;

    if (Object.keys(errs).length > 0) {
      setBikeErrors(errs);
      const firstErr = Object.values(errs)[0];
      setBikeModalError(firstErr);
      showToast(firstErr, "error");
      return;
    }

    setIsSavingBike(true);
    try {
      const targetClienteId = detailUser?.id ?? detailUser?.cliente_id;
      const payload = {
        cliente_id: targetClienteId,
        ...bikeFormData
      };

      const res = await fetch("/api/crm/bicicletas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.error) {
        const errorMsg = json?.error || json?.message || `No fue posible registrar la bicicleta (${res.status})`;
        setBikeModalError(errorMsg);
        showToast(errorMsg, "error");
        return;
      }

      showToast("Bicicleta registrada correctamente", "success");
      setIsBikeModalOpen(false);
      setBikeModalError(null);
      setBikeErrors({});

      // Refresh customer detail and global list
      if (targetClienteId || targetClienteId === 0) {
        const resDetail = await fetch(`/api/crm/clientes/${targetClienteId}`);
        if (resDetail.ok) {
          const freshDetail = await resDetail.json();
          setDetailUser(freshDetail?.data || freshDetail);
        }
      }
      fetchData();
    } catch (err) {
      const msg = err.message || "Error al registrar la bicicleta.";
      setBikeModalError(msg);
      showToast(msg, "error");
    } finally {
      setIsSavingBike(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isBikeModalOpen) {
          setIsBikeModalOpen(false);
          setBikeErrors({});
          setBikeModalError(null);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
          setErrors({});
          setModalError(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isBikeModalOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/clientes");
      if (res.ok) {
        const result = await res.json();
        setData(Array.isArray(result) ? result : (result.data || []));
      } else {
        showToast("Error al cargar los clientes.", "error");
      }
    } catch (err) {
      console.error("Error fetching clientes:", err);
      showToast("Error de conexión al cargar clientes.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getTipoClienteLabel = (tipo) => {
    const val = (tipo || "").toUpperCase();
    if (val === "EMPRESA") return "Empresa";
    return "Persona";
  };

  const validateForm = () => {
    const errs = {};
    setModalError(null);

    const nameRes = validateRequiredText(formData.nombre, "El Nombre", 100);
    if (!nameRes.isValid) errs.nombre = nameRes.message;

    if (!formData.tipo_cliente || !['PERSONA', 'EMPRESA'].includes(formData.tipo_cliente.toUpperCase())) {
      errs.tipo_cliente = "Debe seleccionar el tipo de cliente.";
    }

    const phoneErr = validateDominicanPhone(formData.telefono_principal);
    if (phoneErr) errs.telefono_principal = phoneErr;

    if (formData.identificacion && formData.identificacion.trim()) {
      const isEmpresa = formData.tipo_cliente?.toUpperCase() === "EMPRESA";
      const identErr = isEmpresa
        ? validateRnc(formData.identificacion)
        : validateCedula(formData.identificacion);
      if (identErr) errs.identificacion = identErr;
    }

    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())) {
      errs.correo = "El formato del correo electrónico no es válido.";
    }

    if (formData.ciudad && formData.ciudad.length > 100) {
      errs.ciudad = "La Ciudad no puede exceder los 100 caracteres.";
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      const firstMsg = Object.values(errs)[0];
      setModalError(firstMsg);
      showToast(firstMsg, "error");
      return false;
    }

    return true;
  };

  const handleOpenDrawer = (item = null) => {
    setModalError(null);
    if (item) {
      setEditingItem(item);
      let defaultNombre = item.nombre || "";
      let defaultApellido = item.apellido || "";
      if (!defaultNombre && item.nombre_completo) {
        const parts = item.nombre_completo.trim().split(" ");
        defaultNombre = parts[0] || "";
        defaultApellido = parts.slice(1).join(" ") || "";
      }
      const rawTipo = (item.tipo_cliente || "").toUpperCase();
      const validTipo = ['PERSONA', 'EMPRESA'].includes(rawTipo) ? rawTipo : 'PERSONA';
      const rawIdent = item.identificacion || "";
      const formattedIdent = validTipo === "EMPRESA" ? formatRnc(rawIdent) : formatCedula(rawIdent);
      const rawPhone = item.telefono_principal || "";
      const formattedPhone = formatDominicanPhone(rawPhone);

      setFormData({
        nombre: defaultNombre,
        apellido: defaultApellido,
        identificacion: formattedIdent,
        tipo_cliente: validTipo,
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

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setModalError(null);

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const targetId = editingItem?.id || editingItem?.cliente_id;
      const url = editingItem
        ? `/api/crm/clientes/${targetId}`
        : "/api/crm/clientes";
      const method = editingItem ? "PUT" : "POST";

      const payload = {
        ...formData,
        identificacion: normalizeDigits(formData.identificacion) || null,
        telefono_principal: normalizeDigits(formData.telefono_principal) || formData.telefono_principal
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const errorMsg = json?.message || json?.error || `No fue posible registrar el cliente (${res.status})`;
        if (json?.field) {
          const fieldKey = json.field === "correo_electronico" ? "correo" : json.field;
          setErrors((prev) => ({ ...prev, [fieldKey]: errorMsg }));
        }
        setModalError(errorMsg);
        showToast(errorMsg, "error");
        return;
      }

      const successMsg = json?.message || (editingItem ? "Cliente actualizado correctamente." : "Cliente registrado correctamente.");
      showToast(successMsg, "success");
      setIsDrawerOpen(false);
      setModalError(null);
      setErrors({});
      fetchData();

      const updatedId = targetId || json?.data?.id || json?.id || json?.cliente_id;
      if (detailUser && (detailUser.id === updatedId || detailUser.cliente_id === updatedId)) {
        try {
          const resDetail = await fetch(`/api/crm/clientes/${updatedId}`);
          if (resDetail.ok) {
            const freshDetail = await resDetail.json();
            setDetailUser(freshDetail?.data || freshDetail);
          }
        } catch (errDetail) {
          console.error("Error refreshing detailUser post-update:", errDetail);
        }
      }
    } catch (err) {
      const msg = err.message || "Error inesperado al guardar cliente.";
      setModalError(msg);
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id || itemToDelete.cliente_id;
    try {
      const res = await fetch(`/api/crm/clientes/${targetId}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const errorMsg = json?.message || json?.error || "No fue posible eliminar el cliente. Inténtalo nuevamente.";
        showToast(errorMsg, "error");
        setIsDeletingModalOpen(false);
        return;
      }

      showToast(json?.message || "Cliente eliminado correctamente.", "success");
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
    }
  };

  const handleViewDetail = async (item) => {
    try {
      const res = await fetch(`/api/crm/clientes/${item.id}`);
      if (res.ok) {
        const fullClient = await res.json();
        setDetailUser(fullClient);
      } else {
        setDetailUser(item);
      }
    } catch {
      setDetailUser(item);
    }
  };

  const getInitials = (name) => {
    if (!name) return "CL";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getTipoClienteBadge = (tipo) => {
    const label = getTipoClienteLabel(tipo);
    if (label === "Empresa") {
      return (
        <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-sm text-xs font-bold uppercase">
          Empresa
        </span>
      );
    }
    return (
      <span className="bg-[#bfce7f]/10 text-[#bfce7f] border border-[#bfce7f]/30 px-3 py-1 rounded-sm text-xs font-bold uppercase">
        Persona
      </span>
    );
  };

  // Filter & Sort Logic
  const filteredData = data.filter((item) => {
    const query = search.toLowerCase();
    const matchesSearch =
      (item.nombre_completo || "").toLowerCase().includes(query) ||
      (item.correo || "").toLowerCase().includes(query) ||
      (item.telefono_principal || "").toLowerCase().includes(query) ||
      (item.identificacion || "").toLowerCase().includes(query) ||
      (item.ciudad || "").toLowerCase().includes(query);

    const matchesLevel =
      levelFilter === "Todos" ||
      (item.tipo_cliente || "").toUpperCase() === levelFilter.toUpperCase();

    return matchesSearch && matchesLevel;
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

  // ---------------------------------------------------------------------------
  // RENDER CUSTOMER DETAIL VIEW (Identical to code.html in Recursos_bikers_stitch)
  // ---------------------------------------------------------------------------
  const totalGasto = detailUser ? Number(detailUser.total_gastado || detailUser.total_gastado_taller || 0) : 0;
  const bikesList = detailUser ? (detailUser.bicicletas || []) : [];
  const mainBike = bikesList.length > 0 ? bikesList[0] : null;
  const secondaryBikes = bikesList.length > 1 ? bikesList.slice(1) : [];

  const handleOpenBike = (bike) => {
    const targetId = bike?.bicicleta_id ?? bike?.id;
    if (!targetId && targetId !== 0) {
      showToast("No se pudo abrir la bicicleta seleccionada.", "error");
      return;
    }
    window.location.href = `/crm/bicycles?id=${targetId}&from=customer`;
  };

  return (
    <div className="w-full relative">
      {detailUser ? (
        <div className="max-w-[1550px] mx-auto space-y-8 animate-in fade-in duration-300 pb-12 font-mono text-xs">
          
          {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDetailUser(null)}
            className="flex items-center gap-2 text-xs font-mono text-[#bfce7f] hover:text-white transition-colors cursor-pointer bg-[#161a21] border border-[#2d3748] px-4 py-2 rounded-xl shadow-lg"
          >
            <ArrowLeft size={16} />
            <span>Volver al Directorio de Clientes</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenDrawer(detailUser)}
              className="px-4 py-2 bg-[#161a21] border border-[#2d3748] text-white hover:border-[#bfce7f] rounded-xl transition-colors cursor-pointer flex items-center gap-2"
            >
              <Edit2 size={14} /> Editar Cliente
            </button>
          </div>
        </div>

        {/* 1. Header / Profile Summary Section */}
        <section className="flex flex-col md:flex-row gap-6">
          
          {/* Client Hero Card */}
          <div className="flex-1 border border-[#2d3748] bg-[#161a21] p-6 flex flex-col sm:flex-row items-start gap-6 rounded-2xl shadow-xl">
            <div className="w-24 h-24 border border-[#2d3748] rounded-2xl overflow-hidden bg-[#0e1117] flex items-center justify-center text-[#bfce7f] font-mono text-2xl font-black shrink-0">
              {getInitials(detailUser.nombre_completo)}
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white mb-1">
                    {detailUser.nombre_completo}
                  </h1>
                  <p className="text-slate-400 font-mono text-xs">
                    ID: BF-CL-{detailUser.id} • REGISTRADO DESDE {detailUser.fecha_creacion ? String(detailUser.fecha_creacion).substring(0,10) : 'Fecha no registrada'}
                  </p>
                </div>
                <div>{getTipoClienteBadge(detailUser.tipo_cliente)}</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-[#2d3748]/60">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Contacto</span>
                  <span className="text-sm font-bold text-white">{detailUser.telefono_principal || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Email</span>
                  <span className="text-sm font-bold text-white">{detailUser.correo || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Ciudad</span>
                  <span className="text-sm font-bold text-white">{detailUser.ciudad || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Preferencias</span>
                  <span className="text-sm font-bold text-slate-300">
                    {getContactPreferenceLabel(detailUser.contacto_whatsapp, detailUser.contacto_email)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="w-full md:w-80 flex flex-col gap-4">
            <div className="border border-[#2d3748] bg-[#1c2129] p-5 rounded-2xl shadow-xl flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Gasto Total</span>
                <span className="text-2xl font-bold text-[#bfce7f]">
                  RD$ {totalGasto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <CreditCard className="text-slate-400" size={26} />
            </div>

            <div className="border border-[#2d3748] bg-[#1c2129] p-5 rounded-2xl shadow-xl flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase text-slate-400 mb-1 font-mono">Conteo de Activos</span>
                <span className="text-2xl font-bold text-white">
                  {detailUser.bicicletas ? detailUser.bicicletas.length : (detailUser.cantidad_bicicletas || 0)} Bicicletas
                </span>
              </div>
              <Bike className="text-slate-400" size={26} />
            </div>
          </div>

        </section>

        {/* 2. Asset Passport Section (Pasaporte del Activo) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="font-mono text-lg font-extrabold text-white uppercase tracking-tight">
              Bicicleta Activa
            </h2>
            <div className="h-[1px] flex-1 bg-[#2d3748]" />
            <button
              onClick={() => setIsBikeModalOpen(true)}
              className="text-xs font-mono text-[#bfce7f] border border-[#bfce7f] px-4 py-2 rounded-xl hover:bg-[#bfce7f] hover:text-[#1d1f18] transition-colors font-bold cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Plus size={14} /> Añadir Nueva Bicicleta
            </button>
          </div>

          {!mainBike ? (
            <div className="w-full border border-[#2d3748] bg-[#161a21] p-8 md:p-12 rounded-2xl flex flex-col items-center justify-center text-center font-mono space-y-3 shadow-xl min-h-[220px]">
              <div className="w-12 h-12 rounded-full bg-[#1c2129] border border-[#2d3748] flex items-center justify-center text-slate-400 shrink-0 mb-1">
                <Bike size={24} />
              </div>
              <div className="space-y-1.5 w-full flex flex-col items-center">
                <h3 className="text-white font-bold text-base tracking-tight font-mono">Sin bicicletas registradas</h3>
                <p className="text-slate-400 text-xs w-full max-w-[420px] mx-auto leading-relaxed text-center font-mono">
                  Este cliente no tiene bicicletas asignadas en el sistema.
                  <br className="hidden sm:inline" /> Puedes vincular una nueva bicicleta usando el botón superior.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Active Main Bike Card (8 cols) - Stays strictly un-stretched with items-start */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => handleOpenBike(mainBike)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenBike(mainBike);
                }
              }}
              className="lg:col-span-8 border border-[#2d3748] bg-[#161a21] rounded-2xl overflow-hidden shadow-xl self-start cursor-pointer group hover:border-[#bfce7f]/50 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-[#bfce7f]"
            >
              <div className="p-6 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 aspect-video border border-[#2d3748] rounded-xl relative overflow-hidden bg-[#0e1117] flex items-center justify-center shrink-0">
                  {mainBike && mainBike.foto_url ? (
                    <img
                      src={mainBike.foto_url}
                      alt={mainBike.modelo || "Bicicleta"}
                      className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#11151c] flex flex-col items-center justify-center space-y-2 p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#1c2129] border border-[#2d3748] flex items-center justify-center text-[#bfce7f] shadow-inner">
                        <Bike size={26} />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        {mainBike?.tipo_bicicleta || "Bicicleta"}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-[#0e1117]/90 px-2 py-1 text-[9px] font-mono border border-[#2d3748] text-[#bfce7f] font-bold rounded">
                    ACTIVO PRINCIPAL
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white font-mono group-hover:text-[#bfce7f] transition-colors">
                        {mainBike.marca} {mainBike.modelo}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        SERIE: {mainBike.numero_serie_cuadro || "Sin serie registrada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase text-slate-400 font-mono">Puntuación de Salud</span>
                      <span className={`text-lg font-bold ${mainBike.salud !== null && mainBike.salud !== undefined ? (mainBike.salud >= 80 ? 'text-[#bfce7f]' : mainBike.salud >= 60 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-400'}`}>
                        {mainBike.salud !== null && mainBike.salud !== undefined ? `${mainBike.salud}%` : "Sin evaluación"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 font-mono text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Tipo / Disciplina</span>
                      <span className="text-white font-bold">{mainBike.tipo_bicicleta || "MTB"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Año / Talla</span>
                      <span className="text-white font-bold">{mainBike.ano || "N/D"} • Talla {mainBike.talla || "N/D"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Kilometraje Actual</span>
                      <span className="text-white font-bold">{Number(mainBike.kilometraje_actual || 0).toLocaleString()} km</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Última Revisión</span>
                      <span className="text-white font-bold">{mainBike.fecha_ultima_revision ? String(mainBike.fecha_ultima_revision).substring(0, 10) : "Sin revisiones registradas"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Evaluation Bar */}
              <div className="bg-[#0e1117] border-t border-[#2d3748] p-4 font-mono">
                <div className="flex justify-between text-[10px] uppercase text-slate-400 mb-1.5">
                  <span>Estado General del Activo</span>
                  <span className={mainBike.salud !== null && mainBike.salud !== undefined ? (mainBike.salud >= 80 ? 'text-emerald-400 font-bold' : mainBike.salud >= 60 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold') : 'text-slate-400'}>
                    {mainBike.salud !== null && mainBike.salud !== undefined ? `${mainBike.salud}% • ${mainBike.salud >= 80 ? 'Óptimo' : mainBike.salud >= 60 ? 'Requiere Atención' : 'Crítico'}` : 'Sin evaluación técnica'}
                  </span>
                </div>
                <div className="h-2 bg-[#161a21] rounded-full overflow-hidden border border-[#2d3748]">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${mainBike.salud !== null && mainBike.salud !== undefined ? (mainBike.salud >= 80 ? 'bg-[#bfce7f]' : mainBike.salud >= 60 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-700'}`}
                    style={{ width: `${mainBike.salud !== null && mainBike.salud !== undefined ? mainBike.salud : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Secondary Bikes Column (4 cols) - Independent vertical stack & scroll */}
            <div className="lg:col-span-4 flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
              {secondaryBikes.map((bike, idx) => (
                <div
                  key={bike.bicicleta_id || bike.id || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenBike(bike)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenBike(bike);
                    }
                  }}
                  className="border border-[#2d3748] bg-[#161a21] p-5 rounded-2xl transition-all cursor-pointer group hover:border-[#bfce7f]/50 active:scale-[0.99] shadow-lg font-mono w-full shrink-0 focus:outline-none focus:ring-2 focus:ring-[#bfce7f]"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#bfce7f]/10 border border-[#bfce7f]/30 text-[#bfce7f] text-[10px] font-bold uppercase mb-2">
                        {bike.tipo_bicicleta || "MTB"}{bike.ano ? ` • ${bike.ano}` : ""}
                      </div>
                      <h4 className="text-base font-bold text-white truncate group-hover:text-[#bfce7f] transition-colors">
                        {bike.marca} {bike.modelo}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1 truncate">
                        SN: <span className="text-slate-300">{bike.numero_serie_cuadro || "Sin serie registrada"}</span>
                      </p>
                    </div>

                    <div className="w-24 h-18 rounded-xl border border-[#2d3748] bg-[#0e1117] overflow-hidden shrink-0 flex items-center justify-center">
                      {bike.foto_url ? (
                        <img
                          src={bike.foto_url}
                          alt={bike.modelo || "Bicicleta"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#11151c] flex flex-col items-center justify-center p-2 text-center">
                          <Bike size={20} className="text-[#bfce7f]" />
                          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase mt-1">
                            {bike.tipo_bicicleta || "Bici"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#2d3748] my-3.5" />

                  <div className="flex items-center gap-2 text-xs text-slate-300 mb-3">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{detailUser?.nombre_completo || "Sin nombre registrado"}</span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Salud Global</span>
                      <span className={`font-bold ${bike.salud !== null && bike.salud !== undefined ? (bike.salud >= 80 ? 'text-[#00e699]' : bike.salud >= 60 ? 'text-amber-400' : 'text-rose-400') : 'text-slate-400'}`}>
                        {bike.salud !== null && bike.salud !== undefined ? `${bike.salud}% ${bike.salud >= 80 ? 'ÓPTIMO' : 'REVISIÓN'}` : "Sin evaluación"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#0e1117] rounded-full overflow-hidden border border-[#2d3748]/60 mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${bike.salud !== null && bike.salud !== undefined ? (bike.salud >= 80 ? 'bg-[#00e699]' : bike.salud >= 60 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-700'}`}
                        style={{ width: `${bike.salud !== null && bike.salud !== undefined ? bike.salud : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
        <section className="space-y-4 font-mono">
          <div className="flex items-center gap-4">
            <h2 className="font-mono text-lg font-extrabold text-white uppercase tracking-tight">
              Historial de Mantenimiento
            </h2>
            <div className="h-[1px] flex-1 bg-[#2d3748]" />
          </div>

          {(!detailUser.ordenes || detailUser.ordenes.length === 0) ? (
            <div className="border border-[#2d3748] bg-[#161a21] p-8 rounded-2xl text-center text-slate-400 font-mono shadow-xl space-y-2">
              <Wrench size={32} className="mx-auto text-slate-500 mb-2" />
              <p className="text-white font-bold text-sm">Este cliente todavía no tiene órdenes de mantenimiento registradas.</p>
              <p className="text-xs text-slate-400">Las órdenes de trabajo y servicios asociados aparecerán registradas aquí.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {detailUser.ordenes.map((orden, idx) => {
                const otKey = orden.orden_trabajo_id || orden.id || idx;
                const isExpanded = !!expandedOrders[otKey]; // Default collapsed per user requirement
                const orderCode = orden.codigo_orden || `OT-2026-${String(orden.id || idx + 1).padStart(6, '0')}`;
                const orderDate = orden.fecha_recepcion 
                  ? new Date(orden.fecha_recepcion).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() 
                  : "21 JUL 2026";
                const estado = orden.estado_nombre || "En proceso";
                const mecanico = orden.mecanico_nombre || "Juan Pérez";
                const bikeInfo = (orden.bicicleta_marca && orden.bicicleta_modelo)
                  ? `${orden.bicicleta_marca} ${orden.bicicleta_modelo}`
                  : (mainBike ? `${mainBike.marca} ${mainBike.modelo}` : "Transition Spur Carbon");

                const servicios = orden.ordenes_servicio || [];
                const numServicios = servicios.length;
                const serviciosLabel = numServicios === 1 ? "1 servicio asociado" : `${numServicios} servicios asociados`;

                return (
                  <div key={otKey} className="border border-[#2d3748] bg-[#161a21] rounded-2xl p-5 shadow-xl text-xs hover:border-[#bfce7f]/40 transition-all space-y-4">
                    {/* 1. Header of Orden de Trabajo */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2d3748]">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-extrabold text-[#bfce7f] bg-[#bfce7f]/10 border border-[#bfce7f]/30 px-3 py-1 rounded-lg text-sm tracking-wider">
                            {orderCode}
                          </span>
                          <span className="text-slate-400 flex items-center gap-1.5 font-bold text-xs">
                            <Calendar size={14} className="text-slate-500" />
                            {orderDate}
                          </span>
                          <span className="text-slate-300 font-bold text-xs">
                            • {bikeInfo}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border-amber-500/30">
                            Estado: {estado}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                          <span>👨‍🔧 Mecánico: <strong className="text-slate-200">{mecanico}</strong></span>
                          <span>📦 <strong className="text-[#bfce7f]">{numServicios} servicio(s) asociado(s)</strong></span>
                          {orden.kilometraje_ingreso && <span>🛣️ Km Ingreso: <strong className="text-slate-200">{orden.kilometraje_ingreso} KM</strong></span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto shrink-0">
                        <div className="text-right">
                          <span className="block text-[10px] uppercase text-slate-400 font-bold">Total Orden:</span>
                          <span className="text-lg font-black text-white">
                            RD$ {Number(orden.costo || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetOrderId = orden.id || orden.orden_trabajo_id;
                            if (targetOrderId) {
                              window.location.href = `/work-orders?order_id=${targetOrderId}`;
                            } else {
                              showToast("No existe una orden de trabajo asociada a este registro.", "info");
                            }
                          }}
                          className="px-4 py-2 bg-[#bfce7f] text-[#1d1f18] font-bold text-xs rounded-xl hover:bg-[#a9ba6b] transition-colors cursor-pointer flex items-center gap-2 shadow-md shrink-0"
                        >
                          <span>Ver Orden de Trabajo</span>
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Sub-services Section Header */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2">
                        <Wrench size={14} className="text-[#bfce7f]" />
                        <span>ÓRDENES DE SERVICIO ASOCIADAS ({numServicios})</span>
                      </span>

                      <button
                        id={`toggle-ot-${otKey}`}
                        aria-expanded={isExpanded}
                        aria-controls={`services-ot-${otKey}`}
                        onClick={() => {
                          setExpandedOrders((prev) => ({
                            ...prev,
                            [otKey]: !isExpanded
                          }));
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#bfce7f] transition-colors cursor-pointer"
                      >
                        <span>{isExpanded ? "Ocultar servicios" : `Ver ${serviciosLabel}`}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* 3. Nested Service Orders List */}
                    {isExpanded && (
                      <div 
                        id={`services-ot-${otKey}`}
                        role="region"
                        aria-labelledby={`toggle-ot-${otKey}`}
                        className="space-y-3 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-[#2d3748] pt-2 animate-in fade-in duration-200"
                      >
                        {servicios.length === 0 ? (
                          <div className="p-4 bg-[#0e1117] border border-[#2d3748] rounded-xl text-center text-slate-400 text-xs">
                            Esta Orden de Trabajo todavía no tiene servicios registrados.
                          </div>
                        ) : (
                          servicios.map((os, osIdx) => (
                            <div key={os.id || osIdx} className="border border-[#2d3748] bg-[#0e1117] p-4 rounded-xl space-y-3 relative hover:border-[#bfce7f]/40 transition-all font-mono text-xs shadow-md">
                              {/* Service Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#2d3748]/60">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-[11px] font-bold text-[#bfce7f] bg-[#1c2129] border border-[#2d3748] px-2.5 py-0.5 rounded">
                                    {os.codigo_servicio || `OS-2026-${String(os.id || osIdx + 1).padStart(6, '0')}`}
                                  </span>
                                  <span className="font-bold text-white text-xs">
                                    {os.nombre_servicio || (os.categoria_nombre ? `Mantenimiento de ${os.categoria_nombre}` : "Servicio de mantenimiento")}
                                  </span>
                                  <span className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                    {os.nuevo_estado_nombre || "FINALIZADA"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <span className="text-xs font-bold text-white">
                                    RD$ {Number(os.costo || 0).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>

                              {/* Mechanic & Duration metadata */}
                              <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1 text-slate-300" title={os.mecanicos_lista && os.mecanicos_lista.length > 2 ? `Lista completa: ${os.mecanicos_lista.join(", ")}` : undefined}>
                                  👨‍🔧 {os.mecanico_label || "Mecánico"}: <strong className="text-slate-200">{os.mecanico_texto || "Sin mecánico registrado"}</strong>
                                </span>
                                <span className="flex items-center gap-1 text-amber-400 font-bold">
                                  <Clock size={12} /> Duración: <strong>{os.duracion_formateada || "Sin tiempo registrado"}</strong>
                                </span>
                              </div>

                              {/* Diagnostic & Work Done */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] bg-[#161a21] p-3 rounded-lg border border-[#2d3748]/50">
                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-[#bfce7f] mb-0.5">Diagnóstico:</span>
                                  <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
                                    {os.diagnostico || os.descripcion_servicio || orden.diagnostico_inicial || "Diagnóstico de servicio técnico registrado."}
                                  </p>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Trabajo realizado:</span>
                                  <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
                                    {os.trabajo_realizado || os.observacion_tecnica || "Esperando aprobación del cliente."}
                                  </p>
                                </div>
                              </div>

                              {/* Service Footer */}
                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span>Categoría: <strong className="text-slate-300">{os.categoria_nombre || "General"}</strong></span>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const targetOrderId = orden.id || orden.orden_trabajo_id;
                                    if (targetOrderId) {
                                      window.location.href = `/work-orders?order_id=${targetOrderId}&serviceId=${os.id}`;
                                    } else {
                                      showToast("No existe una orden de trabajo asociada a este registro.", "info");
                                    }
                                  }}
                                  className="text-xs text-[#bfce7f] hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <span>Ver Servicio</span>
                                  <ExternalLink size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200 ${
              toastMessage.type === "error"
                ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
                : toastMessage.type === "warning"
                ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
                : toastMessage.type === "info"
                ? "bg-sky-950/90 border-sky-500/50 text-sky-200"
                : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
            }`}
          >
            {toastMessage.type === "error" ? (
              <XCircle size={18} className="text-rose-400 shrink-0" />
            ) : toastMessage.type === "warning" ? (
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            ) : toastMessage.type === "info" ? (
              <Info size={18} className="text-sky-400 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

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
              <div className="p-5 border-b border-[#2d3748] bg-[#0e1117] flex items-start justify-between shrink-0 font-mono">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Users size={20} className="text-[#bfce7f]" />
                    {editingItem ? "Editar Cliente" : "Registrar Cliente"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingItem ? "Modifique la información registrada del cliente." : "Complete la información del nuevo cliente."}
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
                
                {/* Sección 1: Información Personal */}
                <div className="space-y-4">
                  <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] border-b border-[#2d3748] pb-1">
                    1. Información Personal
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 mb-1">Nombre <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Mateo"
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                          errors.nombre ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      />
                      {errors.nombre && <p className="text-rose-400 text-[10px] mt-1">{errors.nombre}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">Apellido</label>
                      <input
                        type="text"
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        placeholder="Ej: Rodríguez"
                        className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">
                        Tipo de Cliente <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={formData.tipo_cliente}
                        onChange={(e) => {
                          const newTipo = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            tipo_cliente: newTipo,
                            identificacion: ""
                          }));
                          setErrors(prev => ({ ...prev, tipo_cliente: null, identificacion: null }));
                        }}
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-all ${
                          errors.tipo_cliente ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      >
                        <option value="PERSONA">Persona</option>
                        <option value="EMPRESA">Empresa</option>
                      </select>
                      {errors.tipo_cliente && <p className="text-rose-400 text-[10px] mt-1">{errors.tipo_cliente}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">RNC o Cédula</label>
                      <input
                        type="text"
                        value={formData.identificacion}
                        onChange={(e) => {
                          const isEmpresa = formData.tipo_cliente?.toUpperCase() === "EMPRESA";
                          const formatted = isEmpresa
                            ? formatRnc(e.target.value)
                            : formatCedula(e.target.value);
                          setFormData(prev => ({ ...prev, identificacion: formatted }));
                          const err = isEmpresa ? validateRnc(formatted) : validateCedula(formatted);
                          setErrors(prev => ({ ...prev, identificacion: err }));
                        }}
                        placeholder={formData.tipo_cliente?.toUpperCase() === "EMPRESA" ? "Ej: 1-01-12345-6" : "Ej: 001-1234567-8"}
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                          errors.identificacion ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      />
                      {errors.identificacion && <p className="text-rose-400 text-[10px] mt-1">{errors.identificacion}</p>}
                    </div>
                  </div>
                </div>

                {/* Sección 2: Contacto y Dirección */}
                <div className="space-y-4">
                  <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] border-b border-[#2d3748] pb-1">
                    2. Información de Contacto y Dirección
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 mb-1">Teléfono Principal <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        value={formData.telefono_principal}
                        onChange={(e) => {
                          const formatted = formatDominicanPhone(e.target.value);
                          setFormData(prev => ({ ...prev, telefono_principal: formatted }));
                          const err = validateDominicanPhone(formatted);
                          setErrors(prev => ({ ...prev, telefono_principal: err }));
                        }}
                        placeholder="Ej: 809-555-1234"
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                          errors.telefono_principal ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      />
                      {errors.telefono_principal && <p className="text-rose-400 text-[10px] mt-1">{errors.telefono_principal}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">Correo Electrónico</label>
                      <input
                        type="email"
                        value={formData.correo}
                        onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                        placeholder="Ej: m.rod@email.com"
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                          errors.correo ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      />
                      {errors.correo && <p className="text-rose-400 text-[10px] mt-1">{errors.correo}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 mb-1">Dirección</label>
                      <input
                        type="text"
                        maxLength={200}
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Ej: Av. Winston Churchill #105"
                        className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">Ciudad</label>
                      <input
                        type="text"
                        maxLength={100}
                        value={formData.ciudad}
                        onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                        placeholder="Ej: Santo Domingo"
                        className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                          errors.ciudad ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                        }`}
                      />
                      {errors.ciudad && <p className="text-rose-400 text-[10px] mt-1">{errors.ciudad}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">Provincia</label>
                      <input
                        type="text"
                        maxLength={100}
                        value={formData.provincia}
                        onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                        placeholder="Ej: Distrito Nacional"
                        className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 mb-1">País</label>
                      <input
                        type="text"
                        maxLength={100}
                        value={formData.pais}
                        onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                        placeholder="Ej: República Dominicana"
                        className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Observaciones */}
                <div className="space-y-2">
                  <label className="block text-slate-300">Notas / Observaciones</label>
                  <textarea
                    rows={3}
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Detalles sobre las preferencias del cliente..."
                    className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-white focus:outline-none focus:border-[#bfce7f]"
                  />
                </div>

                {/* INFORMACIÓN DEL SISTEMA */}
                {editingItem && (
                  <div className="pt-3 border-t border-[#2d3748] space-y-1 font-mono text-[10px] text-slate-400">
                    <p className="font-bold text-slate-300">INFORMACIÓN DEL SISTEMA</p>
                    <p>ID Registro: #{editingItem.id || editingItem.cliente_id}</p>
                    <p>Fecha Creación: {editingItem.fecha_creacion || "—"}</p>
                    {editingItem.fecha_modificacion && <p>Última Modificación: {editingItem.fecha_modificacion}</p>}
                  </div>
                )}

              </form>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex items-center justify-end gap-3 shrink-0 font-mono">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#2d3748] bg-[#0e1117] text-slate-300 text-xs font-bold hover:bg-[#212631] hover:text-white transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#bfce7f] text-[#1d1f18] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>{editingItem ? "Guardar Cambios" : "Guardar Cliente"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        </div>
      ) : (
        <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Global Toast Notification Portal */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 2000000 }}
          className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 font-mono text-xs animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-950/50"
              : toastMessage.type === "warning"
              ? "bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-amber-950/50"
              : toastMessage.type === "info"
              ? "bg-sky-950/95 border-sky-500/80 text-sky-100 shadow-sky-950/50"
              : "bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50"
          }`}
        >
          {toastMessage.type === "error" ? (
            <XCircle size={18} className="text-rose-400 shrink-0" />
          ) : toastMessage.type === "warning" ? (
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          ) : toastMessage.type === "info" ? (
            <Info size={18} className="text-sky-400 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          )}
          <span className="font-bold">{toastMessage.text}</span>
        </div>,
        document.body
      )}

      {/* Header Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#bfce7f] mb-1">
            <span>CRM</span>
            <span>/</span>
            <span className="text-white font-bold">Clientes</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
            Directorio de Clientes
          </h1>
          <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
            Gestión integral de la base de datos de usuarios, lealtad y activos registrados.
          </p>
        </div>

        <button
          onClick={() => handleOpenDrawer()}
          className="bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={18} />
          Añadir Cliente
        </button>
      </div>

      {/* Filters & Loyalty Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Search & Level Filter Bar (8 cols) */}
        <div className="lg:col-span-8 bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o identificación..."
              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-[#0e1117] border border-[#2d3748] rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#bfce7f] cursor-pointer"
            >
              <option value="Todos">Todos los niveles</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="BRONZE">Bronze</option>
              <option value="STANDARD">Standard</option>
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

        {/* Loyalty Index Metric Card (4 cols) */}
        <div className="lg:col-span-4 bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              LOYALTY INDEX (RETENCIÓN)
            </span>
            <h3 className="font-mono text-3xl font-black text-white mt-1">
              84.2%
            </h3>
            <span className="text-emerald-400 font-mono text-[11px] font-bold block mt-1">
              ↑ +2.4% este mes
            </span>
          </div>
          <div className="p-3.5 bg-[#bfce7f]/10 border border-[#bfce7f]/30 rounded-xl text-[#bfce7f]">
            <Award size={26} />
          </div>
        </div>
      </div>

      {/* Main Data Table Card */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0e1117] border-b border-[#2d3748] select-none">
                <th
                  onClick={() => handleSort("nombre_completo")}
                  className="py-3.5 px-5 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CLIENTE</span>
                    <ArrowUpDown size={13} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tipo_cliente")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white text-center"
                >
                  TIPO CLIENTE
                </th>
                <th
                  onClick={() => handleSort("ciudad")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  CIUDAD
                </th>
                <th
                  onClick={() => handleSort("cantidad_bicicletas")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white text-center"
                >
                  ACTIVOS (BICICLETAS)
                </th>
                <th
                  onClick={() => handleSort("ultima_visita")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  ÚLTIMA VISITA
                </th>
                <th className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase text-right">
                  TELÉFONO
                </th>
                <th className="py-3.5 px-5 text-right text-slate-400 font-bold text-[11px] uppercase">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando directorio de clientes...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">
                    No se encontraron clientes registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#1f242d] transition-colors cursor-pointer group"
                    onClick={() => handleViewDetail(item)}
                  >
                    {/* Cliente */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#2d3748] flex items-center justify-center font-bold text-[#bfce7f] border border-[#3b475a] shrink-0">
                          {getInitials(item.nombre_completo)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white group-hover:text-[#bfce7f] transition-colors truncate">
                            {item.nombre_completo}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {item.correo || "Sin correo"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tipo Cliente */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold tracking-wider">
                        {getTipoClienteLabel(item.tipo_cliente)}
                      </span>
                    </td>

                    {/* Ciudad */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.ciudad || "—"}
                    </td>

                    {/* Activos */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-white bg-[#0e1117] border border-[#2d3748] px-2.5 py-1 rounded-lg">
                        {item.cantidad_bicicletas || 0} Bicis
                      </span>
                    </td>

                    {/* Última Visita */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.ultima_visita ? item.ultima_visita : "Sin visitas recientes"}
                    </td>

                    {/* Teléfono */}
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      {item.telefono_principal || "—"}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDrawer(item)}
                          title="Editar cliente"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            const bikeCount = Number(item.cantidad_bicicletas || 0);
                            if (bikeCount > 0) {
                              showToast("No se puede eliminar el cliente porque tiene bicicletas asignadas.", "error");
                              return;
                            }
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          disabled={Number(item.cantidad_bicicletas || 0) > 0}
                          title={Number(item.cantidad_bicicletas || 0) > 0 ? "No se puede eliminar porque tiene bicicletas asignadas" : "Eliminar cliente"}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            Number(item.cantidad_bicicletas || 0) > 0
                              ? "text-slate-600 opacity-40 cursor-not-allowed"
                              : "text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          }`}
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
            Mostrando {paginatedData.length} de {sortedData.length} clientes
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

      {/* PORTAL FOR SIDE DRAWER MODAL (Identical to ComponentCategoriesView) */}
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
            {/* Drawer Header (Fixed) */}
            <div className="p-5 border-b border-[#2d3748] bg-[#0e1117] flex items-start justify-between shrink-0 font-mono">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Users size={20} className="text-[#bfce7f]" />
                  {editingItem ? "Editar Cliente" : "Registrar Cliente"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingItem ? "Modifique la información registrada del cliente." : "Complete la información del nuevo cliente."}
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

            {/* Drawer Form Body (Scrollable) */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar font-mono text-xs">
              
              {/* Modal Error Alert Banner */}
              {modalError && (
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-3 font-mono animate-in fade-in duration-200">
                  <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                  <span className="font-bold">{modalError}</span>
                </div>
              )}

              {/* Sección 1: Información Personal */}
              <div className="space-y-4">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] border-b border-[#2d3748] pb-1">
                  1. Información Personal
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Nombre <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Mateo"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.nombre ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {errors.nombre && <p className="text-rose-400 text-[10px] mt-1">{errors.nombre}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Apellido</label>
                    <input
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      placeholder="Ej: Rodríguez"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">
                      Tipo de Cliente <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.tipo_cliente}
                      onChange={(e) => {
                        const newTipo = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          tipo_cliente: newTipo,
                          identificacion: ""
                        }));
                        setErrors(prev => ({ ...prev, tipo_cliente: null, identificacion: null }));
                      }}
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-all ${
                        errors.tipo_cliente ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    >
                      <option value="PERSONA">Persona</option>
                      <option value="EMPRESA">Empresa</option>
                    </select>
                    {errors.tipo_cliente && <p className="text-rose-400 text-[10px] mt-1">{errors.tipo_cliente}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">RNC o Cédula</label>
                    <input
                      type="text"
                      value={formData.identificacion}
                      onChange={(e) => {
                        const isEmpresa = formData.tipo_cliente?.toUpperCase() === "EMPRESA";
                        const formatted = isEmpresa
                          ? formatRnc(e.target.value)
                          : formatCedula(e.target.value);
                        setFormData(prev => ({ ...prev, identificacion: formatted }));
                        const err = isEmpresa ? validateRnc(formatted) : validateCedula(formatted);
                        setErrors(prev => ({ ...prev, identificacion: err }));
                      }}
                      placeholder={formData.tipo_cliente?.toUpperCase() === "EMPRESA" ? "Ej: 1-01-12345-6" : "Ej: 001-1234567-8"}
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.identificacion ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {errors.identificacion && <p className="text-rose-400 text-[10px] mt-1">{errors.identificacion}</p>}
                  </div>
                </div>
              </div>

              {/* Sección 2: Contacto y Dirección */}
              <div className="space-y-4">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] border-b border-[#2d3748] pb-1">
                  2. Información de Contacto y Dirección
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Teléfono Principal <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      value={formData.telefono_principal}
                      onChange={(e) => {
                        const formatted = formatDominicanPhone(e.target.value);
                        setFormData(prev => ({ ...prev, telefono_principal: formatted }));
                        const err = validateDominicanPhone(formatted);
                        setErrors(prev => ({ ...prev, telefono_principal: err }));
                      }}
                      placeholder="Ej: 809-555-1234"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.telefono_principal ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {errors.telefono_principal && <p className="text-rose-400 text-[10px] mt-1">{errors.telefono_principal}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      placeholder="Ej: m.rod@email.com"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.correo ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {errors.correo && <p className="text-rose-400 text-[10px] mt-1">{errors.correo}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 mb-1">Dirección</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ej: Av. Winston Churchill #105"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Ciudad</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                      placeholder="Ej: Santo Domingo"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.ciudad ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    />
                    {errors.ciudad && <p className="text-rose-400 text-[10px] mt-1">{errors.ciudad}</p>}
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Provincia</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={formData.provincia}
                      onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                      placeholder="Ej: Distrito Nacional"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 mb-1">País</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={formData.pais}
                      onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                      placeholder="Ej: República Dominicana"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-[#2d3748]/60">
                    <label className="block text-slate-300 mb-2 font-bold text-[11px] uppercase tracking-wider text-[#bfce7f]">
                      Canales de Contacto Autorizados
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2.5 bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 cursor-pointer hover:border-[#bfce7f]/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.contacto_whatsapp)}
                          onChange={(e) => setFormData({ ...formData, contacto_whatsapp: e.target.checked })}
                          className="rounded border-[#2d3748] text-[#bfce7f] focus:ring-0 focus:ring-offset-0 bg-[#161a21]"
                        />
                        <span className="text-white text-xs font-semibold">Autoriza WhatsApp</span>
                      </label>
                      <label className="flex items-center gap-2.5 bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 cursor-pointer hover:border-[#bfce7f]/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.contacto_email)}
                          onChange={(e) => setFormData({ ...formData, contacto_email: e.target.checked })}
                          className="rounded border-[#2d3748] text-[#bfce7f] focus:ring-0 focus:ring-offset-0 bg-[#161a21]"
                        />
                        <span className="text-white text-xs font-semibold">Autoriza Email</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 3: Observaciones */}
              <div className="space-y-2">
                <label className="block text-slate-300">Notas / Observaciones</label>
                <textarea
                  rows={3}
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Detalles sobre las preferencias del cliente..."
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              {/* INFORMACIÓN DEL SISTEMA */}
              {editingItem && (
                <div className="pt-3 border-t border-[#2d3748] space-y-1 font-mono text-[10px] text-slate-400">
                  <p className="font-bold text-slate-300">INFORMACIÓN DEL SISTEMA</p>
                  <p>ID Registro: #{editingItem.id || editingItem.cliente_id}</p>
                  <p>Fecha Creación: {editingItem.fecha_creacion || "—"}</p>
                  {editingItem.fecha_modificacion && <p>Última Modificación: {editingItem.fecha_modificacion}</p>}
                </div>
              )}

            </form>

            {/* Drawer Footer Actions (Fixed) */}
            <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex items-center justify-end gap-3 shrink-0 font-mono">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-[#2d3748] bg-[#0e1117] text-slate-300 text-xs font-bold hover:bg-[#212631] hover:text-white transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-[#bfce7f] text-[#1d1f18] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                <span>{editingItem ? "Guardar Cambios" : "Guardar Cliente"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(3px)', padding: '16px' }} className="font-mono text-xs">
          <div 
            style={{ width: '460px', maxWidth: '92vw', backgroundColor: '#161a21', border: '1px solid #2d3748', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}
            className="space-y-4 font-sans"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} className="shrink-0" />
              <h3 className="text-base font-bold text-white font-mono">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-300 font-mono text-xs leading-relaxed">
              ¿Está seguro de que desea eliminar al cliente{" "}
              <strong className="text-white">{itemToDelete.nombre_completo}</strong>? Esta acción actualizará la base de datos.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 font-mono">
              <button
                type="button"
                onClick={() => setIsDeletingModalOpen(false)}
                className="px-4 py-2 bg-[#2d3748] text-white font-bold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-500 transition-colors cursor-pointer"
              >
                Eliminar Cliente
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

        </div>
      )}

      {/* Single Top-Level Unified Instance of BikeFormDrawer */}
      <BikeFormDrawer
        isOpen={isBikeModalOpen}
        editingItem={null}
        clientes={data}
        preselectedClienteId={detailUser?.cliente_id ?? detailUser?.id ?? null}
        preselectedClienteName={detailUser ? (detailUser.nombre_completo || `${detailUser.nombre || ""} ${detailUser.apellido || ""}`.trim()) : ""}
        lockCliente={Boolean(detailUser)}
        onClose={() => setIsBikeModalOpen(false)}
        onSuccess={async () => {
          setIsBikeModalOpen(false);
          fetchData();
          const currentId = detailUser?.cliente_id ?? detailUser?.id;
          if (currentId) {
            try {
              const resDetail = await fetch(`/api/crm/clientes/${currentId}`);
              if (resDetail.ok) {
                const freshDetail = await resDetail.json();
                setDetailUser(freshDetail?.data || freshDetail);
              }
            } catch (err) {
              console.error("Error refreshing detailUser post-bike add:", err);
            }
          }
        }}
        showToast={showToast}
      />

    </div>
  );
}
