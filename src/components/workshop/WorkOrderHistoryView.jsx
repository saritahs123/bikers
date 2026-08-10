"use client";
import React from "react";
import { Clock, User, ArrowRight, History, CheckCircle2 } from "lucide-react";

export default function WorkOrderHistoryView({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center space-y-2">
        <History className="w-8 h-8 text-slate-600 mx-auto" />
        <h4 className="text-xs font-semibold text-slate-400">Sin historial de cambios registrado</h4>
        <p className="text-xs text-slate-500">
          Los cambios de estado de la orden generarán eventos cronológicos automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            Historial de Estados y Auditoría
            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-full font-mono font-normal">
              {history.length} Eventos
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Línea de tiempo cronológica de transiciones de estado con auditoría de usuario y timestamps.
          </p>
        </div>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {history.map((item, idx) => (
          <div key={item.historial_id || idx} className="relative group">
            {/* Timeline node icon */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>

            {/* Event Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-2 shadow-md hover:border-slate-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {item.estado_anterior_nombre ? (
                    <>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                        {item.estado_anterior_nombre}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </>
                  ) : null}
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    {item.estado_nuevo_nombre}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(item.fecha_cambio).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>

              {item.observacion && (
                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 font-mono">
                  "{item.observacion}"
                </p>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <User className="w-3 h-3 text-slate-500" />
                <span>Responsable: <strong className="text-slate-400">{item.usuario_nombre || "Sistema / Admin"}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
