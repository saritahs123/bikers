"use client";

import React, { useState, useEffect } from "react";
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
  Sparkles,
  Eye,
  Camera,
  FileCheck,
  Upload,
  Image as ImageIcon,
  Star,
  Paperclip,
  Check,
  ArrowLeft,
  Printer,
  Copy,
  Download
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

  // Detail Modal State (Fullscreen Bike Workspace View)
  const [detailBike, setDetailBike] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(() => Boolean(initialBikeId));
  const [detailError, setDetailError] = useState(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    VALID_BICYCLE_TABS.has(initialTab)
      ? initialTab
      : "general"
  );

  // Bike Photos & Components State
  const [bikePhotos, setBikePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [selectedPhotoDataUrl, setSelectedPhotoDataUrl] = useState("");
  const [newPhotoDesc, setNewPhotoDesc] = useState("");
  const [newPhotoType, setNewPhotoType] = useState("GENERAL");
  const [newPhotoComponentId, setNewPhotoComponentId] = useState("");
  const [newPhotoEsPrincipal, setNewPhotoEsPrincipal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Bike DB Components State (Inline form instead of modal)
  const [bikeComponents, setBikeComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [isComponentFormOpen, setIsComponentFormOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [componentForm, setComponentForm] = useState({
    categoria_componente_id: "",
    estado_componente_id: 1,
    marca: "",
    modelo: "",
    numero_serie: "",
    descripcion: "",
    fecha_instalacion: new Date().toISOString().substring(0, 10),
    kilometraje_instalacion: 0
  });

  // Bike Technical History State
  const [bikeHistory, setBikeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isHistoryFormOpen, setIsHistoryFormOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    modo_registro: "ESPECIFICO",
    es_mantenimiento: true,
    titulo_servicio: "",
    descripcion_trabajo: "",
    tipo_servicio: "PREVENTIVO",
    fecha_servicio: new Date().toISOString().substring(0, 10),
    kilometraje_servicio: 0,
    mecanico_responsable: "",
    costo_total: 0,
    bicicleta_componente_id: "",
    nuevo_estado_componente_id: "",
    servicios: [
      { descripcion_servicio: "", bicicleta_componente_id: "", nuevo_estado_componente_id: "", costo: 0 }
    ]
  });

  // Form Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
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

  const [errors, setErrors] = useState({});
  const [isDeletingModalOpen, setIsDeletingModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
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
        handleOpenDrawer();
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
      }
    } catch (err) {
      console.error("Error fetching single bike detail:", err);
    }

    try {
      const resAll = await fetch("/api/crm/bicicletas");
      if (resAll.ok) {
        const bikes = await resAll.json();
        if (bikes && bikes.length > 0) {
          const matched = bikes.find(b => String(b.id) === String(targetId) || String(b.bicicleta_id) === String(targetId));
          handleViewDetail(matched || bikes[0], startInEdit);
          setLoadingDetail(false);
          return;
        }
      }
    } catch (e) {
      console.error("Error fallback fetching bikes:", e);
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
        const result = await res.json();
        setData(result);

        // Auto open detail workspace if URL contains ?id=... or ?bikeId=...
        if (!initialBikeId && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const urlId = params.get("id") || params.get("bikeId");
          if (urlId) {
            const startInEdit = params.get("edit") === "true";
            const matched = result.find(b => String(b.id) === String(urlId) || String(b.bicicleta_id) === String(urlId));
            if (matched) {
              handleViewDetail(matched, startInEdit);
            } else {
              handleViewDetail({ id: parseInt(urlId, 10) }, startInEdit);
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
        setClientes(result);
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
        setCategoriesList(cats);
      }
      if (resEst.ok) {
        const ests = await resEst.json();
        setStatesList(ests);
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
        const photos = await res.json();
        setBikePhotos(photos);
      }
    } catch (err) {
      console.error("Error loading photos:", err);
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
        const comps = await res.json();
        setBikeComponents(comps);
      }
    } catch (err) {
      console.error("Error loading components:", err);
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
        const hist = await res.json();
        setBikeHistory(hist);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddSubServiceRow = () => {
    setHistoryForm((prev) => ({
      ...prev,
      servicios: [
        ...prev.servicios,
        { descripcion_servicio: "", bicicleta_componente_id: "", nuevo_estado_componente_id: "", costo: 0 }
      ]
    }));
  };

  const handleRemoveSubServiceRow = (index) => {
    setHistoryForm((prev) => ({
      ...prev,
      servicios: prev.servicios.filter((_, i) => i !== index)
    }));
  };

  const handleSubServiceChange = (index, field, value) => {
    setHistoryForm((prev) => {
      const updated = [...prev.servicios];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto-calculate total cost if user changed individual line costs
      let newTotal = updated.reduce((sum, item) => sum + (parseFloat(item.costo) || 0), 0);
      return { 
        ...prev, 
        servicios: updated,
        costo_total: newTotal > 0 ? newTotal : prev.costo_total
      };
    });
  };

  const handleSaveHistory = async (e) => {
    e.preventDefault();
    if (!detailBike || !detailBike.id) return;
    if (!historyForm.titulo_servicio.trim()) {
      showToast("Debe ingresar el título del servicio técnico.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/crm/bicicletas/${detailBike.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyForm)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al registrar servicio en el historial.");

      showToast("Servicio técnico registrado y estado de los componentes actualizado.");
      setIsHistoryFormOpen(false);
      setHistoryForm({
        modo_registro: "ESPECIFICO",
        titulo_servicio: "",
        descripcion_trabajo: "",
        tipo_servicio: "PREVENTIVO",
        fecha_servicio: new Date().toISOString().substring(0, 10),
        kilometraje_servicio: detailBike.kilometraje_actual || 0,
        mecanico_responsable: "",
        costo_total: 0,
        bicicleta_componente_id: "",
        nuevo_estado_componente_id: "",
        servicios: [
          { descripcion_servicio: "", bicicleta_componente_id: "", nuevo_estado_componente_id: "", costo: 0 }
        ]
      });
      fetchHistory(detailBike.id);
      fetchComponents(detailBike.id);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteHistory = async (bikeId, historyId) => {
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/history?historyId=${historyId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar orden del historial.");
      showToast("Orden de trabajo eliminada del historial.");
      fetchHistory(bikeId);
      fetchComponents(bikeId);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDownloadQrPng = async (bike) => {
    const codeQrStr = bike?.codigo_qr || (bike?.id ? `BF-QR-${bike.id}` : null);
    if (!codeQrStr) {
      showToast("No pudimos generar el código QR.", "error");
      return;
    }
    const filename = `QR-${codeQrStr}.png`;
    const qrApiSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(codeQrStr)}`;

    try {
      const response = await fetch(qrApiSrc);
      if (!response.ok) throw new Error("Error fetching QR image");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast(`Código QR descargado como ${filename}.`);
    } catch (err) {
      console.error("Error downloading QR:", err);
      showToast("No pudimos descargar el código QR.", "error");
    }
  };

  const handleCopyQrUrlNew = async (bike) => {
    const codeQrStr = bike?.codigo_qr || (bike?.id ? `BF-QR-${bike.id}` : null);
    if (!codeQrStr) {
      showToast("No pudimos copiar el código QR.", "error");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeQrStr);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = codeQrStr;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast("Código QR copiado.");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    } catch (err) {
      showToast("No pudimos copiar el código QR.", "error");
    }
  };

  const handleCopyQrUrl = async (urlToCopy) => {
    if (!urlToCopy) {
      showToast("No se pudo copiar el QR.", "error");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = urlToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast("Enlace del QR copiado.");
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 1800);
    } catch (err) {
      showToast("No pudimos copiar el enlace. Inténtalo nuevamente.", "error");
    }
  };

  const handlePrintQrSticker = (bike) => {
    if (!bike) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const codeQrStr = bike.codigo_qr || `BF-QR-${bike.id}`;
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(codeQrStr)}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pasaporte QR - ${bike.marca} ${bike.modelo}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; text-align: center; background: #fff; color: #111; }
            .card { border: 3px solid #111; padding: 24px; border-radius: 20px; max-width: 380px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            h2 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
            .sub { font-size: 11px; color: #555; font-weight: bold; text-transform: uppercase; margin-bottom: 12px; }
            .badge { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 12px; }
            img { margin: 10px 0; width: 220px; height: 220px; border-radius: 12px; border: 1px solid #eee; }
            .code { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 8px; background: #111; color: #fff; padding: 6px 12px; border-radius: 8px; display: inline-block; }
            .info { text-align: left; font-size: 11px; margin-top: 14px; border-top: 1px solid #ddd; padding-top: 10px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🚴 BIKERSFORT</h2>
            <div class="badge">${bike.marca} ${bike.modelo} (${bike.tipo_bicicleta || 'MTB'})</div>
            <div>
              <img src="${qrImgSrc}" alt="Código QR" />
            </div>
            <div class="code">${bike.codigo_qr || `QR-BF-${bike.id}`}</div>
            <div class="info">
              <div><strong>N° Serie / VIN:</strong> ${bike.numero_serie_cuadro || 'Sin serie registrada'}</div>
              <div><strong>Propietario:</strong> ${bike.cliente_nombre || 'Cliente Registrado'}</div>
              <div><strong>Escaneo:</strong> Check-in de Recepción & Trazabilidad</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (detailBike && detailBike.id) {
      fetchPhotos(detailBike.id);
      fetchComponents(detailBike.id);
      fetchHistory(detailBike.id);
    }
  }, [detailBike, activeTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (detailBike) {
          if (isEditingDetail) {
            handleCancelDetailEdit();
          } else {
            handleCloseDetailModal();
          }
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailBike, isEditingDetail, isDrawerOpen]);

  const handleViewDetail = async (item, startInEditMode = false, targetTab = null) => {
    let bikeData = item;
    try {
      const res = await fetch(`/api/crm/bicicletas/${item.id}`);
      if (res.ok) {
        const fullBike = await res.json();
        bikeData = fullBike;
      }
    } catch (err) {
      console.error("Error fetching bike detail:", err);
    }
    setDetailBike(bikeData);

    const foundClient = clientes.find(c => String(c.id) === String(bikeData.cliente_id) || c.nombre_completo === bikeData.cliente_nombre);
    const targetClienteId = foundClient ? foundClient.id : (bikeData.cliente_id || "");

    setFormData({
      cliente_id: targetClienteId,
      marca: bikeData.marca || "",
      modelo: bikeData.modelo || "",
      tipo_bicicleta: bikeData.tipo_bicicleta || "MTB",
      ano: bikeData.ano || new Date().getFullYear(),
      color: bikeData.color || "",
      talla: bikeData.talla || "M",
      numero_serie_cuadro: bikeData.numero_serie_cuadro || "",
      descripcion: bikeData.descripcion || "",
      kilometraje_actual: bikeData.kilometraje_actual || 0,
      notas_tecnicas: bikeData.notas_tecnicas || ""
    });
    const tabCandidate = targetTab || initialTab || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null);
    if (tabCandidate && VALID_BICYCLE_TABS.has(tabCandidate)) {
      setActiveTab(tabCandidate);
    } else {
      setActiveTab("general");
    }
    setIsEditingDetail(startInEditMode);
    setErrors({});
  };

  const handleCancelDetailEdit = () => {
    setIsEditingDetail(false);
    if (detailBike) {
      const foundClient = clientes.find(c => String(c.id) === String(detailBike.cliente_id) || c.nombre_completo === detailBike.cliente_nombre);
      const targetClienteId = foundClient ? foundClient.id : (detailBike.cliente_id || "");
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
    }
    setErrors({});
  };

  const handleSaveDetailEdit = (e) => {
    if (e) e.preventDefault();
    
    const isValid = validateForm();

    if (!isValid) {
      setActiveTab("general");
      setTimeout(() => {
        const firstErrorEl = document.querySelector("[data-invalid='true']");
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof firstErrorEl.focus === "function") {
            firstErrorEl.focus();
          }
        }
      }, 100);
      return;
    }

    setIsSaveConfirmOpen(true);
  };

  const executeDetailSave = async () => {
    setIsSaveConfirmOpen(false);
    const bikeTargetId = detailBike?.id || detailBike?.bicicleta_id;
    if (!bikeTargetId) {
      showToast("Error: No se encontró la bicicleta a actualizar.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeTargetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo actualizar la bicicleta.");
      }

      showToast("Bicicleta actualizada correctamente.");
      
      const clientObj = clientes.find(c => String(c.id) === String(formData.cliente_id));
      const updatedBike = {
        ...detailBike,
        ...json,
        cliente_nombre: clientObj ? clientObj.nombre_completo : detailBike.cliente_nombre,
        cliente_correo: clientObj ? clientObj.correo : detailBike.cliente_correo,
        cliente_telefono: clientObj ? clientObj.telefono_principal : detailBike.cliente_telefono,
        cliente_nivel: clientObj ? clientObj.tipo_cliente : detailBike.cliente_nivel
      };
      setDetailBike(updatedBike);
      setIsEditingDetail(false);
      fetchData();
    } catch (err) {
      showToast(err.message || "Ocurrió un error al guardar los cambios.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const getGlobalHealthData = () => {
    let worstComponent = null;
    let maxWear = -1;

    (bikeComponents || []).forEach((comp) => {
      const wear = Number(comp.nivel_desgaste || 0);
      if (wear > maxWear) {
        maxWear = wear;
        worstComponent = comp;
      }
    });

    return {
      percentage: null,
      statusLabel: "Sin evaluación",
      barColor: "bg-slate-700",
      textColor: "text-slate-400",
      criticalItem: maxWear >= 50 ? worstComponent : null
    };
  };

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.cliente_id && formData.cliente_id !== 0) {
      errs.cliente_id = "Debe seleccionar el cliente propietario.";
    }

    const marcaRes = validateRequiredText(formData.marca || "", "La Marca", 100);
    if (!marcaRes.isValid) {
      errs.marca = marcaRes.message;
    }

    const modeloRes = validateRequiredText(formData.modelo || "", "El Modelo", 100);
    if (!modeloRes.isValid) {
      errs.modelo = modeloRes.message;
    }

    if (formData.ano !== "" && formData.ano !== null && formData.ano !== undefined) {
      const yearNum = Number(formData.ano);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        errs.ano = "Ingrese un año válido (ej. 2025).";
      }
    }

    if (formData.kilometraje_actual !== "" && formData.kilometraje_actual !== null && formData.kilometraje_actual !== undefined) {
      const kmNum = Number(formData.kilometraje_actual);
      if (isNaN(kmNum) || kmNum < 0) {
        errs.kilometraje_actual = "El kilometraje debe ser mayor o igual a cero.";
      }
    }

    if (formData.numero_serie_cuadro && formData.numero_serie_cuadro.length > 100) {
      errs.numero_serie_cuadro = "El número de serie no puede exceder los 100 caracteres.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenDrawer = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        cliente_id: item.cliente_id || "",
        marca: item.marca || "",
        modelo: item.modelo || "",
        tipo_bicicleta: item.tipo_bicicleta || "MTB",
        ano: item.ano || new Date().getFullYear(),
        color: item.color || "",
        talla: item.talla || "M",
        numero_serie_cuadro: item.numero_serie_cuadro || "",
        descripcion: item.descripcion || "",
        kilometraje_actual: item.kilometraje_actual || 0,
        notas_tecnicas: item.notas_tecnicas || ""
      });
      fetchPhotos(item.id);
      fetchComponents(item.id);
    } else {
      setEditingItem(null);
      setFormData({
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
      setBikePhotos([]);
      setBikeComponents([]);
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
        ? `/api/crm/bicicletas/${editingItem.id}`
        : "/api/crm/bicicletas";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "No se pudo guardar la bicicleta.");
      }

      showToast(
        editingItem
          ? "Bicicleta actualizada correctamente."
          : "Bicicleta registrada exitosamente."
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
    const targetId = itemToDelete.id || itemToDelete.bicicleta_id;
    try {
      const res = await fetch(`/api/crm/bicicletas/${targetId}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const errorMsg = json?.message || json?.error || "No fue posible eliminar la bicicleta. Inténtalo nuevamente.";
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

  // Image Selection Handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Por favor seleccione un archivo de imagen válido.", "error");
      return;
    }

    setSelectedPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedPhotoDataUrl(event.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  // Select Photo Card for Editing
  const handleSelectPhotoForEdit = (photo) => {
    setEditingPhoto(photo);
    setNewPhotoDesc(photo.descripcion || photo.nombre_archivo || "");
    setNewPhotoType(photo.tipo_foto || "GENERAL");
    setNewPhotoComponentId(photo.bicicleta_componente_id || "");
    setNewPhotoEsPrincipal(Boolean(photo.es_principal));
    setSelectedPhotoFile(null);
    setSelectedPhotoDataUrl("");
  };

  // Cancel Photo Editing Mode
  const handleCancelPhotoEdit = () => {
    setEditingPhoto(null);
    setNewPhotoDesc("");
    setNewPhotoType("GENERAL");
    setNewPhotoComponentId("");
    setNewPhotoEsPrincipal(false);
    setSelectedPhotoFile(null);
    setSelectedPhotoDataUrl("");
  };

  // Save or Update Photo Handler
  const saveOrUpdatePhoto = async (rawBikeId) => {
    const targetBikeId = Number(rawBikeId || detailBike?.bicicleta_id || detailBike?.id);
    if (!targetBikeId || isNaN(targetBikeId) || targetBikeId <= 0) {
      showToast("Error: No se pudo identificar el ID de la bicicleta para la fotografía.", "error");
      return;
    }

    // Case 1: Editing existing photo (PUT)
    if (editingPhoto) {
      setIsUploading(true);
      try {
        const res = await fetch(`/api/crm/bicicletas/${targetBikeId}/photos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPhoto.id,
            tipo_foto: newPhotoType,
            descripcion: newPhotoDesc,
            bicicleta_componente_id: newPhotoComponentId || null,
            es_principal: newPhotoEsPrincipal
          })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al actualizar fotografía.");

        showToast("Fotografía actualizada exitosamente.");
        handleCancelPhotoEdit();
        fetchPhotos(targetBikeId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Case 2: Uploading new photo (POST)
    if (!selectedPhotoFile && !selectedPhotoDataUrl) {
      showToast("Por favor seleccione primero un archivo de imagen.", "error");
      return;
    }

    if (selectedPhotoFile) {
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(selectedPhotoFile.type)) {
        showToast("Solo se permiten imágenes en formato JPG, PNG o WEBP.", "error");
        return;
      }
      if (selectedPhotoFile.size > 10 * 1024 * 1024) {
        showToast("El archivo de imagen excede el límite máximo de 10 MB.", "error");
        return;
      }
    }

    setIsUploading(true);
    try {
      let objectKey = null;
      let uploadToken = null;
      let filename = selectedPhotoFile ? selectedPhotoFile.name : `foto_${Date.now()}.png`;

      if (selectedPhotoFile) {
        // 1. Request presigned upload URL from S3 API
        const presignRes = await fetch("/api/storage/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedPhotoFile.name,
            contentType: selectedPhotoFile.type || "image/jpeg",
            size: selectedPhotoFile.size,
            module: "crm",
            entityType: "bicicletas",
            entityId: targetBikeId
          })
        });

        const presignData = await presignRes.json();
        if (!presignRes.ok) {
          throw new Error(
            presignData.message ||
            presignData.error ||
            "No se pudo generar la URL firmada de subida."
          );
        }

        // 2. Direct PUT to S3
        const s3PutRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedPhotoFile.type || "image/jpeg" },
          body: selectedPhotoFile
        });

        if (!s3PutRes.ok) {
          throw new Error("No se pudo transferir la imagen al almacenamiento S3.");
        }

        objectKey = presignData.objectKey;
        uploadToken = presignData.uploadToken;
      }

      // 3. Persist photo metadata in PostgreSQL
      const res = await fetch(`/api/crm/bicicletas/${targetBikeId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          uploadToken,
          url_archivo: null,
          nombre_archivo: filename,
          tipo_foto: newPhotoType,
          descripcion: newPhotoDesc || filename,
          bicicleta_componente_id: newPhotoComponentId || null,
          es_principal: newPhotoEsPrincipal || bikePhotos.length === 0
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar fotografía.");

      showToast("Fotografía guardada exitosamente en S3.");
      handleCancelPhotoEdit();
      fetchPhotos(targetBikeId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Hard Delete Photo Handler
  const handleDeletePhoto = async (bikeId, photoId) => {
    const targetPhoto = bikePhotos.find((p) => p.id === photoId);
    if (targetPhoto && (targetPhoto.tipo_foto === "COMPONENTE" || targetPhoto.bicicleta_componente_id)) {
      showToast("Las fotografías de componentes son de solo lectura y no se pueden eliminar desde este panel.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/photos?photoId=${photoId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar fotografía.");

      showToast("Fotografía eliminada permanentemente de la base de datos.");
      if (editingPhoto && editingPhoto.id === photoId) {
        handleCancelPhotoEdit();
      }
      fetchPhotos(bikeId);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Component Save Handler for admin.bicicleta_componentes (Inline Panel)
  const handleSaveComponent = async (e) => {
    e.preventDefault();
    if (!detailBike || !detailBike.id) return;
    if (!componentForm.categoria_componente_id) {
      showToast("Debe seleccionar la categoría del componente.", "error");
      return;
    }

    try {
      const isEditing = Boolean(editingComponent);
      const url = `/api/crm/bicicletas/${detailBike.id}/components`;
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing 
        ? { ...componentForm, bicicleta_componente_id: editingComponent.id || editingComponent.bicicleta_componente_id }
        : componentForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar componente.");

      showToast(isEditing ? "Componente actualizado exitosamente." : "Componente registrado exitosamente.");
      handleCancelComponentForm();
      fetchComponents(detailBike.id);
      fetchData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleEditComponent = (comp) => {
    setEditingComponent(comp);
    setComponentForm({
      categoria_componente_id: comp.categoria_componente_id ? String(comp.categoria_componente_id) : "",
      estado_componente_id: comp.estado_componente_id ? String(comp.estado_componente_id) : "",
      marca: comp.marca || "",
      modelo: comp.modelo || "",
      numero_serie: comp.numero_serie || "",
      descripcion: comp.descripcion || "",
      kilometraje_instalacion: comp.kilometraje_instalacion || 0
    });
    setIsComponentFormOpen(true);
  };

  const handleCancelComponentForm = () => {
    setIsComponentFormOpen(false);
    setEditingComponent(null);
    setComponentForm({
      categoria_componente_id: "",
      estado_componente_id: "",
      marca: "",
      modelo: "",
      numero_serie: "",
      descripcion: "",
      kilometraje_instalacion: 0
    });
  };

  // Hard Delete Component Handler
  const handleDeleteComponent = async (bikeId, componentId) => {
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/components?componentId=${componentId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar componente.");

      showToast("Componente eliminado permanentemente de la base de datos.");
      fetchComponents(bikeId);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Filter & Sort Logic
  const filteredData = data.filter((item) => {
    const query = search.toLowerCase();
    const matchesSearch =
      (item.marca || "").toLowerCase().includes(query) ||
      (item.modelo || "").toLowerCase().includes(query) ||
      (item.cliente_nombre || "").toLowerCase().includes(query) ||
      (item.numero_serie_cuadro || "").toLowerCase().includes(query);

    const matchesType =
      typeFilter === "Todos" ||
      (item.tipo_bicicleta || "").toUpperCase() === typeFilter.toUpperCase();

    return matchesSearch && matchesType;
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

  const getBadgeStyleForState = (nivelDesgaste, estadoCodigo) => {
    const code = String(estadoCodigo || "").toUpperCase();
    const wear = Number(nivelDesgaste || 0);

    if (wear >= 70 || code === "CRITICO" || code === "DANADO" || code === "REEMPLAZADO") {
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    }
    if (wear >= 40 || code === "REGULAR" || code === "DESGASTE_MEDIO") {
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
    if (wear >= 20 || code === "BUENO") {
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    }
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  };

  const isOpeningInitialBike = Boolean(initialBikeId) && loadingDetail && !detailBike;

  if (isOpeningInitialBike) {
    if (detailError) {
      return (
        <div className="p-8 max-w-lg mx-auto mt-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 font-mono text-xs text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="font-bold text-sm text-rose-200">No pudimos cargar la bicicleta.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleFetchSingleBike(initialBikeId)}
              className="px-4 py-2 bg-[#bfce7f] text-slate-950 rounded-xl font-bold uppercase hover:bg-[#a6b66b]"
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
              className="px-4 py-2 bg-rose-500/20 text-rose-200 rounded-xl font-bold uppercase hover:bg-rose-500/30"
            >
              Volver al listado
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-2xl text-slate-400 gap-3 font-mono min-h-[450px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#bfce7f]" />
        <span className="text-xs font-bold text-slate-300">Cargando expediente de la bicicleta...</span>
      </div>
    );
  }

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
            <span className="text-white font-bold">Bicicletas</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-white tracking-tight">
            Gestión de Bicicletas
          </h1>
          <p className="text-slate-400 font-mono text-xs md:text-sm mt-1">
            Directorio maestro de flota, registro técnico y pasaportes digitales de clientes.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setIsDrawerOpen(true);
          }}
          className="bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus size={18} />
          Registrar Bicicleta
        </button>
      </div>

      {/* Search & Type Filter Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, cliente o número de serie..."
            className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#bfce7f]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#0e1117] border border-[#2d3748] rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#bfce7f] cursor-pointer"
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
            className="p-2.5 bg-[#0e1117] border border-[#2d3748] rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Featured Asset Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {loading ? (
          <div className="col-span-full py-10 text-center font-mono text-xs text-slate-400">
            <RefreshCw className="animate-spin inline-block mr-2" size={16} />
            Cargando inventario de bicicletas...
          </div>
        ) : data.slice(0, 4).map((item) => (
          <div
            key={item.id}
            onClick={() => setDetailBike(item)}
            className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 shadow-xl space-y-3 cursor-pointer hover:border-[#bfce7f]/50 transition-all group"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className="px-2.5 py-0.5 rounded bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f] font-mono text-[10px] font-bold uppercase inline-block mb-1">
                  {item.tipo_bicicleta || "MTB"} • {item.ano || 2025}
                </span>

                <h3 className="font-mono text-base font-bold text-white group-hover:text-[#bfce7f] transition-colors truncate">
                  {item.marca} {item.modelo}
                </h3>
                <p className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                  SN: {item.numero_serie_cuadro || "SN-BF-" + item.id}
                </p>
              </div>

              {/* Bicycle Photo Thumbnail on the right */}
              <div className="w-20 h-16 rounded-xl border border-[#2d3748] bg-[#0e1117] overflow-hidden shrink-0 relative flex items-center justify-center">
                {item.foto_url ? (
                  <img
                    src={item.foto_url}
                    alt={item.modelo || "Bicicleta"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-[#11151c] flex flex-col items-center justify-center p-1.5 text-center">
                    <Bike size={18} className="text-[#bfce7f]" />
                    <span className="text-[8px] font-mono text-slate-400 font-bold uppercase mt-0.5">
                      {item.tipo_bicicleta || "Bici"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[#2d3748]/60 flex items-center gap-2">
              <User size={13} className="text-[#bfce7f]" />
              <span className="font-mono text-xs text-slate-300 truncate">
                {item.cliente_nombre}
              </span>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between font-mono text-[10px] text-slate-400">
                <span>Salud Global</span>
                <span className={item.salud !== null && item.salud !== undefined ? (item.salud >= 80 ? 'text-emerald-400 font-bold' : item.salud >= 60 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold') : 'text-slate-400'}>
                  {item.salud !== null && item.salud !== undefined ? `${item.salud}%` : "Sin evaluación"}
                </span>
              </div>
              <div className="w-full bg-[#0e1117] h-1.5 rounded-full overflow-hidden border border-[#2d3748]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${item.salud !== null && item.salud !== undefined ? (item.salud >= 80 ? 'bg-emerald-400' : item.salud >= 60 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-700'}`}
                  style={{ width: `${item.salud !== null && item.salud !== undefined ? item.salud : 0}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Data Table Card */}
      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-[#0e1117] border-b border-[#2d3748] flex justify-between items-center font-mono">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Bike size={16} className="text-[#bfce7f]" />
            Inventario Completo de Bicicletas
          </h3>
          <span className="text-slate-400 text-xs">
            {sortedData.length} Activos Registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0e1117] border-b border-[#2d3748] select-none">
                <th
                  onClick={() => handleSort("marca")}
                  className="py-3.5 px-5 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>BICICLETA / MODELO</span>
                    <ArrowUpDown size={13} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("numero_serie_cuadro")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  NÚMERO DE SERIE
                </th>
                <th
                  onClick={() => handleSort("cliente_nombre")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  PROPIETARIO
                </th>
                <th
                  onClick={() => handleSort("fecha_ultima_revision")}
                  className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase cursor-pointer hover:text-white"
                >
                  ÚLTIMO SERVICIO
                </th>
                <th className="py-3.5 px-4 text-slate-400 font-bold text-[11px] uppercase text-center">
                  ESTADO
                </th>
                <th className="py-3.5 px-5 text-right text-slate-400 font-bold text-[11px] uppercase">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Cargando bicicletas...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                    No se encontraron bicicletas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#1f242d] transition-colors cursor-pointer group"
                    onClick={() => handleViewDetail(item, false)}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1c2129] flex items-center justify-center text-[#bfce7f] border border-[#2d3748] shrink-0 overflow-hidden">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.modelo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Bike size={16} className="text-[#bfce7f]" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white group-hover:text-[#bfce7f] transition-colors truncate">
                            {item.marca} {item.modelo}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {item.tipo_bicicleta || 'MTB'} • {item.color || 'Sin especificación'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {item.numero_serie_cuadro || "SN-BF-" + item.id}
                    </td>

                    <td className="py-3.5 px-4 text-slate-200 font-bold">
                      {item.cliente_nombre}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {item.fecha_ultima_revision ? item.fecha_ultima_revision : "Sin intervenciones"}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
                        ACTIVO / TALLER
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetail(item, true)}
                          title="Editar bicicleta"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
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
            Mostrando {paginatedData.length} de {sortedData.length} bicicletas
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

      {/* 360 Bicycle Detail / Fullscreen Workspace View */}
      {mounted && detailBike && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: '#0e1117', display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }} className="font-sans">
          
          {/* 1. ENCABEZADO FIJO */}
          <div className="p-4 sm:p-5 bg-[#161a21] border-b border-[#2d3748] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 font-mono z-10">
            
            {/* Informacion de la bicicleta & Volver */}
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => handleCloseDetailModal()}
                className="px-3.5 py-2 bg-[#0e1117] hover:bg-[#2d3748] text-slate-300 hover:text-white border border-[#2d3748] rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} />
                <span>Volver al Listado</span>
              </button>

              <div className="h-8 w-px bg-[#2d3748] hidden sm:block shrink-0" />

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#bfce7f]/10 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f] overflow-hidden shrink-0">
                  {((bikePhotos.length > 0 && bikePhotos.find(p => p.es_principal)?.url_archivo) || detailBike.foto_url) ? (
                    <img
                      src={
                        (bikePhotos.length > 0 && bikePhotos.find(p => p.es_principal)?.url_archivo)
                          ? (bikePhotos.find(p => p.es_principal)?.url_archivo || bikePhotos[0].url_archivo)
                          : detailBike.foto_url
                      }
                      alt="Foto de Bicicleta"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bike size={24} className="text-[#bfce7f]" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-lg sm:text-xl font-bold text-white truncate">
                      {detailBike.marca} {detailBike.modelo}
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-[#bfce7f]/15 text-[#bfce7f] border border-[#bfce7f]/30 font-mono text-[10px] font-bold uppercase shrink-0">
                      {detailBike.tipo_bicicleta || "MTB"}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold uppercase shrink-0">
                      ACTIVO
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-400 truncate mt-0.5">
                    VIN / SERIE: {detailBike.numero_serie_cuadro || "Sin serie registrada"} • CÓDIGO QR: {detailBike.codigo_qr} • PROPIETARIO: <strong className="text-[#bfce7f]">{detailBike.cliente_nombre}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Botones de Accion del Header */}
            <div className="flex items-center gap-3 self-end md:self-auto shrink-0 font-mono">
              {!isEditingDetail ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDetail(true);
                      const foundClient = clientes.find(c => String(c.id) === String(detailBike.cliente_id) || c.nombre_completo === detailBike.cliente_nombre);
                      const targetClienteId = foundClient ? foundClient.id : (detailBike.cliente_id || "");
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
                    className="px-4 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                  >
                    <Edit2 size={15} />
                    <span>Editar</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelDetailEdit}
                    className="px-4 py-2 bg-[#0e1117] hover:bg-[#2d3748] text-slate-300 hover:text-white border border-[#2d3748] rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetailEdit}
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                    <span>Guardar Cambios</span>
                  </button>
                </>
              )}
            </div>

          </div>

          {/* 2. ÁREA DE TRABAJO DESPLAZABLE */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar font-mono text-xs bg-[#0e1117]">
            
            {/* Tarjeta de Resumen de Salud & Advertencias Dinámica */}
            {(() => {
              const healthData = getGlobalHealthData();
              return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-7 bg-[#161a21] border border-[#2d3748] rounded-2xl p-4 font-mono space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">Estado General</span>
                      <span className={`text-xs font-bold ${healthData.textColor}`}>
                        {healthData.statusLabel}
                      </span>
                    </div>
                    <div className="w-full bg-[#0e1117] h-2.5 rounded-full overflow-hidden border border-[#2d3748]">
                      <div
                        className={`${healthData.barColor} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${healthData.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                      <span>Kilometraje total: {detailBike.kilometraje_actual || 0} KM</span>
                      <span>Último servicio: {detailBike.fecha_ultima_revision || "Sin intervenciones"}</span>
                    </div>
                  </div>

                  {healthData.criticalItem ? (
                    <div className="md:col-span-5 bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 font-mono space-y-1">
                      <span className="text-rose-400 text-xs font-bold flex items-center gap-1.5 uppercase">
                        <AlertTriangle size={15} /> DESGASTE CRÍTICO DETECTADO
                      </span>
                      <p className="text-[11px] text-slate-300">
                        <strong className="text-white">{healthData.criticalItem.categoria_nombre}</strong> ({healthData.criticalItem.especificacion}): Desgaste del {healthData.criticalItem.nivel_desgaste || 0}% ({healthData.criticalItem.estado_nombre || 'Desgaste Elevado'}). Reemplazo sugerido.
                      </p>
                    </div>
                  ) : (
                    <div className="md:col-span-5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 font-mono space-y-1">
                      <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5 uppercase">
                        <CheckCircle2 size={15} /> ESTADO DE COMPONENTES
                      </span>
                      <p className="text-[11px] text-slate-300">
                        {bikeComponents.length === 1
                          ? "El componente registrado opera en un nivel de conservación adecuado."
                          : bikeComponents.length > 1
                          ? `Los ${bikeComponents.length} componentes registrados operan sin alertas críticas.`
                          : "No hay registros de desgaste crítico adicionales."}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Navegación por Pestañas */}
            <div className="border-b border-[#2d3748] bg-[#161a21] px-4 rounded-2xl flex gap-6 font-mono text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("general")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "general"
                    ? "border-[#bfce7f] text-[#bfce7f]"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Info size={16} />
                <span>Información General</span>
              </button>

              <button
                onClick={() => setActiveTab("componentes")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "componentes"
                    ? "border-[#bfce7f] text-[#bfce7f]"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={16} />
                <span>Componentes & Desgaste</span>
                {bikeComponents.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#bfce7f]/20 text-[#bfce7f] text-[10px]">
                    {bikeComponents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("fotos")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "fotos"
                    ? "border-[#bfce7f] text-[#bfce7f]"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Camera size={16} />
                <span>Fotografías de Activo</span>
                {bikePhotos.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#bfce7f]/20 text-[#bfce7f] text-[10px]">
                    {bikePhotos.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("historial")}
                className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === "historial"
                    ? "border-[#bfce7f] text-[#bfce7f]"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Wrench size={16} />
                <span>Órdenes de Trabajo</span>
              </button>
            </div>

            {/* Contenido de las Pestañas */}
            <div>
              
              {/* 1. INFORMACIÓN GENERAL (CONSULTA Y EDICIÓN) */}
              {activeTab === "general" && (
                <div className="space-y-6">
                  {!isEditingDetail ? (
                    /* MODO CONSULTA (READ-ONLY) */
                    <div className="space-y-6 font-mono text-xs">
                      
                      {/* Propietario Card */}
                      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <User size={16} /> Propietario Registrado
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Nombre Completo</span>
                            <span className="text-white font-bold text-sm">{detailBike.cliente_nombre || "Sin propietario"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Correo Electrónico</span>
                            <span className="text-slate-200">{detailBike.cliente_correo || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Teléfono Contacto</span>
                            <span className="text-slate-200">{detailBike.cliente_telefono || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Tipo de Cliente</span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                              {detailBike.cliente_nivel || "Persona"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Especificaciones Grid */}
                      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <Bike size={16} /> Ficha Técnica de la Bicicleta
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Marca</span>
                            <span className="text-white font-bold text-sm">{detailBike.marca}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Modelo</span>
                            <span className="text-white font-bold text-sm">{detailBike.modelo}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Tipo de Bicicleta</span>
                            <span className="px-2 py-0.5 rounded bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f] font-bold">
                              {detailBike.tipo_bicicleta || "MTB"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Año Fabricación</span>
                            <span className="text-slate-200 font-bold">{detailBike.ano || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Color Principal</span>
                            <span className="text-slate-200 font-bold">{detailBike.color || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Talla del Cuadro</span>
                            <span className="text-slate-200 font-bold">{detailBike.talla || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Nº Serie Cuadro (VIN)</span>
                            <span className="text-slate-200 font-bold">{detailBike.numero_serie_cuadro || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase">Kilometraje Acumulado</span>
                            <span className="text-emerald-400 font-bold">{detailBike.kilometraje_actual || 0} KM</span>
                          </div>
                        </div>
                      </div>

                      {/* Grid de 2 Columnas para Identificación Digital (QR) y Observaciones */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch font-mono text-xs">
                        {/* COLUMNA IZQUIERDA — 50% Desktop: Identificación Digital & Registro */}
                        <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4 h-full flex flex-col justify-between">
                          <div>
                            <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2 mb-4">
                              <QrCode size={16} /> Identificación Digital & Registro
                            </h3>

                            {detailBike.codigo_qr ? (
                              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 bg-[#0e1117] p-5 rounded-2xl border border-[#2d3748]">
                                {/* Block with white background for QR Code */}
                                <div className="p-3 bg-white rounded-2xl shrink-0 shadow-lg text-center space-y-1.5 border border-slate-200">
                                  <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                      detailBike.codigo_qr || `BF-QR-${detailBike.id}`
                                    )}`}
                                    alt={`Código QR ${detailBike.codigo_qr}`}
                                    className="w-32 h-32 sm:w-36 sm:h-36 object-contain mx-auto"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const parent = e.currentTarget.parentElement;
                                      if (parent && !parent.querySelector('.qr-err-msg')) {
                                        const errDiv = document.createElement('div');
                                        errDiv.className = 'qr-err-msg text-rose-500 text-[10px] p-4 text-center font-bold';
                                        errDiv.innerText = 'No pudimos generar el código QR.';
                                        parent.appendChild(errDiv);
                                      }
                                    }}
                                  />
                                  <span className="block text-[10px] font-bold text-slate-900 bg-slate-100 py-0.5 px-2 rounded border border-slate-300 font-mono">
                                    {detailBike.codigo_qr}
                                  </span>
                                </div>

                                {/* Information & Action Buttons */}
                                <div className="space-y-3.5 flex-1 w-full min-w-0">
                                  <div className="space-y-2">
                                    <div>
                                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Código QR Único</span>
                                      <span className="text-white font-bold text-sm truncate block">{detailBike.codigo_qr}</span>
                                    </div>
                                    <div>
                                      <span className="block text-slate-400 text-[10px] uppercase font-bold">Estado del Pasaporte</span>
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase inline-block">
                                        Activo Verificado
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Buttons: Descargar QR & Copiar */}
                                  <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadQrPng(detailBike)}
                                      className="px-3.5 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
                                    >
                                      <Download size={14} />
                                      <span>Descargar QR</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyQrUrlNew(detailBike)}
                                      className="px-3.5 py-2 bg-[#161a21] border border-[#2d3748] text-slate-200 hover:text-white hover:border-[#bfce7f] hover:bg-[#212631] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                                    >
                                      {isCopied ? <Check size={14} className="text-[#bfce7f]" /> : <Copy size={14} />}
                                      <span>{isCopied ? "Copiado" : "Copiar"}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[#0e1117] p-6 rounded-2xl border border-[#2d3748] text-center space-y-4">
                                <p className="text-slate-400 text-xs font-bold">
                                  Esta bicicleta todavía no tiene un código QR asignado.
                                </p>
                                <div className="flex justify-center gap-3">
                                  <button
                                    type="button"
                                    disabled
                                    className="px-4 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-50"
                                  >
                                    <Download size={14} />
                                    <span>Descargar QR</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled
                                    className="px-4 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-50"
                                  >
                                    <Copy size={14} />
                                    <span>Copiar</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* COLUMNA DERECHA — 50% Desktop: Descripción General & Notas Técnicas */}
                        <div className="grid grid-rows-1 sm:grid-rows-2 gap-5 h-full">
                          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-2 h-full flex flex-col">
                            <span className="block text-[#bfce7f] text-xs font-bold uppercase tracking-wider border-b border-[#2d3748] pb-2">Descripción General</span>
                            <p className="text-slate-200 leading-relaxed pt-1 flex-1">
                              {detailBike.descripcion || "Sin descripción adicional registrada."}
                            </p>
                          </div>
                          <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-2 h-full flex flex-col">
                            <span className="block text-[#bfce7f] text-xs font-bold uppercase tracking-wider border-b border-[#2d3748] pb-2">Notas Técnicas u Observaciones</span>
                            <p className="text-slate-200 leading-relaxed pt-1 flex-1">
                              {detailBike.notas_tecnicas || "Sin observaciones técnicas especiales."}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* MODO EDICIÓN */
                    <form onSubmit={handleSaveDetailEdit} className="space-y-6 font-mono text-xs">
                      
                      {/* Propietario */}
                      <div className="bg-[#161a21] border border-[#bfce7f]/40 rounded-2xl p-6 space-y-4 shadow-xl">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <User size={16} /> 1. Cliente Propietario <span className="text-rose-400">*</span>
                        </h3>
                        <div>
                          <label className="block text-slate-300 mb-1">Seleccionar Cliente <span className="text-rose-400">*</span></label>
                          <select
                            data-invalid={errors.cliente_id ? "true" : undefined}
                            value={formData.cliente_id}
                            onChange={(e) => {
                              setFormData({ ...formData, cliente_id: e.target.value });
                              if (errors.cliente_id) setErrors(prev => ({ ...prev, cliente_id: null }));
                            }}
                            className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                              errors.cliente_id ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                            }`}
                          >
                            <option value="">-- Seleccionar Propietario --</option>
                            {clientes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre_completo} ({c.correo || c.telefono_principal})
                              </option>
                            ))}
                          </select>
                          {errors.cliente_id && <p className="text-rose-400 text-[10px] mt-1">{errors.cliente_id}</p>}
                        </div>
                      </div>

                      {/* Especificaciones */}
                      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <Bike size={16} /> 2. Especificaciones de la Bicicleta
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-300 mb-1">Marca <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              data-invalid={errors.marca ? "true" : undefined}
                              value={formData.marca}
                              onChange={(e) => {
                                setFormData({ ...formData, marca: e.target.value });
                                if (errors.marca) setErrors(prev => ({ ...prev, marca: null }));
                              }}
                              placeholder="Ej: Specialized, Trek, Santa Cruz"
                              className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                                errors.marca ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                              }`}
                            />
                            {errors.marca && <p className="text-rose-400 text-[10px] mt-1">{errors.marca}</p>}
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Modelo <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              data-invalid={errors.modelo ? "true" : undefined}
                              value={formData.modelo}
                              onChange={(e) => {
                                setFormData({ ...formData, modelo: e.target.value });
                                if (errors.modelo) setErrors(prev => ({ ...prev, modelo: null }));
                              }}
                              placeholder="Ej: Stumpjumper, Fuel EX 8"
                              className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                                errors.modelo ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                              }`}
                            />
                            {errors.modelo && <p className="text-rose-400 text-[10px] mt-1">{errors.modelo}</p>}
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Tipo de Bicicleta</label>
                            <select
                              value={formData.tipo_bicicleta}
                              onChange={(e) => setFormData({ ...formData, tipo_bicicleta: e.target.value })}
                              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                            >
                              <option value="MTB">MTB (Montaña)</option>
                              <option value="ROAD">Road (Ruta)</option>
                              <option value="E-BIKE">E-Bike (Eléctrica)</option>
                              <option value="GRAVEL">Gravel</option>
                              <option value="ENDURO">Enduro</option>
                              <option value="CITY">Urbana / Ciudad</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Año</label>
                            <input
                              type="number"
                              data-invalid={errors.ano ? "true" : undefined}
                              value={formData.ano}
                              onChange={(e) => {
                                setFormData({ ...formData, ano: e.target.value });
                                if (errors.ano) setErrors(prev => ({ ...prev, ano: null }));
                              }}
                              placeholder="2025"
                              className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                                errors.ano ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                              }`}
                            />
                            {errors.ano && <p className="text-rose-400 text-[10px] mt-1">{errors.ano}</p>}
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Color</label>
                            <input
                              type="text"
                              value={formData.color}
                              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                              placeholder="Ej: Negro Mate / Verde Lima"
                              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Talla Cuadro</label>
                            <input
                              type="text"
                              value={formData.talla}
                              onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                              placeholder="Ej: M, L, 54cm"
                              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Identificación Técnica */}
                      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <Shield size={16} /> 3. Identificación Técnica & Odómetro
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-300 mb-1">Número de Serie del Cuadro</label>
                            <input
                              type="text"
                              data-invalid={errors.numero_serie_cuadro ? "true" : undefined}
                              value={formData.numero_serie_cuadro}
                              onChange={(e) => {
                                setFormData({ ...formData, numero_serie_cuadro: e.target.value });
                                if (errors.numero_serie_cuadro) setErrors(prev => ({ ...prev, numero_serie_cuadro: null }));
                              }}
                              placeholder="Ej: SPZ-9982-XJ102"
                              className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                                errors.numero_serie_cuadro ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                              }`}
                            />
                            {errors.numero_serie_cuadro && <p className="text-rose-400 text-[10px] mt-1">{errors.numero_serie_cuadro}</p>}
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1">Kilometraje Estimado (KM)</label>
                            <input
                              type="number"
                              data-invalid={errors.kilometraje_actual ? "true" : undefined}
                              value={formData.kilometraje_actual}
                              onChange={(e) => {
                                setFormData({ ...formData, kilometraje_actual: e.target.value });
                                if (errors.kilometraje_actual) setErrors(prev => ({ ...prev, kilometraje_actual: null }));
                              }}
                              placeholder="0"
                              className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                                errors.kilometraje_actual ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                              }`}
                            />
                            {errors.kilometraje_actual && <p className="text-rose-400 text-[10px] mt-1">{errors.kilometraje_actual}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Observaciones */}
                      <div className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 space-y-4">
                        <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-xs border-b border-[#2d3748] pb-2 flex items-center gap-2">
                          <Paperclip size={16} /> 4. Observaciones & Notas Técnicas
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-300 mb-1">Descripción General</label>
                            <textarea
                              rows={3}
                              value={formData.descripcion}
                              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                              placeholder="Descripción general del activo..."
                              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-white focus:outline-none focus:border-[#bfce7f]"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-300 mb-1">Notas Técnicas u Observaciones</label>
                            <textarea
                              rows={3}
                              value={formData.notas_tecnicas}
                              onChange={(e) => setFormData({ ...formData, notas_tecnicas: e.target.value })}
                              placeholder="Observaciones de taller o accesorios..."
                              className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-3 text-white focus:outline-none focus:border-[#bfce7f]"
                            />
                          </div>
                        </div>
                      </div>

                    </form>
                  )}
                </div>
              )}

              {/* 2. COMPONENTES & DESGASTE TAB */}
              {activeTab === "componentes" && (
                <BicycleComponentsEditor
                  mode="persisted"
                  bikeId={detailBike.id}
                  components={bikeComponents}
                  categoriesList={categoriesList}
                  statesList={statesList}
                  onRefresh={() => {
                    fetchComponents(detailBike.id);
                    fetchHistory(detailBike.id);
                    fetchData();
                  }}
                  showToast={showToast}
                />
              )}

              {/* 3. FOTOGRAFÍAS DE ACTIVO TAB */}
              {activeTab === "fotos" && (
                <BicyclePhotosEditor
                  mode="persisted"
                  bikeId={detailBike.id}
                  photos={bikePhotos}
                  componentsList={bikeComponents}
                  onRefresh={() => {
                    fetchPhotos(detailBike.id);
                    fetchData();
                  }}
                  showToast={showToast}
                />
              )}

              {/* 4. ÓRDENES DE TRABAJO TAB */}
              {activeTab === "historial" && (
                <div className="space-y-6 font-mono text-xs">
                  {/* Top Bar Header */}
                  <div className="flex justify-between items-center bg-[#161a21] p-4 border border-[#2d3748] rounded-2xl flex-wrap gap-3">
                    <div>
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                        <Wrench size={16} className="text-[#bfce7f]" />
                        <span>Órdenes de Trabajo & Mantenimientos</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Registro cronológico real de intervenciones realizadas a esta bicicleta.
                      </p>
                    </div>
                  </div>

                  {/* Timeline List */}
                  {loadingHistory ? (
                    <div className="py-10 text-center text-slate-400 font-mono">
                      <RefreshCw size={20} className="animate-spin inline-block mr-2" />
                      Cargando órdenes de trabajo...
                    </div>
                  ) : bikeHistory.length === 0 ? (
                    <div className="p-8 text-center bg-[#161a21] border border-[#2d3748] rounded-2xl space-y-3 font-mono">
                      <Wrench size={36} className="mx-auto text-slate-500" />
                      <p className="text-slate-300 font-bold">Sin órdenes de trabajo registradas</p>
                      <p className="text-slate-500 text-[11px]">
                        Las órdenes de trabajo creadas para esta bicicleta se mostrarán cronológicamente aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="border-l-2 border-[#2d3748] pl-6 space-y-6 ml-4 py-2 font-mono">
                      {bikeHistory.map((item) => {
                        const rawOrderId = item.orden_trabajo_id || item.id;
                        const validOrderId = Number(rawOrderId) && !isNaN(Number(rawOrderId)) ? Number(rawOrderId) : null;

                        if (!validOrderId && process.env.NODE_ENV !== "production") {
                          console.warn("Falta orden_trabajo_id para el registro:", item);
                        }

                        let badgeStyle = "bg-[#bfce7f]/15 text-[#bfce7f] border-[#bfce7f]/30";
                        let dotBg = "bg-[#bfce7f]";

                        if (item.tipo_servicio === "REPARACION") {
                          badgeStyle = "bg-amber-500/15 text-amber-400 border-amber-500/30";
                          dotBg = "bg-amber-400";
                        } else if (item.tipo_servicio === "GARANTIA") {
                          badgeStyle = "bg-sky-500/15 text-sky-400 border-sky-500/30";
                          dotBg = "bg-sky-400";
                        } else if (item.tipo_servicio === "UPGRADE") {
                          badgeStyle = "bg-purple-500/15 text-purple-400 border-purple-500/30";
                          dotBg = "bg-purple-400";
                        }

                        const codeText = item.codigo_orden || (item.titulo_servicio ? item.titulo_servicio.split(" — ")[0] : "");
                        const descriptionText = item.titulo_servicio && item.titulo_servicio.includes(" — ")
                          ? item.titulo_servicio.split(" — ").slice(1).join(" — ")
                          : (item.titulo_servicio && !item.codigo_orden ? item.titulo_servicio : "Orden de Trabajo");

                        const currentBikeId = detailBike?.id || detailBike?.bicicleta_id;
                        const bicycleReturnUrl = currentBikeId ? `/crm/bicycles?id=${currentBikeId}&tab=historial` : "/crm/bicycles";
                        const encodedReturnUrl = encodeURIComponent(bicycleReturnUrl);

                        return (
                          <div key={item.id} className="relative group">
                            <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full ${dotBg} border-4 border-[#0e1117] transition-transform group-hover:scale-125`} />
                            <div className="bg-[#161a21] border border-[#2d3748] group-hover:border-[#bfce7f]/50 rounded-2xl p-5 space-y-2 transition-all shadow-md">
                              <div className="flex justify-between items-start flex-wrap gap-2">
                                <div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-white text-xs">
                                      📅 {item.fecha_servicio || "Sin fecha"}
                                    </span>
                                    <span className="text-slate-400 text-xs font-bold">
                                      • {(item.kilometraje_servicio !== undefined && item.kilometraje_servicio !== null && item.kilometraje_servicio !== '') ? item.kilometraje_servicio : (detailBike?.kilometraje_actual || 0)} KM
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-white text-sm mt-1 flex items-center gap-2 flex-wrap">
                                    {validOrderId ? (
                                      <Link
                                        href={`/work-orders?order_id=${validOrderId}&return_to=${encodedReturnUrl}`}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={`Ver detalle de la orden ${item.codigo_orden || codeText || validOrderId}`}
                                        className="text-[#bfce7f] hover:text-[#a6b66b] underline transition-colors font-bold focus:outline-none focus:ring-1 focus:ring-[#bfce7f] rounded"
                                      >
                                        {codeText || `OT-${validOrderId}`}
                                      </Link>
                                    ) : (
                                      <span className="text-slate-200">
                                        {codeText || "SIN OT"}
                                      </span>
                                    )}
                                    {descriptionText && (
                                      <span className="text-slate-300">
                                        — {descriptionText}
                                      </span>
                                    )}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {validOrderId ? (
                                    <Link
                                      href={`/work-orders?order_id=${validOrderId}&return_to=${encodedReturnUrl}`}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Ver detalle de la orden ${item.codigo_orden || codeText || validOrderId}`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#bfce7f]/15 hover:bg-[#bfce7f]/25 text-[#bfce7f] border border-[#bfce7f]/30 hover:border-[#bfce7f]/60 rounded-xl font-mono text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-[#bfce7f] cursor-pointer"
                                    >
                                      <Eye size={14} />
                                      <span>Ver detalle</span>
                                    </Link>
                                  ) : null}

                                  {item.salud_global_porcentaje !== undefined && item.salud_global_porcentaje !== null && (
                                    <span
                                      className={`px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase shadow flex items-center gap-1 ${
                                        item.salud_global_porcentaje >= 80
                                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                          : item.salud_global_porcentaje >= 60
                                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                          : item.salud_global_porcentaje >= 40
                                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                          : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                      }`}
                                    >
                                      <Activity size={11} />
                                      <span>Estado General: {item.salud_global_porcentaje}%</span>
                                    </span>
                                  )}
                                  {item.es_mantenimiento_general && (
                                    <span className="px-2.5 py-0.5 rounded border border-[#bfce7f]/40 bg-[#bfce7f]/20 text-[#bfce7f] text-[10px] font-bold uppercase shadow">
                                      🛠️ Mantenimiento General
                                    </span>
                                  )}
                                  <span className={`px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase ${badgeStyle}`}>
                                    {item.tipo_servicio}
                                  </span>
                                </div>
                              </div>

                              {item.descripcion_trabajo && (
                                <p className="text-xs text-slate-300 leading-relaxed bg-[#0e1117]/60 p-3 rounded-xl border border-[#2d3748]/50">
                                  {item.descripcion_trabajo}
                                </p>
                              )}

                              {/* Single Component Badge */}
                              {item.componente_nombre && (
                                <div className="mt-2 text-xs bg-[#bfce7f]/10 border border-[#bfce7f]/30 p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-[#bfce7f]">
                                  <span>⚙️ Componente Intervenido: <strong>{item.componente_nombre}</strong></span>
                                  {item.nuevo_estado_nombre && (
                                    <span className="font-bold bg-[#bfce7f]/20 px-2 py-0.5 rounded text-[10px] border border-[#bfce7f]/40">
                                      Nuevo Estado: {item.nuevo_estado_nombre.toUpperCase()} • {item.nuevo_estado_desgaste}% Desgaste
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Multi-Component Breakdown List (Opción 3) */}
                              {item.servicios && item.servicios.length > 0 && (
                                <div className="mt-3 space-y-2 border-t border-[#2d3748] pt-3">
                                  <span className="text-[10px] text-[#bfce7f] font-bold uppercase tracking-wider block">
                                    📋 Desglose de Tareas & Componentes Intervenidos ({item.servicios.length}):
                                  </span>
                                  <div className="space-y-1.5">
                                    {item.servicios.map((srv, idx) => (
                                      <div key={idx} className="bg-[#0e1117]/80 border border-[#2d3748] p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                                        <div>
                                          <span className="font-bold text-white">{srv.descripcion_servicio || "Servicio Técnico"}</span>
                                          {srv.componente_nombre && (
                                            <span className="text-[#bfce7f] block text-[11px] font-bold mt-0.5">
                                              ⚙️ {srv.componente_nombre}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {srv.nuevo_estado_nombre && (
                                            <span className="font-bold bg-[#bfce7f]/15 text-[#bfce7f] px-2 py-0.5 rounded text-[10px] border border-[#bfce7f]/30">
                                              {srv.nuevo_estado_nombre.toUpperCase()} • {srv.nuevo_estado_desgaste}% Desgaste
                                            </span>
                                          )}
                                          {srv.costo > 0 && (
                                            <span className="text-slate-300 text-[11px] font-bold">${srv.costo.toFixed(2)}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-[#2d3748]/40">
                                <span>👨‍🔧 Mecánico: <strong className="text-slate-200">{item.mecanico_responsable}</strong></span>
                                {item.costo_total > 0 && (
                                  <span className="text-[#bfce7f] font-bold">Costo: ${Number(item.costo_total).toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>



        </div>,
        document.body
      )}

      {/* BikeFormDrawer Panel */}
      <BikeFormDrawer
        isOpen={isDrawerOpen}
        editingItem={editingItem}
        clientes={clientes}
        preselectedClienteId={null}
        lockCliente={false}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingItem(null);
        }}
        onSuccess={async () => {
          setIsDrawerOpen(false);
          setEditingItem(null);
          fetchData();
        }}
        showToast={showToast}
      />

      {/* Confirm Delete Modal */}
      {mounted && isDeletingModalOpen && itemToDelete && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
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
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            className="font-mono text-xs animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} className="shrink-0" />
              <h3 className="text-base font-bold text-white">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ¿Está seguro de que desea eliminar la bicicleta{" "}
              <strong className="text-white font-bold">{itemToDelete.marca} {itemToDelete.modelo}</strong>? Esta acción actualizará la base de datos.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeletingModalOpen(false)}
                className="px-4 py-2.5 bg-[#2d3748] hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Eliminar Bicicleta
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Save Confirmation Modal */}
      {mounted && isSaveConfirmOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div 
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }} 
            onClick={() => !isSaving && setIsSaveConfirmOpen(false)}
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
              zIndex: 1000006,
              margin: 'auto'
            }}
            className="font-sans"
          >
            <div className="w-14 h-14 rounded-full bg-[#bfce7f]/10 border border-[#bfce7f]/30 text-[#bfce7f] flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Confirmar actualización</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              ¿Está seguro de que desea guardar los cambios realizados en esta bicicleta?
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                disabled={isSaving}
                onClick={() => setIsSaveConfirmOpen(false)}
                className="flex-1 py-2.5 bg-[#212631] text-white text-xs font-bold rounded-xl border border-[#2d3748] hover:bg-[#2d3748] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={isSaving}
                onClick={executeDetailSave}
                className="flex-1 py-2.5 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={14} /> : null}
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Standard Toast Notification */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className={`fixed bottom-5 right-5 z-[1000010] bg-[#161a21] border ${
          toastMessage.type === "error" ? "border-rose-500/80 text-rose-300" : "border-[#bfce7f] text-white"
        } px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-xs animate-in slide-in-from-bottom-5 duration-200`}>
          {toastMessage.type === "error" ? (
            <XCircle size={18} className="text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-[#bfce7f] shrink-0" />
          )}
          <span>{typeof toastMessage === "string" ? toastMessage : toastMessage.text}</span>
        </div>,
        document.body
      )}

    </div>
  );
}
