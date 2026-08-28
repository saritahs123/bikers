"use client";

import React, { useState } from "react";
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export function getBadgeStyleForState(desgaste, codigo) {
  if (codigo === "EXCELENTE" || (desgaste !== undefined && desgaste <= 15)) {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }
  if (codigo === "BUENO" || (desgaste > 15 && desgaste <= 35)) {
    return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  }
  if (codigo === "REGULAR" || (desgaste > 35 && desgaste <= 60)) {
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  }
  return "bg-rose-500/15 text-rose-400 border-rose-500/30";
}

export default function BicycleComponentsEditor({
  mode = "draft", // "draft" | "persisted"
  bikeId = null,
  components = [],
  categoriesList = [],
  statesList = [],
  onComponentsChange,
  onRefresh,
  showToast,
  readOnly = false
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [loading, setLoading] = useState(false);

  const [componentForm, setComponentForm] = useState({
    categoria_componente_id: "",
    marca: "",
    modelo: "",
    especificacion: "",
    estado_componente_id: "",
    numero_serie: ""
  });

  const handleOpenNewForm = () => {
    setEditingComponent(null);
    setComponentForm({
      categoria_componente_id: "",
      marca: "",
      modelo: "",
      especificacion: "",
      estado_componente_id: "",
      numero_serie: ""
    });
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingComponent(null);
  };

  const handleEditClick = (comp) => {
    setEditingComponent(comp);
    setComponentForm({
      categoria_componente_id: comp.categoria_componente_id ? String(comp.categoria_componente_id) : "",
      marca: comp.marca || "",
      modelo: comp.modelo || comp.especificacion || "",
      especificacion: comp.especificacion || comp.modelo || "",
      estado_componente_id: comp.estado_componente_id ? String(comp.estado_componente_id) : "",
      numero_serie: comp.numero_serie || ""
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const selectedCat = categoriesList.find(
      (c) => String(c.id) === String(componentForm.categoria_componente_id)
    );
    const selectedState = statesList.find(
      (s) => String(s.id) === String(componentForm.estado_componente_id)
    );

    if (!componentForm.categoria_componente_id) {
      if (showToast) showToast("Debe seleccionar una categoría de componente.", "error");
      return;
    }

    if (!componentForm.estado_componente_id) {
      if (showToast) showToast("Selecciona el estado del componente.", "error");
      return;
    }

    if (mode === "draft") {
      const specText = componentForm.modelo || componentForm.marca || selectedCat?.nombre || "Especificación";

      if (editingComponent) {
        // Edit draft component
        const updated = components.map((c) => {
          if ((c.tempId && c.tempId === editingComponent.tempId) || c.id === editingComponent.id) {
            return {
              ...c,
              categoria_componente_id: componentForm.categoria_componente_id,
              categoria_nombre: selectedCat?.nombre || "Componente",
              marca: componentForm.marca,
              modelo: componentForm.modelo,
              especificacion: specText,
              estado_componente_id: componentForm.estado_componente_id,
              estado_nombre: selectedState?.nombre || "Nuevo",
              estado_codigo: selectedState?.codigo || "NUEVO",
              nivel_desgaste: selectedState?.nivel_desgaste ?? 0,
              numero_serie: componentForm.numero_serie
            };
          }
          return c;
        });
        if (onComponentsChange) onComponentsChange(updated);
        if (showToast) showToast("Componente temporal actualizado.", "success");
      } else {
        // Add new draft component
        const tempId = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const newItem = {
          id: tempId,
          tempId,
          categoria_componente_id: componentForm.categoria_componente_id,
          categoria_nombre: selectedCat?.nombre || "Componente",
          marca: componentForm.marca,
          modelo: componentForm.modelo,
          especificacion: specText,
          estado_componente_id: componentForm.estado_componente_id,
          estado_nombre: selectedState?.nombre || "Nuevo",
          estado_codigo: selectedState?.codigo || "NUEVO",
          nivel_desgaste: selectedState?.nivel_desgaste ?? 0,
          numero_serie: componentForm.numero_serie,
          persisted: false
        };
        const updated = [...components, newItem];
        if (onComponentsChange) onComponentsChange(updated);
        if (showToast) showToast("Componente agregado a la lista temporal.", "success");
      }

      setIsFormOpen(false);
      setEditingComponent(null);
      return;
    }

    // mode === "persisted"
    if (!bikeId) return;

    setLoading(true);
    try {
      const specText = componentForm.modelo || componentForm.marca || selectedCat?.nombre || "Especificación";
      const payload = {
        categoria_componente_id: componentForm.categoria_componente_id,
        marca: componentForm.marca,
        modelo: componentForm.modelo,
        especificacion: specText,
        estado_componente_id: componentForm.estado_componente_id,
        numero_serie: componentForm.numero_serie
      };

      const isEdit = Boolean(editingComponent?.id);
      const url = isEdit
        ? `/api/crm/bicicletas/${bikeId}/components?componentId=${editingComponent.id}`
        : `/api/crm/bicicletas/${bikeId}/components`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Error al guardar el componente.");

      if (showToast) {
        showToast(
          isEdit ? "Componente actualizado correctamente." : "Componente registrado exitosamente.",
          "success"
        );
      }
      setIsFormOpen(false);
      setEditingComponent(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (comp) => {
    if (mode === "draft") {
      const targetKey = comp.tempId || comp.id;
      const updated = components.filter((c) => (c.tempId || c.id) !== targetKey);
      if (onComponentsChange) onComponentsChange(updated);
      if (showToast) showToast("Componente eliminado de la lista temporal.", "success");
      return;
    }

    // mode === "persisted"
    if (!bikeId || !comp.id) return;
    try {
      const res = await fetch(`/api/crm/bicicletas/${bikeId}/components?componentId=${comp.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al eliminar el componente.");

      if (showToast) showToast("Componente eliminado correctamente.", "success");
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, "error");
    }
  };

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Header & Add Button */}
      {!readOnly && (
        <div className="flex justify-between items-center bg-[#161a21] border border-[#2d3748] rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#bfce7f]" />
            <div>
              <h4 className="font-bold text-white uppercase text-xs">
                Componentes de la Bicicleta ({components.length})
              </h4>
              <p className="text-slate-400 text-[10px]">
                {mode === "draft"
                  ? "Agregue los componentes que forman parte de este activo antes de guardar"
                  : "Registro técnico de componentes y desgaste del activo"}
              </p>
            </div>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenNewForm}
              className="px-4 py-2 bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
            >
              <Plus size={15} />
              <span>Registrar Componente</span>
            </button>
          )}
        </div>
      )}

      {/* Component Form Card */}
      {isFormOpen && !readOnly && (
        <form
          onSubmit={handleSubmit}
          className={`p-5 bg-[#161a21] border rounded-2xl space-y-4 shadow-xl animate-in fade-in duration-200 ${
            editingComponent ? "border-[#bfce7f]" : "border-[#2d3748]"
          }`}
        >
          <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
            <h4 className="font-bold text-[#bfce7f] uppercase text-xs flex items-center gap-2">
              {editingComponent ? <Edit2 size={16} /> : <Plus size={16} />}
              <span>
                {editingComponent ? "EDITAR COMPONENTE DE BICICLETA" : "REGISTRAR NUEVO COMPONENTE DE BICICLETA"}
              </span>
            </h4>
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-300 mb-1">
                Categoría <span className="text-rose-400">*</span>
              </label>
              <select
                value={componentForm.categoria_componente_id}
                onChange={(e) =>
                  setComponentForm({ ...componentForm, categoria_componente_id: e.target.value })
                }
                className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
              >
                <option value="">Selecciona una categoría...</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre} ({cat.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Marca</label>
              <input
                type="text"
                value={componentForm.marca}
                onChange={(e) => setComponentForm({ ...componentForm, marca: e.target.value })}
                placeholder="Ej: Fox, SRAM, Shimano"
                className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Modelo / Especificación</label>
              <input
                type="text"
                value={componentForm.modelo}
                onChange={(e) => setComponentForm({ ...componentForm, modelo: e.target.value })}
                placeholder="Ej: 34 Float, XX1 AXS"
                className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                Estado de Uso <span className="text-rose-400">*</span>
              </label>
              <select
                value={componentForm.estado_componente_id}
                onChange={(e) =>
                  setComponentForm({ ...componentForm, estado_componente_id: e.target.value })
                }
                className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
              >
                <option value="">Selecciona el estado del componente...</option>
                {statesList.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre} ({est.nivel_desgaste}% desgaste)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-slate-300 mb-1">Número de Serie</label>
              <input
                type="text"
                value={componentForm.numero_serie}
                onChange={(e) => setComponentForm({ ...componentForm, numero_serie: e.target.value })}
                placeholder="Ej: FOX34-20240001"
                className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#bfce7f]"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 rounded-xl border border-[#2d3748] bg-[#0e1117] text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[#bfce7f] hover:bg-[#a9ba6b] text-[#1d1f18] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" size={15} /> : (editingComponent ? <Edit2 size={15} /> : <Save size={15} />)}
                <span>
                  {mode === "draft"
                    ? (editingComponent ? "Actualizar en Lista" : "Agregar a la Lista")
                    : (editingComponent ? "Actualizar Componente" : "Guardar Componente")}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Components Table */}
      <div className="border border-[#2d3748] rounded-2xl overflow-hidden bg-[#161a21] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#0e1117] border-b border-[#2d3748] text-slate-400 text-[11px]">
                <th className="py-3.5 px-4 font-bold uppercase">MÓDULO COMPONENTE</th>
                <th className="py-3.5 px-4 font-bold uppercase">ESPECIFICACIÓN / MODELO</th>
                <th className="py-3.5 px-4 font-bold uppercase">NÚMERO DE SERIE</th>
                <th className="py-3.5 px-4 text-center font-bold uppercase">ESTADO</th>
                {!readOnly && <th className="py-3.5 px-4 text-right font-bold uppercase">ACCIONES</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]">
              {components.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 4 : 5} className="py-10 text-center text-slate-400">
                    No hay componentes agregados todavía.
                  </td>
                </tr>
              ) : (
                components.map((comp) => {
                  const key = comp.tempId || comp.id;
                  const catName = comp.categoria_nombre || categoriesList.find(c => String(c.id) === String(comp.categoria_componente_id))?.nombre || "Componente";
                  const spec = comp.especificacion || comp.modelo || comp.marca || "—";
                  const stateObj = statesList.find(s => String(s.id) === String(comp.estado_componente_id));
                  const stateName = comp.estado_nombre || stateObj?.nombre || "Nuevo";
                  const stateCode = comp.estado_codigo || stateObj?.codigo || "NUEVO";
                  const desgaste = comp.nivel_desgaste !== undefined ? comp.nivel_desgaste : (stateObj?.nivel_desgaste ?? 0);

                  return (
                    <tr key={key} className="hover:bg-[#1f242d] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#bfce7f]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{catName}</span>
                          {comp.status === 'saved' || comp.persisted || comp.persistedId ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold uppercase">
                              GUARDADO
                            </span>
                          ) : comp.status === 'saving' ? (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                              <RefreshCw size={10} className="animate-spin" /> GUARDANDO...
                            </span>
                          ) : comp.status === 'error' ? (
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold uppercase">
                              ERROR AL GUARDAR
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-500/20 text-slate-400 border border-slate-500/40 px-1.5 py-0.5 rounded font-bold uppercase">
                              PENDIENTE
                            </span>
                          )}
                        </div>
                        {comp.errorMessage && (
                          <p className="text-[10px] text-rose-400 font-normal mt-1">
                            {comp.errorMessage}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-white font-bold">
                        {spec}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {comp.numero_serie || "—"}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase inline-flex items-center gap-1.5 whitespace-nowrap ${getBadgeStyleForState(
                            desgaste,
                            stateCode
                          )}`}
                        >
                          <span>{stateName}</span>
                          <span className="opacity-40">•</span>
                          <span>{desgaste}% Desgaste</span>
                        </span>
                      </td>

                      {!readOnly && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditClick(comp)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3748] rounded-lg transition-colors cursor-pointer"
                              title="Editar componente"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(comp)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar componente"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
