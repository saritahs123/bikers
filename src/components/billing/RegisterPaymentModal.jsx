"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function RegisterPaymentModal({
  isOpen,
  onClose,
  factura,
  onPaymentSuccess
}) {
  const [tiposPago, setTiposPago] = useState([]);
  const [selectedTipoPago, setSelectedTipoPago] = useState("");
  const [monto, setMonto] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const totalFactura = factura
    ? (Number(factura.total) > 0
        ? Number(factura.total)
        : (Number(factura.total_factura) > 0
            ? Number(factura.total_factura)
            : (Number(factura.subtotal) > 0
                ? Number(factura.subtotal)
                : Number(factura.balance_pendiente || 0))))
    : 0;

  const balancePendiente = factura
    ? (factura.balance_pendiente != null && !isNaN(Number(factura.balance_pendiente)) && Number(factura.balance_pendiente) >= 0
        ? Number(factura.balance_pendiente)
        : Math.max(0, totalFactura - Number(factura.monto_pagado || 0)))
    : 0;

  // Cargar catálogo de tipos de pago
  useEffect(() => {
    if (!isOpen) return;

    async function loadTiposPago() {
      try {
        const res = await fetch("/api/facturacion/catalogos");
        const json = await res.json();
        if (json.tipos_pago && json.tipos_pago.length > 0) {
          setTiposPago(json.tipos_pago);
          // Priorizar EFECTIVO si está disponible
          const efectivo = json.tipos_pago.find(
            (tp) => tp.codigo === "EFECTIVO" || tp.nombre?.toUpperCase()?.includes("EFECTIVO")
          );
          setSelectedTipoPago(String(efectivo ? efectivo.tipo_pago_id : json.tipos_pago[0].tipo_pago_id));
        }
      } catch (err) {
        console.error("Error al cargar tipos de pago:", err);
      }
    }

    const timer = setTimeout(() => {
      const initialMonto = balancePendiente > 0 ? balancePendiente.toFixed(2) : "";
      setMonto(initialMonto);
      setMontoRecibido(initialMonto);
      setReferencia("");
      setObservacion("");
      setErrorMsg(null);
      loadTiposPago();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, factura, balancePendiente]);

  if (!isOpen || !factura) return null;

  const selectedTipo = tiposPago.find((tp) => String(tp.tipo_pago_id) === String(selectedTipoPago));
  const isEfectivo =
    selectedTipo?.codigo?.toUpperCase() === "EFECTIVO" ||
    selectedTipo?.nombre?.toUpperCase()?.includes("EFECTIVO");

  const montoNum = parseFloat(monto) || 0;
  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const devuelta = Number((montoRecibidoNum - montoNum).toFixed(2));

  const handlePagarTotal = () => {
    const totalStr = balancePendiente.toFixed(2);
    setMonto(totalStr);
    if (isEfectivo) {
      setMontoRecibido(totalStr);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericMonto = parseFloat(monto);
    if (isNaN(numericMonto) || numericMonto <= 0) {
      setErrorMsg("Ingrese un monto a pagar válido mayor a 0.");
      return;
    }

    if (numericMonto > balancePendiente + 0.009) {
      setErrorMsg(
        `El monto ingresado (RD$ ${numericMonto.toFixed(2)}) supera el balance pendiente de RD$ ${balancePendiente.toFixed(2)}.`
      );
      return;
    }

    if (!selectedTipoPago) {
      setErrorMsg("Seleccione un método de pago.");
      return;
    }

    let numericMontoRecibido = numericMonto;
    let numericDevuelta = 0;

    if (isEfectivo) {
      numericMontoRecibido = parseFloat(montoRecibido);
      if (isNaN(numericMontoRecibido) || numericMontoRecibido <= 0) {
        setErrorMsg("Ingrese el monto recibido en efectivo.");
        return;
      }
      if (numericMontoRecibido < numericMonto - 0.009) {
        setErrorMsg(
          `El monto recibido (RD$ ${numericMontoRecibido.toFixed(2)}) es menor al monto a pagar (RD$ ${numericMonto.toFixed(2)}). Faltan RD$ ${(numericMonto - numericMontoRecibido).toFixed(2)}.`
        );
        return;
      }
      numericDevuelta = Math.max(0, parseFloat((numericMontoRecibido - numericMonto).toFixed(2)));
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/facturacion/facturas/${factura.factura_id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_pago_id: parseInt(selectedTipoPago, 10),
          monto: numericMonto,
          monto_recibido: isEfectivo ? numericMontoRecibido : numericMonto,
          monto_devuelta: isEfectivo ? numericDevuelta : 0,
          referencia: referencia.trim() || null,
          observacion: observacion.trim() || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "No se pudo registrar el pago.");
      }

      if (onPaymentSuccess) {
        onPaymentSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error("Error registrando pago:", err);
      setErrorMsg(err.message || "Error al procesar el pago.");
    } finally {
      setIsLoading(false);
    }
  };

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
                Registrar Pago
              </h3>
              <p className="text-xs text-foreground-muted font-mono">
                Factura: <strong className="text-foreground">{factura.codigo_factura}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tarjeta de Resumen de Balances */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-surface/60 rounded-xl border border-border">
            <div>
              <span className="text-[11px] text-foreground-muted block font-sans">Total Factura</span>
              <span className="text-sm font-mono font-bold text-foreground">
                RD$ {totalFactura.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-amber-500 dark:text-amber-400 block font-sans font-medium">
                Balance Pendiente
              </span>
              <span className="text-sm font-mono font-bold text-amber-500 dark:text-amber-400">
                RD$ {balancePendiente.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-error-muted border border-error/30 rounded-xl text-error text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tipo de Pago */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
              Tipo de Pago *
            </label>
            <select
              value={selectedTipoPago}
              onChange={(e) => {
                setSelectedTipoPago(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              required
            >
              {tiposPago.map((tp) => (
                <option key={tp.tipo_pago_id} value={tp.tipo_pago_id}>
                  {tp.nombre} ({tp.codigo})
                </option>
              ))}
            </select>
          </div>

          {/* Monto a Pagar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary">
                Monto (RD$) *
              </label>
              <button
                type="button"
                onClick={handlePagarTotal}
                className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
              >
                Pagar total (RD$ {balancePendiente.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted font-mono text-xs">
                RD$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balancePendiente}
                value={monto}
                onChange={(e) => {
                  const val = e.target.value;
                  setMonto(val);
                  setErrorMsg(null);
                }}
                placeholder="0.00"
                required
                className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <p className="text-[10px] text-foreground-muted mt-1">
              Máximo aplicable: RD$ {balancePendiente.toFixed(2)}
            </p>
          </div>

          {/* Si Efectivo: Monto Recibido y Devuelta (idéntico a Nueva Factura) */}
          {isEfectivo && (
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary">
                    Monto Recibido (RD$) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (montoNum > 0) setMontoRecibido(montoNum.toFixed(2));
                    }}
                    disabled={montoNum <= 0}
                    className="text-[10px] font-mono text-primary hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cobro exacto (RD$ {montoNum.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted font-mono text-xs">
                    RD$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoRecibido}
                    onChange={(e) => {
                      setMontoRecibido(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="0.00"
                    required={isEfectivo}
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-secondary font-sans font-medium">Devuelta:</span>
                  <span
                    className={`text-base font-bold ${
                      montoNum <= 0
                        ? "text-foreground-muted"
                        : devuelta >= 0
                        ? "text-emerald-400"
                        : "text-error"
                    }`}
                  >
                    RD$ {montoNum > 0 && devuelta >= 0 ? devuelta.toFixed(2) : "0.00"}
                  </span>
                </div>
                {montoNum > 0 && montoRecibidoNum > 0 && devuelta < 0 && (
                  <p className="text-[11px] text-error font-sans">
                    El monto recibido es menor al monto a pagar (faltan RD$ {Math.abs(devuelta).toFixed(2)})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Referencia */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
              Referencia / No. Comprobante
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: Transferencia #48392 o Voucher POS"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Observación */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
              Observación
            </label>
            <textarea
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Notas opcionales sobre el pago..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input text-foreground text-xs font-sans resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-mono font-bold text-foreground-secondary hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || balancePendiente <= 0 || (isEfectivo && devuelta < 0)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Pago</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
