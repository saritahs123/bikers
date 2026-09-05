"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Edit2,
  Trash2,
  X,
  Save,
  RefreshCw,
  Star,
  Image as ImageIcon,
  Check
} from "lucide-react";

export default function BicyclePhotosEditor({
  mode = "draft", // "draft" | "persisted"
  bikeId = null,
  photos = [],
  componentsList = [],
  onPhotosChange,
  onRefresh,
  showToast,
  readOnly = false
}) {
  const fileInputRef = useRef(null);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [selectedPhotoDataUrl, setSelectedPhotoDataUrl] = useState("");
  const [newPhotoDesc, setNewPhotoDesc] = useState("");
  const [newPhotoType, setNewPhotoType] = useState("GENERAL");
  const [newPhotoComponentId, setNewPhotoComponentId] = useState("");
  const [newPhotoEsPrincipal, setNewPhotoEsPrincipal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (showToast) showToast("Por favor seleccione un archivo de imagen válido (JPG, PNG, WEBP).", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (showToast) showToast("El archivo de imagen excede el límite máximo de 10 MB.", "error");
      return;
    }

    setSelectedPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedPhotoDataUrl(previewUrl);

    if (mode === "draft") {
      // Automatic add to draft photo list on selection
      const tempId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `photo-draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const isFirst = photos.length === 0;
      const newPhotoObj = {
        id: tempId,
        tempId,
        file,
        previewUrl,
        url_archivo: previewUrl,
        nombre_archivo: file.name,
        descripcion: newPhotoDesc || file.name,
        tipo_foto: newPhotoType || "GENERAL",
        bicicleta_componente_id: newPhotoComponentId || null,
        es_principal: newPhotoEsPrincipal || isFirst,
        persisted: false
      };

      let updated = [...photos];
      if (newPhotoEsPrincipal || isFirst) {
        updated = updated.map((p) => ({ ...p, es_principal: false }));
      }
      updated.push(newPhotoObj);

      if (onPhotosChange) onPhotosChange(updated);
      if (showToast) showToast("Fotografía agregada a la vista previa.", "success");

      // Reset selection input
      setSelectedPhotoFile(null);
      setSelectedPhotoDataUrl("");
      setNewPhotoDesc("");
      setNewPhotoType("GENERAL");
      setNewPhotoComponentId("");
      setNewPhotoEsPrincipal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCancelEdit = () => {
    setEditingPhoto(null);
    setNewPhotoDesc("");
    setNewPhotoType("GENERAL");
    setNewPhotoComponentId("");
    setNewPhotoEsPrincipal(false);
    setSelectedPhotoFile(null);
    if (selectedPhotoDataUrl && mode === "persisted") {
      URL.revokeObjectURL(selectedPhotoDataUrl);
    }
    setSelectedPhotoDataUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectPhotoForEdit = (photo) => {
    setEditingPhoto(photo);
    setNewPhotoDesc(photo.descripcion || photo.nombre_archivo || "");
    setNewPhotoType(photo.tipo_foto || "GENERAL");
    setNewPhotoComponentId(photo.bicicleta_componente_id || "");
    setNewPhotoEsPrincipal(Boolean(photo.es_principal));
    setSelectedPhotoFile(null);
    if (selectedPhotoDataUrl) URL.revokeObjectURL(selectedPhotoDataUrl);
    setSelectedPhotoDataUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSavePhotoDraftOrPersisted = async () => {
    if (mode === "draft") {
      if (!editingPhoto) return;
      let updated = photos.map((p) => {
        const match = (p.tempId && p.tempId === editingPhoto.tempId) || p.id === editingPhoto.id;
        if (match) {
          return {
            ...p,
            descripcion: newPhotoDesc,
            tipo_foto: newPhotoType,
            bicicleta_componente_id: newPhotoComponentId || null,
            es_principal: newPhotoEsPrincipal
          };
        }
        return newPhotoEsPrincipal ? { ...p, es_principal: false } : p;
      });
      if (onPhotosChange) onPhotosChange(updated);
      if (showToast) showToast("Datos de la fotografía actualizados en la lista temporal.", "success");
      handleCancelEdit();
      return;
    }

    // mode === "persisted"
    if (!bikeId) return;

    if (editingPhoto) {
      setIsUploading(true);
      try {
        const res = await fetch(`/api/crm/bicicletas/${bikeId}/photos`, {
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

        if (showToast) showToast("Fotografía actualizada exitosamente.", "success");
        handleCancelEdit();
        if (onRefresh) onRefresh();
      } catch (err) {
        if (showToast) showToast(err.message, "error");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Persisted photo upload
    if (!selectedPhotoFile) {
      if (showToast) showToast("Por favor seleccione primero un archivo de imagen.", "error");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Presign
      const presignRes = await fetch("/api/storage/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedPhotoFile.name,
          contentType: selectedPhotoFile.type || "image/jpeg",
          size: selectedPhotoFile.size,
          module: "crm",
          entityType: "bicicletas",
          entityId: bikeId
        })
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.message || presignData.error || "Error en presigned URL.");
      }

      // 2. PUT S3
      const s3PutRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedPhotoFile.type || "image/jpeg" },
        body: selectedPhotoFile
      });
      if (!s3PutRes.ok) {
        throw new Error("No se pudo transferir la imagen a S3.");
      }

      // 3. Persist DB
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: presignData.objectKey,
          uploadToken: presignData.uploadToken,
          nombre_archivo: selectedPhotoFile.name,
          tipo_foto: newPhotoType,
          descripcion: newPhotoDesc || selectedPhotoFile.name,
          bicicleta_componente_id: newPhotoComponentId || null,
          es_principal: newPhotoEsPrincipal || photos.length === 0
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar fotografía.");

      if (showToast) showToast("Fotografía guardada exitosamente.", "success");
      handleCancelEdit();
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photo, e) => {
    if (e) e.stopPropagation();

    if (mode === "draft") {
      if (photo.previewUrl && photo.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      const targetKey = photo.tempId || photo.id;
      const updated = photos.filter((p) => (p.tempId || p.id) !== targetKey);
      if (onPhotosChange) onPhotosChange(updated);
      if (editingPhoto && (editingPhoto.tempId || editingPhoto.id) === targetKey) {
        handleCancelEdit();
      }
      if (showToast) showToast("Fotografía removida de la lista.", "success");
      return;
    }

    // mode === "persisted"
    if (!bikeId || !photo.id) return;
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/photos?photoId=${photo.id}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Error al eliminar la fotografía.");

      if (showToast) showToast("Fotografía eliminada exitosamente.", "success");
      if (editingPhoto && editingPhoto.id === photo.id) {
        handleCancelEdit();
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Upload/Edit Form Box */}
      {!readOnly && (
        <div
          className={`p-5 bg-card border rounded-2xl space-y-4 transition-all shadow-xl ${
            editingPhoto ? "border-primary shadow-[0_0_20px_rgba(191,206,127,0.15)]" : "border-border"
          }`}
        >
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              {editingPhoto ? (
                <>
                  <Edit2 size={16} className="text-primary" />
                  <span>EDITAR DATOS DE LA FOTOGRAFÍA SELECCIONADA</span>
                </>
              ) : (
                <>
                  <Upload size={16} className="text-primary" />
                  <span>CARGAR NUEVA FOTOGRAFÍA DE LA BICICLETA ({photos.length})</span>
                </>
              )}
            </h4>

            {editingPhoto && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 bg-surface hover:bg-surface-elevated text-foreground font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-border"
              >
                <X size={14} />
                <span>Cerrar Edición</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
              <label className="block text-foreground-muted mb-1 font-bold">
                {editingPhoto ? "Imagen Registrada" : "Seleccionar Imagen (JPG, PNG, WEBP)"}
              </label>
              {editingPhoto ? (
                <div className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground-muted text-xs truncate flex items-center gap-2">
                  <ImageIcon size={14} className="text-primary" />
                  <span className="truncate">{editingPhoto.nombre_archivo || "foto.png"}</span>
                </div>
              ) : (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground-muted text-xs focus:outline-none focus:border-primary cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                />
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-foreground-muted mb-1 font-bold">Descripción / Módulo</label>
              <input
                type="text"
                value={newPhotoDesc}
                onChange={(e) => setNewPhotoDesc(e.target.value)}
                placeholder="Ej: Vista lateral, Transmisión"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-foreground-muted mb-1 font-bold">Tipo</label>
              <select
                value={newPhotoType}
                onChange={(e) => setNewPhotoType(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-2 py-2 text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="GENERAL">GENERAL</option>
                <option value="PRINCIPAL">PRINCIPAL</option>
                <option value="COMPONENTE">COMPONENTE</option>
                <option value="DETALLE">DETALLE</option>
                <option value="DANO">DAÑO / DESGASTE</option>
                <option value="DIAGNOSTICO">DIAGNÓSTICO</option>
                <option value="ANTES">ANTES DEL SERVICIO</option>
                <option value="DESPUES">DESPUÉS DEL SERVICIO</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-foreground-muted mb-1 font-bold">Componente Vinculado</label>
              <select
                value={newPhotoComponentId}
                onChange={(e) => setNewPhotoComponentId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">-- Sin Componente Vinculado --</option>
                {componentsList.map((comp) => (
                  <option key={comp.id || comp.tempId} value={comp.id || comp.tempId}>
                    [{comp.categoria_nombre || "COMPONENTE"}] {comp.marca ? `${comp.marca} ${comp.modelo || ""}` : comp.modelo || comp.especificacion || `ID #${comp.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected File Preview Box when pending upload */}
          {selectedPhotoDataUrl && !editingPhoto && (
            <div className="flex items-center gap-3 p-3 bg-background/80 border border-primary/40 rounded-xl">
              <img
                src={selectedPhotoDataUrl}
                alt="Vista previa seleccionada"
                className="w-16 h-12 object-cover rounded-lg border border-border shadow-sm shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{selectedPhotoFile?.name}</p>
                <p className="text-[10px] text-foreground-muted">
                  {selectedPhotoFile?.size ? (selectedPhotoFile.size / (1024 * 1024)).toFixed(2) : 0} MB • Listo para subir y guardar
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPhotoFile(null);
                  if (selectedPhotoDataUrl) URL.revokeObjectURL(selectedPhotoDataUrl);
                  setSelectedPhotoDataUrl("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="p-1.5 text-foreground-muted hover:text-rose-400 transition-colors rounded-lg hover:bg-surface"
                title="Quitar archivo seleccionado"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="es_principal_chk"
                checked={newPhotoEsPrincipal}
                onChange={(e) => setNewPhotoEsPrincipal(e.target.checked)}
                className="w-4 h-4 rounded bg-background border-border text-primary focus:ring-0 cursor-pointer accent-primary"
              />
              <label htmlFor="es_principal_chk" className="font-bold text-xs select-none flex items-center gap-1.5 text-primary cursor-pointer">
                <Star size={14} className={newPhotoEsPrincipal ? "fill-primary" : ""} />
                <span>Marcar como Fotografía Principal</span>
              </label>
            </div>

            {/* Action Button: Visible for both New Upload and Edit */}
            <button
              type="button"
              disabled={isUploading || (!editingPhoto && !selectedPhotoFile)}
              onClick={handleSavePhotoDraftOrPersisted}
              className="px-5 py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 text-xs"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>{editingPhoto ? "Actualizando..." : "Subiendo imagen..."}</span>
                </>
              ) : editingPhoto ? (
                <>
                  <Save size={15} />
                  <span>Actualizar Fotografía</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>Subir Fotografía</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Photo Gallery Grid */}
      {photos.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-2xl space-y-3 shadow-xl">
          <Camera size={36} className="mx-auto text-foreground-muted opacity-50" />
          <p className="text-foreground font-bold">No hay fotografías registradas aún</p>
          <p className="text-foreground-muted text-[11px]">
            {mode === "draft"
              ? "Seleccione archivos de imagen para previsualizar y adjuntar a la nueva bicicleta."
              : "Utilice el panel superior para cargar imágenes y fotografías de la bicicleta."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => {
            const key = photo.tempId || photo.id;
            const isSelectedForEdit = editingPhoto && (editingPhoto.tempId || editingPhoto.id) === key;
            const rawSrc = photo.previewUrl || photo.url_archivo;
            const imgSrc = (rawSrc && !rawSrc.includes("default.png")) ? rawSrc : null;

            return (
              <div
                key={key}
                onClick={() => !readOnly && handleSelectPhotoForEdit(photo)}
                className={`bg-card rounded-2xl overflow-hidden shadow-lg group relative flex flex-col justify-between cursor-pointer transition-all ${
                  isSelectedForEdit
                    ? "ring-2 ring-primary border-2 border-primary bg-card/90"
                    : "border border-border hover:border-primary/60"
                }`}
              >
                <div className="aspect-video w-full relative overflow-hidden bg-black/40 flex items-center justify-center">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={photo.nombre_archivo || "Foto Bicicleta"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-background flex flex-col items-center justify-center text-foreground-muted gap-1.5 p-3 text-center font-mono">
                      <Camera size={24} className="text-foreground-muted opacity-60" />
                      <span className="text-[10px] uppercase tracking-wider">Sin imagen disponible</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    {photo.es_principal && (
                      <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold uppercase shadow flex items-center gap-1">
                        <Star size={10} className="fill-primary-foreground" /> Principal
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/20 text-white text-[9px] font-bold uppercase">
                      {photo.tipo_foto || "GENERAL"}
                    </span>
                    {photo.persisted && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/80 text-white text-[9px] font-bold uppercase">
                        GUARDADO
                      </span>
                    )}
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePhoto(photo, e)}
                      className="absolute top-2 right-2 p-1.5 bg-rose-950/80 hover:bg-rose-600 text-white rounded-lg opacity-90 group-hover:opacity-100 transition-all shadow-md cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-1 bg-card">
                  <p className="text-foreground font-bold text-xs truncate">
                    {photo.descripcion || photo.nombre_archivo || "Fotografía de Activo"}
                  </p>
                  {photo.componente_nombre && (
                    <p className="text-primary text-[10px] truncate font-bold">
                      ⚙️ {photo.componente_nombre}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
