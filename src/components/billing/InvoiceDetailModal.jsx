"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Receipt,
  Printer,
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
  ShieldCheck,
  PackageCheck
} from "lucide-react";
import InvoicePrintSelectorModal from "./InvoicePrintSelectorModal";
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

  // Modales secundarios
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // FAC-6.1: Catálogo de Motivos de Anulación y Reglas de Inventario
  const [motivosList, setMotivosList] = useState([]);
  const [usuariosAutorizadores, setUsuariosAutorizadores] = useState([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [selectedMotivoId, setSelectedMotivoId] = useState("");
  const [cancelObservation, setCancelObservation] = useState("");
  const [destinoProducto, setDestinoProducto] = useState("DISPONIBLE");
  const [selectedAutorizadorId, setSelectedAutorizadorId] = useState("");

  const fetchMotivosAnulacion = React.useCallback(async () => {
    try {
      setLoadingMotivos(true);
      const res = await fetch("/api/facturacion/motivos-anulacion");
      const json = await res.json();
      if (res.ok && json.data) {
        setMotivosList(json.data.motivos || []);
        setUsuariosAutorizadores(json.data.usuarios_autorizadores || []);
      }
    } catch (err) {
      console.error("Error al cargar catálogo de motivos de anulación:", err);
    } finally {
      setLoadingMotivos(false);
    }
  }, []);

  const openCancelModal = () => {
    setCancelError(null);
    setSelectedMotivoId("");
    setCancelObservation("");
    setDestinoProducto("DISPONIBLE");
    setSelectedAutorizadorId("");
    setIsCancelModalOpen(true);
    fetchMotivosAnulacion();
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

  // FAC-6.1: Clasificación de líneas de factura para cálculo de efecto de inventario
  const lineasProductosElegibles = detalle.filter((item) => {
    const isServicio = item.tipo_linea === "SERVICIO" || !!item.servicio_id;
    const isRepuesto = item.tipo_linea === "REPUESTO" || !!item.orden_producto_id;
    return !isServicio && !isRepuesto && (item.tipo_linea === "PRODUCTO" || !!item.producto_id);
  });
  const totalUnidadesRevertibles = lineasProductosElegibles.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );
  const tieneServicios = detalle.some((item) => item.tipo_linea === "SERVICIO" || !!item.servicio_id);
  const tieneRepuestosOT = detalle.some((item) => item.tipo_linea === "REPUESTO" || !!item.orden_producto_id);

  const selectedMotivo = motivosList.find(
    (m) => String(m.motivo_anulacion_factura_id) === String(selectedMotivoId)
  );

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

    if (selectedMotivo?.requiere_observacion && !cancelObservation.trim()) {
      setCancelError("La observación es obligatoria para el motivo de anulación seleccionado.");
      return;
    }

    if (selectedMotivo?.requiere_autorizacion && !selectedAutorizadorId) {
      setCancelError("Debe seleccionar el usuario que autoriza la anulación.");
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
          destino_producto: destinoProducto,
          usuario_autorizacion_id: selectedAutorizadorId ? Number(selectedAutorizadorId) : null
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
      setSelectedAutorizadorId("");
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
            <div className="flex items-center gap-2">
              {factura && (
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-foreground hover:text-primary bg-surface hover:bg-hover border border-border rounded-xl transition-all cursor-pointer shadow-sm"
                  title="Imprimir Factura (Seleccionar Formato)"
                >
                  <Printer className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
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
                {factura.estado === "ANULADA" && (
                  <div className="p-4 rounded-xl bg-error-muted/30 border border-error/40 text-error space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm">
                        <AlertTriangle className="w-4 h-4 text-error shrink-0" />
                        <span>ESTA FACTURA HA SIDO ANULADA</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-error/20 border border-error/30 text-error uppercase">
                        {anulacion?.tipo_movimiento_codigo_snapshot || (anulacion?.genera_movimiento_snapshot ? "DEV_VENTA" : "SIN MOVIMIENTO")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-3 border-t border-error/20">
                      <div>
                        <span className="text-foreground-muted block text-[10px] uppercase font-bold">Motivo:</span>
                        <span className="font-semibold text-foreground">
                          {anulacion?.motivo_snapshot || factura.motivo_anulacion || "Sin motivo especificado"}
                        </span>
                        {anulacion?.motivo_descripcion_snapshot && (
                          <p className="text-[10px] text-foreground-muted font-sans mt-0.5">{anulacion.motivo_descripcion_snapshot}</p>
                        )}
                      </div>

                      <div>
                        <span className="text-foreground-muted block text-[10px] uppercase font-bold">Efecto inventario:</span>
                        <span className="font-semibold text-foreground">
                          {anulacion
                            ? (anulacion.genera_movimiento_snapshot ? "Reverso físico aplicado" : "Sin movimiento físico")
                            : "Sin movimiento de inventario"}
                        </span>
                        <span className="text-[10px] text-foreground-muted block mt-0.5">
                          Movimiento: {anulacion?.tipo_movimiento_codigo_snapshot || (anulacion?.genera_movimiento_snapshot ? "DEV_VENTA" : "Sin movimiento")}
                        </span>
                      </div>

                      <div>
                        <span className="text-foreground-muted block text-[10px] uppercase font-bold">Destino producto:</span>
                        <span className="font-semibold text-foreground">
                          {anulacion?.destino_producto || "No aplica"}
                        </span>
                        {anulacion?.usuario_autorizacion_nombre && (
                          <span className="text-[10px] text-foreground-muted block mt-0.5">
                            Autorizado por: <strong className="text-foreground font-sans">{anulacion.usuario_autorizacion_nombre}</strong>
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-foreground-muted block text-[10px] uppercase font-bold">Trazabilidad:</span>
                        <span className="text-foreground block">
                          Por: <strong className="font-sans">{anulacion?.usuario_anulacion_nombre || factura.usuario_anulacion_nombre || "Sistema"}</strong>
                        </span>
                        <span className="text-[10px] text-foreground-muted block mt-0.5">
                          {formatDateTime(anulacion?.fecha_anulacion || factura.fecha_anulacion)}
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
                )}

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

      {/* Selector de formato de impresión */}
      {isPrintModalOpen && data && (
        <InvoicePrintSelectorModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          invoiceData={data}
        />
      )}

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

              {/* Motivo de anulación (SELECT OBLIGATORIO) */}
              <div>
                <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
                  Motivo de anulación <span className="text-rose-500">*</span>
                </label>
                {loadingMotivos ? (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-foreground-muted bg-surface rounded-xl border border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Cargando catálogo de motivos...</span>
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
                        {m.motivo_anulacion} {m.genera_movimiento ? "• (Afecta Inventario)" : "• (Sin Movimiento)"}
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
                <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Advertencia importante para cambio de pago:</p>
                    <p className="text-[11px] leading-relaxed">
                      Para corregir únicamente la forma de pago se recomienda modificar/revertir el pago, no anular la factura. Si anula la factura, los productos con salida de inventario serán devueltos según la regla normal para evitar doble descuento al refacturar.
                    </p>
                  </div>
                </div>
              )}

              {/* Panel Informativo: Efecto sobre Inventario */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-surface/70 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-mono font-bold text-foreground text-[11px] uppercase tracking-wide">
                  <PackageCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>Efecto sobre inventario</span>
                </div>

                {!selectedMotivo ? (
                  <p className="text-foreground-muted text-[11px]">
                    Seleccione un motivo del catálogo para calcular el impacto de inventario sobre las líneas de esta factura.
                  </p>
                ) : selectedMotivo.genera_movimiento && lineasProductosElegibles.length > 0 ? (
                  <div className="space-y-1.5 text-foreground leading-relaxed">
                    {destinoProducto === "DISPONIBLE" ? (
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Esta anulación afectará {lineasProductosElegibles.length} producto(s) y devolverá {totalUnidadesRevertibles} unidades al inventario disponible.
                      </p>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-400 font-semibold">
                        El destino seleccionado ({destinoProducto}) registrará la condición histórica de las unidades devueltas pero NO sumará existencias al stock comercial disponible.
                      </p>
                    )}
                    <p className="text-[11px] text-foreground-muted">
                      Se generará movimiento <strong>{selectedMotivo.codigo_tipo_movimiento || "DEV_VENTA"}</strong> sobre la salida original <strong>SAL_VENTA</strong>.
                    </p>
                    {(tieneServicios || tieneRepuestosOT) && (
                      <p className="text-[10px] text-foreground-muted italic pt-1 border-t border-border/40">
                        Nota: Los servicios y repuestos consumidos por Taller no serán modificados ni generan devolución al inventario comercial.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 text-foreground leading-relaxed">
                    <p className="text-foreground-secondary font-medium">
                      Esta anulación no genera movimiento físico de inventario.
                    </p>
                    {lineasProductosElegibles.length === 0 && (tieneServicios || tieneRepuestosOT) && (
                      <p className="text-[11px] text-foreground-muted">
                        La factura contiene servicios y/o repuestos de orden de trabajo que no admiten reingreso físico como venta directa.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Destino del producto (Cuando aplique reingreso físico) */}
              {selectedMotivo?.genera_movimiento && lineasProductosElegibles.length > 0 && (
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

              {/* Observación (Condicional: obligatoria u opcional) */}
              <div>
                <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
                  Observación {selectedMotivo?.requiere_observacion ? <span className="text-rose-500">* (Obligatoria)</span> : <span className="text-foreground-muted font-normal text-[11px]">(Opcional)</span>}
                </label>
                <textarea
                  value={cancelObservation}
                  onChange={(e) => {
                    setCancelObservation(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  disabled={isCancelling}
                  rows={2}
                  placeholder={
                    selectedMotivo?.requiere_observacion
                      ? "Indique detalladamente la justificación de la anulación (obligatoria)..."
                      : "Comentarios u observaciones adicionales..."
                  }
                  className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all resize-none text-foreground placeholder:text-foreground-muted"
                />
              </div>

              {/* Usuario que autoriza (Condicional: cuando el motivo lo requiera) */}
              {selectedMotivo?.requiere_autorizacion && (
                <div className="space-y-1.5 p-3 rounded-xl border border-purple-500/30 bg-purple-500/5">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 uppercase">
                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Usuario que autoriza <span className="text-rose-500">*</span></span>
                  </div>
                  <select
                    value={selectedAutorizadorId}
                    onChange={(e) => {
                      setSelectedAutorizadorId(e.target.value);
                      if (cancelError) setCancelError(null);
                    }}
                    disabled={isCancelling}
                    className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-foreground cursor-pointer"
                  >
                    <option value="">-- Seleccione el usuario autorizador --</option>
                    {usuariosAutorizadores.map((u) => (
                      <option key={u.usuario_id} value={u.usuario_id}>
                        {u.nombre_completo} ({u.rol_nombre || "Autorizador"}) • {u.correo}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-foreground-muted">
                    Este motivo requiere validación de un usuario con permisos administrativos.
                  </p>
                </div>
              )}

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
                  disabled={
                    isCancelling ||
                    !selectedMotivoId ||
                    (selectedMotivo?.requiere_observacion && !cancelObservation.trim()) ||
                    (selectedMotivo?.requiere_autorizacion && !selectedAutorizadorId)
                  }
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
    </>
  );
}
