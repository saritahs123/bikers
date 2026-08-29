"use client";
import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, Camera, Trash2, Loader2, Sparkles } from "lucide-react";

export default function ReceptionChecklistModal({
  isOpen,
  onClose,
  itemsCatalog = [],
  estadosCatalog = [],
  initialState = [],
  checklistState = [],
  value = [],
  onChange,
  onChangeChecklist,
  onSave,
  onPhotoReplaced,
  recepcionId = null,
  recepcion_id = null
}) {
  const currentRecepcionId = recepcionId || recepcion_id || null;

  // Resolve initial checklist array from props
  const incomingItems = value.length > 0 ? value : (checklistState.length > 0 ? checklistState : initialState);

  const [localItems, setLocalItems] = useState(incomingItems);
  const [activeCategory, setActiveCategory] = useState("CUADRO");
  const [uploadingItem, setUploadingItem] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Sync local items when modal opens or incomingItems change
  useEffect(() => {
    if (isOpen) {
      setLocalItems(incomingItems);
      setActiveCategory("CUADRO");
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Category ordering & formatting
  const CATEGORY_ORDER = [
    "CUADRO",
    "SUSPENSION",
    "SEGURIDAD",
    "TRANSMISION",
    "RUEDAS",
    "COCKPIT",
    "GENERAL"
  ];

  const getCategoryLabel = (cat) => {
    if (cat === "SUSPENSION") return "SUSPENSIÓN";
    if (cat === "TRANSMISION") return "TRANSMISIÓN";
    return cat;
  };

  const rawCategories = Array.from(new Set(itemsCatalog.map(i => i.categoria).filter(Boolean)));
  const categories = CATEGORY_ORDER.filter(cat => rawCategories.includes(cat)).concat(
    rawCategories.filter(cat => !CATEGORY_ORDER.includes(cat))
  );

  const filteredItems = itemsCatalog.filter(i => i.categoria === activeCategory);

  const getItemEvaluated = (itemId) => {
    return localItems.find(c => Number(c.item_checklist_id) === Number(itemId)) || {
      item_checklist_id: itemId,
      estado_checklist_id: null,
      observacion: "",
      requiere_trabajo: false,
      object_key: null,
      upload_token: null,
      preview_url: null,
      filename: null
    };
  };

  const updateItem = (itemId, updates) => {
    setValidationError(null);
    const existingIndex = localItems.findIndex(c => Number(c.item_checklist_id) === Number(itemId));
    let nextList;
    if (existingIndex >= 0) {
      nextList = [...localItems];
      nextList[existingIndex] = { ...nextList[existingIndex], ...updates };
    } else {
      const newItem = {
        item_checklist_id: itemId,
        estado_checklist_id: null,
        observacion: "",
        requiere_trabajo: false,
        object_key: null,
        upload_token: null,
        preview_url: null,
        filename: null,
        ...updates
      };
      nextList = [...localItems, newItem];
    }

    setLocalItems(nextList);

    if (typeof onChange === "function") {
      onChange(nextList);
    }
    if (typeof onChangeChecklist === "function") {
      onChangeChecklist(nextList);
    }
  };

  const handleFileUpload = async (itemId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setValidationError("Solo se permiten imágenes en formato JPG, PNG o WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError("La imagen excede el límite máximo de 5 MB.");
      return;
    }

    const currentEvaluated = getItemEvaluated(itemId);
    const oldObjectKey = currentEvaluated.object_key || currentEvaluated.s3_key;
    const oldUploadToken = currentEvaluated.upload_token;

    setUploadingItem(itemId);
    setValidationError(null);

    try {
      // 1. Obtain presigned upload URL from S3 API
      const presignRes = await fetch("/api/storage/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          size: file.size,
          module: "taller",
          entityType: "evidencias",
          entityId: currentRecepcionId ? currentRecepcionId : null
        })
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.message || presignData.error || "Error al solicitar URL de carga S3.");
      }

      // 2. Upload file directly to S3 via PUT
      const s3Res = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file
      });

      if (!s3Res.ok) {
        throw new Error("No se pudo transferir la evidencia al almacenamiento S3.");
      }

      // If there was an old key that got replaced, notify parent for cleanup queueing
      if (oldObjectKey && typeof onPhotoReplaced === "function") {
        onPhotoReplaced(oldObjectKey, oldUploadToken);
      }

      updateItem(itemId, {
        object_key: presignData.objectKey,
        upload_token: presignData.uploadToken,
        preview_url: URL.createObjectURL(file),
        filename: file.name
      });

    } catch (err) {
      console.error("Error al cargar evidencia S3:", err?.message || err);
      setValidationError(err.message || "No se pudo subir la imagen de evidencia a S3.");
    } finally {
      setUploadingItem(null);
    }
  };

  const removePhoto = (itemId) => {
    const currentEvaluated = getItemEvaluated(itemId);
    const oldObjectKey = currentEvaluated.object_key || currentEvaluated.s3_key;
    if (oldObjectKey && typeof onPhotoReplaced === "function") {
      onPhotoReplaced(oldObjectKey);
    }

    updateItem(itemId, {
      object_key: null,
      upload_token: null,
      preview_url: null,
      filename: null
    });
  };

  const handleSaveEvaluation = () => {
    setValidationError(null);
    const unassignedItem = itemsCatalog.find(item => {
      const state = localItems.find(c => Number(c.item_checklist_id) === Number(item.item_checklist_id));
      return !state || state.estado_checklist_id === null || state.estado_checklist_id === undefined;
    });

    if (unassignedItem) {
      if (unassignedItem.categoria) {
        setActiveCategory(unassignedItem.categoria);
      }
      setValidationError("Debes seleccionar el estado de todos los componentes antes de guardar la evaluación.");
      return;
    }

    if (typeof onSave === "function") {
      onSave(localItems);
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const evaluatedCount = localItems.filter(
    c => c.estado_checklist_id !== null && c.estado_checklist_id !== undefined
  ).length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-card border border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] z-[10000] text-foreground font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
              Checklist de Inspección de Recepción
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5 font-mono">
              Evalúe el estado inicial de componentes y adjunte fotos de evidencia previa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground p-1.5 rounded-lg hover:bg-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Alert */}
        {validationError && (
          <div className="px-5 py-2.5 bg-error-muted border-b border-error/20 flex items-center gap-2 text-xs text-error font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Category Tabs (Responsive Scroll) */}
        <div className="flex gap-1.5 px-5 py-2.5 bg-surface border-b border-border overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const itemsInCat = itemsCatalog.filter(i => i.categoria === cat);
            const evaluatedInCat = itemsInCat.filter(i => {
              const itemState = localItems.find(c => Number(c.item_checklist_id) === Number(i.item_checklist_id));
              return itemState && itemState.estado_checklist_id !== null && itemState.estado_checklist_id !== undefined;
            }).length;
            const isCatComplete = itemsInCat.length > 0 && evaluatedInCat === itemsInCat.length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setValidationError(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary-muted text-primary border border-primary/30"
                    : "text-foreground-muted hover:text-foreground hover:bg-hover border border-transparent"
                }`}
              >
                <span>{getCategoryLabel(cat)}</span>
                {isCatComplete ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <span className="text-[10px] text-foreground-muted">
                    ({evaluatedInCat}/{itemsInCat.length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Items List (Responsive Stacked Cards on mobile & tablet) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar font-mono text-xs">
          {filteredItems.map((item) => {
            const evaluated = getItemEvaluated(item.item_checklist_id);
            const isItemUploading = uploadingItem === item.item_checklist_id;

            return (
              <div
                key={item.item_checklist_id}
                className="p-3.5 bg-surface border border-border rounded-xl space-y-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-foreground text-xs">{item.nombre}</span>
                    {item.descripcion && (
                      <p className="text-[11px] text-foreground-muted mt-0.5">{item.descripcion}</p>
                    )}
                  </div>
                  {evaluated.estado_checklist_id && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-muted text-primary">
                      Evaluado ✓
                    </span>
                  )}
                </div>

                {/* State Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {estadosCatalog.map((est) => {
                    const isSelected = Number(evaluated.estado_checklist_id) === Number(est.estado_checklist_id);
                    return (
                      <button
                        key={est.estado_checklist_id}
                        type="button"
                        onClick={() => updateItem(item.item_checklist_id, { estado_checklist_id: est.estado_checklist_id })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                          isSelected
                            ? "bg-primary-muted border-primary text-primary shadow-sm"
                            : "bg-card border-border text-foreground-muted hover:text-foreground hover:bg-hover"
                        }`}
                      >
                        {est.nombre}
                      </button>
                    );
                  })}
                </div>

                {/* Observations & Photo Attachment */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1">
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={evaluated.observacion || ""}
                      onChange={(e) => updateItem(item.item_checklist_id, { observacion: e.target.value })}
                      placeholder="Observaciones de inspección..."
                      className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-center justify-end gap-2">
                    {evaluated.preview_url || evaluated.filename ? (
                      <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-lg text-[11px] text-foreground-muted">
                        <Camera size={13} className="text-primary" />
                        <span className="truncate max-w-[100px]">{evaluated.filename || "Foto"}</span>
                        <button
                          type="button"
                          onClick={() => removePhoto(item.item_checklist_id)}
                          className="p-1 text-foreground-muted hover:text-error rounded"
                          title="Eliminar foto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="px-3 py-1.5 bg-card border border-border hover:bg-hover rounded-lg text-xs text-foreground-muted hover:text-foreground flex items-center gap-1.5 cursor-pointer">
                        {isItemUploading ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-primary" />
                            <span>Subiendo...</span>
                          </>
                        ) : (
                          <>
                            <Camera size={13} />
                            <span>+ Foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isItemUploading}
                          onChange={(e) => handleFileUpload(item.item_checklist_id, e)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface flex items-center justify-between shrink-0 font-mono text-xs">
          <span className="text-foreground-muted">
            Progreso total: <strong className="text-foreground">{evaluatedCount}</strong> de {itemsCatalog.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-border bg-surface text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSaveEvaluation}
              className="px-5 py-2 rounded-xl bg-primary-button-bg text-primary-foreground font-bold hover:bg-primary-button-hover transition-all cursor-pointer shadow-sm"
            >
              Guardar Evaluación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
