"use client";
import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { 
  Users, UserPlus, Download, Edit2, ShieldAlert,
  MoreVertical, X, Save, Search, Check, CheckCircle2, AlertCircle, 
  RotateCw, ChevronLeft, ChevronRight, ChevronDown, Filter, SlidersHorizontal, ToggleLeft, ToggleRight,
  ShieldCheck, Shield, Key, Trash2, Mail, Phone, Building2, Eye, EyeOff, PanelLeftOpen, LayoutGrid, List,
  FileText, Calendar, Clock, Laptop, ShieldX, CheckSquare, Square, Info, AlertTriangle, ArrowRight, Settings
} from 'lucide-react';
import { validateRNC, validatePhoneDR, formatPhoneDR, validateEmail } from '@/lib/validations';
import { usersService } from '@/services/usersService';
import { catalogosService } from '@/services/catalogosService';
import { INITIAL_USERS_DATA, USER_ROLES, DATA_SCOPES, USER_TYPES, INITIAL_SESSIONS_DATA, INITIAL_ACTIVITY_DATA, INITIAL_AUDIT_DATA, PREDEFINED_JOB_TITLES, PREDEFINED_DEPARTMENTS, PREDEFINED_AGENCIES, INITIAL_DEPARTMENTS_DATA, INITIAL_AREAS_DATA } from '@/config/catalogs/usersCatalog';
import { INITIAL_COMPANIES_DATA } from '@/config/catalogs/companiesCatalog';

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

