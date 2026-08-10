"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

interface SubMenuItem {
  href?: string;
  label: string;
  isHeader?: boolean;
}

interface NavItem {
  id?: string;
  href?: string;
  icon: string;
  label: string;
  submenu?: SubMenuItem[];
}

function SidebarContent({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const currentFullUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

  const navItems: NavItem[] = [
    { href: "/", icon: "dashboard", label: "DASHBOARD" },
    {
      id: "taller",
      icon: "build",
      label: "TALLER",
      submenu: [
        { href: "/workshop", label: "PANEL OPERATIVO" },
        { href: "/workshop?view=list", label: "RECEPCIONES" },
        { href: "/workshop?action=new", label: "NUEVA RECEPCIÓN" },
        { href: "/workshop?view=work_orders", label: "ÓRDENES DE TRABAJO" },
        { href: "/workshop?view=kanban", label: "VISTA KANBAN" },
        { href: "/workshop?action=new_order", label: "NUEVA ORDEN DE TRABAJO" }
      ]
    },
    {
      id: "crm",
      icon: "group",
      label: "CRM",
      submenu: [
        { href: "/crm/customers", label: "CLIENTES" },
        { href: "/crm/bicycles", label: "BICICLETAS" },
        { href: "/crm/component-categories", label: "CATEGORÍAS COMPONENTES" },
        { href: "/crm/component-states", label: "ESTADOS COMPONENTES" }
      ]
    },
    {
      id: "seguridad",
      icon: "verified_user",
      label: "SEGURIDAD",
      submenu: [
        { href: "/settings/security/users", label: "ADMINISTRAR USUARIOS" },
        { href: "/settings/security/roles", label: "MATRIZ DE ROLES" },
        { href: "/settings/security/catalogs", label: "PANEL DE CATÁLOGOS" },
        { href: "/settings/security/company-types", label: "TIPOS DE EMPRESA" },
        { href: "/settings/security/companies", label: "EMPRESAS" },
        { href: "/settings/security/departments", label: "DEPARTAMENTOS" },
        { href: "/settings/security/areas", label: "ÁREAS" },
        { href: "/settings/security/positions", label: "CARGOS" },
        { href: "/settings/security/user-types", label: "TIPOS DE USUARIO" }
      ]
    }
  ];

  const isSubmenuActive = (subHref?: string) => {
    if (!subHref) return false;
    const currentView = searchParams?.get("view");
    const currentAction = searchParams?.get("action");
    const currentId = searchParams?.get("id");
    const currentOrderId = searchParams?.get("order_id");

    if (subHref === "/workshop") {
      return pathname === "/workshop" && !currentView && !currentAction && !currentId && !currentOrderId;
    }
    if (subHref === "/workshop?view=list") {
      return pathname === "/workshop" && (currentView === "list" || (!!currentId && !currentOrderId));
    }
    if (subHref === "/workshop?action=new") {
      return pathname === "/workshop" && currentAction === "new";
    }
    if (subHref === "/workshop?view=work_orders") {
      return pathname === "/workshop" && (currentView === "work_orders" || !!currentOrderId);
    }
    if (subHref === "/workshop?view=kanban") {
      return pathname === "/workshop" && currentView === "kanban";
    }
    if (subHref === "/workshop?action=new_order") {
      return pathname === "/workshop" && currentAction === "new_order";
    }
    if (subHref.includes("?")) {
      return currentFullUrl === subHref;
    }
    return pathname === subHref;
  };

  useEffect(() => {
    // Expand menus if a child is active
    navItems.forEach((item) => {
      if (item.submenu) {
        const hasActiveChild = item.submenu.some((sub) => isSubmenuActive(sub.href));

        if (hasActiveChild) {
          setExpanded(item.id!);
        }
      }
    });
  }, [pathname, currentFullUrl, searchParams]);

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
  };

  const renderItemCard = (item: NavItem) => {
    if (item.submenu) {
      const isExpanded = expanded === item.id;
      const hasActiveChild = item.submenu.some((sub) => isSubmenuActive(sub.href));
      const isGroupActive = isExpanded || hasActiveChild;

      return (
        <div key={item.id} className="flex flex-col mb-2">
          <button
            onClick={() => toggleExpand(item.id!)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 w-full cursor-pointer group font-mono text-xs ${
              isGroupActive
                ? "bg-[#161a21] border-[#bfce7f]/40 text-[#bfce7f] font-bold shadow-[inset_4px_0_0_#bfce7f,0_4px_12px_rgba(0,0,0,0.3)]"
                : "bg-[#161a21]/50 border-[#2d3748]/40 text-slate-400 hover:bg-[#161a21] hover:border-[#bfce7f]/30 hover:text-white"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-colors ${
                isGroupActive ? "text-[#bfce7f]" : "text-slate-400 group-hover:text-[#bfce7f]"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`flex-1 text-left tracking-wide font-medium uppercase ${
                isGroupActive ? "text-white font-bold" : "text-slate-300 group-hover:text-white"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`material-symbols-outlined text-sm transition-transform duration-200 ${
                isExpanded ? "rotate-180 text-[#bfce7f]" : "text-slate-400 group-hover:text-slate-200"
              }`}
            >
              expand_more
            </span>
          </button>

          {isExpanded && (
            <div className="flex flex-col mt-1.5 ml-4 pl-3.5 border-l-2 border-[#2d3748] space-y-1 py-1 font-mono text-xs animate-in fade-in duration-200">
              {item.submenu.map((sub, idx) => {
                if (sub.isHeader) {
                  return (
                    <span
                      key={idx}
                      className="text-[10px] font-bold text-[#bfce7f] tracking-wider mt-2 mb-1 uppercase"
                    >
                      {sub.label}
                    </span>
                  );
                }

                const isSubActive = isSubmenuActive(sub.href);

                return (
                  <Link
                    key={idx}
                    href={sub.href || "#"}
                    title={sub.label}
                    className={`text-xs py-2 px-3 rounded-lg border transition-all duration-200 whitespace-nowrap truncate block uppercase ${
                      isSubActive
                        ? "bg-[#bfce7f]/15 border-[#bfce7f]/40 text-[#bfce7f] font-bold"
                        : "border-transparent text-slate-400 hover:text-white hover:bg-[#161a21] hover:border-[#2d3748]"
                    }`}
                  >
                    {sub.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href!}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer group font-mono text-xs mb-2 ${
          isActive
            ? "bg-[#161a21] border-[#bfce7f]/40 text-[#bfce7f] font-bold shadow-[inset_4px_0_0_#bfce7f,0_4px_12px_rgba(0,0,0,0.3)]"
            : "bg-[#161a21]/50 border-[#2d3748]/40 text-slate-400 hover:bg-[#161a21] hover:border-[#bfce7f]/30 hover:text-white"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] transition-colors ${
            isActive ? "text-[#bfce7f]" : "text-slate-400 group-hover:text-[#bfce7f]"
          }`}
        >
          {item.icon}
        </span>
        <span
          className={`tracking-wide font-medium uppercase ${
            isActive ? "text-white font-bold" : "text-slate-300 group-hover:text-white"
          }`}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#0e1117] border-r border-[#2d3748] flex-col p-4 z-50 font-mono">
        <div className="mt-2 mb-6 flex justify-center items-center w-full">
          <div className="w-[120px] h-[120px] relative shrink-0">
            <Image src="/logo.png" alt="Bikers' Fort Logo" fill className="object-contain" priority />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
          <nav className="space-y-1">
            {navItems.map((item) => renderItemCard(item))}
          </nav>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen && setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#0e1117] border-r border-[#2d3748] flex flex-col p-4 z-50 font-mono h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mt-1 mb-4">
              <div className="w-[90px] h-[50px] relative shrink-0">
                <Image src="/logo.png" alt="Bikers' Fort Logo" fill className="object-contain" priority />
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg border border-slate-800"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2"
              onClick={() => setMobileOpen && setMobileOpen(false)}
            >
              <nav className="space-y-1">
                {navItems.map((item) => renderItemCard(item))}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function Sidebar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) {
  return (
    <Suspense
      fallback={
        <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#0e1117] border-r border-[#2d3748] flex-col p-4 z-50 font-mono">
          <div className="text-xs text-slate-400 p-4">Cargando menú...</div>
        </aside>
      }
    >
      <SidebarContent mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    </Suspense>
  );
}
