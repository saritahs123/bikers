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
    return () => {
      isMounted = false;
    };
  }, [item.recepcion_checklist_id]);

  if (compact) {
    return (
      <div className="p-2 bg-surface border border-border rounded-xl space-y-1 text-[11px] overflow-hidden font-mono">
        <div className="flex justify-between items-center gap-1">
          <span className="font-semibold text-foreground truncate text-[11px]">
            {item.item_nombre || "Inspección"}
          </span>
        </div>

        {loading ? (
          <div className="h-20 bg-card border border-border rounded-lg flex flex-col items-center justify-center space-y-1">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-[9px] text-foreground-muted">Cargando...</span>
          </div>
        ) : error ? (
          <div className="p-1.5 bg-warning-muted border border-warning/20 rounded-lg text-warning text-[10px] truncate">
            {error}
          </div>
        ) : evidenceUrl ? (
          <div className="relative group overflow-hidden rounded-lg border border-border bg-card">
            <img
              src={evidenceUrl}
              alt={item.nombre_archivo || "Evidencia"}
              className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity"
            >
              Ver Foto
            </a>
          </div>
        ) : (
          <div className="p-2 bg-card border border-border rounded-lg text-center text-foreground-muted text-[10px]">
            Sin imagen
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-surface border border-border rounded-xl space-y-2 text-xs font-mono">
      <div className="flex justify-between items-start">
        <span className="font-semibold text-foreground">
          {item.item_nombre || "Ítem de Inspección"}
        </span>
        <span className="text-[10px] bg-card text-foreground-muted px-1.5 py-0.5 rounded border border-border">
          #{item.recepcion_checklist_id}
        </span>
      </div>
      <p className="text-[11px] text-foreground-muted truncate">
        Archivo: {item.nombre_archivo || "Sin nombre de archivo"}
      </p>

      {loading ? (
        <div className="h-44 bg-card border border-border rounded-lg flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-[11px] text-foreground-muted">Cargando imagen S3...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-warning-muted border border-warning/20 rounded-lg text-warning text-[11px] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Error al cargar evidencia
          </p>
          <p className="text-[10px] opacity-80">{error}</p>
        </div>
      ) : evidenceUrl ? (
        <div className="relative group overflow-hidden rounded-lg border border-border bg-card">
          <img
            src={evidenceUrl}
            alt={item.nombre_archivo || "Evidencia"}
            className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <a
            href={evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
          >
            Ver Imagen Completa
          </a>
        </div>
      ) : (
        <div className="p-3 bg-card border border-border rounded-lg text-center text-foreground-muted text-[11px]">
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
  const [activeTab, setActiveTab] = useState("resumen");

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-foreground-muted font-mono">Cargando detalle de recepción...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4 font-sans">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Listado
        </button>
        <div className="p-4 bg-error-muted border border-error/20 rounded-xl text-error text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || "La recepción solicitada no existe o no fue encontrada."}</span>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const datePart = d.toLocaleDateString("es-DO", {
      timeZone: "America/Santo_Domingo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const timePart = d.toLocaleTimeString("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return `${datePart} ${timePart}`;
  };

  const itemsChecklistTotal = data.checklist ? data.checklist.length : 0;
  const itemsTrabajo = (data.checklist || []).filter((ch) => ch.requiere_trabajo);
  const fotosEvidencia = (data.checklist || []).filter((ch) => ch.evidencia_foto);

  const hasLinkedOT = Boolean(data.convertido_orden_id || data.codigo_orden);
  const otIdText = data.codigo_orden || (data.convertido_orden_id ? `OT #${data.convertido_orden_id}` : null);
  const isLocked = Boolean(data.estado?.permite_edicion === false || data.convertido_orden_id);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Locked State Banner */}
      {isLocked && (
        <div className="p-3.5 bg-warning-muted border border-warning/30 rounded-xl text-warning text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Esta recepción está convertida a OT y su información se encuentra bloqueada para garantizar la inmutabilidad y trazabilidad documental.
          </span>
        </div>
      )}

      {/* 1. Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-hover rounded-xl transition-colors cursor-pointer"
            title="Volver al Listado"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap font-mono">
              <span className="text-xs font-bold text-primary bg-primary-muted px-2.5 py-1 rounded-lg border border-primary/20">
                {data.codigo_recepcion || "—"}
              </span>
              <span className="text-xs font-medium text-foreground bg-surface border border-border px-2.5 py-1 rounded-lg">
                {data.estado?.nombre || "RECIBIDA"}
              </span>
            </div>
            <p className="text-xs text-foreground-muted mt-1.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {formatDate(data.fecha_recepcion)}
              </span>
              <span className="flex items-center gap-1 border-l border-border pl-3">
                <User className="w-3.5 h-3.5 text-primary" />
                {data.cliente?.nombre_completo || "—"}
              </span>
              <span className="flex items-center gap-1 border-l border-border pl-3">
                <Bike className="w-3.5 h-3.5 text-primary" />
                {data.bicicleta?.marca || "Bicicleta"} {data.bicicleta?.modelo || ""}{" "}
                {data.bicicleta?.ano ? `(${data.bicicleta.ano})` : ""}
              </span>
              {data.usuario_receptor?.nombre_completo && (
                <span className="flex items-center gap-1 border-l border-border pl-3 text-foreground-muted">
                  <span>Receptor:</span> {data.usuario_receptor.nombre_completo}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {hasLinkedOT ? (
            <span className="flex items-center gap-2 px-4 py-2 bg-primary-muted border border-primary text-primary font-bold rounded-xl">
              <Wrench size={15} />
              <span>{otIdText}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-surface text-foreground-muted border border-border rounded-xl font-medium select-none">
              Sin orden asociada
            </span>
          )}
        </div>
      </div>

      {/* 2. Module Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden font-mono text-xs">
        {["resumen", "checklist", "fotografias", "firma", "historial"].map((tab) => {
          const isActive = activeTab === tab;
          const labels = {
            resumen: "Resumen",
            checklist: `Checklist (${itemsChecklistTotal})`,
            fotografias: `Fotografías (${fotosEvidencia.length})`,
            firma: "Firma",
            historial: "Historial"
          };
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-primary-muted text-primary border border-primary/30 font-bold"
                  : "text-foreground-muted hover:text-foreground hover:bg-hover border border-transparent"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Left Column (8 Cols) */}
          <main className="lg:col-span-8 min-w-0 space-y-5">
            {/* Card 1: Distinct Motivo de Ingreso vs Diagnóstico Preliminar */}
            <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Información de Ingreso &amp; Diagnóstico
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <span className="text-foreground-secondary font-bold block text-[11px]">
                    1. Motivo de Ingreso (Declarado por el Cliente):
                  </span>
                  <p className="p-3.5 bg-surface border border-border rounded-xl text-foreground leading-relaxed min-h-[70px]">
                    &quot;{data.observaciones_cliente || "Sin observaciones expresadas por el cliente."}&quot;
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-foreground-secondary font-bold block text-[11px]">
                    2. Diagnóstico Preliminar (Evaluación de Taller):
                  </span>
                  <p className="p-3.5 bg-surface border border-border rounded-xl text-foreground leading-relaxed min-h-[70px]">
                    {data.diagnostico_preliminar || "Diagnóstico general de mantenimiento e inspección."}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Datos Técnicos y Cliente */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden text-xs">
              <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Datos Técnicos y Cliente
                </h4>
              </div>

              <div className="divide-y divide-border-subtle font-mono">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-surface text-foreground-secondary font-semibold">
                    Cliente / Contacto
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-card text-foreground flex items-center gap-3 flex-wrap">
                    <span className="font-bold">{data.cliente?.nombre_completo || "—"}</span>
                    {data.cliente?.telefono && (
                      <span className="text-foreground-muted border-l border-border pl-3">
                        {data.cliente.telefono}
                      </span>
                    )}
                    {data.cliente?.identificacion && (
                      <span className="text-foreground-muted border-l border-border pl-3">
                        ID: {data.cliente.identificacion}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-surface text-foreground-secondary font-semibold">
                    Bicicleta
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-card text-foreground">
                    <span className="font-bold text-primary">
                      {data.bicicleta?.marca || "Bicicleta"} {data.bicicleta?.modelo || ""}
                    </span>{" "}
                    {data.bicicleta?.ano ? `(${data.bicicleta.ano})` : ""} —{" "}
                    {data.bicicleta?.tipo_bicicleta || "General"}
                    {data.bicicleta?.color && (
                      <span className="text-foreground-muted ml-2">• Color: {data.bicicleta.color}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-1/3 p-3.5 bg-surface text-foreground-secondary font-semibold">
                    Nº de Serie
                  </div>
                  <div className="sm:w-2/3 p-3.5 bg-card text-foreground font-bold">
                    {data.bicicleta?.numero_serie || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Evidencias & Firma Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-card border border-border rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    Evidencias ({fotosEvidencia.length})
                  </h4>
                  {fotosEvidencia.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("fotografias")}
                      className="text-xs text-primary hover:underline font-bold"
                    >
                      Ver fotos
                    </button>
                  )}
                </div>

                {fotosEvidencia.length === 0 ? (
                  <div className="p-4 bg-surface border border-border rounded-xl text-center space-y-1">
                    <ImageOff className="w-5 h-5 text-foreground-muted mx-auto" />
                    <p className="text-xs text-foreground-muted font-mono">Sin fotos de evidencia</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {fotosEvidencia.slice(0, 2).map((item) => (
                      <EvidenceImageCard key={item.recepcion_checklist_id} item={item} compact={true} />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-card border border-border rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Firma del Cliente
                  </h4>
                </div>

                {data.firma?.firma_digital ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-[#090d16] border border-border rounded-xl flex items-center justify-center h-20">
                      <img
                        src={data.firma.firma_digital}
                        alt="Firma del Cliente"
                        className="max-h-16 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-foreground-muted font-mono">
                      <span className="text-primary font-bold">Consentimiento OK</span>
                      <span>{formatDate(data.firma.fecha_firma)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-surface border border-border rounded-xl text-center space-y-1">
                    <ShieldCheck className="w-5 h-5 text-foreground-muted mx-auto" />
                    <p className="text-xs text-foreground-muted font-mono">Sin firma digital registrada</p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Aside Right Column (4 Cols) */}
          <aside className="lg:col-span-4 min-w-0 space-y-5">
            {/* Card 1: Presupuesto & OT */}
            <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                Resumen Económico &amp; OT
              </h4>

              <div className="p-3.5 bg-surface border border-border rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-foreground-muted font-mono">
                  Presupuesto Preliminar
                </span>
                <p className="text-xl font-bold font-mono text-primary">
                  RD$ {Number(data.presupuesto_estimado || 0).toFixed(2)}
                </p>
              </div>

              <div className="p-3.5 bg-surface border border-border rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-foreground-muted font-mono">
                  Orden de Trabajo
                </span>
                <p className="text-base font-bold font-mono text-foreground">
                  {hasLinkedOT ? otIdText : "Sin OT vinculada"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: CHECKLIST */}
      {activeTab === "checklist" && (
        <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Checklist de Inspección ({itemsChecklistTotal} Puntos)
          </h4>

          {itemsChecklistTotal === 0 ? (
            <p className="text-xs text-foreground-muted py-6 text-center font-mono">
              No se evaluaron ítems de checklist durante la recepción.
            </p>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {data.checklist.map((item) => (
                <div
                  key={item.recepcion_checklist_id}
                  className="p-3.5 bg-surface border border-border rounded-xl flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-foreground">{item.item_nombre || "—"}</span>
                    <span className="ml-2 text-[10px] text-foreground-muted bg-card px-2 py-0.5 rounded border border-border">
                      {item.item_categoria || "GENERAL"}
                    </span>
                    {item.observacion && (
                      <p className="text-[11px] text-foreground-muted mt-1 italic">&quot;{item.observacion}&quot;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-card border border-border text-foreground">
                      {item.estado_checklist_nombre || "Evaluado"}
                    </span>
                    {item.requiere_trabajo && (
                      <span className="text-[10px] bg-warning-muted border border-warning/30 text-warning px-2 py-0.5 rounded font-bold">
                        Requiere Trabajo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FOTOGRAFÍAS */}
      {activeTab === "fotografias" && (
        <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Evidencias Fotográficas ({fotosEvidencia.length})
          </h4>
          {fotosEvidencia.length === 0 ? (
            <div className="p-8 bg-surface border border-border rounded-xl text-center space-y-2">
              <ImageOff className="w-8 h-8 text-foreground-muted mx-auto" />
              <p className="text-xs text-foreground-muted font-mono">
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
        <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Firma Digital del Cliente
          </h4>

          {data.firma?.firma_digital ? (
            <div className="space-y-4">
              <div className="p-6 bg-[#090d16] border border-border rounded-xl flex items-center justify-center min-h-[160px]">
                <img
                  src={data.firma.firma_digital}
                  alt="Firma del Cliente"
                  className="max-h-40 w-auto object-contain"
                />
              </div>

              <div className="p-4 bg-surface border border-border rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-foreground-muted block text-[10px] uppercase">Tipo:</span>
                  <span className="text-foreground font-bold">{data.firma.tipo_firma || "INGRESO"}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px] uppercase">Términos:</span>
                  <span className="text-primary font-bold">
                    {data.firma.terminos_aceptados ? "Aceptados ✓" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px] uppercase">Versión:</span>
                  <span className="text-foreground font-bold">{data.firma.version_terminos || "LEGACY"}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px] uppercase">Fecha:</span>
                  <span className="text-foreground">{formatDate(data.firma.fecha_firma)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-surface border border-border rounded-xl text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-foreground-muted mx-auto" />
              <p className="text-xs text-foreground-muted font-mono">Sin firma digital registrada</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de Registro
          </h4>
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3.5 bg-surface border-l-2 border-l-primary rounded-r-xl border border-border flex justify-between items-center">
              <div>
                <span className="text-foreground font-bold block">
                  Recepción Registrada ({data.estado?.nombre || "RECIBIDA"})
                </span>
                <span className="text-foreground-muted text-[11px]">
                  Registrado en el sistema de taller
                </span>
              </div>
              <span className="text-foreground-muted">{formatDate(data.fecha_recepcion)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
