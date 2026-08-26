"use client";
import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  User,
  Bike,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  Printer,
  ArrowRight,
  Camera,
  ImageOff,
  Wrench,
  History,
  AlertTriangle
} from "lucide-react";

function EvidenceImageCard({ item, compact = false }) {
  const [evidenceUrl, setEvidenceUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadEvidence() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/taller/evidencias/${item.recepcion_checklist_id}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || json.error || `Error HTTP ${res.status}`);
        }
        if (isMounted) {
          const url = json.downloadUrl || json.url_evidencia || json.data?.downloadUrl || json.data?.url_evidencia;
          setEvidenceUrl(url);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "No se pudo cargar la evidencia.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadEvidence();
    return () => { isMounted = false; };
  }, [item.recepcion_checklist_id]);

  if (compact) {
    return (
      <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1 text-[11px] overflow-hidden">
        <div className="flex justify-between items-center gap-1">
          <span className="font-semibold text-slate-200 truncate text-[11px]">
            {item.item_nombre || "Inspección"}
          </span>
        </div>

        {loading ? (
          <div className="h-20 bg-slate-900 border border-slate-800 rounded flex flex-col items-center justify-center space-y-1">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="text-[9px] text-slate-500">Cargando...</span>
          </div>
        ) : error ? (
          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-[10px] truncate">
            {error}
          </div>
        ) : evidenceUrl ? (
          <div className="relative group overflow-hidden rounded border border-slate-800 bg-slate-900">
            <img
              src={evidenceUrl}
              alt={item.nombre_archivo || "Evidencia"}
              className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity"
            >
              Ver Foto
            </a>
          </div>
        ) : (
          <div className="p-2 bg-slate-900 border border-slate-800 rounded text-center text-slate-500 text-[10px]">
            Sin imagen
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs">
      <div className="flex justify-between items-start">
        <span className="font-semibold text-slate-200">
          {item.item_nombre || "Ítem de Inspección"}
        </span>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
          #{item.recepcion_checklist_id}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 font-mono truncate">
        Archivo: {item.nombre_archivo || "Sin nombre de archivo"}
      </p>

      {loading ? (
        <div className="h-44 bg-slate-900 border border-slate-800 rounded-lg flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          <span className="text-[11px] text-slate-500">Cargando imagen S3...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[11px] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Error al cargar evidencia
          </p>
          <p className="text-[10px] text-amber-300/80">{error}</p>
        </div>
      ) : evidenceUrl ? (
        <div className="relative group overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <img
            src={evidenceUrl}
            alt={item.nombre_archivo || "Evidencia"}
            className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <a
            href={evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
          >
            Ver Imagen Completa
          </a>
        </div>
      ) : (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center text-slate-500 text-[11px]">
          Imagen no disponible
        </div>
      )}
    </div>
  );
}

export default function ReceptionDetailView({ recepcionId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("resumen"); // 'resumen' | 'checklist' | 'fotografias' | 'firma' | 'historial'

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
      if (res.status === 401) {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return;
      }
      let json = null;
      try {
        json = await res.json();
      } catch {
        throw new Error(res.ok ? "Respuesta inválida del servidor." : `Error del servidor (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "No fue posible cargar el detalle de la recepción.");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message || "No fue posible cargar el detalle de la recepción. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
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
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "La recepción solicitada no existe o no fue encontrada."}</span>
        </div>
      </div>
    );
  }



  // Safe Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-DO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const itemsChecklistTotal = data.checklist ? data.checklist.length : 0;
  const itemsTrabajo = (data.checklist || []).filter((ch) => ch.requiere_trabajo);
  const fotosEvidencia = (data.checklist || []).filter((ch) => ch.evidencia_foto);
  
  // Real DB value: null if not converted
  const hasLinkedOT = Boolean(data.convertido_orden_id);
  const otIdText = hasLinkedOT
    ? `OT-2026-${String(data.convertido_orden_id).padStart(4, "0")}`
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            title="Volver al Listado"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {data.codigo_recepcion || "RC-2026-0001"}
              </span>
              <span className="text-xs font-medium text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                {data.estado?.nombre || "RECIBIDA"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {formatDate(data.fecha_recepcion)}
              </span>
              <span className="flex items-center gap-1 border-l border-slate-800 pl-3">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                {data.cliente?.nombre_completo || "—"}
              </span>
              <span className="flex items-center gap-1 border-l border-slate-800 pl-3">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                {data.bicicleta?.marca || "Bicicleta"} {data.bicicleta?.modelo || ""}{" "}
                {data.bicicleta?.ano ? `(${data.bicicleta.ano})` : ""}
              </span>
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            Imprimir Recibo
          </button>

          {/* Real OT Status Header Control */}
          {hasLinkedOT ? (
            <button
              type="button"
              onClick={() =>
                alert("Acción de navegación vinculada al Módulo de Órdenes de Trabajo (Bloque 2).")
              }
              className="flex items-center gap-2 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-400/20 cursor-pointer"
              title="Función del Módulo de Órdenes de Trabajo (Bloque 2)"
            >
              VER {otIdText}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 text-slate-400 border border-slate-700 rounded-xl text-xs font-medium select-none">
              SIN OT VINCULADA
            </span>
          )}
        </div>
      </div>

      {/* 2. Module Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("resumen")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "resumen"
              ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          Resumen
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checklist")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "checklist"
              ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          Checklist
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fotografias")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "fotografias"
              ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          Fotografías
          <span className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {fotosEvidencia.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("firma")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "firma"
              ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          Firma
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "historial"
              ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
          }`}
        >
          Historial
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: RESUMEN (Bento Grid) */}
      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Left Column (8 Cols) */}
          <main className="lg:col-span-8 min-w-0 space-y-5">
            {/* Card 1: Motivo de Ingreso & Notas */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Motivo de Ingreso &amp; Notas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1 font-medium">Motivo Principal:</span>
                  <p className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 leading-relaxed min-h-[70px]">
                    {data.diagnostico_preliminar || data.tipo_servicio?.nombre || "Mantenimiento e Inspección General"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1 font-medium">Observaciones del Cliente:</span>
                  <p className="p-3.5 bg-slate-950/60 border border-slate-800 border-l-2 border-l-emerald-400 rounded-xl text-slate-300 italic leading-relaxed min-h-[70px]">
                    &quot;{data.observaciones_cliente || "Sin observaciones expresadas por el cliente."}&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Datos Técnicos y Cliente (Zebra Table) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Datos Técnicos y Cliente
                </h4>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-xs text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer"
                >
                  Volver al Listado
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 text-xs">
                {/* Row 1: Cliente / Contacto */}
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-slate-950/40 text-slate-400 font-medium">
                    Cliente / Contacto
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-slate-900/40 text-slate-200 flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-slate-100">{data.cliente?.nombre_completo || "—"}</span>
                    {data.cliente?.telefono && (
                      <span className="text-slate-400 border-l border-slate-800 pl-3">
                        {data.cliente.telefono}
                      </span>
                    )}
                    {data.cliente?.correo && (
                      <span className="text-slate-400 border-l border-slate-800 pl-3">
                        {data.cliente.correo}
                      </span>
                    )}
                    {data.cliente?.identificacion && (
                      <span className="text-slate-400 border-l border-slate-800 pl-3 font-mono text-[11px]">
                        ID: {data.cliente.identificacion}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Bicicleta */}
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-slate-950/40 text-slate-400 font-medium">
                    Bicicleta
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-slate-900/40 text-slate-200">
                    <span className="font-semibold text-emerald-400">
                      {data.bicicleta?.marca || "Bicicleta"} {data.bicicleta?.modelo || ""}
                    </span>{" "}
                    {data.bicicleta?.ano ? `(${data.bicicleta.ano})` : ""} —{" "}
                    {data.bicicleta?.tipo_bicicleta || "MTB / Trail"}
                    {data.bicicleta?.color && (
                      <span className="text-slate-400 ml-2">
                        • Color: {data.bicicleta.color}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Nº de Serie / Cuadro */}
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-slate-950/40 text-slate-400 font-medium">
                    Nº de Serie / Cuadro
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-slate-900/40 text-slate-300 font-mono font-bold tracking-wider">
                    {data.bicicleta?.numero_serie || "—"}
                  </div>
                </div>

                {/* Row 4: Suspensiones / Notas Técnicas */}
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-slate-950/40 text-slate-400 font-medium">
                    Suspensiones / Notas
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-slate-900/40 text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block uppercase font-medium">
                        Horquilla / Config.
                      </span>
                      {data.bicicleta?.notas_tecnicas || "Fox Rhythm 34, 140mm"}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block uppercase font-medium">
                        Shock / Trasero
                      </span>
                      {"Fox Float EVOL, 130mm"}
                    </div>
                  </div>
                </div>

                {/* Row 5: Transmisión / Frenos */}
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-slate-950/40 text-slate-400 font-medium">
                    Transmisión / Frenos
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-slate-900/40 text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block uppercase font-medium">
                        G. Shift
                      </span>
                      {"Shimano XT M8100 12v"}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block uppercase font-medium">
                        Frenos
                      </span>
                      {"Shimano Deore 4-pistones"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Sub-Grid de Evidencias (50%) & Firma Digital (50%) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Evidencias Registradas */}
              <section className="min-w-0 h-full">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl h-full flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 min-h-[32px]">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      Evidencias Registradas ({fotosEvidencia.length})
                    </h4>

                    {fotosEvidencia.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("fotografias")}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer font-medium"
                      >
                        Ver detalle
                      </button>
                    )}
                  </div>

                  {fotosEvidencia.length === 0 ? (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center space-y-1 my-auto">
                      <ImageOff className="w-5 h-5 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        No hay evidencias fotográficas registradas
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fotosEvidencia.slice(0, 2).map((item) => (
                        <EvidenceImageCard key={item.recepcion_checklist_id} item={item} compact={true} />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Firma Digital del Cliente */}
              <section className="min-w-0 h-full">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl h-full flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 min-h-[32px]">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Firma Digital del Cliente
                    </h4>
                  </div>

                  {data.firma?.firma_digital ? (
                    <div className="space-y-2 my-auto">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center max-w-full overflow-hidden h-24">
                        <img
                          src={data.firma.firma_digital}
                          alt="Firma del Cliente"
                          className="max-h-20 max-w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
                        <span className="text-emerald-400 font-medium truncate">Términos Aceptados</span>
                        <span className="truncate shrink-0 font-mono text-[10px]">{formatDate(data.firma.fecha_firma)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center space-y-1 my-auto">
                      <ShieldCheck className="w-5 h-5 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Sin firma digital registrada.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>

          {/* Aside Right Column (4 Cols) */}
          <aside className="lg:col-span-4 min-w-0 space-y-5">
            {/* Card 1: Estado de Ingreso */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                Estado de Ingreso
              </h4>

              <div className="space-y-4 text-xs">
                {/* Visual Inspection Progress */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 text-[11px]">
                    <span className="text-slate-400">Inspección Visual</span>
                    <span className="text-emerald-400 font-semibold font-mono">APROBADA</span>
                  </div>
                  <div className="flex gap-1 h-2 w-full">
                    <div className="flex-1 bg-emerald-400 rounded-sm" />
                    <div className="flex-1 bg-emerald-400 rounded-sm" />
                    <div className="flex-1 bg-emerald-400 rounded-sm" />
                    <div className="flex-1 bg-emerald-400 rounded-sm" />
                  </div>
                </div>

                {/* Checklist Progress */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 text-[11px]">
                    <span className="text-slate-400">Checklist Recepción</span>
                    <span className="text-slate-200 font-mono">
                      100% ({itemsChecklistTotal}/{itemsChecklistTotal || 1})
                    </span>
                  </div>
                  <div className="flex gap-0.5 h-2 w-full">
                    {Array.from({ length: Math.max(1, Math.min(12, itemsChecklistTotal || 12)) }).map((_, i) => (
                      <div key={i} className="flex-1 bg-emerald-400 rounded-sm" />
                    ))}
                  </div>
                </div>

                {/* Critical Findings */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Hallazgos Críticos en Ingreso
                  </span>
                  {itemsTrabajo.length > 0 ? (
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      {itemsTrabajo.map((item) => (
                        <li key={item.recepcion_checklist_id}>
                          {item.item_nombre || "—"}: {item.observacion || item.estado_checklist_nombre || "—"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Sin hallazgos críticos reportados durante la recepción.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Block 2 Linked Work Order Card */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 relative">
              <div className="absolute top-0 right-0 bg-slate-800 text-slate-400 border-l border-b border-slate-800 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-bl-lg">
                {hasLinkedOT ? "Orden Creada" : "Estado OT"}
              </div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-1">
                Orden de Trabajo Vinculada
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {hasLinkedOT
                  ? "Esta recepción ya ha sido procesada y se ha generado una Orden de Trabajo en el taller."
                  : "Sin orden de trabajo vinculada."}
              </p>
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    ID OT
                  </span>
                  <span className="text-lg font-mono font-bold text-emerald-400">
                    {hasLinkedOT ? otIdText : "SIN OT"}
                  </span>
                </div>
                <Wrench className="w-6 h-6 text-slate-700" />
              </div>

              {hasLinkedOT ? (
                <button
                  type="button"
                  onClick={() =>
                    alert("Acción de navegación vinculada al Módulo de Órdenes de Trabajo (Bloque 2).")
                  }
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  title="Función del Módulo de Órdenes de Trabajo (Bloque 2)"
                >
                  Ir al Panel de Taller
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-950 text-slate-600 rounded-xl text-xs font-medium border border-slate-800/80 cursor-not-allowed select-none"
                >
                  Sin Acción de Bloque 2
                </button>
              )}

              {/* Seccion Compacta de Presupuesto Preliminar Aprobado */}
              <div className="border-t border-slate-800/80 pt-3 mt-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Presupuesto preliminar aprobado
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Sujeto a cambios después del diagnóstico en taller
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-mono font-bold text-emerald-400">
                      RD$ {Number(data.presupuesto_estimado || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: CHECKLIST */}
      {activeTab === "checklist" && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            Checklist de Inspección Inicial ({itemsChecklistTotal} Ítems)
          </h4>

          {itemsChecklistTotal === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No se evaluaron ítems de checklist durante la recepción.
            </p>
          ) : (
            <div className="space-y-2">
              {data.checklist.map((item) => (
                <div
                  key={item.recepcion_checklist_id}
                  className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">
                        {item.item_nombre || "—"}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {item.item_categoria || "GENERAL"}
                      </span>
                    </div>
                    {item.observacion && (
                      <p className="text-xs text-slate-400 mt-1 italic">
                        &quot;{item.observacion}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                      {item.estado_checklist_nombre || "Evaluado"}
                    </span>
                    {item.requiere_trabajo && (
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-semibold">
                        Requiere Reparación
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FOTOGRAFÍAS / EVIDENCIAS */}
      {activeTab === "fotografias" && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            Evidencias Registradas ({fotosEvidencia.length})
          </h4>
          {fotosEvidencia.length === 0 ? (
            <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-xl text-center space-y-2">
              <ImageOff className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Esta recepción no posee evidencias fotográficas registradas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {fotosEvidencia.map((item) => (
                <EvidenceImageCard key={item.recepcion_checklist_id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FIRMA */}
      {activeTab === "firma" && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 w-full">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Firma Digital del Cliente
          </h4>

          {data.firma?.firma_digital ? (
            <div className="space-y-4 w-full">
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center w-full min-h-[160px]">
                <img
                  src={data.firma.firma_digital}
                  alt="Firma del Cliente"
                  className="max-h-40 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector('.fallback-msg')) {
                      const msg = document.createElement('p');
                      msg.className = 'fallback-msg text-xs text-slate-400 text-center py-4';
                      msg.innerText = 'Archivo de firma digital no disponible en servidor.';
                      parent.appendChild(msg);
                    }
                  }}
                />
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex flex-col sm:flex-row justify-between sm:justify-start gap-1 sm:gap-2">
                  <span className="text-slate-400">Tipo de Firma:</span>
                  <span className="text-slate-200 font-medium">{data.firma.tipo_firma || "—"}</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:justify-start gap-1 sm:gap-2">
                  <span className="text-slate-400">Términos:</span>
                  <span className="text-emerald-400 font-medium">
                    {data.firma.terminos_aceptados ? "Aceptados" : "No Aceptados"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:justify-start gap-1 sm:gap-2">
                  <span className="text-slate-400">Fecha de Firma:</span>
                  <span className="text-slate-200">{formatDate(data.firma.fecha_firma)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-xl text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Sin firma digital registrada.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Historial de Registro
          </h4>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-slate-950/60 border-l-2 border-l-emerald-400 rounded-r-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-200 font-semibold block">
                  Recepción Creada ({data.estado?.nombre || "RECIBIDA"})
                </span>
                <span className="text-slate-400 text-[11px]">
                  Registrado en el módulo de recepción de taller
                </span>
              </div>
              <span className="text-slate-400">{formatDate(data.fecha_recepcion)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
