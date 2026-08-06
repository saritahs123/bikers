export function TopBar() {
  return (
    <header className="fixed top-0 right-0 h-16 ml-64 w-[calc(100%-16rem)] bg-surface border-b border-outline-variant flex justify-between items-center px-xl z-40">
      <div className="flex items-center gap-md"></div>
      <div className="flex items-center gap-lg">
        <div className="flex items-center gap-md">
          <button className="relative text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border border-surface"></span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant"></div>
        <div className="flex items-center gap-sm">
          <div className="text-right hidden lg:block">
            <p className="font-label-caps text-[12px] text-on-surface leading-none">
              Shop Manager
            </p>
            <p className="font-label-caps text-[10px] text-on-surface-variant">
              Bikers' Fort Core
            </p>
          </div>
          <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant">
              person
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
