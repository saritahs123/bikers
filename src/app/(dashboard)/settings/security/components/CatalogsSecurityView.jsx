"use client";

import React, { useState, useEffect } from "react";
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
  ShieldCheck, 
  Activity, 
  ExternalLink,
  Layers,
  Edit2,
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
  const [newItemDesc, setNewItemDesc] = useState("");
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

    // Add activity log
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
    setNewItemDesc("");
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
    <div className="w-full space-y-8 animate-in fade-in duration-300 font-sans text-[#e4e3d9]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-[#bfce7f] text-[#2b3400] px-5 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <section className="relative overflow-hidden border border-[#2d3748] p-6 md:p-8 bg-[#161a21] rounded-2xl shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-[#bfce7f]">
          <Cpu size={140} />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#bfce7f] uppercase font-bold">
                SYSTEM ADMINISTRATION • BIKER'S FORT CORE
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1">
                Panel de Control de Catálogos
              </h2>
            </div>
            
            <div className="flex items-center gap-3 bg-[#0e1117] border border-[#2d3748] px-3.5 py-1.5 rounded-xl text-xs font-mono">
              <Search size={14} className="text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar catálogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-white focus:outline-none w-36 md:w-48 text-xs"
              />
            </div>
          </div>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            Gestione la arquitectura organizacional y operativa de Biker's Fort. Configure entidades, estructuras jerárquicas y roles maestros con precisión industrial.
          </p>

          <div className="pt-3 border-t border-[#2d3748]/60 flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#bfce7f] font-bold tracking-wider">STATUS DEL SISTEMA</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-[#bfce7f] animate-pulse"></div>
                <span className="font-bold text-white">Operacional</span>
              </div>
            </div>

            <div className="w-px h-8 bg-[#2d3748]"></div>

            <div className="flex flex-col">
              <span className="text-[10px] text-[#bfce7f] font-bold tracking-wider">ÚLTIMO RESPALDO</span>
              <span className="font-bold text-slate-200 mt-0.5">Hace 14 minutos</span>
            </div>

            <div className="w-px h-8 bg-[#2d3748]"></div>

            <div className="flex flex-col">
              <span className="text-[10px] text-[#bfce7f] font-bold tracking-wider">CATÁLOGOS ACTIVOS</span>
              <span className="font-bold text-white mt-0.5">6 Módulos Maestros</span>
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
              className="bg-[#161a21] border border-[#2d3748] rounded-2xl p-6 flex flex-col justify-between hover:border-[#4a5568] hover:-translate-y-1 transition-all duration-200 shadow-lg group"
            >
              <div>
                <div className="flex justify-between items-start mb-5">
                  <div className="w-12 h-12 bg-[#212631] border border-[#2d3748] rounded-xl flex items-center justify-center text-[#bfce7f] group-hover:scale-110 transition-transform">
                    <IconComp size={24} />
                  </div>
                  {cat.badge && (
                    <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 bg-[#bfce7f]/15 text-[#bfce7f] border border-[#bfce7f]/30 rounded-md tracking-wider">
                      {cat.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-white mb-1.5 tracking-tight">
                  {cat.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  {cat.description}
                </p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400">REGISTROS</span>
                  <span className="text-2xl font-black text-white font-mono">{cat.count}</span>
                </div>

                {/* Segmented progress bar */}
                <div className="w-full h-1.5 bg-[#0e1117] rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-[#bfce7f] transition-all duration-500"
                    style={{ width: `${cat.progress}%` }}
                  ></div>
                </div>

                <button 
                  onClick={() => handleOpenManage(cat)}
                  className="w-full py-2.5 bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] font-mono text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  ADMINISTRAR <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table Section */}
      <section className="border border-[#2d3748] bg-[#161a21] rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#2d3748] bg-[#0e1117] flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-[#bfce7f] tracking-widest flex items-center gap-2">
            <Activity size={14} /> ACTIVIDAD RECIENTE DE CATÁLOGOS
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Últimas acciones registradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1b2029] text-slate-400 font-mono text-[10px] tracking-wider border-b border-[#2d3748]">
                <th className="px-6 py-3">FECHA / HORA</th>
                <th className="px-6 py-3">USUARIO</th>
                <th className="px-6 py-3">CATÁLOGO</th>
                <th className="px-6 py-3">ACCIÓN</th>
                <th className="px-6 py-3 text-right">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/50 text-slate-200">
              {activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#212631] transition-colors font-medium">
                  <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{log.date}</td>
                  <td className="px-6 py-3.5 font-bold text-white">{log.user}</td>
                  <td className="px-6 py-3.5 font-semibold text-[#bfce7f]">{log.catalog}</td>
                  <td className="px-6 py-3.5 text-slate-300">{log.action}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold border ${
                      log.status === "COMPLETADO" 
                        ? "bg-[#bfce7f]/10 text-[#bfce7f] border-[#bfce7f]/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsManageModalOpen(false)}></div>
          
          <div className="relative bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#2d3748] bg-[#0e1117] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#212631] border border-[#2d3748] rounded-lg flex items-center justify-center text-[#bfce7f]">
                  {React.createElement(selectedCatalog.icon, { size: 18 })}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">{selectedCatalog.title}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">Administración del catálogo maestro</p>
                </div>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="p-4 border-b border-[#2d3748] bg-[#1b2029] flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-slate-300">
                Total de registros: <strong>{catalogItems.length}</strong>
              </span>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Nuevo Registro
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5 custom-scrollbar">
              {loading ? (
                <div className="py-12 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-[#bfce7f]" size={16} /> Cargando datos...
                </div>
              ) : catalogItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">
                  No hay registros creados en este catálogo.
                </div>
              ) : (
                catalogItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-[#0e1117] border border-[#2d3748] rounded-xl flex items-center justify-between gap-3 hover:border-[#4a5568] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-[#212631] border border-[#2d3748] rounded text-[10px] font-mono text-[#bfce7f]">
                        {item.code}
                      </span>
                      <span className="text-xs font-bold text-white">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
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
            <div className="p-4 border-t border-[#2d3748] bg-[#0e1117] flex justify-end">
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="px-5 py-2 bg-[#212631] text-white text-xs font-bold rounded-xl border border-[#2d3748] hover:bg-[#2d3748] transition-all cursor-pointer"
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="relative bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h4 className="text-base font-bold text-white mb-1">Añadir a {selectedCatalog.title}</h4>
            <p className="text-xs text-slate-400 mb-4">Ingrese los datos para registrar un nuevo elemento maestro.</p>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#bfce7f] uppercase mb-1">Nombre del Registro *</label>
                <input 
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`Ej. ${selectedCatalog.title.substring(0, selectedCatalog.title.length - 1)} Demo`}
                  className="w-full bg-[#0e1117] border border-[#2d3748] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#bfce7f]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#2d3748]">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-[#212631] text-white text-xs font-bold rounded-xl border border-[#2d3748] hover:bg-[#2d3748]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-[#bfce7f] text-[#1d1f18] text-xs font-bold rounded-xl hover:bg-[#a8b868]"
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
