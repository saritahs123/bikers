"use client";

import React from "react";
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from "lucide-react";

export type AlertVariant = "success" | "info" | "warning" | "error";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

export function Alert({
  children,
  variant = "info",
  title,
  onClose,
  className = "",
  ...props
}: AlertProps) {
  const iconConfig = {
    success: <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />,
  }[variant];

  const variantClasses = {
    success: "bg-success-muted/50 border-success/30 text-foreground",
    info: "bg-info-muted/50 border-info/30 text-foreground",
    warning: "bg-warning-muted/50 border-warning/30 text-foreground",
    error: "bg-error-muted/50 border-error/30 text-foreground",
  }[variant];

  const titleColors = {
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    error: "text-error",
  }[variant];

  return (
    <div
      role="alert"
      className={`p-3.5 border rounded-xl flex items-start gap-3 text-xs font-sans transition-colors ${variantClasses} ${className}`}
      {...props}
    >
      {iconConfig}
      <div className="flex-1 min-w-0">
        {title && (
          <h5 className={`font-bold text-xs uppercase font-mono mb-0.5 tracking-tight ${titleColors}`}>
            {title}
          </h5>
        )}
        <div className="text-foreground-secondary leading-relaxed text-xs">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground p-1 rounded-lg hover:bg-hover transition-colors cursor-pointer shrink-0"
          aria-label="Cerrar alerta"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
