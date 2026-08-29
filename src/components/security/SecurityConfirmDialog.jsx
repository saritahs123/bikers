"use client";
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldX, ShieldCheck, AlertTriangle, Info, CheckCircle2, RefreshCw, X 
} from 'lucide-react';

/**
 * SecurityConfirmDialog - Unified standard confirmation dialog for the Security Module.
 * Adheres strictly to the Bikers' Fort Design System:
 * - Theme background: bg-surface-elevated
 * - Theme border: border-border
 * - Olive/Lime primary accent: text-primary / bg-primary
 * - Semantic colors for warning, danger, success, info
 * - Rendered via createPortal to document.body
 */
export default function SecurityConfirmDialog({
  isOpen = false,
  onClose = () => {},
  onConfirm = () => {},
  title = '',
  description = '',
  variant = 'default', // 'danger' | 'warning' | 'default' | 'success' | 'info'
  icon: CustomIcon = null,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isLoading = false,
  loadingLabel = 'Cargando...',
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
        return 'bg-error/15 border-error/30 text-error';
      case 'warning':
        return 'bg-warning/15 border-warning/30 text-warning';
      case 'success':
        return 'bg-success/15 border-success/30 text-success';
      case 'info':
        return 'bg-info/15 border-info/30 text-info';
      case 'default':
      default:
        return 'bg-primary/15 border-primary/30 text-primary';
    }
  };

  // Determine variant specific styles for the primary confirm button
  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-error text-white hover:brightness-110 shadow-sm';
      case 'warning':
        return 'bg-warning text-white hover:brightness-110 shadow-sm';
      case 'success':
        return 'bg-success text-white hover:brightness-110 shadow-sm';
      case 'info':
        return 'bg-info text-white hover:brightness-110 shadow-sm';
      case 'default':
      default:
        return 'bg-primary-button-bg text-primary-foreground hover:brightness-110 shadow-sm';
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
      />

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        className="relative w-[480px] max-w-[calc(100vw-32px)] min-w-[300px] bg-surface-elevated border border-border rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-200 flex flex-col items-start text-left box-border transition-colors text-foreground"
      >
        {/* Close X Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={16} />
        </button>

        {/* Small Subtle Icon Badge */}
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 shrink-0 ${getIconContainerStyle()}`}>
          {renderIcon()}
        </div>

        {/* Title */}
        <h3 className="text-lg md:text-xl font-bold font-sans text-foreground mb-2 tracking-tight w-full">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <div className="text-xs text-foreground-secondary mb-5 leading-relaxed font-medium w-full font-sans">
            {description}
          </div>
        )}

        {/* Technical Details Mini Card */}
        {details && (
          <div className="w-full bg-surface-subtle border border-border rounded-xl p-3.5 mb-5 space-y-2 text-xs font-mono">
            {Array.isArray(details) ? (
              details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs gap-2">
                  <span className="text-[10px] text-foreground-muted font-bold uppercase shrink-0">{item.label}:</span>
                  <span className={`font-bold text-foreground truncate max-w-[260px] ${item.isCode ? 'bg-surface px-2 py-0.5 rounded border border-border font-mono text-foreground-secondary' : ''}`}>
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
          <div className="w-full mb-5 font-mono text-xs text-foreground-secondary">
            {extraContent}
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center gap-3 w-full pt-1">
          <button 
            type="button"
            disabled={isLoading}
            onClick={onClose} 
            className="flex-1 py-2.5 px-4 rounded-xl border border-border bg-surface hover:bg-hover text-foreground-secondary font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer text-center"
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
