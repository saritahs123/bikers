"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowLeft, Home } from "lucide-react";

export interface AccessDeniedViewProps {
  screenCode?: string;
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  homeHref?: string;
}

/**
 * Standardized RBAC Restricted Access View (Fase 6.4.21)
 *
 * Provides a corporate, minimalist and neutral visual presentation for legitimate
 * RBAC authorization restrictions, avoiding alarmist red alerts, critical crash cues,
 * or raw technical error codes.
 */
export function AccessDeniedView({
  screenCode,
  title = "Acceso restringido",
  message = "No tienes permisos habilitados para acceder a esta funcionalidad. Si necesitas utilizarla, solicita la autorización correspondiente al administrador del sistema.",
  showHomeButton = true,
  showBackButton = true,
  homeHref = "/"
}: AccessDeniedViewProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(homeHref);
    }
  };

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development" && screenCode) {
      console.debug("[RBAC Access Denied]", {
        screenCode,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }, [screenCode]);

  return (
    <div
      data-testid="access-denied-view"
      data-screen-code={screenCode}
      className="min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center p-4 sm:p-6 md:p-8"
    >
      <div className="max-w-md w-full bg-card border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-center shadow-lg shadow-black/5 relative overflow-hidden transition-colors">
        {/* Subtle neutral ambient glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-surface-elevated/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-surface-elevated/40 rounded-full blur-3xl pointer-events-none" />

        {/* Informational neutral icon container */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center text-foreground-secondary shadow-sm">
          <Lock className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" aria-hidden="true" />
        </div>

        {/* Standardized Title */}
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-2">
          {title}
        </h1>

        {/* Standardized Informational Message */}
        <p className="text-xs sm:text-sm text-foreground-secondary leading-relaxed mb-6 sm:mb-8 max-w-sm mx-auto">
          {message}
        </p>

        {/* Action Buttons: Volver al inicio (principal) & Volver atrás (secundario) */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full">
          {showBackButton && (
            <button
              type="button"
              onClick={handleBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface-subtle text-foreground text-xs sm:text-sm font-medium hover:bg-hover hover:border-border-strong transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-foreground-secondary" />
              <span>Volver atrás</span>
            </button>
          )}

          {showHomeButton && (
            <Link
              href={homeHref}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary-hover transition-all shadow-sm cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Volver al inicio</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccessDeniedView;
