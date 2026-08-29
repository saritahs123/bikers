"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, SlidersHorizontal, Shield, Save, Search, 
  Info, Check, CheckCircle2, User, Layers, GitFork, Network
} from 'lucide-react';
import { usersService } from '@/services/usersService';

export default function DataScopesSecurityView({ onOpenSidebar = () => {} }) {
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Real Catalog Options
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  // User operational scope state
  const [scopeState, setScopeState] = useState({
    scope_type: 'COMPANY',
    scope_entity_ids: [],
    include_children: true
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load real users and real catalog options on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoadingUsers(true);
    setIsLoadingCatalogs(true);
    try {
      const [usersRes, depRes, areaRes, empRes] = await Promise.allSettled([
        usersService.getAllUsers(),
        fetch('/api/departamentos').then(r => r.ok ? r.json() : []),
        fetch('/api/areas').then(r => r.ok ? r.json() : []),
        fetch('/api/empresas').then(r => r.ok ? r.json() : [])
      ]);

      const usersList = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
      setUsers(usersList);
      if (usersList.length > 0) {
        setSelectedUserId(usersList[0].id);
      }

      setDepartments(depRes.status === 'fulfilled' && Array.isArray(depRes.value) ? depRes.value : []);
      setAreas(areaRes.status === 'fulfilled' && Array.isArray(areaRes.value) ? areaRes.value : []);
      setCompanies(empRes.status === 'fulfilled' && Array.isArray(empRes.value) ? empRes.value : []);
    } catch (err) {
      console.error('Error loading data scopes entities:', err);
      showToast('Error al cargar datos del servidor', 'error');
    } finally {
      setIsLoadingUsers(false);
      setIsLoadingCatalogs(false);
    }
  };

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0] || null;
  }, [users, selectedUserId]);

  // Keep scope state synchronized directly from database when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      loadUserScope(selectedUserId);
    }
  }, [selectedUserId]);

  const loadUserScope = async (userId) => {
    try {
      const full = await usersService.getUserById(userId);
      if (full) {
        setScopeState({
          scope_type: full.scope_type || 'COMPANY',
          scope_entity_ids: Array.isArray(full.scope_entity_ids) ? full.scope_entity_ids : [],
          include_children: full.include_children ?? true
        });
      }
    } catch (err) {
      console.error('Error fetching user scope from DB:', err);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return users;
    const query = searchUser.toLowerCase();
    return users.filter(u => {
      const name = u.full_name || u.email || `Usuario #${u.id}`;
      return (
        name.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.role && u.role.toLowerCase().includes(query))
      );
    });
  }, [users, searchUser]);

  // Real available entities based on selected scope type
  const availableEntities = useMemo(() => {
    if (scopeState.scope_type === 'DEPARTMENT') {
      return departments.map(d => ({ id: d.departamento_id || d.id, name: d.nombre, code: d.codigo }));
    }
    if (scopeState.scope_type === 'AREA') {
      return areas.map(a => ({ id: a.area_id || a.id, name: a.nombre, code: a.codigo }));
    }
    if (scopeState.scope_type === 'BRANCH') {
      return companies.map(c => ({ id: c.empresa_id || c.id, name: c.nombre_comercial || c.nombre, code: c.codigo }));
    }
    return [];
  }, [scopeState.scope_type, departments, areas, companies]);

  const handleToggleEntity = (entityId) => {
    setScopeState(prev => {
      const current = [...prev.scope_entity_ids];
      if (current.includes(entityId)) {
        return { ...prev, scope_entity_ids: current.filter(id => id !== entityId) };
      } else {
        return { ...prev, scope_entity_ids: [...current, entityId] };
      }
    });
  };

  const handleSave = async () => {
    if (!selectedUserId || !selectedUser) return;
    setIsSaving(true);
    try {
      const payload = {
        scope_type: scopeState.scope_type,
        scope_entity_ids: scopeState.scope_type === 'COMPANY' ? [] : scopeState.scope_entity_ids,
        include_children: scopeState.include_children
      };

      await usersService.updateUser(selectedUserId, payload);

      setUsers(prev => prev.map(u => {
        if (u.id === selectedUserId) {
          return { ...u, ...payload };
        }
        return u;
      }));

      showToast(`Alcance de datos para "${selectedUser.full_name}" actualizado exitosamente.`);
    } catch (err) {
      console.error('Error saving data scope:', err);
      showToast('Error al guardar el alcance de datos.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getScopeTypeLabel = (type) => {
    switch (type) {
      case 'COMPANY':
        return 'Total Empresa (Acceso Corporativo)';
      case 'DEPARTMENT':
        return 'Limitado por Departamento';
      case 'AREA':
        return 'Limitado por Área Operativa';
      case 'BRANCH':
        return 'Limitado por Empresa / Sucursal';
      default:
        return type;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 flex flex-col min-h-full animate-in fade-in duration-300">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border border-primary/40 shadow-2xl p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <span className="text-[13px] font-bold text-foreground">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="md:hidden p-1.5 rounded-lg bg-card border border-border text-foreground-muted hover:text-primary shadow-sm cursor-pointer"
            onClick={onOpenSidebar}
          >
            <SlidersHorizontal size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary bg-surface-subtle border border-border w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Shield size={12} />
              Gobernanza y RLS
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mt-1.5 flex items-center gap-2 font-sans">
              Alcance de Datos (Seguridad a Nivel de Fila)
            </h1>
            <p className="text-[13px] text-foreground-muted mt-1 font-medium font-sans">
              Segmenta los registros de órdenes de trabajo, recepciones, clientes y facturas que cada usuario puede visualizar en la plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button 
            type="button"
            onClick={handleSave}
            disabled={!selectedUserId || isSaving}
            className="w-full md:w-auto bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save size={14} />
            {isSaving ? 'Guardando...' : 'Aplicar Alcance Operativo'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden pb-6">
        
        {/* Left Column: User Selection (4 cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-4 flex flex-col overflow-hidden shadow-sm">
          <h3 className="font-extrabold text-[12px] text-foreground uppercase tracking-wider mb-3 px-2 flex items-center gap-2 font-sans">
            <User size={14} className="text-primary" />
            Usuarios del Sistema
          </h3>
          
          <div className="relative mb-3 w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Filtrar por nombre, correo o rol..."
              className="w-full bg-input border border-border rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {isLoadingUsers ? (
              <div className="p-6 text-center text-foreground-muted text-xs italic">
                Cargando usuarios desde la base de datos...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-foreground-muted text-xs italic font-sans">
                No se encontraron usuarios coincidentes.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = user.id === selectedUserId;
                const displayName = user.full_name || (user.email ? user.email.split('@')[0] : `Usuario #${user.id}`);
                const initials = (displayName || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-center gap-3 border cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/40 shadow-sm' 
                        : 'border-transparent hover:bg-surface-subtle hover:border-border text-foreground'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                      isSelected ? 'bg-primary-button-bg text-primary-foreground' : 'bg-surface-subtle text-foreground-secondary border border-border'
                    }`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-foreground block truncate font-sans">{displayName}</span>
                      <span className="text-[10px] text-foreground-muted block truncate font-mono">
                        {user.role || 'Usuario'} {user.empresa_nombre ? `• ${user.empresa_nombre}` : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Scope configuration & summary (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* Top Panel: Scope Selector */}
          {selectedUser ? (
            <div className="bg-card border border-border rounded-2xl p-5 shrink-0 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-foreground font-sans">
                    Parámetros de Alcance: <span className="text-primary">{selectedUser.full_name || selectedUser.email || `Usuario #${selectedUser.id}`}</span>
                  </h3>
                  <p className="text-xs text-foreground-muted mt-0.5 font-sans">
                    Configuración de visibilidad y acceso a datos para la cuenta seleccionada.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-surface-subtle border border-border rounded-lg text-foreground-muted">
                  ID: #{selectedUser.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Selector */}
                <div>
                  <label className="block font-bold text-foreground-muted uppercase tracking-wide mb-1.5 text-[10.5px] font-mono">
                    Nivel de Alcance *
                  </label>
                  <select 
                    value={scopeState.scope_type}
                    onChange={(e) => setScopeState(prev => ({ ...prev, scope_type: e.target.value, scope_entity_ids: [] }))}
                    className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer transition-colors"
                  >
                    <option value="COMPANY">Total Empresa (Acceso Corporativo Completo)</option>
                    <option value="DEPARTMENT">Limitado por Departamento</option>
                    <option value="AREA">Limitado por Área Operativa</option>
                    <option value="BRANCH">Limitado por Empresa / Sucursal</option>
                  </select>
                </div>

                {/* Include children toggle */}
                {scopeState.scope_type !== 'COMPANY' && (
                  <div className="flex items-center justify-between bg-surface-subtle border border-border px-4 py-2.5 rounded-xl mt-auto">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground font-sans">Herencia Jerárquica</span>
                      <span className="text-[10px] text-foreground-muted font-sans">Incluir sub-unidades y áreas dependientes</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setScopeState(prev => ({ ...prev, include_children: !prev.include_children }))}
                      className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        scopeState.include_children 
                          ? 'bg-primary-button-bg text-primary-foreground border-transparent' 
                          : 'bg-card border-border text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      {scopeState.include_children ? 'Habilitada' : 'Deshabilitada'}
                    </button>
                  </div>
                )}
              </div>

              {/* Entity Selection Checklist */}
              {scopeState.scope_type !== 'COMPANY' && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block font-bold text-foreground-muted uppercase tracking-wide text-[10.5px] font-mono">
                      Entidades Autorizadas (Selección Múltiple) *
                    </label>
                    <span className="text-[11px] font-mono text-primary font-bold">
                      {scopeState.scope_entity_ids.length} seleccionadas
                    </span>
                  </div>

                  {isLoadingCatalogs ? (
                    <div className="p-4 text-center text-foreground-muted text-xs italic bg-surface-subtle border border-border rounded-xl">
                      Cargando catálogo de entidades...
                    </div>
                  ) : availableEntities.length === 0 ? (
                    <div className="p-4 text-center text-foreground-muted text-xs italic bg-surface-subtle border border-border rounded-xl font-sans">
                      No existen registros activos en este catálogo para seleccionar.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-3 bg-surface-subtle border border-border rounded-xl max-h-36 overflow-y-auto custom-scrollbar">
                      {availableEntities.map(ent => {
                        const isAssigned = scopeState.scope_entity_ids.includes(ent.id);
                        return (
                          <button
                            key={ent.id}
                            type="button"
                            onClick={() => handleToggleEntity(ent.id)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer font-sans ${
                              isAssigned 
                                ? 'bg-primary/15 border-primary/40 text-primary font-bold shadow-sm' 
                                : 'bg-card border-border text-foreground-muted hover:text-foreground hover:border-border/80'
                            }`}
                          >
                            {isAssigned && <Check size={13} className="stroke-[3]" />}
                            <span>{ent.name}</span>
                            {ent.code && <span className="font-mono text-[9px] opacity-75">({ent.code})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 text-center text-foreground-muted text-xs italic font-sans shadow-sm">
              Seleccione un usuario del panel de la izquierda para configurar su alcance operativo.
            </div>
          )}

          {/* Bottom Panel: Scope Evaluation & RLS Architecture Summary */}
          <div className="flex-1 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden min-h-[220px] shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
              <div>
                <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Layers size={14} className="text-primary" />
                  Resumen de Alcance y Evaluación RLS
                </h3>
                <p className="text-xs text-foreground-muted font-sans mt-0.5">
                  Estado de delimitación de acceso para el usuario seleccionado.
                </p>
              </div>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold">
                RLS Activo
              </span>
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-surface-subtle border border-border rounded-xl">
                    <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase tracking-wider block">
                      MODALIDAD
                    </span>
                    <span className="text-xs font-bold text-foreground font-sans mt-1 block">
                      {getScopeTypeLabel(scopeState.scope_type)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-surface-subtle border border-border rounded-xl">
                    <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase tracking-wider block">
                      HERENCIA JERÁRQUICA
                    </span>
                    <span className={`text-xs font-bold font-sans mt-1 block ${scopeState.include_children ? 'text-success' : 'text-foreground-muted'}`}>
                      {scopeState.include_children ? 'Habilitada (Sub-unidades incluidas)' : 'Estricta (Solo nivel directo)'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-surface-subtle border border-border rounded-xl">
                    <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase tracking-wider block">
                      ENTIDADES PERMITIDAS
                    </span>
                    <span className="text-xs font-bold text-primary font-mono mt-1 block">
                      {scopeState.scope_type === 'COMPANY' ? 'Todas (Sin Restricción)' : `${scopeState.scope_entity_ids.length} Asignadas`}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-surface-subtle/80 border border-border rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground-secondary font-sans leading-relaxed">
                    <p className="font-semibold text-foreground">Gobernanza y Persistencia de Alcance Operativo (admin.usuario_alcance):</p>
                    <p className="text-foreground-muted mt-0.5">
                      Los parámetros configurados definen el alcance territorial y departamental del usuario en PostgreSQL. La aplicación de filtrado estricto en reportes y vistas operativas se encuentra en proceso de integración gradual por módulo.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-foreground-muted text-xs italic font-sans">
                Sin usuario seleccionado.
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
