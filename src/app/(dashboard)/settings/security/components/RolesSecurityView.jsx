"use client";
import React, { useState, useMemo, useEffect } from 'react';
import SecurityConfirmDialog from '@/components/security/SecurityConfirmDialog';
import { createPortal } from 'react-dom';
import { 
  Shield, Key, CheckSquare, Square, Save, Search, 
  Info, Check, Activity, Users, PanelLeftOpen, Loader2, Plus, Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

const ALL_ACTIONS = [
  { id: 'ver', label: 'Ver' },
  { id: 'crear', label: 'Crear' },
  { id: 'editar', label: 'Editar' },
  { id: 'inactivar', label: 'Inactivar' },
  { id: 'exportar', label: 'Exportar' },
  { id: 'importar', label: 'Importar' },
  { id: 'aprobar', label: 'Aprobar' },
  { id: 'asignar', label: 'Asignar' },
  { id: 'mover', label: 'Mover' },
  { id: 'cerrar', label: 'Cerrar' },
  { id: 'reabrir', label: 'Reabrir' },
  { id: 'eliminar', label: 'Eliminar' }
];

const apiBase = '/api';

export default function RolesSecurityView({ onOpenSidebar = () => {} }) {
  const [activeRole, setActiveRole] = useState('');
  const [matrixState, setMatrixState] = useState({});
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  
  // Modals state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  
  const [showEditModuleModal, setShowEditModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editModuleName, setEditModuleName] = useState('');
  const [editModuleOrder, setEditModuleOrder] = useState('');
  const [editModuleStatus, setEditModuleStatus] = useState('ACTIVO');
  const [savingEditModule, setSavingEditModule] = useState(false);
  
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [savingEditRole, setSavingEditRole] = useState(false);

  // Delete Confirm State
  const [deleteContext, setDeleteContext] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState('Los cambios han sido guardados correctamente.');

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'orden', direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMatrix = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol?_t=${Date.now()}`);
      if (!res.ok) throw new Error('Error fetching data');
      const data = await res.json();
      
      setModules(data.modules || []);
      setRoles(data.roles || []);
      setMatrixState(data.matrix || {});
      
      if (data.roles && data.roles.length > 0 && !activeRole) {
        setActiveRole(data.roles[0].nombre);
      }
    } catch (error) {
      console.error('Error fetching RBAC:', error);
      showToast('Error al cargar la matriz de roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const currentPermissions = matrixState[activeRole] || {};

  const handleTogglePermission = (moduleId, actionId) => {
    const rolePerms = { ...currentPermissions };
    const actionList = rolePerms[moduleId] ? [...rolePerms[moduleId]] : [];

    if (actionList.includes(actionId)) {
      const updatedList = actionList.filter(act => act !== actionId);
      if (updatedList.length === 0) {
        delete rolePerms[moduleId];
      } else {
        rolePerms[moduleId] = updatedList;
      }
    } else {
      actionList.push(actionId);
      rolePerms[moduleId] = actionList;
    }

    setMatrixState(prev => ({
      ...prev,
      [activeRole]: rolePerms
    }));
  };

  const handleToggleFull = (moduleId) => {
    const rolePerms = { ...currentPermissions };
    const currentActions = rolePerms[moduleId] || [];
    
    if (currentActions.length === ALL_ACTIONS.length) {
      delete rolePerms[moduleId];
    } else {
      rolePerms[moduleId] = ALL_ACTIONS.map(a => a.id);
    }

    setMatrixState(prev => ({
      ...prev,
      [activeRole]: rolePerms
    }));
  };

  const handleSaveClick = () => {
    setShowSaveConfirmModal(true);
  };

  const handleExecuteSave = async () => {
    setShowSaveConfirmModal(false);
    setSaving(true);
    try {
      const targetRole = roles.find(r => r.nombre === activeRole);
      if (!targetRole) throw new Error('Rol no seleccionado');

      const rolePerms = matrixState[activeRole] || {};
      const payload = {
        role_id: targetRole.numericId,
        permissions: rolePerms
      };

      const res = await fetch(`${apiBase}/matriz-acceso-rol/role/${targetRole.numericId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al guardar matriz');

      showToast('Matriz de permisos guardada exitosamente');
      setSuccessMessage('Los permisos para el rol han sido actualizados en la base de datos.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving permissions:', error);
      showToast('Error al guardar la matriz de permisos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;
    
    try {
      setAddingModule(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/module`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newModuleName.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to add module');
      
      setShowAddModuleModal(false);
      setNewModuleName('');
      showToast('Módulo agregado con éxito');
      fetchMatrix(true);
      setSuccessMessage('El módulo ha sido agregado exitosamente.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error adding module:', error);
      showToast('Error al agregar el módulo', 'error');
    } finally {
      setAddingModule(false);
    }
  };

  const handleEditModule = async (e) => {
    e.preventDefault();
    if (!editModuleName.trim() || !editingModule) return;
    
    try {
      setSavingEditModule(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/module/${editingModule.numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: editModuleName.trim(),
          orden: Number(editModuleOrder),
          estado: editModuleStatus
        })
      });
      
      if (!res.ok) throw new Error('Failed to edit module');
      
      setShowEditModuleModal(false);
      setEditingModule(null);
      setEditModuleName('');
      showToast('Módulo editado con éxito');
      fetchMatrix(true);
      setSuccessMessage('El módulo ha sido editado exitosamente.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error editing module:', error);
      showToast('Error al editar el módulo', 'error');
    } finally {
      setSavingEditModule(false);
    }
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    
    try {
      setAddingRole(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newRoleName.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to add role');
      
      setShowAddRoleModal(false);
      setNewRoleName('');
      showToast('Rol agregado con éxito');
      setActiveRole(newRoleName.trim());
      fetchMatrix(true);
      setSuccessMessage('El rol ha sido agregado exitosamente.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error adding role:', error);
      showToast('Error al agregar el rol', 'error');
    } finally {
      setAddingRole(false);
    }
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    if (!editRoleName.trim() || !editingRole) return;
    
    try {
      setSavingEditRole(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/role/${editingRole.numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editRoleName.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to edit role');
      
      setShowEditRoleModal(false);
      setEditingRole(null);
      setEditRoleName('');
      showToast('Rol editado con éxito');
      
      if (activeRole === editingRole.nombre) {
        setActiveRole(editRoleName.trim());
      }
      fetchMatrix(true);
      setSuccessMessage('El rol ha sido editado exitosamente.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error editing role:', error);
      showToast('Error al editar el rol', 'error');
    } finally {
      setSavingEditRole(false);
    }
  };

  const handleDeleteRole = (role) => {
    setDeleteContext({ type: 'role', item: role });
  };

  const handleDeleteModule = (module) => {
    setDeleteContext({ type: 'module', item: module });
  };

  const confirmDelete = async () => {
    if (!deleteContext) return;
    setDeleting(true);
    try {
      const { type, item } = deleteContext;
      const url = type === 'role' 
        ? `${apiBase}/matriz-acceso-rol/role/${item.numericId}` 
        : `${apiBase}/matriz-acceso-rol/module/${item.numericId}`;
        
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete ${type}`);
      
      showToast(`${type === 'role' ? 'Rol' : 'Módulo'} eliminado con éxito`);
      
      if (type === 'role' && activeRole === item.nombre) {
        setActiveRole('');
      }
      
      setDeleteContext(null);
      fetchMatrix(true);
      setShowDeleteSuccessModal(true);
    } catch (error) {
      console.error('Error deleting:', error);
      showToast('Error al eliminar', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredModules = useMemo(() => {
    let result = [...modules];
    
    if (search.trim()) {
      result = result.filter(m => m.label.toLowerCase().includes(search.toLowerCase()));
    }
    
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === 'label') {
          return sortConfig.direction === 'asc' 
            ? a.label.localeCompare(b.label)
            : b.label.localeCompare(a.label);
        } else if (sortConfig.key === 'orden') {
          return sortConfig.direction === 'asc'
            ? (a.orden || 0) - (b.orden || 0)
            : (b.orden || 0) - (a.orden || 0);
        } else if (sortConfig.key === 'FULL') {
          const aIsFull = currentPermissions[a.id]?.length === ALL_ACTIONS.length;
          const bIsFull = currentPermissions[b.id]?.length === ALL_ACTIONS.length;
          if (aIsFull === bIsFull) return a.label.localeCompare(b.label);
          return sortConfig.direction === 'asc' ? (aIsFull ? -1 : 1) : (aIsFull ? 1 : -1);
        } else {
          const aHasPerm = (currentPermissions[a.id] || []).includes(sortConfig.key);
          const bHasPerm = (currentPermissions[b.id] || []).includes(sortConfig.key);
          
          if (aHasPerm === bHasPerm) return a.label.localeCompare(b.label);
          return sortConfig.direction === 'asc' ? (aHasPerm ? -1 : 1) : (aHasPerm ? 1 : -1);
        }
      });
    }
    
    return result;
  }, [search, modules, sortConfig, currentPermissions]);

  // Statistics
  const totalActivePermissions = useMemo(() => {
    let count = 0;
    Object.values(currentPermissions).forEach(actions => {
      count += actions.length;
    });
    return count;
  }, [currentPermissions]);

  const activeModuleCount = Object.keys(currentPermissions).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300 font-sans text-foreground">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 bg-surface-elevated border shadow-2xl p-4 rounded-xl flex items-center gap-3 ${toast.type === 'error' ? 'border-error/50' : 'border-primary/30'}`}>
          <div className={`w-2.5 h-2.5 rounded-full animate-ping ${toast.type === 'error' ? 'bg-error' : 'bg-success'}`} />
          <span className="text-[13px] font-bold text-foreground">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="md:hidden p-1.5 rounded-lg bg-surface-subtle border border-border text-foreground-muted hover:text-primary shadow-sm"
            onClick={onOpenSidebar}
            aria-label="Abrir barra lateral"
          >
            <PanelLeftOpen size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-foreground-muted bg-surface-subtle border border-border w-max px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              <Shield size={12} className="text-primary" />
              Gobernanza y Autenticación
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1.5 flex items-center gap-2 font-sans">
              Matriz de Roles
            </h1>
            <p className="text-[13px] text-foreground-muted mt-1 font-medium font-sans">
              Configura los permisos predeterminados heredados por los usuarios según su rol funcional asignado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button 
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="flex-1 md:flex-initial bg-primary-button-bg hover:brightness-110 text-primary-foreground font-mono font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Shield size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Rol Activo</span>
            <span className="text-base font-black text-foreground block mt-0.5 font-sans">{activeRole}</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-info/15 text-info rounded-xl">
            <Key size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Permisos Concedidos</span>
            <span className="text-base font-black text-foreground block mt-0.5 font-sans">{totalActivePermissions} reglas activas</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-success/15 text-success rounded-xl">
            <Activity size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Módulos Intervenidos</span>
            <span className="text-base font-black text-foreground block mt-0.5 font-sans">{activeModuleCount} de {modules.length} módulos</span>
          </div>
        </div>
      </div>

      {/* Main Layout Split Screen */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden pb-6">
        
        {/* Left Panel: Role List */}
        <div className="w-full lg:w-72 bg-card border border-border rounded-2xl p-4 flex flex-col shrink-0 shadow-sm">
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-extrabold text-[12px] text-foreground uppercase tracking-wider flex items-center gap-2 font-mono">
              <Users size={14} className="text-primary" />
              Roles Funcionales
            </h3>
            <button 
              type="button"
              onClick={() => setShowAddRoleModal(true)}
              className="bg-primary-button-bg text-primary-foreground hover:brightness-110 p-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
              title="Nuevo Rol"
            >
              <Plus size={14} className="stroke-[2.5]" />
            </button>
          </div>
          
          <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {roles.map((role) => {
              const isActive = role.nombre === activeRole;
              const permissionsCount = Object.values(matrixState[role.nombre] || {}).reduce((a, b) => a + b.length, 0);

              return (
                <div 
                  key={role.numericId} 
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer border ${
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                      : 'bg-surface-subtle/50 text-foreground-secondary hover:bg-hover hover:text-foreground border-border'
                  }`} 
                  onClick={() => setActiveRole(role.nombre)}
                >
                  <span className="truncate pr-2 flex-1 font-sans">{role.nombre}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide ${
                      isActive ? 'bg-black/20 text-primary-foreground' : 'bg-surface text-foreground-muted border border-border'
                    }`}>
                      {permissionsCount}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRole(role);
                        setEditRoleName(role.nombre);
                        setShowEditRoleModal(true);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-black/20' : 'text-foreground-muted hover:text-primary hover:bg-hover'
                      }`}
                      title="Editar Rol"
                    >
                      <Edit2 size={12} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(role);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-black/20' : 'text-foreground-muted hover:text-error hover:bg-error/10'
                      }`}
                      title="Eliminar Rol"
                    >
                      <Trash2 size={12} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Permissions Matrix Table */}
        <div className="flex-1 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden min-h-[500px] shadow-sm">
          
          {/* Table Header Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-4 border-b border-border shrink-0">
            <div>
              <h3 className="font-extrabold text-sm text-foreground font-sans">Matriz de Acceso</h3>
              <p className="text-[11px] text-foreground-muted font-medium mt-0.5 font-sans">Controla qué acciones específicas puede realizar el rol sobre cada módulo.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Buscar módulo..."
                  className="w-full bg-input border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary font-sans"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                type="button"
                onClick={() => setShowAddModuleModal(true)}
                className="bg-primary-button-bg text-primary-foreground hover:brightness-110 px-3 py-1.5 rounded-xl shadow-sm transition-all flex-shrink-0 flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
                title="Nuevo Módulo"
              >
                <Plus size={14} className="stroke-[2.5]" />
                Agregar Módulo
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-mono font-bold text-primary uppercase tracking-wider bg-surface-subtle select-none sticky top-0 z-10">
                  <th className="py-3 px-4 group cursor-pointer hover:bg-hover transition-colors" onClick={() => handleSort('label')}>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <span>Módulo / Sección</span>
                      {sortConfig.key === 'label' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />
                      ) : (
                        <ArrowUpDown size={12} className="text-foreground-disabled opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-1.5 text-center w-16 text-primary group cursor-pointer hover:bg-hover transition-colors" onClick={() => handleSort('FULL')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>FULL</span>
                      {sortConfig.key === 'FULL' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="text-foreground-disabled opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  {ALL_ACTIONS.map(act => (
                    <th key={act.id} className="py-3 px-1.5 text-center w-16 text-foreground-secondary group cursor-pointer hover:bg-hover transition-colors" onClick={() => handleSort(act.id)}>
                      <div className="flex items-center justify-center gap-1">
                        <span>{act.label}</span>
                        {sortConfig.key === act.id ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />
                        ) : (
                          <ArrowUpDown size={12} className="text-foreground-disabled opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-1.5 text-center w-16 text-foreground-muted">OPCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={ALL_ACTIONS.length + 3} className="py-12 text-center text-foreground-muted italic font-semibold font-mono">
                      No se encontraron módulos coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map(mod => {
                    return (
                      <tr key={mod.id} className="transition-colors hover:bg-hover">
                        <td className="py-2.5 px-4 font-bold text-foreground font-sans">
                          {mod.label}
                        </td>
                        
                        <td className="py-2 px-1.5 text-center border-r border-border">
                          {(() => {
                            const isFull = currentPermissions[mod.id]?.length === ALL_ACTIONS.length;
                            return (
                              <button
                                type="button"
                                onClick={() => handleToggleFull(mod.id)}
                                className={`p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer flex items-center justify-center mx-auto ${
                                  isFull 
                                    ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                                    : 'bg-surface border-border text-foreground-muted hover:border-primary/40 hover:text-foreground'
                                }`}
                                title={isFull ? 'Desmarcar todos' : 'Marcar todos'}
                              >
                                {isFull ? (
                                  <CheckSquare size={14} className="stroke-[2.5]" />
                                ) : (
                                  <Square size={14} className="stroke-[2]" />
                                )}
                              </button>
                            );
                          })()}
                        </td>

                        {ALL_ACTIONS.map(act => {
                          const isChecked = currentPermissions[mod.id]?.includes(act.id);
                          
                          return (
                            <td key={act.id} className="py-2 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePermission(mod.id, act.id)}
                                className={`p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer flex items-center justify-center mx-auto ${
                                  isChecked 
                                    ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                                    : 'bg-surface border-border text-foreground-muted hover:border-primary/40 hover:text-foreground'
                                }`}
                                title={`${isChecked ? 'Remover' : 'Conceder'} permiso ${act.label} para ${mod.label}`}
                              >
                                {isChecked ? (
                                  <CheckSquare size={14} className="stroke-[2.5]" />
                                ) : (
                                  <Square size={14} className="stroke-[2]" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                        
                        <td className="py-2 px-1.5 text-center border-l border-border">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingModule(mod);
                                setEditModuleName(mod.label);
                                setEditModuleOrder(mod.orden);
                                setEditModuleStatus(mod.estado);
                                setShowEditModuleModal(true);
                              }}
                              className="p-1.5 text-foreground-muted hover:text-primary transition-colors rounded-lg hover:bg-hover cursor-pointer"
                              title="Editar módulo"
                            >
                              <Edit2 size={14} className="stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod)}
                              className="p-1.5 text-foreground-muted hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer"
                              title="Eliminar módulo"
                            >
                              <Trash2 size={14} className="stroke-[2.5]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info alert */}
          <div className="mt-4 p-3 bg-surface-subtle border border-border rounded-xl flex items-start gap-2.5 shrink-0 animate-in fade-in">
            <Info size={15} className="text-primary shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed text-foreground-secondary font-medium font-sans">
              <strong>Nota:</strong> Los cambios realizados en esta matriz modificarán el comportamiento heredado predeterminado de los usuarios. Las cuentas que tengan configurados &quot;Permisos Personalizados&quot; individuales en su perfil no se verán afectadas por este cambio.
            </span>
          </div>

        </div>
      </div>

      {/* Save Confirmation Modal */}
      <SecurityConfirmDialog
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={handleExecuteSave}
        variant="default"
        title="¿Confirmar guardado?"
        description="¿Desea guardar los cambios realizados en las políticas de seguridad de este rol?"
        confirmLabel="Guardar cambios"
      />

      {/* Delete Confirmation Modal */}
      <SecurityConfirmDialog
        isOpen={!!deleteContext}
        onClose={() => setDeleteContext(null)}
        onConfirm={confirmDelete}
        variant="danger"
        title={`¿Eliminar ${deleteContext?.type === 'role' ? 'Rol' : 'Módulo'}?`}
        description={`Estás a punto de eliminar el ${deleteContext?.type === 'role' ? 'rol' : 'módulo'} "${deleteContext?.type === 'role' ? deleteContext?.item?.nombre : deleteContext?.item?.label}". Esta acción es irreversible.`}
        confirmLabel="Eliminar"
        isLoading={deleting}
        loadingLabel="Eliminando..."
        details={deleteContext ? [
          { label: 'Nombre', value: deleteContext.type === 'role' ? deleteContext.item.nombre : deleteContext.item.label }
        ] : null}
      />

      {/* Delete Success Modal */}
      {showDeleteSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-3xl shadow-xl w-[400px] overflow-hidden p-8 text-center text-foreground">
            <div className="w-20 h-20 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight font-sans">
              ¡Eliminado Exitosamente!
            </h3>
            <p className="text-[14px] text-foreground-secondary font-medium leading-relaxed mb-8 px-2 font-sans">
              El registro ha sido eliminado correctamente de la base de datos.
            </p>
            <button 
              type="button"
              onClick={() => setShowDeleteSuccessModal(false)}
              className="w-full bg-primary-button-bg text-primary-foreground font-mono font-bold py-3.5 rounded-2xl shadow-sm hover:brightness-110 transition-all text-sm cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      , document.body)}

      {/* Success Modal */}
      {showSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-3xl shadow-xl w-[400px] overflow-hidden p-8 text-center text-foreground">
            <div className="w-20 h-20 bg-primary/15 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight font-sans">
              ¡Guardado Exitosamente!
            </h3>
            <p className="text-[14px] text-foreground-secondary font-medium leading-relaxed mb-8 px-2 font-sans">
              {successMessage}
            </p>
            <button 
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-primary-button-bg text-primary-foreground font-mono font-bold py-3.5 rounded-2xl shadow-sm hover:brightness-110 transition-all text-sm cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      , document.body)}

      {/* Add Module Modal */}
      {showAddModuleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-xl w-[400px] overflow-hidden text-foreground">
            <form onSubmit={handleAddModule}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Plus size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-sans">Nuevo Módulo</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                    Nombre del Módulo
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej: Reportes Financieros"
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-all font-sans"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-subtle border-t border-border rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddModuleModal(false);
                    setNewModuleName('');
                  }}
                  className="flex-1 bg-surface hover:bg-hover text-foreground font-mono font-bold py-2.5 rounded-xl transition-colors text-xs border border-border"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={addingModule || !newModuleName.trim()}
                  className="flex-1 bg-primary-button-bg text-primary-foreground hover:brightness-110 font-mono font-bold py-2.5 rounded-xl shadow-sm transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {addingModule ? <Loader2 size={16} className="animate-spin" /> : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Edit Module Modal */}
      {showEditModuleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-xl w-[400px] overflow-hidden text-foreground">
            <form onSubmit={handleEditModule}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Edit2 size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-sans">Editar Módulo</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                      Nombre del Módulo
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-all font-sans"
                      value={editModuleName}
                      onChange={(e) => setEditModuleName(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1 w-1/3">
                      <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                        Orden
                      </label>
                      <input
                        type="number"
                        required
                        className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-mono font-semibold text-foreground focus:outline-none focus:border-primary transition-all"
                        value={editModuleOrder}
                        onChange={(e) => setEditModuleOrder(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1 w-2/3">
                      <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                        Estado
                      </label>
                      <select
                        className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-mono font-semibold text-foreground focus:outline-none focus:border-primary transition-all"
                        value={editModuleStatus}
                        onChange={(e) => setEditModuleStatus(e.target.value)}
                      >
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 flex items-center gap-3 bg-surface-subtle border-t border-border rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModuleModal(false);
                    setEditingModule(null);
                  }}
                  className="flex-1 bg-surface hover:bg-hover text-foreground font-mono font-bold py-2.5 rounded-xl transition-colors text-xs border border-border"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingEditModule || !editModuleName.trim()}
                  className="flex-1 bg-primary-button-bg text-primary-foreground hover:brightness-110 font-mono font-bold py-2.5 rounded-xl shadow-sm transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {savingEditModule ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Add Role Modal */}
      {showAddRoleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-xl w-[400px] overflow-hidden text-foreground">
            <form onSubmit={handleAddRole}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Plus size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-sans">Nuevo Rol Funcional</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                    Nombre del Rol
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-all font-sans"
                    placeholder="Ej. Auditor de Operaciones"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-subtle border-t border-border rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddRoleModal(false);
                    setNewRoleName('');
                  }}
                  className="flex-1 bg-surface hover:bg-hover text-foreground font-mono font-bold py-2.5 rounded-xl transition-colors text-xs border border-border"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={addingRole || !newRoleName.trim()}
                  className="flex-1 bg-primary-button-bg text-primary-foreground hover:brightness-110 font-mono font-bold py-2.5 rounded-xl shadow-sm transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {addingRole ? <Loader2 size={16} className="animate-spin" /> : 'Agregar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Edit Role Modal */}
      {showEditRoleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-xl w-[400px] overflow-hidden text-foreground">
            <form onSubmit={handleEditRole}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Edit2 size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground font-sans">Editar Rol</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-foreground-secondary uppercase tracking-wider">
                    Nombre del Rol
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-all font-sans"
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-subtle border-t border-border rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditRoleModal(false);
                    setEditingRole(null);
                  }}
                  className="flex-1 bg-surface hover:bg-hover text-foreground font-mono font-bold py-2.5 rounded-xl transition-colors text-xs border border-border"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingEditRole || !editRoleName.trim()}
                  className="flex-1 bg-primary-button-bg text-primary-foreground hover:brightness-110 font-mono font-bold py-2.5 rounded-xl shadow-sm transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {savingEditRole ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
