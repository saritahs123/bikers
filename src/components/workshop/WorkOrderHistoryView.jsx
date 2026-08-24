"use client";
import React, { useMemo } from "react";
import {
  Clock,
  User,
  ArrowRight,
  History,
  Wrench,
  Package,
  FileText,
  UserCheck
} from "lucide-react";

export default function WorkOrderHistoryView({ history = [] }) {
  // Helper to parse dates safely (dia/mes/año hora:minutos a. m. / p. m.)
  const formatDate = (item) => {
    const rawDate = item.fecha_cambio ?? item.fecha_registro ?? item.fecha_hora ?? item.fecha;
    if (!rawDate) return "Fecha no disponible";
    const d = new Date(rawDate);
    if (!d || Number.isNaN(d.getTime())) {
      return "Fecha no disponible";
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "p. m." : "a. m.";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
  };

  // Helper to parse history event title and icon
  const parseHistoryEvent = (item) => {
    const comment = (item.comentario || item.observacion || "").trim();
    const stPrev = item.estado_anterior_nombre;
    const stNext = item.estado_nuevo_nombre;
    const isRealStateChange =
      Boolean(stPrev) && Boolean(stNext) && stPrev.toUpperCase() !== stNext.toUpperCase();

    const cLower = comment.toLowerCase();
    let title = "Actividad en la Orden";
    let iconType = "service";

    if (isRealStateChange) {
      title = `Orden cambió de ${stPrev} a ${stNext}`;
      iconType = "state";
    } else if (cLower.includes("mecanico") || cLower.includes("mecánico") || cLower.includes("reasign") || cLower.includes("iniciada por")) {
      title = cLower.includes("reasign") ? "Mecánico Reasignado" : "Mecánico Asignado / Reparación Iniciada";
      iconType = "mechanic";
    } else if (cLower.includes("repuesto") || cLower.includes("producto")) {
      if (cLower.includes("eliminad")) title = "Producto Eliminado";
      else if (cLower.includes("editad") || cLower.includes("modificad")) title = "Producto Editado";
      else title = "Producto Agregado";
      iconType = "product";
    } else if (cLower.includes("servicio")) {
      if (cLower.includes("agregad")) title = "Servicio Agregado";
      else if (cLower.includes("eliminad")) title = "Servicio Eliminado";
      else if (cLower.includes("completad") || cLower.includes("finalizad")) title = "Servicio Finalizado";
      else if (cLower.includes("pausad")) title = "Servicio Pausado";
      else if (cLower.includes("iniciad") || cLower.includes("reanudad")) title = "Servicio En Proceso";
      else title = "Actualización de Servicio";
      iconType = "service";
    } else if (comment) {
      title = comment;
      iconType = "service";
    }

    return { title, iconType, isRealStateChange };
  };

  // Icon renderer
  const renderIcon = (iconType) => {
    switch (iconType) {
      case "state":
        return <History className="w-3.5 h-3.5 text-emerald-400" />;
      case "mechanic":
        return <UserCheck className="w-3.5 h-3.5 text-amber-400" />;
      case "product":
        return <Package className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-[#bfce7f]" />;
    }
  };

  // Sort history (newest first)
  const sortedHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];

    return history
      .map((item) => ({ ...item, meta: parseHistoryEvent(item) }))
      .sort((a, b) => {
        const idA = Number(a.historial_id || a.orden_historial_estado_id || 0);
        const idB = Number(b.historial_id || b.orden_historial_estado_id || 0);
        return idB - idA;
      });
  }, [history]);

  return (
    <div className="space-y-5 font-sans text-slate-100">
      {/* Clean Header Bar */}
      <div className="bg-[#161a21] border border-[#2d3748] p-4 sm:p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2.5 uppercase tracking-wider">
            <History className="w-4 h-4 text-[#bfce7f]" />
            HISTORIAL DE LA ORDEN
            <span className="text-xs px-2.5 py-0.5 bg-[#84924a]/20 text-[#bfce7f] border border-[#bfce7f]/30 rounded-full font-mono font-bold">
              ({sortedHistory.length} EVENTOS)
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Registro cronológico oficial de auditoría, estados, productos y cambios de la orden de trabajo.
          </p>
        </div>
      </div>

      {/* Events Timeline */}
      {sortedHistory.length === 0 ? (
        <div className="p-12 bg-[#161a21] border border-dashed border-[#2d3748] rounded-2xl text-center space-y-3 font-mono">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SIN EVENTOS DE HISTORIAL REGISTRADOS</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-sans">
            Las actividades de la orden generarán registros automáticos con auditoría de usuario.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#2d3748]">
          {sortedHistory.map((item, idx) => {
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
                <div className="bg-[#161a21] border border-[#2d3748] hover:border-[#4a5568] rounded-xl p-4 space-y-2 shadow-lg transition-colors font-sans">
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
                      {item.comentario || item.observacion}
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
