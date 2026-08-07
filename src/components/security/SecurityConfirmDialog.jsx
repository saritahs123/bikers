"use client";
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldX, ShieldCheck, AlertTriangle, Info, CheckCircle2, Save, Trash2, Key, RefreshCw, X 
} from 'lucide-react';

/**
 * @typedef {Object} SecurityConfirmDialogProps
 * @property {boolean} [isOpen]
 * @property {() => void} [onClose]
 * @property {() => void} [onConfirm]
 * @property {React.ReactNode} [title]
 * @property {React.ReactNode} [description]
 * @property {'default' | 'warning' | 'danger' | 'success' | 'info'} [variant]
 * @property {any} [icon]
 * @property {React.ReactNode} [confirmLabel]
 * @property {React.ReactNode} [cancelLabel]
 * @property {boolean} [isLoading]
 * @property {React.ReactNode} [loadingLabel]
 * @property {any} [details]
 * @property {React.ReactNode} [extraContent]
 */

/**
 * SecurityConfirmDialog - Unified standard confirmation dialog for the Security Module.
 * Adheres strictly to the Bikers' Fort Design System:
 * - Theme background: #161a21
 * - Theme border: #2d3748
 * - Olive/Lime primary accent: #bfce7f
 * - Red/Danger semantic color for destructive actions only (icon, danger button)
 * - Rendered via createPortal to document.body
 * 
 * @param {SecurityConfirmDialogProps} props
 */
export default function SecurityConfirmDialog({
  isOpen = false,
  onClose = () => {},
  onConfirm = () => {},
  title = '',
  description = '',
  variant = 'default', // 'danger' | 'warning' | 'default' | 'success' | 'info'
  icon: CustomIcon = null,
  confirmLabel = null,
  cancelLabel = 'Cancelar',
  isLoading = false,
  loadingLabel = null,
  details = null,
  extraContent = null,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose?.();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Determine Icon based on variant if custom icon is not supplied
  const renderIcon = () => {
    if (CustomIcon) return <CustomIcon size={26} />;
    switch (variant) {
      case 'danger':
        return <ShieldX size={26} />;
      case 'warning':
        return <AlertTriangle size={26} />;
      case 'success':
        return <CheckCircle2 size={26} />;
      case 'info':
        return <Info size={26} />;
      case 'default':
      default:
        return <ShieldCheck size={26} />;
    }
  };

  // Determine variant specific styles for the icon container
  const getIconContainerStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'info':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
      case 'default':
      default:
        return 'bg-[#2c321d] border-[#bfce7f]/30 text-[#bfce7f]';
    }
  };

  // Determine variant specific styles for the primary confirm button
  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20';
      case 'info':
        return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20';
      case 'default':
      default:
        return 'bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] shadow-[#bfce7f]/20';
    }
  };

  // Default labels if not provided
  const resolvedConfirmLabel = confirmLabel || (
    variant === 'danger' ? 'Eliminar' : variant === 'warning' ? 'Continuar' : 'Confirmar'
  );
  const resolvedLoadingLabel = loadingLabel || `${resolvedConfirmLabel}...`;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 font-mono text-xs animate-in fade-in duration-200">
      {/* Overlay Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={() => {
          if (!isLoading) onClose?.();
        }}
      ></div>

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        className="relative w-[480px] max-w-[calc(100vw-32px)] min-w-[300px] bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-200 flex flex-col items-start text-left box-border"
      >
        {/* Close X Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#212631] transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={16} />
        </button>

        {/* Small Subtle Icon Badge */}
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 shrink-0 ${getIconContainerStyle()}`}>
          {renderIcon()}
        </div>

        {/* Title */}
        <h3 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight w-full">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <div className="text-xs text-slate-300 mb-5 leading-relaxed font-medium w-full">
            {description}
          </div>
        )}

        {/* Technical Details Mini Card */}
        {details && (
          <div className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl p-3.5 mb-5 space-y-2 text-xs font-mono">
            {Array.isArray(details) ? (
              details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">{item.label}:</span>
                  <span className={`font-bold text-white truncate max-w-[260px] ${item.isCode ? 'bg-[#161a21] px-2 py-0.5 rounded border border-[#2d3748] font-mono text-slate-300' : ''}`}>
                    {item.value || '—'}
                  </span>
                </div>
              ))
            ) : (
              details
            )}
          </div>
        )}

        {/* Extra Content (e.g. checkbox) */}
        {extraContent && (
          <div className="w-full mb-5 font-mono text-xs">
            {extraContent}
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center gap-3 w-full pt-1">
          <button 
            type="button"
            disabled={isLoading}
            onClick={onClose} 
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#2d3748] bg-[#0e1117] hover:bg-[#1f242d] text-slate-300 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer text-center"
          >
            {cancelLabel}
          </button>
          <button 
            type="button"
            disabled={isLoading}
            onClick={onConfirm} 
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-center ${getConfirmButtonStyle()}`}
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{resolvedLoadingLabel}</span>
              </>
            ) : (
              <span>{resolvedConfirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
