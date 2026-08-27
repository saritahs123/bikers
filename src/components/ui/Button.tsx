"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs font-mono rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-xs font-mono rounded-xl gap-2",
    lg: "px-5 py-3 text-sm font-mono rounded-xl gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-primary-button-bg text-primary-foreground hover:brightness-110 font-bold border-t border-primary/30 shadow-md shadow-primary/10",
    secondary:
      "bg-surface-subtle text-foreground border border-border hover:bg-hover hover:border-primary/40",
    outline:
      "bg-transparent text-foreground-secondary border border-border hover:bg-hover hover:text-foreground",
    ghost:
      "bg-transparent text-foreground-muted hover:bg-hover hover:text-foreground border-transparent",
    danger:
      "bg-error/15 text-error border border-error/30 hover:bg-error/25 font-bold",
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
