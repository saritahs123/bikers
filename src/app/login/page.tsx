import { loginAction } from "./actions";

export default function LoginPage() {
  return (
    <main className="min-h-screen py-12 px-4 md:px-10 relative z-10 flex flex-col justify-center">
      {/* Background Layers */}
      <div className="fixed inset-0 bg-[radial-gradient(circle,#2d3748_1px,transparent_1px)] bg-[length:24px_24px] opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-tr from-surface-container-lowest via-transparent to-surface-container-low pointer-events-none opacity-50"></div>

      <div className="mx-auto w-full max-w-7xl flex flex-col md:flex-row items-stretch min-h-[600px] border border-[#2d3748] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] bg-surface relative z-20 overflow-hidden">
        
        {/* Left Side: Visual Narrative */}
        <div className="hidden md:flex md:w-1/2 relative overflow-hidden group" style={{ width: "50%", flexBasis: "50%", flexShrink: 0 }}>
          <div className="absolute inset-0 bg-[#0e0f0a]/40 z-10"></div>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNIiO5saDtrBa-3jVTzTsab6kX5EuUffvfkSAXlGjmmzPM32Eowk6cVBkeeK0SFsK_39ds9SNkm8dJfU7eQ_LhPRlOm9TUHAZxJqNlo1zSx-DSyXc7G3cYNq2uydhERkHJQFJWwW_PrNeQzvNELcMGLs09C6gzqt3KLsrPUFm3aIzICbzfNqDp1kc2GuUzrzboUwFWk049NTgXialgm5Cn3Ap1ktElQjwVwZoCX_Vy3eeIltZ0ek2w=w2048"
            alt="Bicycle workshop mechanic"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute bottom-10 z-20" style={{ left: "2.5rem", right: "2.5rem", width: "calc(100% - 5rem)" }}>
            <div className="p-8 backdrop-blur-md bg-[#0e0f0a]/60 border border-[#46483b]">
              <h2 className="text-[24px] font-bold text-[#bfce7f] mb-2">Ingeniería en Cada Detalle</h2>
              <p className="text-[16px] text-[#c7c8b7] leading-relaxed">Sistema central de gestión para talleres de alto rendimiento y control de inventario técnico.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16 bg-[#1f201a]" style={{ width: "50%", flexBasis: "50%", flexShrink: 0 }}>
          <div className="w-full max-w-sm flex flex-col items-center" style={{ width: "100%", maxWidth: "384px" }}>
            
            {/* Logo Header */}
            <div className="mb-10 w-full flex justify-center relative h-32">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQsHXizSsIBMDwL7CfWGuh1piUa7nML2qajgrM7gURI1WTI23Yiqdyx4mb2NmBQQFg9HuPpoAeKbkqw42UqACCcF9d10BLrZ8jL5tntjp1Xft5wGazfeqHkVGJga6K99Fs_qAGUVq52QUz55MLEgC8Jt8rVZknQjwy8cGdpLKrcH9V7qLKmsUfsNZb2KvT8Y0Ob7ooWBCQVup0AZRys0LGLsIdd4dN1aIpJP18pMDQbfg-2SRWVgSbcyGKMbiHh1830A" alt="Bikers' Fort Core Logo" className="h-full w-auto object-contain" />
            </div>
            
            <div className="w-full text-center mb-8">
              <h1 className="text-[24px] font-bold text-[#e4e3d9] tracking-tight">CONTROL DE ACCESO</h1>
              <p className="text-[12px] text-[#c7c8b7] mt-2 uppercase tracking-[0.1em] font-mono">Workshop Management v4.2</p>
            </div>

            {/* Login Form */}
            <form action={loginAction} className="w-full flex flex-col gap-6">
              <div className="w-full flex flex-col gap-2">
                <label className="text-[12px] tracking-[0.1em] font-bold text-[#c7c8b7] uppercase font-mono" htmlFor="username">
                  NOMBRE DE USUARIO / EMAIL
                </label>
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#919282] pointer-events-none">person</span>
                  <input
                    name="email"
                    id="username"
                    type="text"
                    required
                    placeholder="admin@bikersfort.com"
                    className="w-full h-14 pl-12 pr-4 bg-white border border-[#2d3748] focus:border-[#bfce7f] focus:outline-none focus:ring-1 focus:ring-[#bfce7f] text-black text-[16px] font-medium transition-colors rounded-none"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <label className="text-[12px] tracking-[0.1em] font-bold text-[#c7c8b7] uppercase font-mono" htmlFor="password">
                  CONTRASEÑA
                </label>
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#919282] pointer-events-none">lock</span>
                  <input
                    name="password"
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full h-14 pl-12 pr-12 bg-white border border-[#2d3748] focus:border-[#bfce7f] focus:outline-none focus:ring-1 focus:ring-[#bfce7f] text-black text-[16px] font-medium transition-colors rounded-none"
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#919282] cursor-pointer hover:text-[#bfce7f] transition-colors">visibility</span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full">
                <label className="flex items-center group cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 border-[#46483b] bg-[#0e0f0a] text-[#bfce7f] focus:ring-[#bfce7f] focus:ring-offset-[#1f201a] rounded-none" />
                  <span className="ml-3 text-[14px] text-[#c7c8b7] group-hover:text-[#e4e3d9] transition-colors">Recordarme</span>
                </label>
                <a href="#" className="text-[14px] text-[#bfce7f] hover:text-[#dbea98] transition-colors">¿Olvidaste tu contraseña?</a>
              </div>

              <button type="submit" className="w-full h-14 bg-[#bfce7f] text-[#2b3400] font-bold text-[18px] uppercase tracking-wider hover:bg-[#dbea98] transition-all active:scale-[0.98] mt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                Iniciar Sesión
              </button>
            </form>

            {/* Security Badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-6 opacity-60">
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
      <footer className="w-full absolute bottom-0 left-0 right-0 py-8 px-4 md:px-10 border-t border-[#46483b]/30 z-10 flex flex-col md:flex-row justify-between items-center gap-4 text-[#c7c8b7] font-mono text-[10px] tracking-widest uppercase">
        <div className="flex items-center gap-4">
          <span>© 2024 BIKER&apos;S FORT CORE. TODOS LOS DERECHOS RESERVADOS.</span>
          <span className="hidden md:block">|</span>
          <span>SYSTEM STATUS: <span className="text-[#bfce7f]">ONLINE</span></span>
        </div>
        <div className="flex gap-6">
          <a className="hover:text-[#bfce7f] transition-colors" href="#">SOPORTE TÉCNICO</a>
          <a className="hover:text-[#bfce7f] transition-colors" href="#">POLÍTICA DE PRIVACIDAD</a>
          <span className="text-[#e4e3d9]">BUILD ID: 03.11.2024.BFC</span>
        </div>
      </footer>
    </main>
  );
}
