"use client";
import React, { useState, useMemo } from "react";
import {
  Clock,
  User,
  ArrowRight,
  History,
  CheckCircle2,
  Wrench,
  Package,
  FileText,
  UserCheck,
  Search,
  Filter,
  AlertCircle,
  Sparkles,
  RotateCcw
} from "lucide-react";

export default function WorkOrderHistoryView({ history = [] }) {
  const [activeCategory, setActiveCategory] = useState("all"); // 'all' | 'estados' | 'servicios' | 'mano_obra' | 'repuestos' | 'mecanicos'
  const [searchTerm, setSearchTerm] = useState("");

  // Helper to parse dates safely
  const formatDate = (item) => {
    const rawDate = item.fecha_cambio ?? item.fecha_registro ?? item.fecha_hora ?? item.fecha;
    if (!rawDate) return "Fecha no disponible";
    const parsedDate = new Date(rawDate);
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return "Fecha no disponible";
    }
    try {
      return parsedDate.toLocaleString("es-DO", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch {
      return parsedDate.toLocaleString();
    }
  };

  // Helper to parse history event title, category, and icon
  const parseHistoryEvent = (item) => {
    const comment = (item.comentario || item.observacion || "").trim();
    const stPrev = item.estado_anterior_nombre;
    const stNext = item.estado_nuevo_nombre;
    const isRealStateChange =
      Boolean(stPrev) && Boolean(stNext) && stPrev.toUpperCase() !== stNext.toUpperCase();

    const cLower = comment.toLowerCase();
    let title = "Actividad en la Orden";
    let category = "servicios";
    let iconType = "service";

    if (isRealStateChange) {
      title = `Orden cambió de ${stPrev} a ${stNext}`;
      category = "estados";
      iconType = "state";
    } else if (cLower.includes("mecanico") || cLower.includes("mecánico") || cLower.includes("reasign")) {
      title = cLower.includes("reasign") ? "Mecánico Reasignado" : "Mecánico Asignado";
      category = "mecanicos";
      iconType = "mechanic";
    } else if (
      cLower.includes("mano de obra") ||
      cLower.includes("mano_obra") ||
      cLower.includes("cronómetro") ||
      cLower.includes("sesión")
    ) {
      if (cLower.includes("eliminad")) title = "Mano de Obra Eliminada";
      else if (cLower.includes("actualizad") || cLower.includes("editad")) title = "Mano de Obra Editada";
      else title = "Mano de Obra Registrada";
      category = "mano_obra";
      iconType = "labor";
    } else if (cLower.includes("repuesto") || cLower.includes("producto")) {
      if (cLower.includes("desasociad") || cLower.includes("eliminad") || cLower.includes("anulad")) {
        title = "Repuesto Eliminado";
      } else {
        title = "Repuesto Asociado / Modificado";
      }
      category = "repuestos";
      iconType = "product";
    } else if (cLower.includes("servicio")) {
      if (cLower.includes("agregad") || cLower.includes("añadid")) title = "Servicio Agregado";
      else if (cLower.includes("eliminad")) title = "Servicio Eliminado";
      else if (cLower.includes("reabiert")) title = "Servicio Reabierto";
      else if (cLower.includes("completad") || cLower.includes("finalizad")) title = "Servicio Finalizado";
      else if (cLower.includes("pausad")) title = "Servicio Pausado";
      else if (cLower.includes("iniciad") || cLower.includes("reanudad")) title = "Servicio En Proceso";
      else title = "Actualización de Servicio";
      category = "servicios";
      iconType = "service";
    } else if (cLower.includes("prioridad")) {
      title = "Prioridad Modificada";
      category = "estados";
      iconType = "state";
    } else if (comment) {
      title = comment;
      category = "servicios";
      iconType = "service";
    }

    return { title, category, iconType, isRealStateChange };
  };

  // Icon renderer
  const renderIcon = (iconType) => {
    switch (iconType) {
      case "state":
        return <History className="w-3.5 h-3.5 text-emerald-400" />;
      case "mechanic":
        return <UserCheck className="w-3.5 h-3.5 text-amber-400" />;
      case "labor":
        return <Wrench className="w-3.5 h-3.5 text-[#bfce7f]" />;
      case "product":
        return <Package className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  // Filter & Sort history (newest first)
  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];

    return history
      .map((item) => ({ ...item, meta: parseHistoryEvent(item) }))
      .filter((item) => {
        // Category Filter
        if (activeCategory !== "all" && item.meta.category !== activeCategory) {
          return false;
        }

        // Search Filter
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          const matchesTitle = item.meta.title.toLowerCase().includes(s);
          const matchesComment = (item.comentario || item.observacion || "").toLowerCase().includes(s);
          const matchesUser = (item.usuario_nombre || "").toLowerCase().includes(s);
          const matchesState =
            (item.estado_anterior_nombre || "").toLowerCase().includes(s) ||
            (item.estado_nuevo_nombre || "").toLowerCase().includes(s);

          return matchesTitle || matchesComment || matchesUser || matchesState;
        }

        return true;
      })
      .sort((a, b) => {
        const idA = Number(a.historial_id || a.orden_historial_estado_id || 0);
        const idB = Number(b.historial_id || b.orden_historial_estado_id || 0);
        return idB - idA;
      });
  }, [history, activeCategory, searchTerm]);

  return (
    <div className="space-y-5 font-sans text-slate-100">
      {/* Header & Controls Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d3748] pb-4">
          <div>
            <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2 uppercase tracking-wider">
              <History className="w-4 h-4 text-[#bfce7f]" />
              Historial de Auditoría & Eventos
              <span className="text-xs px-2.5 py-0.5 bg-[#84924a]/20 text-[#bfce7f] border border-[#bfce7f]/30 rounded-full font-mono font-bold">
                {filteredHistory.length} Eventos
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registro cronológico de cambios de estado, asignaciones, servicios, repuestos y mano de obra.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative shrink-0 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar evento, usuario o nota..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0a0c10] border border-[#2d3748] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#bfce7f] font-mono"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {[
            { id: "all", label: "Todos" },
            { id: "estados", label: "Estados" },
            { id: "servicios", label: "Servicios" },
            { id: "mano_obra", label: "Mano de Obra" },
            { id: "repuestos", label: "Repuestos" },
            { id: "mecanicos", label: "Mecánicos" }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-[#84924a] text-white border-t border-[#a6b66b] shadow-md"
                  : "bg-[#1c2129] text-slate-400 hover:text-slate-200 border border-[#2d3748]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Timeline */}
      {filteredHistory.length === 0 ? (
        <div className="p-12 bg-[#161a21] border border-dashed border-[#2d3748] rounded-2xl text-center space-y-3 font-mono">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sin eventos de historial registrados</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || activeCategory !== "all"
              ? "No se encontraron eventos con los filtros seleccionados."
              : "Las actividades de la orden generarán registros automáticos con auditoría de usuario."}
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#2d3748]">
          {filteredHistory.map((item, idx) => {
            const hId = item.historial_id || item.orden_historial_estado_id || idx;
            const formattedDate = formatDate(item);
            const { title, isRealStateChange, iconType } = item.meta;

            return (
              <div key={hId} className="relative group">
                {/* Node Dot */}
                <div className="absolute -left-6 top-2.5 w-5 h-5 rounded-full bg-[#0a0c10] border-2 border-[#bfce7f] flex items-center justify-center text-[#bfce7f] shadow-md">
                  {renderIcon(iconType)}
                </div>

                {/* Event Card */}
                <div className="bg-[#161a21] border border-[#2d3748] hover:border-[#4a5568] rounded-xl p-4 space-y-2.5 shadow-lg transition-colors font-sans">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d3748]/60 pb-2">
                    <div className="flex items-center gap-2 font-mono font-bold text-xs">
                      <span className="text-slate-100">{title}</span>
                      {isRealStateChange && (
                        <div className="flex items-center gap-1.5 text-[11px] ml-1">
                          <span className="px-2 py-0.5 rounded bg-[#0a0c10] text-slate-400 border border-[#2d3748]">
                            {item.estado_anterior_nombre}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[#bfce7f]" />
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                            {item.estado_nuevo_nombre}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Comment / Detail text */}
                  {(item.comentario || item.observacion) && (
                    <p className="text-xs text-slate-300 bg-[#0a0c10] p-2.5 rounded-lg border border-[#2d3748]/60 font-mono leading-relaxed">
                      "{item.comentario || item.observacion}"
                    </p>
                  )}

                  {/* Responsible User */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5 font-mono">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>
                      Responsable: <strong className="text-slate-200">{item.usuario_nombre || "Sistema / Administrador"}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
