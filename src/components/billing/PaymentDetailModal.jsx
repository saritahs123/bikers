"use client";

import React from "react";
import {
  X,
  DollarSign,
  Receipt,
  User,
  Calendar,
  CreditCard,
  Hash,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  ExternalLink
} from "lucide-react";

export default function PaymentDetailModal({
  isOpen,
  onClose,
  pago,
  onOpenInvoice
}) {
  if (!isOpen || !pago) return null;

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const isFacturaAnulada = pago.factura_estado === "ANULADA";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 dark:text-emerald-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground font-mono">
                Detalle de Pago
              </h3>
              <p className="text-xs text-foreground-muted font-mono">
                Transacción #{pago.pago_id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 font-sans text-xs">
          {/* Alerta si la factura asociada está anulada (Sección 21) */}
          {isFacturaAnulada && (
            <div className="p-3 bg-error-muted border border-error/30 rounded-xl text-error flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div className="text-[11px] leading-tight font-medium">
                <strong>Factura Anulada:</strong> Este cobro se mantiene registrado con fines de trazabilidad histórica.
              </div>
            </div>
          )}

          {/* Monto Destacado */}
          <div className="p-4 rounded-xl border border-border bg-surface/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-foreground-muted uppercase tracking-wider font-mono block">
                Monto Cobrado
              </span>
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(pago.monto)}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 uppercase">
              {pago.estado || "APLICADO"}
            </span>
          </div>

          {/* Grid de Atributos del Pago */}
          <div className="space-y-2.5 divide-y divide-border/60">
            {/* Fecha */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Fecha y Hora:</span>
              </span>
              <span className="font-mono text-foreground font-medium">
                {formatDateTime(pago.fecha_pago)}
              </span>
            </div>

            {/* Factura */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Factura:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenInvoice) onOpenInvoice(pago.factura_id);
                  }}
                  className="font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{pago.codigo_factura}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                {isFacturaAnulada && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-error-muted text-error border border-error/20 uppercase">
                    ANULADA
                  </span>
                )}
              </div>
            </div>

            {/* Cliente */}
            <div className="pt-2 flex items-start justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Cliente:</span>
              </span>
              <div className="text-right">
                <span className="font-medium text-foreground block">
                  {pago.cliente_nombre || "Consumidor Final"}
                </span>
                {pago.cliente_identificacion && (
                  <span className="text-[10px] font-mono text-foreground-muted block">
                    {pago.cliente_identificacion}
                  </span>
                )}
              </div>
            </div>

            {/* Tipo de Pago */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Tipo de Pago:</span>
              </span>
              <span className="font-mono font-bold text-foreground">
                {pago.tipo_pago_nombre || pago.tipo_pago_codigo}
              </span>
            </div>

            {/* Referencia */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Referencia:</span>
              </span>
              <span className="font-mono text-foreground font-medium">
                {pago.referencia || "—"}
              </span>
            </div>

            {/* Usuario */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-foreground-muted flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Registrado por:</span>
              </span>
              <span className="text-foreground font-medium">
                {pago.usuario_nombre || "Usuario no disponible"}
              </span>
            </div>

            {/* Observación */}
            <div className="pt-2">
              <span className="text-foreground-muted flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Observación:</span>
              </span>
              <div className="p-2.5 bg-surface/50 border border-border rounded-xl text-foreground font-sans text-xs">
                {pago.observacion ? pago.observacion : <span className="text-foreground-muted italic">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-surface/40">
          <button
            type="button"
            onClick={() => {
              if (onOpenInvoice) onOpenInvoice(pago.factura_id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-primary hover:underline cursor-pointer"
          >
            <span>Ver Factura Completa</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold text-foreground-secondary hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
