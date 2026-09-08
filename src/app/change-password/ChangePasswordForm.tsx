"use client";

import { useActionState, useState } from "react";
import { changeMandatoryPasswordAction } from "./actions";
import { validatePasswordPolicy } from "@/lib/validations";

interface ChangePasswordFormProps {
  userEmail: string;
  userName: string;
}

export default function ChangePasswordForm({ userEmail, userName }: ChangePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(changeMandatoryPasswordAction, null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const policy = validatePasswordPolicy(newPassword);
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <main className="min-h-screen min-h-dvh py-8 px-4 sm:px-6 md:px-8 relative z-10 flex flex-col justify-between items-center bg-background text-foreground overflow-x-hidden">
      {/* Background Decorators */}
      <div className="fixed inset-0 bg-[radial-gradient(circle,#2d3748_1px,transparent_1px)] bg-[length:24px_24px] opacity-5 pointer-events-none"></div>

      <div className="my-auto w-full max-w-[480px] bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 relative z-20">
        {/* Logo and Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-16 sm:h-20 w-auto mb-4 flex items-center justify-center">
            <img
              src="/ridelab-logo.png"
              alt="Ride Lab Logo"
              className="h-full w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <span className="material-symbols-outlined text-[15px]">lock_reset</span>
            Primer Ingreso Requerido
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Cambio de contraseña requerido
          </h1>
          <p className="text-xs sm:text-sm text-foreground-muted mt-2 leading-relaxed">
            Hola <span className="font-semibold text-foreground">{userName || userEmail}</span>. Por motivos de seguridad, debes establecer una nueva contraseña antes de continuar.
          </p>
        </div>

        {/* Error Feedback */}
        {state?.error && (
          <div
            role="alert"
            className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-start gap-2.5"
          >
            <span className="material-symbols-outlined text-rose-400 text-[18px] shrink-0 mt-0.5">error</span>
            <span>{state.error}</span>
          </div>
        )}

        {/* Change Password Form */}
        <form action={formAction} className="space-y-5">
          {/* Nueva Contraseña */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Nueva contraseña *
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                name="newPassword"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full h-11 px-3.5 pr-11 bg-input border border-border rounded-xl text-foreground text-sm placeholder:text-foreground-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label={showNew ? "Ocultar contraseña" : "Ver contraseña"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNew ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Confirmar Nueva Contraseña */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Confirmar nueva contraseña *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita la nueva contraseña"
                className={`w-full h-11 px-3.5 pr-11 bg-input border rounded-xl text-foreground text-sm placeholder:text-foreground-disabled focus:outline-none transition-colors ${
                  confirmPassword && !passwordsMatch
                    ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label={showConfirm ? "Ocultar contraseña" : "Ver contraseña"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirm ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[11px] text-rose-400 font-medium mt-1">Las contraseñas no coinciden.</p>
            )}
          </div>

          {/* Password Policy Rules Indicator */}
          <div className="p-3.5 bg-surface-subtle border border-border/60 rounded-xl space-y-2">
            <p className="text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider">
              Requisitos de seguridad:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-foreground-muted">
              <li className={`flex items-center gap-1.5 ${policy.details.minLength ? "text-emerald-400" : ""}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {policy.details.minLength ? "check_circle" : "radio_button_unchecked"}
                </span>
                8 a 128 caracteres
              </li>
              <li className={`flex items-center gap-1.5 ${policy.details.hasUpper ? "text-emerald-400" : ""}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {policy.details.hasUpper ? "check_circle" : "radio_button_unchecked"}
                </span>
                Una mayúscula (A-Z)
              </li>
              <li className={`flex items-center gap-1.5 ${policy.details.hasLower ? "text-emerald-400" : ""}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {policy.details.hasLower ? "check_circle" : "radio_button_unchecked"}
                </span>
                Una minúscula (a-z)
              </li>
              <li className={`flex items-center gap-1.5 ${policy.details.hasNumber ? "text-emerald-400" : ""}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {policy.details.hasNumber ? "check_circle" : "radio_button_unchecked"}
                </span>
                Un número (0-9)
              </li>
              <li className={`flex items-center gap-1.5 ${policy.details.hasSymbol ? "text-emerald-400" : ""} sm:col-span-2`}>
                <span className="material-symbols-outlined text-[14px]">
                  {policy.details.hasSymbol ? "check_circle" : "radio_button_unchecked"}
                </span>
                Un carácter especial (!@#$%^&*...)
              </li>
            </ul>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isPending || !policy.isValid || !passwordsMatch}
            className="w-full h-11 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            {isPending ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ACTUALIZANDO...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">verified</span>
                ACTUALIZAR CONTRASEÑA
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-[11px] text-foreground-muted">
          <span className="material-symbols-outlined text-[15px] text-primary">security</span>
          <span>Encriptación AES-256 / scrypt con protección de sesión</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-foreground-muted text-[11px] font-mono">
        © {new Date().getFullYear()} RIDE LAB — WORKSHOP MANAGEMENT SYSTEM
      </footer>
    </main>
  );
}
