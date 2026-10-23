"use client";

import React from "react";
import { Lock, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface RestrictedSectionCardProps {
  title?: string;
  message?: string;
  actionRequired?: string;
  backHref?: string;
  backLabel?: string;
}

/**
 * Reusable visual component for rendering an access-restricted state
 * within forms, modals or page sections when a user lacks specific permissions (Fase 6.4.13).
 */
export function RestrictedSectionCard({
  title = "Acceso Restringido",
  message = "Tu rol de usuario no dispone de los permisos necesarios para realizar esta operación.",
  actionRequired,
  backHref,
  backLabel = "Volver"
}: RestrictedSectionCardProps) {
  return (
    <div className="w-full p-8 md:p-12 rounded-2xl bg-card border border-amber-500/20 shadow-lg text-center flex flex-col items-center justify-center font-mono">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-sm">
        <Lock className="w-7 h-7" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-bold uppercase tracking-wider mb-2">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Permiso Requerido {actionRequired ? `(${actionRequired.toUpperCase()})` : ""}</span>
      </div>

      <h3 className="text-base md:text-lg font-bold text-foreground mb-2 tracking-tight">
        {title}
      </h3>

      <p className="text-xs text-foreground-secondary max-w-md leading-relaxed mb-6">
        {message}
      </p>

      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-subtle hover:bg-hover border border-border text-foreground text-xs font-bold uppercase tracking-wider transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      )}
    </div>
  );
}

export default RestrictedSectionCard;
