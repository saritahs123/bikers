"use client";
import React, { useState, useEffect } from "react";
import { ArrowLeft, User, Bike, FileText, ShieldCheck, ClipboardCheck, AlertCircle, Loader2, Calendar, DollarSign, Tag, CheckCircle2 } from "lucide-react";

export default function ReceptionDetailView({ recepcionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (recepcionId) {
      fetchDetail();
    }
  }, [recepcionId]);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/taller/recepciones/${recepcionId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al cargar la recepción.");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el detalle de la recepción.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm text-slate-400">Cargando detalle de recepción...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Listado
        </button>
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "La recepción solicitada no existe o no fue encontrada."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {data.codigo_recepcion}
              </span>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                {data.estado.nombre}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Recibido el {new Date(data.fecha_recepcion).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Details, Right Checklist & Signature */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Info Cards) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Client Card */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              Propietario
            </h4>
            <div>
              <p className="text-sm font-semibold text-slate-100">{data.cliente.nombre_completo}</p>
              <p className="text-xs text-slate-400 mt-0.5">{data.cliente.telefono || "Sin teléfono"} • {data.cliente.correo || "Sin correo"}</p>
              {data.cliente.identificacion && (
                <p className="text-[11px] text-slate-500 mt-1 font-mono">ID: {data.cliente.identificacion}</p>
              )}
            </div>
          </div>

          {/* Bike Card */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400" />
              Bicicleta Ingresada
            </h4>
            <div>
              <p className="text-sm font-semibold text-slate-100">{data.bicicleta.marca} {data.bicicleta.modelo}</p>
              <p className="text-xs text-slate-400 mt-0.5">Color: {data.bicicleta.color || "N/A"}</p>
              {data.bicicleta.numero_serie && (
                <p className="text-[11px] text-slate-500 mt-1 font-mono">Serie: {data.bicicleta.numero_serie}</p>
              )}
            </div>
          </div>

          {/* Financials & Status Card */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Presupuesto & Aprobación
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Presupuesto Estimado:</span>
                <span className="text-slate-100 font-mono font-semibold">RD$ {Number(data.presupuesto_estimado).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Requiere Aprobación:</span>
                <span className={data.requiere_aprobacion ? "text-amber-400" : "text-slate-400"}>
                  {data.requiere_aprobacion ? "Sí, requerida" : "No requerida"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Observations, Checklist & Signature */}
        <div className="space-y-6 lg:col-span-2">
          {/* Observations Box */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Diagnóstico & Observaciones
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1 font-medium">Diagnóstico Preliminar:</span>
                <p className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 min-h-[60px]">
                  {data.diagnostico_preliminar || "Sin diagnóstico registrado."}
                </p>
              </div>
              <div>
                <span className="text-slate-400 block mb-1 font-medium">Declaración del Cliente:</span>
                <p className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 min-h-[60px]">
                  {data.observaciones_cliente || "Sin observaciones del cliente."}
                </p>
              </div>
            </div>
          </div>

          {/* Checklist Items Table */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              Checklist de Inspección Inicial ({data.checklist.length} Ítems)
            </h4>

            {data.checklist.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No se evaluaron ítems de checklist durante la recepción.</p>
            ) : (
              <div className="space-y-2">
                {data.checklist.map((item) => (
                  <div
                    key={item.recepcion_checklist_id}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">{item.item_nombre}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{item.item_categoria}</span>
                      </div>
                      {item.observacion && (
                        <p className="text-xs text-slate-400 mt-1 italic">&quot;{item.observacion}&quot;</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.estado_checklist_nombre}
                      </span>
                      {item.requiere_trabajo && (
                        <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-medium">
                          Requiere Reparación
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signature Rendering Box */}
          {data.firma && (
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Firma Digital Registrada ({data.firma.tipo_firma})
              </h4>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
                <img
                  src={data.firma.firma_digital}
                  alt="Firma del Cliente"
                  className="max-h-32 object-contain filter invert"
                />
              </div>
              <p className="text-[11px] text-slate-500 text-right">
                Firmado el {new Date(data.firma.fecha_firma).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
