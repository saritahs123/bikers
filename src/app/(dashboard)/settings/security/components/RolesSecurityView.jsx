"use client";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import SecurityConfirmDialog from '@/components/security/SecurityConfirmDialog';
import {
  Shield, Key, CheckSquare, Square, Save, Search,
  Info, Activity, Users, PanelLeftOpen, Loader2, Plus, Edit2, Trash2,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight, RotateCcw,
  LayoutGrid, CheckCheck, SlidersHorizontal, RefreshCw
} from 'lucide-react';
import { RBAC_ACTIONS } from '@/config/navigationConfig';

const ALL_ACTIONS = RBAC_ACTIONS;

const apiBase = '/api';

export default function RolesSecurityView({ onOpenSidebar = () => {} }) {
  const [activeRole, setActiveRole] = useState('');
  const [matrixState, setMatrixState] = useState({});
  const [screenMatrixState, setScreenMatrixState] = useState({});
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);

  // Permisos RBAC efectivos (Fase 6.4.13: Fail-safe defaults)
  const [permissions, setPermissions] = useState({
    puede_ver: false,
    puede_crear: false,
    puede_editar: false,
    puede_eliminar: false
  });
  const [syncing, setSyncing] = useState(false);

  // Unsaved changes tracking
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Modals state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [addingRole, setAddingRole] = useState(false);

  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
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
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMatrix = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setLoading(true);
      }
      const res = await fetch(`${apiBase}/matriz-acceso-rol?_t=${Date.now()}`);

      // Fase 6.4.13: Extracción de permisos RBAC del usuario autenticado
      const puedeVer = res.headers.get('x-perm-puede-ver') === 'true';
      const puedeCrear = res.headers.get('x-perm-puede-crear') === 'true';
      const puedeEditar = res.headers.get('x-perm-puede-editar') === 'true';
      const puedeEliminar = res.headers.get('x-perm-puede-eliminar') === 'true';

      if (!res.ok) throw new Error('Error fetching data');
      const data = await res.json();

      setPermissions({
        puede_ver: puedeVer || Boolean(data.userPermissions?.puede_ver),
        puede_crear: puedeCrear || Boolean(data.userPermissions?.puede_crear),
        puede_editar: puedeEditar || Boolean(data.userPermissions?.puede_editar),
        puede_eliminar: puedeEliminar || Boolean(data.userPermissions?.puede_eliminar)
      });

      const mods = data.modules || [];
      const rls = data.roles || [];

      setModules(mods);
      setRoles(rls);
      setMatrixState(data.matrix || {});
      setScreenMatrixState(data.screenMatrix || {});
      setHasChanges(false);

      // Iniciar con todos los módulos contraídos por defecto
      if (!isRefresh) {
        setExpandedModules({});
      }

      setActiveRole(prev => {
        if (prev && rls.some(r => r.nombre === prev)) return prev;
        return rls.length > 0 ? rls[0].nombre : '';
      });
    } catch (error) {
      console.error('Error fetching RBAC:', error);
      showToast('Error al cargar la matriz de roles', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMatrix(false);
  }, [fetchMatrix]);

  const currentPermissions = useMemo(() => {
    return matrixState[activeRole] || {};
  }, [matrixState, activeRole]);

  const currentScreenPermissions = useMemo(() => {
    return screenMatrixState[activeRole] || {};
  }, [screenMatrixState, activeRole]);

  // Toggle permission at menu level
  const handleTogglePermission = (moduleId, actionId) => {
    if (!permissions.puede_editar) return;
    const rolePerms = { ...currentPermissions };
    const actionList = rolePerms[moduleId] ? [...rolePerms[moduleId]] : [];

    let updatedList;
    if (actionList.includes(actionId)) {
      updatedList = actionList.filter(act => act !== actionId);
      if (updatedList.length === 0) {
        delete rolePerms[moduleId];
      } else {
        rolePerms[moduleId] = updatedList;
      }
    } else {
      updatedList = [...actionList, actionId];
      rolePerms[moduleId] = updatedList;
    }

    setMatrixState(prev => ({
      ...prev,
      [activeRole]: rolePerms
    }));
    setHasChanges(true);

    // Update child screens that inherit from this menu
    const targetModule = modules.find(m => m.id === moduleId);
    if (targetModule?.screens?.length) {
      const currentScreens = { ...currentScreenPermissions };
      targetModule.screens.forEach(screen => {
        const screenObj = currentScreens[screen.id];
        // If not explicitly overridden, update inherited actions
        if (!screenObj || !screenObj.isOverride) {
          currentScreens[screen.id] = {
            actions: updatedList || [],
            isOverride: false
          };
        }
      });
      setScreenMatrixState(prev => ({
        ...prev,
        [activeRole]: currentScreens
      }));
    }
  };

  // Toggle FULL actions for menu
  const handleToggleFull = (moduleId) => {
    if (!permissions.puede_editar) return;
    const rolePerms = { ...currentPermissions };
    const currentActions = rolePerms[moduleId] || [];

    let updatedList;
    if (currentActions.length === ALL_ACTIONS.length) {
      delete rolePerms[moduleId];
      updatedList = [];
    } else {
      updatedList = ALL_ACTIONS.map(a => a.id);
      rolePerms[moduleId] = updatedList;
    }

    setMatrixState(prev => ({
      ...prev,
      [activeRole]: rolePerms
    }));
    setHasChanges(true);

    // Propagate to non-overridden screens
    const targetModule = modules.find(m => m.id === moduleId);
    if (targetModule?.screens?.length) {
      const currentScreens = { ...currentScreenPermissions };
      targetModule.screens.forEach(screen => {
        const screenObj = currentScreens[screen.id];
        if (!screenObj || !screenObj.isOverride) {
          currentScreens[screen.id] = {
            actions: updatedList,
            isOverride: false
          };
        }
      });
      setScreenMatrixState(prev => ({
        ...prev,
        [activeRole]: currentScreens
      }));
    }
  };

  // Toggle specific screen permission (marks as override)
  const handleToggleScreenPermission = (screenId, actionId, parentModuleId) => {
    if (!permissions.puede_editar) return;
    const currentScreens = { ...currentScreenPermissions };
    const screenObj = currentScreens[screenId];
    const parentActions = currentPermissions[parentModuleId] || [];

    // Base actions from current state or inherited from parent
    const baseActions = screenObj?.actions ? [...screenObj.actions] : [...parentActions];

    let newActions;
    if (baseActions.includes(actionId)) {
      newActions = baseActions.filter(a => a !== actionId);
    } else {
      newActions = [...baseActions, actionId];
    }

    currentScreens[screenId] = {
      actions: newActions,
      isOverride: true
    };

    setScreenMatrixState(prev => ({
      ...prev,
      [activeRole]: currentScreens
    }));
    setHasChanges(true);
  };

  // Toggle FULL for a specific screen (marks as override)
  const handleToggleScreenFull = (screenId) => {
    if (!permissions.puede_editar) return;
    const currentScreens = { ...currentScreenPermissions };
    const screenObj = currentScreens[screenId];
    const currentActions = screenObj?.actions || [];

    const isFull = currentActions.length === ALL_ACTIONS.length;
    currentScreens[screenId] = {
      actions: isFull ? [] : ALL_ACTIONS.map(a => a.id),
      isOverride: true
    };

    setScreenMatrixState(prev => ({
      ...prev,
      [activeRole]: currentScreens
    }));
    setHasChanges(true);
  };

  // Reset a screen override to inherit from parent menu
  const handleResetScreenOverride = (screenId, parentModuleId) => {
    if (!permissions.puede_editar) return;
    const currentScreens = { ...currentScreenPermissions };
    const parentActions = currentPermissions[parentModuleId] || [];

    currentScreens[screenId] = {
      actions: [...parentActions],
      isOverride: false
    };

    setScreenMatrixState(prev => ({
      ...prev,
      [activeRole]: currentScreens
    }));
    setHasChanges(true);
    showToast('Permisos de pantalla restablecidos al valor heredado del menú');
  };

  // Expand / collapse all modules
  const handleToggleExpandAll = () => {
    const areAllExpanded = modules.every(m => expandedModules[m.id]);
    const nextState = {};
    modules.forEach(m => {
      nextState[m.id] = !areAllExpanded;
    });
    setExpandedModules(nextState);
  };

  const toggleModuleExpand = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleSaveClick = () => {
    if (!permissions.puede_editar) {
      showToast('No tienes permisos de edición en la matriz de roles.', 'error');
      return;
    }
    setShowSaveConfirmModal(true);
  };

  const handleExecuteSave = async () => {
    if (!permissions.puede_editar) {
      showToast('No tienes permisos de edición en la matriz de roles.', 'error');
      return;
    }
    setShowSaveConfirmModal(false);
    setSaving(true);
    try {
      const targetRole = roles.find(r => r.nombre === activeRole);
      if (!targetRole) throw new Error('Rol no seleccionado');

      const rolePerms = matrixState[activeRole] || {};
      const screenPerms = screenMatrixState[activeRole] || {};

      const payload = {
        roleId: targetRole.numericId,
        roleName: targetRole.nombre,
        modules: rolePerms,
        screens: screenPerms
      };

      const res = await fetch(`${apiBase}/matriz-acceso-rol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al guardar la matriz');
      }

      showToast(`Permisos guardados exitosamente para el rol ${targetRole.nombre}`);
      setSuccessMessage(`Las políticas de acceso del rol ${targetRole.nombre} han sido guardadas y sincronizadas.`);
      setHasChanges(false);
      setShowSuccessModal(true);
      fetchMatrix(true);
    } catch (error) {
      console.error('Error saving permissions:', error);
      showToast(error.message || 'Error al guardar la matriz de permisos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNavigation = async () => {
    if (!permissions.puede_editar && !permissions.puede_crear) {
      showToast('No tienes privilegios para ejecutar la sincronización de navegación.', 'error');
      return;
    }
    try {
      setSyncing(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error en sincronización');
      }
      showToast(`Sincronización completada (${data.menusSynced || 0} menús, ${data.screensSynced || 0} pantallas)`);
      fetchMatrix(true);
    } catch (err) {
      console.error('Error syncing navigation:', err);
      showToast(err.message || 'Error al sincronizar navegación', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    if (!permissions.puede_crear) {
      showToast('No tienes permisos para crear roles funcionales.', 'error');
      return;
    }
    if (!newRoleName.trim()) return;

    try {
      setAddingRole(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newRoleName.trim(),
          descripcion: newRoleDesc.trim() || null
        })
      });

      if (!res.ok) throw new Error('Failed to add role');

      setShowAddRoleModal(false);
      const createdName = newRoleName.trim();
      setNewRoleName('');
      setNewRoleDesc('');
      showToast('Rol funcional agregado con éxito');
      setActiveRole(createdName);
      setExpandedModules({});
      fetchMatrix(true);
    } catch (error) {
      console.error('Error adding role:', error);
      showToast('Error al agregar el rol', 'error');
    } finally {
      setAddingRole(false);
    }
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    if (!permissions.puede_editar) {
      showToast('No tienes permisos para editar roles funcionales.', 'error');
      return;
    }
    if (!editRoleName.trim() || !editingRole) return;

    try {
      setSavingEditRole(true);
      const res = await fetch(`${apiBase}/matriz-acceso-rol/role/${editingRole.numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editRoleName.trim(),
          descripcion: editRoleDesc.trim() || null,
          estado: editingRole.estado || 'ACTIVO'
        })
      });

      if (!res.ok) throw new Error('Failed to edit role');

      setShowEditRoleModal(false);
      setEditingRole(null);
      const updatedName = editRoleName.trim();
      setEditRoleName('');
      setEditRoleDesc('');
      showToast('Rol funcional editado con éxito');

      if (activeRole === editingRole.nombre) {
        setActiveRole(updatedName);
      }
      fetchMatrix(true);
    } catch (error) {
      console.error('Error editing role:', error);
      showToast('Error al editar el rol', 'error');
    } finally {
      setSavingEditRole(false);
    }
  };

  const handleDeleteRole = (role) => {
    if (!permissions.puede_eliminar) {
      showToast('No tienes permisos para inactivar roles funcionales.', 'error');
      return;
    }
    setDeleteContext({ type: 'role', item: role });
  };

  const confirmDelete = async () => {
    if (!deleteContext) return;
    setDeleting(true);
    try {
      const { item } = deleteContext;
      const url = `${apiBase}/matriz-acceso-rol/role/${item.numericId}`;

      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete role');

      showToast('Rol inactivado con éxito');

      if (activeRole === item.nombre) {
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

  // Filter modules and child screens by search
  const filteredModules = useMemo(() => {
    let result = [...modules];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => {
        const matchesMenu = m.label.toLowerCase().includes(q);
        const matchesScreen = m.screens?.some(s =>
          s.label.toLowerCase().includes(q) || s.ruta.toLowerCase().includes(q)
        );
        return matchesMenu || matchesScreen;
      });
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

  const totalOverridesCount = useMemo(() => {
    let count = 0;
    Object.values(currentScreenPermissions).forEach(scr => {
      if (scr?.isOverride) count++;
    });
    return count;
  }, [currentScreenPermissions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] w-full gap-3 font-mono">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-foreground-muted">Cargando Matriz de Roles y Accesos...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 flex flex-col min-h-screen animate-in fade-in duration-300 font-sans text-foreground">

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 bg-card border shadow-2xl p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === 'error' ? 'border-destructive/60 text-destructive' : 'border-primary/50 text-foreground'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'error' ? 'bg-destructive animate-ping' : 'bg-primary'}`} />
          <span className="text-xs font-mono font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-xl bg-card border border-border text-foreground-muted hover:text-primary transition-colors"
            onClick={onOpenSidebar}
            aria-label="Abrir menú lateral"
          >
            <PanelLeftOpen size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 w-max px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              <Shield size={12} className="text-primary" />
              Seguridad · Gobernanza RBAC
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1.5 flex items-center gap-2 font-mono">
              Matriz de Roles
            </h1>
            <p className="text-xs text-foreground-muted mt-1 font-medium">
              Control centralizado de permisos basado exclusivamente en los menús reales del Sidebar y accesos granulares por pantalla o reporte.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          {hasChanges && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs font-mono font-bold animate-pulse">
              <SlidersHorizontal size={13} />
              <span>Cambios sin guardar</span>
            </div>
          )}

          {permissions.puede_editar && (
            <button
              type="button"
              onClick={handleSyncNavigation}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl border border-border bg-surface-subtle hover:bg-hover text-foreground font-mono text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sincronizar menús y pantallas canónicas en la base de datos"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin text-primary" : "text-primary"} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          )}

          {permissions.puede_editar && (
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving || !hasChanges}
              className={`flex-1 md:flex-initial font-mono font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                hasChanges
                  ? 'bg-primary text-primary-foreground hover:brightness-110 ring-2 ring-primary/40'
                  : 'bg-primary text-primary-foreground hover:brightness-110'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </header>

      {/* Read-Only Mode Banner */}
      {!permissions.puede_editar && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs rounded-xl flex items-center gap-2.5 font-mono shadow-sm">
          <Shield size={16} className="text-amber-500 shrink-0" />
          <span>Modo Solo Lectura: Tu rol actual no posee permisos de edición sobre la Gobernanza RBAC. Las opciones de modificación y sincronización se encuentran deshabilitadas.</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-primary/15 text-primary rounded-xl shrink-0">
            <Shield size={20} />
          </div>
          <div className="min-w-0">
            <span className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Rol en Edición</span>
            <span className="text-sm md:text-base font-black text-foreground truncate block font-mono mt-0.5">{activeRole || 'Sin selección'}</span>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-sky-500/15 text-sky-500 rounded-xl shrink-0">
            <Key size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Permisos de Menú Activos</span>
            <span className="text-sm md:text-base font-black text-foreground block font-mono mt-0.5">{totalActivePermissions} reglas ({activeModuleCount} menús)</span>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-emerald-500/15 text-emerald-500 rounded-xl shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-foreground-muted">Pantallas Personalizadas</span>
            <span className="text-sm md:text-base font-black text-foreground block font-mono mt-0.5">{totalOverridesCount} anulaciones específicas</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Roles List + Matrix */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 pb-6 items-stretch">

        {/* Left Panel: Role List */}
        <div className="w-full lg:w-72 xl:w-80 bg-card border border-border rounded-xl p-4 flex flex-col shrink-0 shadow-sm space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-2 font-mono">
              <Users size={14} className="text-primary" />
              Roles Funcionales ({roles.length})
            </h3>
            {permissions.puede_crear && (
              <button
                type="button"
                onClick={() => setShowAddRoleModal(true)}
                className="bg-primary text-primary-foreground hover:brightness-110 p-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                title="Agregar Nuevo Rol"
              >
                <Plus size={14} className="stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[600px] lg:max-h-[calc(100vh-22rem)] pr-1 custom-scrollbar">
            {roles.map((role) => {
              const isActive = role.nombre === activeRole;
              const permissionsCount = Object.values(matrixState[role.nombre] || {}).reduce((a, b) => a + b.length, 0);

              return (
                <div
                  key={role.numericId}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/50'
                      : 'bg-surface-subtle/50 text-foreground-secondary hover:bg-hover hover:text-foreground border-border'
                  }`}
                  onClick={() => {
                    if (hasChanges && activeRole !== role.nombre) {
                      if (!confirm('Tiene cambios sin guardar en este rol. ¿Desea cambiar de rol y descartar los cambios no guardados?')) {
                        return;
                      }
                      setHasChanges(false);
                    }
                    if (activeRole !== role.nombre) {
                      setActiveRole(role.nombre);
                      setExpandedModules({});
                    }
                  }}
                >
                  <div className="truncate pr-2 flex-1 min-w-0">
                    <span className="block truncate font-mono">{role.nombre}</span>
                    {role.descripcion && (
                      <span className={`block truncate text-[10px] mt-0.5 ${isActive ? 'text-primary-foreground/80' : 'text-foreground-muted'}`}>
                        {role.descripcion}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide ${
                      isActive ? 'bg-black/25 text-primary-foreground' : 'bg-surface border border-border text-foreground-muted'
                    }`}>
                      {permissionsCount}
                    </span>
                    {permissions.puede_editar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRole(role);
                          setEditRoleName(role.nombre);
                          setEditRoleDesc(role.descripcion || '');
                          setShowEditRoleModal(true);
                        }}
                        className={`p-1 rounded-md transition-colors ${
                          isActive ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-black/20' : 'text-foreground-muted hover:text-primary hover:bg-hover'
                        }`}
                        title="Editar Rol"
                      >
                        <Edit2 size={12} className="stroke-[2.5]" />
                      </button>
                    )}
                    {role.numericId !== 1 && permissions.puede_eliminar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role);
                        }}
                        className={`p-1 rounded-md transition-colors ${
                          isActive ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-black/20' : 'text-foreground-muted hover:text-destructive hover:bg-destructive/10'
                        }`}
                        title="Inactivar Rol"
                      >
                        <Trash2 size={12} className="stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Permissions Matrix Table */}
        <div className="flex-1 bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col min-w-0 shadow-sm space-y-3">

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-extrabold text-sm text-foreground font-mono flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-primary" />
                Matriz de Acceso: <span className="text-primary underline">{activeRole}</span>
              </h3>
              <p className="text-[11px] text-foreground-muted font-medium mt-0.5">
                Los permisos asignados al menú funcionan como regla general; al expandir un menú puedes configurar restricciones específicas por pantalla o reporte.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Filtrar menú o pantalla..."
                  className="w-full bg-input border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-foreground placeholder:text-foreground-muted focus:border-primary outline-none font-sans"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface-subtle text-foreground-secondary hover:text-foreground hover:bg-hover text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                title="Expandir o contraer todas las secciones"
              >
                <LayoutGrid size={13} />
                <span>{modules.every(m => expandedModules[m.id]) ? 'Contraer' : 'Expandir'}</span>
              </button>
            </div>
          </div>

          {/* Legend helper bar */}
          <div className="flex flex-wrap items-center gap-4 text-[10.5px] font-mono py-1 px-2 text-foreground-muted bg-surface-subtle/40 border border-border/60 rounded-lg">
            <span className="font-bold uppercase tracking-wider text-foreground">Leyenda:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-[9px]">✓</div>
              <span>Concedido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded border border-primary/40 bg-primary/10 flex items-center justify-center text-primary text-[9px]">✓</div>
              <span>Heredado del Menú</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded border border-emerald-500 bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold">★</div>
              <span>Sobrescrito en Pantalla</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded border border-border bg-surface flex items-center justify-center text-foreground-muted text-[9px]">✕</div>
              <span>Denegado</span>
            </div>
          </div>

          {/* Table Container with Controlled Inner Scroll */}
          <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-24rem)] min-h-[420px] custom-scrollbar border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs min-w-[1020px]">
              <thead>
                <tr className="border-b border-border text-[10.5px] font-mono font-bold text-primary uppercase tracking-wider bg-surface-subtle select-none sticky top-0 z-20">
                  <th className="py-3 px-4 group cursor-pointer hover:bg-hover transition-colors min-w-[260px]" onClick={() => handleSort('label')}>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <span>MÓDULO / PANTALLA / REPORTE</span>
                      {sortConfig.key === 'label' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />
                      ) : (
                        <ArrowUpDown size={12} className="text-foreground-muted opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-1 text-center w-12 text-primary group cursor-pointer hover:bg-hover transition-colors" onClick={() => handleSort('FULL')}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>FULL</span>
                    </div>
                  </th>

                  {ALL_ACTIONS.map(act => (
                    <th key={act.id} className="py-3 px-1 text-center w-12 text-foreground-secondary group cursor-pointer hover:bg-hover transition-colors" onClick={() => handleSort(act.id)} title={act.tooltip}>
                      <div className="flex items-center justify-center gap-0.5">
                        <span>{act.label}</span>
                      </div>
                    </th>
                  ))}

                  <th className="py-3 px-2 text-center w-24 text-foreground-muted font-mono text-[10px]">
                    ESTADO / RESTAURAR
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={ALL_ACTIONS.length + 3} className="py-12 text-center text-foreground-muted italic font-semibold font-mono">
                      No se encontraron menús ni pantallas coincidentes con &quot;{search}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map(mod => {
                    const isExpanded = Boolean(expandedModules[mod.id]);
                    const menuActions = currentPermissions[mod.id] || [];
                    const isFullMenu = menuActions.length === ALL_ACTIONS.length;
                    const screenList = mod.screens || [];

                    return (
                      <React.Fragment key={mod.id}>
                        {/* Parent Menu Row */}
                        <tr className="bg-surface-subtle/60 hover:bg-hover/80 transition-colors font-medium border-t-2 border-border/80">
                          <td className="py-2.5 px-3 font-bold text-foreground font-mono">
                            <div className="flex items-center gap-2">
                              {screenList.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleModuleExpand(mod.id)}
                                  className="p-1 rounded-md text-foreground-muted hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                                  title={isExpanded ? 'Contraer pantallas' : 'Expandir pantallas'}
                                >
                                  {isExpanded ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <div className="w-5" />
                              )}
                              <span className="font-extrabold text-foreground tracking-wide font-mono text-[12px] uppercase">
                                {mod.label}
                              </span>
                              {screenList.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                                  {screenList.length} {screenList.some(s => s.tipo === 'REPORTE') ? 'reportes/pantallas' : 'pantallas'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Menu FULL Checkbox */}
                          <td className="py-2 px-1 text-center border-r border-border">
                            <button
                              type="button"
                              onClick={() => handleToggleFull(mod.id)}
                              disabled={!permissions.puede_editar}
                              className={`p-1.5 rounded-lg border transition-all ${
                                permissions.puede_editar ? 'hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                              } flex items-center justify-center mx-auto ${
                                isFullMenu
                                  ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                                  : 'bg-surface border-border text-foreground-muted hover:border-primary/40 hover:text-foreground'
                              }`}
                              title={!permissions.puede_editar ? 'Modo solo lectura' : (isFullMenu ? 'Desmarcar todo el menú' : 'Conceder todas las acciones al menú')}
                            >
                              {isFullMenu ? <CheckSquare size={13} className="stroke-[2.5]" /> : <Square size={13} className="stroke-[2]" />}
                            </button>
                          </td>

                          {/* Menu Action Checkboxes */}
                          {ALL_ACTIONS.map(act => {
                            const isChecked = menuActions.includes(act.id);
                            return (
                              <td key={act.id} className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(mod.id, act.id)}
                                  disabled={!permissions.puede_editar}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    permissions.puede_editar ? 'hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                                  } flex items-center justify-center mx-auto ${
                                    isChecked
                                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                                      : 'bg-surface border-border text-foreground-muted hover:border-primary/40 hover:text-foreground'
                                  }`}
                                  title={!permissions.puede_editar ? 'Modo solo lectura' : `${isChecked ? 'Remover' : 'Conceder'} ${act.label} en menú ${mod.label}`}
                                >
                                  {isChecked ? <CheckSquare size={13} className="stroke-[2.5]" /> : <Square size={13} className="stroke-[2]" />}
                                </button>
                              </td>
                            );
                          })}

                          {/* Menu Status */}
                          <td className="py-2 px-2 text-center border-l border-border">
                            <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase">
                              Menú Raíz
                            </span>
                          </td>
                        </tr>

                        {/* Child Screens (when expanded) */}
                        {isExpanded && screenList.map((screen) => {
                          const screenData = currentScreenPermissions[screen.id];
                          const isOverride = Boolean(screenData?.isOverride);
                          const activeActions = screenData?.actions || menuActions;
                          const isFullScreen = activeActions.length === ALL_ACTIONS.length;

                          return (
                            <tr key={screen.id} className="bg-card hover:bg-hover/50 transition-colors text-xs border-b border-border/40">
                              {/* Screen Name & Route */}
                              <td className="py-2 px-3 pl-8 font-sans">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground-muted text-xs font-mono select-none">└─</span>
                                  {screen.tipo === 'REPORTE' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                                      REPORTE
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                                      PANTALLA
                                    </span>
                                  )}
                                  <span className="font-semibold text-foreground font-sans text-xs">
                                    {screen.label}
                                  </span>
                                </div>
                              </td>

                              {/* Screen FULL Checkbox */}
                              <td className="py-2 px-1 text-center border-r border-border">
                                <button
                                  type="button"
                                  onClick={() => handleToggleScreenFull(screen.id)}
                                  disabled={!permissions.puede_editar}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    permissions.puede_editar ? 'hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                                  } flex items-center justify-center mx-auto ${
                                    isFullScreen
                                      ? (isOverride ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-primary/20 border-primary/40 text-primary')
                                      : 'bg-surface/50 border-border/60 text-foreground-muted hover:border-primary/40 hover:text-foreground'
                                  }`}
                                  title={!permissions.puede_editar ? 'Modo solo lectura' : (isFullScreen ? 'Desmarcar todas las acciones de pantalla' : 'Conceder todas las acciones a esta pantalla (anulará el menú)')}
                                >
                                  {isFullScreen ? (
                                    isOverride ? <CheckCheck size={13} className="stroke-[2.5]" /> : <CheckSquare size={13} className="stroke-[2]" />
                                  ) : (
                                    <Square size={13} className="stroke-[1.5]" />
                                  )}
                                </button>
                              </td>

                              {/* Screen Action Checkboxes */}
                              {ALL_ACTIONS.map(act => {
                                const isActionGranted = activeActions.includes(act.id);
                                const isInherited = !isOverride;

                                return (
                                  <td key={act.id} className="py-1.5 px-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleScreenPermission(screen.id, act.id, mod.id)}
                                      disabled={!permissions.puede_editar}
                                      className={`p-1.5 rounded-lg border transition-all ${
                                        permissions.puede_editar ? 'hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                                      } flex items-center justify-center mx-auto ${
                                        isActionGranted
                                          ? isInherited
                                            ? 'bg-primary/10 border-primary/30 text-primary hover:border-primary'
                                            : 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                          : isInherited
                                            ? 'bg-surface/40 border-border/50 text-foreground-disabled hover:border-primary/30'
                                            : 'bg-destructive/15 border-destructive/40 text-destructive'
                                      }`}
                                      title={
                                        !permissions.puede_editar
                                          ? 'Modo solo lectura'
                                          : isInherited
                                            ? `Heredado de ${mod.label}: ${isActionGranted ? 'Concedido' : 'Denegado'}. Haz clic para personalizar.`
                                            : `Sobrescrito para ${screen.label}: ${isActionGranted ? 'Concedido' : 'Denegado'}.`
                                      }
                                    >
                                      {isActionGranted ? (
                                        isInherited ? <CheckSquare size={13} className="stroke-[1.8]" /> : <CheckCheck size={13} className="stroke-[2.5]" />
                                      ) : (
                                        <Square size={13} className="stroke-[1.5]" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}

                              {/* Screen Override Status & Reset */}
                              <td className="py-2 px-2 text-center border-l border-border">
                                {isOverride ? (
                                  permissions.puede_editar ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResetScreenOverride(screen.id, mod.id)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                                      title="Restablecer a permisos heredados del menú"
                                    >
                                      <RotateCcw size={10} />
                                      <span>Heredar</span>
                                    </button>
                                  ) : (
                                    <span className="text-[9.5px] font-mono font-bold text-amber-500" title="Sobrescrito en pantalla">
                                      Sobrescrito
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[9.5px] font-mono text-foreground-muted" title="Hereda exactamente los permisos del menú padre">
                                    Heredado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info Notice */}
          <div className="mt-2 p-3 bg-surface-subtle/80 border border-border rounded-xl flex items-start gap-2.5 shrink-0 text-xs">
            <Info size={16} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-foreground-secondary leading-snug">
              <p>
                <strong>Precedencia de permisos:</strong> Los permisos concedidos a nivel de menú aplican de forma general a todas sus pantallas y reportes. Si una pantalla requiere restricciones o privilegios especiales, márcalos en la fila expandida correspondiente; la regla específica de pantalla prevalecerá sobre la del menú.
              </p>
              <p className="text-[11px] text-foreground-muted">
                Los usuarios con asignación de <em>Administrador General</em> o permisos personalizados individuales en su ficha de usuario conservarán su alcance correspondiente.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Save Confirmation Modal */}
      <SecurityConfirmDialog
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={handleExecuteSave}
        variant="default"
        title="¿Guardar cambios en la Matriz de Roles?"
        description={`Se actualizarán las políticas de acceso del rol "${activeRole}" en la base de datos, sincronizando permisos de menú y accesos específicos de pantallas.`}
        confirmLabel="Guardar cambios"
      />

      {/* Delete Role Confirmation Modal */}
      <SecurityConfirmDialog
        isOpen={Boolean(deleteContext)}
        onClose={() => setDeleteContext(null)}
        onConfirm={confirmDelete}
        variant="danger"
        title="¿Inactivar rol funcional?"
        description={`¿Está seguro de que desea inactivar el rol "${deleteContext?.item?.nombre}"? Los usuarios asignados perderán los privilegios asociados a este rol.`}
        confirmLabel={deleting ? 'Inactivando...' : 'Inactivar Rol'}
      />

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-extrabold text-base text-foreground font-mono flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Crear Rol Funcional
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="text-foreground-muted hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRole} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-foreground">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Supervisor de Taller"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-foreground">Descripción</label>
                <textarea
                  placeholder="Descripción de responsabilidades..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-primary outline-none resize-none h-20"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground-muted hover:text-foreground text-xs font-mono font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingRole || !newRoleName.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:brightness-110 text-xs font-mono font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addingRole ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>{addingRole ? 'Creando...' : 'Crear Rol'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditRoleModal && editingRole && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-extrabold text-base text-foreground font-mono flex items-center gap-2">
                <Edit2 size={16} className="text-primary" />
                Editar Rol Funcional
              </h3>
              <button
                type="button"
                onClick={() => setShowEditRoleModal(false)}
                className="text-foreground-muted hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditRole} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-foreground">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-foreground">Descripción</label>
                <textarea
                  value={editRoleDesc}
                  onChange={(e) => setEditRoleDesc(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-primary outline-none resize-none h-20"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditRoleModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground-muted hover:text-foreground text-xs font-mono font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditRole || !editRoleName.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:brightness-110 text-xs font-mono font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingEditRole ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{savingEditRole ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckSquare size={24} />
            </div>
            <h3 className="font-extrabold text-base text-foreground font-mono">¡Operación Exitosa!</h3>
            <p className="text-xs text-foreground-muted">{successMessage}</p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-mono font-bold text-xs hover:brightness-110"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Delete Success Modal */}
      {showDeleteSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="font-extrabold text-base text-foreground font-mono">Rol Inactivado</h3>
            <p className="text-xs text-foreground-muted">El rol funcional ha sido inactivado correctamente.</p>
            <button
              type="button"
              onClick={() => setShowDeleteSuccessModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-mono font-bold text-xs hover:brightness-110"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
