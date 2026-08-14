"use client";
import React, { useRef, useState, useEffect } from "react";
import { X, Check, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";

export default function DigitalSignatureCanvasModal({ isOpen, onClose, onConfirm }) {
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
    ctx.strokeStyle = "#10b981"; // Bright neon emerald stroke
    ctx.lineWidth = 3.5;

    // Fill dark navy canvas background
    ctx.fillStyle = "#060a12";
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
    onConfirm({ firma_digital: dataUrl, terminos_aceptados: terminosAceptados });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative z-[110] w-full max-w-lg min-w-[320px] sm:min-w-[480px] bg-[#0f172a] border-2 border-emerald-400 rounded-2xl shadow-[0_0_80px_rgba(16,185,129,0.4)] overflow-hidden flex flex-col text-white my-auto">
        {/* 1. Header with Title & Close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#162032]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">Firma Digital del Cliente</h3>
          </div>
          {/* Close X button */}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-[#0f172a]">
          {/* Instruction text */}
          <p className="text-xs text-slate-200 font-semibold leading-relaxed">
            Trace la firma del cliente en el recuadro táctil para autorizar la recepción de la bicicleta y la inspección preliminar.
          </p>

          {/* Bounded Canvas Container */}
          <div className="relative border-2 border-dashed border-emerald-400/60 hover:border-emerald-400 rounded-xl overflow-hidden bg-[#060a12] transition-colors">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-52 touch-none cursor-crosshair block"
            />
            {!hasSigned && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span className="text-xs text-slate-300 font-bold uppercase tracking-widest bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700 shadow-md">
                  Trace su firma aquí
                </span>
              </div>
            )}

            {/* Helper button: Clear signature */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white bg-slate-900/95 px-2.5 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 transition-all cursor-pointer font-bold shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group bg-[#162032] p-3.5 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={terminosAceptados}
              onChange={(e) => setTerminosAceptados(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500/20 bg-slate-950 cursor-pointer"
            />
            <span className="text-xs text-slate-200 group-hover:text-white transition-colors leading-relaxed font-medium">
              El cliente declara haber entregado la bicicleta en las condiciones descritas en el checklist y acepta los términos del servicio de taller.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-[#162032]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer uppercase"
          >
            Cancelar
          </button>
          {/* Confirm button (Disabled if !hasSigned or !terminosAceptados) */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSigned || !terminosAceptados}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer uppercase disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Check className="w-4 h-4" />
            Confirmar Firma
          </button>
        </div>
      </div>
    </div>
  );
}

