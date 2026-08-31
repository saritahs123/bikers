"use client";

import Link from "next/link";
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
  isOpen = false,
  onClose = () => {},
  onNavigate = () => {},
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const currentFullUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

  // Close sidebar on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const navItems: NavItem[] = [
    {
      id: "taller",
      icon: "build",
      label: "TALLER",
      submenu: [
        { href: "/", label: "DASHBOARD" },
        { href: "/workshop", label: "PANEL OPERATIVO" },
        { href: "/workshop?view=list", label: "RECEPCIONES" },
        { href: "/workshop?view=work_orders", label: "ÓRDENES DE TRABAJO" },
        { href: "/workshop?view=kanban", label: "VISTA KANBAN" },
        { href: "/workshop?view=billing", label: "DESPACHO DE ÓRDENES" },
        { href: "/workshop/service-types", label: "TIPOS DE SERVICIO" },
        { href: "/workshop/products", label: "PRODUCTOS" },
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
    const currentInvoiceOrderId = searchParams?.get("invoice_order_id");

    if (subHref === "/") {
      return pathname === "/";
    }
    if (subHref === "/workshop") {
      return pathname === "/workshop" && !currentView && !currentAction && !currentId && !currentOrderId && !currentInvoiceOrderId;
    }
    if (subHref === "/workshop?view=list") {
      return pathname === "/workshop" && (currentView === "list" || (!!currentId && !currentOrderId && !currentInvoiceOrderId));
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
    if (subHref === "/workshop?view=billing") {
      return pathname === "/workshop" && (currentView === "billing" || !!currentInvoiceOrderId);
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
        <div key={item.id} className="flex flex-col mb-2 font-mono">
          <button
            type="button"
            onClick={() => toggleExpand(item.id!)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 w-full cursor-pointer group text-xs ${
              isGroupActive
                ? "bg-surface-subtle border-primary/40 text-primary font-bold shadow-[inset_4px_0_0_var(--color-primary)]"
                : "bg-surface-subtle/50 border-border text-foreground-secondary hover:bg-surface-subtle hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-colors ${
                isGroupActive ? "text-primary" : "text-foreground-muted group-hover:text-primary"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`flex-1 text-left tracking-wide font-medium uppercase ${
                isGroupActive ? "text-foreground font-bold" : "text-foreground-secondary group-hover:text-foreground"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`material-symbols-outlined text-sm transition-transform duration-200 ${
                isExpanded ? "rotate-180 text-primary" : "text-foreground-muted group-hover:text-foreground"
              }`}
            >
              expand_more
            </span>
          </button>

          {isExpanded && (
            <div className="flex flex-col mt-1.5 ml-4 pl-3.5 border-l-2 border-border space-y-1 py-1 font-mono text-xs animate-in fade-in duration-200">
              {item.submenu.map((sub, idx) => {
                if (sub.isHeader) {
                  return (
                    <span
                      key={idx}
                      className="text-[10px] font-bold text-primary tracking-wider mt-2 mb-1 uppercase"
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
                    onClick={() => {
                      onNavigate();
                    }}
                    className={`text-xs py-2 px-3 rounded-lg border transition-all duration-200 whitespace-nowrap truncate block uppercase ${
                      isSubActive
                        ? "bg-primary/10 border-primary/40 text-primary font-bold"
                        : "border-transparent text-foreground-muted hover:text-foreground hover:bg-hover hover:border-border"
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
        onClick={() => {
          onNavigate();
        }}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer group font-mono text-xs mb-2 ${
          isActive
            ? "bg-surface-subtle border-primary/40 text-primary font-bold shadow-[inset_4px_0_0_var(--color-primary)]"
            : "bg-surface-subtle/50 border-border text-foreground-secondary hover:bg-surface-subtle hover:border-primary/40 hover:text-foreground"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] transition-colors ${
            isActive ? "text-primary" : "text-foreground-muted group-hover:text-primary"
          }`}
        >
          {item.icon}
        </span>
        <span
          className={`tracking-wide font-medium uppercase ${
            isActive ? "text-foreground font-bold" : "text-foreground-secondary group-hover:text-foreground"
          }`}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile/Tablet Semi-transparent Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Unified Responsive Sidebar (Desktop Fixed / Mobile Drawer) */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-surface border-r border-border flex flex-col pt-5 pb-4 px-4 z-45 font-mono transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        aria-label="Menú principal de navegación"
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
          <nav className="space-y-1">
            {navItems.map((item) => renderItemCard(item))}
          </nav>
        </div>
      </aside>
    </>
  );
}

export function Sidebar({
  isOpen = false,
  onClose = () => {},
  onNavigate = () => {},
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <Suspense
      fallback={
        <aside className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-border flex-col p-4 z-45 font-mono animate-pulse -translate-x-full pointer-events-none" />
      }
    >
      <SidebarContent isOpen={isOpen} onClose={onClose} onNavigate={onNavigate} />
    </Suspense>
  );
}
