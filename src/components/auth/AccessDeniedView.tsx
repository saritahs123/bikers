"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock, RefreshCw } from "lucide-react";

interface AccessDeniedViewProps {
  screenCode?: string;
  title?: string;
  message?: string;
}

export function AccessDeniedView({
  screenCode,
  title = "Acceso Restringido",
  message = "No tienes los permisos necesarios para visualizar o gestionar esta sección."
}: AccessDeniedViewProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-sm">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
          <Lock className="w-3 h-3" />
          <span>HTTP 403 Forbidden</span>
        </div>

        <h1 className="text-xl font-bold font-mono tracking-tight text-foreground mb-2">
          {title}
        </h1>

        <p className="text-xs text-foreground-secondary leading-relaxed mb-6 font-mono">
          {message}
        </p>

        {screenCode && (
          <div className="mb-6 p-2.5 rounded-xl bg-surface-subtle border border-border/80 text-[11px] font-mono text-foreground-muted">
            <span className="text-foreground-secondary font-bold">Identificador de Recurso:</span>{" "}
            <code className="text-primary font-bold">{screenCode}</code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Inicio</span>
          </Link>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface-subtle text-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-hover hover:border-primary/40 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccessDeniedView;
