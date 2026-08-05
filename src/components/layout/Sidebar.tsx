"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  const navItems = [
    { href: "/", icon: "dashboard", label: "Dashboard" },
    {
      id: "crm",
      icon: "group",
      label: "CRM",
      submenu: [
        { href: "/crm/customers", label: "Clientes" },
        { href: "/crm/bicycles", label: "Bicicletas" },
        { href: "/crm/component-categories", label: "Categorías Componentes" },
        { href: "/crm/component-states", label: "Estados Componentes" }
      ]
    },
    {
      id: "seguridad",
      icon: "verified_user",
      label: "Seguridad",
      submenu: [
        { href: "/settings/security/users", label: "Administrar Usuarios" },
        { href: "/settings/security/roles", label: "Matriz de Roles" },
        { href: "/settings/security/catalogs", label: "Panel de Catálogos" },
        { href: "/settings/security/company-types", label: "Tipos de Empresa" },
        { href: "/settings/security/companies", label: "Empresas" },
        { href: "/settings/security/departments", label: "Departamentos" },
        { href: "/settings/security/areas", label: "Áreas" },
        { href: "/settings/security/positions", label: "Cargos" },
        { href: "/settings/security/user-types", label: "Tipos de Usuario" }
      ]
    }
  ];

  useEffect(() => {
    // Expand menus if a child is active
    navItems.forEach((item) => {
      if (item.submenu) {
        const hasActiveChild = item.submenu.some(sub => sub.href && pathname.startsWith(sub.href));
        if (hasActiveChild) {
          setExpanded(item.id!);
        }
      }
    });
  }, [pathname]);

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant flex flex-col p-lg z-50">
      <div className="mb-xl flex flex-col items-center">
        <div className="w-32 h-20 mb-md relative">
          <Image src="/logo.png" alt="Bikers' Fort Logo" fill className="object-contain" />
        </div>
        <div className="text-center">
          <h1 className="font-headline-lg text-[20px] font-bold text-on-surface leading-tight">
            Bikers' Fort
          </h1>
          <p className="font-label-caps text-[10px] text-primary tracking-widest uppercase">
            Core Management
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-lg px-lg">
        <nav className="space-y-sm">
          {navItems.map((item) => {
            if (item.submenu) {
              const isExpanded = expanded === item.id;
              const hasActiveChild = item.submenu.some(sub => sub.href && pathname.startsWith(sub.href));
              const isGroupActive = isExpanded || hasActiveChild;
              
              return (
                <div key={item.id} className="flex flex-col">
                  <button
                    onClick={() => toggleExpand(item.id!)}
                    className={`flex items-center gap-md p-md rounded transition-colors w-full cursor-pointer ${
                      isGroupActive
                        ? "bg-surface-container-highest text-primary font-bold shadow-[inset_4px_0_0_#bfce7f]"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span className="font-label-caps text-label-caps flex-1 text-left">{item.label}</span>
                    <span className="material-symbols-outlined text-sm">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  
                  {isExpanded && (
                    <div className="flex flex-col mt-xs ml-[24px] pl-md border-l border-outline-variant space-y-xs py-xs">
                      {item.submenu.map((sub, idx) => {
                        if (sub.isHeader) {
                          return (
                            <span key={idx} className="font-label-caps text-[10px] font-bold text-primary tracking-wider mt-sm mb-xs uppercase">
                              {sub.label}
                            </span>
                          );
                        }
                        
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            key={idx}
                            href={sub.href || '#'}
                            title={sub.label}
                            className={`text-xs py-[6px] px-2 rounded transition-colors whitespace-nowrap truncate block ${
                              isSubActive
                                ? "text-primary font-bold bg-surface-container-highest"
                                : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
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
                className={`flex items-center gap-md p-md rounded transition-colors ${
                  isActive 
                    ? "bg-surface-container-highest text-primary font-bold shadow-[inset_4px_0_0_#bfce7f]" 
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-label-caps text-label-caps">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
