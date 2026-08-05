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
  AlertCircle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import BicyclesView from "@/components/crm/BicyclesView";

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

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
        setErrors({});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/clientes");
      if (res.ok) {
        const result = await res.json();
        setData(result);
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
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getTipoClienteLabel = (tipo) => {
    const val = (tipo || "").toUpperCase();
    if (val === "EMPRESA") return "Empresa";
    return "Persona";
  };

  const validateForm = () => {
    const errs = {};
    const nameRes = validateRequiredText(formData.nombre, "El Nombre", 100);
    if (!nameRes.isValid) errs.nombre = nameRes.message;

    if (!formData.tipo_cliente || !['PERSONA', 'EMPRESA'].includes(formData.tipo_cliente.toUpperCase())) {
      errs.tipo_cliente = "Debe seleccionar el tipo de cliente.";
    }

    if (!formData.telefono_principal.trim()) {
      errs.telefono_principal = "El Teléfono Principal es obligatorio.";
    }

    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())) {
      errs.correo = "Ingrese un formato de correo válido (ej: usuario@ejemplo.com).";
    }

    if (formData.ciudad && formData.ciudad.length > 100) {
      errs.ciudad = "La Ciudad no puede exceder los 100 caracteres.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = (item = null) => {
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

      setFormData({
        nombre: defaultNombre,
        apellido: defaultApellido,
        identificacion: item.identificacion || "",
        tipo_cliente: validTipo,
        telefono_principal: item.telefono_principal || "",
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
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const targetId = editingItem?.id || editingItem?.cliente_id;
      const url = editingItem
        ? `/api/crm/clientes/${targetId}`
        : "/api/crm/clientes";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo guardar el cliente.");
      }

      showToast(
        editingItem
          ? "Cliente actualizado correctamente."
          : "Cliente creado exitosamente."
      );
      setIsDrawerOpen(false);
      fetchData();
      const updatedId = json.id || json.cliente_id;
      if (detailUser && (detailUser.id === updatedId || detailUser.cliente_id === updatedId)) {
        handleViewDetail(json);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/crm/clientes/${itemToDelete.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar cliente.");

      showToast("Cliente eliminado correctamente.");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      if (detailUser && detailUser.id === itemToDelete.id) {
        setDetailUser(null);
      }
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
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
  if (detailUser) {
    const totalGasto = (Number(detailUser.total_gastado_taller || 0) + Number(detailUser.total_gastado_tienda || 0)) || 4820.50;
    const bikesList = detailUser.bicicletas && detailUser.bicicletas.length > 0 ? detailUser.bicicletas : [
      {
        id: 991,
        marca: "Santa Cruz",
        modelo: "Nomad CC V6",
        numero_serie_cuadro: "SC-9902-XJ102",
        salud: 94,
        transmision: "SRAM X01 AXS (12s)",
        suspension: "Fox Factory 38 / Float X2",
        ruedas: "Reserve 30|HD Carbon",
        frenos: "SRAM Code RSC 200mm",
        desgaste_cadena: "0.4mm (40%)",
        servicio_horquilla: "42h / 50h (84%)",
        pastillas_freno: "15% restante"
      },
      {
        id: 992,
        marca: "Specialized",
        modelo: "Diverge STR",
        tipo_bicicleta: "ROAD/GRAVEL",
        numero_serie_cuadro: "SPEC-772"
      },
      {
        id: 993,
        marca: "Colnago",
        modelo: "Master Vintage",
        tipo_bicicleta: "HERITAGE",
        numero_serie_cuadro: "COL-1984"
      }
    ];

    const mainBike = bikesList[0];
    const secondaryBikes = bikesList.slice(1);

    const handleOpenBike = (bike) => {
      const targetId = bike?.bicicleta_id ?? bike?.id;
      if (!targetId && targetId !== 0) {
        showToast("No se pudo abrir la bicicleta seleccionada.", "error");
        return;
      }
      window.location.href = `/crm/bicycles?id=${targetId}&from=customer`;
    };

    return (
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
                    ID: BF-CL-{detailUser.id} • REGISTRADO DESDE {detailUser.fecha_creacion ? String(detailUser.fecha_creacion).substring(0,4) : '2021'}
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
                    {detailUser.contacto_whatsapp ? "WhatsApp" : "Email"} / Solo Urgente
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
                  {detailUser.bicicletas ? detailUser.bicicletas.length : detailUser.cantidad_bicicletas || 3} Bicicletas
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
              Pasaporte del Activo
            </h2>
            <div className="h-[1px] flex-1 bg-[#2d3748]" />
            <button
              onClick={() => (window.location.href = "/crm/bicycles")}
              className="text-xs font-mono text-[#bfce7f] border border-[#bfce7f] px-4 py-2 rounded-xl hover:bg-[#bfce7f] hover:text-[#1d1f18] transition-colors font-bold cursor-pointer"
            >
              + Añadir Nueva Bicicleta
            </button>
          </div>

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
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80";
                      }}
                    />
                  ) : (
                    <img
                      src="https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80"
                      alt={mainBike?.modelo || "Bicicleta"}
                      className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                    />
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
                        SERIE: {mainBike.numero_serie_cuadro || "SC-9902-XJ102"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase text-slate-400 font-mono">Puntuación de Salud</span>
                      <span className="text-lg font-bold text-[#bfce7f]">
                        {mainBike.salud || 94}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 font-mono text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Transmisión</span>
                      <span className="text-white font-bold">{mainBike.transmision || "SRAM X01 AXS (12s)"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Suspensión</span>
                      <span className="text-white font-bold">{mainBike.suspension || "Fox Factory 38 / Float X2"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Juego de Ruedas</span>
                      <span className="text-white font-bold">{mainBike.ruedas || "Reserve 30|HD Carbon"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Frenos</span>
                      <span className="text-white font-bold">{mainBike.frenos || "SRAM Code RSC 200mm"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fatigue / Wear Indicators */}
              <div className="bg-[#0e1117] border-t border-[#2d3748] p-4 grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                <div>
                  <div className="flex justify-between text-[10px] uppercase text-slate-400 mb-1">
                    <span>Desgaste de Cadena</span>
                    <span className="text-white font-bold">{mainBike.desgaste_cadena || "0.4mm"}</span>
                  </div>
                  <div className="h-2 bg-[#161a21] rounded-full overflow-hidden border border-[#2d3748]">
                    <div className="h-full bg-[#bfce7f] w-[40%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] uppercase text-slate-400 mb-1">
                    <span>Servicio de Horquilla</span>
                    <span className="text-amber-400 font-bold">{mainBike.servicio_horquilla || "42h / 50h"}</span>
                  </div>
                  <div className="h-2 bg-[#161a21] rounded-full overflow-hidden border border-[#2d3748]">
                    <div className="h-full bg-amber-500 w-[84%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] uppercase text-slate-400 mb-1">
                    <span>Pastillas de Freno (Traseras)</span>
                    <span className="text-rose-400 font-bold">{mainBike.pastillas_freno || "15% restante"}</span>
                  </div>
                  <div className="h-2 bg-[#161a21] rounded-full overflow-hidden border border-[#2d3748]">
                    <div className="h-full bg-rose-500 w-[15%]" />
                  </div>
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
                        {bike.tipo_bicicleta || "MTB"} • {bike.ano || "2025"}
                      </div>
                      <h4 className="text-base font-bold text-white truncate group-hover:text-[#bfce7f] transition-colors">
                        {bike.marca} {bike.modelo}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1 truncate">
                        SN: <span className="text-slate-300">{bike.numero_serie_cuadro || "TRSPUR20240001"}</span>
                      </p>
                    </div>

                    <div className="w-24 h-18 rounded-xl border border-[#2d3748] bg-[#0e1117] overflow-hidden shrink-0">
                      <img
                        src={bike.foto_url || "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80"}
                        alt={bike.modelo || "Bicicleta"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80";
                        }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[#2d3748] my-3.5" />

                  <div className="flex items-center gap-2 text-xs text-slate-300 mb-3">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{detailUser?.nombre_completo || "Carlos Martínez"}</span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Salud Global</span>
                      <span className="font-bold text-[#00e699]">{bike.salud || 92}% ÓPTIMO</span>
                    </div>
                    <div className="h-1.5 bg-[#0e1117] rounded-full overflow-hidden border border-[#2d3748]/60 mt-1.5">
                      <div
                        className="h-full bg-[#00e699] rounded-full transition-all duration-500"
                        style={{ width: `${bike.salud || 92}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* 3. Clinical History (Historial Clínico Timeline Table) */}
        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="font-mono text-lg font-extrabold text-white uppercase tracking-tight">
              Historial Clínico
            </h2>
            <div className="h-[1px] flex-1 bg-[#2d3748]" />
          </div>

          <div className="border border-[#2d3748] rounded-2xl overflow-hidden bg-[#161a21] shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-[#0e1117] border-b border-[#2d3748] text-slate-400">
                    <th className="px-6 py-4">FECHA</th>
                    <th className="px-6 py-4">NRO. ORDEN</th>
                    <th className="px-6 py-4">SERVICIO REALIZADO</th>
                    <th className="px-6 py-4">NOTAS TÉCNICAS</th>
                    <th className="px-6 py-4 text-right">COSTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]">
                  <tr className="hover:bg-[#1f242d] transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-bold whitespace-nowrap">12 OCT 2025</td>
                    <td className="px-6 py-4 font-bold text-[#bfce7f] whitespace-nowrap">#WO-2025-441</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">Mantenimiento 50h Suspensión</span>
                        <span className="text-[11px] text-slate-400 italic">Reemplazo de sellos Fox 38 y purgado de amortiguador</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs text-[11px]">
                      Reemplazo de guardapolvos y aceite de baño. Resorte de aire limpiado y reengrasado. Servicio de botellas completado.
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-white whitespace-nowrap">RD$ 8,700.00</td>
                  </tr>

                  <tr className="hover:bg-[#1f242d] transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-bold whitespace-nowrap">05 SEP 2025</td>
                    <td className="px-6 py-4 font-bold text-[#bfce7f] whitespace-nowrap">#WO-2025-312</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">Renovación de Transmisión</span>
                        <span className="text-[11px] text-slate-400 italic">Cadena nueva y alineación de desviador</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs text-[11px]">
                      Cadena SRAM GX instalada. Indexación ajustada para AXS. Patilla de cambio enderezada.
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-white whitespace-nowrap">RD$ 4,920.00</td>
                  </tr>

                  <tr className="hover:bg-[#1f242d] transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-bold whitespace-nowrap">22 JUN 2025</td>
                    <td className="px-6 py-4 font-bold text-[#bfce7f] whitespace-nowrap">#WO-2025-109</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">Centrado de Ruedas y Sellante</span>
                        <span className="text-[11px] text-slate-400 italic">Juego de ruedas Reserve 30 Carbon</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs text-[11px]">
                      Verificación de tensión delantera y trasera. Sellante Muc-Off nuevo añadido (60ml por rueda).
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-white whitespace-nowrap">RD$ 2,700.00</td>
                  </tr>

                  <tr className="hover:bg-[#1f242d] transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-bold whitespace-nowrap">14 MAR 2025</td>
                    <td className="px-6 py-4 font-bold text-[#bfce7f] whitespace-nowrap">#WO-2025-012</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">Ensamblaje Personalizado</span>
                        <span className="text-[11px] text-slate-400 italic">Montaje de cuadro Santa Cruz Nomad</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs text-[11px]">
                      Montaje completo desde el cuadro. Protección de cuadro aplicada. Verificación de torques realizada.
                    </td>
                    <td className="px-6 py-4 font-bold text-right text-white whitespace-nowrap">RD$ 27,000.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-[#bfce7f] transition-colors cursor-pointer">
              <span>DESCARGAR HISTORIAL CLÍNICO COMPLETO</span>
              <Download size={14} />
            </button>
          </div>
        </section>

      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN CLIENTS DIRECTORY TABLE VIEW
  // ---------------------------------------------------------------------------
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
                            setItemToDelete(item);
                            setIsDeletingModalOpen(true);
                          }}
                          title="Eliminar cliente"
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
                    <label className="block text-slate-300 mb-1">Cédula / Pasaporte</label>
                    <input
                      type="text"
                      value={formData.identificacion}
                      onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
                      placeholder="Ej: 001-1234567-8"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">
                      Tipo de Cliente <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.tipo_cliente}
                      onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value })}
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-all ${
                        errors.tipo_cliente ? "border-rose-500 focus:border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    >
                      <option value="">Seleccione el tipo de cliente</option>
                      <option value="PERSONA">Persona</option>
                      <option value="EMPRESA">Empresa</option>
                    </select>
                    {errors.tipo_cliente && <p className="text-rose-400 text-[10px] mt-1">{errors.tipo_cliente}</p>}
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
                      onChange={(e) => setFormData({ ...formData, telefono_principal: e.target.value })}
                      placeholder="Ej: +34 612 345 678"
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
      {isDeletingModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-white">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-300">
              ¿Está seguro de que desea eliminar al cliente{" "}
              <strong className="text-white">{itemToDelete.nombre_completo}</strong>? Esta acción actualizará la base de datos.
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
                Eliminar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
