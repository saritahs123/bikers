"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Receipt,
  DollarSign,
  ExternalLink,
  User,
  Wrench,
  Bike,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  Loader2,
  Ban,
  PackageCheck,
  HelpCircle,
  Info
} from "lucide-react";
import {
  generateInvoiceModel1Pdf,
  generateInvoiceModel2Pdf,
  downloadInvoicePdf
} from "@/lib/billing/billingPdfService";
import RegisterPaymentModal from "./RegisterPaymentModal";

export default function InvoiceDetailModal({
  isOpen,
  onClose,
  facturaId,
  onInvoiceUpdated,
  permisos
}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados de impresión directa
  const [isPrintingA4, setIsPrintingA4] = useState(false);
  const [isPrintingTicket, setIsPrintingTicket] = useState(false);

  // Modales secundarios
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // FAC-6.1: Catálogo de Motivos de Anulación y Reglas de Inventario
  const [motivosList, setMotivosList] = useState([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [motivosError, setMotivosError] = useState(null);
  const [selectedMotivoId, setSelectedMotivoId] = useState("");
  const [cancelObservation, setCancelObservation] = useState("");
  const [destinoProducto, setDestinoProducto] = useState("DISPONIBLE");

  const fetchMotivosAnulacion = React.useCallback(async () => {
    try {
      setLoadingMotivos(true);
      setMotivosError(null);
      const res = await fetch("/api/facturacion/motivos-anulacion");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "No se pudieron cargar los motivos de anulación.");
      }
      const rawList = Array.isArray(json.data)
        ? json.data
        : (json.motivos || json.data?.motivos || []);
      setMotivosList(rawList);
    } catch (err) {
      console.error("Error al cargar catálogo de motivos de anulación:", err);
      setMotivosError(err.message || "No se pudieron cargar los motivos de anulación.");
      setMotivosList([]);
    } finally {
      setLoadingMotivos(false);
    }
  }, []);

  const openCancelModal = () => {
    setCancelError(null);
    setMotivosError(null);
    setSelectedMotivoId("");
    setCancelObservation("");
    setDestinoProducto("DISPONIBLE");
    setIsHelpModalOpen(false);
    setIsCancelModalOpen(true);
    fetchMotivosAnulacion();
  };

  const getFullInvoiceDataForPrint = async () => {
    if (data && data.factura && Number(data.factura.factura_id) === Number(facturaId)) {
      return data;
    }
    const res = await fetch(`/api/facturacion/facturas/${facturaId}`);
    const json = await res.json();
    if (!res.ok || !json.data) {
      throw new Error(json.message || json.error || "No se pudo cargar la información de la factura.");
    }
    return json.data;
  };

  const handlePrintA4 = async () => {
    try {
      setIsPrintingA4(true);
      const printData = await getFullInvoiceDataForPrint();
      const doc = generateInvoiceModel1Pdf(printData);
      const codigo = printData.factura?.codigo_factura || printData.factura?.numero_factura || `FAC-${facturaId}`;
      downloadInvoicePdf(doc, `Factura_${codigo}.pdf`);
    } catch (err) {
      console.error("Error al generar PDF A4:", err);
      alert("Error al generar Factura A4: " + (err.message || "Error desconocido"));
    } finally {
      setIsPrintingA4(false);
    }
  };

  const handlePrintTicket = async () => {
    try {
      setIsPrintingTicket(true);
      const printData = await getFullInvoiceDataForPrint();
      const doc = generateInvoiceModel2Pdf(printData);
      const codigo = printData.factura?.codigo_factura || printData.factura?.numero_factura || `FAC-${facturaId}`;
      downloadInvoicePdf(doc, `Ticket_${codigo}.pdf`);
    } catch (err) {
      console.error("Error al generar Ticket POS:", err);
      alert("Error al generar Ticket POS: " + (err.message || "Error desconocido"));
    } finally {
      setIsPrintingTicket(false);
    }
  };

  const fetchDetail = React.useCallback(async () => {
    if (!facturaId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/facturacion/facturas/${facturaId}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.details
            ? `${json.message || "Error al cargar la factura"}: ${json.details}`
            : (json.message || json.error || "No se pudo cargar el detalle de la factura.")
        );
      }

      setData(json.data);
    } catch (err) {
      console.error("Error fetching invoice detail:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [facturaId]);

  useEffect(() => {
    if (!isOpen || !facturaId) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        fetchDetail();
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, facturaId, fetchDetail]);

  if (!isOpen) return null;

  const factura = data?.factura;
  const cliente = data?.cliente;
  const ordenTrabajo = data?.orden_trabajo;
  const detalle = data?.detalle || [];
  const pagos = data?.pagos || [];
  const anulacion = data?.anulacion;

  // FAC-6.1 / FIX-FAC-CANCEL-HELP-1: Clasificación de líneas de factura para cálculo de efecto de inventario
  const isItemServicio = (item) => {
    const tipo = String(item?.tipo_linea || "").toUpperCase();
    return tipo === "SERVICIO" || !!item?.servicio_id || !!item?.tipo_servicio_id || !!item?.orden_servicio_id;
  };

  const isItemRepuestoOT = (item) => {
    if (isItemServicio(item)) return false;
    const tipo = String(item?.tipo_linea || "").toUpperCase();
    return (
      tipo === "REPUESTO" ||
      !!item?.orden_producto_id ||
      (Boolean(factura?.orden_trabajo_id) && tipo !== "PRODUCTO")
    );
  };

  // Líneas físicas de venta comercial directa (generaron SAL_VENTA y pueden generar DEV_VENTA)
  const lineasComerciales = detalle.filter(
    (item) =>
      !isItemServicio(item) &&
      !isItemRepuestoOT(item) &&
      (!!item?.producto_id || String(item?.tipo_linea || "").toUpperCase() === "PRODUCTO")
  );

  const totalUnidadesComerciales = lineasComerciales.reduce(
    (acc, item) => acc + Number(item?.cantidad || 0),
    0
  );

  const tieneServicios = detalle.some(isItemServicio);
  const tieneRepuestosOT = detalle.some(isItemRepuestoOT);
  const esFacturaExclusivaServiciosOT =
    detalle.length > 0 && lineasComerciales.length === 0 && (tieneServicios || tieneRepuestosOT);

  const selectedMotivo = motivosList.find(
    (m) => String(m.motivo_anulacion_factura_id) === String(selectedMotivoId)
  );

  const codMotivo = String(selectedMotivo?.codigo || "").toUpperCase();
  const nombreMotivo = String(selectedMotivo?.motivo_anulacion || "").toLowerCase();

  const esCambioFormaPago =
    codMotivo === "CAMBIO_FORMA_PAGO" ||
    nombreMotivo.includes("cambio de forma de pago") ||
    nombreMotivo.includes("forma de pago");

  const esFacturaDuplicada =
    codMotivo === "FACTURA_DUPLICADA" ||
    nombreMotivo.includes("duplicada") ||
    nombreMotivo.includes("duplicado");

  const esAjusteAdministrativo =
    codMotivo === "AJUSTE_ADMINISTRATIVO" ||
    codMotivo === "AJUSTE_FISCAL" ||
    nombreMotivo.includes("ajuste administrativo") ||
    nombreMotivo.includes("ajuste fiscal");

  const esMotivoSinMovimiento =
    esCambioFormaPago ||
    esFacturaDuplicada ||
    esAjusteAdministrativo ||
    nombreMotivo.includes("sin movimiento") ||
    selectedMotivo?.genera_movimiento === false ||
    selectedMotivo?.genera_movimiento === "false";

  const motivoGeneraMovimiento = Boolean(
    selectedMotivo &&
    !esMotivoSinMovimiento &&
    selectedMotivo.genera_movimiento !== false &&
    selectedMotivo.genera_movimiento !== "false" &&
    selectedMotivo.genera_movimiento !== 0
  );

  const mostrarDestinoProducto = Boolean(motivoGeneraMovimiento && lineasComerciales.length > 0);

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (estado) => {
    const est = (estado || "").toUpperCase();
    switch (est) {
      case "PAGADA":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAGADA
          </span>
        );
      case "PARCIAL":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            PARCIAL
          </span>
        );
      case "PENDIENTE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            PENDIENTE
          </span>
        );
      case "BORRADOR":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-surface border border-border text-foreground-muted inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            BORRADOR
          </span>
        );
      case "ANULADA":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-error-muted text-error border border-error/30 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            ANULADA
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-surface border border-border text-foreground-secondary">
            {est || "DESCONOCIDO"}
          </span>
        );
    }
  };

  const puedeRegistrarPago =
    factura &&
    factura.estado !== "PAGADA" &&
    factura.estado !== "ANULADA" &&
    Number(factura.balance_pendiente) > 0;

  const effectivePerms = data?.permisos || permisos;
  const puedeAnular =
    factura &&
    factura.estado !== "ANULADA" &&
    (!effectivePerms || effectivePerms.puede_eliminar || effectivePerms.puede_inactivar || effectivePerms.puede_editar);

  const handlePaymentSuccess = (result) => {
    if (result && result.factura) {
      // Actualizamos estado local
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          factura: {
            ...prev.factura,
            monto_pagado: result.factura.monto_pagado,
            balance_pendiente: result.factura.balance_pendiente,
            estado: result.factura.estado
          },
          pagos: result.pago ? [...prev.pagos, result.pago] : prev.pagos
        };
      });
      if (onInvoiceUpdated) {
        onInvoiceUpdated(result.factura);
      }
    }
  };

  const handleConfirmCancel = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMotivoId) {
      setCancelError("Debe seleccionar un motivo de anulación del catálogo.");
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError(null);

      const res = await fetch(`/api/facturacion/facturas/${facturaId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo_anulacion_factura_id: Number(selectedMotivoId),
          observacion: cancelObservation.trim() || undefined,
          destino_producto: destinoProducto
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.details
            ? `${json.message || "Error al anular la factura"}: ${json.details}`
            : (json.message || json.error || "No se pudo anular la factura.")
        );
      }

      setIsCancelModalOpen(false);
      setSelectedMotivoId("");
      setCancelObservation("");
      setDestinoProducto("DISPONIBLE");
      setIsHelpModalOpen(false);
      await fetchDetail();
      if (onInvoiceUpdated) {
        onInvoiceUpdated(json.data);
      }
    } catch (err) {
      console.error("Error al anular la factura:", err);
      setCancelError(err.message || "Error al procesar la anulación de la factura.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] transition-colors">
          {/* 1. Modal Top Bar */}
          <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-foreground font-mono tracking-tight">
                    {factura?.codigo_factura || "Factura"}
                  </h2>
                  {factura && getStatusBadge(factura.estado)}
                  {factura && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface border border-border text-foreground-secondary uppercase">
                      {factura.tipo_factura_nombre || (factura.orden_trabajo_id ? "ORDEN DE TRABAJO" : "VENTA DIRECTA")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted font-mono mt-0.5">
                  Fecha de emisión: {factura ? formatDate(factura.fecha_factura) : "—"} • Registrado por: {factura?.usuario_creacion_nombre || "Sistema"}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {factura && (
                <>
                  <button
                    type="button"
                    onClick={handlePrintA4}
                    disabled={isPrintingA4}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-primary bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title="Imprimir Factura Estándar A4"
                  >
                    {isPrintingA4 ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary" />
                    )}
                    <span>Imprimir A4</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintTicket}
                    disabled={isPrintingTicket}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title="Imprimir Ticket POS Térmico (80mm)"
                  >
                    {isPrintingTicket ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>Imprimir Ticket</span>
                  </button>
                </>
              )}

              {puedeRegistrarPago && (
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  title="Registrar nuevo pago a la factura"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Registrar Pago</span>
                </button>
              )}

              {puedeAnular && (
                <button
                  type="button"
                  onClick={openCancelModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                  title="Anular Factura y Revertir Salidas de Inventario"
                >
                  <Ban className="w-4 h-4" />
                  <span className="hidden sm:inline">Anular Factura</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
            {isLoading && (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-foreground-muted">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-mono font-bold">Cargando información de la factura...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-error-muted border border-error/30 rounded-xl text-error text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!isLoading && !error && factura && (
              <>
                {/* Banner de Factura Anulada (FAC-6.1 Snapshot y Trazabilidad Histórica) */}
                {/* Banner de Factura Anulada (Auditoría y Trazabilidad Histórica Inmutable) */}
                {factura.estado === "ANULADA" && (() => {
                  const isIncompleta = !anulacion || anulacion.estado_auditoria === "AUDITORIA_ANULACION_INCOMPLETA";
                  const generaMov = Boolean(anulacion?.genera_movimiento ?? anulacion?.genera_movimiento_snapshot);
                  const movCodigo = anulacion?.movimiento_codigo || anulacion?.tipo_movimiento_codigo_snapshot || (generaMov ? "DEV_VENTA" : null);
                  const cantRevertida = Number(anulacion?.cantidad_revertida || 0);

                  return (
                    <div className="p-4 rounded-xl bg-error-muted/30 border border-error/40 text-error space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono font-bold text-sm">
                          <AlertTriangle className="w-4 h-4 text-error shrink-0" />
                          <span>ESTA FACTURA HA SIDO ANULADA</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-error/20 border border-error/30 text-error uppercase">
                          {isIncompleta
                            ? "AUDITORÍA INCOMPLETA"
                            : generaMov
                            ? (movCodigo || "DEV_VENTA")
                            : "SIN MOVIMIENTO"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-3 border-t border-error/20">
                        {/* 1. Motivo */}
                        <div>
                          <span className="text-foreground-muted block text-[10px] uppercase font-bold">Motivo:</span>
                          <span className="font-semibold text-foreground">
                            {anulacion?.motivo || anulacion?.motivo_snapshot || factura.motivo_anulacion || "Sin motivo especificado"}
                          </span>
                          {(anulacion?.descripcion_motivo || anulacion?.motivo_descripcion_snapshot) && (
                            <p className="text-[10px] text-foreground-muted font-sans mt-0.5">
                              {anulacion.descripcion_motivo || anulacion.motivo_descripcion_snapshot}
                            </p>
                          )}
                        </div>

                        {/* 2. Efecto Inventario */}
                        <div>
                          <span className="text-foreground-muted block text-[10px] uppercase font-bold">Efecto inventario:</span>
                          <span className="font-semibold text-foreground">
                            {isIncompleta
                              ? "Auditoría incompleta"
                              : generaMov
                              ? "Reverso físico aplicado"
                              : "Sin movimiento de inventario"}
                          </span>
                          <span className="text-[10px] text-foreground-muted block mt-0.5">
                            {isIncompleta
                              ? "Sin snapshot histórico registrado"
                              : generaMov
                              ? `Movimiento: ${movCodigo || "DEV_VENTA"}`
                              : "Movimiento: Sin movimiento"}
                          </span>
                        </div>

                        {/* 3. Destino y Cantidad */}
                        <div>
                          <span className="text-foreground-muted block text-[10px] uppercase font-bold">Destino producto:</span>
                          <span className="font-semibold text-foreground">
                            {isIncompleta
                              ? "No registrado"
                              : generaMov
                              ? (anulacion?.destino_producto || "DISPONIBLE")
                              : "No aplica"}
                          </span>
                          {!isIncompleta && generaMov && (
                            <span className="text-[10px] text-foreground-muted block mt-0.5">
                              Cantidad: <strong className="text-foreground font-mono">{cantRevertida > 0 ? cantRevertida : 1}</strong>
                            </span>
                          )}
                          {anulacion?.usuario_autorizacion_nombre && (
                            <span className="text-[10px] text-foreground-muted block mt-0.5">
                              Autorizado por: <strong className="text-foreground font-sans">{anulacion.usuario_autorizacion_nombre}</strong>
                            </span>
                          )}
                        </div>

                        {/* 4. Trazabilidad */}
                        <div>
                          <span className="text-foreground-muted block text-[10px] uppercase font-bold">Trazabilidad:</span>
                          <span className="text-foreground block">
                            Por: <strong className="font-sans">
                              {anulacion?.usuario || anulacion?.usuario_anulacion_nombre || factura.usuario_anulacion_nombre || "Sistema"}
                            </strong>
                          </span>
                          <span className="text-[10px] text-foreground-muted block mt-0.5">
                            {formatDateTime(anulacion?.fecha || anulacion?.fecha_anulacion || factura.fecha_anulacion)}
                          </span>
                        </div>

                        {anulacion?.observacion && (
                          <div className="col-span-1 sm:col-span-2 md:col-span-4 bg-surface/60 p-2.5 rounded-lg border border-border/60 text-foreground">
                            <span className="text-foreground-muted block text-[10px] uppercase font-bold font-mono">Observación registrada:</span>
                            <p className="text-xs font-sans mt-0.5 italic">{anulacion.observacion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 2.1 Info Cards: Cliente & OT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card Cliente */}
                  <div className="p-4 rounded-xl border border-border bg-surface/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-foreground border-b border-border pb-2 uppercase tracking-wider">
                      <User className="w-4 h-4 text-primary" />
                      <span>Datos del Cliente</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Nombre:</span>
                        <strong className="text-foreground font-sans">
                          {cliente?.nombre_completo || "Cliente General"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Identificación / RNC:</span>
                        <span className="text-foreground font-mono">
                          {cliente?.identificacion || "No registrada"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Teléfono:</span>
                        <span className="text-foreground font-mono">
                          {cliente?.telefono_principal || "No registrado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Correo:</span>
                        <span className="text-foreground font-sans truncate block">
                          {cliente?.correo || "No registrado"}
                        </span>
                      </div>
                      {cliente?.direccion && (
                        <div className="col-span-2">
                          <span className="text-foreground-muted block text-[11px]">Dirección:</span>
                          <span className="text-foreground font-sans text-xs">
                            {cliente.direccion}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Origen / Orden de Trabajo */}
                  <div className="p-4 rounded-xl border border-border bg-surface/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                        <Wrench className="w-4 h-4 text-primary" />
                        <span>Origen de la Factura</span>
                      </div>
                      {ordenTrabajo && (
                        <Link
                          href={`/workshop?view=work_orders&order_id=${ordenTrabajo.orden_trabajo_id}`}
                          className="text-[11px] font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          title="Ir al detalle de la Orden en el Módulo de Taller"
                        >
                          <span>Ver Orden de Trabajo</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    {ordenTrabajo ? (
                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-muted text-[11px]">Código Orden:</span>
                          <span className="font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-xs">
                            {ordenTrabajo.codigo_orden}
                          </span>
                        </div>
                        {ordenTrabajo.bicicleta && (
                          <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                            <Bike className="w-4 h-4 text-foreground-muted shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <span className="font-bold text-foreground block">
                                {[ordenTrabajo.bicicleta.marca, ordenTrabajo.bicicleta.modelo].filter(Boolean).join(" ") || "Bicicleta"}
                              </span>
                              <span className="text-[11px] text-foreground-muted block font-mono">
                                Año: {ordenTrabajo.bicicleta.ano || "—"} • Color: {ordenTrabajo.bicicleta.color || "—"}
                              </span>
                              {ordenTrabajo.bicicleta.numero_serie_cuadro && (
                                <span className="text-[10px] text-foreground-muted block font-mono">
                                  Serie: {ordenTrabajo.bicicleta.numero_serie_cuadro}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-foreground-muted pt-1">
                          <span>Estado Taller:</span>
                          <span className="font-mono font-medium text-foreground">
                            {ordenTrabajo.estado_nombre || "Finalizada"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-3 flex flex-col items-start gap-1">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                          VENTA DIRECTA
                        </span>
                        <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                          Factura emitida directamente desde el catálogo de productos y tienda general. No vinculada a orden de reparación.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2.2 Detalle de Líneas (Snapshot Histórico) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary">
                      Detalle de Conceptos Facturados ({detalle.length})
                    </h3>
                    <span className="text-[11px] text-foreground-muted font-mono">
                      Snapshot de emisión original
                    </span>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface/80 border-b border-border text-foreground-muted font-mono uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Código</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-4">Descripción</th>
                            <th className="py-2.5 px-3 text-center">Cant.</th>
                            <th className="py-2.5 px-3 text-right">Precio</th>
                            <th className="py-2.5 px-3 text-right">Descuento</th>
                            <th className="py-2.5 px-4 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          {detalle.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-foreground-muted font-mono">
                                Sin líneas registradas en esta factura.
                              </td>
                            </tr>
                          ) : (
                            detalle.map((item, idx) => {
                              const isService = item.tipo_linea === "SERVICIO";
                              const isRepuesto = item.tipo_linea === "REPUESTO";

                              return (
                                <tr key={item.detalle_factura_id || idx} className="hover:bg-hover/50 transition-colors">
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-foreground-secondary">
                                    {item.codigo || "—"}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                        isService
                                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                          : isRepuesto
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                      }`}
                                    >
                                      {item.tipo_linea}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-foreground font-medium">
                                    {item.descripcion}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-foreground-secondary">
                                    {Number(item.cantidad).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-foreground-secondary">
                                    {formatMoney(item.precio_unitario)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-foreground-muted">
                                    {Number(item.descuento) > 0 ? `-${formatMoney(item.descuento)}` : "—"}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
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
                </div>

                {/* 2.3 Pagos & Totales */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                  {/* Historial de Pagos (7 cols) */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Historial de Pagos ({pagos.length})</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {factura.estado === "ANULADA" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                            Factura anulada • Pagos históricos conservados
                          </span>
                        )}
                        {puedeRegistrarPago && (
                          <button
                            type="button"
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                          >
                            + Agregar pago
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface/80 border-b border-border text-foreground-muted font-mono uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Fecha</th>
                            <th className="py-2 px-3">Tipo</th>
                            <th className="py-2 px-3">Referencia</th>
                            <th className="py-2 px-3 text-right">Monto</th>
                            <th className="py-2 px-3">Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono text-[11px]">
                          {pagos.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-foreground-muted font-sans italic">
                                Sin pagos registrados
                              </td>
                            </tr>
                          ) : (
                            pagos.map((p, idx) => (
                              <tr key={p.pago_id || idx} className="hover:bg-hover/50">
                                <td className="py-2.5 px-3 text-foreground-secondary">
                                  {formatDateTime(p.fecha_pago)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-foreground">
                                    {p.tipo_pago_nombre || p.tipo_pago_codigo}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-foreground-muted">
                                  {p.referencia || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatMoney(p.monto)}
                                </td>
                                <td className="py-2.5 px-3 text-foreground-muted text-[10px] font-sans">
                                  {p.usuario_nombre || "Sistema"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Resumen Financiero (5 cols) */}
                  <div className="lg:col-span-5 p-4 rounded-xl border border-border bg-surface/40 space-y-2.5">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary border-b border-border pb-2">
                      Resumen Financiero
                    </h3>

                    <div className="space-y-1.5 text-xs font-sans">
                      <div className="flex items-center justify-between text-foreground-secondary">
                        <span>Subtotal:</span>
                        <span className="font-mono font-medium">{formatMoney(factura.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-foreground-secondary">
                        <span>Descuento:</span>
                        <span className="font-mono font-medium text-foreground-muted">
                          {Number(factura.descuento) > 0 ? `-${formatMoney(factura.descuento)}` : "RD$ 0.00"}
                        </span>
                      </div>
                      {Number(factura.impuesto) > 0 && (
                        <div className="flex items-center justify-between text-foreground-secondary">
                          <span>Impuesto (ITBIS):</span>
                          <span className="font-mono font-medium">{formatMoney(factura.impuesto)}</span>
                        </div>
                      )}

                      <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-bold">
                        <span className="text-foreground">Total Factura:</span>
                        <span className="font-mono text-primary text-base">
                          {formatMoney(factura.total)}
                        </span>
                      </div>

                      <div className="border-t border-dashed border-border/80 pt-2 flex items-center justify-between">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Total Pagado:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(factura.monto_pagado)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-foreground-secondary font-medium">Balance Pendiente:</span>
                        <span
                          className={`font-mono font-bold ${
                            Number(factura.balance_pendiente) > 0
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-foreground-muted"
                          }`}
                        >
                          {formatMoney(factura.balance_pendiente)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Modal Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-surface/40 shrink-0">
            <span className="text-[11px] text-foreground-muted font-mono">
              Ride Lab Facturación • {factura?.empresa_id ? `Empresa #${factura.empresa_id}` : ""}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Registro de pagos */}
      {isPaymentModalOpen && factura && (
        <RegisterPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          factura={factura}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Modal de Confirmación de Anulación (FAC-6.1) */}
      {isCancelModalOpen && factura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-rose-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                  <Ban className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground font-mono">
                    Anular Factura
                  </h3>
                  <p className="text-xs text-foreground-muted font-mono">
                    {factura.codigo_factura} • Esta acción es destructiva e irreversible
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isCancelling && setIsCancelModalOpen(false)}
                disabled={isCancelling}
                className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmCancel} className="p-5 space-y-4">
              {/* Resumen: Factura que se anulará */}
              <div className="p-3.5 rounded-xl border border-border bg-surface/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-foreground-muted block text-[10px]">Factura:</span>
                  <strong className="text-foreground">{factura.codigo_factura}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Total:</span>
                  <strong className="text-foreground">{formatMoney(factura.total)}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Estado:</span>
                  <span className="text-foreground font-bold">{factura.estado}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Tipo:</span>
                  <span className="text-foreground">
                    {factura.tipo_factura_nombre || (factura.orden_trabajo_id ? "Orden de Trabajo" : "Venta Directa")}
                  </span>
                </div>
              </div>

              {/* Advertencia de Pagos Registrados */}
              {Number(factura.monto_pagado || 0) > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Atención con los cobros registrados:</p>
                    <p className="text-[11px] leading-relaxed">
                      La anulación no registra automáticamente una devolución de dinero. Los pagos aplicados ({formatMoney(factura.monto_pagado)}) permanecerán en el historial financiero como evidencia contable.
                    </p>
                  </div>
                </div>
              )}

              {/* Motivo de anulación (SELECT OBLIGATORIO) con Botón de Ayuda */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-mono font-bold text-foreground uppercase">
                    Motivo de anulación <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsHelpModalOpen(true)}
                    title="Ver ayuda sobre anulación de factura e inventario"
                    aria-label="Ver ayuda sobre anulación de factura"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-lg bg-surface hover:bg-hover text-foreground-muted hover:text-foreground border border-border transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>¿Cómo funciona?</span>
                  </button>
                </div>

                {loadingMotivos ? (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-foreground-muted bg-surface rounded-xl border border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Cargando motivos...</span>
                  </div>
                ) : motivosError ? (
                  <div className="p-3 bg-error-muted/40 border border-error/30 rounded-xl text-error text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{motivosError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchMotivosAnulacion}
                      className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase rounded-lg bg-surface border border-border hover:bg-hover text-foreground transition-colors cursor-pointer"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : motivosList.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No existen motivos de anulación activos configurados.</span>
                  </div>
                ) : (
                  <select
                    value={selectedMotivoId}
                    onChange={(e) => {
                      setSelectedMotivoId(e.target.value);
                      if (cancelError) setCancelError(null);
                    }}
                    disabled={isCancelling}
                    className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all text-foreground cursor-pointer"
                    autoFocus
                  >
                    <option value="">-- Seleccione un motivo del catálogo --</option>
                    {motivosList.map((m) => (
                      <option key={m.motivo_anulacion_factura_id} value={m.motivo_anulacion_factura_id}>
                        {m.motivo_anulacion}
                      </option>
                    ))}
                  </select>
                )}
                {selectedMotivo?.descripcion && (
                  <p className="text-[11px] text-foreground-muted mt-1 font-sans">
                    {selectedMotivo.descripcion}
                  </p>
                )}
              </div>

              {/* Advertencia Especial para CAMBIO_FORMA_PAGO */}
              {selectedMotivo?.codigo === "CAMBIO_FORMA_PAGO" && (
                <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Advertencia importante para cambio de pago:</p>
                    <p className="text-[11px] leading-relaxed">
                      Para corregir únicamente la forma de pago se recomienda corregir o revertir el pago sin anular la factura.
                    </p>
                  </div>
                </div>
              )}

              {/* Panel Informativo: Efecto sobre Inventario (Dinámico según motivo) */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-surface/70 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-mono font-bold text-foreground text-[11px] uppercase tracking-wide">
                  <PackageCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>EFECTO SOBRE INVENTARIO</span>
                </div>

                {!selectedMotivo ? (
                  <p className="text-foreground-muted text-[11px]">
                    Seleccione un motivo del catálogo para calcular el impacto de inventario sobre las líneas de esta factura.
                  </p>
                ) : esCambioFormaPago ? (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta anulación no genera movimiento de inventario (el producto permanece con el cliente; solo se anula para corregir la forma de pago).
                    </p>
                  </div>
                ) : esFacturaDuplicada ? (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta anulación no genera movimiento de inventario (factura emitida por duplicado; no se descuenta ni reingresa mercancía).
                    </p>
                  </div>
                ) : esAjusteAdministrativo ? (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta anulación no genera movimiento físico de inventario ni altera las existencias en almacén.
                    </p>
                  </div>
                ) : !motivoGeneraMovimiento ? (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta anulación no genera movimiento de inventario.
                    </p>
                  </div>
                ) : esFacturaExclusivaServiciosOT || lineasComerciales.length === 0 ? (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta factura no cuenta con ítems físicos de venta directa que admitan devolución al inventario comercial.
                    </p>
                    {tieneServicios && (
                      <p className="text-[10px] text-foreground-muted italic pt-1 border-t border-border/40">
                        Nota: Los servicios de mano de obra/taller no generan movimiento de inventario.
                      </p>
                    )}
                    {tieneRepuestosOT && (
                      <p className="text-[10px] text-foreground-muted italic pt-0.5">
                        Nota: Los repuestos consumidos en orden de trabajo salieron vía SAL_ORDEN y no duplican devolución comercial.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 text-foreground leading-relaxed">
                    {destinoProducto === "DISPONIBLE" ? (
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Esta anulación devolverá {totalUnidadesComerciales} {totalUnidadesComerciales === 1 ? "unidad" : "unidades"} al inventario comercial disponible.
                      </p>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-400 font-semibold">
                        Las {totalUnidadesComerciales} {totalUnidadesComerciales === 1 ? "unidad" : "unidades"} se registrarán en condición &quot;{destinoProducto}&quot; (no se sumarán al stock disponible para la venta).
                      </p>
                    )}
                    {tieneServicios && (
                      <p className="text-[10px] text-foreground-muted italic pt-1 border-t border-border/40">
                        Nota: Los servicios de mano de obra/taller no generan movimiento de inventario.
                      </p>
                    )}
                    {tieneRepuestosOT && (
                      <p className="text-[10px] text-foreground-muted italic pt-0.5">
                        Nota: Los repuestos consumidos en orden de trabajo salieron vía SAL_ORDEN y no duplican devolución comercial.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Destino del producto (Cuando aplique reingreso físico comercial) */}
              {mostrarDestinoProducto && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-bold text-foreground uppercase">
                    Destino del producto <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={destinoProducto}
                    onChange={(e) => setDestinoProducto(e.target.value)}
                    disabled={isCancelling}
                    className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-foreground cursor-pointer"
                  >
                    <option value="DISPONIBLE">DISPONIBLE (Devolver al stock disponible para la venta)</option>
                    <option value="DAÑADO">DAÑADO (No sumar al disponible comercial - Registro histórico)</option>
                    <option value="DEFECTUOSO">DEFECTUOSO (No sumar al disponible comercial - Registro histórico)</option>
                    <option value="CUARENTENA">CUARENTENA (En revisión técnica - No sumar al disponible)</option>
                  </select>
                  <p className="text-[10px] text-foreground-muted">
                    {destinoProducto === "DISPONIBLE"
                      ? "Las existencias se sumarán a la cantidad actual del almacén con su costo PMP histórico."
                      : "Las existencias se conservarán bloqueadas sin falsear disponibilidad física comercial."}
                  </p>
                </div>
              )}

              {/* Observación (Opcional) */}
              <div>
                <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
                  Observación <span className="text-foreground-muted font-normal text-[11px]">(Opcional)</span>
                </label>
                <textarea
                  value={cancelObservation}
                  onChange={(e) => {
                    setCancelObservation(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  disabled={isCancelling}
                  rows={2}
                  placeholder="Comentarios u observaciones adicionales..."
                  className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all resize-none text-foreground placeholder:text-foreground-muted"
                />
              </div>

              {cancelError && (
                <div className="p-2.5 bg-error-muted border border-error/30 rounded-lg text-error text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={isCancelling}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCancelling || !selectedMotivoId}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Confirmar Anulación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Secundaria de Ayuda Contextual sobre Anulación */}
      <InvoiceCancelHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </>
  );
}

/**
 * Modal Secundaria de Ayuda Contextual sobre Anulación de Factura e Inventario
 * Soporta cierre mediante ESC, backdrop click y botón X.
 */
function InvoiceCancelHelpModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-help-title"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-border bg-surface/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="cancel-help-title" className="text-sm sm:text-base font-bold text-foreground font-mono">
                Ayuda sobre anulación de factura
              </h3>
              <p className="text-xs text-foreground-muted font-sans mt-0.5">
                Qué ocurre con el inventario, pagos y destino de productos según el motivo seleccionado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
            title="Cerrar ayuda (Esc)"
            aria-label="Cerrar ayuda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll Interno */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-foreground">
          {/* Sección 1: ¿Qué sucede al anular una factura? */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground font-mono font-bold text-xs uppercase tracking-wide">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <h4>1. ¿Qué sucede al anular una factura?</h4>
            </div>
            <p className="text-foreground-secondary text-xs leading-relaxed">
              Al anular una factura, el sistema invalida el documento comercial, conserva el historial de pagos registrados y evalúa si corresponde o no un ajuste de inventario.
              La devolución de existencias depende del motivo de anulación y del tipo de ítems facturados.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl border border-border bg-surface/50 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground text-[11px]">Los pagos registrados no se eliminan automáticamente.</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-surface/50 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground text-[11px]">La factura no puede anularse dos veces.</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-surface/50 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground text-[11px]">La operación se ejecuta de forma transaccional.</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-surface/50 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground text-[11px]">Si ocurre un error, no se aplican cambios parciales.</span>
              </div>
            </div>
          </section>

          {/* Sección 2: Destino del producto */}
          <section className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 text-foreground font-mono font-bold text-xs uppercase tracking-wide">
              <PackageCheck className="w-4 h-4 text-primary shrink-0" />
              <h4>2. Destino del producto</h4>
            </div>
            <p className="text-foreground-muted text-[11px]">
              Opciones de clasificación física disponibles cuando la factura contiene productos comerciales con salida de inventario:
            </p>

            <div className="space-y-2.5">
              {/* DISPONIBLE */}
              <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    DISPONIBLE
                  </span>
                  <strong className="text-xs text-foreground">Devolver al stock disponible para la venta.</strong>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Las unidades reingresan al inventario comercial y vuelven a quedar disponibles para futuras ventas.
                </p>
                <p className="text-[10px] text-foreground-muted pt-0.5">
                  <strong className="text-foreground-secondary">Nota:</strong> Las existencias se suman nuevamente al almacén con su costo PMP histórico.
                </p>
              </div>

              {/* DAÑADO */}
              <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    DAÑADO
                  </span>
                  <strong className="text-xs text-foreground">Registrar el producto como dañado.</strong>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Las unidades quedan registradas históricamente, pero no se suman al stock disponible comercial.
                </p>
                <p className="text-[10px] text-foreground-muted pt-0.5">
                  <strong className="text-foreground-secondary">Nota:</strong> Esta opción evita mostrar como vendible un producto que ya no está apto para la venta.
                </p>
              </div>

              {/* DEFECTUOSO */}
              <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    DEFECTUOSO
                  </span>
                  <strong className="text-xs text-foreground">Registrar el producto como defectuoso.</strong>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Las unidades se registran para control interno, sin volver al disponible comercial.
                </p>
              </div>

              {/* CUARENTENA */}
              <div className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    CUARENTENA
                  </span>
                  <strong className="text-xs text-foreground">Enviar el producto a revisión técnica.</strong>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Las unidades quedan separadas temporalmente y no se suman al inventario disponible mientras se evalúa su condición.
                </p>
              </div>
            </div>
          </section>

          {/* Sección 3: Cómo se comporta el inventario según el motivo */}
          <section className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 text-foreground font-mono font-bold text-xs uppercase tracking-wide">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <h4>3. Cómo se comporta el inventario según el motivo</h4>
            </div>

            <div className="space-y-2.5">
              {/* Cambio de forma de pago */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-foreground font-mono">Cambio de forma de pago</strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-foreground-muted uppercase">
                    Sin movimiento de inventario
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  La anulación no genera movimiento de inventario. El producto permanece con el cliente, ya que la corrección es únicamente administrativa para rehacer la factura con otra forma de pago.
                </p>
              </div>

              {/* Factura duplicada */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-foreground font-mono">Factura duplicada</strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-foreground-muted uppercase">
                    Sin devolución de mercancía
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  La anulación no genera devolución de mercancía. Se trata de un documento emitido por error o duplicidad, por lo que no corresponde alterar existencias.
                </p>
              </div>

              {/* Ajuste administrativo o fiscal */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-foreground font-mono">Ajuste administrativo o fiscal</strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-foreground-muted uppercase">
                    Sin alteración física
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  La anulación no modifica el inventario físico. Solo corrige la validez documental o fiscal de la factura.
                </p>
              </div>

              {/* Devolución / Error / Producto incorrecto */}
              <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-primary font-mono">
                    Devolución de producto / Producto incorrecto / Error de facturación
                  </strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase">
                    Reingreso condicional
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Si la factura incluye productos comerciales con salida de inventario, la anulación puede generar un reingreso al inventario:
                </p>
                <div className="space-y-1 text-[11px] text-foreground-secondary pl-2 border-l-2 border-primary/40 leading-relaxed">
                  <p>
                    • Si el destino es <strong className="text-foreground">DISPONIBLE</strong>, las unidades regresan al stock comercial.
                  </p>
                  <p>
                    • Si el destino es <strong className="text-foreground">DAÑADO, DEFECTUOSO o CUARENTENA</strong>, las unidades se registran con esa condición y no se suman al disponible de venta.
                  </p>
                </div>
              </div>

              {/* Facturas con solo servicios */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-foreground font-mono">Facturas con solo servicios</strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-foreground-muted uppercase">
                    Mano de obra / Servicios
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Si la factura contiene únicamente servicios, no se genera ningún movimiento de inventario.
                </p>
              </div>

              {/* Facturas provenientes de órdenes de trabajo */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <strong className="text-xs text-foreground font-mono">Facturas provenientes de órdenes de trabajo</strong>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-foreground-muted uppercase">
                    Trazabilidad OT
                  </span>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                  Si la factura fue generada desde una OT, el sistema evalúa la trazabilidad real del movimiento original para determinar si corresponde reverso de inventario o solo anulación comercial.
                </p>
              </div>
            </div>
          </section>

          {/* Sección 4: Regla importante */}
          <section className="p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <strong className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Regla Importante
              </strong>
            </div>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              La decisión final no depende solo del motivo seleccionado. El sistema también revisa el detalle original de la factura para determinar si existen productos físicos que deban o no revertirse en inventario.
            </p>
            <div className="pt-1 text-[11px] space-y-1 text-amber-800/90 dark:text-amber-200/90 pl-2 border-l-2 border-amber-500/40 leading-relaxed">
              <p>• <strong className="text-foreground">Servicios:</strong> no generan movimiento.</p>
              <p>• <strong className="text-foreground">Productos comerciales:</strong> pueden generar devolución.</p>
              <p>• <strong className="text-foreground">Repuestos de taller ya consumidos en OT:</strong> no siempre implican devolución al inventario comercial.</p>
            </div>
          </section>
        </div>

        {/* Pie de la Modal */}
        <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-foreground-muted font-mono hidden sm:inline">
            Presione Esc o haga clic fuera para cerrar
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors cursor-pointer shadow-sm ml-auto"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
