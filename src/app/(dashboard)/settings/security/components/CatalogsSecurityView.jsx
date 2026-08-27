"use client";

import React, { useState } from "react";
import { 
  Building2, 
  Boxes, 
  Users, 
  Network, 
  GitFork, 
  Briefcase, 
  ArrowRight, 
  Search, 
  Plus, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Activity, 
  Trash2,
  Cpu
} from "lucide-react";
import { catalogosService } from "@/services/catalogosService";

export default function CatalogsSecurityView() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  // Mock catalog counters & initial stats
  const [stats, setStats] = useState({
    empresas: 24,
    tiposEmpresa: 8,
    tiposUsuario: 12,
    departamentos: 15,
    areas: 42,
    cargos: 56
  });

  const [activityLogs, setActivityLogs] = useState([
    { id: 1, date: "2026-07-29 14:22", user: "Admin_Rodriguez", catalog: "Empresas", action: "Actualización: Sucursal Norte", status: "COMPLETADO" },
    { id: 2, date: "2026-07-29 13:05", user: "Sys_Auto_Task", catalog: "Cargos", action: "Sincronización masiva (12 items)", status: "COMPLETADO" },
    { id: 3, date: "2026-07-29 11:45", user: "User_Manager_HQ", catalog: "Áreas", action: "Nuevo registro: I+D Suspensión", status: "COMPLETADO" },
    { id: 4, date: "2026-07-29 09:12", user: "Admin_Rodriguez", catalog: "Tipos de Empresa", action: "Baja lógica: Consorcio Temporal", status: "REVERTIDO" },
    { id: 5, date: "2026-07-29 08:30", user: "Sys_Auto_Task", catalog: "Departamentos", action: "Auditoría de integridad estructural", status: "COMPLETADO" }
  ]);

  const catalogDefinitions = [
    {
      id: "empresas",
      title: "Empresas",
      description: "Gestión de sucursales y filiales operativas de la corporación.",
      icon: Building2,
      count: stats.empresas,
      progress: 75,
      badge: "ACTIVO",
      key: "empresa"
    },
    {
      id: "tiposEmpresa",
      title: "Tipos de Empresa",
      description: "Clasificación por sector, tamaño y estructura legal.",
      icon: Boxes,
      count: stats.tiposEmpresa,
      progress: 40,
      badge: null,
      key: "tipoEmpresa"
    },
    {
      id: "tiposUsuario",
      title: "Tipos de Usuario",
      description: "Definición de perfiles de acceso y permisos base.",
      icon: Users,
      count: stats.tiposUsuario,
      progress: 60,
      badge: null,
      key: "tipoUsuario"
    },
    {
      id: "departamentos",
      title: "Departamentos",
      description: "Unidades funcionales superiores del organigrama.",
      icon: Network,
      count: stats.departamentos,
      progress: 50,
      badge: null,
      key: "departamento"
    },
    {
      id: "areas",
      title: "Áreas",
      description: "Sub-unidades operativas enfocadas en tareas específicas.",
      icon: GitFork,
      count: stats.areas,
      progress: 85,
      badge: null,
      key: "area"
    },
    {
      id: "cargos",
      title: "Cargos",
      description: "Definición de posiciones, responsabilidades y tabuladores.",
      icon: Briefcase,
      count: stats.cargos,
      progress: 92,
      badge: null,
      key: "cargo"
    }
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenManage = async (cat) => {
    setSelectedCatalog(cat);
    setIsManageModalOpen(true);
    setLoading(true);
    try {
      if (cat.id === "departamentos") {
        const data = await catalogosService.getDepartamentos();
        setCatalogItems(data.map(d => ({ id: d.id, name: d.name || d.nombre, code: `DEP-${d.id}` })));
      } else if (cat.id === "areas") {
        const data = await catalogosService.getAreas();
        setCatalogItems(data.map(a => ({ id: a.id, name: a.name || a.nombre, code: `ARE-${a.id}` })));
      } else if (cat.id === "cargos") {
        const data = await catalogosService.getCargos();
        setCatalogItems(data.map(c => ({ id: c.id, name: c.name || c.nombre, code: `CAR-${c.id}` })));
      } else if (cat.id === "tiposUsuario") {
        const data = await catalogosService.getTiposUsuario();
        setCatalogItems(data.map(t => ({ id: t.id, name: t.name || t.nombre, code: `TIP-${t.id}` })));
      } else if (cat.id === "empresas") {
        setCatalogItems([
          { id: 1, name: "Biker's Fort Central", code: "EMP-001", status: "Activo" },
          { id: 2, name: "Biker's Fort Norte", code: "EMP-002", status: "Activo" },
          { id: 3, name: "Biker's Fort Este", code: "EMP-003", status: "Activo" },
          { id: 4, name: "Biker's Fort Sur", code: "EMP-004", status: "Inactivo" }
        ]);
      } else {
        setCatalogItems([
          { id: 1, name: "Sociedad Anónima (S.A.)", code: "TE-001" },
          { id: 2, name: "Responsabilidad Limitada (S.R.L.)", code: "TE-002" },
          { id: 3, name: "Empresa Individual (E.I.R.L.)", code: "TE-003" }
        ]);
      }
    } catch (e) {
      console.error("Error loading catalog details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      code: `${selectedCatalog.id.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      status: "Activo"
    };

    setCatalogItems(prev => [newItem, ...prev]);
    setStats(prev => ({
      ...prev,
      [selectedCatalog.id]: (prev[selectedCatalog.id] || 0) + 1
    }));

    const newLog = {
      id: Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: "Admin_Actual",
      catalog: selectedCatalog.title,
      action: `Creación: ${newItemName.trim()}`,
      status: "COMPLETADO"
    };
    setActivityLogs(prev => [newLog, ...prev]);

    setNewItemName("");
    setIsAddModalOpen(false);
    showToast(`Registro "${newItem.name}" añadido al catálogo ${selectedCatalog.title}.`);
  };

  const handleDeleteItem = (itemId, itemName) => {
    setCatalogItems(prev => prev.filter(i => i.id !== itemId));
    setStats(prev => ({
      ...prev,
      [selectedCatalog.id]: Math.max(0, (prev[selectedCatalog.id] || 0) - 1)
    }));

    const newLog = {
      id: Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: "Admin_Actual",
      catalog: selectedCatalog.title,
      action: `Baja: ${itemName}`,
      status: "COMPLETADO"
    };
    setActivityLogs(prev => [newLog, ...prev]);
    showToast(`Item "${itemName}" eliminado del catálogo.`);
  };

  const filteredCatalogs = catalogDefinitions.filter(cat => 
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300 font-sans text-foreground">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-primary text-primary-foreground px-5 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <section className="relative overflow-hidden border border-border p-6 md:p-8 bg-card rounded-2xl shadow-sm">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-primary">
          <Cpu size={140} />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                SYSTEM ADMINISTRATION • BIKER&apos;S FORT CORE
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1 font-sans">
                Panel de Control de Catálogos
              </h2>
            </div>
            
            <div className="flex items-center gap-3 bg-input border border-border px-3.5 py-1.5 rounded-xl text-xs font-mono">
              <Search size={14} className="text-foreground-muted" />
              <input 
                type="text"
                placeholder="Buscar catálogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-foreground placeholder:text-foreground-disabled focus:outline-none w-36 md:w-48 text-xs font-mono"
              />
            </div>
          </div>

          <p className="text-sm text-foreground-secondary max-w-3xl leading-relaxed font-sans">
            Gestione la arquitectura organizacional y operativa de Biker&apos;s Fort. Configure entidades, estructuras jerárquicas y roles maestros con precisión industrial.
          </p>

          <div className="pt-3 border-t border-border flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold tracking-wider uppercase">STATUS DEL SISTEMA</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="font-bold text-foreground">Operacional</span>
              </div>
            </div>

            <div className="w-px h-8 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold tracking-wider uppercase">ÚLTIMO RESPALDO</span>
              <span className="font-bold text-foreground-secondary mt-0.5">Hace 14 minutos</span>
            </div>

            <div className="w-px h-8 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold tracking-wider uppercase">CATÁLOGOS ACTIVOS</span>
              <span className="font-bold text-foreground mt-0.5">6 Módulos Maestros</span>
            </div>
          </div>
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
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-foreground-muted">REGISTROS</span>
                  <span className="text-2xl font-black text-foreground font-mono">{cat.count}</span>
                </div>

                {/* Segmented progress bar */}
                <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${cat.progress}%` }}
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => handleOpenManage(cat)}
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
            <Activity size={14} /> ACTIVIDAD RECIENTE DE CATÁLOGOS
          </h3>
          <span className="text-[11px] font-mono text-foreground-muted">Últimas acciones registradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle text-foreground-muted font-mono text-[10px] tracking-wider border-b border-border">
                <th className="px-6 py-3">FECHA / HORA</th>
                <th className="px-6 py-3">USUARIO</th>
                <th className="px-6 py-3">CATÁLOGO</th>
                <th className="px-6 py-3">ACCIÓN</th>
                <th className="px-6 py-3 text-right">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground-secondary">
              {activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-hover transition-colors font-medium">
                  <td className="px-6 py-3.5 font-mono text-foreground-muted text-[11px]">{log.date}</td>
                  <td className="px-6 py-3.5 font-bold text-foreground">{log.user}</td>
                  <td className="px-6 py-3.5 font-semibold text-primary">{log.catalog}</td>
                  <td className="px-6 py-3.5 text-foreground-secondary">{log.action}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold border ${
                      log.status === "COMPLETADO" 
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-error/15 text-error border-error/30"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* MANAGE CATALOG MODAL */}
      {isManageModalOpen && selectedCatalog && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsManageModalOpen(false)} />
          
          <div className="relative bg-surface-elevated border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-foreground">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-surface-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-surface border border-border rounded-lg flex items-center justify-center text-primary">
                  {React.createElement(selectedCatalog.icon, { size: 18 })}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground font-sans">{selectedCatalog.title}</h4>
                  <p className="text-[11px] text-foreground-muted font-mono">Administración del catálogo maestro</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsManageModalOpen(false)} 
                className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg hover:bg-hover transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="p-4 border-b border-border bg-surface flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-foreground-secondary">
                Total de registros: <strong className="text-foreground">{catalogItems.length}</strong>
              </span>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-primary-button-bg hover:brightness-110 text-primary-foreground text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer font-mono"
              >
                <Plus size={14} /> Nuevo Registro
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5 custom-scrollbar">
              {loading ? (
                <div className="py-12 text-center text-xs font-mono text-foreground-muted flex items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-primary" size={16} /> Cargando datos...
                </div>
              ) : catalogItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground-muted italic font-mono">
                  No hay registros creados en este catálogo.
                </div>
              ) : (
                catalogItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-surface-subtle border border-border rounded-xl flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-surface border border-border rounded text-[10px] font-mono text-primary font-bold">
                        {item.code}
                      </span>
                      <span className="text-xs font-bold text-foreground font-sans">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1.5 text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface-subtle flex justify-end">
              <button 
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-5 py-2 bg-surface text-foreground text-xs font-bold rounded-xl border border-border hover:bg-hover transition-all cursor-pointer font-mono"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM SUBMODAL */}
      {isAddModalOpen && selectedCatalog && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative bg-surface-elevated border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 text-foreground">
            <h4 className="text-base font-bold text-foreground mb-1 font-sans">Añadir a {selectedCatalog.title}</h4>
            <p className="text-xs text-foreground-muted mb-4 font-sans">Ingrese los datos para registrar un nuevo elemento maestro.</p>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold text-foreground-secondary uppercase mb-1">Nombre del Registro *</label>
                <input 
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`Ej. ${selectedCatalog.title.substring(0, selectedCatalog.title.length - 1)} Demo`}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-surface text-foreground text-xs font-bold rounded-xl border border-border hover:bg-hover font-mono"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-primary-button-bg text-primary-foreground text-xs font-bold rounded-xl hover:brightness-110 font-mono shadow-sm"
                >
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
