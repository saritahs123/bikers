"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Boxes, 
  Users, 
  Network, 
  GitFork, 
  Briefcase, 
  ArrowRight, 
  Activity, 
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function CatalogsSecurityView() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  // Real catalog counters & live stats from PostgreSQL
  const [stats, setStats] = useState({
    empresas: 0,
    tiposEmpresa: 0,
    tiposUsuario: 0,
    departamentos: 0,
    areas: 0,
    cargos: 0
  });

  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    fetchLiveStatsAndActivity();
  }, []);

  const fetchLiveStatsAndActivity = async () => {
    try {
      setLoading(true);
      const [empRes, tiposEmpRes, tiposUsuRes, depRes, areasRes, cargosRes, meRes] = await Promise.allSettled([
        fetch('/api/empresas').then(r => r.ok ? r.json() : []),
        fetch('/api/tipos-empresa').then(r => r.ok ? r.json() : []),
        fetch('/api/tipos-usuario').then(r => r.ok ? r.json() : []),
        fetch('/api/departamentos').then(r => r.ok ? r.json() : []),
        fetch('/api/areas').then(r => r.ok ? r.json() : []),
        fetch('/api/cargos').then(r => r.ok ? r.json() : []),
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
      ]);

      const getCount = (res) => {
        if (res.status !== 'fulfilled' || !res.value) return 0;
        const v = res.value;
        if (Array.isArray(v)) return v.length;
        if (Array.isArray(v.data)) return v.data.length;
        if (Array.isArray(v.items)) return v.items.length;
        return 0;
      };

      setStats({
        empresas: getCount(empRes),
        tiposEmpresa: getCount(tiposEmpRes),
        tiposUsuario: getCount(tiposUsuRes),
        departamentos: getCount(depRes),
        areas: getCount(areasRes),
        cargos: getCount(cargosRes)
      });

      // Fetch authentic audit logs for authenticated user if available
      if (meRes.status === 'fulfilled' && meRes.value) {
        const me = meRes.value;
        const currentUserId = me.usuario_id || me.id;
        if (currentUserId) {
          try {
            const auditRes = await fetch(`/api/usuarios/${currentUserId}/auditoria?pageSize=5`);
            if (auditRes.ok) {
              const auditData = await auditRes.json();
              const items = Array.isArray(auditData.items) ? auditData.items : (Array.isArray(auditData) ? auditData : []);
              const mapped = items.map((a, idx) => ({
                id: a.auditoria_id || a.id || idx,
                date: a.fecha_hora ? new Date(a.fecha_hora).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—',
                user: a.admin_nombre || a.nombre || me.full_name || 'Administrador',
                catalog: a.modulo || 'Seguridad',
                action: a.accion ? `${a.accion}${a.motivo ? `: ${a.motivo}` : ''}` : 'Actualización',
                status: a.resultado || 'COMPLETADO'
              }));
              setActivityLogs(mapped);
            } else {
              setActivityLogs([]);
            }
          } catch {
            setActivityLogs([]);
          }
        }
      } else {
        setActivityLogs([]);
      }
    } catch (err) {
      console.error('Error loading catalogs stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const catalogDefinitions = [
    {
      id: "empresas",
      title: "Empresas",
      description: "Gestión de sucursales, filiales y entidades operativas de la corporación.",
      icon: Building2,
      count: stats.empresas,
      badge: "ACTIVO",
      route: "/settings/security/companies"
    },
    {
      id: "tiposEmpresa",
      title: "Tipos de Empresa",
      description: "Clasificación por sector, tamaño y estructura legal aplicable.",
      icon: Boxes,
      count: stats.tiposEmpresa,
      badge: null,
      route: "/settings/security/company-types"
    },
    {
      id: "tiposUsuario",
      title: "Tipos de Usuario",
      description: "Definición de perfiles de acceso y permisos base del sistema.",
      icon: Users,
      count: stats.tiposUsuario,
      badge: null,
      route: "/settings/security/user-types"
    },
    {
      id: "departamentos",
      title: "Departamentos",
      description: "Unidades funcionales superiores del organigrama empresarial.",
      icon: Network,
      count: stats.departamentos,
      badge: null,
      route: "/settings/security/departments"
    },
    {
      id: "areas",
      title: "Áreas",
      description: "Sub-unidades operativas especializadas en tareas y servicios.",
      icon: GitFork,
      count: stats.areas,
      badge: null,
      route: "/settings/security/areas"
    },
    {
      id: "cargos",
      title: "Cargos",
      description: "Definición de posiciones de trabajo, responsabilidades y tabuladores.",
      icon: Briefcase,
      count: stats.cargos,
      badge: null,
      route: "/settings/security/positions"
    }
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNavigate = (route) => {
    router.push(route);
  };

  const filteredCatalogs = catalogDefinitions.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto font-sans text-foreground">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border border-primary/40 text-foreground px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={16} className="text-primary shrink-0" />
          <span className="text-xs font-mono font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary bg-surface-subtle border border-border px-2.5 py-0.5 rounded-full">
              Sistema Maestro
            </span>
            <span className="text-xs text-foreground-muted font-mono">• 6 Módulos Oficiales</span>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            Catálogos del Sistema
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Administración centralizada de entidades organizacionales y parámetros maestros de Bikers&apos; Fort Core.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={14} />
            <input
              type="text"
              placeholder="Buscar catálogo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-input border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors w-48 md:w-64 font-sans"
            />
          </div>

          <button
            type="button"
            onClick={fetchLiveStatsAndActivity}
            disabled={loading}
            className="p-2 bg-surface-subtle border border-border hover:bg-hover text-foreground-secondary hover:text-foreground rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Recargar estadísticas"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-primary" : ""} />
          </button>
        </div>
      </section>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCatalogs.map((cat) => {
          const IconComp = cat.icon;
          return (
            <div 
              key={cat.id}
              className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-primary/40 hover:-translate-y-1 transition-all duration-200 shadow-sm group"
            >
              <div>
                <div className="flex justify-between items-start mb-5">
                  <div className="w-12 h-12 bg-surface-subtle border border-border rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <IconComp size={24} />
                  </div>
                  {cat.badge && (
                    <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 bg-primary/15 text-primary border border-primary/30 rounded-md tracking-wider">
                      {cat.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-foreground mb-1.5 tracking-tight font-sans">
                  {cat.title}
                </h3>
                <p className="text-xs text-foreground-muted leading-relaxed mb-6 font-sans">
                  {cat.description}
                </p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex justify-between items-end border-t border-border pt-4">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-foreground-muted uppercase">REGISTROS EN BD</span>
                  <span className="text-2xl font-black text-foreground font-mono">{cat.count}</span>
                </div>

                <button 
                  type="button"
                  onClick={() => handleNavigate(cat.route)}
                  className="w-full py-2.5 bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  ADMINISTRAR <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table Section */}
      <section className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-surface-subtle flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-primary tracking-widest flex items-center gap-2">
            <Activity size={14} /> ACTIVIDAD RECIENTE DE AUDITORÍA Y ACCESO
          </h3>
          <span className="text-[11px] font-mono text-foreground-muted">Registros verificados en PostgreSQL</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle text-foreground-muted font-mono text-[10px] tracking-wider border-b border-border">
                <th className="px-6 py-3">FECHA / HORA</th>
                <th className="px-6 py-3">USUARIO / ADMIN</th>
                <th className="px-6 py-3">MÓDULO</th>
                <th className="px-6 py-3">ACCIÓN</th>
                <th className="px-6 py-3 text-right">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground-secondary">
              {activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-foreground-muted font-sans text-xs italic">
                    No hay registros de actividad reciente en los catálogos.
                  </td>
                </tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-hover transition-colors font-medium">
                    <td className="px-6 py-3.5 font-mono text-foreground-muted text-[11px]">{log.date}</td>
                    <td className="px-6 py-3.5 font-bold text-foreground">{log.user}</td>
                    <td className="px-6 py-3.5 font-semibold text-primary">{log.catalog}</td>
                    <td className="px-6 py-3.5 text-foreground-secondary">{log.action}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold border ${
                        log.status === "COMPLETADO" || log.status === "EXITOSO"
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-error/15 text-error border-error/30"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
