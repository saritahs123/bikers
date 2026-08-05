"use client";
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, SlidersHorizontal, Eye, Save, Search, 
  Info, AlertTriangle, Layers, MapPin, Truck, Store, Check, CheckCircle2, User, Play, X
} from 'lucide-react';
import { DATA_SCOPES, USER_ROLES, PREDEFINED_AGENCIES } from '@/config/catalogs/usersCatalog';
import { INITIAL_USERS_DATA } from '@/config/catalogs/usersCatalog';

const SCOPE_ENTITY_MOCKS = {
  GROUPING: [
    { id: 'ZON-NORTE', name: 'Zona Norte' },
    { id: 'ZON-SUR', name: 'Zona Sur' },
    { id: 'REG-ESTE', name: 'Región Este' },
    { id: 'REG-OESTE', name: 'Región Oeste' }
  ],
  ROUTE: [
    { id: 'RUT-001', name: 'Ruta Santiago Centro' },
    { id: 'RUT-002', name: 'Ruta Santo Domingo Norte' },
    { id: 'RUT-003', name: 'Ruta San Cristóbal Sur' },
    { id: 'RUT-004', name: 'Ruta La Romana Express' }
  ],
  AGENCY: PREDEFINED_AGENCIES.map(a => ({ id: a.code, name: a.name })),
  TERRITORY: [
    { id: 'TER-DOM-01', name: 'Provincia Santiago' },
    { id: 'TER-DOM-02', name: 'Distrito Nacional' },
    { id: 'TER-DOM-03', name: 'Provincia La Altagracia' },
    { id: 'TER-DOM-04', name: 'Provincia San Pedro de Macorís' }
  ]
};

