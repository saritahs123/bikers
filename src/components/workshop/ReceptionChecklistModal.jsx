"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, Upload, AlertCircle, Image as ImageIcon, Camera, Trash2 } from "lucide-react";

export default function ReceptionChecklistModal({
  isOpen,
  onClose,
  itemsCatalog = [],
  estadosCatalog = [],
  checklistState = [],
  onChangeChecklist
}) {
  const [activeCategory, setActiveCategory] = useState("TODOS");
  const [uploadingItem, setUploadingItem] = useState(null);

  if (!isOpen) return null;

  const categories = ["TODOS", ...Array.from(new Set(itemsCatalog.map(i => i.categoria).filter(Boolean)))];

  const filteredItems = activeCategory === "TODOS"
    ? itemsCatalog
    : itemsCatalog.filter(i => i.categoria === activeCategory);

  const getItemEvaluated = (itemId) => {
    return checklistState.find(c => c.item_checklist_id === itemId) || {
      item_checklist_id: itemId,
      estado_checklist_id: estadosCatalog[0]?.estado_checklist_id || 1,
      observacion: "",
      requiere_trabajo: false,
      upload_token: null,
      preview_url: null,
      filename: null
    };
  };

  const updateItem = (itemId, updates) => {
    const current = getItemEvaluated(itemId);
    const updated = { ...current, ...updates };
    const newList = checklistState.filter(c => c.item_checklist_id !== itemId);
    newList.push(updated);
    onChangeChecklist(newList);
  };

  const handleFileUpload = async (itemId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Solo se permiten imágenes en formato JPG, PNG o WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen excede el límite máximo de 5 MB.");
      return;
    }

    setUploadingItem(itemId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/taller/evidencias", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Error al subir evidencia.");
      }

      updateItem(itemId, {
        upload_token: data.upload_token,
        preview_url: URL.createObjectURL(file),
        filename: file.name
      });

    } catch (err) {
      alert(err.message || "No se pudo subir la imagen de evidencia.");
    } finally {
      setUploadingItem(null);
    }
  };

  const removePhoto = (itemId) => {
    updateItem(itemId, {
      upload_token: null,
      preview_url: null,
      filename: null
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4">
      <div className="relative w-full max-w-4xl bg-[#0f172a] border-2 border-emerald-500/40 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh] z-[10000] text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#162032]">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">Checklist de Inspección de Recepción</h3>
            <p className="text-xs text-slate-300 mt-0.5">Evalúe el estado inicial de componentes y adjunte fotos de evidencia previa.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800 bg-[#0f172a] overflow-x-auto custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Checklist Grid Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-[#0f172a] custom-scrollbar">
          <div className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => {
              const evalState = getItemEvaluated(item.item_checklist_id);
              return (
                <div
                  key={item.item_checklist_id}
                  className="p-4 bg-[#162032] border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wide">{item.nombre}</span>
                      <span className="ml-2 text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono uppercase">
                        {item.categoria}
                      </span>
                      {item.descripcion && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.descripcion}</p>
                      )}
                    </div>

                    {/* Status Selector Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {estadosCatalog.map((est) => {
                        const isSelected = String(evalState.estado_checklist_id) === String(est.estado_checklist_id);
                        const code = (est.codigo || est.nombre || "").toUpperCase();

                        let colorClass = "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-900/60";
                        if (isSelected) {
                          if (code.includes("BUENO") || code.includes("NORMAL") || code.includes("EXCELENTE")) {
                            colorClass = "bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.5)]";
                          } else if (code.includes("REGULAR") || code.includes("DESGASTE")) {
                            colorClass = "bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.5)]";
                          } else if (code.includes("DANADO") || code.includes("DAÑADO") || code.includes("DEFECTUOSO") || code.includes("MALO")) {
                            colorClass = "bg-rose-500 text-white border-rose-400 font-extrabold shadow-[0_0_12px_rgba(244,63,94,0.5)]";
                          } else {
                            colorClass = "bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.5)]";
                          }
                        }

                        return (
                          <button
                            key={est.estado_checklist_id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateItem(item.item_checklist_id, { estado_checklist_id: est.estado_checklist_id });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer uppercase font-semibold ${colorClass}`}
                          >
                            {est.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observation & Require Repair Checkbox */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <input
                      type="text"
                      placeholder="Observación o daño detectado (opcional)..."
                      value={evalState.observacion || ""}
                      onChange={(e) => updateItem(item.item_checklist_id, { observacion: e.target.value })}
                      className="flex-1 min-w-[220px] bg-[#090d16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={evalState.requiere_trabajo || false}
                        onChange={(e) => updateItem(item.item_checklist_id, { requiere_trabajo: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-950 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300">Requiere Trabajo</span>
                    </label>

                    {/* Photo Evidence Uploader */}
                    {item.requiere_foto && (
                      <div className="flex items-center gap-2">
                        {evalState.preview_url ? (
                          <div className="flex items-center gap-2 bg-slate-950 p-1 pl-2.5 rounded-lg border border-slate-800">
                            <span className="text-[11px] text-emerald-400 truncate max-w-[120px]">{evalState.filename}</span>
                            <button
                              type="button"
                              onClick={() => removePhoto(item.item_checklist_id)}
                              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs cursor-pointer border border-slate-700 transition-colors">
                            <Camera className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{uploadingItem === item.item_checklist_id ? "Subiendo..." : "Foto Evidence"}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => handleFileUpload(item.item_checklist_id, e)}
                              className="hidden"
                              disabled={uploadingItem === item.item_checklist_id}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#162032]">
          <span className="text-xs text-slate-400">
            Ítems evaluados: <strong className="text-emerald-400">{checklistState.length}</strong> de {itemsCatalog.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-sm cursor-pointer uppercase"
          >
            <Check className="w-4 h-4" />
            Guardar Evaluación
          </button>
        </div>
      </div>
    </div>
  );
}
