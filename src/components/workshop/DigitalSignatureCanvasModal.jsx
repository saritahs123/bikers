"use client";
import React, { useRef, useState, useEffect } from "react";
import { X, Check, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";
import { getCurrentReceptionTerms } from "@/lib/workshop/receptionTerms";

export default function DigitalSignatureCanvasModal({ isOpen, onClose, onConfirm }) {
  const currentTerms = getCurrentReceptionTerms();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setHasSigned(false);
      const timer = setTimeout(() => {
        initCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 460;
    const h = rect.height > 0 ? rect.height : 220;

    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#10b981"; // Bright emerald stroke
    ctx.lineWidth = 3.5;

    // Fill dark navy canvas background for maximum signature clarity
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    setHasSigned(false);
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setError("");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSigned(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    initCanvas();
    setHasSigned(false);
  };

  const handleSave = () => {
    if (!hasSigned) {
      setError("Por favor trace la firma del cliente antes de confirmar.");
      return;
    }
    if (!terminosAceptados) {
      setError("Debe aceptar los términos y condiciones para continuar.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onConfirm({
      firma_digital: dataUrl,
      terminos_aceptados: terminosAceptados,
      version_terminos: currentTerms.version
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative z-[10000] w-full max-w-lg min-w-[300px] sm:min-w-[460px] bg-card border border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-foreground my-auto font-sans">
        {/* Header with Title & Close button */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary-muted text-primary rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
              Firma Digital del Cliente
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground p-1.5 rounded-lg hover:bg-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-card font-mono text-xs">
          <p className="text-foreground-secondary font-medium leading-relaxed font-sans">
            Trace la firma del cliente en el recuadro táctil para autorizar la recepción de la bicicleta y la inspección preliminar.
          </p>

          {/* Bounded Canvas Container */}
          <div className="relative border-2 border-dashed border-primary/50 hover:border-primary rounded-xl overflow-hidden bg-[#090d16] transition-colors">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-48 sm:h-52 touch-none cursor-crosshair block"
              style={{ touchAction: "none" }}
            />
            {!hasSigned && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span className="text-[11px] text-foreground-muted font-bold uppercase tracking-widest bg-card/90 px-3 py-1.5 rounded-lg border border-border shadow-md">
                  Trace su firma aquí
                </span>
              </div>
            )}

            {/* Helper button: Clear signature */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1.5 text-xs text-foreground bg-card/90 hover:bg-card px-2.5 py-1.5 rounded-lg border border-border transition-all cursor-pointer font-bold shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5 text-primary" />
                Limpiar
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group bg-surface p-3.5 rounded-xl border border-border">
            <input
              type="checkbox"
              checked={terminosAceptados}
              onChange={(e) => setTerminosAceptados(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary bg-card cursor-pointer"
            />
            <span className="text-xs text-foreground-secondary group-hover:text-foreground transition-colors leading-relaxed font-sans font-medium">
              {currentTerms.text}
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-muted border border-error/30 rounded-xl text-error text-xs font-medium font-sans">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-border bg-surface shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-foreground-muted hover:text-foreground hover:bg-hover rounded-xl transition-all cursor-pointer uppercase"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSigned || !terminosAceptados}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary-button-bg hover:bg-primary-button-hover rounded-xl transition-all shadow-sm cursor-pointer uppercase disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Confirmar Firma
          </button>
        </div>
      </div>
    </div>
  );
}