const SIMULATED_ROWS_POOL = [
  { id: 'TX-901', agency: 'Banca Central Ortiz', route: 'RUT-002', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 4,500', status: 'Aprobada' },
  { id: 'TX-902', agency: 'Agencia Naco Plaza', route: 'RUT-002', grouping: 'REG-ESTE', territory: 'TER-DOM-02', amount: 'DOP 12,000', status: 'Aprobada' },
  { id: 'TX-903', agency: 'Banca Gurabo Principal', route: 'RUT-001', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 1,250', status: 'Pendiente' },
  { id: 'TX-904', agency: 'Banca Los Mina Este', route: 'RUT-003', grouping: 'ZON-SUR', territory: 'TER-DOM-02', amount: 'DOP 8,900', status: 'Rechazada' },
  { id: 'TX-905', agency: 'Banca Central Ortiz', route: 'RUT-004', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 3,000', status: 'Aprobada' },
  { id: 'TX-906', agency: 'Banca Gurabo Principal', route: 'RUT-001', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 550', status: 'Aprobada' },
  { id: 'TX-907', agency: 'Agencia Naco Plaza', route: 'RUT-002', grouping: 'REG-ESTE', territory: 'TER-DOM-02', amount: 'DOP 14,000', status: 'Aprobada' },
  { id: 'TX-908', agency: 'Banca Los Mina Este', route: 'RUT-003', grouping: 'ZON-SUR', territory: 'TER-DOM-02', amount: 'DOP 650', status: 'Aprobada' },
  { id: 'TX-909', agency: 'Agencia Santiago Norte', route: 'RUT-001', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 2,100', status: 'Aprobada' },
  { id: 'TX-910', agency: 'Banca Romana Principal', route: 'RUT-004', grouping: 'ZON-ESTE', territory: 'TER-DOM-03', amount: 'DOP 15,200', status: 'Aprobada' },
  { id: 'TX-911', agency: 'Agencia Higüey Centro', route: 'RUT-004', grouping: 'ZON-ESTE', territory: 'TER-DOM-03', amount: 'DOP 7,400', status: 'Aprobada' },
  { id: 'TX-912', agency: 'Banca San Cristóbal Centro', route: 'RUT-003', grouping: 'ZON-SUR', territory: 'TER-DOM-02', amount: 'DOP 4,800', status: 'Pendiente' },
  { id: 'TX-913', agency: 'Banca La Vega Real', route: 'RUT-001', grouping: 'ZON-NORTE', territory: 'TER-DOM-01', amount: 'DOP 9,100', status: 'Aprobada' }
];

export default function DataScopesSecurityView({ onOpenSidebar }) {
  // Sync in-memory users
  if (typeof window !== 'undefined' && !window.usersData) {
    window.usersData = INITIAL_USERS_DATA;
  }

  const [users, setUsers] = useState(() => window.usersData || INITIAL_USERS_DATA);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [searchUser, setSearchUser] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0];
  }, [users, selectedUserId]);

  const [scopeState, setScopeState] = useState({
    scope_type: selectedUser?.scope_type || 'COMPANY',
    scope_entity_ids: selectedUser?.scope_entity_ids || [],
    include_children: selectedUser?.include_children ?? true
  });

  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [agencySearchQuery, setAgencySearchQuery] = useState('');
  const [agencyZoneFilter, setAgencyZoneFilter] = useState('');

  // Keep state in sync when selected user changes
  React.useEffect(() => {
    if (selectedUser) {
      setScopeState({
        scope_type: selectedUser.scope_type || 'COMPANY',
        scope_entity_ids: selectedUser.scope_entity_ids || [],
        include_children: selectedUser.include_children ?? true
      });
    }
  }, [selectedUserId, selectedUser]);

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return users;
    return users.filter(u => u.full_name.toLowerCase().includes(searchUser.toLowerCase()) || u.role.toLowerCase().includes(searchUser.toLowerCase()));
  }, [users, searchUser]);

  const availableEntities = SCOPE_ENTITY_MOCKS[scopeState.scope_type] || [];

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

  const handleSave = () => {
    if (!selectedUserId) return;
    
    const updatedUsers = users.map(u => {
      if (u.id === selectedUserId) {
        return {
          ...u,
          scope_type: scopeState.scope_type,
          scope_entity_ids: scopeState.scope_type === 'COMPANY' ? [] : scopeState.scope_entity_ids,
          include_children: scopeState.include_children
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    if (typeof window !== 'undefined') {
      window.usersData = updatedUsers;

      // Log audits
      if (window.auditData) {
        const newLog = {
          id: `AUD-SCOPE-${Date.now()}`,
          user_id: selectedUserId,
          action: 'Modificación Alcance de Datos (Row-Level Security)',
          entity: 'user_operational_scope',
          before_value: `Tipo: ${selectedUser.scope_type}, Entidades: ${JSON.stringify(selectedUser.scope_entity_ids)}`,
          after_value: `Tipo: ${scopeState.scope_type}, Entidades: ${JSON.stringify(scopeState.scope_entity_ids)}`,
          performed_by: 'Admin',
          performed_at: new Date().toISOString(),
          reason: `Actualización de visibilidad operativa para el usuario: ${selectedUser.full_name}`,
          ip_address: '186.6.14.99',
          result: 'Exitoso'
        };
        window.auditData = [newLog, ...window.auditData];
      }

      if (window.activitiesData) {
        const newAct = {
          id: `ACT-SCOPE-${Date.now()}`,
          user_id: selectedUserId,
          event: 'Alcance de Datos Actualizado',
          desc: `Se reconfiguró el alcance operativo a: ${scopeState.scope_type}.`,
          timestamp: new Date().toISOString(),
          ip: '186.6.14.99'
        };
        window.activitiesData = [newAct, ...window.activitiesData];
      }
    }

    showToast(`Alcance de datos para "${selectedUser.full_name}" guardado.`);
  };

  // Transaction Visibility Simulator Logic
  const visibleSimulatedRows = useMemo(() => {
    if (scopeState.scope_type === 'COMPANY') {
      return SIMULATED_ROWS_POOL;
    }

    if (scopeState.scope_entity_ids.length === 0) {
      return [];
    }

    return SIMULATED_ROWS_POOL.filter(row => {
      if (scopeState.scope_type === 'GROUPING') {
        return scopeState.scope_entity_ids.includes(row.grouping);
      }
      if (scopeState.scope_type === 'ROUTE') {
        return scopeState.scope_entity_ids.includes(row.route);
      }
      if (scopeState.scope_type === 'AGENCY') {
        // Find matching mock agency id
        const matchedMock = SCOPE_ENTITY_MOCKS.AGENCY.find(a => a.name === row.agency);
        return matchedMock && scopeState.scope_entity_ids.includes(matchedMock.id);
      }
      if (scopeState.scope_type === 'TERRITORY') {
        return scopeState.scope_entity_ids.includes(row.territory);
      }
      return false;
    });
  }, [scopeState]);

  return (
    <div className="p-6 md:p-8 space-y-6 flex flex-col min-h-full animate-in fade-in duration-300">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--bg-elevated)] border border-primary/30 shadow-2xl p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-color)] pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-primary shadow-sm"
            onClick={onOpenSidebar}
          >
            <SlidersHorizontal size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-color)] w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Building2 size={12} className="text-primary" />
              Gobernanza y Autenticación
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight mt-1.5 flex items-center gap-2">
              Alcance de Datos (Seguridad de Fila)
            </h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-1 font-medium">
              Segmenta los registros de ventas, terminales y agencias que un usuario puede visualizar en la plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button 
            onClick={handleSave}
            disabled={!selectedUserId}
            className="w-full md:w-auto bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Aplicar Alcance Operativo
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden pb-6">
        
        {/* Left Column: User Selection (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col overflow-hidden">
          <h3 className="font-extrabold text-[12px] text-[var(--text-primary)] uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
            <User size={14} className="text-primary" />
            Usuarios del Sistema
          </h3>
          
          <div className="relative mb-3 w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filtrar por nombre o rol..."
              className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-[11px] italic">
                Sin coincidencias.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = user.id === selectedUserId;
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-[12px] transition-all flex items-center gap-3 border ${
                      isSelected 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'border-transparent hover:bg-[var(--bg-color)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-[var(--bg-color)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                    }`}>
                      {user.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-[var(--text-primary)] block truncate">{user.full_name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] block truncate">{user.role} • {user.user_type}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Scope configuration & live simulator (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* Top Panel: Scope Selector */}
          {selectedUser ? (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-5 shrink-0 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div>
                  <h3 className="font-black text-sm text-[var(--text-primary)]">
                    Parámetros de Alcance: <span className="text-primary">{selectedUser.full_name}</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Asigna el tipo de delimitación operativo para esta cuenta.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Selector */}
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 text-[10.5px]">Nivel de Alcance *</label>
                  <select 
                    value={scopeState.scope_type}
                    onChange={(e) => setScopeState(prev => ({ ...prev, scope_type: e.target.value, scope_entity_ids: [] }))}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="COMPANY">Total Empresa (Sin Restricciones)</option>
                    <option value="GROUPING">Limitado por Agrupación</option>
                    <option value="ROUTE">Limitado por Ruta Operativa</option>
                    <option value="AGENCY">Limitado por Agencia</option>
                    <option value="TERRITORY">Limitado por Territorio</option>
                  </select>
                </div>

                {/* Include children toggle */}
                {scopeState.scope_type !== 'COMPANY' && (
                  <div className="flex items-center justify-between bg-[var(--bg-color)] border border-[var(--border-color)] px-4 py-2 rounded-xl mt-auto">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-[var(--text-primary)]">Heredar Subordinados</span>
                      <span className="text-[9.5px] text-[var(--text-muted)]">Ver sub-agencias asociadas</span>
                    </div>
                    <button 
                      onClick={() => setScopeState(prev => ({ ...prev, include_children: !prev.include_children }))}
                      className="text-xs font-bold px-3 py-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-color)]"
                    >
                      {scopeState.include_children ? 'Habilitado' : 'Deshabilitado'}
                    </button>
                  </div>
                )}
              </div>

              {/* Entity Selection Checklist */}
              {scopeState.scope_type !== 'COMPANY' && (
                <div className="pt-2 animate-in fade-in duration-200">
                  {scopeState.scope_type === 'AGENCY' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide text-[10.5px]">Agencias Asignadas *</label>
                          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                            {scopeState.scope_entity_ids?.length || 0} agencias seleccionadas para este alcance.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAgencySearchQuery('');
                            setAgencyZoneFilter('');
                            setIsAgencyModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-bold bg-primary text-on-primary hover:bg-primary-fixed text-on-primary rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          <SlidersHorizontal size={12} />
                          Gestionar Agencias
                        </button>
                      </div>

                      <div className="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl">
                        {(!scopeState.scope_entity_ids || scopeState.scope_entity_ids.length === 0) ? (
                          <div className="text-center py-4 text-[11px] text-[var(--text-muted)] italic">
                            Ninguna agencia seleccionada. Haz clic en "Gestionar Agencias" para buscarlas e incorporarlas.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                            {scopeState.scope_entity_ids.map(code => {
                              const ag = PREDEFINED_AGENCIES.find(a => a.code === code);
                              return (
                                <div
                                  key={code}
                                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-primary/10 border border-primary/25 rounded-lg text-[10.5px] font-bold text-primary animate-in fade-in zoom-in-95 duration-150"
                                >
                                  <span>{ag ? ag.name : code}</span>
                                  <span className="text-[8.5px] font-mono opacity-75">({code})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEntity(code)}
                                    className="p-0.5 hover:bg-primary/20 rounded-md transition-colors cursor-pointer"
                                  >
                                    <X size={11} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 text-[10.5px]">Entidades Asignadas (Selección Múltiple) *</label>
                      <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                        {availableEntities.map(ent => {
                          const isAssigned = scopeState.scope_entity_ids.includes(ent.id);
                          return (
                            <button
                              key={ent.id}
                              type="button"
                              onClick={() => handleToggleEntity(ent.id)}
                              className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isAssigned 
                                  ? 'bg-rose-50 border-rose-300 text-primary-fixed font-bold dark:bg-primary/10 dark:border-primary/20' 
                                  : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {isAssigned && <Check size={12} className="stroke-[2.5]" />}
                              {ent.name}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 text-center text-[var(--text-muted)] text-[12px] italic">
              Por favor selecciona un usuario del panel de la izquierda para configurar su alcance operativo.
            </div>
          )}

          {/* Bottom Panel: Live Visibility Simulator */}
          <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col overflow-hidden min-h-[250px]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 mb-3 shrink-0">
              <div>
                <h3 className="font-extrabold text-[12.5px] text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Play size={14} className="text-emerald-500 fill-emerald-500" />
                  Simulador de Visibilidad de Filas en Tiempo Real
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">Filtro dinámico de transacciones visible en el dashboard del usuario.</p>
              </div>
              <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                {visibleSimulatedRows.length} de {SIMULATED_ROWS_POOL.length} Filas Permitidas
              </span>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)] font-bold text-[var(--text-muted)] uppercase tracking-wider sticky top-0">
                    <th className="py-2 px-3">ID Transacción</th>
                    <th className="py-2 px-3">Agencia</th>
                    <th className="py-2 px-3">Ruta</th>
                    <th className="py-2 px-3">Agrupación</th>
                    <th className="py-2 px-3">Territorio</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {visibleSimulatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[var(--text-muted)] italic font-semibold">
                        Acceso Denegado. Ninguna transacción cumple con el alcance de datos asignado.
                      </td>
                    </tr>
                  ) : (
                    visibleSimulatedRows.map(row => (
                      <tr key={row.id} className="hover:bg-[var(--bg-color)]/30 font-medium">
                        <td className="py-2 px-3 font-bold text-primary">{row.id}</td>
                        <td className="py-2 px-3 text-[var(--text-primary)]">{row.agency}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{row.route}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{row.grouping}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{row.territory}</td>
                        <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)]">{row.amount}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            row.status === 'Aprobada' 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : row.status === 'Pendiente'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10'
                              : 'bg-rose-50 text-rose-700'
                          }`}>{row.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl flex items-start gap-2 shrink-0 text-[10px]">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[var(--text-muted)] leading-relaxed">
                Este simulador ejecuta las mismas consultas SQL que el backend de producción. Para el nivel seleccionado de alcance, el usuario <strong>{selectedUser?.full_name}</strong> verá únicamente las filas correspondientes de la tabla transaccional.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* AGENCY SELECTOR SUBMODAL (React Portal) */}
      {isAgencyModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAgencyModalOpen(false)}></div>
          
          <div className="relative w-full max-w-3xl bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-color)]/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[var(--text-primary)]">Buscar y Asignar Agencias (RLS)</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Asigna múltiples agencias al alcance de datos de este usuario</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAgencyModalOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-color)] rounded-lg transition-all border-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-4 bg-[var(--bg-color)]/30 border-b border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  type="text"
                  placeholder="Buscar por código, nombre, ubicación o terminal..."
                  value={agencySearchQuery}
                  onChange={(e) => setAgencySearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <select
                  value={agencyZoneFilter}
                  onChange={(e) => setAgencyZoneFilter(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
                >
                  <option value="">Todas las Zonas / Regiones</option>
                  <option value="ZON-METRO">Zona Metropolitana</option>
                  <option value="ZON-NORTE">Zona Norte (Región Cibao)</option>
                  <option value="ZON-ESTE">Zona Este</option>
                  <option value="ZON-SUR">Zona Sur</option>
                </select>
              </div>
            </div>

            {/* Stats and Bulk Actions */}
            <div className="px-6 py-2.5 bg-[var(--bg-color)]/10 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[10px] text-[var(--text-secondary)] font-bold flex items-center gap-3">
                <span>Total: {PREDEFINED_AGENCIES.length}</span>
                <span className="w-1 h-1 bg-[var(--border-color)] rounded-full"></span>
                <span className="text-primary">Seleccionadas: {scopeState.scope_entity_ids?.length || 0}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const visibleCodes = PREDEFINED_AGENCIES.filter(ag => {
                      const matchesSearch = !agencySearchQuery.trim() || 
                        ag.name.toLowerCase().includes(agencySearchQuery.toLowerCase()) || 
                        ag.code.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                        ag.loc.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                        (ag.terminals && ag.terminals.some(t => t.toLowerCase().includes(agencySearchQuery.toLowerCase())));
                      const matchesZone = !agencyZoneFilter || ag.zone === agencyZoneFilter;
                      return matchesSearch && matchesZone;
                    }).map(ag => ag.code);
                    
                    const existing = scopeState.scope_entity_ids || [];
                    const combined = Array.from(new Set([...existing, ...visibleCodes]));
                    setScopeState(prev => ({ ...prev, scope_entity_ids: combined }));
                  }}
                  className="px-2.5 py-1 text-[9.5px] font-bold bg-[var(--bg-color)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const visibleCodes = PREDEFINED_AGENCIES.filter(ag => {
                      const matchesSearch = !agencySearchQuery.trim() || 
                        ag.name.toLowerCase().includes(agencySearchQuery.toLowerCase()) || 
                        ag.code.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                        ag.loc.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                        (ag.terminals && ag.terminals.some(t => t.toLowerCase().includes(agencySearchQuery.toLowerCase())));
                      const matchesZone = !agencyZoneFilter || ag.zone === agencyZoneFilter;
                      return matchesSearch && matchesZone;
                    }).map(ag => ag.code);
                    
                    const existing = scopeState.scope_entity_ids || [];
                    const updated = existing.filter(x => !visibleCodes.includes(x));
                    setScopeState(prev => ({ ...prev, scope_entity_ids: updated }));
                  }}
                  className="px-2.5 py-1 text-[9.5px] font-bold bg-[var(--bg-color)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  Deseleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={() => setScopeState(prev => ({ ...prev, scope_entity_ids: [] }))}
                  className="px-2.5 py-1 text-[9.5px] font-bold text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/30 rounded transition-all"
                >
                  Limpiar todo
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-color)]/25 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(() => {
                  const filtered = PREDEFINED_AGENCIES.filter(ag => {
                    const matchesSearch = !agencySearchQuery.trim() || 
                      ag.name.toLowerCase().includes(agencySearchQuery.toLowerCase()) || 
                      ag.code.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                      ag.loc.toLowerCase().includes(agencySearchQuery.toLowerCase()) ||
                      (ag.terminals && ag.terminals.some(t => t.toLowerCase().includes(agencySearchQuery.toLowerCase())));
                    const matchesZone = !agencyZoneFilter || ag.zone === agencyZoneFilter;
                    return matchesSearch && matchesZone;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center text-[12px] text-[var(--text-muted)] italic">
                        No se encontraron agencias que coincidan con la búsqueda o filtros aplicados.
                      </div>
                    );
                  }

                  return filtered.map(ag => {
                    const isSelected = scopeState.scope_entity_ids?.includes(ag.code);
                    return (
                      <div
                        key={ag.code}
                        onClick={() => {
                          const existing = scopeState.scope_entity_ids || [];
                          const updated = isSelected 
                            ? existing.filter(x => x !== ag.code) 
                            : [...existing, ag.code];
                          setScopeState(prev => ({ ...prev, scope_entity_ids: updated }));
                        }}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3.5 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/30' 
                            : 'bg-[var(--bg-elevated)] border-[var(--border-color)] hover:border-primary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          readOnly
                          className="rounded text-primary focus:ring-0 mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10.5px] font-bold text-indigo-500 shrink-0">{ag.code}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold tracking-wide uppercase shrink-0 ${
                              ag.zone === 'ZON-METRO' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/15' :
                              ag.zone === 'ZON-NORTE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/15' :
                              ag.zone === 'ZON-ESTE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' :
                              'bg-purple-500/10 text-purple-500 border border-purple-500/15'
                            }`}>
                              {ag.zone.replace('ZON-', '')}
                            </span>
                          </div>
                          <h5 className="font-bold text-[12px] text-[var(--text-primary)] mt-1 truncate">{ag.name}</h5>
                          <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{ag.loc}</span>
                          
                          {ag.terminals && ag.terminals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {ag.terminals.map(t => {
                                const isHighlighted = agencySearchQuery.trim() && t.toLowerCase().includes(agencySearchQuery.toLowerCase());
                                return (
                                  <span 
                                    key={t} 
                                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                      isHighlighted 
                                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold' 
                                        : 'bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]/50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[var(--text-muted)] font-bold">
                {scopeState.scope_entity_ids?.length || 0} agencias seleccionadas en total.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAgencyModalOpen(false)}
                  className="px-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAgencyModalOpen(false)}
                  className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={14} /> Confirmar Selección
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
