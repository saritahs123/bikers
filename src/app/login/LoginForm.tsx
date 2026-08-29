"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction } from "./actions";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [identifierVal, setIdentifierVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.error) {
      setPasswordVal("");
      if (identifierVal.trim()) {
        passwordRef.current?.focus();
      } else {
        identifierRef.current?.focus();
      }
    }
  }, [state]);

  return (
    <main className="min-h-screen min-h-dvh py-6 px-4 sm:px-6 md:py-10 md:px-8 lg:px-10 relative z-10 flex flex-col justify-between overflow-x-hidden">
      {/* Background Layers */}
      <div className="fixed inset-0 bg-[radial-gradient(circle,#2d3748_1px,transparent_1px)] bg-[length:24px_24px] opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-tr from-surface-container-lowest via-transparent to-surface-container-low pointer-events-none opacity-50"></div>

      <div className="mx-auto w-full max-w-[460px] lg:max-w-5xl xl:max-w-6xl flex flex-col lg:flex-row items-stretch my-auto border border-[#2d3748] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] bg-surface relative z-20 overflow-hidden">
        
        {/* Left Side: Visual Narrative (hidden on mobile/tablet portrait <1024px, visible lg+) */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden group min-h-[520px]">
          <div className="absolute inset-0 bg-[#0e0f0a]/40 z-10"></div>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNIiO5saDtrBa-3jVTzTsab6kX5EuUffvfkSAXlGjmmzPM32Eowk6cVBkeeK0SFsK_39ds9SNkm8dJfU7eQ_LhPRlOm9TUHAZxJqNlo1zSx-DSyXc7G3cYNq2uydhERkHJQFJWwW_PrNeQzvNELcMGLs09C6gzqt3KLsrPUFm3aIzICbzfNqDp1kc2GuUzrzboUwFWk049NTgXialgm5Cn3Ap1ktElQjwVwZoCX_Vy3eeIltZ0ek2w=w2048"
            alt="Bicycle workshop mechanic"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute bottom-6 lg:bottom-10 z-20 left-6 right-6 lg:left-10 lg:right-10">
            <div className="p-6 lg:p-8 backdrop-blur-md bg-[#0e0f0a]/60 border border-[#46483b]">
              <h2 className="text-xl lg:text-[24px] font-bold text-[#bfce7f] mb-2 leading-tight">Ingeniería en Cada Detalle</h2>
              <p className="text-sm lg:text-[16px] text-[#c7c8b7] leading-relaxed">Sistema central de gestión para talleres de alto rendimiento y control de inventario técnico.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 md:p-10 lg:p-14 xl:p-16 bg-[#1f201a]">
          <div className="w-full max-w-[384px] flex flex-col items-center mx-auto">
            
            {/* Logo Header */}
            <div className="mb-6 sm:mb-8 w-full flex justify-center relative h-24 sm:h-28 md:h-32">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQsHXizSsIBMDwL7CfWGuh1piUa7nML2qajgrM7gURI1WTI23Yiqdyx4mb2NmBQQFg9HuPpoAeKbkqw42UqACCcF9d10BLrZ8jL5tntjp1Xft5wGazfeqHkVGJga6K99Fs_qAGUVq52QUz55MLEgC8Jt8rVZknQjwy8cGdpLKrcH9V7qLKmsUfsNZb2KvT8Y0Ob7ooWBCQVup0AZRys0LGLsIdd4dN1aIpJP18pMDQbfg-2SRWVgSbcyGKMbiHh1830A"
                alt="Bikers' Fort Core Logo"
                className="h-full w-auto object-contain"
              />
            </div>
            
            <div className="w-full text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl md:text-[24px] font-bold text-[#e4e3d9] tracking-tight whitespace-normal">CONTROL DE ACCESO</h1>
              <p className="text-[11px] sm:text-[12px] text-[#c7c8b7] mt-1.5 sm:mt-2 uppercase tracking-[0.1em] font-mono">Workshop Management v4.2</p>
            </div>

            {/* Error Banner */}
            {state?.error && (
              <div
                role="alert"
                aria-live="polite"
                className="w-full mb-6 px-4 py-3 bg-red-950/20 border border-red-800/40 text-red-300 text-xs sm:text-[13px] font-mono flex items-center gap-2.5 rounded-none"
              >
                <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0">error</span>
                <span className="truncate">{state.error}</span>
              </div>
            )}

            {/* Login Form */}
            <form noValidate action={formAction} className="w-full flex flex-col gap-5 sm:gap-6">
              <div className="w-full flex flex-col gap-1.5 sm:gap-2">
                <label className="text-[11px] sm:text-[12px] tracking-[0.1em] font-bold text-[#c7c8b7] uppercase font-mono" htmlFor="username">
                  IDENTIFICADOR DE ACCESO
                </label>
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#919282] pointer-events-none text-[20px]">badge</span>
                  <input
                    ref={identifierRef}
                    name="identifier"
                    id="username"
                    type="text"
                    value={identifierVal}
                    onChange={(e) => setIdentifierVal(e.target.value)}
                    placeholder="usuario@empresa.com o cédula"
                    className="w-full h-12 sm:h-14 pl-12 pr-4 bg-white border border-[#2d3748] focus:border-[#bfce7f] focus:outline-none focus:ring-1 focus:ring-[#bfce7f] text-black text-base font-medium transition-colors rounded-none"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-1.5 sm:gap-2">
                <label className="text-[11px] sm:text-[12px] tracking-[0.1em] font-bold text-[#c7c8b7] uppercase font-mono" htmlFor="password">
                  CONTRASEÑA
                </label>
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#919282] pointer-events-none text-[20px]">lock</span>
                  <input
                    ref={passwordRef}
                    name="password"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={passwordVal}
                    onChange={(e) => setPasswordVal(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 sm:h-14 pl-12 pr-12 bg-white border border-[#2d3748] focus:border-[#bfce7f] focus:outline-none focus:ring-1 focus:ring-[#bfce7f] text-black text-base font-medium transition-colors rounded-none"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#919282] hover:text-[#bfce7f] transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px]"
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <label className="flex items-center group cursor-pointer select-none" htmlFor="rememberMe">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    value="true"
                    className="w-5 h-5 border-[#46483b] bg-[#0e0f0a] text-[#bfce7f] focus:ring-[#bfce7f] focus:ring-offset-[#1f201a] rounded-none cursor-pointer"
                  />
                  <span className="ml-2.5 text-xs sm:text-[14px] text-[#c7c8b7] group-hover:text-[#e4e3d9] transition-colors">Recordarme</span>
                </label>
                <span className="text-xs sm:text-[14px] text-slate-500 opacity-60 cursor-not-allowed" title="Funcionalidad pendiente para una fase posterior">
                  ¿Olvidaste tu contraseña?
                </span>
              </div>

              <button
                type="submit"
                disabled={isPending}
                aria-disabled={isPending}
                className="w-full h-12 sm:h-14 bg-[#bfce7f] text-[#2b3400] font-bold text-base sm:text-[18px] uppercase tracking-wider hover:bg-[#dbea98] transition-all active:scale-[0.98] mt-2 sm:mt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
              >
                {isPending ? "VALIDANDO..." : "INICIAR SESIÓN"}
              </button>
            </form>

            {/* Security Badges */}
            <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6 opacity-60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#bfce7f] text-[18px]">verified_user</span>
                <span className="font-mono text-[10px] text-[#e4e3d9] uppercase tracking-widest">Protocolo AES-256</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#bfce7f] text-[18px]">encrypted</span>
                <span className="font-mono text-[10px] text-[#e4e3d9] uppercase tracking-widest">Acceso Encriptado</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full mt-8 py-6 px-4 md:px-10 border-t border-[#46483b]/30 z-10 flex flex-col md:flex-row justify-between items-center gap-3 text-center md:text-left text-[#c7c8b7] font-mono text-[10px] sm:text-[11px] tracking-widest uppercase">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
          <span>© 2024 BIKER&apos;S FORT CORE. TODOS LOS DERECHOS RESERVADOS.</span>
          <span className="hidden md:inline">|</span>
          <span>SYSTEM STATUS: <span className="text-[#bfce7f]">ONLINE</span></span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <a className="hover:text-[#bfce7f] transition-colors" href="#">SOPORTE TÉCNICO</a>
          <a className="hover:text-[#bfce7f] transition-colors" href="#">POLÍTICA DE PRIVACIDAD</a>
          <span className="text-[#e4e3d9]">BUILD ID: 03.11.2024.BFC</span>
        </div>
      </footer>
    </main>
  );
}
