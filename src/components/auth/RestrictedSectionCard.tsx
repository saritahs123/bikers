"use client";

import React from "react";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface RestrictedSectionCardProps {
  title?: string;
  message?: string;
  description?: string;
  actionRequired?: string;
  backHref?: string;
  backLabel?: string;
  onClose?: () => void;
}

/**
 * Reusable visual component for rendering an access-restricted state
 * within forms, modals or page sections in a corporate, minimalist and neutral presentation.
 */
export function RestrictedSectionCard({
  title = "Acceso restringido",
  message,
  description,
  actionRequired,
  backHref,
  backLabel = "Volver",
  onClose
}: RestrictedSectionCardProps) {
  const displayMessage =
    message ||
    description ||
    "No tienes permisos habilitados para acceder a esta funcionalidad. Si necesitas utilizarla, solicita la autorización correspondiente al administrador del sistema.";

  return (
    <div
      data-testid="restricted-section-card"
      data-action-required={actionRequired}
      className="w-full p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs text-center flex flex-col items-center justify-center transition-colors"
    >
      <div className="w-12 h-12 rounded-xl bg-surface-subtle border border-border flex items-center justify-center text-foreground-secondary mb-3 shadow-xs">
        <Lock className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 tracking-tight">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-foreground-secondary max-w-md leading-relaxed mb-5">
        {displayMessage}
      </p>

      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-subtle hover:bg-hover border border-border text-foreground text-xs sm:text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-foreground-secondary" />
          <span>{backLabel}</span>
        </Link>
      ) : onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-subtle hover:bg-hover border border-border text-foreground text-xs sm:text-sm font-medium transition-all cursor-pointer"
        >
          <span>{backLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

export default RestrictedSectionCard;
