"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_ROLES_DATA, INITIAL_SECURITY_MODULES, ALL_ACTIONS } from '@/config/catalogs/rolesCatalog';
import SecurityConfirmDialog from '@/components/security/SecurityConfirmDialog';
import { createPortal } from 'react-dom';
import { 
  Shield, Key, CheckSquare, Square, Save, RotateCw, Search, 
  Info, AlertTriangle, Check, ArrowRight, Activity, Users, Settings, PanelLeftOpen, Loader2, Plus, Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown
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
  const [initialMatrixState, setInitialMatrixState] = useState({});
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
      setInitialMatrixState(JSON.parse(JSON.stringify(data.matrix || {})));
      
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
    
    // If all are selected, unselect all
    if (currentActions.length === ALL_ACTIONS.length) {
      delete rolePerms[moduleId];
    } else {
      // Otherwise, select all
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
    try {
      setShowSaveConfirmModal(false);
      setSaving(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matrixState)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save');
      }
      
      setInitialMatrixState(JSON.parse(JSON.stringify(matrixState)));
      setSuccessMessage('Los cambios en la matriz de acceso han sido aplicados y guardados correctamente.');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving RBAC:', error);
      showToast('Error al guardar la matriz', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;
    
    try {
      setAddingModule(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newModuleName.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to add module');
      
      setShowAddModuleModal(false);
      setNewModuleName('');
      showToast('Módulo agregado con éxito');
      
      // Refresh matrix data to get the new module
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
      
      // Refresh matrix data to get the updated name
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
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 bg-surface-container-low border shadow-2xl p-4 rounded-xl flex items-center gap-3 ${toast.type === 'error' ? 'border-red-500/50' : 'border-primary/30'}`}>
          <div className={`w-2.5 h-2.5 rounded-full animate-ping ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
          <span className="text-[13px] font-bold text-on-surface">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-1.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-primary shadow-sm"
            onClick={onOpenSidebar}
          >
            <PanelLeftOpen size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant bg-surface-container-low border border-outline-variant w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Shield size={12} className="text-primary" />
              Gobernanza y Autenticación
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight mt-1.5 flex items-center gap-2">
              Matriz de Roles
            </h1>
            <p className="text-[13px] text-on-surface-variant mt-1 font-medium">
              Configura los permisos predeterminados heredados por los usuarios según su rol funcional asignado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">

          <button 
            onClick={handleSaveClick}
            disabled={saving}
            className="flex-1 md:flex-initial bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Shield size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Rol Activo</span>
            <span className="text-base font-black text-on-surface block mt-0.5">{activeRole}</span>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Key size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Permisos Concedidos</span>
            <span className="text-base font-black text-on-surface block mt-0.5">{totalActivePermissions} reglas activas</span>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Activity size={22} />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Módulos Intervenidos</span>
            <span className="text-base font-black text-on-surface block mt-0.5">{activeModuleCount} de {modules.length} módulos</span>
          </div>
        </div>
      </div>

      {/* Main Layout Split Screen */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden pb-6">
        
        {/* Left Panel: Role List */}
        <div className="w-full lg:w-72 bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex flex-col shrink-0">
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-extrabold text-[12px] text-on-surface uppercase tracking-wider flex items-center gap-2">
              <Users size={14} className="text-primary" />
              Roles Funcionales
            </h3>
            <button 
              onClick={() => setShowAddRoleModal(true)}
              className="bg-primary text-on-primary hover:bg-primary-fixed text-on-primary p-1 rounded-md shadow-sm transition-colors"
              title="Nuevo Rol"
            >
              <Plus size={14} className="stroke-[2.5]" />
            </button>
          </div>
          
          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {roles.map((role) => {
              const isActive = role.nombre === activeRole;
              const permissionsCount = Object.values(matrixState[role.nombre] || {}).reduce((a, b) => a + b.length, 0);

              return (
                <div key={role.numericId} className={`w-full text-left px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-between group cursor-pointer ${
                  isActive 
                    ? 'bg-primary text-on-primary shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:bg-surface-container-lowest hover:text-on-surface border border-transparent'
                }`} onClick={() => setActiveRole(role.nombre)}>
                  <span className="truncate pr-2 flex-1">{role.nombre}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-container-lowest text-on-surface-variant group-hover:bg-[var(--border-color)]'
                    }`}>
                      {permissionsCount}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRole(role);
                        setEditRoleName(role.nombre);
                        setShowEditRoleModal(true);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                      }`}
                      title="Editar Rol"
                    >
                      <Edit2 size={12} className="stroke-[2.5]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(role);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-primary hover:bg-rose-50 dark:hover:bg-primary/10'
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
        <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-2xl p-5 flex flex-col overflow-hidden min-h-[500px]">
          
          {/* Table Header Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-4 border-b border-outline-variant shrink-0">
            <div>
              <h3 className="font-black text-sm text-on-surface">Matriz de Acceso</h3>
              <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">Controla qué acciones específicas puede realizar el rol sobre cada módulo.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Buscar módulo..."
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowAddModuleModal(true)}
                className="bg-primary text-on-primary hover:bg-primary-fixed text-on-primary px-3 py-1.5 rounded-lg shadow-sm transition-colors flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold"
                title="Nuevo Módulo"
              >
                <Plus size={14} className="stroke-[2.5]" />
                Agregar Módulo
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-outline-variant rounded-xl">
            <table className="w-full text-left border-collapse text-[11px] min-w-[800px]">
              <thead>
                <tr className="border-b border-outline-variant text-[11px] font-black text-on-surface uppercase tracking-wider bg-surface-container-low dark:bg-surface-container-low select-none sticky top-0 z-10">
                  <th className="py-3 px-4 group cursor-pointer hover:bg-surface-container-lowest transition-colors" onClick={() => handleSort('label')}>
                    <div className="flex items-center gap-1.5">
                      Módulo / Sección
                      {sortConfig.key === 'label' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />
                      ) : (
                        <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-1.5 text-center w-16 text-primary group cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('FULL')}>
                    <div className="flex items-center justify-center gap-1">
                      FULL
                      {sortConfig.key === 'FULL' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  {ALL_ACTIONS.map(act => (
                    <th key={act.id} className="py-3 px-1.5 text-center w-16 group cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort(act.id)}>
                      <div className="flex items-center justify-center gap-1">
                        {act.label}
                        {sortConfig.key === act.id ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-1.5 text-center w-16">OPCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={ALL_ACTIONS.length + 3} className="py-12 text-center text-on-surface-variant italic font-semibold">
                      No se encontraron módulos coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map(mod => {
                    return (
                      <tr key={mod.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50">
                        <td className="py-2.5 px-4 font-bold text-on-surface">
                          {mod.label}
                        </td>
                        
                        <td className="py-2 px-1.5 text-center border-r border-outline-variant">
                          {(() => {
                            const isFull = currentPermissions[mod.id]?.length === ALL_ACTIONS.length;
                            return (
                              <button
                                type="button"
                                onClick={() => handleToggleFull(mod.id)}
                                className={`p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer flex items-center justify-center ${
                                  isFull 
                                    ? 'bg-primary border-primary text-on-primary shadow-[0_0_10px_rgba(187,207,124,0.3)]' 
                                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-white'
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
                                className={`p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer flex items-center justify-center ${
                                  isChecked 
                                    ? 'bg-primary border-primary text-on-primary shadow-[0_0_10px_rgba(187,207,124,0.3)]' 
                                    : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-white'
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
                        
                        <td className="py-2 px-1.5 text-center border-l border-outline-variant">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingModule(mod);
                                setEditModuleName(mod.label);
                                setEditModuleOrder(mod.orden);
                                setEditModuleStatus(mod.estado);
                                setShowEditModuleModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                              title="Editar módulo"
                            >
                              <Edit2 size={14} className="stroke-[2.5]" />
                            </button>
                            <button
                              onClick={() => handleDeleteModule(mod)}
                              className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-primary/10"
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
          <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-start gap-2.5 shrink-0 animate-in fade-in">
            <Info size={15} className="text-indigo-500 shrink-0 mt-0.5" />
            <span className="text-[10.5px] leading-relaxed text-on-surface-variant font-medium">
              <strong>Nota:</strong> Los cambios realizados en esta matriz modificarán el comportamiento heredado predeterminado de los usuarios. Las cuentas que tengan configurados "Permisos Personalizados" individuales en su perfil no se verán afectadas por este cambio.
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
        description="¿Desea guardar los cambios realizados en las políticas de seguridad?"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border-outline-variant rounded-3xl shadow-xl w-[400px] overflow-hidden p-8 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-on-surface mb-3 tracking-tight">
              ¡Eliminado Exitosamente!
            </h3>
            <p className="text-[15px] text-on-surface-variant font-medium leading-relaxed mb-8 px-2">
              El registro ha sido eliminado correctamente de la base de datos.
            </p>
            <button 
              onClick={() => setShowDeleteSuccessModal(false)}
              className="w-full bg-[#00C985] hover:bg-[#00b377] text-white font-bold py-3.5 rounded-2xl shadow-sm hover:shadow transition-all text-[15px]"
            >
              Entendido
            </button>
          </div>
        </div>
      , document.body)}

      {/* Success Modal */}
      {showSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-outline-variant rounded-3xl shadow-xl w-[400px] overflow-hidden p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h3 className="text-2xl font-black text-on-surface mb-3 tracking-tight">
              ¡Guardado Exitosamente!
            </h3>
            <p className="text-[15px] text-on-surface-variant font-medium leading-relaxed mb-8 px-2">
              {successMessage}
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-primary hover:bg-primary-fixed text-on-primary font-bold py-3.5 rounded-2xl shadow-sm hover:shadow transition-all text-[15px]"
            >
              Entendido
            </button>
          </div>
        </div>
      , document.body)}

      {/* Add Module Modal */}
      {showAddModuleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border-outline-variant rounded-2xl shadow-xl w-[400px] overflow-hidden">
            <form onSubmit={handleAddModule}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Plus size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">Nuevo Módulo</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Nombre del Módulo
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej: Reportes Financieros"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-container-low border-t border-outline-variant rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddModuleModal(false);
                    setNewModuleName('');
                  }}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={addingModule || !newModuleName.trim()}
                  className="flex-1 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border-outline-variant rounded-2xl shadow-xl w-[400px] overflow-hidden">
            <form onSubmit={handleEditModule}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Edit2 size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">Editar Módulo</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Nombre del Módulo
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={editModuleName}
                      onChange={(e) => setEditModuleName(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1 w-1/3">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        Orden
                      </label>
                      <input
                        type="number"
                        required
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        value={editModuleOrder}
                        onChange={(e) => setEditModuleOrder(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1 w-2/3">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        Estado
                      </label>
                      <select
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
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
              <div className="p-5 flex items-center gap-3 bg-surface-container-low border-t border-outline-variant rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditModuleModal(false);
                    setEditingModule(null);
                  }}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingEditModule || !editModuleName.trim()}
                  className="flex-1 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border-outline-variant rounded-2xl shadow-xl w-[400px] overflow-hidden">
            <form onSubmit={handleAddRole}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Plus size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">Nuevo Rol Funcional</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Nombre del Rol
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Ej. Auditor de Operaciones"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-container-low border-t border-outline-variant rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddRoleModal(false);
                    setNewRoleName('');
                  }}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={addingRole || !newRoleName.trim()}
                  className="flex-1 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface-container-low border-outline-variant rounded-2xl shadow-xl w-[400px] overflow-hidden">
            <form onSubmit={handleEditRole}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Edit2 size={20} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">Editar Rol</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Nombre del Rol
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex items-center gap-3 bg-surface-container-low border-t border-outline-variant rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditRoleModal(false);
                    setEditingRole(null);
                  }}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingEditRole || !editRoleName.trim()}
                  className="flex-1 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
