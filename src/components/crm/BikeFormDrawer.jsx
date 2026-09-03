"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bike,
  User,
  Shield,
  Paperclip,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
  Layers,
  Camera,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { validateRequiredText } from "@/lib/validations";
import { normalizeBicycleComponentPayload } from "@/lib/bicycleComponentUtils";
import BicycleComponentsEditor from "./BicycleComponentsEditor";
import BicyclePhotosEditor from "./BicyclePhotosEditor";

export default function BikeFormDrawer({
  isOpen = false,
  presentation = "drawer",
  editingItem = null,
  clientes = [],
  preselectedClienteId = null,
  preselectedClienteName = "",
  lockCliente = false,
  onClose,
  onSuccess,
  showToast
}) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const isModal = presentation === "modal";

  const [formData, setFormData] = useState({
    cliente_id: "",
    marca: "",
    modelo: "",
    tipo_bicicleta: "MTB",
    ano: new Date().getFullYear(),
    color: "",
    talla: "M",
    numero_serie_cuadro: "",
    kilometraje_actual: 0,
    descripcion: "",
    notas_tecnicas: ""
  });

  // Draft lists for creation mode
  const [draftComponents, setDraftComponents] = useState([]);
  const [draftPhotos, setDraftPhotos] = useState([]);

  // Auxiliary catalogs
  const [categoriesList, setCategoriesList] = useState([]);
  const [statesList, setStatesList] = useState([]);

  // State management for save execution & partial failures
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [savePhaseText, setSavePhaseText] = useState("");
  const [createdBikeId, setCreatedBikeId] = useState(null);
  const [partialFailureInfo, setPartialFailureInfo] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch categories and states when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchAuxiliaryCatalogs();
    }
  }, [isOpen]);

  const fetchAuxiliaryCatalogs = async () => {
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
      console.error("Error fetching auxiliary catalogs for drawer:", err);
    }
  };

  // Helper to revoke draft photo Blob URLs
  const cleanupDraftPhotoUrls = (photoArray) => {
    if (!Array.isArray(photoArray)) return;
    photoArray.forEach((p) => {
      if (p.previewUrl && p.previewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch (e) {
          // ignore
        }
      }
    });
  };

  // Reset or Sync drawer state on open/editingItem change
  useEffect(() => {
    if (isOpen) {
      setActiveTab("general");
      setErrors({});
      setPartialFailureInfo(null);
      setIsSaving(false);
      setSavePhaseText("");
      setCreatedBikeId(null);

      if (editingItem) {
        setFormData({
          cliente_id: editingItem.cliente_id ? String(editingItem.cliente_id) : "",
          marca: editingItem.marca || "",
          modelo: editingItem.modelo || "",
          tipo_bicicleta: editingItem.tipo_bicicleta || "MTB",
          ano: editingItem.ano || new Date().getFullYear(),
          color: editingItem.color || "",
          talla: editingItem.talla || "M",
          numero_serie_cuadro: editingItem.numero_serie_cuadro || "",
          kilometraje_actual: editingItem.kilometraje_actual || 0,
          descripcion: editingItem.descripcion || "",
          notas_tecnicas: editingItem.notas_tecnicas || ""
        });
        setDraftComponents([]);
        setDraftPhotos([]);
      } else {
        const defaultClient = preselectedClienteId ? String(preselectedClienteId) : "";

        setFormData({
          cliente_id: defaultClient,
          marca: "",
          modelo: "",
          tipo_bicicleta: "MTB",
          ano: new Date().getFullYear(),
          color: "",
          talla: "M",
          numero_serie_cuadro: "",
          kilometraje_actual: 0,
          descripcion: "",
          notas_tecnicas: ""
        });
        setDraftComponents([]);
        setDraftPhotos([]);
      }
    }
  }, [isOpen, editingItem, preselectedClienteId, clientes]);

  if (!isOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  const validateAllTabs = () => {
    const errs = {};

    // 1. General Info Validation
    const targetClienteId = lockCliente ? preselectedClienteId : formData.cliente_id;
    if (!targetClienteId) {
      errs.cliente_id = "Debe seleccionar un cliente propietario.";
    }

    const marcaRes = validateRequiredText(formData.marca, "La Marca", 100);
    if (!marcaRes.isValid) errs.marca = marcaRes.message;

    const modeloRes = validateRequiredText(formData.modelo, "El Modelo", 100);
    if (!modeloRes.isValid) errs.modelo = modeloRes.message;

    if (Object.keys(errs).length > 0) {
      setActiveTab("general");
      setErrors(errs);
      const firstErr = Object.values(errs)[0];
      if (showToast) showToast(firstErr, "error");
      return false;
    }

    // 2. Draft Components Validation
    for (let i = 0; i < draftComponents.length; i++) {
      const comp = draftComponents[i];
      if (!comp.categoria_componente_id) {
        setActiveTab("componentes");
        const msg = `El componente #${i + 1} requiere una categoría válida.`;
        if (showToast) showToast(msg, "error");
        return false;
      }
      if (!comp.estado_componente_id) {
        setActiveTab("componentes");
        const msg = `El componente #${i + 1} requiere que selecciones su estado.`;
        if (showToast) showToast(msg, "error");
        return false;
      }
    }

    // 3. Draft Photos Validation
    for (let i = 0; i < draftPhotos.length; i++) {
      const photo = draftPhotos[i];
      if (photo.file) {
        const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedMimes.includes(photo.file.type)) {
          setActiveTab("fotos");
          const msg = `La fotografía "${photo.nombre_archivo}" debe ser formato JPG, PNG o WEBP.`;
          if (showToast) showToast(msg, "error");
          return false;
        }
        if (photo.file.size > 10 * 1024 * 1024) {
          setActiveTab("fotos");
          const msg = `La fotografía "${photo.nombre_archivo}" supera los 10 MB.`;
          if (showToast) showToast(msg, "error");
          return false;
        }
      }
    }

    setErrors({});
    return true;
  };

  const handleSaveFlow = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSaving) return;

    setPartialFailureInfo(null);

    // Validation
    if (!validateAllTabs()) {
      return;
    }

    setIsSaving(true);
    let targetBikeId = createdBikeId || editingItem?.id || editingItem?.bicicleta_id;

    try {
      // -------------------------------------------------------------
      // PHASE 1: Create or Update Base Bicycle Record
      // -------------------------------------------------------------
      if (!targetBikeId) {
        setSavePhaseText("GUARDANDO BICICLETA...");
        const targetClienteId = lockCliente ? preselectedClienteId : formData.cliente_id;
        const payload = {
          ...formData,
          cliente_id: targetClienteId ? (isNaN(Number(targetClienteId)) ? targetClienteId : Number(targetClienteId)) : null,
          ano: Number(formData.ano) || new Date().getFullYear(),
          kilometraje_actual: Number(formData.kilometraje_actual) || 0
        };

        const res = await fetch("/api/crm/bicicletas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json) {
          const msg = json?.error || json?.message || `Error al crear bicicleta (${res.status})`;
          throw new Error(msg);
        }

        const savedBike = json?.data || json;
        targetBikeId = savedBike.id || savedBike.bicicleta_id;
        if (!targetBikeId) {
          throw new Error("El servidor no retornó un ID válido de bicicleta.");
        }
        setCreatedBikeId(targetBikeId);
      } else if (editingItem) {
        setSavePhaseText("ACTUALIZANDO DATOS DE BICICLETA...");
        const targetClienteId = lockCliente ? preselectedClienteId : formData.cliente_id;
        const payload = {
          ...formData,
          cliente_id: targetClienteId ? (isNaN(Number(targetClienteId)) ? targetClienteId : Number(targetClienteId)) : null,
          ano: Number(formData.ano) || new Date().getFullYear(),
          kilometraje_actual: Number(formData.kilometraje_actual) || 0
        };

        const res = await fetch(`/api/crm/bicicletas/${targetBikeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || json?.message || "Error al actualizar bicicleta.");
        }
      }

      // -------------------------------------------------------------
      // PHASE 2: Persist Draft Components
      // -------------------------------------------------------------
      let componentErrorsCount = 0;
      const unpersistedComponents = draftComponents.filter((c) => !c.persisted && c.status !== "saved");

      if (unpersistedComponents.length > 0) {
        setSavePhaseText(`REGISTRANDO COMPONENTES (0/${unpersistedComponents.length})...`);
        // Pre-fetch existing components in DB to avoid duplicate insertion if frontend missed previous response
        let existingDbComponents = [];
        try {
          const checkRes = await fetch(`/api/crm/bicicletas/${targetBikeId}/components`);
          if (checkRes.ok) {
            existingDbComponents = await checkRes.json();
          }
        } catch (eCheck) {
          console.warn("Could not pre-fetch bike components:", eCheck);
        }

        const updatedComponents = [...draftComponents];

        for (let i = 0; i < updatedComponents.length; i++) {
          const comp = updatedComponents[i];
          if (comp.persisted || comp.status === "saved" || comp.persistedId) continue;

          // Check if natural key match exists in DB
          const naturalMatch = existingDbComponents.find((dbC) => {
            const sameCat = Number(dbC.categoria_componente_id) === Number(comp.categoria_componente_id);
            const sameSerial = comp.numero_serie && dbC.numero_serie && dbC.numero_serie.trim().toLowerCase() === comp.numero_serie.trim().toLowerCase();
            const sameModel = comp.modelo && dbC.modelo && dbC.modelo.trim().toLowerCase() === comp.modelo.trim().toLowerCase();
            return sameCat && (sameSerial || sameModel);
          });

          if (naturalMatch) {
            updatedComponents[i] = {
              ...comp,
              persistedId: naturalMatch.id || naturalMatch.bicicleta_componente_id,
              persisted: true,
              status: "saved",
              errorMessage: null
            };
            continue;
          }

          try {
            updatedComponents[i] = { ...comp, status: "saving", errorMessage: null };
            setDraftComponents([...updatedComponents]);

            const payload = normalizeBicycleComponentPayload(comp);

            const compRes = await fetch(`/api/crm/bicicletas/${targetBikeId}/components`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            const compJson = await compRes.json().catch(() => null);

            if (compRes.ok && compJson && compJson.success !== false) {
              const compData = compJson.data || compJson;
              const realId = compData.id || compData.bicicleta_componente_id;
              updatedComponents[i] = {
                ...comp,
                id: realId || comp.id,
                persistedId: realId,
                persisted: true,
                status: "saved",
                errorMessage: null
              };
            } else {
              const errMsg = compJson?.message || compJson?.error || `Error ${compRes.status} al guardar componente.`;
              updatedComponents[i] = {
                ...comp,
                status: "error",
                errorMessage: errMsg
              };
              componentErrorsCount++;
            }
          } catch (errComp) {
            console.error("Error persisting draft component:", errComp);
            updatedComponents[i] = {
              ...comp,
              status: "error",
              errorMessage: "No pudimos guardar este componente. Inténtalo nuevamente."
            };
            componentErrorsCount++;
          }

          setSavePhaseText(`REGISTRANDO COMPONENTES (${i + 1}/${updatedComponents.length})...`);
        }

        setDraftComponents(updatedComponents);
      }

      // -------------------------------------------------------------
      // PHASE 3: Persist Draft Photos (S3 Upload + API)
      // -------------------------------------------------------------
      let photoErrorsCount = 0;
      const unpersistedPhotos = draftPhotos.filter((p) => !p.persisted && p.status !== "saved");

      if (unpersistedPhotos.length > 0) {
        setSavePhaseText(`SUBIENDO FOTOGRAFÍAS (0/${unpersistedPhotos.length})...`);
        const updatedPhotos = [...draftPhotos];

        for (let i = 0; i < updatedPhotos.length; i++) {
          const photo = updatedPhotos[i];
          if (photo.persisted || photo.status === "saved") continue;

          try {
            let objectKey = null;
            let uploadToken = null;

            if (photo.file) {
              // 1. Presign Upload URL
              const presignRes = await fetch("/api/storage/presign-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileName: photo.nombre_archivo || photo.file.name,
                  contentType: photo.file.type || "image/jpeg",
                  size: photo.file.size,
                  module: "crm",
                  entityType: "bicicletas",
                  entityId: targetBikeId
                })
              });

              const presignData = await presignRes.json();
              if (!presignRes.ok) {
                throw new Error(presignData.message || presignData.error || "Presign failed.");
              }

              // 2. Direct S3 PUT
              const s3PutRes = await fetch(presignData.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": photo.file.type || "image/jpeg" },
                body: photo.file
              });

              if (!s3PutRes.ok) {
                throw new Error("S3 PUT upload failed.");
              }

              objectKey = presignData.objectKey;
              uploadToken = presignData.uploadToken;
            }

            // 3. Save Metadata in DB
            const photoRes = await fetch(`/api/crm/bicicletas/${targetBikeId}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                objectKey,
                uploadToken,
                url_archivo: null,
                nombre_archivo: photo.nombre_archivo || "foto.png",
                tipo_foto: photo.tipo_foto || "GENERAL",
                descripcion: photo.descripcion || photo.nombre_archivo || "Fotografía de Activo",
                bicicleta_componente_id: photo.bicicleta_componente_id || null,
                es_principal: Boolean(photo.es_principal)
              })
            });

            if (photoRes.ok) {
              const photoJson = await photoRes.json();
              updatedPhotos[i] = {
                ...photo,
                id: photoJson.id || photoJson.bicicleta_foto_id || photo.id,
                status: "saved",
                persisted: true
              };
            } else {
              photoErrorsCount++;
            }
          } catch (errPhoto) {
            console.error("Error persisting draft photo:", errPhoto);
            photoErrorsCount++;
          }

          setSavePhaseText(`SUBIENDO FOTOGRAFÍAS (${i + 1}/${updatedPhotos.length})...`);
        }

        setDraftPhotos(updatedPhotos);
      }

      // -------------------------------------------------------------
      // PHASE 4: Evaluate Outcome & Handle Success vs Partial Failure
      // -------------------------------------------------------------
      if (componentErrorsCount > 0 || photoErrorsCount > 0) {
        let title = "Bicicleta creada con registros pendientes";
        let message = "La bicicleta fue registrada, pero no pudimos guardar todos sus registros.";
        if (componentErrorsCount > 0 && photoErrorsCount === 0) {
          message = "La bicicleta fue registrada, pero no pudimos guardar todos sus componentes. Puedes reintentar sin crearla nuevamente.";
        } else if (photoErrorsCount > 0 && componentErrorsCount === 0) {
          message = "La bicicleta fue registrada, pero algunas fotografías no pudieron cargarse. Reintenta las fotografías pendientes.";
        }

        setPartialFailureInfo({ title, message, componentErrorsCount, photoErrorsCount });
        if (showToast) showToast(message, "error");
        return;
      }

      // FULL SUCCESS
      cleanupDraftPhotoUrls(draftPhotos);
      const successMsg = editingItem ? "Bicicleta actualizada correctamente." : "Bicicleta registrada correctamente.";
      if (showToast) showToast(successMsg, "success");

      if (onSuccess) {
        onSuccess(targetBikeId);
      }
      if (onClose) {
        onClose();
      }
    } catch (errMain) {
      console.error("Error in handleSaveFlow:", errMain);
      const msg = errMain.message || "Error al procesar la solicitud.";
      if (showToast) showToast(msg, "error");
    } finally {
      setIsSaving(false);
      setSavePhaseText("");
    }
  };

  const handleCloseDrawer = () => {
    if (isSaving) return;
    cleanupDraftPhotoUrls(draftPhotos);
    if (onClose) onClose();
  };

  const matchedClient = clientes.find(
    (c) => String(c.id || c.cliente_id) === String(formData.cliente_id || preselectedClienteId)
  );
  const clientDisplayName = preselectedClienteName || matchedClient?.nombre_completo || (matchedClient ? `${matchedClient.nombre || ""} ${matchedClient.apellido || ""}`.trim() : `Cliente #${preselectedClienteId || formData.cliente_id}`);

  const formInner = (
    <>
      {/* Drawer / Modal Header */}
      <div className="p-5 border-b border-[#2d3748] bg-[#0e1117] flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#bfce7f]/10 border border-[#bfce7f]/30 flex items-center justify-center text-[#bfce7f] shrink-0">
              <Bike size={20} />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white">
                {editingItem ? "Editar Bicicleta" : "Registrar Nueva Bicicleta"}
              </h2>
              <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                {editingItem ? "Modifique los datos técnicos del activo" : "Complete los datos técnicos, componentes y fotografías de la bicicleta"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#212631] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-5 border-b border-[#2d3748] bg-[#161a21] flex items-center gap-6 overflow-x-auto shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "general"
                ? "border-[#bfce7f] text-[#bfce7f]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Bike size={16} />
            <span>Información General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("componentes")}
            className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "componentes"
                ? "border-[#bfce7f] text-[#bfce7f]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Layers size={16} />
            <span>Componentes & Desgaste</span>
            <span className="px-2 py-0.5 rounded-full bg-[#bfce7f]/20 text-[#bfce7f] text-[10px] font-bold">
              {draftComponents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fotos")}
            className={`py-3.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "fotos"
                ? "border-[#bfce7f] text-[#bfce7f]"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Camera size={16} />
            <span>Fotografías del Activo</span>
            <span className="px-2 py-0.5 rounded-full bg-[#bfce7f]/20 text-[#bfce7f] text-[10px] font-bold">
              {draftPhotos.length}
            </span>
          </button>
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Partial Error Alert Banner */}
          {partialFailureInfo && (
            <div className="p-4 bg-amber-950/80 border border-amber-500/50 rounded-2xl text-amber-200 font-mono text-xs space-y-2 shadow-xl animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle size={18} />
                <span>{partialFailureInfo.title}</span>
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                {partialFailureInfo.message}
              </p>
            </div>
          )}

          {/* TAB 1: INFORMACIÓN GENERAL */}
          {activeTab === "general" && (
            <form onSubmit={handleSaveFlow} className="space-y-5">
              {/* 1. Cliente Propietario */}
              <div className="space-y-2 bg-[#0e1117]/60 border border-[#2d3748] rounded-2xl p-5">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-2">
                  <User size={14} /> 1. Cliente Propietario <span className="text-rose-400">*</span>
                </h3>

                {lockCliente || preselectedClienteId ? (
                  <div className="w-full bg-[#0e1117] border border-[#bfce7f]/40 rounded-xl px-3.5 py-2.5 text-white font-bold flex items-center justify-between mt-2">
                    <span className="flex items-center gap-2">
                      <User size={14} className="text-[#bfce7f]" />
                      {clientDisplayName}
                    </span>
                    <span className="text-[9px] bg-[#bfce7f]/20 text-[#bfce7f] border border-[#bfce7f]/40 px-2 py-0.5 rounded font-mono font-bold uppercase">
                      BLOQUEADO
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-300 mb-1">Seleccionar Cliente <span className="text-rose-400">*</span></label>
                    <select
                      data-invalid={errors.cliente_id ? "true" : undefined}
                      value={formData.cliente_id}
                      onChange={(e) => {
                        setFormData({ ...formData, cliente_id: e.target.value });
                        if (errors.cliente_id) setErrors((prev) => ({ ...prev, cliente_id: null }));
                      }}
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2.5 text-white focus:outline-none ${
                        errors.cliente_id ? "border-rose-500" : "border-[#2d3748] focus:border-[#bfce7f]"
                      }`}
                    >
                      <option value="">-- Seleccionar Propietario --</option>
                      {clientes.map((c) => (
                        <option key={c.id || c.cliente_id} value={c.id || c.cliente_id}>
                          {c.nombre_completo || `${c.nombre || ""} ${c.apellido || ""}`} ({c.correo || c.telefono_principal || `ID: ${c.id || c.cliente_id}`})
                        </option>
                      ))}
                    </select>
                    {errors.cliente_id && <p className="text-rose-400 text-[10px] mt-1">{errors.cliente_id}</p>}
                  </div>
                )}
              </div>

              {/* 2. Especificaciones de la Bicicleta */}
              <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-2xl p-5">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-2">
                  <Bike size={14} /> 2. Especificaciones Técnicas
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
                        if (errors.marca) setErrors((prev) => ({ ...prev, marca: null }));
                      }}
                      placeholder="Ej: Specialized, Trek"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2 text-white focus:outline-none ${
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
                        if (errors.modelo) setErrors((prev) => ({ ...prev, modelo: null }));
                      }}
                      placeholder="Ej: Stumpjumper, Fuel EX 8"
                      className={`w-full bg-[#0e1117] border rounded-xl px-3.5 py-2 text-white focus:outline-none ${
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
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
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
                      value={formData.ano}
                      onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                      placeholder="2026"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Color</label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Ej: Negro Mate / Rojo"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Talla Cuadro</label>
                    <input
                      type="text"
                      value={formData.talla}
                      onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                      placeholder="Ej: M, L, 54cm"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Serie & Odómetro */}
              <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-2xl p-5">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-2">
                  <Shield size={14} /> 3. Serie & Odómetro
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">N° Serie Cuadro (VIN)</label>
                    <input
                      type="text"
                      value={formData.numero_serie_cuadro}
                      onChange={(e) => setFormData({ ...formData, numero_serie_cuadro: e.target.value })}
                      placeholder="Ej: TRK-12345"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Kilometraje Actual (KM)</label>
                    <input
                      type="number"
                      value={formData.kilometraje_actual}
                      onChange={(e) => setFormData({ ...formData, kilometraje_actual: e.target.value })}
                      placeholder="0"
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Observaciones & Notas */}
              <div className="space-y-3 bg-[#0e1117]/60 border border-[#2d3748] rounded-2xl p-5">
                <h3 className="text-[#bfce7f] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-[#2d3748] pb-2">
                  <Paperclip size={14} /> 4. Observaciones & Notas
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Descripción General</label>
                    <textarea
                      rows={2}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Descripción general de la bicicleta..."
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Notas Técnicas u Observaciones</label>
                    <textarea
                      rows={2}
                      value={formData.notas_tecnicas}
                      onChange={(e) => setFormData({ ...formData, notas_tecnicas: e.target.value })}
                      placeholder="Notas de taller o accesorios especiales..."
                      className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#bfce7f]"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: COMPONENTES & DESGASTE */}
          {activeTab === "componentes" && (
            <BicycleComponentsEditor
              mode="draft"
              components={draftComponents}
              categoriesList={categoriesList}
              statesList={statesList}
              onComponentsChange={(updated) => setDraftComponents(updated)}
              showToast={showToast}
            />
          )}

          {/* TAB 3: FOTOGRAFÍAS DEL ACTIVO */}
          {activeTab === "fotos" && (
            <BicyclePhotosEditor
              mode="draft"
              photos={draftPhotos}
              componentsList={draftComponents}
              onPhotosChange={(updated) => setDraftPhotos(updated)}
              showToast={showToast}
            />
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex items-center justify-between shrink-0 font-mono">
          <div className="text-[11px] text-slate-400">
            {savePhaseText ? (
              <span className="text-[#bfce7f] font-bold flex items-center gap-2">
                <RefreshCw size={13} className="animate-spin" />
                <span>{savePhaseText}</span>
              </span>
            ) : createdBikeId ? (
              <span className="text-emerald-400 font-bold">
                ✓ Bicicleta ID #{createdBikeId} creada
              </span>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCloseDrawer}
              className="px-4 py-2 bg-[#212631] text-white border border-[#2d3748] rounded-xl hover:bg-[#2d3748] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            {partialFailureInfo ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveFlow}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={15} /> : <RotateCcw size={15} />}
                <span>Reintentar pendientes</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveFlow}
                className="px-5 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                <span>{editingItem ? "Guardar Cambios" : "Guardar Bicicleta"}</span>
              </button>
            )}
          </div>
        </div>
    </>
  );

  const drawerContent = (
    <div className={`fixed inset-0 z-[999999] overflow-hidden ${isModal ? "flex items-center justify-center p-3 sm:p-4 overflow-y-auto" : ""}`}>
      {/* Backdrop */}
      <div
        onClick={handleCloseDrawer}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {isModal ? (
        <div
          className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans my-auto animate-in fade-in zoom-in-95 duration-200 z-[1000000]"
        >
          {formInner}
        </div>
      ) : (
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div
            style={{
              position: 'relative',
              width: '900px',
              maxWidth: '95vw',
              height: '100vh',
              backgroundColor: '#161a21',
              borderLeft: '1px solid #2d3748',
              boxShadow: '-10px 0 35px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1000000
            }}
            className="font-mono text-xs"
          >
            {formInner}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(drawerContent, document.body);
}
