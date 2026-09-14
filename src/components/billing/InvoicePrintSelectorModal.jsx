"use client";

import React, { useState } from "react";
import { X, Printer, FileText, Receipt, Check, Loader2 } from "lucide-react";
import {
  generateInvoiceModel1Pdf,
  generateInvoiceModel2Pdf,
  downloadInvoicePdf
} from "@/lib/billing/billingPdfService";

export default function InvoicePrintSelectorModal({
  isOpen,
  onClose,
  invoiceData,
  onPrinted
}) {
  const [selectedModel, setSelectedModel] = useState("modelo1");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !invoiceData) return null;

  const codigoFactura = invoiceData.factura?.codigo_factura || "FAC";

  const handlePrint = async () => {
    try {
      setIsGenerating(true);

      if (selectedModel === "modelo1") {
        // Modelo 1: Factura Estándar A4
        const doc = generateInvoiceModel1Pdf(invoiceData);
        const fileName = `Factura_${codigoFactura}.pdf`;
        downloadInvoicePdf(doc, fileName);
      } else {
        // Modelo 2: Ticket POS Térmico (80 mm)
        const doc = generateInvoiceModel2Pdf(invoiceData);
        const fileName = `Factura_${codigoFactura}_Modelo2.pdf`;
        downloadInvoicePdf(doc, fileName);
      }

      if (onPrinted) {
        onPrinted(selectedModel);
      }
      onClose();
    } catch (err) {
      console.error("Error al generar PDF de factura:", err);
      alert("Ocurrió un error al generar el PDF: " + (err.message || "Error desconocido"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground font-mono">
                Imprimir Factura
              </h3>
              <p className="text-xs text-foreground-muted font-mono">
                {codigoFactura} • Seleccione el modelo de impresión
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Dos modelos de impresión */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-foreground-secondary font-sans leading-relaxed">
            Elija el formato de salida deseado. Ambos modelos reutilizan el diseño oficial de Ride Lab:
          </p>

          {/* Opción 1: Modelo 1 (A4) */}
          <div
            onClick={() => setSelectedModel("modelo1")}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedModel === "modelo1"
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border hover:border-border-strong hover:bg-surface/60 bg-surface/30"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                selectedModel === "modelo1"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border text-foreground-muted"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-foreground">
                  Modelo 1 — Factura Estándar (A4)
                </span>
                {selectedModel === "modelo1" && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-foreground-muted mt-1 leading-snug">
                Formato carta/A4 con membrete oficial, datos completos del cliente y detalle de líneas.
              </p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-surface border border-border text-foreground-secondary">
                Factura_{codigoFactura}.pdf
              </span>
            </div>
          </div>

          {/* Opción 2: Modelo 2 (Ticket POS 80mm) */}
          <div
            onClick={() => setSelectedModel("modelo2")}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedModel === "modelo2"
                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                : "border-border hover:border-border-strong hover:bg-surface/60 bg-surface/30"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                selectedModel === "modelo2"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border text-foreground-muted"
              }`}
            >
              <Receipt className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-foreground">
                  Modelo 2 — Ticket POS (80 mm)
                </span>
                {selectedModel === "modelo2" && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-foreground-muted mt-1 leading-snug">
                Formato rollo térmico para punto de venta (80 mm), compacto y optimizado para entrega inmediata.
              </p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-surface border border-border text-foreground-secondary">
                Factura_{codigoFactura}_Modelo2.pdf
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-surface/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-mono font-bold text-foreground-secondary hover:text-foreground hover:bg-hover rounded-xl border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Descargar e Imprimir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