export default function UsersSecurityView({ onOpenSidebar }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState(() => (typeof window !== 'undefined' ? window.sessionsData : null) || INITIAL_SESSIONS_DATA);
  const [activities, setActivities] = useState(() => (typeof window !== 'undefined' ? window.activitiesData : null) || INITIAL_ACTIVITY_DATA);
  const [audits, setAudits] = useState(() => (typeof window !== 'undefined' ? window.auditData : null) || INITIAL_AUDIT_DATA);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [modules, setModules] = useState([]);
  const [rbacMatrix, setRbacMatrix] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [paises, setPaises] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [apiMatrixMap, setApiMatrixMap] = useState({});

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await usersService.getAllUsers();
      setData(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function loadCatalogos() {
      try {
        const [emp, dep, ar, car, rol, tipos, mods, rbac, agrups, agens, pais, reg, prov, mun, dist, sec] = await Promise.all([
          catalogosService.getEmpresas(),
          catalogosService.getDepartamentos(),
          catalogosService.getAreas(),
          catalogosService.getCargos(),
          catalogosService.getRolesFuncionales(),
          catalogosService.getTiposUsuario(),
          catalogosService.getModulos(),
          catalogosService.getMatrizAccesoRol(),
          catalogosService.getAgrupaciones(),
          catalogosService.getAgencias(),
          catalogosService.getPaises(),
          catalogosService.getRegiones(),
          catalogosService.getProvincias(),
          catalogosService.getMunicipios(),
          catalogosService.getDistritosMunicipales(),
          catalogosService.getSectores()
        ]);
        setCompanies(emp || []);
        setDepartments(dep || []);
        setAreas(ar || []);
        setCargos(car || []);
        setUserTypes(tipos || []);
        setAgrupaciones(agrups || []);
        setAgencias(agens || []);
        setPaises(pais || []);
        setRegiones(reg || []);
        setProvincias(prov || []);
        setMunicipios(mun || []);
        setDistritos(dist || []);
        setSectores(sec || []);

        // Fetch real RBAC matrix & modules from API route
        let apiData = null;
        try {
          const res = await fetch('/api/matriz-acceso-rol');
          if (res.ok) {
            apiData = await res.json();
          }
        } catch (e) {
          console.error("Error fetching /api/matriz-acceso-rol:", e);
        }

        const FALLBACK_MODULES = [
          { id: 1, name: "Dashboard", label: "Dashboard" },
          { id: 2, name: "Órdenes de Trabajo", label: "Órdenes de Trabajo" },
          { id: 3, name: "Inventario & Partes", label: "Inventario & Partes" },
          { id: 4, name: "Clientes", label: "Clientes" },
          { id: 5, name: "Facturación", label: "Facturación" },
          { id: 6, name: "Administrar Usuarios", label: "Administrar Usuarios" },
          { id: 7, name: "Matriz de Roles & Permisos", label: "Matriz de Roles & Permisos" },
          { id: 8, name: "Configuración del Sistema", label: "Configuración del Sistema" }
        ];

        if (apiData && apiData.modules && apiData.modules.length > 0) {
          setModules(apiData.modules.map(m => ({
            id: m.id,
            name: m.label || m.nombre || m.name || `Módulo ${m.id}`,
            label: m.label || m.nombre || m.name || `Módulo ${m.id}`,
            orden: m.orden
          })));
        } else if (mods && mods.length > 0) {
          setModules(mods);
        } else {
          setModules(FALLBACK_MODULES);
        }

        if (apiData && apiData.roles && apiData.roles.length > 0) {
          setRoles(apiData.roles.map(r => ({
            id: r.numericId || r.id,
            name: r.nombre || r.name,
            nombre: r.nombre || r.name,
            descripcion: r.descripcion,
            estado: r.estado
          })));
        } else if (rol && rol.length > 0) {
          setRoles(rol);
        }

        if (apiData && apiData.matrix) {
          setApiMatrixMap(apiData.matrix);
        }
        if (apiData && apiData.rawMatrix) {
          setRbacMatrix(apiData.rawMatrix);
        } else if (rbac) {
          setRbacMatrix(rbac);
        }
      } catch (err) {
        console.error("Error loading catalogos:", err);
      }
    }
    loadCatalogos();
  }, []);

  // Compute defaultRolePermissions dynamically based on the DB rbacMatrix
  const defaultRolePermissions = useMemo(() => {
    if (apiMatrixMap && Object.keys(apiMatrixMap).length > 0) {
      return apiMatrixMap;
    }
    const perms = {};
    if (!roles || !rbacMatrix) return perms;
    
    roles.forEach(role => {
      const roleName = role.name || role.nombre;
      perms[roleName] = {};
      const roleRbac = Array.isArray(rbacMatrix) ? rbacMatrix.filter(r => r.rol_funcional_id === (role.id || role.numericId)) : [];
      
      roleRbac.forEach(row => {
        const allowedActions = [];
        ALL_ACTIONS.forEach(action => {
          const colName = `puede_${action.id}`;
          if (row[colName]) {
            allowedActions.push(action.id);
          }
        });
        perms[roleName][row.modulo_sistema_id] = allowedActions;
      });
    });
    return perms;
  }, [roles, rbacMatrix, apiMatrixMap]);

  useEffect(() => { fetchUsers(); }, []);

  // Detail 360 States
  const [detailUser, setDetailUser] = useState(null);
  const [activeTab360, setActiveTab360] = useState('resumen');
  const [realUserSessions, setRealUserSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sortConfigSesiones, setSortConfigSesiones] = useState({ key: 'login_time', direction: 'desc' });

  const handleSortSesiones = (key) => {
    let direction = 'asc';
    if (sortConfigSesiones.key === key && sortConfigSesiones.direction === 'asc') direction = 'desc';
    setSortConfigSesiones({ key, direction });
  };

  useEffect(() => {
    if (detailUser?.id && activeTab360 === 'sesiones') {
      fetchUserSessions(detailUser.id);
    }
  }, [detailUser?.id, activeTab360]);

  const fetchUserSessions = async (id) => {
    try {
      setIsLoadingSessions(true);
      const data = await usersService.getUserSessions(id);
      setRealUserSessions(data || []);
    } catch (e) {
      console.error('Error fetching sessions:', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const [isEditing360, setIsEditing360] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [edit360Error, setEdit360Error] = useState('');
  const [formErrors360, setFormErrors360] = useState({});
  const [matrixFilter, setMatrixFilter] = useState('all');

  const handleExecuteSave360 = async () => {
    setShowConfirmSaveModal(false);
    const targetData = wizardData || detailUser;
    if (!targetData) return;

    try {
      setIsSaving(true);
      const fullName = `${(targetData.first_name || '').trim()} ${(targetData.last_name || '').trim()}`.trim() || targetData.full_name;
      const updatedUser = {
        ...targetData,
        full_name: fullName,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin'
      };

      if (updatedUser.rol_id) {
        const rObj = roles.find(r => r.id == updatedUser.rol_id);
        if (rObj) updatedUser.role = rObj.name;
      }

      await usersService.updateUser(updatedUser.id, updatedUser);

      // Update local state
      setData(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
      setDetailUser(updatedUser);
      setIsEditing360(false);
      setWizardData(null);
      
      addAuditLog(updatedUser.id, 'Modificación de Usuario', 'users', 'Perfil anterior', 'Perfil actualizado', 'Cambios guardados por administrador desde Editar Usuario');
      addActivityLog(updatedUser.id, 'Cuenta Actualizada', 'Información del perfil de usuario modificada correctamente.');
      showToast('Cambios guardados con éxito.');
    } catch (err) {
      console.error("Error saving user:", err);
      showToast('Error al guardar cambios del usuario.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const [selectedIds, setSelectedIds] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [companyFilter, setCompanyFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [mfaFilter, setMfaFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [lastAccessFilter, setLastAccessFilter] = useState('Todos');
  const [deptFilter, setDeptFilter] = useState('Todos');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [activationFilter, setActivationFilter] = useState('Todos');
  const [accessMethodFilter, setAccessMethodFilter] = useState('Todos');
  const [invitationFilter, setInvitationFilter] = useState('Todos');
  const [firstLoginFilter, setFirstLoginFilter] = useState('Todos');
  
  // Next.js Navigation hooks mapped to react-router-dom style API for compatibility
  const router = useRouter();
  const pathname = usePathname();
  const nextSearchParams = useNextSearchParams();
  const searchParamsString = nextSearchParams?.toString() || "";
  const searchParams = useMemo(() => new URLSearchParams(searchParamsString), [searchParamsString]);
  const setSearchParams = (params) => {
    const newSearchParams = new URLSearchParams(params);
    const queryStr = newSearchParams.toString();
    const newUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
    window.history.replaceState(null, '', newUrl);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Wizard States
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState(null);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [tempPassword, setTempPassword] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showUserTypeDropdown, setShowUserTypeDropdown] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);

  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [agencySearchQuery, setAgencySearchQuery] = useState('');
  const [agencyZoneFilter, setAgencyZoneFilter] = useState('');

  // Safe Date Formatting Helpers
  const formatSafeDate = (dateVal, fallback = '—') => {
    if (!dateVal || dateVal === 'null' || dateVal === 'undefined') return fallback;
    const parsed = new Date(dateVal);
    if (isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleDateString();
  };

  const formatSafeDateTime = (dateVal, fallback = '—') => {
    if (!dateVal || dateVal === 'null' || dateVal === 'undefined') return fallback;
    const parsed = new Date(dateVal);
    if (isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleString();
  };

  const formatExpiracionDate = (dateVal) => {
    if (!dateVal || dateVal === 'Cualquiera' || dateVal === 'Sin expiración' || dateVal === 'null' || dateVal === 'undefined') return 'Sin expiración';
    const parsed = new Date(dateVal);
    if (isNaN(parsed.getTime())) return 'Sin expiración';
    return parsed.toLocaleDateString();
  };

  // Parse cross-navigation and detail parameters
  useEffect(() => {
    const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams(searchParamsString);
    const deptId = sp.get('departmentId');
    const areaId = sp.get('areaId');
    const userIdParam = sp.get('userId');

    if (deptId) {
      setDeptFilter(deptId);
    }
    if (areaId) {
      setAreaFilter(areaId);
    }
    if (userIdParam) {
      if (data.length > 0) {
        const user = data.find(u => String(u.id) === String(userIdParam));
        if (user) {
          if (!detailUser || String(detailUser.id) !== String(userIdParam) || !detailUser.detalle_estado) {
            usersService.getUserById(user.id).then(res => {
              const currentSp = new URLSearchParams(window.location.search);
              if (currentSp.get('userId') === String(userIdParam)) {
                setDetailUser({ ...user, ...res });
                const tabParam = currentSp.get('tab');
                if (tabParam) setActiveTab360(tabParam);
              }
            }).catch(() => {
              const currentSp = new URLSearchParams(window.location.search);
              if (currentSp.get('userId') === String(userIdParam)) {
                setDetailUser(user);
                const tabParam = currentSp.get('tab');
                if (tabParam) setActiveTab360(tabParam);
              }
            });
          } else {
            const tabParam = sp.get('tab');
            if (tabParam) setActiveTab360(tabParam);
          }
        } else {
          const currentSp = new URLSearchParams(window.location.search);
          currentSp.delete('userId');
          currentSp.delete('tab');
          setSearchParams(currentSp);
          setDetailUser(null);
        }
      }
    } else {
      setDetailUser(null);
    }
  }, [searchParamsString, data]);

  const filteredJobTitles = useMemo(() => {
    const query = (wizardData?.job_title || '').toLowerCase();
    if (!query) return PREDEFINED_JOB_TITLES;
    return PREDEFINED_JOB_TITLES.filter(title => title.toLowerCase().includes(query));
  }, [wizardData?.job_title]);

  const filteredUserTypes = useMemo(() => {
    const query = (wizardData?.user_type || '').toLowerCase();
    if (!query) return userTypes;
    return userTypes.filter(type => type.name.toLowerCase().includes(query));
  }, [wizardData?.user_type, userTypes]);

  const filteredDepartments = useMemo(() => {
    const query = (wizardData?.department || '').toLowerCase();
    if (!query) return PREDEFINED_DEPARTMENTS;
    return PREDEFINED_DEPARTMENTS.filter(dept => dept.toLowerCase().includes(query));
  }, [wizardData?.department]);

  const handleViewDetail = async (item, tab = 'resumen') => {
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : searchParamsString);
      sp.set('userId', item.id);
      sp.set('tab', tab);
      setSearchParams(sp);
      
      const res = await usersService.getUserById(item.id);
      setDetailUser({ ...item, ...res });
      setActiveTab360(tab);
      if (tab === 'permisos') setMatrixFilter('all');
    } catch (err) {
      console.error('Error fetching user details:', err);
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : searchParamsString);
      sp.set('userId', item.id);
      sp.set('tab', tab);
      setSearchParams(sp);
      setDetailUser(item);
      setActiveTab360(tab);
      if (tab === 'permisos') setMatrixFilter('all');
    }
  };

  const handleGoBack = () => {
    setDetailUser(null);
    setIsEditing360(false);
    setWizardData(null);
    setEdit360Error('');

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      sp.delete('userId');
      sp.delete('tab');
      const queryStr = sp.toString();
      const newUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, '', newUrl);
    }
  };

  // Reason Modal States
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showConfirmEditModal, setShowConfirmEditModal] = useState(false);
  const [showSuccessWizardModal, setShowSuccessWizardModal] = useState(false);
  const [successWizardMessage, setSuccessWizardMessage] = useState('');
  const [showSuccessEditModal, setShowSuccessEditModal] = useState(false);
  const [reasonAction, setReasonAction] = useState(null); // { type, userId, payload }
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Delete User State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);



  // Delete User handlers
  const handleDeleteUserClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
    setActiveDropdown(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await usersService.deleteUser(userToDelete.id);
      showToast('Usuario eliminado correctamente.');
      fetchUsers();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      showToast('Error al intentar eliminar el usuario.', 'error');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  // Toast
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, companyFilter, statusFilter, mfaFilter, typeFilter, lastAccessFilter]);

  useEffect(() => {
    const handleGlobalClick = () => { if (activeDropdown) setActiveDropdown(null); };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeDropdown]);

  useEffect(() => {
    const handleCloseJobDropdown = (e) => {
      if (!e.target.closest('.job-dropdown-container')) {
        setShowJobDropdown(false);
      }
    };
    if (showJobDropdown) {
      window.addEventListener('click', handleCloseJobDropdown);
    }
    return () => window.removeEventListener('click', handleCloseJobDropdown);
  }, [showJobDropdown]);

  useEffect(() => {
    const handleCloseUserTypeDropdown = (e) => {
      if (!e.target.closest('.user-type-dropdown-container')) {
        setShowUserTypeDropdown(false);
      }
    };
    if (showUserTypeDropdown) {
      window.addEventListener('click', handleCloseUserTypeDropdown);
    }
    return () => window.removeEventListener('click', handleCloseUserTypeDropdown);
  }, [showUserTypeDropdown]);

  useEffect(() => {
    const handleCloseDeptDropdown = (e) => {
      if (!e.target.closest('.dept-dropdown-container')) {
        setShowDeptDropdown(false);
      }
    };
    if (showDeptDropdown) {
      window.addEventListener('click', handleCloseDeptDropdown);
    }
    return () => window.removeEventListener('click', handleCloseDeptDropdown);
  }, [showDeptDropdown]);

  useEffect(() => {
    const handleCloseCompanyDropdown = (e) => {
      if (!e.target.closest('.company-dropdown-container')) {
        setShowCompanyDropdown(false);
      }
    };
    if (showCompanyDropdown) {
      window.addEventListener('click', handleCloseCompanyDropdown);
    }
    return () => window.removeEventListener('click', handleCloseCompanyDropdown);
  }, [showCompanyDropdown]);

  useEffect(() => {
    const handleCloseAreaDropdown = (e) => {
      if (!e.target.closest('.area-dropdown-container')) {
        setShowAreaDropdown(false);
      }
    };
    if (showAreaDropdown) {
      window.addEventListener('click', handleCloseAreaDropdown);
    }
    return () => window.removeEventListener('click', handleCloseAreaDropdown);
  }, [showAreaDropdown]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncData = (newData) => {
    setData(newData);
  };

  const syncSessions = (newSessions) => {
    setSessions(newSessions);
    if (typeof window !== 'undefined') window.sessionsData = newSessions;
  };

  const syncAudits = (newAudits) => {
    setAudits(newAudits);
    if (typeof window !== 'undefined') window.auditData = newAudits;
  };

  const addAuditLog = (userId, action, entity, before, after, reason) => {
    const newLog = {
      id: `AUD-NEW-${Date.now()}`,
      user_id: userId,
      action,
      entity,
      before_value: before,
      after_value: after,
      performed_by: 'Admin',
      performed_at: new Date().toISOString(),
      reason: reason || 'Acción administrativa ordinaria',
      ip_address: '186.6.14.99',
      result: 'Exitoso'
    };
    const updated = [newLog, ...audits];
    syncAudits(updated);
  };

  const addActivityLog = (userId, event, desc) => {
    const newAct = {
      id: `ACT-NEW-${Date.now()}`,
      user_id: userId,
      event,
      desc,
      timestamp: new Date().toISOString(),
      ip: '186.6.14.99'
    };
    const updated = [newAct, ...activities];
    setActivities(updated);
    if (typeof window !== 'undefined') window.activitiesData = updated;
  };

  // Filters matching logic
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search || 
                          (item.full_name && item.full_name.toLowerCase().includes(searchLower)) ||
                          (item.email && item.email.toLowerCase().includes(searchLower)) ||
                          (item.document_number && item.document_number.toLowerCase().includes(searchLower)) ||
                          item.login_identifiers?.some(id => id.identifier_value && id.identifier_value.toLowerCase().includes(searchLower));

      const matchRole = roleFilter === 'Todos' || item.role === roleFilter;
      const matchCompany = companyFilter === 'Todas' || item.companyId === companyFilter;
      const matchStatus = statusFilter === 'Todos' || item.status === statusFilter;
      const matchType = typeFilter === 'Todos' || item.user_type === typeFilter;
      
      const matchMfa = mfaFilter === 'Todos' || 
                       (mfaFilter === 'Habilitado' && item.mfaEnabled) || 
                       (mfaFilter === 'Deshabilitado' && !item.mfaEnabled);

      let matchLastAccess = true;
      if (lastAccessFilter === 'Nunca') {
        matchLastAccess = !item.last_login_at;
      } else if (lastAccessFilter === 'Hoy') {
        if (!item.last_login_at) {
          matchLastAccess = false;
        } else {
          const diffMs = Date.now() - new Date(item.last_login_at).getTime();
          matchLastAccess = diffMs <= 24 * 60 * 60 * 1000;
        }
      } else if (lastAccessFilter === 'Semana') {
        if (!item.last_login_at) {
          matchLastAccess = false;
        } else {
          const diffMs = Date.now() - new Date(item.last_login_at).getTime();
          matchLastAccess = diffMs <= 7 * 24 * 60 * 60 * 1000;
        }
      } else if (lastAccessFilter === 'Mes') {
        if (!item.last_login_at) {
          matchLastAccess = false;
        } else {
          const diffMs = Date.now() - new Date(item.last_login_at).getTime();
          matchLastAccess = diffMs > 7 * 24 * 60 * 60 * 1000;
        }
      }

      const matchDept = deptFilter === 'Todos' || item.department_id === deptFilter;
      const matchArea = areaFilter === 'Todos' || item.area_id === areaFilter;

      // Onboarding & activation filters matching
      const matchActivation = activationFilter === 'Todos' || item.activation?.activation_status === activationFilter;
      
      const userAccessMethod = item.activation?.access_method || (item.email ? 'EMAIL' : 'DOCUMENT');
      const matchAccessMethod = accessMethodFilter === 'Todos' || userAccessMethod === accessMethodFilter;

      const isInvited = item.activation?.invitation_sent_at !== null && item.activation?.invitation_sent_at !== undefined;
      const matchInvitation = invitationFilter === 'Todos' || 
                               (invitationFilter === 'Enviada' && isInvited) || 
                               (invitationFilter === 'NoEnviada' && !isInvited);

      const hasLoggedIn = item.activation?.first_login_at !== null && item.activation?.first_login_at !== undefined;
      const matchFirstLogin = firstLoginFilter === 'Todos' || 
                               (firstLoginFilter === 'Realizado' && hasLoggedIn) || 
                               (firstLoginFilter === 'NoRealizado' && !hasLoggedIn);

      return matchSearch && matchRole && matchCompany && matchStatus && matchType && matchMfa && matchLastAccess && matchDept && matchArea && matchActivation && matchAccessMethod && matchInvitation && matchFirstLogin;
    });
  }, [data, search, roleFilter, companyFilter, statusFilter, mfaFilter, typeFilter, lastAccessFilter, deptFilter, areaFilter, activationFilter, accessMethodFilter, invitationFilter, firstLoginFilter]);

  // Sorted Data (Active first, then by name)
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (a.status === 'Activo' && b.status !== 'Activo') return -1;
      if (a.status !== 'Activo' && b.status === 'Activo') return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [filteredData]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Helper for generating passwords
  const generateRandomPassword = (isPin = false) => {
    if (isPin) {
      const digits = '0123456789';
      let pin = '';
      for (let i = 0; i < 6; i++) {
        pin += digits.charAt(Math.floor(Math.random() * digits.length));
      }
      return pin;
    }
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    const all = uppercase + lowercase + numbers + symbols;
    
    let pass = '';
    pass += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pass += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    for (let i = 0; i < 8; i++) {
      pass += all.charAt(Math.floor(Math.random() * all.length));
    }
    return pass;
  };

  const handleChange = (field, value) => {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    setWizardData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'user_type') {
        updated.primary_access_type = value === 'Vendedora' ? 'DOCUMENT' : 'EMAIL';
        if (value === 'Vendedora' && !updated.department_id) {
          const deptsList = departments;
          const companyDepts = deptsList.filter(d => d.company_id === updated.companyId && d.status === 'Activo');
          const comercialDept = companyDepts.find(d => d.name.toLowerCase() === 'comercial') || 
                                companyDepts.find(d => d.name.toLowerCase() === 'operaciones') ||
                                companyDepts[0];
          if (comercialDept) {
            updated.department_id = comercialDept.id;
            updated.department = comercialDept.name;
          }
        }
      }
      return updated;
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setIsSaving(false);
    setWizardData(null);
    setCurrentStep(1);
    setFormError('');
    setShowPermissionsMatrix(false);
  };

  const handleExport = () => {
    const exportList = selectedIds.length > 0
      ? data.filter(u => selectedIds.includes(u.id))
      : sortedData;

    if (exportList.length === 0) {
      showToast('No hay usuarios para exportar.', 'error');
      return;
    }

    const headers = [
      'ID',
      'Nombre Completo',
      'Correo Electrónico',
      'Teléfono',
      'Documento',
      'Empresa',
      'Rol',
      'Tipo de Usuario',
      'Estado',
      'Estado de Activación',
      'MFA',
      'Último Acceso',
      'Fecha Creación'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const value = String(str).replace(/"/g, '""');
      return `"${value}"`;
    };

    const rows = exportList.map(u => {
      const comp = companies.find(c => c.id == u.companyId);
      return [
        u.id || u.usuario_id || '',
        u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        u.email || '',
        u.phone || '',
        u.document_number || '',
        comp ? comp.name : (u.companyId || ''),
        u.role || '',
        u.user_type || '',
        u.status || u.estado || '',
        u.estado_activacion || u.activation?.activation_status || '',
        u.mfaEnabled ? 'Sí' : 'No',
        u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Sin acceso',
        u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString() : ''
      ];
    });

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `usuarios_bikers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exportados ${exportList.length} usuario(s) a Excel (CSV).`);
  };

  const toggleSelection = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === sortedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedData.map(item => item.id));
    }
  };

  const handleMassToggleStatus = () => {
    if (selectedIds.length === 0) return;
    const timestamp = new Date().toISOString();
    const updated = data.map(u => {
      if (selectedIds.includes(u.id)) {
        const newStatus = u.status === 'Activo' ? 'Inactivo' : 'Activo';
        addAuditLog(u.id, 'Cambio de Estado Masivo', 'users', `Estado: ${u.status}`, `Estado: ${newStatus}`, 'Rotación de estado masiva');
        addActivityLog(u.id, 'Estado Modificado (Masivo)', `Estado cambiado a ${newStatus} por lote.`);
        return { ...u, status: newStatus, updatedAt: timestamp };
      }
      return u;
    });
    // Call API
    usersService.massRotateStatus(selectedIds).then(() => {
      fetchUsers();
      showToast(`Estado rotado para ${selectedIds.length} usuarios.`);
      setSelectedIds([]);
    }).catch(err => {
      showToast('Error: ' + err.message, 'error');
    });
  };

  // WIZARD CONTROL Flow
  const handleAddNew = () => {
    setFormError('');
    setIsCreating(true);
    setIsEditing(false);
    setCurrentStep(1);

    const generatedPass = generateRandomPassword();
    setWizardData({
      id: `USR-${Date.now().toString().slice(-6)}`,
      first_name: '',
      last_name: '',
      full_name: '',
      document_type: 'Cédula',
      document_number: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
      avatar_url: null,
      status: 'Invitado',

      // Access Info
      access_email: '',
      primary_access_type: 'EMAIL',
      password: generatedPass,
      confirm_password: generatedPass,
      auto_generate_password: true,
      send_invitation: true,
      must_change_password: true,
      web_access_enabled: true,
      mobile_access_enabled: false,
      preferred_language: 'es',
      timezone: 'America/Santo_Domingo',
      date_format: 'DD/MM/YYYY',

      // Company Assignment
      companyId: companies[0]?.id || 'COMP-1',
      user_type: '',
      role: 'Operador',
      roles_additional: [],
      permissionsOverride: {}, // Custom overrides

      // Scope
      scope_type: 'COMPANY',
      scope_entity_ids: [],
      include_children: true,
      can_view: true,
      can_edit: true,
      can_export: false,
      can_assign: false,

      // Security Settings
      mfaEnabled: true,
      mfa_method: 'App autenticadora',
      access_expires_at: '',
      allowed_hours: 'Cualquier horario',
      allowed_ips: '*',
      inactivity_timeout_minutes: 0,
      max_failed_attempts: 10,
      require_export_approval: false,
      require_dual_validation: false
    });
  };

  const handleEdit = (user) => {
    setFormError('');
    setIsCreating(false);
    setIsEditing(true);
    setCurrentStep(1);

    // Deep copy permissions or create empty override structure
    setWizardData({
      ...user,
      primary_access_type: user.login_identifiers?.find(id => id.is_primary)?.identifier_type || 'EMAIL',
      password: '',
      confirm_password: '',
      auto_generate_password: false,
      permissionsOverride: user.permissionsOverride || {}
    });
  };

  const handleStartEdit360 = async (user, tab = 'resumen') => {
    setEdit360Error('');
    
    // Set search params so detail opens
    const sp = new URLSearchParams(searchParams);
    sp.set('userId', user.id);
    setSearchParams(sp);

    const mapWizardData = (sourceUser) => {
      let fName = sourceUser.first_name || '';
      let lName = sourceUser.last_name || '';
      if ((!fName || !lName) && sourceUser.full_name) {
        const parts = sourceUser.full_name.trim().split(' ');
        if (!fName) fName = parts[0] || '';
        if (!lName) lName = parts.slice(1).join(' ') || '';
      }

      const matchedRoleObj = (roles || []).find(r => (r.name || r.nombre) === (sourceUser.role || sourceUser.role_name || sourceUser.rol));
      const rId = sourceUser.role_id || sourceUser.rol_principal_id || sourceUser.rol_id || matchedRoleObj?.id || (roles && roles[0] ? roles[0].id : 1);
      const rName = sourceUser.role_name || sourceUser.role || sourceUser.rol || matchedRoleObj?.name || matchedRoleObj?.nombre || 'Administrador General';

      const compId = sourceUser.companyId || sourceUser.empresa_id || (empresas && empresas.length > 0 ? empresas[0].id : 1);
      const userTypeId = sourceUser.tipo_usuario_id || (userTypes && userTypes.length > 0 ? userTypes[0].id : 1);

      return {
        ...sourceUser,
        first_name: fName,
        last_name: lName,
        full_name: `${fName} ${lName}`.trim() || sourceUser.full_name || 'Usuario',
        department_id: sourceUser.departamento_id || sourceUser.department_id || '',
        area_id: sourceUser.area_id || '',
        cargo_id: sourceUser.cargo_id || '',
        companyId: compId,
        role: rName,
        rol_id: rId,
        tipo_usuario_id: userTypeId,
        user_type: sourceUser.user_type || (userTypes || []).find(t => t.id == userTypeId)?.name || 'Interno',
        roles_additional: sourceUser.roles_additional || [],
        primary_access_type: sourceUser.login_identifiers?.find(id => id.is_primary)?.identifier_type || 'EMAIL',
        password: '',
        confirm_password: '',
        auto_generate_password: false,
        permissionsOverride: sourceUser.permissionsOverride || {}
      };
    };

    try {
      const res = await usersService.getUserById(user.id);
      const fullUser = { ...user, ...res };
      setDetailUser(fullUser);

      // Populate wizardData as editing draft
      setWizardData(mapWizardData(fullUser));
    } catch (err) {
      console.error('Error fetching full user for edit:', err);
      setDetailUser(user);
      setWizardData(mapWizardData(user));
    }
    
    // Enable editing mode ONLY AFTER data is ready
    setIsEditing360(true);
    setActiveTab360(tab);
    if (tab === 'permisos') setMatrixFilter('all');
  };

  const handleCancelEdit360 = () => {
    setIsEditing360(false);
    setWizardData(null);
    setEdit360Error('');
    setFormErrors360({});
  };

  const handleSaveEdit360 = () => {
    if (!wizardData) return;
    setEdit360Error('');

    let firstName = (wizardData.first_name || '').trim();
    let lastName = (wizardData.last_name || '').trim();
    if ((!firstName || !lastName) && wizardData.full_name) {
      const parts = wizardData.full_name.trim().split(' ');
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }
    if (!firstName) firstName = 'Usuario';

    const companyId = wizardData.companyId || wizardData.empresa_id || (empresas && empresas[0] ? empresas[0].id : 1);
    const roleName = wizardData.role || wizardData.role_name || 'Administrador General';
    const roleId = wizardData.rol_id || wizardData.role_id || (roles.find(r => (r.name || r.nombre) === roleName)?.id) || 1;

    // Map identifiers
    let updatedIdentifiers = [...(wizardData.login_identifiers || [])];
    const primIdx = updatedIdentifiers.findIndex(id => id.is_primary);
    const identifierType = wizardData.primary_access_type || 'EMAIL';
    const identifierValue = identifierType === 'EMAIL' ? (wizardData.email || wizardData.correo_acceso) : wizardData.document_number;

    if (primIdx !== -1) {
      updatedIdentifiers[primIdx] = {
        ...updatedIdentifiers[primIdx],
        identifier_type: identifierType,
        identifier_value: identifierValue
      };
    } else {
      updatedIdentifiers.push({
        identifier_type: identifierType,
        identifier_value: identifierValue,
        is_primary: true,
        is_verified: true
      });
    }

    const computedFullName = `${firstName} ${lastName}`.trim() || wizardData.full_name || 'Usuario';

    const finalUser = {
      ...wizardData,
      first_name: firstName,
      last_name: lastName,
      full_name: computedFullName,
      companyId: companyId,
      role: roleName,
      rol_id: roleId,
      login_identifiers: updatedIdentifiers
    };

    // Update backend
    usersService.updateUser(finalUser.id, finalUser).then(() => {
      setData(prev => prev.map(u => u.id === finalUser.id ? { ...u, ...finalUser } : u));
      setDetailUser(finalUser);
      if (activeTab360 === 'auditoria') {
        fetchUserAudits(finalUser.id);
      }
      addAuditLog(finalUser.id, 'Edición de Cuenta', 'user_account', 'Datos Anteriores', 'Datos Actualizados', 'Modificación de perfil mediante formulario inline.');
      addActivityLog(finalUser.id, 'Perfil Actualizado', 'Se guardaron cambios al perfil y parámetros de seguridad del usuario.');
      setIsEditing360(false);
      setWizardData(null);
      setEdit360Error('');
      setShowConfirmEditModal(false);
      setShowSuccessEditModal(true);
    }).catch(err => {
      setEdit360Error('Error al actualizar usuario: ' + err.message);
      setShowConfirmEditModal(false);
    });
  };

  const handleTriggerSaveEdit360 = () => {
    setEdit360Error('');
    setFormErrors360({});
    
    if (!wizardData) return;

    const newErrors = {};

    if (!wizardData.first_name || !wizardData.first_name.trim()) {
      newErrors.first_name = 'El nombre es obligatorio.';
    }
    if (!wizardData.last_name || !wizardData.last_name.trim()) {
      newErrors.last_name = 'El apellido es obligatorio.';
    }
    if (!wizardData.companyId) {
      newErrors.companyId = 'Debe seleccionar una empresa.';
    }
    if (!wizardData.role && !wizardData.rol_id) {
      newErrors.rol_id = 'Debe seleccionar un rol.';
    }

    const emailVal = validateEmail(wizardData.email, false);
    if (wizardData.email && !emailVal.isValid) {
      newErrors.email = emailVal.message;
    }

    if (wizardData.phone) {
      const phoneVal = validatePhoneDR(wizardData.phone, false);
      if (!phoneVal.isValid) {
        newErrors.phone = phoneVal.message;
      }
    }

    if (wizardData.primary_access_type === 'EMAIL') {
      if (!wizardData.email || !emailVal.isValid) {
        newErrors.email = emailVal.message || 'Debe ingresar un correo electrónico válido.';
      } else {
        const emailTaken = data.find(u => u.id !== wizardData.id && u.login_identifiers?.some(id => id.identifier_type === 'EMAIL' && id.identifier_value === wizardData.email));
        if (emailTaken) {
          newErrors.email = 'El correo electrónico ya se encuentra en uso.';
        }
      }
    } else if (wizardData.primary_access_type === 'DOCUMENT') {
      if (!wizardData.document_number || !wizardData.document_number.trim()) {
        newErrors.document_number = 'Debe ingresar un número de documento válido.';
      } else {
        const docVal = validateRNC(wizardData.document_number, false);
        if (!docVal.isValid) {
          newErrors.document_number = docVal.message;
        } else {
          const docTaken = data.find(u => u.id !== wizardData.id && u.login_identifiers?.some(id => id.identifier_type === 'DOCUMENT' && id.identifier_value === wizardData.document_number));
          if (docTaken) {
            newErrors.document_number = 'El número de documento ya está registrado.';
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors360(newErrors);
      setEdit360Error('Por favor corrija los errores marcados en el formulario.');
      return;
    }

    // Pass validations, open confirm modal
    setShowConfirmEditModal(true);
  };


  const handleNextStep = () => {
    setFormError('');
    setFieldErrors({});

    if (currentStep === 1) {
      const errors = {};
      
      if (!wizardData.first_name || !wizardData.first_name.trim()) {
        errors.first_name = 'El nombre es requerido.';
      }
      if (!wizardData.last_name || !wizardData.last_name.trim()) {
        errors.last_name = 'El apellido es requerido.';
      }
      if (!wizardData.companyId) {
        errors.companyId = 'La empresa es requerida.';
      }
      if (!wizardData.department_id) {
        errors.department_id = 'El departamento es requerido.';
      }
      
      const emailVal = validateEmail(wizardData.email, true);
      if (!emailVal.isValid) {
        errors.email = emailVal.message;
      } else {
        const isEmailTaken = data.some(u => u.id !== wizardData.id && u.email && u.email.trim().toLowerCase() === wizardData.email.trim().toLowerCase());
        if (isEmailTaken) {
          errors.email = 'El correo electrónico ya está registrado.';
        }
      }

      if (wizardData.phone && wizardData.phone.trim()) {
        const phoneVal = validatePhoneDR(wizardData.phone, false);
        if (!phoneVal.isValid) {
          errors.phone = phoneVal.message;
        }
      }
      
      if (wizardData.document_number && wizardData.document_number.trim()) {
        const docVal = validateRNC(wizardData.document_number, false);
        if (!docVal.isValid) {
          errors.document_number = docVal.message;
        } else {
          const isDocTaken = data.some(u => u.id !== wizardData.id && u.document_number && u.document_number.trim() === wizardData.document_number.trim());
          if (isDocTaken) {
            errors.document_number = 'El número de documento ya está registrado.';
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      
      const fullName = `${(wizardData.first_name || '').trim()} ${(wizardData.last_name || '').trim()}`;
      setWizardData(prev => ({
        ...prev,
        full_name: fullName
      }));
    }

    if (currentStep === 2) {
      const errors = {};
      
      if (!wizardData.companyId) {
        errors.companyId = 'La empresa es requerida.';
      }
      if (!wizardData.tipo_usuario_id) {
        errors.tipo_usuario_id = 'El tipo de usuario es requerido.';
      }
      if (!wizardData.rol_id) {
        errors.rol_id = 'El rol principal es requerido.';
      }
      if (!wizardData.primary_access_type) {
        errors.primary_access_type = 'El método de acceso principal es requerido.';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    if (currentStep === 3) {
      if (wizardData.primary_access_type === 'EMAIL') {
        if (!wizardData.email || !wizardData.email.trim()) {
          setFormError('El correo electrónico es requerido.');
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(wizardData.email.trim())) {
          setFormError('Introduce un formato de correo electrónico válido.');
          return;
        }
        const isEmailTaken = data.some(u => u.id !== wizardData.id && u.email && u.email.trim().toLowerCase() === wizardData.email.trim().toLowerCase());
        if (isEmailTaken) {
          setFormError('El correo electrónico ya está registrado para otra cuenta.');
          return;
        }
      } else if (wizardData.primary_access_type === 'DOCUMENT') {
        if (!wizardData.document_type || !wizardData.document_type.trim()) {
          setFormError('El tipo de documento es requerido.');
          return;
        }
        if (!wizardData.document_number || !wizardData.document_number.trim()) {
          setFormError('El número de documento es requerido.');
          return;
        }
        const isDocTaken = data.some(u => u.id !== wizardData.id && u.document_number && u.document_number.trim() === wizardData.document_number.trim());
        if (isDocTaken) {
          setFormError('El número de documento ya está registrado para otra cuenta.');
          return;
        }
        if (!wizardData.phone || !wizardData.phone.trim()) {
          setFormError('El teléfono de contacto es requerido.');
          return;
        }
      }

      if (!wizardData.auto_generate_password && isCreating) {
        const minLength = wizardData.primary_access_type === 'DOCUMENT' ? 4 : 6;
        if (!wizardData.password || wizardData.password.length < minLength) {
          setFormError(`La contraseña/PIN temporal debe tener al menos ${minLength} caracteres.`);
          return;
        }
        if (wizardData.password !== wizardData.confirm_password) {
          setFormError('Las contraseñas no coinciden.');
          return;
        }
      }
    }

    if (currentStep === 4) {
      const errors = {};
      if (wizardData.scope_type === 'GROUPING') {
        if (!wizardData.scope_entity_ids || wizardData.scope_entity_ids.length === 0) {
          errors.scope_entity_ids = 'Debes seleccionar al menos una agrupación comercial para este alcance.';
        }
      } else if (wizardData.scope_type === 'AGENCY') {
        if (!wizardData.scope_entity_ids || wizardData.scope_entity_ids.length === 0) {
          errors.scope_entity_ids = 'Debes seleccionar al menos una agencia para este alcance.';
        }
      } else if (wizardData.scope_type === 'TERRITORY') {
        if (!wizardData.scope_entity_ids || wizardData.scope_entity_ids.length === 0) {
          errors.scope_entity_ids = 'Debes configurar al menos un territorio para este alcance.';
        }
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setFormError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveUser = (sendInvite = false) => {
    const timestamp = new Date().toISOString();
    const cleanUser = { ...wizardData };
    
    // Auto-compute full_name
    cleanUser.full_name = `${cleanUser.first_name.trim()} ${cleanUser.last_name.trim()}`;
    cleanUser.email = cleanUser.email.trim();
    cleanUser.access_email = cleanUser.email;

    // Set access channels
    if (cleanUser.user_type === 'Vendedora') {
      cleanUser.web_access_enabled = false;
      cleanUser.mobile_access_enabled = true;
    } else {
      cleanUser.web_access_enabled = true;
      cleanUser.mobile_access_enabled = false;
    }

    // Build login identifiers
    const loginIdentifiers = [];
    if (cleanUser.email && cleanUser.email.trim()) {
      const existingEmailId = cleanUser.login_identifiers?.find(id => id.identifier_type === 'EMAIL');
      loginIdentifiers.push({
        id: existingEmailId?.id || `LID-${cleanUser.id.replace('USR-', '')}-1`,
        user_id: cleanUser.id,
        identifier_type: 'EMAIL',
        identifier_value: cleanUser.email.trim(),
        is_primary: cleanUser.primary_access_type === 'EMAIL',
        is_verified: existingEmailId ? existingEmailId.is_verified : true,
        status: existingEmailId ? existingEmailId.status : 'Active',
        created_at: existingEmailId ? existingEmailId.created_at : timestamp,
        updated_at: timestamp
      });
    }

    if (cleanUser.document_number && cleanUser.document_number.trim()) {
      const existingDocId = cleanUser.login_identifiers?.find(id => id.identifier_type === 'DOCUMENT');
      loginIdentifiers.push({
        id: existingDocId?.id || `LID-${cleanUser.id.replace('USR-', '')}-2`,
        user_id: cleanUser.id,
        identifier_type: 'DOCUMENT',
        identifier_value: cleanUser.document_number.trim(),
        is_primary: cleanUser.primary_access_type === 'DOCUMENT',
        is_verified: existingDocId ? existingDocId.is_verified : true,
        status: existingDocId ? existingDocId.status : 'Active',
        created_at: existingDocId ? existingDocId.created_at : timestamp,
        updated_at: timestamp
      });
    }

    cleanUser.login_identifiers = loginIdentifiers;

    // Store password for local display but do not delete it from payload
    const savedPassword = cleanUser.password;
    delete cleanUser.confirm_password;
    delete cleanUser.username;
    delete cleanUser.primary_access_type;

    if (isCreating) {
      cleanUser.status = sendInvite ? 'Pendiente de activación' : 'Invitado';
      cleanUser.createdAt = timestamp;
      cleanUser.createdBy = 'Admin';
      cleanUser.updatedAt = timestamp;
      cleanUser.updatedBy = 'Admin';
      cleanUser.last_login_at = null;

      const primaryAccess = wizardData.primary_access_type || (loginIdentifiers.find(id => id.is_primary)?.identifier_type) || 'EMAIL';
      const activationObj = {
        id: `ACT-S-${Date.now()}`,
        access_method: primaryAccess,
        activation_status: primaryAccess === 'EMAIL' 
          ? (sendInvite ? 'INVITATION_SENT' : 'INVITATION_PENDING')
          : (savedPassword ? 'PENDING_FIRST_LOGIN' : 'CREDENTIALS_GENERATED'),
        invitation_sent_at: primaryAccess === 'EMAIL' && sendInvite ? timestamp : null,
        invitation_opened_at: null,
        registration_completed_at: null,
        first_login_at: null,
        invitation_expires_at: primaryAccess === 'EMAIL' && sendInvite ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null,
        invitation_bounced_at: null,
        resend_count: primaryAccess === 'EMAIL' && sendInvite ? 1 : 0,
        last_resend_at: primaryAccess === 'EMAIL' && sendInvite ? timestamp : null,
        temporary_credentials_generated_at: primaryAccess === 'DOCUMENT' ? timestamp : null,
        temporary_credentials_delivered_at: primaryAccess === 'DOCUMENT' && savedPassword ? timestamp : null,
        initial_password_changed_at: null,
        channel: primaryAccess === 'EMAIL' ? 'EMAIL' : 'PHYSICAL_SHEET',
        status_detail: primaryAccess === 'EMAIL'
          ? (sendInvite ? 'Invitación enviada por correo electrónico' : 'Usuario creado en borrador')
          : (savedPassword ? 'Credenciales entregadas físicamente' : 'Credenciales temporales generadas'),
        created_at: timestamp,
        updated_at: timestamp
      };
      
      cleanUser.activation = activationObj;

      setIsSaving(true);
      // Backend Integration: Create
      usersService.createUser(cleanUser).then(res => {
        setIsSaving(false);
        fetchUsers();
        addAuditLog(res.usuario_id || cleanUser.id, 'Creación de Usuario', 'users', '—', `Cuenta creada con rol ${cleanUser.role}.`, `Creación de cuenta en IAM`);
        addActivityLog(res.usuario_id || cleanUser.id, 'Cuenta Creada', `Usuario creado por administrador.`);
        if (!sendInvite && savedPassword) {
          setTempPassword(savedPassword);
          setShowPassModal(true);
        }
        setSuccessWizardMessage('El usuario ha sido creado correctamente en la base de datos.');
        setShowSuccessWizardModal(true);
        showToast('Usuario creado con éxito.');
      }).catch(err => {
        setIsSaving(false);
        setFormError('Error creando usuario: ' + err.message);
      });
    } else {
      cleanUser.updatedAt = timestamp;
      cleanUser.updatedBy = 'Admin';

      setIsSaving(true);
      usersService.updateUser(cleanUser.id, cleanUser).then(() => {
        setIsSaving(false);
        fetchUsers();
        if (activeTab360 === 'auditoria') {
          fetchUserAudits(cleanUser.id);
        }
        const originalUser = data.find(u => u.id === cleanUser.id) || {};
        
        let changeDesc = [];
        if (originalUser.role !== cleanUser.role) changeDesc.push(`Rol: ${originalUser.role} -> ${cleanUser.role}`);
        if (originalUser.scope_type !== cleanUser.scope_type) changeDesc.push(`Alcance: ${originalUser.scope_type} -> ${cleanUser.scope_type}`);
        if (originalUser.status !== cleanUser.status) changeDesc.push(`Estado: ${originalUser.status} -> ${cleanUser.status}`);
        
        const desc = changeDesc.length > 0 ? 'Modificaciones: ' + changeDesc.join(', ') : 'Perfil editado';

        addAuditLog(cleanUser.id, 'Modificación de Usuario', 'users', JSON.stringify(originalUser), JSON.stringify(cleanUser), 'Actualización de perfil');
        addActivityLog(cleanUser.id, 'Cuenta Actualizada', desc);

        setSuccessWizardMessage('Los cambios en el perfil del usuario han sido guardados correctamente en la base de datos.');
        setShowSuccessWizardModal(true);
        showToast('Usuario actualizado con éxito.');
      }).catch(err => {
        setIsSaving(false);
        setFormError('Error actualizando usuario: ' + err.message);
      });
    }

    // State is reset inside the .then() or .catch() blocks
    setShowPermissionsMatrix(false);
  };

  // REASON MODAL & ACTION PROCESSING
  const handleOpenReasonModal = (type, userId, payload = {}) => {
    setReasonAction({ type, userId, payload });
    setReasonText('');
    setReasonError('');
    setShowReasonModal(true);
  };

  const handleReasonSubmit = async (e) => {
    e.preventDefault();
    if (!reasonText.trim()) {
      setReasonError('Debes proveer un motivo administrativo para documentar este cambio.');
      return;
    }

    const { type, userId, payload } = reasonAction;
    const user = data.find(u => u.id === userId);
    if (!user) return;

    try {
      const timestamp = new Date().toISOString();
      let updatedUsers = [...data];

      if (type === 'status') {
        const beforeStatus = user.estado || user.status;
        const afterStatus = payload.status;
        const afterEstado = payload.estado || payload.status;
        
        await usersService.updateUser(userId, { estado: afterEstado, motivo_bloqueo: reasonText });

        updatedUsers = data.map(u => u.id === userId ? { ...u, status: afterStatus, estado: afterEstado, updatedAt: timestamp } : u);
        syncData(updatedUsers);

        addAuditLog(userId, 'Cambio de Estado', 'users', `Estado: ${beforeStatus}`, `Estado: ${afterEstado}`, reasonText);
        addActivityLog(userId, 'Estado Modificado', `Estado cambiado de ${beforeStatus} a ${afterEstado}. Motivo: ${reasonText}`);
        showToast(`Estado de usuario cambiado a ${afterEstado}.`);
      } 
    
    else if (type === 'role') {
      const beforeRole = user.role;
      const afterRole = payload.role;

      await usersService.updateUser(userId, { role: afterRole });

      updatedUsers = data.map(u => u.id === userId ? { ...u, role: afterRole, updatedAt: timestamp } : u);
      syncData(updatedUsers);

      addAuditLog(userId, 'Cambio de Rol', 'users', `Rol: ${beforeRole}`, `Rol: ${afterRole}`, reasonText);
      addActivityLog(userId, 'Rol Modificado', `Rol cambiado de ${beforeRole} a ${afterRole}. Motivo: ${reasonText}`);
      showToast(`Rol principal cambiado a ${afterRole}.`);
    }

    else if (type === 'scope') {
      const beforeScope = user.scope_type;
      const afterScope = payload.scope_type;

      await usersService.updateUser(userId, { 
        scope_type: afterScope, 
        scope_entity_ids: payload.scope_entity_ids 
      });

      updatedUsers = data.map(u => u.id === userId ? { 
        ...u, 
        scope_type: afterScope, 
        scope_entity_ids: payload.scope_entity_ids,
        updatedAt: timestamp 
      } : u);
      syncData(updatedUsers);

      addAuditLog(userId, 'Cambio de Alcance', 'user_operational_scope', `Alcance: ${beforeScope}`, `Alcance: ${afterScope}`, reasonText);
      addActivityLog(userId, 'Alcance Modificado', `Alcance modificado de ${beforeScope} a ${afterScope}. Motivo: ${reasonText}`);
      showToast(`Alcance operativo actualizado con éxito.`);
    }

      setShowReasonModal(false);
      setReasonAction(null);
      if (activeTab360 === 'auditoria' && detailUser?.id === userId) {
        fetchUserAudits(userId);
      }
    } catch (err) {
      console.error(err);
      setReasonError('Hubo un error al guardar el cambio en el servidor.');
    }
  };

  const handleResetPasswordDirect = (user) => {
    const isDocAccess = user.login_identifiers?.find(id => id.is_primary)?.identifier_type === 'DOCUMENT';
    const labelType = isDocAccess ? 'PIN' : 'contraseña';
    const confirmReset = window.confirm(`¿Está seguro de que desea restablecer el/la ${labelType} del usuario ${user.full_name || (user.first_name + ' ' + user.last_name)}?`);
    if (!confirmReset) return;

    const tempPass = generateRandomPassword(isDocAccess);
    setTempPassword(tempPass);
    setShowPassModal(true);
    
    addAuditLog(user.id, 'Restablecer Contraseña', 'user_access', 'must_change_password: false', 'must_change_password: true', 'Restablecimiento forzado de contraseña por administrador');
    addActivityLog(user.id, 'Contraseña Restablecida', 'Administrador forzó la renovación de credenciales.');
    showToast(isDocAccess ? 'PIN temporal restablecido.' : 'Contraseña temporal restablecida.');
  };

  const handleCopyActivationLink = (user) => {
    const link = `https://suivi.com/activate?token=INV-${user.id}-${Date.now()}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showToast('Enlace de activación copiado al portapapeles.');
      addActivityLog(user.id, 'Enlace Copiado', 'Se copió el enlace de activación manualmente.');
    } else {
      showToast('Error al copiar al portapapeles.', 'error');
    }
  };

  const handleSendInvitationDirect = (user) => {
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          status: 'Pendiente de activación',
          activation: {
            ...u.activation,
            activation_status: 'INVITATION_SENT',
            invitation_sent_at: new Date().toISOString(),
            invitation_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            resend_count: (u.activation?.resend_count || 0) + 1,
            last_resend_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Envío de Invitación', 'users', 'activation_status: INVITATION_PENDING', 'activation_status: INVITATION_SENT', 'Invitación enviada por el administrador.');
    addActivityLog(user.id, 'Invitación Enviada', 'Correo electrónico de invitación despachado.');
    showToast('Invitación enviada con éxito.');
  };

  const handleResendInvitationDirect = (user) => {
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          activation: {
            ...u.activation,
            activation_status: 'INVITATION_SENT',
            invitation_sent_at: new Date().toISOString(),
            invitation_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            resend_count: (u.activation?.resend_count || 0) + 1,
            last_resend_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addActivityLog(user.id, 'Invitación Reenviada', 'Correo electrónico de invitación reenviado.');
    showToast('Invitación reenviada con éxito.');
  };

  const handleRevokeInvitationDirect = (user) => {
    const confirmRevoke = window.confirm(`¿Está seguro de revocar la invitación y el acceso para ${user.full_name}?`);
    if (!confirmRevoke) return;
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          status: 'Inactivo',
          activation: {
            ...u.activation,
            activation_status: 'DRAFT',
            invitation_sent_at: null,
            invitation_opened_at: null,
            registration_completed_at: null,
            invitation_expires_at: null,
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Revocación de Invitación', 'users', 'Invitación Activa', 'Borrador / Inactivo', 'Invitación revocada por administrador.');
    addActivityLog(user.id, 'Invitación Revocada', 'Invitación anulada y cuenta convertida a borrador.');
    showToast('Invitación revocada. El usuario ha sido inhabilitado.');
  };

  const handleRegenerateInvitationDirect = (user) => {
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          status: 'Pendiente de activación',
          activation: {
            ...u.activation,
            activation_status: 'INVITATION_SENT',
            invitation_sent_at: new Date().toISOString(),
            invitation_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            resend_count: 0,
            last_resend_at: null,
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Regeneración de Invitación', 'users', 'activation_status: INVITATION_EXPIRED', 'activation_status: INVITATION_SENT', 'Invitación regenerada tras expirar.');
    addActivityLog(user.id, 'Invitación Regenerada', 'Enlace de invitación renovado con expiración extendida.');
    showToast('Invitación regenerada y enviada.');
  };

  const handleSendReminderDirect = (user) => {
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          activation: {
            ...u.activation,
            resend_count: (u.activation?.resend_count || 0) + 1,
            last_resend_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addActivityLog(user.id, 'Recordatorio Enviado', 'Recordatorio de inicio de sesión enviado.');
    showToast('Recordatorio de onboarding enviado.');
  };

  const handleRegeneratePinDirect = (user) => {
    const confirmRegen = window.confirm(`¿Está seguro de regenerar el PIN para ${user.full_name}?`);
    if (!confirmRegen) return;
    const isPin = user.activation?.access_method === 'DOCUMENT' || user.user_type === 'Vendedora';
    const newCred = generateRandomPassword(isPin);
    
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          must_change_password: true,
          activation: {
            ...u.activation,
            activation_status: 'CREDENTIALS_GENERATED',
            temporary_credentials_generated_at: new Date().toISOString(),
            temporary_credentials_delivered_at: null,
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Regeneración de Credencial Temporal', 'users', 'PIN previo', 'Nuevo PIN generado', 'PIN temporal restablecido por administrador.');
    addActivityLog(user.id, 'PIN Temporal Regenerado', 'PIN de 6 dígitos generado para acceso por documento.');
    
    setTempPassword(newCred);
    setShowPassModal(true);
  };

  const handleMarkInstructionsDelivered = (user) => {
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          activation: {
            ...u.activation,
            activation_status: 'PENDING_FIRST_LOGIN',
            temporary_credentials_delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addActivityLog(user.id, 'Instrucciones Entregadas', 'Se marcaron las credenciales temporales como entregadas físicamente.');
    showToast('Instrucciones marcadas como entregadas.');
  };

  const handleToggleBlock = (user) => {
    const estadoActual = user.estado || user.status;
    if (estadoActual === 'BLOQUEADO' || estadoActual === 'Bloqueado') {
      handleOpenReasonModal('status', user.id, { status: 'ACTIVO', estado: 'ACTIVO' });
    } else {
      handleOpenReasonModal('status', user.id, { status: 'BLOQUEADO', estado: 'BLOQUEADO' });
    }
  };

  const handleToggleInactive = (user) => {
    const estadoActual = user.estado || user.status;
    if (estadoActual === 'INACTIVO' || estadoActual === 'Inactivo') {
      handleOpenReasonModal('status', user.id, { status: 'ACTIVO', estado: 'ACTIVO' });
    } else {
      handleOpenReasonModal('status', user.id, { status: 'INACTIVO', estado: 'INACTIVO' });
    }
  };

  const [showRevokeConfirmModal, setShowRevokeConfirmModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState(null);

  const [showRevokeAllConfirmModal, setShowRevokeAllConfirmModal] = useState(false);
  const [userToRevokeAll, setUserToRevokeAll] = useState(null);

  const handleRevokeAllSessions = (userId) => {
    setUserToRevokeAll(userId);
    setShowRevokeAllConfirmModal(true);
  };

  const handleExecuteRevokeAll = async () => {
    if (!userToRevokeAll) return;
    try {
      setShowRevokeAllConfirmModal(false);
      await usersService.revokeAllUserSessions(userToRevokeAll);
      fetchUserSessions(userToRevokeAll);
      addAuditLog(userToRevokeAll, 'Revocación de Sesiones', 'user_sessions', 'Sesiones Activas', 'Sesiones Expiradas', 'Revocación forzada por administrador.');
      addActivityLog(userToRevokeAll, 'Sesiones Revocadas', 'Sesiones web/móvil terminadas forzosamente.');
      showToast('Sesiones revocadas con éxito.');
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      showToast('Error al revocar sesiones.', 'error');
    }
  };

  const handleRevokeSingleSession = (session) => {
    setSessionToRevoke(session);
    setShowRevokeConfirmModal(true);
  };

  const handleExecuteRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    try {
      setShowRevokeConfirmModal(false);
      const targetUserId = sessionToRevoke.usuario_id || sessionToRevoke.user_id || detailUser?.id;
      const targetSessionId = sessionToRevoke.sesion_id || sessionToRevoke.id;
      await usersService.revokeUserSession(targetUserId, targetSessionId);
      if (targetUserId) fetchUserSessions(targetUserId);
      showToast('Sesión revocada correctamente.');
    } catch (error) {
      console.error('Error revoking session:', error);
      showToast('Error al revocar sesión.', 'error');
    }
  };

  const [realUserActivity, setRealUserActivity] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [sortConfigActividad, setSortConfigActividad] = useState({ key: 'timestamp', direction: 'desc' });

  const handleSortActividad = (key) => {
    let direction = 'asc';
    if (sortConfigActividad.key === key && sortConfigActividad.direction === 'asc') direction = 'desc';
    setSortConfigActividad({ key, direction });
  };

  const fetchUserActivity = async (userId) => {
    setIsLoadingActivity(true);
    try {
      if (typeof usersService?.getUserActivity === 'function') {
        const data = await usersService.getUserActivity(userId);
        setRealUserActivity(data || []);
      } else {
        setRealUserActivity([]);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (activeTab360 === 'actividad' && detailUser?.id) {
      fetchUserActivity(detailUser.id);
    }
  }, [activeTab360, detailUser?.id]);

  const [realUserAudits, setRealUserAudits] = useState([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);
  const [sortConfigAuditoria, setSortConfigAuditoria] = useState({ key: 'performed_at', direction: 'desc' });

  const handleSortAuditoria = (key) => {
    let direction = 'asc';
    if (sortConfigAuditoria.key === key && sortConfigAuditoria.direction === 'asc') direction = 'desc';
    setSortConfigAuditoria({ key, direction });
  };

  const fetchUserAudits = async (userId) => {
    setIsLoadingAudits(true);
    try {
      if (typeof usersService?.getUserAuditoria === 'function') {
        const data = await usersService.getUserAuditoria(userId);
        setRealUserAudits(data || []);
      } else {
        setRealUserAudits([]);
      }
    } catch (error) {
      console.error('Error fetching audits:', error);
    } finally {
      setIsLoadingAudits(false);
    }
  };

  useEffect(() => {
    if (activeTab360 === 'auditoria' && detailUser?.id) {
      fetchUserAudits(detailUser.id);
    }
  }, [activeTab360, detailUser?.id]);

  // Filters Clear
  const handleClearFilters = () => {
    setRoleFilter('Todos');
    setCompanyFilter('Todas');
    setStatusFilter('Todos');
    setMfaFilter('Todos');
    setTypeFilter('Todos');
    setLastAccessFilter('Todos');
    setDeptFilter('Todos');
    setAreaFilter('Todos');
    setActivationFilter('Todos');
    setAccessMethodFilter('Todos');
    setInvitationFilter('Todos');
    setFirstLoginFilter('Todos');
    setSearchParams({});
  };

  const activeFiltersCount = 
    (roleFilter !== 'Todos' ? 1 : 0) + 
    (companyFilter !== 'Todas' ? 1 : 0) + 
    (statusFilter !== 'Todos' ? 1 : 0) +
    (mfaFilter !== 'Todos' ? 1 : 0) +
    (typeFilter !== 'Todos' ? 1 : 0) +
    (lastAccessFilter !== 'Todos' ? 1 : 0) +
    (deptFilter !== 'Todos' ? 1 : 0) +
    (areaFilter !== 'Todos' ? 1 : 0) +
    (activationFilter !== 'Todos' ? 1 : 0) +
    (accessMethodFilter !== 'Todos' ? 1 : 0) +
    (invitationFilter !== 'Todos' ? 1 : 0) +
    (firstLoginFilter !== 'Todos' ? 1 : 0);

  // Auto-calculated variables for steps

  // Territories Mock DB
  const DOMINICAN_REGIONS = ['Metropolitana', 'Norte (Cibao)', 'Sur', 'Este'];
  const DOMINICAN_PROVINCES = ['Santo Domingo', 'Distrito Nacional', 'Santiago', 'La Altagracia', 'San Cristóbal'];
  const DOMINICAN_MUNICIPIOS = ['Santo Domingo Este', 'Santo Domingo Oeste', 'Santiago de los Caballeros', 'Higüey', 'San Cristóbal', 'Distrito Nacional'];
  const DOMINICAN_DISTRITOS_MUNICIPALES = ['Hato Nuevo', 'San Luis', 'La Caleta', 'Pantoja', 'Hato Damas', 'Palmarejo-Villa Linda'];
  const DOMINICAN_SECTORES = ['Piantini', 'Naco', 'Bella Vista', 'Gazcue', 'Los Mina', 'Gurabo', 'Pueblo Nuevo'];

  const renderDropdownItems = (item) => {
    const accessMethod = item.activation?.access_method || 'EMAIL';
    const actStatus = item.activation?.activation_status || 'DRAFT';
    const estadoActual = item.estado || item.status;
    const isBlocked = estadoActual === 'BLOQUEADO' || estadoActual === 'Bloqueado';
    const isInactive = estadoActual === 'INACTIVO' || estadoActual === 'Inactivo';

    const items = [];

    // Most accounts can edit profile
    items.push(
      <button 
        key="edit-profile"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
        onClick={() => handleStartEdit360(item, 'resumen')}
      >
        <Edit2 size={13} className="text-[var(--text-muted)]" /> Editar perfil
      </button>
    );

    // Conditional activation actions
    if (accessMethod === 'EMAIL') {
      if (actStatus === 'INVITATION_SENT' || actStatus === 'INVITATION_OPENED') {
        items.push(
          <button 
            key="resend-inv"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleResendInvitationDirect(item)}
          >
            <RotateCw size={13} className="text-[var(--text-muted)]" /> Reenviar invitación
          </button>,
          <button 
            key="copy-link"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleCopyActivationLink(item)}
          >
            <CheckSquare size={13} className="text-[var(--text-muted)]" /> Copiar link de activación
          </button>,
          <button 
            key="revoke-inv"
            className="w-full text-left px-4 py-1.5 text-[13px] text-primary font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRevokeInvitationDirect(item)}
          >
            <ShieldX size={13} /> Revocar invitación
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      } else if (actStatus === 'INVITATION_PENDING' || actStatus === 'DRAFT') {
        // No extra actions needed for draft in simplified dropdown
      } else if (actStatus === 'INVITATION_EXPIRED') {
        items.push(
          <button 
            key="regen-inv"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRegenerateInvitationDirect(item)}
          >
            <RotateCw size={13} className="text-[var(--text-muted)]" /> Regenerar invitación
          </button>,
          <button 
            key="resend-inv-exp"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleResendInvitationDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Reenviar invitación
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      } else if (actStatus === 'INVITATION_BOUNCED') {
        items.push(
          <button 
            key="regen-inv"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRegenerateInvitationDirect(item)}
          >
            <RotateCw size={13} className="text-[var(--text-muted)]" /> Regenerar invitación
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      } else if (actStatus === 'REGISTRATION_COMPLETED') {
        items.push(
          <button 
            key="send-reminder"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleSendReminderDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Enviar recordatorio
          </button>,
          <button 
            key="reset-pw"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleResetPasswordDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      } else if (actStatus === 'FIRST_LOGIN_COMPLETED') {
        items.push(
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>,
          <button 
            key="revoke-sessions"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRevokeAllSessions(item.id)}
          >
            <Laptop size={13} className="text-[var(--text-muted)]" /> Revocar sesiones
          </button>,
          <button 
            key="reset-pw"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleResetPasswordDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
          </button>,
          <button 
            key="view-audit"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 border-t border-[var(--border-color)] pt-1.5" 
            onClick={() => handleViewDetail(item, 'auditoria')}
          >
            <FileText size={13} className="text-[var(--text-muted)]" /> Ver auditoría
          </button>
        );
      }
    } else if (accessMethod === 'DOCUMENT') {
      if (actStatus === 'CREDENTIALS_GENERATED' || actStatus === 'PENDING_FIRST_LOGIN') {
        items.push(
          <button 
            key="regen-pin"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRegeneratePinDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Regenerar PIN temporal
          </button>,
          <button 
            key="mark-delivered"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleMarkInstructionsDelivered(item)}
          >
            <Check size={13} className="text-[var(--text-muted)]" /> Inst. entregadas
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      } else if (actStatus === 'INITIAL_PASSWORD_CHANGED') {
        items.push(
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>,
          <button 
            key="revoke-sessions"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRevokeAllSessions(item.id)}
          >
            <Laptop size={13} className="text-[var(--text-muted)]" /> Revocar sesiones
          </button>,
          <button 
            key="reset-pw"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleResetPasswordDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
          </button>,
          <button 
            key="view-audit"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 border-t border-[var(--border-color)] pt-1.5" 
            onClick={() => handleViewDetail(item, 'auditoria')}
          >
            <FileText size={13} className="text-[var(--text-muted)]" /> Ver auditoría
          </button>
        );
      } else if (actStatus === 'ACCESS_BLOCKED') {
        items.push(
          <button 
            key="unblock-act"
            className="w-full text-left px-4 py-1.5 text-[13px] text-emerald-600 font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleToggleBlock(item)}
          >
            <ShieldCheck size={13} /> Desbloquear acceso
          </button>,
          <button 
            key="regen-pin"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleRegeneratePinDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Regenerar PIN temporal
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'activacion')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver hist. activación
          </button>
        );
      }
    }

    // Actions based on estado
    items.push(
      <button 
        key="toggle-block"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 border-t border-[var(--border-color)] pt-1" 
        onClick={() => handleToggleBlock(item)}
      >
        <ShieldAlert size={13} className="text-[var(--text-muted)]" /> {isBlocked ? 'Desbloquear cuenta' : 'Bloquear cuenta'}
      </button>
    );
    
    items.push(
      <button 
        key="toggle-inactive"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
        onClick={() => handleToggleInactive(item)}
      >
        <ToggleLeft size={13} className="text-[var(--text-muted)]" /> {isInactive ? 'Activar cuenta' : 'Inactivar cuenta'}
      </button>
    );

    // Delete Action
    items.push(
      <button 
        key="delete-user"
        className="w-full text-left px-4 py-1.5 text-[13px] text-primary-fixed font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 border-t border-[var(--border-color)] pt-1.5 mt-1" 
        onClick={() => handleDeleteUserClick(item)}
      >
        <Trash2 size={13} className="text-primary" /> Eliminar cuenta
      </button>
    );

    return items;
  };

  const renderActivationBadge = (status, accessMethod = 'EMAIL', item) => {
    let finalStatus = status;
    const method = accessMethod || item?.activation?.access_method || 'EMAIL';

    // Map database Spanish values to internal English values
    if (status === 'Acceso confirmado') finalStatus = 'FIRST_LOGIN_COMPLETED';
    else if (status === 'Pendiente de registro') finalStatus = 'REGISTRATION_COMPLETED';
    else if (status === 'Invitación enviada') finalStatus = 'INVITATION_SENT';
    
    // If the user has a first login or last login date, it's ALWAYS "Acceso confirmado"
    if (item) {
      const hasLogin = !!item.activation?.first_login_at || !!item.last_login_at;
      if (hasLogin) {
        finalStatus = 'FIRST_LOGIN_COMPLETED';
      }
    }

    // If there is still no status, try to infer it from available dates
    if ((!finalStatus || finalStatus === 'DRAFT' || finalStatus === 'INVITATION_PENDING') && item) {
      const actObj = item.activation || {};
      const hasReg = !!actObj.registration_completed_at;
      const hasOpened = !!actObj.invitation_opened_at;
      const hasSent = !!actObj.invitation_sent_at;
      const hasCreds = !!actObj.temporary_credentials_generated_at;
      const hasDelivered = !!actObj.temporary_credentials_delivered_at;
      const hasPinChanged = !!actObj.initial_password_changed_at;
      const hasLogin = !!actObj.first_login_at || !!item.last_login_at;

      if (hasLogin) {
        finalStatus = 'FIRST_LOGIN_COMPLETED';
      } else if (method === 'EMAIL') {
        if (hasReg) {
          finalStatus = 'REGISTRATION_COMPLETED';
        } else if (hasOpened) {
          finalStatus = 'INVITATION_OPENED';
        } else if (hasSent) {
          const isExpired = actObj.invitation_expires_at && new Date(actObj.invitation_expires_at) < new Date();
          finalStatus = isExpired ? 'INVITATION_EXPIRED' : 'INVITATION_SENT';
        }
      } else { // DOCUMENT method
        if (hasPinChanged) {
          finalStatus = 'INITIAL_PASSWORD_CHANGED';
        } else if (hasDelivered) {
          finalStatus = 'PENDING_FIRST_LOGIN';
        } else if (hasCreds) {
          finalStatus = 'CREDENTIALS_GENERATED';
        }
      }
    }

    // Use "Estado no disponible" only when there is insufficient data to determine status
    if (!finalStatus) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Estado no disponible</span>;
    }

    const isEmail = method === 'EMAIL';
    
    if (isEmail) {
      switch (finalStatus) {
        case 'DRAFT':
        case 'INVITATION_PENDING':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Pendiente de envío</span>;
        case 'INVITATION_SENT':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-blue-250 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">Invitación enviada</span>;
        case 'INVITATION_OPENED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200 bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">Invitación abierta</span>;
        case 'REGISTRATION_COMPLETED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-cyan-200 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">Registro completado</span>;
        case 'FIRST_LOGIN_COMPLETED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-250 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" title="Primer login realizado">Acceso confirmado</span>;
        case 'INVITATION_EXPIRED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200 bg-rose-50 text-primary dark:bg-primary/10 dark:text-rose-455">Invitación expirada</span>;
        case 'INVITATION_BOUNCED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-300 bg-rose-100 text-primary-fixed dark:bg-rose-700/10 dark:text-primary">Invitación rebotada</span>;
        case 'REVOKED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-700/10 dark:text-slate-400">Revocada</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Estado no disponible</span>;
      }
    } else {
      switch (finalStatus) {
        case 'CREDENTIALS_GENERATED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">Credenciales generadas</span>;
        case 'PENDING_FIRST_LOGIN':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-amber-250 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Pendiente de primer ingreso</span>;
        case 'INITIAL_PASSWORD_CHANGED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-250 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">PIN / contraseña cambiado</span>;
        case 'FIRST_LOGIN_COMPLETED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-250 bg-emerald-55 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" title="Primer login realizado">Acceso confirmado</span>;
        case 'ACCESS_BLOCKED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-350 bg-rose-50 text-primary-fixed dark:bg-rose-900/10 dark:text-primary">Acceso bloqueado</span>;
        case 'REVOKED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-700/10 dark:text-slate-400">Revocada</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Estado no disponible</span>;
      }
    }
  };

  function renderUserDetail() {
    if (!detailUser) return null;
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] animate-in fade-in duration-200">
        
        {/* 360 Header Banner */}
        <div className="shrink-0 bg-[var(--bg-color)] p-6 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={handleGoBack}
              className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shadow-xs shrink-0"
              title="Volver al listado"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
              {detailUser.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-[var(--text-primary)]">{detailUser.full_name}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${
                  detailUser.status === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-primary/10'
                }`}>{detailUser.status}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 dark:bg-indigo-500/10">{detailUser.role}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1 flex items-center gap-2">
                <span>{detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_type === 'DOCUMENT' ? 'Documento' : 'Correo'}: {detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_value || detailUser.email}</span> • <span>MFA: {detailUser.mfaEnabled ? 'Activo' : 'Inactivo'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing360 ? (
              <>
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditing360(false);
                    setWizardData(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] text-[12px] font-bold transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => handleTriggerSaveEdit360()}
                  className="px-4 py-1.5 rounded-lg border border-[#bfce7f] bg-[#bfce7f] hover:bg-[#a8b868] text-[#2b3400] text-[12px] font-black shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Save size={14} /> Guardar
                </button>
              </>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  handleStartEdit360(detailUser, 'resumen');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-[#bfce7f]/40 hover:bg-[#bfce7f]/20 text-[12px] font-bold shadow-sm transition-all text-[#bfce7f] bg-[#bfce7f]/10 flex items-center gap-1.5"
              >
                <Edit2 size={13} /> Editar
              </button>
            )}
            <button onClick={handleGoBack} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-color)] rounded-full transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Selector */}
        <div className="bg-[var(--bg-elevated)] px-6 border-b border-[var(--border-color)] flex items-center gap-5 text-[12px] font-bold text-[var(--text-muted)] select-none shrink-0 overflow-x-auto scrollbar-none">
          {[
            { id: 'resumen', label: 'Resumen' },
            { id: 'activacion', label: 'Activación y acceso' },
            { id: 'permisos', label: 'Permisos' },
            { id: 'sesiones', label: 'Sesiones' },
            { id: 'actividad', label: 'Actividad' },
            { id: 'auditoria', label: 'Auditoría' }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => {
                setActiveTab360(t.id);
                if (t.id === 'permisos') setMatrixFilter('all');
              }}
              className={`py-3.5 border-b-2 font-bold tracking-wide transition-all ${
                activeTab360 === t.id ? 'border-primary text-primary-fixed' : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
          
          {/* TAB RESUMEN */}
          {activeTab360 === 'resumen' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {isEditing360 && wizardData ? (
                // EDIT MODE FORM
                <div className="space-y-6">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Información Personal Edit */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                      <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Users size={14} className="text-primary" /> Información Personal</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 flex items-center gap-2 mb-2">
                          <label className="font-bold text-[var(--text-muted)] text-[11px]">Usuario ID:</label>
                          <span className="font-mono font-bold text-[var(--text-primary)] text-[12px]">{detailUser.id || detailUser.usuario_id || '—'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11.5px] items-center">
                        <span className="text-[var(--text-muted)] font-semibold">Nombre: <span className="text-red-500">*</span></span>
                        <div className="flex flex-col w-full">
                          <input
                            type="text"
                            value={wizardData.first_name || ''}
                            onChange={(e) => handleChange('first_name', e.target.value)}
                            className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none w-full ${formErrors360.first_name ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                            placeholder="Nombre"
                          />
                          {formErrors360.first_name && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.first_name}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Apellido: <span className="text-red-500">*</span></span>
                        <div className="flex flex-col w-full">
                          <input
                            type="text"
                            value={wizardData.last_name || ''}
                            onChange={(e) => handleChange('last_name', e.target.value)}
                            className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none w-full ${formErrors360.last_name ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                            placeholder="Apellido"
                          />
                          {formErrors360.last_name && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.last_name}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Documento:</span>
                        <div className="flex flex-col w-full">
                          <div className="flex gap-1.5 w-full">
                            <select
                              value={wizardData.document_type || 'Cédula'}
                              onChange={(e) => handleChange('document_type', e.target.value)}
                              className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary"
                            >
                              <option value="Cédula">Cédula</option>
                              <option value="DNI">DNI</option>
                              <option value="Pasaporte">Pasaporte</option>
                              <option value="RNC">RNC</option>
                            </select>
                            <input
                              type="text"
                              value={wizardData.document_number || ''}
                              onChange={(e) => {
                                handleChange('document_number', e.target.value);
                                if (wizardData.primary_access_type === 'DOCUMENT') handleChange('identificador_principal', e.target.value);
                              }}
                              className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none flex-1 min-w-0 ${formErrors360.document_number ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                              placeholder="Número"
                            />
                          </div>
                          {formErrors360.document_number && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.document_number}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Correo Electrónico:</span>
                        <div className="flex flex-col w-full">
                          <input
                            type="email"
                            value={wizardData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none w-full ${formErrors360.email ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                            placeholder="Correo electrónico"
                          />
                          {formErrors360.email && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.email}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Departamento:</span>
                        <select
                          value={wizardData.department_id || ''}
                          onChange={(e) => {
                            const deptId = e.target.value;
                            const deptObj = departments.find(d => d.id == deptId);
                            handleChange('department_id', deptId);
                            handleChange('department', deptObj ? deptObj.name : '');
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Departamento</option>
                          {departments
                            
                            .map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))
                          }
                        </select>
                        <span className="text-[var(--text-muted)] font-semibold">Área:</span>
                        <select
                          value={wizardData.area_id || ''}
                          onChange={(e) => {
                            const aId = e.target.value;
                            const aObj = areas.find(a => a.id == aId);
                            handleChange('area_id', aId);
                            handleChange('area', aObj ? aObj.name : '');
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Área</option>
                          {areas
                            .filter(a => a.department_id == wizardData.department_id)
                            .map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))
                          }
                        </select>
                        <span className="text-[var(--text-muted)] font-semibold">Cargo / Posición:</span>
                        <select value={wizardData.cargo_id || ''} onChange={(e) => { const cId = e.target.value; handleChange('cargo_id', cId); const cargoObj = cargos.find(c => c.id == cId); handleChange('job_title', cargoObj ? cargoObj.name : ''); }}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Cargo</option>
                          {cargos.map(c => ( <option key={c.id} value={c.id}>{c.name}</option> ))}
                        </select>
                      </div>
                    </div>
 
                    {/* Parámetros de Acceso Edit */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                      <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Key size={14} className="text-primary" /> Parámetros de Acceso</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11.5px] items-center">
                        <span className="text-[var(--text-muted)] font-semibold">Método de acceso principal:</span>
                        <select
                          value={wizardData.primary_access_type || 'EMAIL'}
                          onChange={(e) => handleChange('primary_access_type', e.target.value)}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="EMAIL">Correo electrónico</option>
                          <option value="DOCUMENT">Documento</option>
                        </select>
                        
                        <span className="text-[var(--text-muted)] font-semibold">Identificador de acceso:</span>
                        {wizardData.primary_access_type === 'EMAIL' ? (
                          <div className="flex flex-col w-full">
                            <span className="font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[var(--border-color)] truncate opacity-70 cursor-not-allowed" title={wizardData.email}>
                              {wizardData.email || 'Se utilizará el correo indicado arriba'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col w-full">
                            <span className="font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[var(--border-color)] truncate opacity-70 cursor-not-allowed" title={wizardData.document_number}>
                              {wizardData.document_number || 'Se utilizará el documento indicado arriba'}
                            </span>
                          </div>
                        )}
                        
                        <span className="text-[var(--text-muted)] font-semibold">Canales Permitidos:</span>
                        <div className="flex gap-4 items-center">
                          <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!wizardData.web_access_enabled}
                              onChange={(e) => handleChange('web_access_enabled', e.target.checked)}
                              className="rounded text-primary border-[var(--border-color)] focus:ring-primary w-3.5 h-3.5"
                            />
                            Web
                          </label>
                          <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!wizardData.mobile_access_enabled}
                              onChange={(e) => handleChange('mobile_access_enabled', e.target.checked)}
                              className="rounded text-primary border-[var(--border-color)] focus:ring-primary w-3.5 h-3.5"
                            />
                            Móvil
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
 
                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Relación y Asignación Edit */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                      <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Building2 size={14} className="text-primary" /> Relación y Asignación</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11.5px] items-center">
                        <span className="text-[var(--text-muted)] font-semibold">Empresa: <span className="text-red-500">*</span></span>
                        <div className="flex flex-col w-full">
                          <select
                            value={wizardData.companyId || ''}
                            onChange={(e) => handleChange('companyId', e.target.value)}
                            className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none w-full ${formErrors360.companyId ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                          >
                            <option value="">Seleccione Empresa</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {formErrors360.companyId && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.companyId}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Tipo de Usuario:</span>
                        <select
                          value={wizardData.tipo_usuario_id || ''}
                          onChange={(e) => {
                            const valId = e.target.value;
                            const obj = userTypes.find(t => t.id == valId);
                            handleChange('tipo_usuario_id', valId);
                            if (obj) handleChange('user_type', obj.name);
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Tipo</option>
                          {userTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <span className="text-[var(--text-muted)] font-semibold">Rol Asignado: <span className="text-red-500">*</span></span>
                        <div className="flex flex-col w-full">
                          <select value={wizardData.rol_id || ''} onChange={(e) => { const rId = e.target.value; handleChange('rol_id', rId); const rolObj = roles.find(r => r.id == rId); handleChange('role', rolObj ? rolObj.name : ''); }}
                            className={`px-2 py-1 text-[11px] rounded border bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none w-full ${formErrors360.rol_id ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                          >
                            <option value="">Seleccione Rol</option>
                            {roles.map(r => ( <option key={r.id} value={r.id}>{r.name}</option> ))}
                          </select>
                          {formErrors360.rol_id && <span className="text-red-500 text-[10px] mt-0.5 font-semibold">{formErrors360.rol_id}</span>}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Roles Adicionales:</span>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto border border-[var(--border-color)] p-1.5 rounded bg-[var(--bg-elevated)] custom-scrollbar">
{roles.filter(r => r.id != wizardData.rol_id).map(r => (
  <label key={r.id} className="flex items-center gap-1.5 font-bold cursor-pointer select-none text-[11px]">
    <input
      type="checkbox"
      checked={(wizardData.roles_additional || []).includes(r.id)}
      onChange={(e) => {
        const newRoles = e.target.checked 
          ? [...(wizardData.roles_additional || []), r.id] 
          : (wizardData.roles_additional || []).filter(roleId => roleId !== r.id);
        handleChange('roles_additional', newRoles);
      }}
      className="rounded text-primary border-[var(--border-color)] focus:ring-primary w-3.5 h-3.5"
    />
    {r.name}
  </label>
))}
</div>
                      </div>
                    </div>
 
                    {/* Seguridad e Inicios Edit */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                      <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><ShieldCheck size={14} className="text-primary" /> Seguridad e Inicios</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11.5px] items-center">
                        <span className="text-[var(--text-muted)] font-semibold">Autenticación MFA:</span>
                        <div className="flex gap-2 items-center">
                          <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!wizardData.mfaEnabled}
                              onChange={(e) => handleChange('mfaEnabled', e.target.checked)}
                              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                            />
                            Activo
                          </label>
                          {wizardData.mfaEnabled && (
                            <select
                              value={wizardData.mfa_method || 'App autenticadora'}
                              onChange={(e) => handleChange('mfa_method', e.target.value)}
                              className="px-2 py-0.5 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary"
                            >
                              <option value="App autenticadora">App autenticadora</option>
                              <option value="SMS">SMS (Mensaje)</option>
                              <option value="Correo electrónico">Correo electrónico</option>
                            </select>
                          )}
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Expiración de acceso:</span>
                        <div className="flex gap-2 items-center w-full">
                          <input
                            type="date"
                            value={wizardData.access_expires_at ? wizardData.access_expires_at.split('T')[0] : ''}
                            onChange={(e) => handleChange('access_expires_at', e.target.value)}
                            className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleChange('access_expires_at', '')}
                            className="px-2 py-1 text-[10px] bg-[var(--bg-color)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-[var(--border-color)] font-bold text-[var(--text-secondary)] shadow-xs transition-colors"
                          >
                            Sin expiración
                          </button>
                        </div>
                        <span className="text-[var(--text-muted)] font-semibold">Horario de acceso:</span>
                        <select
                          value={wizardData.allowed_hours || 'Cualquier horario'}
                          onChange={(e) => handleChange('allowed_hours', e.target.value)}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="Cualquier horario">Sin restricción horaria (24/7)</option>
                          <option value="Horario de oficina (08:00 - 18:00)">Horario comercial (08:00 - 18:00)</option>
                          <option value="Horario diurno (06:00 - 22:00)">Horario diurno (06:00 - 22:00)</option>
                        </select>
                        <span className="text-[var(--text-muted)] font-semibold">Restricción IP:</span>
                        <input
                          type="text"
                          value={wizardData.allowed_ips || '*'}
                          onChange={(e) => handleChange('allowed_ips', e.target.value)}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full font-mono"
                          placeholder="e.g. * o 192.168.1.1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Row 3 (Configuración Avanzada Edit) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                      <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Settings size={14} className="text-primary" /> Configuración Avanzada</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[11.5px] items-center">
                        <span className="text-[var(--text-muted)] font-semibold">Correo de Acceso:</span>
                        <input type="email" value={wizardData.correo_acceso || ''} onChange={(e) => handleChange('correo_acceso', e.target.value)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full" placeholder="recovery@ejemplo.com" />
                        
                        <span className="text-[var(--text-muted)] font-semibold">Enviar Invitación:</span>
                        <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                          <input type="checkbox" checked={!!wizardData.enviar_invitacion_correo} onChange={(e) => handleChange('enviar_invitacion_correo', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Sí
                        </label>

                        <span className="text-[var(--text-muted)] font-semibold">Generar Clave Automática:</span>
                        <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                          <input type="checkbox" checked={!!wizardData.generar_clave_automatica} onChange={(e) => handleChange('generar_clave_automatica', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Sí
                        </label>

                        <span className="text-[var(--text-muted)] font-semibold">Forzar Cambio de Clave:</span>
                        <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
                          <input type="checkbox" checked={!!wizardData.forzar_cambio_clave} onChange={(e) => handleChange('forzar_cambio_clave', e.target.checked)} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Sí
                        </label>

                        <span className="text-[var(--text-muted)] font-semibold">Idioma Preferido:</span>
                        <select value={wizardData.idioma_preferido || 'es'} onChange={(e) => handleChange('idioma_preferido', e.target.value)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full">
                          <option value="es">Español</option>
                          <option value="en">Inglés</option>
                        </select>

                        <span className="text-[var(--text-muted)] font-semibold">Zona Horaria:</span>
                        <select value={wizardData.zona_horaria || 'America/Santo_Domingo'} onChange={(e) => handleChange('zona_horaria', e.target.value)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full">
                          <option value="America/Santo_Domingo">América/Santo Domingo</option>
                          <option value="America/New_York">América/New York</option>
                        </select>

                        <span className="text-[var(--text-muted)] font-semibold">Formato de Fecha:</span>
                        <select value={wizardData.formato_fecha || 'DD/MM/YYYY'} onChange={(e) => handleChange('formato_fecha', e.target.value)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold focus:outline-none focus:border-primary w-full">
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // VIEW MODE (Original layout)
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Users size={14} className="text-primary" /> Información Personal</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                      <span className="text-[var(--text-muted)] font-semibold">Usuario ID:</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{detailUser.id || detailUser.usuario_id || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Nombre: <span className="text-red-500">*</span></span>
                      <span className="font-bold text-[var(--text-primary)]">{detailUser.first_name || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Apellido: <span className="text-red-500">*</span></span>
                      <span className="font-bold text-[var(--text-primary)]">{detailUser.last_name || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Documento:</span>
                      <span className="font-semibold">
                        {detailUser.document_number ? `${detailUser.document_type || 'Documento'}: ${detailUser.document_number}` : 'No registrado'}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Correo Electrónico:</span>
                      <span className="font-semibold text-blue-500 hover:underline cursor-pointer">
                        {detailUser.email || 'No registrado'}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Departamento:</span>
                      <span className="font-semibold">{detailUser.department || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Área:</span>
                      <span className="font-semibold">{detailUser.area || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Cargo / Posición:</span>
                      <span className="font-semibold">{detailUser.job_title || '—'}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Key size={14} className="text-primary" /> Parámetros de Acceso</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                      <span className="text-[var(--text-muted)] font-semibold">Método de acceso principal:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_type === 'DOCUMENT' ? 'Documento' : 'Correo electrónico'}
                      </span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Identificador de acceso:</span>
                      <span className="font-mono font-bold text-indigo-500">
                        {detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_value || '—'}
                      </span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Estado de verificación:</span>
                      <span className={`font-semibold ${
                        detailUser.estado_verificacion === 'Verificado' ? 'text-emerald-500' : 'text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded'
                      }`}>
                        {detailUser.estado_verificacion || 'No verificado'}
                      </span>



                      <span className="text-[var(--text-muted)] font-semibold">Canales Permitidos:</span>
                      <span className="font-semibold">
                        {(() => {
                          const web = !!detailUser.web_access_enabled;
                          const mobile = !!detailUser.mobile_access_enabled;
                          if (web && mobile) return 'Web y móvil';
                          if (web) return 'Solo Web';
                          if (mobile) return 'Solo móvil';
                          return 'Sin acceso';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2 (Shown only in view mode since edit mode merges it all above) */}
              {!isEditing360 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Building2 size={14} className="text-primary" /> Relación y Asignación</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                      <span className="text-[var(--text-muted)] font-semibold">Empresa: <span className="text-red-500">*</span></span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {companies.find(c => c.id == detailUser.companyId)?.name || 'Loteka'}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Tipo de Usuario:</span>
                      <span className="font-semibold">{detailUser.user_type || userTypes.find(t => t.id == detailUser.tipo_usuario_id)?.name || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Rol Asignado: <span className="text-red-500">*</span></span>
                      <span className="font-bold text-primary">{detailUser.role || detailUser.role_name || '—'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Permisos:</span>
                      <span className="font-semibold">
                        {Object.keys(detailUser.permissionsOverride || {}).length > 0 ? 'Específica (Permisos Adicionales)' : 'Heredados del rol'}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Roles Adicionales:</span>
                      <span className="font-semibold">
                        {detailUser.roles_additional?.length > 0 
                          ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') 
                          : 'Ninguno'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><ShieldCheck size={14} className="text-primary" /> Seguridad e Inicios</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                      <span className="text-[var(--text-muted)] font-semibold">Autenticación MFA:</span>
                      <span className="font-bold">{detailUser.mfaEnabled ? `Sí (${detailUser.mfa_method || '—'})` : 'No'}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Expiración de acceso:</span>
                      <span className="font-semibold">{formatExpiracionDate(detailUser.access_expires_at)}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Horario de acceso:</span>
                      <span className="font-semibold">
                        {!detailUser.allowed_hours || detailUser.allowed_hours === 'Cualquier horario' ? 'Sin restricción horaria' : detailUser.allowed_hours}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Restricción IP:</span>
                      <span className="font-semibold font-mono">
                        {!detailUser.allowed_ips || detailUser.allowed_ips === '*' ? 'Sin restricción' : detailUser.allowed_ips}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">Creado El:</span>
                      <span className="font-semibold">{formatSafeDate(detailUser.createdAt)}</span>
                      <span className="text-[var(--text-muted)] font-semibold">Último Acceso:</span>
                      <span className="font-semibold">{detailUser.last_login_at ? formatSafeDateTime(detailUser.last_login_at) : 'Nunca'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3 (Configuración Avanzada) */}
              {!isEditing360 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[12px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1.5"><Settings size={14} className="text-primary" /> Configuración Avanzada</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                      <span className="text-[var(--text-muted)] font-semibold">Correo de Acceso (Recovery):</span>
                      <span className="font-bold text-[var(--text-primary)]">{detailUser.correo_acceso || '—'}</span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Enviar Invitación (Email):</span>
                      <span className="font-semibold">{detailUser.enviar_invitacion_correo ? 'Sí' : 'No'}</span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Generar Clave Automática:</span>
                      <span className="font-semibold">{detailUser.generar_clave_automatica ? 'Sí' : 'No'}</span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Forzar Cambio de Clave:</span>
                      <span className="font-semibold">{detailUser.forzar_cambio_clave ? 'Sí' : 'No'}</span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Idioma Preferido:</span>
                      <span className="font-semibold">
                        {detailUser.idioma_preferido === 'en' ? 'Inglés' : detailUser.idioma_preferido === 'es' ? 'Español' : (detailUser.idioma_preferido || 'es')}
                      </span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Zona Horaria:</span>
                      <span className="font-semibold">{detailUser.zona_horaria || 'America/Santo_Domingo'}</span>
                      
                      <span className="text-[var(--text-muted)] font-semibold">Formato de Fecha:</span>
                      <span className="font-semibold">{detailUser.formato_fecha || 'DD/MM/YYYY'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB ACTIVACION */}
          {activeTab360 === 'activacion' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Activation Metadata Grid */}
                <div className="lg:col-span-1 bg-[var(--bg-color)] p-5 rounded-xl border border-[var(--border-color)] space-y-4">
                  <h4 className="font-extrabold text-[var(--text-primary)] text-[13px] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-primary" />
                    Datos de Activación
                  </h4>
                  
                  <div className="space-y-3 text-[11.5px]">
                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Método de Acceso:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {detailUser.metodo_acceso_principal || 'Correo electrónico'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Identificador de Acceso:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {detailUser.identificador_principal || '—'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Correo de Recuperación:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {detailUser.correo_acceso || detailUser.email || '—'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Estado de Activación:</span>
                      <span>
                        {renderActivationBadge(detailUser.estado_activacion, detailUser.metodo_acceso_principal, detailUser)}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Fecha de Creación:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatSafeDateTime(detailUser.fecha_creacion || detailUser.createdAt)}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Credenciales Generadas El:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {detailUser.fecha_credenciales_generada ? formatSafeDateTime(detailUser.fecha_credenciales_generada) : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Instrucciones Entregadas El:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {detailUser.fecha_instrucciones_entregada ? formatSafeDateTime(detailUser.fecha_instrucciones_entregada) : 'No registrado'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">PIN Inicial Cambiado El:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {detailUser.fecha_pin_cambiado ? formatSafeDateTime(detailUser.fecha_pin_cambiado) : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Primer acceso realizado:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {detailUser.fecha_primer_acceso ? formatSafeDateTime(detailUser.fecha_primer_acceso) : 'Nunca'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold font-mono">Último Acceso:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {detailUser.fecha_ultimo_acceso || detailUser.last_login_at ? formatSafeDateTime(detailUser.fecha_ultimo_acceso || detailUser.last_login_at) : 'Nunca'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Expiración Invitación:</span>
                      <span className="font-semibold text-primary">
                        {detailUser.fecha_expiracion_invitacion ? formatSafeDateTime(detailUser.fecha_expiracion_invitacion) : 'Sin expiración'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Cantidad de Reenvíos:</span>
                      <span className="font-bold text-[var(--text-primary)] font-mono">
                        {detailUser.cantidad_reenvios || 0}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[var(--border-color)] pb-1.5 flex-wrap gap-1">
                      <span className="text-[var(--text-muted)] font-semibold">Canal / Medio:</span>
                      <span className="font-bold text-indigo-500">
                        {detailUser.canales_permitidos || 'SMS/Otro'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-[var(--text-muted)] font-semibold">Detalle del Estado / Log:</span>
                      <span className="bg-[var(--bg-color)] p-2 rounded border border-[var(--border-color)] font-medium text-[var(--text-secondary)] italic">
                        {detailUser.detalle_estado || 'Sin registros detallados de estado.'}
                      </span>

                    </div>
                  </div>
                </div>

                {/* Visual Timeline Stepper */}
                <div className="lg:col-span-2 bg-[var(--bg-color)] p-5 rounded-xl border border-[var(--border-color)] flex flex-col justify-between space-y-4">
                  <div>
                    <h4 className="font-extrabold text-[var(--text-primary)] text-[13px] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      Línea de Tiempo del Onboarding
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                      Seguimiento secuencial del usuario desde su creación administrativa hasta su adopción activa del sistema.
                    </p>
                  </div>
                  
                  <div className="py-4 pl-4 select-none flex-1 flex flex-col justify-center">
                    {(() => {
                      const method = detailUser.metodo_acceso_principal || 'Correo electrónico';
                      const currentStatus = detailUser.estado_activacion || 'Pendiente';
                      const logs = detailUser.onboarding_logs || [];
                      
                      const getStepLog = (codigos) => {
                         return logs.find(l => codigos.includes(l.paso_codigo?.toUpperCase()) && (l.completado === true || l.completado === 1 || l.completado === 'true'));
                      };

                      let steps = [];

                      const logCodes = new Set();
                      logs.forEach(l => {
                         let state = (l.completado === true || l.completado === 1 || l.completado === 'true') ? 'completed' : 'error';
                         let icon = <Check size={14} />;
                         if (l.paso_codigo === 'USUARIO_CREADO') icon = <UserPlus size={14} />;
                         else if (l.paso_codigo === 'INVITACION_ENVIADA') icon = <Mail size={14} />;
                         else if (l.paso_codigo === 'LINK_ABIERTO') icon = <Eye size={14} />;
                         else if (l.paso_codigo === 'REGISTRO_COMPLETADO') icon = <ShieldCheck size={14} />;
                         else if (l.paso_codigo === 'PRIMER_ACCESO' || l.paso_codigo === 'PRIMER_LOGIN' || l.paso_codigo === 'PRIMER_INGRESO') icon = <Laptop size={14} />;
                         else if (l.paso_codigo === 'CREDENCIALES_GENERADAS') icon = <Key size={14} />;
                         else if (l.paso_codigo === 'INSTRUCCIONES_ENTREGADAS') icon = <FileText size={14} />;
                         else if (l.paso_codigo === 'PIN_CAMBIADO' || l.paso_codigo === 'CLAVE_CAMBIADA') icon = <Check size={14} />;

                         steps.push({
                            label: l.titulo_paso || l.paso_codigo,
                            desc: l.descripcion_paso || '',
                            time: l.fecha_creacion || l.fecha_evento || l.created_at,
                            state: state,
                            icon: icon,
                            code: l.paso_codigo
                         });
                         logCodes.add(l.paso_codigo);
                      });

                      // Si no hay log explícito de creación, lo forzamos al inicio por consistencia
                      if (!logCodes.has('USUARIO_CREADO')) {
                         steps.unshift({
                            label: 'Usuario creado',
                            desc: 'Administrador registra datos básicos',
                            time: detailUser.fecha_creacion || detailUser.createdAt,
                            state: 'completed',
                            icon: <UserPlus size={14} />,
                            code: 'USUARIO_CREADO'
                         });
                      }

                      // Determinar los pasos FALTANTES basados en el método actual para pintar el "futuro" del timeline
                      let expectedSteps = [];
                      const isBounced = currentStatus.toLowerCase().includes('rebot');
                      const isExpired = currentStatus.toLowerCase().includes('expir');
                      const isBlocked = currentStatus.toLowerCase().includes('bloque');

                      if (method === 'Correo electrónico' || method === 'EMAIL' || method === 'Correo Electrónico') {
                         expectedSteps = [
                           { code: 'INVITACION_ENVIADA', label: 'Invitación enviada', desc: isBounced ? 'Fallo en entrega de correo (Rebotada)' : isExpired ? 'Plazo de 48h superado (Expirada)' : 'Correo electrónico de invitación despachado', icon: <Mail size={14} /> },
                           { code: 'LINK_ABIERTO', label: 'Link abierto', desc: 'El usuario accede al portal de verificación', icon: <Eye size={14} /> },
                           { code: 'REGISTRO_COMPLETADO', label: 'Registro completado', desc: 'Verificación de contraseña y datos completada', icon: <ShieldCheck size={14} /> },
                           { code: 'PRIMER_ACCESO', label: 'Primer acceso realizado', desc: 'Usuario inicia sesión de manera exitosa', icon: <Check size={14} /> }
                         ];
                      } else {
                         expectedSteps = [
                           { code: 'CREDENCIALES_GENERADAS', label: 'Credenciales generadas', desc: 'PIN de acceso temporal y ficha generada', icon: <Key size={14} /> },
                           { code: 'INSTRUCCIONES_ENTREGADAS', label: 'Instrucciones entregadas', desc: 'Ficha de credenciales entregada al usuario', icon: <FileText size={14} /> },
                           { code: 'PRIMER_ACCESO', label: 'Primer ingreso realizado', desc: isBlocked ? 'Cuenta bloqueada por seguridad' : 'Primer login con PIN temporal', icon: isBlocked ? <ShieldX size={14}/> : <Laptop size={14} /> },
                           { code: 'PIN_CAMBIADO', label: 'PIN / contraseña cambiado', desc: 'El usuario establece su PIN definitivo', icon: <Check size={14} /> }
                         ];
                      }

                      // Agregar los pasos que no están en el log como pendientes
                      let isFirstPending = true;
                      expectedSteps.forEach(exp => {
                         if (!logCodes.has(exp.code)) {
                            steps.push({
                               label: exp.label,
                               desc: exp.desc,
                               time: null,
                               state: isFirstPending ? 'active' : 'pending',
                               icon: exp.icon,
                               code: exp.code
                            });
                            isFirstPending = false;
                         }
                      });

                      // Marcar error si el estatus general refleja un fallo
                      if (isBlocked || isBounced || isExpired) {
                         const activeStep = steps.find(s => s.state === 'active');
                         if (activeStep) activeStep.state = 'error';
                      }

                      return (
                        <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 space-y-6 py-2">
                          {steps.map((step, idx) => {
                            let bulletColor = 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700';
                            let textColor = 'text-[var(--text-muted)]';
                            let titleColor = 'text-[var(--text-secondary)] font-bold';

                            if (step.state === 'completed') {
                              bulletColor = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
                              titleColor = 'text-emerald-700 dark:text-emerald-400 font-extrabold';
                              textColor = 'text-[var(--text-primary)] font-medium';
                            } else if (step.state === 'active') {
                              bulletColor = 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 animate-pulse';
                              titleColor = 'text-amber-700 dark:text-amber-400 font-extrabold';
                              textColor = 'text-[var(--text-primary)] font-medium';
                            } else if (step.state === 'error') {
                              bulletColor = 'bg-rose-50 text-primary-fixed border-rose-300 dark:bg-primary/10 dark:text-primary dark:border-primary/20';
                              titleColor = 'text-primary-fixed dark:text-primary font-extrabold';
                              textColor = 'text-primary dark:text-primary font-medium';
                            }

                            return (
                              <div key={idx} className="relative pl-7 group">
                                <div className={`absolute -left-[13.5px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-all duration-300 shadow-sm ${bulletColor}`}>
                                  {step.icon}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[12px] ${titleColor}`}>{step.label}</span>
                                    {step.time && (
                                      <span className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-color)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                                        {formatSafeDateTime(step.time)}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[11px] ${textColor}`}>{step.desc}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-color)] flex flex-wrap gap-2 items-center justify-between">
                    <span className="text-[10.5px] text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                      <Info size={13} className="text-indigo-500 shrink-0" />
                      Acciones rápidas disponibles para este estado:
                    </span>
                    <div className="flex gap-2">
                      {(() => {
                        const accessMethod = detailUser.activation?.access_method || 'EMAIL';
                        const actStatus = detailUser.activation?.activation_status || 'DRAFT';
                        const buttons = [];

                        if (accessMethod === 'EMAIL') {
                          if (actStatus === 'INVITATION_SENT' || actStatus === 'INVITATION_OPENED') {
                            buttons.push(
                              <button 
                                key="resend"
                                onClick={() => handleResendInvitationDirect(detailUser)}
                                className="px-2.5 py-1 rounded bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] text-[10.5px] font-bold"
                              >
                                Reenviar
                              </button>,
                              <button 
                                key="copy"
                                onClick={() => handleCopyActivationLink(detailUser)}
                                className="px-2.5 py-1 rounded bg-primary text-on-primary text-on-primary hover:bg-primary-fixed text-[10.5px] font-bold"
                              >
                                Copiar Link
                              </button>
                            );
                          } else if (actStatus === 'INVITATION_PENDING' || actStatus === 'DRAFT') {
                            buttons.push(
                              <button 
                                key="send"
                                onClick={() => handleSendInvitationDirect(detailUser)}
                                className="px-2.5 py-1 rounded bg-primary text-on-primary text-on-primary hover:bg-primary-fixed text-[10.5px] font-bold"
                              >
                                Enviar Invitación
                              </button>
                            );
                          } else if (actStatus === 'INVITATION_EXPIRED' || actStatus === 'INVITATION_BOUNCED') {
                            buttons.push(
                              <button 
                                key="regen"
                                onClick={() => handleRegenerateInvitationDirect(detailUser)}
                                className="px-2.5 py-1 rounded bg-primary text-on-primary text-on-primary hover:bg-primary-fixed text-[10.5px] font-bold"
                              >
                                Regenerar Enlace
                              </button>
                            );
                          } else if (actStatus === 'REGISTRATION_COMPLETED') {
                            buttons.push(
                              <button 
                                key="reminder"
                                onClick={() => handleSendReminderDirect(detailUser)}
                                className="px-2.5 py-1 rounded bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] text-[10.5px] font-bold"
                              >
                                Enviar Recordatorio
                              </button>
                            );
                          }
                        } else {
                          if (actStatus === 'CREDENTIALS_GENERATED' || actStatus === 'PENDING_FIRST_LOGIN') {
                            buttons.push(
                              <button 
                                key="regen-pin"
                                onClick={() => handleRegeneratePinDirect(detailUser)}
                                className="px-2.5 py-1 rounded bg-[var(--bg-color)] border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] text-[10.5px] font-bold"
                              >
                                Regenerar PIN
                              </button>,
                              <button 
                                key="mark-del"
                                onClick={() => handleMarkInstructionsDelivered(detailUser)}
                                className="px-2.5 py-1 rounded bg-primary text-on-primary text-on-primary hover:bg-primary-fixed text-[10.5px] font-bold"
                              >
                                Entregar Ficha
                              </button>
                            );
                          } else if (actStatus === 'ACCESS_BLOCKED') {
                            buttons.push(
                              <button 
                                key="unblock"
                                onClick={() => {
                                  handleGoBack();
                                  handleToggleBlock(detailUser);
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-[10.5px] font-bold"
                              >
                                Desbloquear
                              </button>
                            );
                          }
                        }
                        return buttons.length > 0 ? buttons : <span className="text-[10px] text-[var(--text-muted)] italic">Ninguna acción manual requerida.</span>;
                      })()}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB PERMISOS */}
          {activeTab360 === 'permisos' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Summary Cards */}
              {(() => {
                const activeUser = (isEditing360 && wizardData) ? wizardData : detailUser;
                const userRole = activeUser.role || activeUser.role_name || '—';
                const overridesCount = Object.keys(activeUser.permissionsOverride || {}).length;
                
                const basePermissions = {};
                const rolesToApply = [userRole];
                if (activeUser.roles_additional && activeUser.roles_additional.length > 0) {
                  activeUser.roles_additional.forEach(id => {
                    const r = roles.find(r => r.id == id || r.name == id);
                    if (r && r.name && !rolesToApply.includes(r.name)) rolesToApply.push(r.name);
                  });
                }
                rolesToApply.forEach(rName => {
                  const rPerms = defaultRolePermissions[rName] || {};
                  Object.keys(rPerms).forEach(modId => {
                    if (!basePermissions[modId]) basePermissions[modId] = [];
                    rPerms[modId].forEach(act => {
                      if (!basePermissions[modId].includes(act)) basePermissions[modId].push(act);
                    });
                  });
                });
                
                let modulesCount = 0;
                modules.forEach(mod => {
                  const hasAny = ALL_ACTIONS.some(act => {
                    const overrideValue = activeUser.permissionsOverride?.[`${mod.id}:${act.id}`];
                    return overrideValue !== undefined ? overrideValue : basePermissions[mod.id]?.includes(act.id);
                  });
                  if (hasAny) modulesCount++;
                });

                const checkAction = (actId) => {
                  return modules.some(mod => {
                    const overrideValue = activeUser.permissionsOverride?.[`${mod.id}:${actId}`];
                    return overrideValue !== undefined ? overrideValue : basePermissions[mod.id]?.includes(actId);
                  });
                };
                const criticals = [];
                if (checkAction('exportar')) criticals.push('Exportar');
                if (checkAction('aprobar')) criticals.push('Aprobar');
                if (checkAction('asignar')) criticals.push('Asignar');
                if (checkAction('mover')) criticals.push('Mover');
                const criticalsStr = criticals.length > 0 ? criticals.join(', ') : 'Ninguna';

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Rol Principal</span>
                      {isEditing360 && wizardData ? (
                        <select 
                          value={wizardData.rol_id || ''} 
                          onChange={(e) => { 
                            const rId = e.target.value; 
                            handleChange('rol_id', rId); 
                            const rolObj = roles.find(r => r.id == rId); 
                            handleChange('role', rolObj ? rolObj.name : ''); 
                          }}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[12px] font-bold text-primary focus:outline-none focus:border-primary shadow-sm"
                        >
                          <option value="">Seleccione un rol...</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-black text-primary block mt-1">{userRole}</span>
                      )}
                    </div>
                    <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Roles adicionales</span>
                      {isEditing360 && wizardData ? (
                        <div className="relative group">
                          <div className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[11px] font-bold text-[var(--text-primary)] cursor-pointer flex justify-between items-center shadow-sm">
                             <span className="truncate">
                               {(wizardData.roles_additional?.length || 0)} roles seleccionados
                             </span>
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                          <div className="absolute top-full left-0 w-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 hidden group-hover:block max-h-[160px] overflow-y-auto custom-scrollbar">
                            {roles.filter(r => r.id != wizardData.rol_id).map(r => (
                               <label key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-color)] cursor-pointer border-b border-[var(--border-color)]/50 last:border-0 transition-colors">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-primary focus:ring-primary bg-[var(--bg-color)] border-[var(--border-color)] cursor-pointer"
                                    checked={(wizardData.roles_additional || []).includes(r.id)}
                                    onChange={() => {
                                      const newRoles = (wizardData.roles_additional || []).includes(r.id)
                                        ? (wizardData.roles_additional || []).filter(roleId => roleId !== r.id)
                                        : [...(wizardData.roles_additional || []), r.id];
                                      handleChange('roles_additional', newRoles);
                                    }}
                                  />
                                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">{r.name}</span>
                               </label>
                            ))}
                            {roles.filter(r => r.id != wizardData.rol_id).length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-[var(--text-muted)] italic">No hay más roles disponibles.</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-[var(--text-primary)] block mt-1 truncate" title={detailUser.roles_additional?.length > 0 ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') : 'Ninguno'}>
                          {detailUser.roles_additional?.length > 0 
                            ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') 
                            : 'Ninguno'}
                        </span>
                      )}
                    </div>
                    <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Permisos adicionales creados</span>
                      <span className="text-sm font-black text-amber-500 font-mono">
                        {overridesCount}
                      </span>
                    </div>
                    <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Módulos permitidos</span>
                      <span className="text-sm font-black text-[var(--text-primary)] font-mono">
                        {modulesCount} / {modules.length}
                      </span>
                    </div>
                    <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs col-span-1 sm:col-span-2 lg:col-span-1">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Acciones críticas</span>
                      <span className="text-[11px] font-bold text-primary-fixed truncate block" title={criticalsStr}>
                        {criticalsStr}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[var(--border-color)] pb-3 gap-3">
                <div>
                  <h4 className="font-bold text-[var(--text-primary)] text-[13px]">Matriz de Permisos Efectivos</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Consulta de permisos consolidados (Heredados + Adicionales). No modificable directamente.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold select-none">
                  <span className="text-[10px] text-[var(--text-muted)] mr-1 uppercase tracking-wider">Filtrar:</span>
                  <button 
                    onClick={() => setMatrixFilter('all')}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                      matrixFilter === 'all'
                        ? 'bg-[#bfce7f] text-[#2b3400] border-[#bfce7f] shadow-sm'
                        : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setMatrixFilter('base')}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                      matrixFilter === 'base'
                        ? 'bg-[#bfce7f]/20 text-[#bfce7f] border-[#bfce7f]/50 shadow-sm'
                        : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#bfce7f]"></span> 
                    Rol Principal
                  </button>
                  <button 
                    onClick={() => setMatrixFilter('additional')}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                      matrixFilter === 'additional'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                        : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span> 
                    Roles Adicionales
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-[var(--border-color)] rounded-xl bg-[var(--bg-color)] custom-scrollbar shadow-md">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)] font-black text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4 tracking-wider text-[var(--text-primary)]">Módulo / Sección</th>
                      <th className="py-3.5 px-1 text-center w-14 tracking-wider text-[#bfce7f]">FULL</th>
                      {ALL_ACTIONS.map(act => <th key={act.id} className="py-3.5 px-1 text-center w-14 tracking-wider text-[var(--text-muted)]">{act.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-color)]">
                    {modules.map(mod => {
                      const activeUser = (isEditing360 && wizardData) ? wizardData : detailUser;
                      const userRole = activeUser.role || activeUser.role_name || '—';
                      const userOverrides = activeUser.permissionsOverride || {};
                      
                      const baseRolePermissions = defaultRolePermissions[userRole] || {};
                      const additionalRolesPermissions = {};
                      
                      if (activeUser.roles_additional && activeUser.roles_additional.length > 0) {
                        const rolesToApply = [];
                        activeUser.roles_additional.forEach(id => {
                          const r = roles.find(r => r.id == id || r.name == id);
                          if (r && r.name && r.name !== userRole && !rolesToApply.includes(r.name)) {
                            rolesToApply.push(r.name);
                          }
                        });
                        rolesToApply.forEach(rName => {
                          const rPerms = defaultRolePermissions[rName] || {};
                          Object.keys(rPerms).forEach(modId => {
                            if (!additionalRolesPermissions[modId]) additionalRolesPermissions[modId] = [];
                            rPerms[modId].forEach(act => {
                              if (!additionalRolesPermissions[modId].includes(act)) additionalRolesPermissions[modId].push(act);
                            });
                          });
                        });
                      }
                      
                      // Calculate FULL status
                      const allChecked = ALL_ACTIONS.every(act => {
                        const overrideValue = userOverrides[`${mod.id}:${act.id}`];
                        if (overrideValue !== undefined) return overrideValue;
                        return baseRolePermissions[mod.id]?.includes(act.id) || additionalRolesPermissions[mod.id]?.includes(act.id);
                      });

                      return (
                        <tr key={mod.id} className="hover:bg-[var(--bg-elevated)]/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-[var(--text-primary)] text-[12px] uppercase">{mod.name || mod.label || mod.nombre || `Módulo ${mod.id}`}</td>
                          
                          {/* FULL Column (Read Only) */}
                          <td className="py-3 px-1 text-center select-none">
                            <div className="flex justify-center">
                              {allChecked ? (
                                <CheckSquare size={16} className="text-[#bfce7f]" />
                              ) : (
                                <Square size={16} className="text-[var(--border-color)] opacity-30" />
                              )}
                            </div>
                          </td>

                          {ALL_ACTIONS.map(act => {
                            const overrideValue = userOverrides[`${mod.id}:${act.id}`];
                            const isManual = overrideValue !== undefined;
                            const isManualGranted = isManual && overrideValue === true;
                            
                            const hasBaseRole = baseRolePermissions[mod.id]?.includes(act.id);
                            const hasAdditionalRole = additionalRolesPermissions[mod.id]?.includes(act.id);
                            
                            const isGrantedByRoles = hasBaseRole || hasAdditionalRole;
                            
                            const isChecked = isManual ? overrideValue : isGrantedByRoles;
                            
                            let source = 'none';
                            if (isManualGranted) source = 'manual';
                            else if (!isManual && hasBaseRole) source = 'base';
                            else if (!isManual && hasAdditionalRole) source = 'additional';
                            
                            // Apply filter visibility
                            const isVisible = matrixFilter === 'all' || 
                                              (matrixFilter === 'base' && source === 'base') || 
                                              (matrixFilter === 'additional' && source === 'additional') ||
                                              (matrixFilter === 'manual' && source === 'manual');

                            return (
                              <td key={act.id} className="py-3 px-1 text-center select-none">
                                <div className="flex justify-center">
                                  {isChecked ? (
                                    <div className={`${!isVisible ? 'opacity-25 grayscale' : ''}`} title={source === 'manual' ? "Permiso manual" : source === 'additional' ? "Rol Adicional" : "Rol Principal"}>
                                      {source === 'manual' ? (
                                        <CheckSquare size={16} className="text-cyan-400" />
                                      ) : source === 'additional' ? (
                                        <CheckSquare size={16} className="text-amber-400" />
                                      ) : (
                                        <CheckSquare size={16} className="text-[#bfce7f]" />
                                      )}
                                    </div>
                                  ) : (
                                    <Square size={16} className="text-[var(--border-color)] opacity-30" />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB SESIONES */}
          {activeTab360 === 'sesiones' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {(() => {
                const userSessions = realUserSessions;
                const activeSessionsCount = userSessions.filter(s => s.status === 'ACTIVA').length;
                
                const lastActivityDate = userSessions.length > 0 
                  ? new Date(Math.max(...userSessions.map(s => new Date(s.last_activity_at || s.login_time).getTime()))) 
                  : null;
                
                const uniqueDevices = new Set(userSessions.map(s => s.device)).size;
                const uniqueIPs = new Set(userSessions.map(s => s.ip_address)).size;

                return (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Sesiones activas</span>
                        <span className="text-lg font-black text-primary font-mono">{activeSessionsCount}</span>
                      </div>
                      <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Última actividad</span>
                        <span className="text-[11px] font-bold text-[var(--text-primary)] truncate block">
                          {lastActivityDate ? lastActivityDate.toLocaleString() : 'Nunca'}
                        </span>
                      </div>
                      <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Dispositivos conocidos</span>
                        <span className="text-lg font-black text-[var(--text-primary)] font-mono">{uniqueDevices}</span>
                      </div>
                      <div className="p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-1 shadow-xs">
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">IPs distintas</span>
                        <span className="text-lg font-black text-[var(--text-primary)] font-mono">{uniqueIPs}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                      <h4 className="font-bold text-[var(--text-primary)] text-[12px]">Historial de Conexiones Activas</h4>
                      <button 
                        onClick={() => handleRevokeAllSessions(detailUser.id)}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-primary-fixed border border-rose-200 rounded text-[11px] font-bold transition-all dark:bg-primary/10 dark:text-primary dark:border-primary/20"
                      >
                        Revocar todas las sesiones
                      </button>
                    </div>

                    <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#0e1117] shadow-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#2d3748] bg-[#161a21] select-none">
                              <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('device')}>DISPOSITIVO / NAVEGADOR {sortConfigSesiones.key === 'device' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('ip')}>IP {sortConfigSesiones.key === 'ip' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('location')}>UBICACIÓN {sortConfigSesiones.key === 'location' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('login_time')}>INICIO DE SESIÓN {sortConfigSesiones.key === 'login_time' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('last_activity_at')}>ÚLTIMA ACTIVIDAD {sortConfigSesiones.key === 'last_activity_at' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 text-center font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortSesiones('status')}>ESTADO {sortConfigSesiones.key === 'status' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}</th>
                              <th className="py-3 px-4 text-right pr-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase">ACCIONES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2d3748]">
                            {(() => {
                              const sorted = [...userSessions].sort((a, b) => {
                                const aVal = a[sortConfigSesiones.key] || '';
                                const bVal = b[sortConfigSesiones.key] || '';
                                if (aVal < bVal) return sortConfigSesiones.direction === 'asc' ? -1 : 1;
                                if (aVal > bVal) return sortConfigSesiones.direction === 'asc' ? 1 : -1;
                                return 0;
                              });
                              return sorted.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="py-6 px-4 text-center text-slate-400 font-mono text-xs italic">No hay sesiones activas ni conexiones registradas.</td>
                                </tr>
                              ) : (
                                sorted.map(session => (
                                  <tr key={session.id} className="hover:bg-[#1f242d] transition-colors">
                                    <td className="py-3.5 px-4 font-bold text-white font-mono text-xs">
                                      {session.device}
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-xs">
                                      <span className="px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#2d3748] text-slate-300">
                                        {session.ip}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{session.location || '—'}</td>
                                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{formatSafeDateTime(session.login_time)}</td>
                                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{formatSafeDateTime(session.last_activity_at)}</td>
                                    <td className="py-3.5 px-4 text-center">
                                      <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider ${
                                        session.status === 'ACTIVA' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                                      }`}>{session.status}</span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right pr-4">
                                      {session.status === 'ACTIVA' && (
                                        <button 
                                          onClick={() => handleRevokeSingleSession(session)}
                                          className="text-rose-400 hover:text-rose-300 font-mono text-xs font-bold transition-colors cursor-pointer"
                                          title="Revocar sesión activa en este dispositivo"
                                        >
                                          Revocar sesión
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB ACTIVIDAD */}
          {activeTab360 === 'actividad' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
                <h4 className="font-mono text-xs font-bold text-[#e4e3d9] tracking-wider uppercase flex items-center gap-2">
                  <Clock size={15} className="text-[#bfce7f]" />
                  <span>Registro de Actividad del Usuario</span>
                </h4>
              </div>
              
              {(() => {
                const userActs = realUserActivity;
                if (userActs.length === 0) {
                  return (
                    <div className="py-12 border border-dashed border-[#2d3748] rounded-xl bg-[#0e1117] text-center space-y-2">
                      <Clock className="mx-auto text-slate-600 animate-pulse" size={32} />
                      <p className="font-bold text-xs text-white">Este usuario aún no tiene actividad registrada.</p>
                      <p className="text-[11px] text-slate-400 font-mono">Las acciones operativas ejecutadas por el usuario se registrarán en esta tabla.</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#0e1117] shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#2d3748] bg-[#161a21] select-none">
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('timestamp')}>FECHA Y HORA {sortConfigActividad.key === 'timestamp' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('event')}>EVENTO {sortConfigActividad.key === 'event' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('module')}>MÓDULO {sortConfigActividad.key === 'module' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('result')}>RESULTADO {sortConfigActividad.key === 'result' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('ip')}>IP {sortConfigActividad.key === 'ip' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortActividad('device')}>DISPOSITIVO {sortConfigActividad.key === 'device' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d3748]">
                          {(() => {
                            const sortedActs = [...userActs].sort((a, b) => {
                              const aVal = a[sortConfigActividad.key] || '';
                              const bVal = b[sortConfigActividad.key] || '';
                              if (aVal < bVal) return sortConfigActividad.direction === 'asc' ? -1 : 1;
                              if (aVal > bVal) return sortConfigActividad.direction === 'asc' ? 1 : -1;
                              return 0;
                            });
                            return sortedActs.map(act => {
                              const resultStatus = (act.result || 'Exitoso').toUpperCase();

                              return (
                                <tr key={act.id} className="hover:bg-[#1f242d] transition-colors">
                                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                                    {formatSafeDateTime(act.timestamp)}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-xs font-bold text-white">{act.event || act.title || 'Actividad'}</span>
                                      {act.desc && <span className="text-[11px] text-slate-400 mt-0.5">{act.desc}</span>}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#bfce7f] uppercase whitespace-nowrap">{act.module || 'Seguridad'}</td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider ${
                                      resultStatus.includes('EXITOSO') || resultStatus.includes('ÉXITO') || resultStatus.includes('OK')
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}>
                                      {act.result || 'Exitoso'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#2d3748] font-mono text-[11px] text-slate-300">
                                      {act.ip || act.ip_address || '—'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#2d3748] text-[11px] text-slate-300">
                                      {act.device || 'Navegador Web'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB AUDITORIA */}
          {activeTab360 === 'auditoria' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center border-b border-[#2d3748] pb-3">
                <h4 className="font-mono text-xs font-bold text-[#e4e3d9] tracking-wider uppercase flex items-center gap-2">
                  <FileText size={15} className="text-[#bfce7f]" />
                  <span>Bitácora de Auditoría Administrativa (Audit Log)</span>
                </h4>
              </div>
              
              {isLoadingAudits ? (
                <div className="py-12 border border-dashed border-[#2d3748] rounded-xl bg-[#0e1117] flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-[#2d3748] border-t-[#bfce7f] rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400 font-mono">Cargando bitácora de auditoría...</p>
                </div>
              ) : (() => {
                if (realUserAudits.length === 0) {
                  return (
                    <div className="py-12 border border-dashed border-[#2d3748] rounded-xl bg-[#0e1117] text-center space-y-2">
                      <FileText className="mx-auto text-slate-600 animate-pulse" size={32} />
                      <p className="font-bold text-xs text-white">No hay eventos administrativos registrados para este usuario.</p>
                      <p className="text-[11px] text-slate-400 font-mono">Los cambios de rol, permisos, bloqueos y configuraciones administrativas se registrarán aquí.</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-[#2d3748] rounded-xl overflow-hidden bg-[#0e1117] shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#2d3748] bg-[#161a21] select-none">
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('performed_at')}>
                              FECHA Y HORA {sortConfigAuditoria.key === 'performed_at' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('action')}>
                              ACCIÓN {sortConfigAuditoria.key === 'action' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('before_value')}>
                              CAMBIO REALIZADO {sortConfigAuditoria.key === 'before_value' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('performed_by')}>
                              EJECUTADO POR {sortConfigAuditoria.key === 'performed_by' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('reason')}>
                              MOTIVO {sortConfigAuditoria.key === 'reason' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('result')}>
                              RESULTADO {sortConfigAuditoria.key === 'result' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('ip')}>
                              IP {sortConfigAuditoria.key === 'ip' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-3 px-4 font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase cursor-pointer" onClick={() => handleSortAuditoria('device')}>
                              DISPOSITIVO {sortConfigAuditoria.key === 'device' && (sortConfigAuditoria.direction === 'asc' ? '↑' : '↓')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d3748]">
                          {(() => {
                            const sortedAudits = [...realUserAudits].sort((a, b) => {
                              const aVal = a[sortConfigAuditoria.key] || '';
                              const bVal = b[sortConfigAuditoria.key] || '';
                              if (aVal < bVal) return sortConfigAuditoria.direction === 'asc' ? -1 : 1;
                              if (aVal > bVal) return sortConfigAuditoria.direction === 'asc' ? 1 : -1;
                              return 0;
                            });
                            return sortedAudits.map(audit => {
                              const beforeVal = audit.before_value || audit.before_state || '—';
                              const afterVal = audit.after_value || audit.after_state || '—';
                              const resultStatus = (audit.result || 'Completado').toUpperCase();

                              return (
                                <tr key={audit.id} className="hover:bg-[#1f242d] transition-colors">
                                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                                    {formatSafeDateTime(audit.performed_at || audit.timestamp)}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#bfce7f] uppercase tracking-wide whitespace-nowrap">
                                    {audit.action}
                                  </td>
                                  <td className="py-3.5 px-4 align-middle">
                                    <div className="flex flex-col gap-1.5 text-[11px] max-w-[280px]">
                                      {beforeVal !== '—' && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">Antes:</span>
                                          <span className="px-2 py-0.5 rounded-md bg-[#161a21] border border-[#2d3748] text-slate-300 font-mono text-[10px] truncate max-w-[200px]">
                                            {beforeVal}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-[10px] font-bold text-[#bfce7f] uppercase">Después:</span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#bfce7f]/15 border border-[#bfce7f]/30 text-[#bfce7f] font-mono text-[10px] font-bold truncate max-w-[200px]">
                                          {afterVal}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-white whitespace-nowrap">
                                    @{audit.performed_by || 'Admin'}
                                  </td>
                                  <td className="py-3.5 px-4 text-xs text-slate-300 font-normal leading-relaxed min-w-[180px]">
                                    {audit.reason || 'Actualización administrativa'}
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider ${
                                      resultStatus.includes('COMPLETADO') || resultStatus.includes('EXITO') || resultStatus.includes('ÉXITO') || resultStatus.includes('OK')
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : resultStatus.includes('PENDIENTE')
                                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}>
                                      {audit.result || 'Completado'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#2d3748] font-mono text-[11px] text-slate-300">
                                      {audit.ip || '—'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#0e1117] border border-[#2d3748] text-[11px] text-slate-300">
                                      {audit.device || '—'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Ficha Footer */}
        <div className="p-4 md:p-6 border-t border-[#2d3748] bg-[#0e1117] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div className="flex-1">
            {edit360Error && (
              <div className="flex items-center gap-2 text-rose-400 text-[11px] font-bold animate-in fade-in duration-200 font-mono">
                <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                <span>{edit360Error}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {isEditing360 ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit360}
                  className="px-5 py-2.5 rounded-xl border border-[#2d3748] bg-[#161a21] text-white hover:bg-[#212631] font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar Edición
                </button>
                <button
                  type="button"
                  onClick={handleTriggerSaveEdit360}
                  className="px-6 py-2.5 rounded-xl bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] font-mono text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  Guardar Cambios
                </button>
              </>
            ) : (
              <button 
                type="button"
                onClick={handleGoBack}
                className="px-5 py-2.5 border border-[#2d3748] bg-[#161a21] text-white hover:bg-[#212631] transition-all font-mono text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                Volver al Listado
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-color)] animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-6 z-[9999] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold text-white ${toast.type === 'error' ? 'bg-primary-fixed' : 'bg-emerald-600'}`}>
            <Check size={15} /> <span>{toast.message}</span>
          </div>
        </div>
      )}

      {!detailUser ? (
        searchParams.get('userId') ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-[var(--border-color)] border-t-[var(--brand-primary)] rounded-full animate-spin shadow-sm"></div>
            <p className="mt-4 text-xs font-bold text-[var(--text-muted)] animate-pulse">Cargando perfil del usuario...</p>
          </div>
        ) : (
          <>
          {/* Main Page Header */}
      <div className="px-6 pt-6 pb-4 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border-color)] bg-[var(--bg-elevated)] shadow-sm">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <button 
              className="md:hidden p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-primary shadow-sm"
              onClick={onOpenSidebar}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
              <Users className="text-primary animate-pulse" size={24} />
              Usuarios
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-semibold leading-normal">
              Administra los usuarios, accesos, roles, permisos y alcance operativo dentro de Suivi.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleExport}
            className="px-3 py-2 bg-[var(--bg-color)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--border-color)] rounded-lg shadow-sm transition-colors flex items-center gap-2 text-[13px] font-bold" 
            title="Exportar a Excel (CSV)"
          >
            <Download size={15}/> Exportar Excel
          </button>
          <button 
            onClick={handleAddNew}
            className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary rounded-lg text-[13px] font-bold flex items-center gap-2 shadow-md transition-all"
          >
            <UserPlus size={16}/> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Grid of upper metric cards */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 shrink-0">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total</span>
          <span className="text-lg font-black text-[var(--text-primary)] mt-1">{data.length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Activos</span>
          <span className="text-lg font-black text-emerald-500 mt-1">{data.filter(u => u.status === 'Activo').length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Bloqueados</span>
          <span className="text-lg font-black text-primary mt-1">{data.filter(u => u.status === 'Bloqueado').length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Inv. Enviadas</span>
          <span className="text-lg font-black text-blue-500 mt-1">{data.filter(u => u.activation?.activation_status === 'INVITATION_SENT' || u.activation?.activation_status === 'INVITATION_OPENED').length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pend. Registro</span>
          <span className="text-lg font-black text-amber-550 mt-1">{data.filter(u => u.activation?.activation_status === 'INVITATION_PENDING' || u.activation?.activation_status === 'INVITATION_SENT' || u.activation?.activation_status === 'INVITATION_OPENED').length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Reg. sin Login</span>
          <span className="text-lg font-black text-indigo-550 mt-1">{data.filter(u => u.activation?.activation_status === 'REGISTRATION_COMPLETED').length}</span>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-3 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Primer Login</span>
          <span className="text-lg font-black text-emerald-500 mt-1">{data.filter(u => u.activation?.activation_status === 'FIRST_LOGIN_COMPLETED').length}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 flex-1 overflow-y-auto pb-10 space-y-4">

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[285px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg text-[13px] font-medium focus:outline-none focus:border-primary shadow-sm" 
              placeholder="Buscar por nombre, correo, usuario o documento..." 
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-[var(--border-color)] rounded-lg p-0.5 bg-[var(--bg-elevated)] shadow-sm shrink-0 ml-auto">
            <button 
              type="button"
              onClick={() => setViewMode('table')} 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary text-on-primary' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="Vista de Tabla"
            >
              <List size={15} />
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('grid')} 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary text-on-primary' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="Vista de Cuadrícula (Grid)"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          {activeFiltersCount > 0 && (
            <button onClick={handleClearFilters} className="text-xs font-bold text-primary-fixed hover:underline">Limpiar filtros</button>
          )}
        </div>

        {/* Selected rows actions bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/25 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
            <span className="text-sm font-bold text-primary-fixed">
              {selectedIds.length} usuarios seleccionados
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleMassToggleStatus} 
                className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg text-xs font-bold hover:bg-[var(--bg-color)] transition-colors flex items-center gap-1.5"
              >
                <ToggleRight size={14} /> Rotar Estado
              </button>
              <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-bold transition-colors">
                Limpiar Selección
              </button>
            </div>
          </div>
        )}

        {/* Users Catalog List */}
        {viewMode === 'table' ? (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-200">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-elevated)] select-none">
                    <th className="py-3.5 px-4 w-12 text-center">
                      <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === sortedData.length} onChange={toggleAll} />
                    </th>
                    <th className="py-3.5 px-4">Usuario / Identidad</th>
                    <th className="py-3.5 px-4">Empresa / Consorcio</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Tipo de Usuario</th>
                    <th className="py-3.5 px-4">Último Acceso</th>
                    <th className="py-3.5 px-4 text-center">MFA</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Estado de activación</th>
                    <th className="py-3.5 px-4 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-elevated)]">
                  {sortedData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <Users size={48} className="mx-auto text-[var(--text-muted)] opacity-20 mb-4" />
                        <h3 className="text-base font-bold text-[var(--text-primary)]">Sin registros encontrados</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Prueba limpiando los filtros o realizando otra búsqueda.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map(item => {
                      const isChecked = selectedIds.includes(item.id);
                      const isDropdownOpen = activeDropdown === item.id;
                      const company = companies.find(c => c.id == item.companyId);
                      
                      return (
                        <tr 
                          key={item.id}
                          className={`hover:bg-[var(--bg-color)] transition-colors cursor-pointer text-[13px] ${isChecked ? 'bg-primary/5' : ''}`}
                          onClick={() => handleViewDetail(item, 'resumen')}
                        >
                          <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => toggleSelection(item.id, e)}
                              className="rounded border-[var(--border-color)] text-primary cursor-pointer"
                            />
                          </td>
                          
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                {item.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[var(--text-primary)]">{item.full_name}</span>
                                </div>
                                <span className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-1.5 mt-0.5">
                                  <Mail size={12} className="text-[var(--text-muted)] shrink-0" />
                                  <span>{item.login_identifiers?.find(id => id.is_primary)?.identifier_value || item.email || '—'}</span>
                                </span>
                                {item.phone && (
                                  <span className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-1.5 mt-0.5">
                                    <Phone size={12} className="text-[var(--text-muted)] shrink-0" />
                                    <span>{item.phone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
  
                          <td className="py-3 px-4">
                            {company ? (
                              <div className="flex items-center gap-2">
                                <Building2 size={13} className="text-[var(--text-muted)]" />
                                <span className="font-semibold text-[var(--text-secondary)]">{company.name}</span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
  
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded text-[10.5px] font-extrabold ${
                              item.role.includes('Administrador') || item.role.includes('CISO')
                                ? 'bg-rose-50 text-rose-700 dark:bg-primary/10 dark:text-primary'
                                : item.role.includes('Supervisor')
                                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                                  : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {item.role}
                            </span>
                          </td>
  
                          <td className="py-3 px-4 text-[12.5px] font-semibold text-[var(--text-secondary)]">
                            {item.user_type}
                          </td>
  
                          <td className="py-3 px-4 text-[12px] font-semibold text-[var(--text-secondary)]">
                            {item.last_login_at ? new Date(item.last_login_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                          </td>
  
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center">
                              {item.mfaEnabled ? (
                                <ShieldCheck className="text-emerald-500" size={16} title={`MFA: ${item.mfa_method}`} />
                              ) : (
                                <ShieldX className="text-slate-400" size={16} title="MFA Deshabilitado" />
                              )}
                            </div>
                          </td>
  
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${
                              item.status === 'Activo' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                : item.status === 'Invitado' || item.status === 'Pendiente de activación'
                                ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400'
                                : item.status === 'Bloqueado'
                                ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-primary/10 dark:text-primary'
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
  
                          <td className="py-3 px-4 text-center">
                            {renderActivationBadge(item.estado_activacion, item.primary_access_type, item)}
                          </td>
  
                          <td className="py-3 px-4 text-right pr-6 relative" onClick={e => e.stopPropagation()}>
                            <button 
                              className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-color)] rounded-lg transition-colors inline-block"
                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(isDropdownOpen ? null : item.id); }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            
                            {isDropdownOpen && (
                              <div className="absolute right-12 top-2 mt-1 w-52 bg-[var(--bg-elevated)] rounded-lg shadow-xl border border-[var(--border-color)] py-1.5 z-50 text-left">
                                {renderDropdownItems(item)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {sortedData.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-sm">
                <Users size={48} className="mx-auto text-[var(--text-muted)] opacity-20 mb-4" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Sin registros encontrados</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Prueba limpiando los filtros o realizando otra búsqueda.</p>
              </div>
            ) : (
              paginatedData.map(item => {
                const isChecked = selectedIds.includes(item.id);
                const isDropdownOpen = activeDropdown === item.id;
                const company = companies.find(c => c.id == item.companyId);
                
                return (
                  <div 
                    key={item.id} 
                    className={`bg-[var(--bg-elevated)] border rounded-2xl p-5 hover:border-primary/50 transition-all cursor-pointer relative flex flex-col justify-between min-h-[220px] shadow-xs group ${
                      isChecked ? 'border-primary bg-primary/5' : 'border-[var(--border-color)]'
                    }`}
                    onClick={() => handleViewDetail(item, 'resumen')}
                  >
                    {/* Top Row: Checkbox, Status & Action Dropdown */}
                    <div className="flex items-start justify-between" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={(e) => toggleSelection(item.id, e)}
                          className="rounded border-[var(--border-color)] text-primary cursor-pointer w-4 h-4"
                        />
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border tracking-wider ${
                          item.status === 'Activo' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400' 
                            : item.status === 'Invitado' || item.status === 'Pendiente de activación'
                            ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400'
                            : item.status === 'Bloqueado'
                            ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-primary/10 dark:text-primary'
                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      
                      <div className="relative">
                        <button 
                          className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-color)] rounded-lg transition-colors"
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(isDropdownOpen ? null : item.id); }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {isDropdownOpen && (
                          <div className="absolute right-0 top-6 w-52 bg-[var(--bg-elevated)] rounded-lg shadow-xl border border-[var(--border-color)] py-1.5 z-50 text-left">
                            {renderDropdownItems(item)}
                          </div>
                        )}
                      </div>
                    </div>
  
                    {/* Middle Row: Avatar and User Details */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {item.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[var(--text-primary)] truncate text-[13px]">{item.full_name}</span>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-1 flex flex-col gap-0.5">
                           <span className="flex items-center gap-1"><Mail size={10} /> {item.email || '—'}</span>
                           <span className="flex items-center gap-1"><Phone size={10} /> {item.phone || '—'}</span>
                        </div>
                      </div>
                    </div>
  
                    {/* Meta Section: Role & User Type & Company */}
                    <div className="flex flex-col gap-1 border-t border-[var(--border-color)] pt-2 text-[11px]">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[var(--text-muted)] font-semibold">Rol:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold truncate ${
                            item.role.includes('Administrador') || item.role.includes('CISO')
                              ? 'bg-rose-50 text-rose-700 dark:bg-primary/10 dark:text-primary'
                              : item.role.includes('Supervisor')
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10'
                              : 'bg-slate-50 text-slate-700 dark:bg-slate-800'
                          }`}>{item.role}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[var(--text-muted)] font-semibold">Tipo:</span>
                          <span className="font-semibold text-[var(--text-secondary)] truncate">{item.user_type}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[var(--text-muted)] font-semibold">Empresa: <span className="text-red-500">*</span></span>
                        <span className="font-semibold text-[var(--text-secondary)] truncate max-w-[150px]">
                          {company?.name || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[var(--text-muted)] font-semibold">Activación:</span>
                        <span className="truncate">
                          {renderActivationBadge(item.estado_activacion, item.primary_access_type, item)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl px-4 py-3 flex items-center justify-between select-none text-[12px] font-semibold text-[var(--text-secondary)] shadow-sm shrink-0 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Filas por página:</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(parseInt(e.target.value) || 5);
                setCurrentPage(1);
              }}
              className="bg-transparent text-[13px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          <div className="text-[var(--text-muted)] font-medium">
            Mostrando <strong className="text-[var(--text-primary)]">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedData.length)}</strong> de <strong className="text-[var(--text-primary)]">{sortedData.length}</strong> registros
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-bold transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Ant
            </button>
            <span className="px-3 py-1 bg-[var(--bg-color)] rounded text-[13px] font-bold text-[var(--text-primary)] font-mono border border-[var(--border-color)]">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= Math.ceil(sortedData.length / pageSize)}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(sortedData.length / pageSize)))}
              className="px-3 py-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-bold transition-colors flex items-center gap-1"
            >
              Sig <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
    )
    ) : (
      renderUserDetail()
    )}

      {/* ADVANCED FILTER MODAL (React Portal) */}
      {isFilterModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-[var(--bg-elevated)] rounded-xl shadow-2xl flex flex-col border border-[var(--border-color)] max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-color)]">
                <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                  <Filter size={18} className="text-primary animate-pulse" /> 
                  Filtros de Búsqueda
                </h3>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] rounded-lg transition-colors">
                   <X size={20} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Empresa / Consorcio</label>
                    <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todas">Todas las empresas</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Rol Principal</label>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todos">Todos los roles</option>
                      {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Tipo de Usuario</label>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todos">Todos los tipos</option>
                      {userTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Estado de Cuenta</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todos">Todos los estados</option>
                      <option value="Invitado">Invitado</option>
                      <option value="Pendiente de activación">Pendiente de activación</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">MFA (Autenticación Doble)</label>
                    <select value={mfaFilter} onChange={(e) => setMfaFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todos">Todos</option>
                      <option value="Habilitado">Habilitado</option>
                      <option value="Deshabilitado">Deshabilitado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Último Acceso</label>
                    <select value={lastAccessFilter} onChange={(e) => setLastAccessFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm">
                      <option value="Todos">Cualquier fecha</option>
                      <option value="Hoy">Hoy</option>
                      <option value="Semana">Esta semana</option>
                      <option value="Mes">Hace más de una semana</option>
                      <option value="Nunca">Nunca</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Estado de Activación</label>
                    <select value={activationFilter} onChange={(e) => setActivationFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer">
                      <option value="Todos">Todos los estados</option>
                      <option value="DRAFT">Borrador</option>
                      <option value="INVITATION_PENDING">Invitación pendiente de envío</option>
                      <option value="INVITATION_SENT">Invitación enviada</option>
                      <option value="INVITATION_OPENED">Invitación abierta</option>
                      <option value="REGISTRATION_COMPLETED">Registro completado</option>
                      <option value="FIRST_LOGIN_COMPLETED">Primer login realizado</option>
                      <option value="INVITATION_EXPIRED">Invitación expirada</option>
                      <option value="INVITATION_BOUNCED">Invitación rebotada</option>
                      <option value="CREDENTIALS_GENERATED">Credenciales generadas</option>
                      <option value="PENDING_FIRST_LOGIN">Pendiente de primer ingreso</option>
                      <option value="INITIAL_PASSWORD_CHANGED">PIN / contraseña cambiado</option>
                      <option value="ACCESS_BLOCKED">Acceso bloqueado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Método de Acceso</label>
                    <select value={accessMethodFilter} onChange={(e) => setAccessMethodFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer">
                      <option value="Todos">Todos los métodos</option>
                      <option value="EMAIL">Correo electrónico</option>
                      <option value="DOCUMENT">Documento de identidad</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Invitación Enviada</label>
                    <select value={invitationFilter} onChange={(e) => setInvitationFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer">
                      <option value="Todos">Todas</option>
                      <option value="Enviada">Invitación enviada</option>
                      <option value="NoEnviada">Invitación no enviada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Primer Login</label>
                    <select value={firstLoginFilter} onChange={(e) => setFirstLoginFilter(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer">
                      <option value="Todos">Todos</option>
                      <option value="Realizado">Primer login realizado</option>
                      <option value="NoRealizado">Primer login no realizado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Departamento</label>
                    <select 
                      value={deptFilter} 
                      onChange={(e) => {
                        setDeptFilter(e.target.value);
                        setAreaFilter('Todos');
                      }} 
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer"
                    >
                      <option value="Todos">Todos los departamentos</option>
                      {departments.filter(d => companyFilter === 'Todas' || d.company_id === companyFilter).map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({companies.find(c => c.id === d.company_id)?.name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Área</label>
                    <select 
                      value={areaFilter} 
                      onChange={(e) => setAreaFilter(e.target.value)} 
                      disabled={deptFilter === 'Todos'}
                      className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary shadow-sm cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      <option value="Todos">Todas las áreas</option>
                      {areas.filter(a => a.department_id === deptFilter).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
             </div>
             
             <div className="p-4 md:p-6 border-t border-[var(--border-color)] bg-[var(--bg-color)] shrink-0 flex justify-between gap-3">
                <button type="button" onClick={() => { handleClearFilters(); setIsFilterModalOpen(false); }} className="px-4 py-2.5 rounded-lg border border-[var(--border-color)] text-[13px] font-bold hover:bg-[var(--border-color)] transition-colors">Limpiar Filtros</button>
                <button onClick={() => setIsFilterModalOpen(false)} className="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed text-on-primary text-[13px] font-bold flex items-center justify-center flex-1 shadow-md">
                  Aplicar Filtros
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE / EDIT WIZARD (React Portal Drawer) */}
      {isCreating && wizardData && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCancel}></div>
          <div className="relative w-full max-w-5xl md:max-w-6xl bg-[var(--bg-elevated)] max-h-[90vh] md:max-h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-[var(--border-color)] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Wizard Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-[var(--border-color)] bg-[var(--bg-elevated)] shrink-0 sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-[var(--text-primary)]">
                    {isCreating ? 'Nuevo usuario' : `Modificar usuario: ${wizardData.full_name}`}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                    {isCreating ? 'Crea un usuario definiendo su identidad, acceso, empresa, rol, alcance operativo y seguridad.' : `ID de Cuenta: ${wizardData.id}`}
                  </p>
                </div>
              </div>
              <button onClick={handleCancel} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-color)] rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Split Layout Body Container */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left Sidebar (Stepper) */}
              <div className="hidden md:flex flex-col w-72 shrink-0 bg-[var(--bg-color)]/20 border-r border-[var(--border-color)] p-6 justify-between overflow-y-auto">
                <div className="space-y-8">
                  {/* Context Header */}
                  <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--border-color)]">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/25">
                      <Shield size={16} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)]">Suivi Seguridad</h4>
                      <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">Asistente de Usuarios</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="relative pl-1">
                    {/* Line connecting circles */}
                    <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-[var(--border-color)] z-0"></div>

                    <div className="space-y-6 relative z-10">
                      {[
                        { step: 1, label: 'Identidad', desc: 'Datos personales e identificación' },
                        { step: 2, label: 'Empresa y Rol', desc: 'Asociación y configuración RBAC' },
                        { step: 3, label: 'Acceso', desc: 'Credenciales y habilitación de canales' },
                        { step: 4, label: 'Alcance', desc: 'Delimitación de red y visibilidad' },
                        { step: 5, label: 'Seguridad', desc: 'Autenticación, IPs y políticas' },
                        { step: 6, label: 'Confirmación', desc: 'Resumen de gobernanza de cuenta' }
                      ].map(s => {
                        const isActive = currentStep === s.step;
                        const isCompleted = currentStep > s.step;
                        return (
                          <button
                            key={s.step}
                            type="button"
                            onClick={() => {
                              if (isCompleted || s.step < currentStep) {
                                setCurrentStep(s.step);
                              }
                            }}
                            disabled={!(isCompleted || s.step < currentStep)}
                            className="w-full text-left flex items-start gap-3.5 group transition-all duration-200 outline-none disabled:cursor-default"
                          >
                            <div 
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-[11px] font-black transition-all duration-300 ${
                                isActive 
                                  ? 'border-primary bg-primary text-on-primary shadow-md shadow-primary/20 scale-105 ring-4 ring-primary/15' 
                                  : isCompleted 
                                  ? 'border-emerald-500 bg-emerald-500 text-white' 
                                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)] group-hover:border-[var(--text-secondary)]'
                              }`}
                            >
                              {isCompleted ? <Check size={12} strokeWidth={3.5} /> : s.step}
                            </div>
                            <div className="flex flex-col">
                              <span 
                                className={`text-[12px] font-bold transition-colors duration-200 ${
                                  isActive 
                                    ? 'text-primary font-extrabold' 
                                    : isCompleted 
                                    ? 'text-[var(--text-primary)] font-semibold' 
                                    : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {s.label}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug font-medium max-w-[185px]">
                                {s.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[10px] text-[var(--text-muted)] space-y-1.5 leading-relaxed shadow-sm mt-8">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--text-secondary)]">
                    <Info size={12} className="text-primary" />
                    <span>Directiva de Seguridad</span>
                  </div>
                  <p>Las credenciales e invitaciones expiran a los 7 días. La bitácora registra cada asignación de alcance de red de forma permanente.</p>
                </div>
              </div>

              {/* Right Panel (Content Form + Footer) */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-elevated)]">
                {/* Mobile Stepper Header */}
                <div className="md:hidden bg-[var(--bg-color)] px-5 py-3 border-b border-[var(--border-color)] flex flex-col gap-2 shrink-0 select-none">
                  <div className="flex justify-between items-center text-[11px] font-bold text-[var(--text-muted)]">
                    <span>PASO {currentStep} DE 6</span>
                    <span className="text-primary tracking-wide font-black uppercase">
                      {[
                        'Identidad',
                        'Empresa y Rol',
                        'Acceso',
                        'Alcance',
                        'Seguridad',
                        'Confirmación'
                      ][currentStep - 1]}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${(currentStep / 6) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Form Scroll Container */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar text-xs">
              {formError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 font-bold shadow-sm animate-shake">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: IDENTIDAD */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                    1. Información de Identidad del Usuario
                  </h4>

                  {/* Datos Personales */}
                  <div className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-xl space-y-4 shadow-sm animate-in slide-in-from-top-1.5 duration-200">
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <div className="w-1 h-3 bg-primary/55 rounded-full"></div>
                      Datos Personales
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Nombre *</label>
                        <input 
                          type="text" 
                          required
                          value={wizardData.first_name || ''} 
                          onChange={(e) => handleChange('first_name', e.target.value)} 
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.first_name ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          placeholder="Ej. Juan"
                        />
                        {fieldErrors.first_name && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.first_name}</span>}
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Apellido *</label>
                        <input 
                          type="text" 
                          required
                          value={wizardData.last_name || ''} 
                          onChange={(e) => handleChange('last_name', e.target.value)} 
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.last_name ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          placeholder="Ej. Pérez"
                        />
                        {fieldErrors.last_name && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.last_name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Datos Adicionales y de Contacto */}
                  <div className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-xl space-y-4 shadow-sm">
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <div className="w-1 h-3 bg-primary/55 rounded-full"></div>
                      Datos Adicionales y de Contacto
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Tipo de Documento (Opcional)</label>
                        <select 
                          value={wizardData.document_type || 'Cédula'} 
                          onChange={(e) => handleChange('document_type', e.target.value)} 
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="Cédula">Cédula</option>
                          <option value="Pasaporte">Pasaporte</option>
                          <option value="RNC">RNC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Número de Documento (Opcional)</label>
                        <input 
                          type="text" 
                          value={wizardData.document_number || ''} 
                          onChange={(e) => handleChange('document_number', e.target.value)} 
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.document_number ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          placeholder="Ej. 001-1234567-8"
                        />
                        {fieldErrors.document_number && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.document_number}</span>}
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Teléfono (Opcional)</label>
                        <input 
                          type="text" 
                          value={wizardData.phone || ''} 
                          onChange={(e) => handleChange('phone', e.target.value)} 
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary" 
                          placeholder="Ej. +1 (809) 555-0101"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Correo Electrónico *</label>
                      <input 
                        type="email" 
                        value={wizardData.email || ''} 
                        onChange={(e) => handleChange('email', e.target.value)} 
                        className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.email ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                        placeholder="Ej. juan.perez@empresa.com"
                      />
                      {fieldErrors.email && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.email}</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--border-color)]/50 pt-4">
                      <div className="relative job-dropdown-container">
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Cargo / Posición</label>
                        <select
                          value={wizardData.cargo_id || ''}
                          onChange={(e) => {
                            const cId = e.target.value;
                            const cargoObj = cargos.find(c => c.id == cId);
                            handleChange('cargo_id', cId);
                            handleChange('job_title', cargoObj ? cargoObj.name : '');
                          }}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
                        >
                          <option value="">Buscar o escribir cargo...</option>
                          {cargos.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Empresa / Consorcio *</label>
                        <select
                          value={wizardData.companyId || ''}
                          onChange={(e) => handleChange('companyId', e.target.value)}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.companyId ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="">-- Selecciona Empresa --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {fieldErrors.companyId && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.companyId}</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Departamento *</label>
                        <select
                          value={wizardData.department_id || ''}
                          onChange={(e) => {
                            const dId = e.target.value;
                            const depObj = departments.find(d => d.id == dId);
                            handleChange('department_id', dId);
                            handleChange('department', depObj ? depObj.name : '');
                            handleChange('area_id', '');
                            handleChange('area', '');
                          }}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.department_id ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="">-- Selecciona Departamento --</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        {fieldErrors.department_id && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.department_id}</span>}
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Área</label>
                        <select
                          value={wizardData.area_id || ''}
                          onChange={(e) => {
                            const aId = e.target.value;
                            const arObj = areas.find(a => a.id == aId);
                            handleChange('area_id', aId);
                            handleChange('area', arObj ? arObj.name : '');
                          }}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
                          disabled={!wizardData.department_id}
                        >
                          <option value="">-- Selecciona Área --</option>
                          {areas
                            .filter(a => a.department_id == wizardData.department_id)
                            .map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Empresa y Rol */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                    2. Configuración de Empresa y Perfil
                  </h4>

                  {/* Empresa y Tipo de Perfil */}
                  <div className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-xl space-y-4 shadow-sm animate-in slide-in-from-top-1.5 duration-200">
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <div className="w-1 h-3 bg-primary/55 rounded-full"></div>
                      Empresa y Tipo de Perfil
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Empresa / Consorcio *</label>
                        <select
                          value={wizardData.companyId || ''}
                          onChange={(e) => handleChange('companyId', e.target.value)}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.companyId ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="">-- Selecciona Empresa --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {fieldErrors.companyId && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.companyId}</span>}
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Tipo de Usuario *</label>
                        <select
                          value={wizardData.tipo_usuario_id || ''}
                          onChange={(e) => {
                            const valId = e.target.value;
                            handleChange('tipo_usuario_id', valId);
                            const obj = userTypes.find(t => t.id == valId);
                            if (obj) handleChange('user_type', obj.name);
                          }}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.tipo_usuario_id ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="">-- Selecciona Tipo --</option>
                          {userTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {fieldErrors.tipo_usuario_id && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.tipo_usuario_id}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Rol y Método de Acceso Principal */}
                  <div className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-xl space-y-4 shadow-sm animate-in slide-in-from-top-1.5 duration-200" style={{animationDelay: '50ms'}}>
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <div className="w-1 h-3 bg-primary/55 rounded-full"></div>
                      Rol y Método de Acceso Principal
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Rol Principal *</label>
                        <select
                          value={wizardData.rol_id || ''}
                          onChange={(e) => {
                            const rId = e.target.value;
                            handleChange('rol_id', rId);
                            const rolObj = roles.find(r => r.id == rId);
                            if (rolObj) handleChange('role', rolObj.name);
                          }}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.rol_id ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="">-- Selecciona Rol --</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        {fieldErrors.rol_id && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.rol_id}</span>}
                      </div>
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Método de Acceso Principal *</label>
                        <select
                          value={wizardData.primary_access_type || 'EMAIL'}
                          onChange={(e) => handleChange('primary_access_type', e.target.value)}
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.primary_access_type ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                        >
                          <option value="EMAIL">Correo electrónico</option>
                          <option value="DOCUMENT">Documento de identidad</option>
                        </select>
                        {fieldErrors.primary_access_type && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.primary_access_type}</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-indigo-50/50 text-indigo-700 text-[11px] rounded-lg border border-indigo-100 font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      <span>
                        <strong>Acceso sugerido: {wizardData.primary_access_type === 'DOCUMENT' ? 'Documento de identidad' : 'Correo electrónico'}.</strong> Recomendado para usuarios corporativos, administrativos, supervisores, operadores, analistas y auditores.
                      </span>
                    </div>
                  </div>

                  {/* Roles Adicionales */}
                  <div className="space-y-3">
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide text-[11px]">Roles Adicionales (Opcional)</label>
                    <div className="flex flex-wrap gap-2 p-4 border border-[var(--border-color)] rounded-xl bg-[var(--bg-color)]/30">
                      {roles.filter(r => r.id != wizardData.rol_id).map(r => (
                        <button
                          key={r.id}
                          onClick={(e) => {
                            e.preventDefault();
                            const newRoles = (wizardData.roles_additional || []).includes(r.id)
                              ? (wizardData.roles_additional || []).filter(roleId => roleId !== r.id)
                              : [...(wizardData.roles_additional || []), r.id];
                            handleChange('roles_additional', newRoles);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors ${
                            (wizardData.roles_additional || []).includes(r.id)
                              ? 'bg-rose-50 border-rose-200 text-primary-fixed'
                              : 'bg-white border-[var(--border-color)] text-[var(--text-secondary)] hover:border-rose-300 hover:text-primary-fixed'
                          }`}
                        >
                          <span className="text-[14px]">{(wizardData.roles_additional || []).includes(r.id) ? '✓' : '+'}</span>
                          {r.name}
                        </button>
                      ))}
                      {roles.filter(r => r.id != wizardData.rol_id).length === 0 && (
                        <span className="text-[12px] text-[var(--text-muted)] italic">No hay más roles disponibles para asignar.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Acceso y Credenciales */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                    3. Configuración de Acceso y Credenciales
                  </h4>

                  <div className="bg-[var(--bg-color)]/30 border border-[var(--border-color)] p-5 rounded-xl space-y-5 shadow-sm animate-in slide-in-from-top-1.5 duration-200">
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <div className="w-1 h-3 bg-primary/55 rounded-full"></div>
                      Credenciales de Acceso por {wizardData.primary_access_type === 'DOCUMENT' ? 'Documento' : 'Correo'}
                    </h5>
                    
                    {wizardData.primary_access_type === 'EMAIL' ? (
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Correo Electrónico *</label>
                        <input 
                          type="email" 
                          value={wizardData.email || ''} 
                          onChange={(e) => handleChange('email', e.target.value)} 
                          className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.email ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          placeholder="Ej. juan.perez@empresa.com"
                        />
                        {fieldErrors.email && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.email}</span>}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Tipo de Documento *</label>
                          <select 
                            value={wizardData.document_type || 'Cédula'} 
                            onChange={(e) => handleChange('document_type', e.target.value)} 
                            className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.document_type ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`}
                          >
                            <option value="Cédula">Cédula</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="RNC">RNC</option>
                          </select>
                          {fieldErrors.document_type && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.document_type}</span>}
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Número de Documento *</label>
                          <input 
                            type="text" 
                            value={wizardData.document_number || ''} 
                            onChange={(e) => handleChange('document_number', e.target.value)} 
                            className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.document_number ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                            placeholder="Ej. 001-1234567-8"
                          />
                          {fieldErrors.document_number && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.document_number}</span>}
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Teléfono *</label>
                          <input 
                            type="text" 
                            value={wizardData.phone || ''} 
                            onChange={(e) => handleChange('phone', e.target.value)} 
                            className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.phone ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                            placeholder="Ej. +1 (809) 555-0101"
                          />
                          {fieldErrors.phone && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.phone}</span>}
                        </div>
                      </div>
                    )}
                    
                    {!wizardData.auto_generate_password && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in zoom-in-95 duration-200">
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Contraseña Temporal *</label>
                          <input 
                            type="password" 
                            value={wizardData.password || ''} 
                            onChange={(e) => handleChange('password', e.target.value)} 
                            className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.password ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          />
                          {fieldErrors.password && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.password}</span>}
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Confirmar Contraseña *</label>
                          <input 
                            type="password" 
                            value={wizardData.confirm_password || ''} 
                            onChange={(e) => handleChange('confirm_password', e.target.value)} 
                            className={`w-full bg-[var(--bg-color)] border rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none ${fieldErrors.confirm_password ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-[var(--border-color)] focus:border-primary'}`} 
                          />
                          {fieldErrors.confirm_password && <span className="text-red-500 text-[10px] mt-1 font-semibold block">{fieldErrors.confirm_password}</span>}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-4 border-t border-[var(--border-color)]/50 pt-4">
                      {wizardData.primary_access_type === 'EMAIL' && (
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)] text-[12px] group-hover:text-primary-fixed transition-colors">Enviar invitación por correo electrónico</span>
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">Recomendado</span>
                          </div>
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${wizardData.send_invitation ? 'bg-primary' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${wizardData.send_invitation ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                          <input type="checkbox" className="hidden" checked={!!wizardData.send_invitation} onChange={(e) => handleChange('send_invitation', e.target.checked)} />
                        </label>
                      )}
                      
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-primary)] text-[12px] group-hover:text-primary-fixed transition-colors">Generar contraseña automáticamente</span>
                        </div>
                        <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${wizardData.auto_generate_password ? 'bg-primary' : 'bg-gray-300'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${wizardData.auto_generate_password ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" className="hidden" checked={!!wizardData.auto_generate_password} onChange={(e) => handleChange('auto_generate_password', e.target.checked)} />
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer mt-2 group w-fit">
                        <input type="checkbox" checked={!!wizardData.must_change_password} onChange={(e) => handleChange('must_change_password', e.target.checked)} className="rounded text-blue-600 w-4 h-4 focus:ring-blue-500 border-gray-300" />
                        <span className="font-bold text-[var(--text-primary)] text-[12px] group-hover:text-blue-700 transition-colors">Forzar cambio de contraseña al primer ingreso</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-[var(--border-color)] rounded-xl p-5 bg-[var(--bg-color)]/30 shadow-sm animate-in slide-in-from-top-1.5 duration-200" style={{animationDelay: '50ms'}}>
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Idioma Preferido</label>
                      <select value={wizardData.preferred_language || 'es'} onChange={(e) => handleChange('preferred_language', e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary">
                        <option value="es">Español (América Latina)</option>
                        <option value="en">Inglés (US)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Zona Horaria</label>
                      <select value={wizardData.timezone || 'America/Santo_Domingo'} onChange={(e) => handleChange('timezone', e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary">
                        <option value="America/Santo_Domingo">America/Santo_Domingo (GMT-4)</option>
                        <option value="America/New_York">America/New_York (GMT-4)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Formato de Fecha</label>
                      <select value={wizardData.date_format || 'DD/MM/YYYY'} onChange={(e) => handleChange('date_format', e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary">
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Alcance Operativo */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                    4. Alcance Operativo
                  </h4>

                  <div className="space-y-4">
                    <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide text-[11px]">Nivel de Alcance Operativo</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button 
                        type="button" 
                        onClick={() => { handleChange('scope_type', 'COMPANY'); handleChange('scope_entity_ids', []); handleChange('include_children', true); }}
                        className={`p-4 border rounded-xl text-left transition-all ${wizardData.scope_type === 'COMPANY' ? 'border-primary bg-rose-50 shadow-sm ring-1 ring-primary' : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-rose-300'}`}
                      >
                        <h6 className={`font-bold text-[12.5px] mb-1 ${wizardData.scope_type === 'COMPANY' ? 'text-rose-700' : 'text-[var(--text-primary)]'}`}>Toda la empresa</h6>
                        <p className={`text-[10.5px] leading-tight ${wizardData.scope_type === 'COMPANY' ? 'text-primary-fixed/80' : 'text-[var(--text-muted)]'}`}>Acceso total sin restricciones dentro de la empresa seleccionada.</p>
                      </button>
                      
                      <button 
                        type="button" 
                        onClick={() => { handleChange('scope_type', 'GROUPING'); handleChange('scope_entity_ids', []); }}
                        className={`p-4 border rounded-xl text-left transition-all ${wizardData.scope_type === 'GROUPING' ? 'border-primary bg-rose-50 shadow-sm ring-1 ring-primary' : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-rose-300'}`}
                      >
                        <h6 className={`font-bold text-[12.5px] mb-1 ${wizardData.scope_type === 'GROUPING' ? 'text-rose-700' : 'text-[var(--text-primary)]'}`}>Por agrupación</h6>
                        <p className={`text-[10.5px] leading-tight ${wizardData.scope_type === 'GROUPING' ? 'text-primary-fixed/80' : 'text-[var(--text-muted)]'}`}>Restringido a zonas, rutas, grupos u otras agrupaciones comerciales.</p>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => { handleChange('scope_type', 'AGENCY'); handleChange('scope_entity_ids', []); }}
                        className={`p-4 border rounded-xl text-left transition-all ${wizardData.scope_type === 'AGENCY' ? 'border-primary bg-rose-50 shadow-sm ring-1 ring-primary' : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-rose-300'}`}
                      >
                        <h6 className={`font-bold text-[12.5px] mb-1 ${wizardData.scope_type === 'AGENCY' ? 'text-rose-700' : 'text-[var(--text-primary)]'}`}>Por agencia</h6>
                        <p className={`text-[10.5px] leading-tight ${wizardData.scope_type === 'AGENCY' ? 'text-primary-fixed/80' : 'text-[var(--text-muted)]'}`}>Restringido a agencias específicas.</p>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => { handleChange('scope_type', 'TERRITORY'); handleChange('scope_entity_ids', []); }}
                        className={`p-4 border rounded-xl text-left transition-all ${wizardData.scope_type === 'TERRITORY' ? 'border-primary bg-rose-50 shadow-sm ring-1 ring-primary' : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-rose-300'}`}
                      >
                        <h6 className={`font-bold text-[12.5px] mb-1 ${wizardData.scope_type === 'TERRITORY' ? 'text-rose-700' : 'text-[var(--text-primary)]'}`}>Por territorio</h6>
                        <p className={`text-[10.5px] leading-tight ${wizardData.scope_type === 'TERRITORY' ? 'text-primary-fixed/80' : 'text-[var(--text-muted)]'}`}>Restringido por división geográfica.</p>
                      </button>
                    </div>

                    {fieldErrors.scope_entity_ids && <span className="text-red-500 text-[11px] mt-1 font-bold block">{fieldErrors.scope_entity_ids}</span>}
                  </div>

                  {/* Conditional input panels based on selected scope type */}
                  {wizardData.scope_type === 'COMPANY' && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-in fade-in duration-200 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <div>
                          <h6 className="font-bold text-emerald-800 text-[12.5px]">Acceso Total Configurado</h6>
                          <p className="text-emerald-600/80 text-[11px] font-medium mt-0.5">
                            El usuario heredará visibilidad completa y podrá visualizar todas las agencias, supervisores y ventas de la empresa seleccionada.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardData.scope_type === 'GROUPING' && (
                    <div className="space-y-4 p-5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl animate-in fade-in duration-200 shadow-sm">
                      <label className="block font-bold text-[var(--text-primary)] text-[12px]">Seleccionar Agrupaciones Comerciales</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg">
                        {agrupaciones.map(group => {
                          const isSel = wizardData.scope_entity_ids?.includes(group.id);
                          return (
                            <label key={group.id} className="flex items-center gap-2 py-1.5 px-3 rounded hover:bg-[var(--bg-elevated)] cursor-pointer text-[12px]">
                              <input 
                                type="checkbox" 
                                checked={isSel || false}
                                onChange={() => {
                                  const updated = isSel 
                                    ? wizardData.scope_entity_ids.filter(x => x !== group.id) 
                                    : [...(wizardData.scope_entity_ids || []), group.id];
                                  handleChange('scope_entity_ids', updated);
                                }}
                                className="rounded text-primary w-3.5 h-3.5 focus:ring-primary border-gray-300"
                              />
                              <span className="font-semibold">{group.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center mt-2 border-t border-[var(--border-color)]/50 pt-4">
                        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)] select-none cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={!!wizardData.include_children}
                            onChange={(e) => handleChange('include_children', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-[var(--border-color)] bg-[var(--bg-elevated)]"
                          />
                          Incluir subagrupaciones y agencias heredadas de forma jerárquica
                        </label>
                      </div>
                    </div>
                  )}

                  {wizardData.scope_type === 'AGENCY' && (
                    <div className="space-y-4 p-5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl animate-in fade-in duration-200 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="block font-bold text-[var(--text-primary)] text-[12px]">Agencias Asociadas</label>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium block mt-0.5">
                            {wizardData.scope_entity_ids?.length || 0} agencias seleccionadas para el alcance de este usuario.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAgencySearchQuery('');
                            setAgencyZoneFilter('');
                            setIsAgencyModalOpen(true);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[11.5px] font-bold bg-primary text-on-primary hover:bg-primary-fixed text-on-primary rounded-lg transition-colors shadow-sm self-start sm:self-auto shrink-0"
                        >
                          <SlidersHorizontal size={13} />
                          Gestionar Agencias
                        </button>
                      </div>

                      <div className="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg min-h-[80px]">
                        {(!wizardData.scope_entity_ids || wizardData.scope_entity_ids.length === 0) ? (
                          <div className="text-center py-6 text-[11px] text-[var(--text-muted)] italic">
                            Ninguna agencia seleccionada. Haz clic en "Gestionar Agencias" para buscarlas e incorporarlas a la lista.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                            {wizardData.scope_entity_ids.map(code => {
                              const ag = agencias.find(a => a.id === code);
                              return (
                                <div
                                  key={code}
                                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-primary-fixed"
                                >
                                  <span>{ag ? ag.name : code}</span>
                                  <span className="text-[9px] font-mono opacity-75">({ag ? ag.code : code})</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = wizardData.scope_entity_ids.filter(x => x !== code);
                                      handleChange('scope_entity_ids', updated);
                                    }}
                                    className="p-0.5 hover:bg-rose-200 rounded-md transition-colors text-rose-700"
                                  >
                                    <X size={12} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {wizardData.scope_type === 'TERRITORY' && (
                    <div className="space-y-4 p-5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl animate-in fade-in duration-200 shadow-sm">
                      <label className="block font-bold text-[var(--text-primary)] text-[12px]">Configurar Delimitación Geográfica (Territorios)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">País</label>
                          <select
                            value={wizardData.scope_pais || ''}
                            onChange={(e) => {
                              handleChange('scope_pais', e.target.value);
                              handleChange('scope_region', '');
                              handleChange('scope_provincia', '');
                              handleChange('scope_municipio', '');
                              handleChange('scope_distrito', '');
                              handleChange('scope_sector', '');
                            }}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary"
                          >
                            <option value="">-- Selecciona país --</option>
                            {paises.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">Región</label>
                          <select
                            value={wizardData.scope_region || ''}
                            disabled={!wizardData.scope_pais}
                            onChange={(e) => {
                              handleChange('scope_region', e.target.value);
                              handleChange('scope_provincia', '');
                              handleChange('scope_municipio', '');
                              handleChange('scope_distrito', '');
                              handleChange('scope_sector', '');
                            }}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Todas las regiones --</option>
                            {regiones.filter(r => r.pais_id === Number(wizardData.scope_pais)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">Provincia / Distrito Nacional *</label>
                          <select
                            value={wizardData.scope_provincia || ''}
                            disabled={!wizardData.scope_region}
                            onChange={(e) => {
                              handleChange('scope_provincia', e.target.value);
                              handleChange('scope_municipio', '');
                              handleChange('scope_distrito', '');
                              handleChange('scope_sector', '');
                            }}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Selecciona provincia / DN --</option>
                            {provincias.filter(p => p.region_id === Number(wizardData.scope_region)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">Municipio</label>
                          <select
                            value={wizardData.scope_municipio || ''}
                            disabled={!wizardData.scope_provincia}
                            onChange={(e) => {
                              handleChange('scope_municipio', e.target.value);
                              handleChange('scope_distrito', '');
                              handleChange('scope_sector', '');
                            }}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Selecciona municipio --</option>
                            {municipios.filter(m => m.provincia_id === Number(wizardData.scope_provincia)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">Distrito Municipal</label>
                          <select
                            value={wizardData.scope_distrito || ''}
                            disabled={!wizardData.scope_municipio}
                            onChange={(e) => {
                              handleChange('scope_distrito', e.target.value);
                              handleChange('scope_sector', '');
                            }}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Selecciona distrito municipal --</option>
                            {distritos.filter(d => d.municipio_id === Number(wizardData.scope_municipio)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-[var(--text-muted)] text-[11px] mb-1">Sector / Barrio</label>
                          <select
                            value={wizardData.scope_sector || ''}
                            disabled={!wizardData.scope_municipio}
                            onChange={(e) => handleChange('scope_sector', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Selecciona sector --</option>
                            {sectores.filter(s => {
                              if (wizardData.scope_distrito) {
                                return s.distrito_municipal_id === Number(wizardData.scope_distrito);
                              }
                              return s.municipio_id === Number(wizardData.scope_municipio);
                            }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            let type = null;
                            let id = null;
                            if (wizardData.scope_sector) { type = 'SECTOR'; id = wizardData.scope_sector; }
                            else if (wizardData.scope_distrito) { type = 'DISTRITO'; id = wizardData.scope_distrito; }
                            else if (wizardData.scope_municipio) { type = 'MUNICIPIO'; id = wizardData.scope_municipio; }
                            else if (wizardData.scope_provincia) { type = 'PROVINCIA'; id = wizardData.scope_provincia; }
                            else if (wizardData.scope_region) { type = 'REGION'; id = wizardData.scope_region; }
                            else if (wizardData.scope_pais) { type = 'PAIS'; id = wizardData.scope_pais; }

                            if (type && id) {
                              const token = `${type}_${id}`;
                              const existing = wizardData.scope_entity_ids || [];
                              if (!existing.includes(token)) {
                                handleChange('scope_entity_ids', [...existing, token]);
                              }
                            }
                          }}
                          disabled={!wizardData.scope_pais}
                          className="px-4 py-1.5 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary text-[11.5px] font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          Añadir a la lista
                        </button>
                      </div>

                      <div className="mt-4 p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg min-h-[70px]">
                        {(!wizardData.scope_entity_ids || wizardData.scope_entity_ids.length === 0) ? (
                          <div className="text-center py-4 text-[11px] text-[var(--text-muted)] italic">
                            Ningún territorio seleccionado. Selecciona zonas en los filtros superiores y añádelas a la lista.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                            {wizardData.scope_entity_ids.map(id => {
                              let type = 'SECTOR';
                              let val = id;
                              if (typeof id === 'string' && id.includes('_')) {
                                [type, val] = id.split('_');
                              }
                              val = Number(val);
                              let name = String(val);
                              if (type === 'PAIS') name = paises.find(x => x.id === val)?.name || name;
                              if (type === 'REGION') name = regiones.find(x => x.id === val)?.name || name;
                              if (type === 'PROVINCIA') name = provincias.find(x => x.id === val)?.name || name;
                              if (type === 'MUNICIPIO') name = municipios.find(x => x.id === val)?.name || name;
                              if (type === 'DISTRITO') name = distritos.find(x => x.id === val)?.name || name;
                              if (type === 'SECTOR') name = sectores.find(x => x.id === val)?.name || name;

                              return (
                                <div
                                  key={id}
                                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-primary-fixed"
                                >
                                  <span>[{type}] {name}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = wizardData.scope_entity_ids.filter(x => x !== id);
                                      handleChange('scope_entity_ids', updated);
                                    }}
                                    className="p-1 hover:bg-rose-200 rounded-md transition-colors text-rose-700"
                                  >
                                    <X size={12} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Acciones permitidas dentro del alcance */}
                  <div className="bg-[var(--bg-color)]/30 p-5 rounded-xl border border-[var(--border-color)] space-y-3 shadow-sm">
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 text-[11px]">Acciones Permitidas dentro del Alcance</label>
                      <span className="text-[11px] text-[var(--text-muted)] font-medium block mt-0.5">
                        Estas acciones solo aplican dentro del alcance seleccionado.
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] p-4 rounded-xl">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-[12px]">
                        <input 
                          type="checkbox" 
                          checked={!!wizardData.can_view} 
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleChange('can_view', checked);
                            if (!checked) {
                              handleChange('can_edit', false);
                              handleChange('can_export', false);
                              handleChange('can_assign', false);
                            }
                          }} 
                          className="rounded text-blue-600 w-3.5 h-3.5 focus:ring-blue-500 border-gray-300" 
                        />
                        <span>Ver datos analíticos</span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer font-semibold text-[12px] ${!wizardData.can_view ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={wizardData.can_view && !!wizardData.can_edit} 
                          disabled={!wizardData.can_view} 
                          onChange={(e) => handleChange('can_edit', e.target.checked)} 
                          className="rounded text-blue-600 w-3.5 h-3.5 disabled:opacity-40 focus:ring-blue-500 border-gray-300" 
                        />
                        <span>Editar registros</span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer font-semibold text-[12px] ${!wizardData.can_view ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={wizardData.can_view && !!wizardData.can_export} 
                          disabled={!wizardData.can_view} 
                          onChange={(e) => handleChange('can_export', e.target.checked)} 
                          className="rounded text-blue-600 w-3.5 h-3.5 disabled:opacity-40 focus:ring-blue-500 border-gray-300" 
                        />
                        <span>Exportar reportes</span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer font-semibold text-[12px] ${!wizardData.can_view ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={wizardData.can_view && !!wizardData.can_assign} 
                          disabled={!wizardData.can_view} 
                          onChange={(e) => handleChange('can_assign', e.target.checked)} 
                          className="rounded text-blue-600 w-3.5 h-3.5 disabled:opacity-40 focus:ring-blue-500 border-gray-300" 
                        />
                        <span>Asignar / mover agencias</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Seguridad (Auth, IPs y políticas) */}
              {currentStep === 5 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                    5. Políticas de Seguridad y Accesos
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Cerrar Sesión por Inactividad (Minutos)</label>
                      <select value={wizardData.inactivity_timeout_minutes ?? 0} onChange={(e) => handleChange('inactivity_timeout_minutes', parseInt(e.target.value))} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary">
                        <option value={0}>No aplicar</option>
                        <option value={15}>15 minutos</option>
                        <option value={30}>30 minutos</option>
                        <option value={60}>60 minutos</option>
                        <option value={120}>120 minutos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Bloquear Cuenta por Intentos Fallidos</label>
                      <select value={wizardData.max_failed_attempts ?? 10} onChange={(e) => handleChange('max_failed_attempts', parseInt(e.target.value))} className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary">
                        <option value={3}>Bloquear al tercer intento fallido</option>
                        <option value={5}>Bloquear al quinto intento fallido</option>
                        <option value={10}>Bloquear al décimo intento fallido</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                      <input type="checkbox" checked={wizardData.require_export_approval || false} onChange={(e) => handleChange('require_export_approval', e.target.checked)} className="rounded text-primary" />
                      <span>Exigir aprobación para exportaciones de datos sensibles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                      <input type="checkbox" checked={wizardData.require_dual_validation || false} onChange={(e) => handleChange('require_dual_validation', e.target.checked)} className="rounded text-primary" />
                      <span>Exigir doble validación (Dual control) para cambios críticos</span>
                    </label>
                  </div>

                  {/* Sensitive permissions badge alert */}
                  {(wizardData.require_dual_validation || wizardData.role === 'Administrador General') && (
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-primary-fixed bg-primary/5 px-3 py-2 rounded-lg border border-rose-200/50">
                      <ShieldAlert size={14} className="animate-bounce" />
                      <span>Atención: Este perfil cuenta con "Permisos Sensibles" activados. Se forzará una auditoría de firma criptográfica.</span>
                    </div>
                  )}

                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] mt-4 space-y-4">
                    <h5 className="font-extrabold text-[12px] text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)]/50 pb-2">
                      <Settings size={14} className="text-primary" /> Configuración Avanzada
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Correo de Recuperación (Opcional)</label>
                        <input type="email" value={wizardData.correo_acceso || ''} onChange={(e) => handleChange('correo_acceso', e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-primary" placeholder="Ej. admin@miempresa.com" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: CONFIRMACION */}
              {currentStep === 6 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="border-b border-[var(--border-color)] pb-3">
                    <h4 className="text-[13px] font-black text-[var(--text-primary)] flex items-center gap-2">
                      <div className="w-1.5 h-3.5 bg-primary rounded-full"></div>
                      6. Confirmación del Usuario
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1 pl-3.5">
                      Revisa la identidad, acceso, rol, alcance y seguridad antes de crear la cuenta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block 1 */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-2.5">
                      <h5 className="font-extrabold text-[var(--text-primary)] text-[12px] flex items-center gap-2 border-b border-[var(--border-color)] pb-1.5">
                        <Users size={14} className="text-primary" /> Identidad
                      </h5>
                      <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                        <span className="text-[var(--text-muted)] font-semibold">Nombre: <span className="text-red-500">*</span></span>
                        <span className="font-bold text-[var(--text-primary)]">{wizardData.full_name}</span>
                        <span className="text-[var(--text-muted)] font-semibold">Correo:</span>
                        <span className="font-semibold">{wizardData.email || '—'}</span>
                        <span className="text-[var(--text-muted)] font-semibold">Documento:</span>
                        <span className="font-semibold">
                          {wizardData.document_number ? `${wizardData.document_type}: ${wizardData.document_number}` : 'Documento: No registrado'}
                        </span>
                        <span className="text-[var(--text-muted)] font-semibold">Posición:</span>
                        <span className="font-semibold">{wizardData.job_title || '—'} ({wizardData.department || '—'}{wizardData.area ? ` / ${wizardData.area}` : ''})</span>
                      </div>
                    </div>

                    {/* Block 2 */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-2.5">
                      <h5 className="font-extrabold text-[var(--text-primary)] text-[12px] flex items-center gap-2 border-b border-[var(--border-color)] pb-1.5">
                        <Key size={14} className="text-primary" /> Acceso
                      </h5>
                      <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                        <span className="text-[var(--text-muted)] font-semibold">Tipo de Acceso:</span>
                        <span className="font-semibold">{wizardData.primary_access_type === 'DOCUMENT' ? 'Documento de identidad' : 'Correo electrónico'}</span>
                        <span className="text-[var(--text-muted)] font-semibold">Identificador de acceso:</span>
                        <span className="font-mono font-bold text-indigo-500">
                          {wizardData.primary_access_type === 'DOCUMENT' ? wizardData.document_number : (wizardData.identificador_principal || wizardData.email)}
                        </span>
                        <span className="text-[var(--text-muted)] font-semibold">Canal:</span>
                        <span className="font-semibold">
                          {wizardData.web_access_enabled && 'Web'} {wizardData.mobile_access_enabled && 'Móvil'}
                        </span>
                        <span className="text-[var(--text-muted)] font-semibold">Cambio clave:</span>
                        <span className="font-semibold">{wizardData.must_change_password ? 'Exigido al primer ingreso' : 'No exigido'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block 3 */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-2.5">
                      <h5 className="font-extrabold text-[var(--text-primary)] text-[12px] flex items-center gap-2 border-b border-[var(--border-color)] pb-1.5">
                        <Building2 size={14} className="text-primary" /> Empresa y Rol
                      </h5>
                      <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                        <span className="text-[var(--text-muted)] font-semibold">Empresa: <span className="text-red-500">*</span></span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {companies.find(c => c.id == wizardData.companyId)?.name || 'Loteka'}
                        </span>
                        <span className="text-[var(--text-muted)] font-semibold">Rol principal:</span>
                        <span className="font-bold text-primary">{wizardData.role}</span>
                        <span className="text-[var(--text-muted)] font-semibold">Permisos:</span>
                        <span className="font-semibold">
                          {Object.keys(wizardData.permissionsOverride || {}).length > 0 ? 'Específica (Permisos Adicionales)' : 'Heredados del rol'}
                        </span>
                      </div>
                    </div>

                    {/* Block 4 */}
                    <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-2.5">
                      <h5 className="font-extrabold text-[var(--text-primary)] text-[12px] flex items-center gap-2 border-b border-[var(--border-color)] pb-1.5">
                        <SlidersHorizontal size={14} className="text-primary" /> Alcance Operativo
                      </h5>
                      <div className="grid grid-cols-2 gap-y-2 text-[11.5px]">
                        <span className="text-[var(--text-muted)] font-semibold">Ámbito:</span>
                        <span className="font-bold text-primary">
                          {(() => {
                            switch (wizardData.scope_type) {
                              case 'COMPANY': return 'Toda la empresa';
                              case 'GROUPING': return 'Limitado por agrupación';
                              case 'ROUTE': return 'Limitado por ruta operativa';
                              case 'AGENCY': return 'Limitado por agencia';
                              case 'TERRITORY': return 'Limitado por territorio';
                              default: return wizardData.scope_type || 'Toda la empresa';
                            }
                          })()}
                        </span>
                        {wizardData.scope_type === 'COMPANY' ? (
                          <>
                            <span className="text-[var(--text-muted)] font-semibold">Elementos:</span>
                            <span className="truncate font-semibold">Toda la empresa</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[var(--text-muted)] font-semibold">
                              {wizardData.scope_type === 'GROUPING' && 'Agrupación asignada:'}
                              {wizardData.scope_type === 'ROUTE' && 'Ruta asignada:'}
                              {wizardData.scope_type === 'AGENCY' && 'Agencia asignada:'}
                              {wizardData.scope_type === 'TERRITORY' && 'Territorio asignado:'}
                            </span>
                            <span className="truncate font-semibold">
                              {(() => {
                                if (wizardData.scope_type === 'TERRITORY') {
                                  const parts = [];
                                  if (wizardData.scope_province) parts.push(wizardData.scope_province);
                                  if (wizardData.scope_municipality) parts.push(wizardData.scope_municipality);
                                  if (wizardData.scope_sector) parts.push(wizardData.scope_sector);
                                  return parts.length > 0 ? parts.join(' / ') : (wizardData.scope_entity_ids?.join(', ') || '—');
                                }
                                return wizardData.scope_entity_ids?.join(', ') || '—';
                              })()}
                            </span>
                          </>
                        )}
                        <span className="text-[var(--text-muted)] font-semibold">Heredado:</span>
                        <span className="font-semibold">{wizardData.include_children ? 'Sí, incluye hijos' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-color)] p-4 rounded-xl border border-[var(--border-color)] space-y-2.5">
                    <h5 className="font-extrabold text-[var(--text-primary)] text-[12px] flex items-center gap-2 border-b border-[var(--border-color)] pb-1.5">
                      <ShieldCheck size={14} className="text-primary" /> Seguridad
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11.5px]">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Doble Factor (MFA):</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">{wizardData.mfaEnabled ? `Sí (${wizardData.mfa_method})` : 'No'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Correo Recuperación:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5 truncate" title={wizardData.correo_acceso || '—'}>{wizardData.correo_acceso || '—'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Horario de acceso:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">
                          {!wizardData.allowed_hours || wizardData.allowed_hours === 'Cualquier horario' ? 'Sin restricción horaria' : wizardData.allowed_hours}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Restricción IP:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5 font-mono">
                          {!wizardData.allowed_ips || wizardData.allowed_ips === '*' ? 'Sin restricción' : wizardData.allowed_ips}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Inactividad:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">{wizardData.inactivity_timeout_minutes ? `${wizardData.inactivity_timeout_minutes} min` : 'No aplica'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Intentos Fallidos:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">{wizardData.max_failed_attempts ? `${wizardData.max_failed_attempts} intentos` : 'No aplica'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Exportaciones:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">{wizardData.require_export_approval ? 'Requiere aprobación' : 'Sin restricción'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Validación Crítica:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5">{wizardData.require_dual_validation ? 'Doble validación' : 'Normal'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-muted)] font-semibold">Estado Inicial:</span>
                        <div className="flex flex-col items-start gap-1 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/15">
                            Pendiente de activación
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">
                            Se enviará una invitación al correo del usuario.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div className="p-4 md:p-6 border-t border-[var(--border-color)] bg-[var(--bg-elevated)] flex justify-between gap-3 shrink-0 sticky bottom-0 z-10 shadow-sm">
              <button 
                type="button" 
                disabled={currentStep === 1}
                onClick={handlePrevStep}
                className="px-5 py-2.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-color)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                Volver
              </button>

              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-color)] font-semibold text-xs transition-colors">Cancelar</button>
                
                {currentStep < 6 ? (
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="px-6 py-2.5 rounded-lg bg-primary hover:bg-rose-650 text-on-primary font-bold flex items-center gap-1 shadow-sm text-xs"
                  >
                    Siguiente <ArrowRight size={14} />
                  </button>
                ) : (
                  <>
                    <button 
                      type="button" 
                      disabled={isSaving}
                      onClick={() => handleSaveUser(false)}
                      className="px-5 py-2.5 rounded-lg bg-slate-150 text-[var(--text-primary)] border border-slate-200 hover:bg-slate-200 font-bold text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Guardando...' : 'Guardar borrador'}
                    </button>
                    {wizardData.primary_access_type === 'EMAIL' && wizardData.send_invitation ? (
                      <button 
                        type="button" 
                        disabled={isSaving}
                        onClick={() => handleSaveUser(true)}
                        className="px-6 py-2.5 rounded-lg bg-primary hover:bg-rose-650 text-on-primary font-bold flex items-center gap-1 shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Guardando...' : 'Crear y enviar invitación'}
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        disabled={isSaving}
                        onClick={() => handleSaveUser(false)}
                        className="px-6 py-2.5 rounded-lg bg-primary hover:bg-rose-650 text-on-primary font-bold flex items-center gap-1 shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Guardando...' : 'Crear usuario'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}

      {/* MOTIVO ADMINISTRATIVO DIALOG (React Portal) */}
      {showReasonModal && reasonAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          
          <div className="relative w-full max-w-md bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border-color)] p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
              <ShieldAlert className="text-primary" size={20} />
              Justificación de Cambio Crítico
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Estás aplicando una modificación sobre una propiedad crítica IAM (Rol, Alcance o Estado). Se exige una justificación administrativa para archivar en los logs de auditoría.
            </p>

            <form onSubmit={handleReasonSubmit} className="mt-4 space-y-4">
              {reasonError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                  {reasonError}
                </div>
              )}
              
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 text-[10px]">Motivo / Explicación del cambio *</label>
                <textarea 
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Ej. Reestructuración de zonas comerciales de la región norte por rotación de personal."
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg p-2.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-primary min-h-[90px] resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-[var(--border-color)] pt-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => { setShowReasonModal(false); setReasonAction(null); }} 
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-color)] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary rounded-lg text-xs font-bold shadow-sm"
                >
                  Confirmar Cambio
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PASSWORD COPY MODAL (React Portal) */}
      {showPassModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"></div>
          
          <div className="relative w-full max-w-sm bg-[var(--bg-elevated)] rounded-2xl shadow-2xl border border-[var(--border-color)] p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={26} />
            </div>
            
            <h4 className="text-base font-black text-[var(--text-primary)]">Contraseña Temporal Generada</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Copia la clave y compártela de forma segura. El usuario deberá renovarla en su primer acceso.
            </p>

            <div className="my-5 p-3.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-[var(--border-color)] select-all font-mono font-black text-primary text-[15px] tracking-widest">
              {tempPassword}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(tempPassword);
                showToast('Contraseña copiada.');
                setShowPassModal(false);
                setTempPassword('');
              }}
              className="w-full py-2.5 bg-primary text-on-primary hover:bg-primary-fixed text-on-primary text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Copiar y Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* AGENCY SELECTOR SUBMODAL (React Portal) */}
      {isAgencyModalOpen && typeof document !== 'undefined' && wizardData && createPortal(
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
                  <h4 className="text-sm font-black text-[var(--text-primary)]">Buscar y Asignar Agencias</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Asigna múltiples agencias al alcance operativo del usuario</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAgencyModalOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-color)] rounded-lg transition-all"
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
                <span>Total: {agencias.length}</span>
                <span className="w-1 h-1 bg-[var(--border-color)] rounded-full"></span>
                <span className="text-primary">Seleccionadas: {wizardData.scope_entity_ids?.length || 0}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const visibleCodes = agencias.filter(ag => {
                      const searchStr = agencySearchQuery.toLowerCase().trim();
                      if (!searchStr) return true;
                      
                      const matchesAgency = 
                        (ag.name && ag.name.toLowerCase().includes(searchStr)) || 
                        (ag.code && ag.code.toLowerCase().includes(searchStr)) ||
                        (ag.address && ag.address.toLowerCase().includes(searchStr));
                        
                      const matchesTerminal = ag.terminals && ag.terminals.some(t => 
                        (t.code && t.code.toLowerCase().includes(searchStr)) ||
                        (t.name && t.name.toLowerCase().includes(searchStr))
                      );
                        
                      return matchesAgency || matchesTerminal;
                    }).map(ag => ag.id);
                    
                    const existing = wizardData.scope_entity_ids || [];
                    const combined = Array.from(new Set([...existing, ...visibleCodes]));
                    handleChange('scope_entity_ids', combined);
                  }}
                  className="px-2.5 py-1 text-[9.5px] font-bold bg-[var(--bg-color)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const visibleCodes = agencias.filter(ag => {
                      const searchStr = agencySearchQuery.toLowerCase().trim();
                      if (!searchStr) return true;
                      
                      const matchesAgency = 
                        (ag.name && ag.name.toLowerCase().includes(searchStr)) || 
                        (ag.code && ag.code.toLowerCase().includes(searchStr)) ||
                        (ag.address && ag.address.toLowerCase().includes(searchStr));
                        
                      const matchesTerminal = ag.terminals && ag.terminals.some(t => 
                        (t.code && t.code.toLowerCase().includes(searchStr)) ||
                        (t.name && t.name.toLowerCase().includes(searchStr))
                      );
                        
                      return matchesAgency || matchesTerminal;
                    }).map(ag => ag.id);
                    
                    const existing = wizardData.scope_entity_ids || [];
                    const updated = existing.filter(x => !visibleCodes.includes(x));
                    handleChange('scope_entity_ids', updated);
                  }}
                  className="px-2.5 py-1 text-[9.5px] font-bold bg-[var(--bg-color)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  Deseleccionar visibles
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('scope_entity_ids', [])}
                  className="px-2.5 py-1 text-[9.5px] font-bold text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/30 rounded transition-all"
                >
                  Limpiar todo
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-color)]/25 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(() => {
                  const filtered = agencias.filter(ag => {
                    const searchStr = agencySearchQuery.toLowerCase().trim();
                    if (!searchStr) return true;
                    
                    const matchesAgency = 
                      (ag.name && ag.name.toLowerCase().includes(searchStr)) || 
                      (ag.code && ag.code.toLowerCase().includes(searchStr)) ||
                      (ag.address && ag.address.toLowerCase().includes(searchStr));
                      
                    const matchesTerminal = ag.terminals && ag.terminals.some(t => 
                      (t.code && t.code.toLowerCase().includes(searchStr)) ||
                      (t.name && t.name.toLowerCase().includes(searchStr))
                    );
                      
                    return matchesAgency || matchesTerminal;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center text-[12px] text-[var(--text-muted)] italic">
                        No se encontraron agencias que coincidan con la búsqueda o filtros aplicados.
                      </div>
                    );
                  }

                  return filtered.map(ag => {
                    const isSelected = wizardData.scope_entity_ids?.includes(ag.id);
                    return (
                      <div
                        key={ag.id}
                        onClick={() => {
                          const existing = wizardData.scope_entity_ids || [];
                          const updated = isSelected 
                            ? existing.filter(x => x !== ag.id) 
                            : [...existing, ag.id];
                          handleChange('scope_entity_ids', updated);
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
                          </div>
                          <h5 className="font-bold text-[12px] text-[var(--text-primary)] mt-1 truncate">{ag.name}</h5>
                          <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{ag.address}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]/50 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--text-muted)] font-bold">
                  {wizardData.scope_entity_ids?.length || 0} agencias seleccionadas en total.
                </span>
                <span className="text-[9.5px] text-primary font-bold mt-0.5">
                  * Recuerda hacer clic en "Guardar Cambios" al final del perfil.
                </span>
              </div>
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



      {/* Confirm Edit Modal */}
      {showConfirmEditModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={() => setShowConfirmEditModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}></div>
          <div 
            className="relative bg-[#1d1f18] border border-[var(--border-color)] rounded-2xl shadow-2xl text-center p-8 z-10 animate-in zoom-in-95 duration-200"
            style={{ position: 'relative', zIndex: 10, backgroundColor: '#1d1f18', borderColor: 'var(--border-color, #333)', borderRadius: '16px', padding: '32px', textAlign: 'center', width: '440px', maxWidth: '90vw', minWidth: '320px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto' }}
          >
             <div className="w-16 h-16 rounded-full bg-[#2c321d] border border-[#bfce7f]/30 flex items-center justify-center mx-auto mb-6 text-[#bfce7f]" style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#2c321d', border: '1px solid rgba(191,206,127,0.3)', display: 'flex', itemsCenter: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#bfce7f', flexShrink: 0 }}>
                <Save className="w-8 h-8" style={{ width: '32px', height: '32px' }} />
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', width: '100%' }}>¿Confirmar Guardado?</h3>
             <p className="text-slate-300 text-sm mb-8 px-2 leading-relaxed font-medium" style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.5', width: '100%' }}>
               ¿Desea guardar los cambios realizados en el perfil del usuario?
             </p>
             <div className="flex items-center gap-4 w-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', width: '100%' }}>
               <button 
                 type="button"
                 onClick={() => setShowConfirmEditModal(false)} 
                 className="flex-1 py-3 px-5 rounded-xl bg-[#2a2c24] text-white hover:bg-[#35382e] font-bold text-sm transition-colors border border-transparent"
                 style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', backgroundColor: '#2a2c24', color: '#ffffff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
               >
                 Cancelar
               </button>
               <button 
                 type="button"
                 onClick={handleSaveEdit360} 
                 disabled={isSaving}
                 className="flex-1 py-3 px-5 rounded-xl bg-[#bfce7f] text-[#1d1f18] hover:bg-[#a8b868] font-bold text-sm transition-colors shadow-lg shadow-[#bfce7f]/20 flex items-center justify-center"
                 style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', backgroundColor: '#bfce7f', color: '#1d1f18', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
               >
                 {isSaving ? 'Guardando...' : 'Confirmar'}
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Edit Modal */}
      {showSuccessEditModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={() => setShowSuccessEditModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}></div>
          <div 
            className="relative bg-[#1d1f18] border border-[var(--border-color)] rounded-2xl shadow-2xl text-center p-8 z-10 animate-in zoom-in-95 duration-200"
            style={{ position: 'relative', zIndex: 10, backgroundColor: '#1d1f18', borderColor: 'var(--border-color, #333)', borderRadius: '16px', padding: '32px', textAlign: 'center', width: '440px', maxWidth: '90vw', minWidth: '320px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto' }}
          >
             <div className="w-16 h-16 rounded-full bg-[#2c321d] border border-[#bfce7f]/30 text-[#bfce7f] flex items-center justify-center mx-auto mb-6" style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#2c321d', border: '1px solid rgba(191,206,127,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#bfce7f', flexShrink: 0 }}>
                <CheckCircle2 size={36} strokeWidth={2.5} style={{ width: '36px', height: '36px' }} />
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', width: '100%' }}>¡Guardado Exitosamente!</h3>
             <p className="text-slate-300 text-sm mb-8 leading-relaxed font-medium" style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.5', width: '100%' }}>
               El registro ha sido guardado correctamente en la base de datos.
             </p>
             <button 
               type="button"
               onClick={() => setShowSuccessEditModal(false)} 
               className="w-full py-3 px-5 bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] rounded-xl text-sm font-bold shadow-lg shadow-[#bfce7f]/20 transition-all"
               style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', backgroundColor: '#bfce7f', color: '#1d1f18', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
             >
               Entendido
             </button>
          </div>
        </div>,
        document.body
      )}

      {/* Success Wizard Modal */}
      {showSuccessWizardModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={() => {
            setShowSuccessWizardModal(false);
            setIsCreating(false);
            setIsEditing(false);
            if (!showPassModal) setWizardData(null);
          }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}></div>
          <div 
            className="relative bg-[#1d1f18] border border-[var(--border-color)] rounded-2xl shadow-2xl text-center p-8 z-10 animate-in zoom-in-95 duration-200"
            style={{ position: 'relative', zIndex: 10, backgroundColor: '#1d1f18', borderColor: 'var(--border-color, #333)', borderRadius: '16px', padding: '32px', textAlign: 'center', width: '440px', maxWidth: '90vw', minWidth: '320px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto' }}
          >
             <div className="w-16 h-16 rounded-full bg-[#2c321d] border border-[#bfce7f]/30 text-[#bfce7f] flex items-center justify-center mx-auto mb-6" style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#2c321d', border: '1px solid rgba(191,206,127,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#bfce7f', flexShrink: 0 }}>
                <CheckCircle2 size={36} strokeWidth={2.5} style={{ width: '36px', height: '36px' }} />
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', width: '100%' }}>¡Guardado Exitosamente!</h3>
             <p className="text-slate-300 text-sm mb-8 leading-relaxed font-medium" style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.5', width: '100%' }}>
               {successWizardMessage || 'El registro ha sido guardado correctamente en la base de datos.'}
             </p>
             <button 
               type="button"
               onClick={() => {
                setShowSuccessWizardModal(false);
                setIsCreating(false);
                setIsEditing(false);
                if (!showPassModal) setWizardData(null);
             }} 
               className="w-full py-3 px-5 bg-[#bfce7f] hover:bg-[#a8b868] text-[#1d1f18] rounded-xl text-sm font-bold shadow-lg shadow-[#bfce7f]/20 transition-all"
               style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', backgroundColor: '#bfce7f', color: '#1d1f18', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
             >
               Entendido
             </button>
          </div>
        </div>,
        document.body
      )}
      {/* CONFIRM REVOKE SINGLE SESSION MODAL */}
      {showRevokeConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowRevokeConfirmModal(false)}></div>
          <div className="relative w-full max-w-sm bg-[var(--bg-elevated)] rounded-2xl shadow-2xl flex flex-col border border-rose-200/50 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-primary dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-primary">
                <ShieldX size={32} />
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">¿Revocar sesión?</h3>
              <p className="text-[14px] text-[var(--text-muted)] max-w-[280px]">
                ¿Está seguro que desea cerrar la sesión activa del dispositivo <strong>{sessionToRevoke?.device}</strong>?
              </p>
            </div>
            <div className="px-6 pb-6 pt-2 flex justify-center gap-3">
              <button 
                onClick={() => setShowRevokeConfirmModal(false)} 
                className="px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-[13px] font-bold hover:bg-[var(--border-color)] transition-colors min-w-[120px] bg-slate-50 dark:bg-slate-800 text-[var(--text-primary)]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExecuteRevokeSingle} 
                className="px-6 py-2.5 rounded-xl bg-primary-fixed hover:bg-rose-700 text-on-primary text-[13px] font-bold transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM REVOKE ALL SESSIONS MODAL */}
      {showRevokeAllConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowRevokeAllConfirmModal(false)}></div>
          <div className="relative w-full max-w-sm bg-[var(--bg-elevated)] rounded-2xl shadow-2xl flex flex-col border border-rose-200/50 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-primary dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-primary">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">¿Revocar todas?</h3>
              <p className="text-[14px] text-[var(--text-muted)] max-w-[280px]">
                ¿Está seguro que desea desconectar al usuario de <strong>todos los dispositivos</strong> inmediatamente?
              </p>
            </div>
            <div className="px-6 pb-6 pt-2 flex justify-center gap-3">
              <button 
                onClick={() => setShowRevokeAllConfirmModal(false)} 
                className="px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-[13px] font-bold hover:bg-[var(--border-color)] transition-colors min-w-[120px] bg-slate-50 dark:bg-slate-800 text-[var(--text-primary)]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExecuteRevokeAll} 
                className="px-6 py-2.5 rounded-xl bg-primary-fixed hover:bg-rose-700 text-on-primary text-[13px] font-bold transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                Revocar Todo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {showDeleteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-[#1d1f18] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200">
             <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
                <Trash2 className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight">¿Eliminar Cuenta?</h3>
             <p className="text-slate-300 text-sm mb-8 px-2 leading-relaxed font-medium">
               ¿Está seguro que desea eliminar permanentemente al usuario <strong>{userToDelete?.full_name}</strong>? Esta acción no se puede deshacer.
             </p>
             <div className="flex items-center gap-4 w-full">
               <button 
                 onClick={() => setShowDeleteModal(false)} 
                 className="flex-1 py-3 px-5 rounded-xl bg-[#2a2c24] text-white hover:bg-[#35382e] font-bold text-sm transition-colors border border-transparent"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleConfirmDeleteUser} 
                 className="flex-1 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors shadow-lg shadow-rose-600/20"
               >
                 Sí, Eliminar
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM SAVE USER MODAL */}
      {showConfirmSaveModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={() => setShowConfirmSaveModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}></div>
          <div 
            className="relative bg-[#1d1f18] border border-[var(--border-color)] rounded-2xl shadow-2xl text-center p-8 z-10 animate-in zoom-in-95 duration-200"
            style={{ position: 'relative', zIndex: 10, backgroundColor: '#1d1f18', borderColor: 'var(--border-color, #333)', borderRadius: '16px', padding: '32px', textAlign: 'center', width: '440px', maxWidth: '90vw', minWidth: '320px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto' }}
          >
             <div className="w-16 h-16 rounded-full bg-[#2c321d] border border-[#bfce7f]/30 flex items-center justify-center mx-auto mb-6 text-[#bfce7f]" style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#2c321d', border: '1px solid rgba(191,206,127,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#bfce7f', flexShrink: 0 }}>
                <Save className="w-8 h-8" style={{ width: '32px', height: '32px' }} />
             </div>
             <h3 className="text-xl font-bold text-white mb-3 tracking-tight" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', width: '100%' }}>¿Confirmar Guardado?</h3>
             <p className="text-slate-300 text-sm mb-8 px-2 leading-relaxed font-medium" style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.5', width: '100%' }}>
               ¿Desea guardar los cambios realizados en el perfil del usuario?
             </p>
             <div className="flex items-center gap-4 w-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', width: '100%' }}>
               <button 
                 type="button"
                 onClick={() => setShowConfirmSaveModal(false)} 
                 className="flex-1 py-3 px-5 rounded-xl bg-[#2a2c24] text-white hover:bg-[#35382e] font-bold text-sm transition-colors border border-transparent"
                 style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', backgroundColor: '#2a2c24', color: '#ffffff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
               >
                 Cancelar
               </button>
               <button 
                 type="button"
                 onClick={handleExecuteSave360} 
                 disabled={isSaving}
                 className="flex-1 py-3 px-5 rounded-xl bg-[#bfce7f] text-[#1d1f18] hover:bg-[#a8b868] font-bold text-sm transition-colors shadow-lg shadow-[#bfce7f]/20 flex items-center justify-center"
                 style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', backgroundColor: '#bfce7f', color: '#1d1f18', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
               >
                 {isSaving ? 'Guardando...' : 'Confirmar'}
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}