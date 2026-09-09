"use client";
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Receipt,
  User,
  Bike,
  Calendar,
  DollarSign,
  Package,
  Wrench,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Printer,
  ShieldCheck,
  FileText,
  RotateCcw,
  CheckCircle,
  Clock,
  X,
  Info
} from "lucide-react";
import { generateInvoicePdfDocument } from "@/lib/workshop/generateInvoicePdf";
import WorkOrderStatusBadge, { hexToRgba } from "./WorkOrderStatusBadge";

export default function BillingOrderDetailView({ ordenId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Operational Action States
  const [isDelivering, setIsDelivering] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Toast / Feedback State
  const [feedback, setFeedback] = useState(null);

  // Modal accessibility: Escape key and scroll lock
  useEffect(() => {
    if (!reopenModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setReopenModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [reopenModalOpen]);

  const showToast = (type, title, message) => {
    setFeedback({ type, title, message });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  const fetchDetail = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/taller/facturacion/ordenes/${ordenId}`);
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
        throw new Error(json?.message || json?.error || "No se pudo cargar la orden.");
      }
      setData(json.data || null);
    } catch (err) {
      console.error("fetchBillingOrderDetail Error:", err);
      setError(err.message || "Error de comunicación con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Operational Action 1: ENTREGAR A CLIENTE (Atomically Delivers & Invoices)
  const handleDeliverToCustomer = async () => {
    if (!ordenId || isDelivering) return;
    setIsDelivering(true);

    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_id: 8,
          accion: "ENTREGAR_A_CLIENTE",
          observacion_entrega: "Entrega y facturación final al cliente desde módulo de Despacho de Órdenes."
        })
      });

      const json = await res.json();

      if (!res.ok) {
        const errKey = json.error;
        const msg = json.message || "No se pudo procesar la entrega de la orden.";

        if (errKey === "ORDER_NOT_READY_FOR_DELIVERY") {
          showToast("info", "ORDEN AÚN NO DISPONIBLE PARA ENTREGA", msg);
        } else if (errKey === "ORDER_HAS_INCOMPLETE_SERVICES") {
          showToast("info", "ORDEN CON SERVICIOS PENDIENTES", msg);
        } else if (errKey === "ORDER_ALREADY_INVOICED") {
          showToast("info", "ORDEN YA PROCESADA", msg);
        } else if (res.status >= 500) {
          showToast("error", "ERROR DEL SERVIDOR", msg);
        } else {
          showToast("info", "AVISO OPERATIVO", msg);
        }
        return;
      }

      showToast(
        "success",
        "ORDEN ENTREGADA Y FACTURADA",
        json.message || "La orden ha sido entregada y facturada correctamente."
      );
      await fetchDetail();
    } catch (err) {
      console.error("handleDeliverToCustomer Error:", err);
      showToast("error", "ERROR DE CONEXIÓN", "No se pudo conectar con el servidor.");
    } finally {
      setIsDelivering(false);
    }
  };

  // Operational Action 2: REABRIR REPARACIÓN (LISTA_ENTREGA -> REPARACION)
  const handleReopenRepair = async () => {
    if (!ordenId || isReopening) return;
    setIsReopening(true);

    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_orden_id: 5,
          motivo_reapertura: reopenReason || "Reapertura de reparación solicitada desde Despacho de Órdenes."
        })
      });

      const json = await res.json();

      if (!res.ok) {
        const errKey = json.error;
        const msg = json.message || "No se pudo reabrir la reparación.";

        if (errKey === "ORDER_ALREADY_INVOICED") {
          showToast("info", "ORDEN YA PROCESADA", msg);
        } else if (res.status >= 500) {
          showToast("error", "ERROR DEL SERVIDOR", msg);
        } else {
          showToast("info", "AVISO OPERATIVO", msg);
        }
        return;
      }

      setReopenModalOpen(false);
      setReopenReason("");
      showToast(
        "success",
        "REPARACIÓN REABIERTA",
        "La orden regresó a estado En Reparación."
      );
      await fetchDetail();
    } catch (err) {
      console.error("handleReopenRepair Error:", err);
      showToast("error", "ERROR DE CONEXIÓN", "No se pudo conectar con el servidor.");
    } finally {
      setIsReopening(false);
    }
  };

  // Operational Action 3: GENERAR E IMPRIMIR FACTURA PDF
  const handlePrintInvoice = async () => {
    if (!ordenId || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      // 1. Fetch real validated invoice payload from backend
      const res = await fetch(`/api/taller/facturacion/ordenes/${ordenId}/imprimir`);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          showToast(
            "info",
            "FACTURA NO DISPONIBLE",
            json.message || "La factura solo puede imprimirse cuando la orden esté entregada y facturada."
          );
          return;
        }
        throw new Error(json.message || json.error || "No se pudo obtener los datos de la factura.");
      }

      const invoiceData = json.data;
      if (!invoiceData) {
        throw new Error("Respuesta inválida del servidor al generar la factura.");
      }

      // 2. Generate PDF document using jsPDF
      const doc = generateInvoicePdfDocument(invoiceData);

      // 3. Name file cleanly using the real order code
      const orderCode = invoiceData.factura?.codigo_orden || `OT-${ordenId}`;
      const fileName = `Factura_${orderCode}.pdf`.replace(/[/\\?%*:|"<>]/g, "-");

      // 4. Save/Download and open print window / blob url
      const pdfBlob = doc.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Download the PDF
      doc.save(fileName);

      // Also open in a new window/tab for instant preview and browser print
      const printWindow = window.open(blobUrl, "_blank");
      if (printWindow) {
        printWindow.focus();
      }

      showToast("success", "FACTURA GENERADA", `Se generó correctamente el archivo ${fileName}`);
    } catch (err) {
      console.error("handlePrintInvoice Error:", err);
      showToast("error", "ERROR AL GENERAR FACTURA", err.message || "Ocurrió un error al procesar el archivo PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Operational Action 4: ABRIR TICKET POS TÉRMICO (80 mm)
  const handleOpenPosTicket = () => {
    if (!ordenId) return;
    window.open(
      `/workshop/billing/${ordenId}/ticket`,
      "_blank",
      "noopener,noreferrer,width=440,height=800,scrollbars=yes,resizable=yes"
    );
  };

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "No registrada";
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (totalSeconds) => {
    const secs = Number(totalSeconds || 0);
    if (secs <= 0) return "0 min";
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const remainingSeconds = secs % 60;

    if (hours > 0) {
      if (minutes > 0) {
        return `${hours} h ${minutes} min`;
      }
      return `${hours} h`;
    }
    if (minutes > 0) {
      if (remainingSeconds > 0) {
        return `${minutes} min ${remainingSeconds} s`;
      }
      return `${minutes} min`;
    }
    return `${remainingSeconds} s`;
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center bg-card/60 border border-border rounded-2xl text-foreground-muted gap-3 min-h-[380px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-mono tracking-wide">Cargando detalle de la orden...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 font-sans text-foreground">
        <div className="text-xs font-mono text-foreground-muted font-medium flex items-center gap-1.5 uppercase tracking-wider">
          <button
            type="button"
            onClick={onBack}
            className="hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Despacho de Órdenes
          </button>
        </div>

        <div className="p-8 bg-error-muted border border-error/30 rounded-2xl text-error text-xs flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-error" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground font-sans">Error al cargar la orden</h3>
            <p className="text-foreground-muted font-sans">{error || "La orden solicitada no fue encontrada o no pertenece a su empresa."}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-mono font-bold text-foreground bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer"
            >
              Volver a Despacho de Órdenes
            </button>
            <button
              type="button"
              onClick={fetchDetail}
              className="px-4 py-2 text-xs font-mono font-bold text-primary-foreground bg-primary-button-bg hover:brightness-110 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { order, cliente, bicicleta, conceptos, resumen_financiero } = data;
  const estadoId = Number(order.estado_orden_id);
  const isHold = estadoId === 2 || String(order.estado_codigo || "").trim().toUpperCase() === "HOLD";
  const isListaEntrega = estadoId === 7;
  const isEntregada = estadoId === 8;

  const puedeImprimirFactura =
    (order.estado_codigo === "ENTREGADA" || estadoId === 8 || isEntregada) &&
    order.facturado === true;

  const activeServices = (data.servicios || conceptos?.filter((c) => c.tipo_concepto === "SERVICIO") || []).filter(
    (service) => service.activo !== false
  );

  const incompleteServices = activeServices.filter((service) => {
    const id = Number(service.estado_orden_servicio_id || service.estado_servicio_id || service.estado_id || 0);
    const code = String(
      service.estado_servicio_codigo ||
      service.estado_codigo ||
      service.estado ||
      ""
    ).trim().toUpperCase();
    const name = String(
      service.estado_servicio_nombre ||
      service.estado_nombre ||
      ""
    ).trim().toUpperCase();

    const isClosed =
      id === 3 || // 3 = COMPLETADO
      id === 4 || // 4 = CANCELADO
      ["COMPLETADO", "FINALIZADO", "CANCELADO", "ANULADO", "INACTIVO"].includes(code) ||
      ["COMPLETADO", "FINALIZADO", "CANCELADO", "ANULADO", "INACTIVO"].includes(name);

    return !isClosed;
  });

  const hasIncompleteServices = incompleteServices.length > 0;

  return (
    <div className="w-full flex flex-col space-y-6 font-sans text-foreground transition-colors animate-in fade-in duration-200 pb-12">
      {/* 1. Breadcrumb & Back Action */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-foreground-muted font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-foreground-muted hover:text-primary transition-colors cursor-pointer font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Despacho de Órdenes</span>
          </button>
          <span className="text-foreground-muted/60">/</span>
          <span className="text-foreground-secondary font-sans font-medium">Orden</span>
          <span className="text-foreground-muted/60">/</span>
          <span className="text-primary font-mono font-bold tracking-tight">{order.codigo_orden}</span>
        </div>
      </div>

      {/* Toast / Notification Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200 border font-mono ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 dark:text-emerald-300"
              : feedback.type === "error"
              ? "bg-error-muted border-error/30 text-error"
              : "bg-primary/10 border-primary/30 text-primary"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />}
            {feedback.type === "error" && <AlertCircle className="w-5 h-5 text-error shrink-0" />}
            {feedback.type === "info" && <Info className="w-5 h-5 text-primary shrink-0" />}
            <div>
              <span className="font-bold text-xs uppercase tracking-wider block font-mono">{feedback.title}</span>
              <span className="opacity-90 font-sans text-xs">{feedback.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-foreground-muted hover:text-foreground cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Main Order Header Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground font-mono tracking-tight">
                  {order.codigo_orden}
                </h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase tracking-wider"
                  style={{
                    backgroundColor: hexToRgba(order.prioridad_color || "#64748B", 0.15),
                    borderColor: hexToRgba(order.prioridad_color || "#64748B", 0.4),
                    color: order.prioridad_color || "inherit"
                  }}
                >
                  {order.prioridad_nombre}
                </span>

                {/* Dynamic Status Badge */}
                <WorkOrderStatusBadge name={order.estado_nombre} color={order.estado_color} />

                {isEntregada && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 uppercase tracking-wider">
                    <CheckCircle className="w-3 h-3" />
                    ORDEN ENTREGADA
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted mt-1 font-sans">
                Recepción: <strong className="text-foreground font-mono font-bold">{order.codigo_recepcion || "Sin Recepción"}</strong> • Ingreso: <span className="text-foreground-secondary font-mono">{formatDate(order.fecha_recepcion)}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons inside Header Card */}
          <div className="flex items-center gap-3">
            {/* Operational Actions when LISTA_ENTREGA */}
            {isListaEntrega && (
              <div className="flex flex-col items-start sm:items-end gap-2">
                <div className="flex items-center gap-2">
                  {/* Reabrir Reparación (Amber) */}
                  <button
                    type="button"
                    onClick={() => setReopenModalOpen(true)}
                    disabled={isReopening || isDelivering}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                    title="Reabrir orden para ajustes técnicos"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isReopening ? "animate-spin" : ""}`} />
                    <span>Reabrir Reparación</span>
                  </button>

                  {/* Entregar a Cliente (Emerald) */}
                  <button
                    type="button"
                    onClick={handleDeliverToCustomer}
                    disabled={isDelivering || isReopening || hasIncompleteServices || order.facturado}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      hasIncompleteServices
                        ? `La orden tiene ${incompleteServices.length} servicio(s) pendiente(s). Reabre la reparación y complétalo antes de entregar.`
                        : "Entregar orden y marcar como facturada"
                    }
                  >
                    {isDelivering ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>ENTREGAR A CLIENTE</span>
                  </button>
                </div>

                {hasIncompleteServices && (
                  <div className="text-[11px] text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>
                      La orden tiene {incompleteServices.length} servicio{incompleteServices.length === 1 ? "" : "s"} pendiente{incompleteServices.length === 1 ? "" : "s"}. Reabre la reparación y complétalo antes de entregar.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Print Actions when ENTREGADA & FACTURADA */}
            {puedeImprimirFactura && (
              <div className="flex items-center gap-2">
                {/* Botón 1: Imprimir A4 (PDF) */}
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-primary bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generar y descargar Factura en PDF (Formato A4)"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Generando A4...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 text-primary" />
                      <span>Imprimir A4</span>
                    </>
                  )}
                </button>

                {/* Botón 2: Ticket POS (80 mm) */}
                <button
                  type="button"
                  onClick={handleOpenPosTicket}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-950 dark:text-amber-950 bg-amber-400 hover:bg-amber-300 active:scale-95 border border-amber-300 rounded-xl transition-all cursor-pointer shadow-sm shadow-amber-400/20"
                  title="Abrir e imprimir Ticket en formato para impresora térmica POS (80 mm)"
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-950" />
                  <span>Ticket</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Operational metadata grid (5 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* 1. FECHA DE RECEPCIÓN */}
          <div className="flex items-center gap-2.5 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-foreground-muted block uppercase font-mono font-bold tracking-wider">Fecha de Recepción</span>
              <span className="text-foreground font-mono font-semibold truncate block">{formatDate(order.fecha_recepcion)}</span>
            </div>
          </div>

          {/* 2. INICIO DEL TRABAJO */}
          <div className="flex items-center gap-2.5 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <Wrench className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-foreground-muted block uppercase font-mono font-bold tracking-wider">Inicio del Trabajo</span>
              <span className="text-foreground font-mono font-semibold truncate block">{formatDate(order.fecha_inicio_trabajo)}</span>
            </div>
          </div>

          {/* 3. FINALIZACIÓN DEL TRABAJO */}
          <div className="flex items-center gap-2.5 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-foreground-muted block uppercase font-mono font-bold tracking-wider">Finalización del Trabajo</span>
              <span className="text-foreground font-mono font-semibold truncate block">{formatDate(order.fecha_finalizacion)}</span>
            </div>
          </div>

          {/* 4. TIEMPO DE TRABAJO */}
          <div className="flex items-center gap-2.5 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-foreground-muted block uppercase font-mono font-bold tracking-wider">Tiempo de Trabajo</span>
              <span className="text-foreground font-mono font-bold truncate block">{formatDuration(order.total_tiempo_transcurrido)}</span>
            </div>
          </div>

          {/* 5. MECÁNICO RESPONSABLE */}
          <div className="flex items-center gap-2.5 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-foreground-muted block uppercase font-mono font-bold tracking-wider">Mecánico Responsable</span>
              <span className="text-foreground font-sans font-bold truncate block">{order.mecanico_nombre || "No asignado"}</span>
              {order.mecanico_cargo && (
                <span className="text-[10px] text-foreground-muted truncate block font-sans font-normal">{order.mecanico_cargo}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Customer & Bicycle Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 text-foreground">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">Datos del Cliente</h2>
          </div>
          <div className="space-y-2.5 text-xs font-sans">
            <div className="flex justify-between items-start gap-2">
              <span className="text-foreground-muted">Nombre Completo:</span>
              <span className="font-bold text-foreground text-right">{cliente.nombre_completo}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Identificación / RNC:</span>
              <span className="font-mono font-medium text-foreground-secondary">{cliente.identificacion || "No registrada"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Teléfono:</span>
              <span className="font-mono font-medium text-foreground-secondary">{cliente.telefono || "No registrado"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Correo Electrónico:</span>
              <span className="text-foreground-secondary truncate max-w-[220px]">{cliente.correo || "No registrado"}</span>
            </div>
            {cliente.direccion && (
              <div className="flex justify-between items-start gap-2 pt-2 border-t border-border">
                <span className="text-foreground-muted">Dirección:</span>
                <span className="text-foreground-secondary text-right text-[11px] max-w-[240px]">{cliente.direccion}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bicycle Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3 text-foreground">
            <Bike className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">Datos de la Bicicleta</h2>
          </div>
          <div className="space-y-2.5 text-xs font-sans">
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Marca y Modelo:</span>
              <span className="font-bold text-foreground text-right">
                {bicicleta.marca} {bicicleta.modelo}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Año / Color:</span>
              <span className="text-foreground-secondary">
                {bicicleta.ano ? `Año ${bicicleta.ano}` : "Año S/R"} • {bicicleta.color || "Color S/R"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Número de Serie:</span>
              <span className="font-mono font-medium text-foreground-secondary">{bicicleta.numero_serie || "Sin serie registrada"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-foreground-muted">Código QR:</span>
              <span className="font-mono font-bold text-primary text-[11px]">{bicicleta.codigo_qr || "No generado"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inconsistency Warning (if any detected) */}
      {resumen_financiero.hay_inconsistencia_totales && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 dark:text-amber-400 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-foreground font-sans">Aviso Informativo de Cuadre Financiero</h4>
            <p className="text-foreground-secondary leading-relaxed font-sans">
              La suma calculada de los conceptos ({formatMoney(resumen_financiero.total_calculado_conceptos)})
              presenta una diferencia con el total liquidado de la orden ({formatMoney(resumen_financiero.total_orden)}).
            </p>
          </div>
        </div>
      )}

      {/* 4. Billable Concepts Table (Servicios y Repuestos) */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-0">
        <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
              Conceptos de la Orden ({conceptos.length} ítems)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-foreground-muted">
            Valores persistidos en base de datos
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface border-b border-border text-foreground-muted font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Descripción del Concepto</th>
                <th className="py-3 px-4 text-center">Cant.</th>
                <th className="py-3 px-4 text-right">Precio Unitario</th>
                <th className="py-3 px-4 text-right">Descuento</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {conceptos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-foreground-muted font-sans font-medium">
                    No hay servicios ni repuestos registrados en esta orden.
                  </td>
                </tr>
              ) : (
                conceptos.map((item, idx) => {
                  const isService = item.tipo_concepto === "SERVICIO";
                  return (
                    <tr key={`${item.tipo_concepto}-${item.item_id || idx}`} className="hover:bg-hover transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-foreground-muted text-[11px]">
                        {item.codigo}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            isService
                              ? "bg-primary/10 text-primary border border-primary/30"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                          }`}
                        >
                          {isService ? <Wrench className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                          {item.tipo_concepto}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="font-bold text-foreground block">{item.descripcion}</span>
                        {item.notas && <span className="text-[11px] text-foreground-muted block mt-0.5">{item.notas}</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-foreground">
                        {item.cantidad}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground-secondary">
                        {formatMoney(item.precio_unitario)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground-muted">
                        {parseFloat(item.descuento || 0) > 0 ? (
                          <span className="text-amber-500 font-semibold">-{formatMoney(item.descuento)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-foreground">
                        {formatMoney(item.subtotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Status Information & Financial Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Status / Delivery Information Card */}
        <div className="md:col-span-7">
          {isEntregada ? (
            /* Case 1: ENTREGADA */
            <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2.5 text-emerald-500 text-xs font-mono font-bold uppercase tracking-wider">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span>ORDEN ENTREGADA Y FACTURADA</span>
              </div>
              <p className="text-xs text-foreground-secondary leading-relaxed font-sans">
                La orden fue entregada al cliente y marcada como facturada en el sistema. Todos los conceptos han sido liquidados.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border text-xs font-sans">
                <div>
                  <span className="text-foreground-muted text-[11px] block">Entregada y facturada por:</span>
                  <span className="font-bold text-foreground">{order.usuario_facturacion_nombre || order.mecanico_nombre || "Usuario del Sistema"}</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[11px] block">Fecha de Facturación:</span>
                  <span className="font-mono font-semibold text-foreground">{formatDate(order.fecha_facturacion)}</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[11px] block">Fecha de Entrega:</span>
                  <span className="font-mono font-semibold text-foreground">{formatDate(order.fecha_entrega)}</span>
                </div>
              </div>
            </div>
          ) : isListaEntrega ? (
            /* Case 2: LISTA_ENTREGA */
            <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-500 text-xs font-mono font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-5 h-5" />
                  <span>ORDEN LISTA PARA ENTREGA</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-md text-[10px] font-mono font-bold uppercase">
                  Operativa
                </span>
              </div>
              <p className="text-xs text-foreground-secondary leading-relaxed font-sans">
                Todos los servicios y repuestos han sido completados y validados. Utilice los controles en la cabecera superior para procesar la entrega al cliente o reabrir la orden en caso de requerir ajustes técnicos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border text-xs font-sans">
                <div>
                  <span className="text-foreground-muted text-[11px] block">Mecánico Responsable:</span>
                  <span className="font-bold text-foreground">{order.mecanico_nombre || "No asignado"}</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[11px] block">Conceptos Registrados:</span>
                  <span className="font-bold text-foreground font-mono">{conceptos.length} ítem(s)</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[11px] block">Fecha de Recepción:</span>
                  <span className="font-mono font-semibold text-foreground">{formatDate(order.fecha_recepcion)}</span>
                </div>
              </div>
            </div>
          ) : isHold ? (
            /* Case 3: HOLD */
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-sm">
              <div
                className="flex items-center gap-2.5 text-xs font-mono font-bold uppercase tracking-wider"
                style={{ color: order.estado_color || "inherit" }}
              >
                <Clock className="w-4 h-4" style={{ color: order.estado_color || "inherit" }} />
                <span>ORDEN EN ESTADO: {order.estado_nombre?.toUpperCase() || "EN HOLD"}</span>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border">
                <span className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-wider block">
                  Motivo de Hold:
                </span>
                <p className="text-xs text-foreground font-sans font-medium leading-relaxed">
                  {order.motivo_hold || "Sin motivo registrado."}
                </p>
                {(order.fecha_hold || order.usuario_hold_nombre) && (
                  <div className="text-[11px] text-foreground-muted pt-1 flex flex-wrap items-center gap-1.5 font-sans">
                    <span>Puesto en Hold:</span>
                    <span className="font-mono text-foreground-secondary">
                      {formatDate(order.fecha_hold)}
                    </span>
                    {order.usuario_hold_nombre && (
                      <>
                        <span className="text-foreground-muted/60">·</span>
                        <span className="font-semibold text-foreground-secondary">
                          {order.usuario_hold_nombre}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Case 4: RECIBIDA / REPARACION / OTROS */
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
              <div
                className="flex items-center gap-2.5 text-xs font-mono font-bold uppercase tracking-wider"
                style={{ color: order.estado_color || "inherit" }}
              >
                <Clock className="w-4 h-4" style={{ color: order.estado_color || "inherit" }} />
                <span>ORDEN EN ESTADO: {order.estado_nombre?.toUpperCase()}</span>
              </div>
              <p className="text-xs text-foreground-muted leading-relaxed font-sans">
                Esta orden se encuentra en fase operativa técnica. La entrega y facturación estarán disponibles una vez completados todos los trabajos y la orden pase a Lista para Entrega.
              </p>
            </div>
          )}
        </div>

        {/* Financial Breakdown Card */}
        <div className="md:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-sm font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
              Resumen Financiero
            </h3>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>

          <div className="space-y-2.5 text-foreground">
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted font-sans">Subtotal Servicios:</span>
              <span className="font-bold text-foreground">{formatMoney(resumen_financiero.subtotal_servicios)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted font-sans">Subtotal Repuestos:</span>
              <span className="font-bold text-foreground">{formatMoney(resumen_financiero.subtotal_repuestos)}</span>
            </div>
            {parseFloat(resumen_financiero.descuento_total || 0) > 0 && (
              <div className="flex justify-between items-center text-amber-500">
                <span className="font-sans">Descuento Total:</span>
                <span className="font-bold">-{formatMoney(resumen_financiero.descuento_total)}</span>
              </div>
            )}
            {parseFloat(resumen_financiero.impuesto || 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted font-sans">Impuestos (ITBIS):</span>
                <span className="font-bold text-foreground">{formatMoney(resumen_financiero.impuesto)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-between items-center text-sm">
              <span className="font-bold text-foreground font-sans uppercase tracking-wider">Total General:</span>
              <span className="text-base font-mono font-black text-primary">
                {formatMoney(resumen_financiero.total_orden)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reopen Repair Confirmation Modal (Rendered in Portal) */}
      {reopenModalOpen && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-modal-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReopenModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-[540px] min-w-[320px] max-h-[calc(100vh-32px)] overflow-y-auto bg-card border border-border rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5 text-amber-500">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <h3 id="reopen-modal-title" className="font-mono font-bold text-base text-foreground uppercase tracking-wider whitespace-nowrap">
                  Reabrir reparación
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalOpen(false)}
                className="text-foreground-muted hover:text-foreground p-1.5 rounded-lg hover:bg-hover transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Confirmation Message */}
            <p className="text-sm text-foreground-secondary leading-relaxed font-sans">
              ¿Deseas devolver la orden{" "}
              <strong className="font-mono text-amber-500 font-bold whitespace-nowrap">
                {order?.codigo_orden}
              </strong>{" "}
              al estado <strong className="text-foreground font-bold font-sans">En reparación</strong> para realizar correcciones o trabajos técnicos adicionales?
            </p>

            {/* Reason Field */}
            <div className="space-y-1.5 font-sans">
              <label htmlFor="reopen-reason-input" className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-wider block">
                Motivo de la reapertura (opcional)
              </label>
              <textarea
                id="reopen-reason-input"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Describe el motivo de la reapertura..."
                rows={4}
                className="w-full min-h-[100px] bg-input border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-foreground-muted font-mono focus:outline-none focus:border-primary transition-all resize-y"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReopenModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-mono font-bold text-foreground-muted hover:text-foreground bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReopenRepair}
                disabled={isReopening}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md shadow-amber-400/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReopening ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-950" />
                    <span>Reabriendo...</span>
                  </>
                ) : (
                  <span>Confirmar reapertura</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
