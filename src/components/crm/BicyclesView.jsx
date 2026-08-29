"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bike,
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
  AlertTriangle,
  AlertCircle,
  QrCode,
  Shield,
  Activity,
  Layers,
  Wrench,
  Calendar,
  User,
  Sliders,
  ExternalLink,
  ChevronRight,
  Eye,
  Camera,
  FileCheck,
  Upload,
  Image as ImageIcon,
  Star,
  Check,
  ArrowLeft,
  Printer,
  Copy,
  Download,
  Gauge,
  HelpCircle
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import BikeFormDrawer from "./BikeFormDrawer";
import BicycleComponentsEditor from "./BicycleComponentsEditor";
import BicyclePhotosEditor from "./BicyclePhotosEditor";

export const formatDateForInput = (dateVal) => {
  if (!dateVal) return new Date().toISOString().substring(0, 10);
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return new Date().toISOString().substring(0, 10);
    }
    return d.toISOString().substring(0, 10);
  } catch {
    return new Date().toISOString().substring(0, 10);
  }
};

const VALID_BICYCLE_TABS = new Set([
  "general",
  "componentes",
  "fotos",
  "historial"
]);

/**
 * @param {{ initialBikeId?: number | string | null, initialTab?: string, onClose?: any }} props
 */
export default function BicyclesView({ initialBikeId = null, initialTab = "general", onClose = null }) {
  const [data, setData] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [mounted, setMounted] = useState(false);

  // RBAC Effective Permissions
  const [permissions, setPermissions] = useState({
    puede_ver: true,
    puede_crear: true,
    puede_editar: true,
    puede_eliminar: true,
    puede_exportar: true
  });

  // Detail Modal State (Fullscreen Bike Workspace View)
  const [detailBike, setDetailBike] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(() => Boolean(initialBikeId));
  const [detailError, setDetailError] = useState(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    VALID_BICYCLE_TABS.has(initialTab) ? initialTab : "general"
  );

  // Bike Photos & Components State
  const [bikePhotos, setBikePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Bike DB Components State
  const [bikeComponents, setBikeComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const [statesList, setStatesList] = useState([]);

  // Bike Technical History State
  const [bikeHistory, setBikeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Drawer & Deletion State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);

  // Form State for editing within Detail view
  const [formData, setFormData] = useState({
    cliente_id: "",
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

  // Feedback Toasts
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchClientes();
    fetchAuxiliaryLists();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      const urlClienteId = params.get("clienteId") || params.get("cliente_id");
      const urlId = initialBikeId || params.get("id") || params.get("bikeId");

      if (action === "new" || urlClienteId) {
        fetchData();
        setEditingItem(null);
        setIsDrawerOpen(true);
        if (urlClienteId) {
          setFormData((prev) => ({ ...prev, cliente_id: urlClienteId }));
        }
      } else if (urlId) {
        const startInEdit = params.get("edit") === "true";
        handleFetchSingleBike(urlId, startInEdit);
      } else {
        fetchData();
      }
    } else {
      fetchData();
    }
  }, [initialBikeId]);

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleFetchSingleBike = async (targetId, startInEdit = false) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/crm/bicicletas/${targetId}`);
      if (res.ok) {
        const fullBike = await res.json();
        handleViewDetail(fullBike, startInEdit);
        setLoadingDetail(false);
        return;
      } else if (res.status === 404) {
        setDetailError("Bicicleta no encontrada o no pertenece a su empresa.");
        setLoadingDetail(false);
        return;
      }
    } catch (err) {
      console.error("Error fetching single bike detail:", err);
    }

    setDetailError("No pudimos cargar la bicicleta.");
    setLoadingDetail(false);
  };

  const handleCloseDetailModal = () => {
    setDetailBike(null);
    setIsEditingDetail(false);
    if (onClose) {
      onClose();
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get("from");
      if (fromParam === "customer" || (document.referrer && document.referrer.includes("/crm/customers"))) {
        window.history.back();
        return;
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/bicicletas");
      if (res.ok) {
        // Read RBAC Response Headers
        const permVer = res.headers.get("x-perm-ver");
        const permCrear = res.headers.get("x-perm-crear");
        const permEditar = res.headers.get("x-perm-editar");
        const permEliminar = res.headers.get("x-perm-eliminar");
        const permExportar = res.headers.get("x-perm-exportar");

        if (permVer !== null || permCrear !== null) {
          setPermissions({
            puede_ver: permVer === null ? true : permVer === "true",
            puede_crear: permCrear === null ? true : permCrear === "true",
            puede_editar: permEditar === null ? true : permEditar === "true",
            puede_eliminar: permEliminar === null ? true : permEliminar === "true",
            puede_exportar: permExportar === null ? true : permExportar === "true"
          });
        }

        const result = await res.json();
        setData(Array.isArray(result) ? result : []);

        // Auto open detail workspace if URL contains ?id=... or ?bikeId=...
        if (!initialBikeId && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const urlId = params.get("id") || params.get("bikeId");
          if (urlId) {
            const startInEdit = params.get("edit") === "true";
            const matched = (result || []).find(
              (b) => String(b.id) === String(urlId) || String(b.bicicleta_id) === String(urlId)
            );
            if (matched) {
              handleViewDetail(matched, startInEdit);
            }
          }
        }
      } else {
        showToast("Error al cargar las bicicletas.", "error");
      }
    } catch (err) {
      console.error("Error fetching bicicletas:", err);
      showToast("Error de conexión al cargar bicicletas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const res = await fetch("/api/crm/clientes");
      if (res.ok) {
        const result = await res.json();
        setClientes(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      console.error("Error fetching clientes dropdown:", err);
    }
  };

  const fetchAuxiliaryLists = async () => {
    try {
      const [resCat, resEst] = await Promise.all([
        fetch("/api/crm/component-categories"),
        fetch("/api/crm/component-states")
      ]);
      if (resCat.ok) {
        const cats = await resCat.json();
        setCategoriesList(Array.isArray(cats) ? cats : []);
      }
      if (resEst.ok) {
        const ests = await resEst.json();
        setStatesList(Array.isArray(ests) ? ests : []);
      }
    } catch (err) {
      console.error("Error fetching auxiliary lists:", err);
    }
  };

  const fetchPhotos = async (bikeId) => {
    if (!bikeId) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/photos`);
      if (res.ok) {
        const result = await res.json();
        setBikePhotos(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      console.error("Error fetching bike photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchComponents = async (bikeId) => {
    if (!bikeId) return;
    setLoadingComponents(true);
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/components`);
      if (res.ok) {
        const result = await res.json();
        setBikeComponents(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      console.error("Error fetching bike components:", err);
    } finally {
      setLoadingComponents(false);
    }
  };

  const fetchHistory = async (bikeId) => {
    if (!bikeId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/history`);
      if (res.ok) {
        const result = await res.json();
        setBikeHistory(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      console.error("Error fetching bike history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewDetail = (bike, startInEdit = false) => {
    setDetailBike(bike);
    setIsEditingDetail(startInEdit);
    setActiveTab("general");
    const bikeId = bike.id || bike.bicicleta_id;
    if (bikeId) {
      fetchPhotos(bikeId);
      fetchComponents(bikeId);
      fetchHistory(bikeId);
    }
  };

  const handleSaveDetailEdit = async () => {
    if (!detailBike) return;
    const targetId = detailBike.id || detailBike.bicicleta_id;

    if (!formData.marca || !formData.modelo) {
      showToast("Marca y Modelo son obligatorios.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        cliente_id: Number(formData.cliente_id) || detailBike.cliente_id,
        ano: Number(formData.ano) || new Date().getFullYear(),
        kilometraje_actual: Number(formData.kilometraje_actual) || 0
      };

      const res = await fetch(`/api/crm/bicicletas/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || "Error al actualizar bicicleta.");
      }

      showToast("Expediente de bicicleta actualizado correctamente.", "success");
      setIsEditingDetail(false);
      setDetailBike((prev) => ({
        ...prev,
        ...payload,
        cliente_nombre:
          clientes.find((c) => String(c.id) === String(payload.cliente_id))?.nombre_completo ||
          prev.cliente_nombre
      }));
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDetailEdit = () => {
    setIsEditingDetail(false);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id || itemToDelete.bicicleta_id;
    try {
      const res = await fetch(`/api/crm/bicicletas/${targetId}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const errorMsg =
          json?.message ||
          json?.error ||
          "No fue posible eliminar la bicicleta. Inténtalo nuevamente.";
        showToast(errorMsg, "error");
        return;
      }

      showToast(json?.message || "Bicicleta eliminada correctamente.", "success");
      setIsDeletingModalOpen(false);
      setItemToDelete(null);
      if (detailBike && (detailBike.id === targetId || detailBike.bicicleta_id === targetId)) {
        setDetailBike(null);
      }
      fetchData();
    } catch (err) {
      console.error("Error deleting bike:", err);
      showToast("No fue posible eliminar la bicicleta. Inténtalo nuevamente.", "error");
    }
  };

  const handleExportCSV = () => {
    if (sortedData.length === 0) {
      showToast("No hay registros para exportar con los filtros actuales.", "error");
      return;
    }

    const headers = [
      "ID",
      "Marca",
      "Modelo",
      "Tipo",
      "Ano",
      "Color",
      "Numero_Serie",
      "Propietario",
      "Kilometraje",
      "Ultimo_Servicio",
      "QR_Codigo"
    ];

    const rows = sortedData.map((b) => [
      b.id || b.bicicleta_id,
      `"${(b.marca || "").replace(/"/g, '""')}"`,
      `"${(b.modelo || "").replace(/"/g, '""')}"`,
      `"${(b.tipo_bicicleta || "MTB").replace(/"/g, '""')}"`,
      b.ano || "",
      `"${(b.color || "").replace(/"/g, '""')}"`,
      `"${(b.numero_serie_cuadro || "").replace(/"/g, '""')}"`,
      `"${(b.cliente_nombre || "").replace(/"/g, '""')}"`,
      b.kilometraje_actual || 0,
      b.fecha_ultima_revision || "Sin intervenciones",
      `"${(b.codigo_qr || "").replace(/"/g, '""')}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bicicletas_crm_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Se exportaron ${sortedData.length} bicicletas en CSV.`, "success");
  };

  // Real Global Metrics (Company Dataset)
  const globalMetrics = useMemo(() => {
    const total = data.length;
    const mtbCount = data.filter((b) => (b.tipo_bicicleta || "").toUpperCase() === "MTB").length;
    const roadCount = data.filter((b) => (b.tipo_bicicleta || "").toUpperCase() === "ROAD").length;
    const eBikeCount = data.filter((b) => (b.tipo_bicicleta || "").toUpperCase().includes("E-BIKE") || (b.tipo_bicicleta || "").toUpperCase().includes("EBIKE")).length;
    const otherCount = Math.max(0, total - mtbCount - roadCount - eBikeCount);
    const withOwner = data.filter((b) => b.cliente_id && b.cliente_nombre).length;
    const withServices = data.filter((b) => Boolean(b.fecha_ultima_revision)).length;

    return {
      total,
      mtbCount,
      roadCount,
      eBikeCount,
      otherCount,
      withOwner,
      withServices
    };
  }, [data]);

  // Global Multi-field Filtering & Sorting across all pages
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch =
        !query ||
        (item.marca || "").toLowerCase().includes(query) ||
        (item.modelo || "").toLowerCase().includes(query) ||
        (item.cliente_nombre || "").toLowerCase().includes(query) ||
        (item.numero_serie_cuadro || "").toLowerCase().includes(query) ||
        (item.codigo_qr || "").toLowerCase().includes(query);

      const matchesType =
        typeFilter === "Todos" ||
        (item.tipo_bicicleta || "").toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesType;
    });
  }, [data, search, typeFilter]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    return sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [sortedData, page, itemsPerPage]);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const isOpeningInitialBike = Boolean(initialBikeId) && loadingDetail && !detailBike;

  if (isOpeningInitialBike) {
    if (detailError) {
      return (
        <div className="p-8 max-w-lg mx-auto mt-12 bg-card border border-border rounded-2xl text-foreground font-mono text-xs text-center space-y-4 shadow-xl">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="font-bold text-sm text-foreground">{detailError}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleFetchSingleBike(initialBikeId)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold uppercase hover:opacity-90 cursor-pointer"
            >
              Reintentar
            </button>
            <button
              onClick={() => {
                setDetailError(null);
                setLoadingDetail(false);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/crm/bicycles");
                }
              }}
              className="px-4 py-2 bg-surface hover:bg-surface-elevated text-foreground-muted hover:text-foreground border border-border rounded-xl font-bold uppercase cursor-pointer"
            >
              Volver al listado
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-2xl text-foreground-muted gap-3 font-mono min-h-[450px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-bold text-foreground">Cargando expediente de la bicicleta...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Toast Notifier */}
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
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-primary mb-1">
            <span>CRM</span>
            <span>/</span>
            <span className="text-foreground font-bold">Bicicletas</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-foreground tracking-tight">
            Gestión de Bicicletas
          </h1>
          <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
            Directorio maestro de flota, registro técnico y pasaportes digitales de clientes.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {permissions.puede_exportar && (
            <button
              onClick={handleExportCSV}
              disabled={loading || sortedData.length === 0}
              className="bg-surface hover:bg-surface-elevated text-foreground font-mono text-xs font-bold px-4 py-2.5 rounded-xl border border-border flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            >
              <Download size={16} className="text-primary" />
              Exportar CSV
            </button>
          )}

          {permissions.puede_crear && (
            <button
              onClick={() => {
                setEditingItem(null);
                setIsDrawerOpen(true);
              }}
              className="bg-primary hover:opacity-90 text-primary-foreground font-mono text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={18} />
              Registrar Bicicleta
            </button>
          )}
        </div>
      </div>

      {/* Real KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Bike size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] text-foreground-muted uppercase tracking-wider block">
              Total Parque Bicicletas
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {globalMetrics.total}
            </span>
            <span className="font-mono text-[10px] text-foreground-muted block mt-0.5">
              Empresa autenticada
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <User size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] text-foreground-muted uppercase tracking-wider block">
              Asignadas a Clientes
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {globalMetrics.withOwner}
            </span>
            <span className="font-mono text-[10px] text-sky-400 block mt-0.5">
              {globalMetrics.total > 0
                ? `${Math.round((globalMetrics.withOwner / globalMetrics.total) * 100)}% con titular activo`
                : "Sin registro"}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <span className="font-mono text-[11px] text-foreground-muted uppercase tracking-wider block">
              Con Historial Técnico
            </span>
            <span className="font-mono text-2xl font-black text-foreground">
              {globalMetrics.withServices}
            </span>
            <span className="font-mono text-[10px] text-emerald-400 block mt-0.5">
              {globalMetrics.mtbCount} MTB • {globalMetrics.roadCount} Road • {globalMetrics.eBikeCount} E-Bike
            </span>
          </div>
        </div>
      </div>

      {/* Search & Type Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, serie, QR o titular..."
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="Todos">Todos los tipos</option>
            <option value="MTB">MTB (Montaña)</option>
            <option value="ROAD">Road (Ruta)</option>
            <option value="E-BIKE">E-Bike (Eléctrica)</option>
            <option value="GRAVEL">Gravel</option>
            <option value="ENDURO">Enduro</option>
          </select>

          <button
            onClick={fetchData}
            title="Refrescar datos"
            className="p-2.5 bg-background border border-border rounded-xl text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Presentation 1: Desktop Table (>= 768px) */}
      <div className="hidden md:block bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-surface border-b border-border flex justify-between items-center font-mono">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bike size={16} className="text-primary" />
            Inventario Completo de Bicicletas
          </h3>
          <span className="text-foreground-muted text-xs">
            {sortedData.length} Bicicletas Filtradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-surface border-b border-border select-none">
                <th
                  onClick={() => handleSort("marca")}
                  className="py-3.5 px-5 text-foreground-muted font-bold text-[11px] uppercase cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <span>BICICLETA / MODELO</span>
                    <ArrowUpDown size={13} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("numero_serie_cuadro")}
                  className="py-3.5 px-4 text-foreground-muted font-bold text-[11px] uppercase cursor-pointer hover:text-foreground"
                >
                  NÚMERO DE SERIE
                </th>
                <th
                  onClick={() => handleSort("cliente_nombre")}
                  className="py-3.5 px-4 text-foreground-muted font-bold text-[11px] uppercase cursor-pointer hover:text-foreground"
                >
                  PROPIETARIO
                </th>
                <th
                  onClick={() => handleSort("fecha_ultima_revision")}
                  className="py-3.5 px-4 text-foreground-muted font-bold text-[11px] uppercase cursor-pointer hover:text-foreground"
                >
                  ÚLTIMO SERVICIO
                </th>
                <th className="py-3.5 px-4 text-foreground-muted font-bold text-[11px] uppercase text-center">
                  ESTADO
                </th>
                <th className="py-3.5 px-5 text-right text-foreground-muted font-bold text-[11px] uppercase">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-foreground-muted font-mono">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando bicicletas...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-foreground-muted font-mono">
                    {search || typeFilter !== "Todos"
                      ? "No se encontraron bicicletas con los filtros seleccionados."
                      : "No hay bicicletas registradas en la empresa."}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface transition-colors cursor-pointer group"
                    onClick={() => handleViewDetail(item, false)}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center text-primary border border-border shrink-0 overflow-hidden">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.modelo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Bike size={16} className="text-primary" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {item.marca} {item.modelo}
                          </span>
                          <span className="text-[11px] text-foreground-muted truncate">
                            {item.tipo_bicicleta || "MTB"} • {item.color || "Sin color"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-foreground-muted font-mono">
                      {item.numero_serie_cuadro || `SN-BF-${item.id}`}
                    </td>

                    <td className="py-3.5 px-4 text-foreground font-bold">
                      {item.cliente_nombre}
                    </td>

                    <td className="py-3.5 px-4 text-foreground-muted">
                      {item.fecha_ultima_revision ? item.fecha_ultima_revision : "Sin intervenciones"}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
                        {item.activo !== false ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {permissions.puede_editar && (
                          <button
                            onClick={() => handleViewDetail(item, true)}
                            title="Editar bicicleta"
                            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {permissions.puede_eliminar && (
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setIsDeletingModalOpen(true);
                            }}
                            title="Eliminar bicicleta"
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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

        {/* Table Footer & Pagination */}
        <div className="p-4 bg-surface border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-xs">
          <span className="text-foreground-muted">
            Mostrando {paginatedData.length} de {sortedData.length} bicicletas filtradas (Total en empresa: {data.length})
          </span>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-muted hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-foreground-muted">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-muted hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Presentation 2: Mobile Cards (< 768px / 390px) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-foreground-muted font-mono text-xs">
            <RefreshCw className="animate-spin inline-block mr-2" size={16} />
            Cargando bicicletas...
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-foreground-muted font-mono text-xs">
            {search || typeFilter !== "Todos"
              ? "No se encontraron bicicletas con los filtros seleccionados."
              : "No hay bicicletas registradas en la empresa."}
          </div>
        ) : (
          paginatedData.map((item) => (
            <div
              key={item.id}
              onClick={() => handleViewDetail(item, false)}
              className="bg-card border border-border rounded-2xl p-4 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center text-primary">
                  {item.foto_url ? (
                    <img src={item.foto_url} alt={item.modelo} className="w-full h-full object-cover" />
                  ) : (
                    <Bike size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary font-mono text-[10px] font-bold uppercase">
                      {item.tipo_bicicleta || "MTB"}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                      {item.activo !== false ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                  <h4 className="font-mono text-sm font-bold text-foreground truncate mt-1">
                    {item.marca} {item.modelo}
                  </h4>
                  <p className="font-mono text-[11px] text-foreground-muted truncate">
                    SN: {item.numero_serie_cuadro || `SN-BF-${item.id}`}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-foreground truncate">
                  <User size={13} className="text-primary shrink-0" />
                  <span className="truncate">{item.cliente_nombre}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {permissions.puede_editar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetail(item, true);
                      }}
                      className="p-1.5 text-foreground-muted hover:text-foreground bg-surface rounded-lg"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {permissions.puede_eliminar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item);
                        setIsDeletingModalOpen(true);
                      }}
                      className="p-1.5 text-rose-400 bg-rose-950/30 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {sortedData.length > itemsPerPage && (
          <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between font-mono text-xs">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-surface border border-border rounded-lg disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-foreground-muted">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-surface border border-border rounded-lg disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* 360 Fullscreen Bike Workspace View */}
      {mounted && detailBike && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            width: "100vw",
            height: "100vh",
            overflow: "hidden"
          }}
          className="bg-background text-foreground font-sans"
        >
          {/* Header Bar */}
          <div className="p-4 sm:p-5 bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 font-mono z-10">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => handleCloseDetailModal()}
                className="px-3.5 py-2 bg-surface hover:bg-surface-elevated text-foreground-muted hover:text-foreground border border-border rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} />
                <span>Volver al Listado</span>
              </button>

              <div className="h-8 w-px bg-border hidden sm:block shrink-0" />

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary overflow-hidden shrink-0">
                  {((bikePhotos.length > 0 && bikePhotos.find((p) => p.es_principal)?.url_archivo) || detailBike.foto_url) ? (
                    <img
                      src={
                        (bikePhotos.length > 0 && bikePhotos.find((p) => p.es_principal)?.url_archivo)
                          ? (bikePhotos.find((p) => p.es_principal)?.url_archivo || bikePhotos[0].url_archivo)
                          : detailBike.foto_url
                      }
                      alt="Foto de Bicicleta"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bike size={24} className="text-primary" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-lg sm:text-xl font-bold text-foreground truncate">
                      {detailBike.marca} {detailBike.modelo}
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-mono text-[10px] font-bold uppercase shrink-0">
                      {detailBike.tipo_bicicleta || "MTB"}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold uppercase shrink-0">
                      {detailBike.activo !== false ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-foreground-muted truncate mt-0.5">
                    SERIE: {detailBike.numero_serie_cuadro || "Sin serie registrada"} • QR: {detailBike.codigo_qr} • PROPIETARIO:{" "}
                    <strong className="text-primary">{detailBike.cliente_nombre}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 self-end md:self-auto shrink-0 font-mono">
              {!isEditingDetail ? (
                permissions.puede_editar && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDetail(true);
                      const foundClient = clientes.find(
                        (c) =>
                          String(c.id) === String(detailBike.cliente_id) ||
                          c.nombre_completo === detailBike.cliente_nombre
                      );
                      const targetClienteId = foundClient ? foundClient.id : detailBike.cliente_id || "";
                      setFormData({
                        cliente_id: targetClienteId,
                        marca: detailBike.marca || "",
                        modelo: detailBike.modelo || "",
                        tipo_bicicleta: detailBike.tipo_bicicleta || "MTB",
                        ano: detailBike.ano || new Date().getFullYear(),
                        color: detailBike.color || "",
                        talla: detailBike.talla || "M",
                        numero_serie_cuadro: detailBike.numero_serie_cuadro || "",
                        descripcion: detailBike.descripcion || "",
                        kilometraje_actual: detailBike.kilometraje_actual || 0,
                        notas_tecnicas: detailBike.notas_tecnicas || ""
                      });
                    }}
                    className="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                  >
                    <Edit2 size={15} />
                    <span>Editar Expediente</span>
                  </button>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelDetailEdit}
                    className="px-4 py-2 bg-surface hover:bg-surface-elevated text-foreground-muted hover:text-foreground border border-border rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetailEdit}
                    disabled={isSaving}
                    className="px-5 py-2 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                    <span>Guardar Cambios</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar font-mono text-xs bg-background">
            {/* Overview Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 bg-card border border-border rounded-2xl p-4 font-mono space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Estado Operativo</span>
                  <span className="text-xs font-bold text-primary">
                    {detailBike.salud !== null && detailBike.salud !== undefined
                      ? `${detailBike.salud}%`
                      : "Sin evaluación"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-foreground-muted pt-1">
                  <span>Kilometraje: {detailBike.kilometraje_actual || 0} KM</span>
                  <span>Último servicio: {detailBike.fecha_ultima_revision || "Sin intervenciones"}</span>
                </div>
              </div>

              <div className="md:col-span-6 bg-card border border-border rounded-2xl p-4 font-mono space-y-1">
                <span className="text-primary text-xs font-bold flex items-center gap-1.5 uppercase">
                  <CheckCircle2 size={15} /> Registro Técnico de Flota
                </span>
                <p className="text-[11px] text-foreground-muted">
                  {bikeComponents.length > 0
                    ? `${bikeComponents.length} componentes registrados con evaluación de estado.`
                    : "No hay componentes registrados para esta bicicleta."}
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border bg-card px-4 rounded-2xl flex gap-6 font-mono text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("general")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "general"
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                <Info size={16} />
                <span>Información General</span>
              </button>

              <button
                onClick={() => setActiveTab("componentes")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "componentes"
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                <Layers size={16} />
                <span>Componentes & Desgaste</span>
                {bikeComponents.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px]">
                    {bikeComponents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("fotos")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "fotos"
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                <Camera size={16} />
                <span>Galería Fotográfica</span>
                {bikePhotos.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px]">
                    {bikePhotos.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("historial")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "historial"
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                <FileCheck size={16} />
                <span>Historial de Taller</span>
                {bikeHistory.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px]">
                    {bikeHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: General Specs */}
            {activeTab === "general" && (
              <div className="space-y-6">
                {!isEditingDetail ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
                      <h3 className="font-mono text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
                        <Bike size={16} /> Especificaciones Base
                      </h3>
                      <div className="space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Marca:</span>
                          <span className="text-foreground font-bold">{detailBike.marca}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Modelo:</span>
                          <span className="text-foreground font-bold">{detailBike.modelo}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Tipo:</span>
                          <span className="text-foreground">{detailBike.tipo_bicicleta || "MTB"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Año:</span>
                          <span className="text-foreground">{detailBike.ano || "N/A"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Color:</span>
                          <span className="text-foreground">{detailBike.color || "Sin color"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-foreground-muted">Talla del Cuadro:</span>
                          <span className="text-foreground">{detailBike.talla || "M"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
                      <h3 className="font-mono text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
                        <User size={16} /> Titular / Propietario
                      </h3>
                      <div className="space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Cliente:</span>
                          <span className="text-primary font-bold">{detailBike.cliente_nombre}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Teléfono:</span>
                          <span className="text-foreground">{detailBike.cliente_telefono || "No especificado"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Correo:</span>
                          <span className="text-foreground">{detailBike.cliente_correo || "No especificado"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-foreground-muted">ID de Cliente:</span>
                          <span className="text-foreground">#{detailBike.cliente_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
                      <h3 className="font-mono text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3">
                        <QrCode size={16} /> Identificación Digital
                      </h3>
                      <div className="space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Código QR:</span>
                          <span className="text-foreground font-mono">{detailBike.codigo_qr}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">N° Serie / Cuadro:</span>
                          <span className="text-foreground font-mono">{detailBike.numero_serie_cuadro || "Sin serie"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-foreground-muted">Kilometraje:</span>
                          <span className="text-foreground">{detailBike.kilometraje_actual || 0} KM</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-foreground-muted">Fecha Registro:</span>
                          <span className="text-foreground">{detailBike.fecha_creacion || "Reciente"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5">
                    <h3 className="font-mono text-sm font-bold text-primary uppercase flex items-center gap-2 border-b border-border pb-3">
                      <Edit2 size={16} /> Editar Información de la Bicicleta
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                      <div>
                        <label className="block text-foreground-muted mb-1">Propietario / Cliente *</label>
                        <select
                          value={formData.cliente_id}
                          onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        >
                          <option value="">Seleccionar cliente...</option>
                          {clientes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre_completo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Marca *</label>
                        <input
                          type="text"
                          value={formData.marca}
                          onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Modelo *</label>
                        <input
                          type="text"
                          value={formData.modelo}
                          onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Tipo de Bicicleta</label>
                        <select
                          value={formData.tipo_bicicleta}
                          onChange={(e) => setFormData({ ...formData, tipo_bicicleta: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        >
                          <option value="MTB">MTB</option>
                          <option value="ROAD">ROAD</option>
                          <option value="E-BIKE">E-BIKE</option>
                          <option value="GRAVEL">GRAVEL</option>
                          <option value="ENDURO">ENDURO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Año</label>
                        <input
                          type="number"
                          value={formData.ano}
                          onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Color</label>
                        <input
                          type="text"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">N° Serie / Cuadro</label>
                        <input
                          type="text"
                          value={formData.numero_serie_cuadro}
                          onChange={(e) => setFormData({ ...formData, numero_serie_cuadro: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-foreground-muted mb-1">Kilometraje Actual (KM)</label>
                        <input
                          type="number"
                          value={formData.kilometraje_actual}
                          onChange={(e) => setFormData({ ...formData, kilometraje_actual: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl p-2.5 text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Components & Wear */}
            {activeTab === "componentes" && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                <BicycleComponentsEditor
                  mode="persisted"
                  bikeId={detailBike.id || detailBike.bicicleta_id}
                  components={bikeComponents}
                  categoriesList={categoriesList}
                  statesList={statesList}
                  onRefresh={() => fetchComponents(detailBike.id || detailBike.bicicleta_id)}
                  showToast={showToast}
                  readOnly={!permissions.puede_editar}
                />
              </div>
            )}

            {/* Tab 3: Photo Gallery & S3 */}
            {activeTab === "fotos" && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
                <BicyclePhotosEditor
                  mode="persisted"
                  bikeId={detailBike.id || detailBike.bicicleta_id}
                  photos={bikePhotos}
                  componentsList={bikeComponents}
                  onRefresh={() => fetchPhotos(detailBike.id || detailBike.bicicleta_id)}
                  showToast={showToast}
                  readOnly={!permissions.puede_editar}
                />
              </div>
            )}

            {/* Tab 4: Work Order History */}
            {activeTab === "historial" && (
              <div className="space-y-4">
                {loadingHistory ? (
                  <div className="p-12 text-center text-foreground-muted font-mono text-xs">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} />
                    Cargando historial de servicios...
                  </div>
                ) : bikeHistory.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-8 text-center text-foreground-muted font-mono text-xs">
                    <FileCheck className="w-8 h-8 text-foreground-muted mx-auto mb-2 opacity-50" />
                    Esta bicicleta aún no tiene historial de taller.
                  </div>
                ) : (
                  bikeHistory.map((order) => (
                    <div
                      key={order.orden_trabajo_id || order.id}
                      className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-primary/15 border border-primary/30 text-primary font-mono text-xs font-bold">
                            {order.codigo_orden || `OT-${order.orden_trabajo_id}`}
                          </span>
                          <span className="text-foreground font-bold text-xs font-mono">
                            {order.titulo_servicio || order.diagnostico_inicial || "Servicio de Taller"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-foreground-muted font-mono text-xs">
                            {order.fecha_servicio ? String(order.fecha_servicio).slice(0, 10) : "Reciente"}
                          </span>
                          <Link
                            href={`/work-orders?order_id=${order.orden_trabajo_id || order.id}`}
                            className="px-3 py-1 bg-surface hover:bg-surface-elevated text-primary border border-border rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <span>Ver Orden</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </div>

                      <p className="font-mono text-xs text-foreground-muted">
                        {order.descripcion_trabajo || order.observacion_interna || "Sin notas técnicas adicionales."}
                      </p>

                      {order.mecanicos_list && order.mecanicos_list.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-[11px] text-foreground-muted font-mono">
                          <Wrench size={13} className="text-primary" />
                          <span>Personal: {order.mecanicos_list.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {isDeletingModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle size={22} />
              <h3 className="text-sm font-bold text-foreground">Eliminar Bicicleta</h3>
            </div>
            <p className="text-foreground-muted leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente la bicicleta{" "}
              <strong className="text-foreground">
                {itemToDelete.marca} {itemToDelete.modelo}
              </strong>{" "}
              (SN: {itemToDelete.numero_serie_cuadro || "Sin serie"})?
            </p>
            <div className="bg-surface border border-border rounded-xl p-3 text-[11px] text-foreground-muted">
              Si la bicicleta posee recepciones u órdenes de trabajo registradas, el sistema bloqueará la eliminación para proteger el historial operativo del taller.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeletingModalOpen(false);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 bg-surface hover:bg-surface-elevated text-foreground-muted hover:text-foreground border border-border rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold cursor-pointer"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration/Edit Drawer Component */}
      <BikeFormDrawer
        isOpen={isDrawerOpen}
        editingItem={editingItem}
        clientes={clientes}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          setIsDrawerOpen(false);
          setEditingItem(null);
          fetchData();
        }}
        showToast={showToast}
      />
    </div>
  );
}
