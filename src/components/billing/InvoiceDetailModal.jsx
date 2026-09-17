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
  FileText,
  Loader2,
  Ban
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
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

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
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelError("El motivo de la anulación es obligatorio.");
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError(null);

      const res = await fetch(`/api/facturacion/facturas/${facturaId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: trimmedReason })
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
      setCancelReason("");
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
                  onClick={() => {
                    setCancelReason("");
                    setCancelError(null);
                    setIsCancelModalOpen(true);
                  }}
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
                {/* Banner de Factura Anulada (Regla 22) */}
                {factura.estado === "ANULADA" && (
                  <div className="p-4 rounded-xl bg-error-muted/30 border border-error/40 text-error space-y-2">
                    <div className="flex items-center gap-2 font-mono font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 text-error shrink-0" />
                      <span>ESTA FACTURA HA SIDO ANULADA</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-2 border-t border-error/20">
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Motivo de Anulación:</span>
                        <span className="font-semibold text-foreground">{factura.motivo_anulacion || "Sin motivo especificado"}</span>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Fecha de Anulación:</span>
                        <span className="font-semibold text-foreground">{formatDateTime(factura.fecha_anulacion)}</span>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[11px]">Anulado por:</span>
                        <span className="font-semibold text-foreground">{factura.usuario_anulacion_nombre || "Usuario del sistema"}</span>
                      </div>
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

      {/* Modal de Confirmación de Anulación (Reglas 1, 2, 14) */}
      {isCancelModalOpen && factura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transition-colors">
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
              {/* Resumen de Factura */}
              <div className="p-3.5 rounded-xl border border-border bg-surface/50 grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-foreground-muted block text-[10px]">Código Factura:</span>
                  <strong className="text-foreground">{factura.codigo_factura}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Total Facturado:</span>
                  <strong className="text-foreground">{formatMoney(factura.total)}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Estado Actual:</span>
                  <span className="text-foreground font-bold">{factura.estado}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Origen:</span>
                  <span className="text-foreground">
                    {factura.tipo_factura_nombre || (factura.orden_trabajo_id ? "Orden de Trabajo" : "Venta Directa")}
                  </span>
                </div>
              </div>

              {/* Advertencia de Pagos Registrados (Regla 14) */}
              {Number(factura.monto_pagado || 0) > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Atención con los cobros registrados:</p>
                    <p>La anulación no registra automáticamente una devolución de dinero. Los pagos aplicados permanecerán en el historial financiero como evidencia contable.</p>
                  </div>
                </div>
              )}

              {/* Detalle sobre el inventario */}
              <p className="text-xs text-foreground-secondary leading-relaxed">
                {factura.tipo_factura_codigo === "VENTA_DIRECTA" || !factura.orden_trabajo_id
                  ? "Al anular esta factura se generarán movimientos de reversa DEV_VENTA devolviendo las existencias físicas al stock del almacén correspondiente."
                  : "Los repuestos y mano de obra del taller permanecerán inalterados. Solo se revertirán los productos adicionales facturados."}
              </p>

              {/* Campo obligatorio: Motivo */}
              <div>
                <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
                  Motivo de anulación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  disabled={isCancelling}
                  rows={3}
                  placeholder="Indique detalladamente el motivo por el cual se anula la factura (obligatorio)..."
                  className="w-full px-3 py-2 text-xs font-sans rounded-xl border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all resize-none text-foreground placeholder:text-foreground-muted"
                  autoFocus
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
                  disabled={isCancelling || !cancelReason.trim()}
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
