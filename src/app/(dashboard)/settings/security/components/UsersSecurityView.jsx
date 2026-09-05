"use client";
import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { 
  Users, UserPlus, Download, Edit2, ShieldAlert,
  MoreVertical, X, Save, Search, Check, CheckCircle2, AlertCircle, 
  RotateCw, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Filter, SlidersHorizontal, ToggleLeft, ToggleRight,
  ShieldCheck, Shield, Key, KeyRound, Trash2, Mail, Phone, Building2, Eye, EyeOff, PanelLeftOpen, LayoutGrid, List,
  FileText, Calendar, Clock, Laptop, ShieldX, CheckSquare, Square, Info, AlertTriangle, ArrowRight, Settings, Printer
} from 'lucide-react';
import { validateRNC, validatePhoneDR, formatPhoneDR, validateEmail, validatePasswordPolicy } from '@/lib/validations';
import { usersService } from '@/services/usersService';
import SecurityConfirmDialog from '@/components/security/SecurityConfirmDialog';

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

export function mapUserDetail(detail, authUser) {
  const src = {
    ...(authUser || {}),
    ...(detail || {})
  };

  const firstName = detail?.first_name ?? authUser?.nombre ?? null;
  const lastName = detail?.last_name ?? authUser?.apellido ?? null;
  const computedFullName = (firstName || lastName)
    ? `${firstName || ''} ${lastName || ''}`.trim()
    : (detail?.full_name ?? authUser?.nombre_completo ?? null);

  return {
    ...src,
    id: detail?.id ?? detail?.usuario_id ?? authUser?.usuario_id ?? null,
    full_name: computedFullName,
    first_name: firstName,
    last_name: lastName,
    email: detail?.email ?? detail?.correo_electronico ?? null,
    correo_acceso: detail?.correo_acceso ?? null,
    primary_access_type:
      detail?.primary_access_type ??
      detail?.metodo_acceso_principal ??
      'EMAIL',
    login_identifiers:
      Array.isArray(detail?.login_identifiers) && detail.login_identifiers.length > 0
        ? detail.login_identifiers
        : detail?.identificador_principal
          ? [{
              is_primary: true,
              identifier_value: detail.identificador_principal
            }]
          : [],
    department_id: detail?.department_id ?? detail?.departamento_id ?? null,
    departamento_nombre: detail?.departamento_nombre ?? null,
    area_id: detail?.area_id ?? null,
    area_nombre: detail?.area_nombre ?? null,
    cargo_id: detail?.cargo_id ?? null,
    cargo_nombre:
      detail?.cargo_nombre ?? authUser?.cargo_nombre ?? null,
    companyId: detail?.companyId ?? detail?.empresa_id ?? null,
    empresa_nombre:
      detail?.empresa_nombre ?? authUser?.empresa_nombre ?? null,
    role: detail?.role ?? authUser?.rol_nombre ?? null,
    user_type: detail?.user_type ?? null,
    mfaEnabled:
      detail?.mfaEnabled ?? (detail?.mfa_activo != null ? Boolean(detail.mfa_activo) : false),
    mfa_method: detail?.mfa_method ?? detail?.mfa_tipo ?? null,
    last_login_at:
      detail?.last_login_at ?? detail?.fecha_ultimo_acceso ?? null
  };
}

export default function UsersSecurityView({ onOpenSidebar = () => {}, isSelfMode = false, selfUserId = null }) {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(null);
  const [activities, setActivities] = useState([]);
  const [audits, setAudits] = useState([]);
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

  const [isLoadingEmpresas, setIsLoadingEmpresas] = useState(false);
  const [isLoadingCargos, setIsLoadingCargos] = useState(false);
  const [isLoadingDepartamentos, setIsLoadingDepartamentos] = useState(false);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);

  // Custom Toast Notification State ({ type: 'success' | 'error', title: string, description: string })
  const [toastNotification, setToastNotification] = useState(null);
  const [resetToast, setResetToast] = useState(null);

  const showToastNotification = (title, description, type = 'success') => {
    setToastNotification({ title, description, type });
  };

  useEffect(() => {
    if (!toastNotification) return;
    const duration = toastNotification.type === 'success' ? 4000 : 6000;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  const [empresasError, setEmpresasError] = useState(null);
  const [cargosError, setCargosError] = useState(null);
  const [departamentosError, setDepartamentosError] = useState(null);
  const [areasError, setAreasError] = useState(null);

  // Manual Reset Password Modal State
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [isManualResetting, setIsManualResetting] = useState(false);

  const getLoginAccessIdentifier = (u) => {
    if (!u) return '—';
    if (Array.isArray(u.login_identifiers) && u.login_identifiers.length > 0) {
      const prim = u.login_identifiers.find(id => id.is_primary) || u.login_identifiers[0];
      if (prim?.identifier_value && String(prim.identifier_value).trim()) {
        return String(prim.identifier_value).trim();
      }
    }
    if (typeof u.login_identifiers === 'string' && u.login_identifiers.trim()) {
      return u.login_identifiers.trim();
    }
    if (u.identificador_principal && String(u.identificador_principal).trim()) {
      return String(u.identificador_principal).trim();
    }
    if (u.correo_acceso && String(u.correo_acceso).trim()) {
      return String(u.correo_acceso).trim();
    }
    if (u.email && String(u.email).trim()) {
      return String(u.email).trim();
    }
    if (u.document_number && String(u.document_number).trim()) {
      return String(u.document_number).trim();
    }
    if (u.phone && String(u.phone).trim()) {
      return String(u.phone).trim();
    }
    return u.id ? `ID #${u.id}` : '—';
  };

  const getUserDisplayName = (u) => {
    if (!u) return 'Usuario';
    const computedName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (computedName) return computedName;
    if (u.full_name && u.full_name !== 'Desconocido' && u.full_name.trim()) {
      return u.full_name.trim();
    }
    const access = getLoginAccessIdentifier(u);
    if (access && !access.startsWith('ID #') && access !== '—') {
      return access;
    }
    return u.id ? `Usuario #${u.id}` : 'Usuario';
  };

  const handleOpenResetPasswordModal = async (user) => {
    setResetPasswordUser(user);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
    setResetForceChange(true);
    setResetPasswordError('');
    setIsManualResetting(false);
    setIsResetPasswordModalOpen(true);

    try {
      const full = await usersService.getUserById(user.id);
      if (full) {
        setResetPasswordUser(prev => ({ ...(prev || {}), ...full }));
      }
    } catch (e) {
      console.warn('Could not fetch full user detail for reset password modal:', e);
    }
  };

  const handleCloseResetPasswordModal = () => {
    if (isManualResetting) return;
    setIsResetPasswordModalOpen(false);
    setResetPasswordUser(null);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
    setResetPasswordError('');
  };

  const handleSubmitManualResetPassword = async (e) => {
    if (e) e.preventDefault();
    setResetPasswordError('');

    if (!resetNewPassword) {
      setResetPasswordError('Debe ingresar una nueva contraseña.');
      return;
    }

    if (!resetConfirmPassword) {
      setResetPasswordError('Debe confirmar la nueva contraseña.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetPasswordError('Las contraseñas no coinciden.');
      return;
    }

    const policy = validatePasswordPolicy(resetNewPassword);
    if (!policy.isValid) {
      setResetPasswordError(policy.message);
      return;
    }

    setIsManualResetting(true);
    try {
      await usersService.resetPassword(resetPasswordUser.id, {
        password: resetNewPassword,
        confirm_password: resetConfirmPassword,
        forceChangeOnNextLogin: resetForceChange
      });

      handleCloseResetPasswordModal();
      showToastNotification(
        'Contraseña Restablecida',
        `La contraseña para "${resetPasswordUser.full_name || resetPasswordUser.email}" ha sido actualizada exitosamente.`,
        'success'
      );
      await fetchUsers();
      if (detailUser && detailUser.id === resetPasswordUser.id) {
        fetchUserAudits(resetPasswordUser.id);
      }
    } catch (err) {
      setResetPasswordError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setIsManualResetting(false);
    }
  };

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

  const loadSelfProfile = async () => {
    setIsLoading(true);
    setProfileLoadError(null);
    setDetailUser(null);
    try {
      const authRes = await fetch('/api/auth/me', { cache: 'no-store' });
      if (authRes.status === 401) {
        router.push('/login');
        return;
      }
      if (!authRes.ok) {
        setProfileLoadError('No fue posible cargar la información del perfil.');
        return;
      }
      const authData = await authRes.json();
      const authUser = authData?.data || authData?.user;

      if (!authUser || !(authUser.usuario_id || authUser.id)) {
        setProfileLoadError('No fue posible cargar la información del perfil.');
        return;
      }

      const targetId = authUser.usuario_id || authUser.id;

      try {
        const detailUserRaw = await usersService.getUserById(targetId);
        const mapped = mapUserDetail(detailUserRaw, authUser);
        setDetailUser(mapped);
      } catch (detailErr) {
        if (detailErr?.message?.includes('401')) {
          router.push('/login');
          return;
        }
        // Fall back to authUser profile instead of blocking the page
        const mapped = mapUserDetail(null, authUser);
        setDetailUser(mapped);
      }
    } catch (err) {
      setDetailUser(null);
      setProfileLoadError('No fue posible cargar la información del perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSelfMode) {
      loadSelfProfile();
    } else {
      fetchUsers();
    }
  }, [isSelfMode]);

  const fetchAreasForDepartamento = async (deptId) => {
    if (!deptId) {
      setAreas([]);
      setIsLoadingAreas(false);
      return;
    }
    setIsLoadingAreas(true);
    setAreasError(null);
    try {
      const res = await fetch(`/api/areas?departamento_id=${deptId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const activeList = (Array.isArray(data) ? data : [])
        .filter(a => (String(a.estado).toUpperCase() === 'ACTIVO' || a.estado === true) && Number(a.departamento_id) === Number(deptId))
        .map(a => ({
          area_id: Number(a.area_id ?? a.id),
          id: Number(a.area_id ?? a.id),
          departamento_id: Number(a.departamento_id),
          nombre: a.nombre || `Área ${a.id}`,
          name: a.nombre || `Área ${a.id}`
        }));
      setAreas(activeList);
    } catch (err) {
      console.error("Error fetching areas:", err);
      setAreasError("No se pudieron cargar las áreas.");
    } finally {
      setIsLoadingAreas(false);
    }
  };

  const loadCatalogos = async () => {
    // 1. Fetch Empresas (admin.empresa -> estado = 'Activo' / 'ACTIVO')
    setIsLoadingEmpresas(true);
    setEmpresasError(null);
    fetch('/api/empresas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
      .then(data => {
        const activeList = (Array.isArray(data) ? data : [])
          .filter(e => String(e.estado).toUpperCase() === 'ACTIVO' || e.estado === true)
          .map(e => ({
            empresa_id: Number(e.empresa_id ?? e.id),
            id: Number(e.empresa_id ?? e.id),
            nombre_comercial: e.nombre_comercial || e.nombre || `Empresa ${e.id}`,
            name: e.nombre_comercial || e.nombre || `Empresa ${e.id}`
          }));
        setCompanies(activeList);
      })
      .catch(err => {
        console.error("Error loading empresas:", err);
        setEmpresasError("No se pudieron cargar las empresas.");
      })
      .finally(() => setIsLoadingEmpresas(false));

    // 2. Fetch Cargos (admin.cargo -> estado = 'ACTIVO')
    setIsLoadingCargos(true);
    setCargosError(null);
    fetch('/api/cargos', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
      .then(data => {
        const activeList = (Array.isArray(data) ? data : [])
          .filter(c => String(c.estado).toUpperCase() === 'ACTIVO' || c.estado === true)
          .map(c => ({
            cargo_id: Number(c.cargo_id ?? c.id),
            id: Number(c.cargo_id ?? c.id),
            nombre: c.nombre || `Cargo ${c.id}`,
            name: c.nombre || `Cargo ${c.id}`
          }));
        setCargos(activeList);
      })
      .catch(err => {
        console.error("Error loading cargos:", err);
        setCargosError("No se pudieron cargar los cargos.");
      })
      .finally(() => setIsLoadingCargos(false));

    // 3. Fetch Departamentos (admin.departamento -> estado = 'ACTIVO')
    setIsLoadingDepartamentos(true);
    setDepartamentosError(null);
    fetch('/api/departamentos', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
      .then(data => {
        const activeList = (Array.isArray(data) ? data : [])
          .filter(d => String(d.estado).toUpperCase() === 'ACTIVO' || d.estado === true)
          .map(d => ({
            departamento_id: Number(d.departamento_id ?? d.id),
            id: Number(d.departamento_id ?? d.id),
            nombre: d.nombre || `Departamento ${d.id}`,
            name: d.nombre || `Departamento ${d.id}`
          }));
        setDepartments(activeList);
      })
      .catch(err => {
        console.error("Error loading departamentos:", err);
        setDepartamentosError("No se pudieron cargar los departamentos.");
      })
      .finally(() => setIsLoadingDepartamentos(false));

    // 4. Fetch Tipos Usuario & RBAC Matrix
    fetch('/api/tipos-usuario', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const activeList = (Array.isArray(data) ? data : [])
          .filter(t => String(t.estado).toUpperCase() === 'ACTIVO' || t.estado === true)
          .map(t => ({
            tipo_usuario_id: Number(t.tipo_usuario_id ?? t.id),
            id: Number(t.tipo_usuario_id ?? t.id),
            nombre: t.nombre || `Tipo ${t.id}`,
            name: t.nombre || `Tipo ${t.id}`
          }));
        setUserTypes(activeList);
      }).catch(() => {});

    fetch('/api/matriz-acceso-rol', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(apiData => {
        if (apiData) {
          if (apiData.modules && apiData.modules.length > 0) {
            setModules(apiData.modules.map(m => ({
              id: m.id,
              name: m.label || m.nombre || m.name || `Módulo ${m.id}`,
              label: m.label || m.nombre || m.name || `Módulo ${m.id}`,
              orden: m.orden
            })));
          }
          if (apiData.roles && apiData.roles.length > 0) {
            setRoles(apiData.roles.map(r => ({
              id: r.numericId || r.id,
              numericId: r.numericId || r.id,
              name: r.nombre || r.name,
              nombre: r.nombre || r.name,
              descripcion: r.descripcion,
              estado: r.estado
            })));
          }
          if (apiData.matrix) setApiMatrixMap(apiData.matrix);
          if (apiData.rawMatrix) setRbacMatrix(apiData.rawMatrix);
        }
      }).catch(() => {});
  };

  useEffect(() => {
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
  const [sortConfigSesiones, setSortConfigSesiones] = useState({ key: 'last_activity_at', direction: 'desc' });
  const [sessionFilterStatus, setSessionFilterStatus] = useState('Todos');
  const [sessionSearchText, setSessionSearchText] = useState('');
  const [sessionCurrentPage, setSessionCurrentPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState(10);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [keepCurrentSessionOnRevokeAll, setKeepCurrentSessionOnRevokeAll] = useState(true);

  const handleSortSesiones = (key) => {
    let direction = 'asc';
    if (sortConfigSesiones.key === key && sortConfigSesiones.direction === 'asc') direction = 'desc';
    setSortConfigSesiones({ key, direction });
  };

  useEffect(() => {
    if (detailUser?.id && activeTab360 === 'sesiones') {
      fetchUserSessions(detailUser.id);
      const intervalId = setInterval(() => {
        fetchUserSessions(detailUser.id);
      }, 30000);
      return () => clearInterval(intervalId);
    }
  }, [detailUser?.id, activeTab360]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedSessionDetail) {
        setSelectedSessionDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSessionDetail]);

  const fetchUserSessions = async (id) => {
    try {
      setIsLoadingSessions(true);
      const data = await usersService.getUserSessions(id);
      setRealUserSessions(data || []);
    } catch (e) {
      console.error('Error fetching sessions:', e);
      setRealUserSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const [isEditing360, setIsEditing360] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [edit360Error, setEdit360Error] = useState('');
  const [formErrors360, setFormErrors360] = useState({});
  const [matrixFilter, setMatrixFilter] = useState('all');

  // Password Visibility States for User Creation Wizard
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);

  const [genericConfirmModal, setGenericConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    variant: 'default',
    confirmLabel: 'Confirmar',
    details: null,
    onConfirm: null,
  });

  const handleExecuteSave360 = async () => {
    setShowConfirmSaveModal(false);
    const targetData = wizardData || detailUser;
    if (!targetData) return;

    try {
      setIsSaving(true);
      const fullName = `${(targetData.first_name || '').trim()} ${(targetData.last_name || '').trim()}`.trim() || targetData.full_name;
      let payload;
      if (isSelfMode) {
        payload = {
          id: targetData.id,
          first_name: targetData.first_name,
          nombre: targetData.first_name,
          last_name: targetData.last_name,
          apellido: targetData.last_name,
          phone: targetData.phone,
          telefono: targetData.phone,
          document_number: targetData.document_number,
          numero_documento: targetData.document_number,
          department_id: targetData.department_id,
          departamento_id: targetData.department_id,
          area_id: targetData.area_id,
          cargo_id: targetData.cargo_id,
          idioma_preferido: targetData.idioma_preferido,
          zona_horaria: targetData.zona_horaria,
          formato_fecha: targetData.formato_fecha
        };
      } else {
        payload = {
          ...targetData,
          full_name: fullName,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Admin'
        };
        if (payload.rol_id) {
          const rObj = roles.find(r => r.id == payload.rol_id);
          if (rObj) payload.role = rObj.name;
        }
      }

      const response = await usersService.updateUser(targetData.id, payload);
      const updatedUser = response?.data;

      if (!response?.success || !updatedUser) {
        throw new Error('INVALID_UPDATE_RESPONSE');
      }

      setDetailUser(previous => previous ? ({
        ...previous,
        ...updatedUser
      }) : updatedUser);

      setData(prevUsers =>
        Array.isArray(prevUsers)
          ? prevUsers.map(u => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
          : prevUsers
      );

      setIsEditing360(false);
      setWizardData(null);
      setToastNotification({
        type: 'success',
        title: 'Cambios guardados',
        description: 'La información del usuario se actualizó correctamente.'
      });
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'No pudimos guardar los cambios',
        description: 'Inténtalo nuevamente. Si el problema continúa, recarga la página.'
      });
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
    let str = String(dateVal).trim();
    if (str.includes(' ') && !str.includes('T')) {
      str = str.replace(' ', 'T');
    }
    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
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
                setDetailUser(res ? { ...user, ...res } : user);
                const tabParam = currentSp.get('tab');
                if (tabParam) setActiveTab360(tabParam === 'activacion' ? 'resumen' : tabParam);
              }
            }).catch(() => {
              const currentSp = new URLSearchParams(window.location.search);
              if (currentSp.get('userId') === String(userIdParam)) {
                setDetailUser(user);
                const tabParam = currentSp.get('tab');
                if (tabParam) setActiveTab360(tabParam === 'activacion' ? 'resumen' : tabParam);
              }
            });
          } else {
            const tabParam = sp.get('tab');
            if (tabParam) setActiveTab360(tabParam === 'activacion' ? 'resumen' : tabParam);
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
    const cargoNames = (cargos || []).map(c => c.nombre || c.name || '').filter(Boolean);
    if (!query) return cargoNames;
    return cargoNames.filter(title => title.toLowerCase().includes(query));
  }, [wizardData?.job_title, cargos]);

  const filteredUserTypes = useMemo(() => {
    const query = (wizardData?.user_type || '').toLowerCase();
    if (!query) return userTypes;
    return (userTypes || []).filter(type => (type.nombre || type.name || '').toLowerCase().includes(query));
  }, [wizardData?.user_type, userTypes]);

  const filteredDepartments = useMemo(() => {
    const query = (wizardData?.department || '').toLowerCase();
    const deptNames = (departments || []).map(d => d.nombre || d.name || '').filter(Boolean);
    if (!query) return deptNames;
    return deptNames.filter(dept => dept.toLowerCase().includes(query));
  }, [wizardData?.department, departments]);

  const handleViewDetail = async (item, tab = 'resumen') => {
    const targetTab = tab === 'activacion' ? 'resumen' : tab;
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : searchParamsString);
      sp.set('userId', item.id);
      sp.set('tab', targetTab);
      setSearchParams(sp);
      
      const res = await usersService.getUserById(item.id);
      setDetailUser({ ...item, ...res });
      setActiveTab360(targetTab);
      if (targetTab === 'permisos') setMatrixFilter('all');
    } catch (err) {
      console.error('Error fetching user details:', err);
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : searchParamsString);
      sp.set('userId', item.id);
      sp.set('tab', targetTab);
      setSearchParams(sp);
      setDetailUser(item);
      setActiveTab360(targetTab);
      if (targetTab === 'permisos') setMatrixFilter('all');
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
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete User handlers
  const handleDeleteUserClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
    setActiveDropdown(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await usersService.deleteUser(userToDelete.id);
      showToast('Usuario eliminado correctamente.');
      fetchUsers();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      showToast('Error al intentar eliminar el usuario.', 'error');
    } finally {
      setIsDeleting(false);
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
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
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
    const filename = `usuarios_ridelab_${new Date().toISOString().slice(0, 10)}.csv`;
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
    loadCatalogos();
    setFormError('');
    setIsCreating(true);
    setIsEditing(false);
    setCurrentStep(1);
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);

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
      password: '',
      confirm_password: '',
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

      const compId = sourceUser.companyId || sourceUser.empresa_id || (companies && companies.length > 0 ? (companies[0].id || companies[0].empresa_id) : 1);
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
        correo_acceso: sourceUser.correo_acceso || '',
        enviar_invitacion_correo: Boolean(sourceUser.enviar_invitacion_correo),
        generar_clave_automatica: Boolean(sourceUser.generar_clave_automatica),
        forzar_cambio_clave: Boolean(sourceUser.forzar_cambio_clave),
        idioma_preferido: sourceUser.idioma_preferido || 'es',
        zona_horaria: sourceUser.zona_horaria || 'America/Santo_Domingo',
        formato_fecha: sourceUser.formato_fecha || 'DD/MM/YYYY',
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

    const companyId = wizardData.companyId || wizardData.empresa_id || (companies && companies[0] ? (companies[0].id || companies[0].empresa_id) : 1);
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
    usersService.updateUser(finalUser.id, finalUser).then(async () => {
      await fetchUsers();
      try {
        const fresh = await usersService.getUserById(finalUser.id);
        if (fresh) setDetailUser(fresh);
        else setDetailUser(finalUser);
      } catch (e) {
        setDetailUser(finalUser);
      }
      if (activeTab360 === 'auditoria') {
        fetchUserAudits(finalUser.id);
      }
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

    // Pass validations, execute save to DB
    handleExecuteSave360();
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
        setTimeout(() => {
          const firstErrEl = document.querySelector('.border-red-500, .border-rose-500, select[class*="border-red"], input[class*="border-red"]');
          if (firstErrEl) {
            firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (typeof firstErrEl.focus === 'function') firstErrEl.focus();
          }
        }, 50);
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
        setTimeout(() => {
          const firstErrEl = document.querySelector('.border-red-500, .border-rose-500, select[class*="border-red"], input[class*="border-red"]');
          if (firstErrEl) {
            firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (typeof firstErrEl.focus === 'function') firstErrEl.focus();
          }
        }, 50);
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

      if (isCreating) {
        if (!wizardData.password || !wizardData.password.trim()) {
          setFormError('La contraseña inicial es requerida.');
          return;
        }
        if (!wizardData.confirm_password || !wizardData.confirm_password.trim()) {
          setFormError('Debe confirmar la contraseña.');
          return;
        }
        if (wizardData.password !== wizardData.confirm_password) {
          setFormError('Las contraseñas no coinciden.');
          return;
        }
        const policyCheck = validatePasswordPolicy(wizardData.password);
        if (!policyCheck.isValid) {
          setFormError(policyCheck.message || 'La contraseña no cumple con los requisitos de seguridad.');
          return;
        }
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setFormError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveUser = () => {
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

    // Preserve password and confirm_password for canonical backend contract
    cleanUser.password = wizardData.password;
    cleanUser.confirm_password = wizardData.confirm_password;
    delete cleanUser.username;
    delete cleanUser.primary_access_type;

    if (isCreating) {
      cleanUser.status = 'Activo';
      cleanUser.createdAt = timestamp;
      cleanUser.createdBy = 'Admin';
      cleanUser.updatedAt = timestamp;
      cleanUser.updatedBy = 'Admin';
      cleanUser.last_login_at = null;

      const primaryAccess = wizardData.primary_access_type || (loginIdentifiers.find(id => id.is_primary)?.identifier_type) || 'EMAIL';
      const activationObj = {
        id: `ACT-S-${Date.now()}`,
        access_method: primaryAccess,
        activation_status: 'CREDENTIALS_GENERATED',
        invitation_sent_at: null,
        invitation_opened_at: null,
        registration_completed_at: null,
        first_login_at: null,
        invitation_expires_at: null,
        invitation_bounced_at: null,
        resend_count: 0,
        last_resend_at: null,
        temporary_credentials_generated_at: null,
        temporary_credentials_delivered_at: null,
        initial_password_changed_at: null,
        channel: primaryAccess === 'EMAIL' ? 'EMAIL' : 'PHYSICAL_SHEET',
        status_detail: 'Contraseña asignada por administrador',
        created_at: timestamp,
        updated_at: timestamp
      };
      
      cleanUser.activation = activationObj;

      setIsSaving(true);
      // Backend Integration: Create
      usersService.createUser(cleanUser).then(res => {
        setIsSaving(false);
        fetchUsers();
        handleCancel();
        setSuccessWizardMessage(res.message || 'El usuario ha sido creado correctamente en la base de datos.');
        setShowSuccessWizardModal(true);
        showToast('Usuario creado con éxito.');
      }).catch(err => {
        setIsSaving(false);
        setFormError('Error creando usuario: ' + (err.message || 'Error de conexión con el servidor.'));
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
        showToast(`Estado de usuario cambiado a ${afterEstado}.`);
      } 
    
    else if (type === 'role') {
      const beforeRole = user.role;
      const afterRole = payload.role;

      await usersService.updateUser(userId, { role: afterRole });

      updatedUsers = data.map(u => u.id === userId ? { ...u, role: afterRole, updatedAt: timestamp } : u);
      syncData(updatedUsers);
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

  const handleCopyActivationLink = (user) => {
    const link = `https://suivi.com/activate?token=INV-${user.id}-${Date.now()}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showToast('Enlace de activación copiado al portapapeles.');
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
    showToast('Invitación reenviada con éxito.');
  };

  const handleRevokeInvitationDirect = (user) => {
    setGenericConfirmModal({
      isOpen: true,
      title: 'Revocar acceso',
      description: `¿Está seguro de revocar la invitación y el acceso para ${user.full_name}?`,
      variant: 'danger',
      confirmLabel: 'Revocar acceso',
      details: [
        { label: 'Usuario', value: user.full_name },
        { label: 'Estado previo', value: user.status }
      ],
      onConfirm: () => {
        setGenericConfirmModal(prev => ({ ...prev, isOpen: false }));
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
        showToast('Invitación revocada. El usuario ha sido inhabilitado.');
      }
    });
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
    showToast('Recordatorio de onboarding enviado.');
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
  const [isRevokingSession, setIsRevokingSession] = useState(false);

  const [showRevokeAllConfirmModal, setShowRevokeAllConfirmModal] = useState(false);
  const [userToRevokeAll, setUserToRevokeAll] = useState(null);
  const [isRevokingAllSessions, setIsRevokingAllSessions] = useState(false);

  const handleRevokeAllSessions = (userId) => {
    setUserToRevokeAll(userId);
    setShowRevokeAllConfirmModal(true);
  };

  const handleExecuteRevokeAll = async () => {
    if (!userToRevokeAll) return;
    setIsRevokingAllSessions(true);
    try {
      await usersService.revokeAllUserSessions(userToRevokeAll, keepCurrentSessionOnRevokeAll);
      fetchUserSessions(userToRevokeAll);
      setShowRevokeAllConfirmModal(false);
      showToast('Sesiones revocadas con éxito.');
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      showToast('Error al revocar sesiones.', 'error');
    } finally {
      setIsRevokingAllSessions(false);
    }
  };

  const handleRevokeSingleSession = (session) => {
    setSessionToRevoke(session);
    setShowRevokeConfirmModal(true);
  };

  const handleExecuteRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    setIsRevokingSession(true);
    try {
      const targetUserId = sessionToRevoke.usuario_id || sessionToRevoke.user_id || detailUser?.id;
      const targetSessionId = sessionToRevoke.sesion_id || sessionToRevoke.id;
      await usersService.revokeUserSession(targetUserId, targetSessionId);
      if (targetUserId) fetchUserSessions(targetUserId);
      setShowRevokeConfirmModal(false);
      showToast('Sesión revocada correctamente.');
    } catch (error) {
      console.error('Error revoking session:', error);
      showToast('Error al revocar sesión.', 'error');
    } finally {
      setIsRevokingSession(false);
    }
  };

  const [realUserActivity, setRealUserActivity] = useState([]);
  const [activityTotalRecords, setActivityTotalRecords] = useState(0);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activitySummaryStats, setActivitySummaryStats] = useState({
    total_eventos: 0,
    eventos_hoy: 0,
    eventos_7dias: 0,
    eventos_error: 0,
    eventos_exito: 0
  });
  const [activityAvailableModules, setActivityAvailableModules] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [sortConfigActividad, setSortConfigActividad] = useState({ key: 'timestamp', direction: 'desc' });
  const [selectedActivityDetail, setSelectedActivityDetail] = useState(null);
  const [activityViewMode, setActivityViewMode] = useState('table'); // 'table' | 'timeline'
  const [activitySearchText, setActivitySearchText] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [activityModuleFilter, setActivityModuleFilter] = useState('Todos');
  const [activityResultFilter, setActivityResultFilter] = useState('Todos');
  const [activityActionTypeFilter, setActivityActionTypeFilter] = useState('Todos');
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedActivityDetail) {
        setSelectedActivityDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedActivityDetail]);

  const handleSortActividad = (key) => {
    let direction = 'asc';
    if (sortConfigActividad.key === key && sortConfigActividad.direction === 'asc') direction = 'desc';
    setSortConfigActividad({ key, direction });
  };

  const fetchUserActivity = async (userId, customParams = {}) => {
    if (!userId) return;
    setIsLoadingActivity(true);
    try {
      if (typeof usersService?.getUserActivity === 'function') {
        const queryParams = {
          page: customParams.page !== undefined ? customParams.page : activityCurrentPage,
          pageSize: customParams.pageSize !== undefined ? customParams.pageSize : activityPageSize,
          fechaDesde: customParams.fechaDesde !== undefined ? customParams.fechaDesde : activityDateFrom,
          fechaHasta: customParams.fechaHasta !== undefined ? customParams.fechaHasta : activityDateTo,
          modulo: customParams.modulo !== undefined ? customParams.modulo : activityModuleFilter,
          evento: customParams.evento !== undefined ? customParams.evento : activityActionTypeFilter,
          resultado: customParams.resultado !== undefined ? customParams.resultado : activityResultFilter,
          search: customParams.search !== undefined ? customParams.search : activitySearchText
        };
        const res = await usersService.getUserActivity(userId, queryParams);
        if (res && Array.isArray(res.items)) {
          setRealUserActivity(res.items);
          setActivityTotalRecords(res.total || 0);
          setActivityTotalPages(res.totalPages || 1);
          if (res.summaryStats) setActivitySummaryStats(res.summaryStats);
          if (Array.isArray(res.availableModules)) setActivityAvailableModules(res.availableModules);
        } else if (Array.isArray(res)) {
          setRealUserActivity(res);
          setActivityTotalRecords(res.length);
          setActivityTotalPages(1);
        } else {
          setRealUserActivity([]);
          setActivityTotalRecords(0);
          setActivityTotalPages(1);
        }
      } else {
        setRealUserActivity([]);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      setRealUserActivity([]);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const exportActivityToExcel = (activities, userName) => {
    if (!activities || activities.length === 0) return;
    const headers = ['ID Actividad', 'Fecha y Hora', 'Evento / Acción', 'Módulo', 'Resultado', 'IP', 'Dispositivo', 'Descripción'];
    const csvRows = [headers.join(',')];

    activities.forEach(act => {
      const row = [
        `"${act.actividad_id || act.id || ''}"`,
        `"${formatSafeDateTime(act.timestamp || act.fecha_hora)}"`,
        `"${(act.evento || act.event || '').replace(/"/g, '""')}"`,
        `"${(act.modulo || act.module || '').replace(/"/g, '""')}"`,
        `"${(act.resultado || act.result || '').replace(/"/g, '""')}"`,
        `"${act.direccion_ip || act.ip || ''}"`,
        `"${(act.dispositivo || act.device || '').replace(/"/g, '""')}"`,
        `"${(act.descripcion || act.desc || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bitacora_actividad_${(userName || 'usuario').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportActivityToPdf = (activities, userName) => {
    if (!activities || activities.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bitácora de Actividad - ${userName || 'Usuario'}</title>
          <style>
            body { font-family: monospace, sans-serif; font-size: 11px; color: #111; padding: 20px; }
            h1 { font-size: 16px; margin-bottom: 4px; text-transform: uppercase; }
            p { font-size: 11px; color: #555; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Ride Lab - Reporte de Bitácora Operativa</h1>
          <p>Usuario: <strong>${userName || 'N/A'}</strong> | Fecha de Generación: ${new Date().toLocaleString('es-DO')}</p>
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Evento</th>
                <th>Módulo</th>
                <th>Resultado</th>
                <th>IP</th>
                <th>Dispositivo</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              ${activities.map(act => `
                <tr>
                  <td>${formatSafeDateTime(act.timestamp || act.fecha_hora)}</td>
                  <td><strong>${act.evento || act.event || 'Actividad'}</strong></td>
                  <td>${act.modulo || act.module || 'Sistema'}</td>
                  <td>${act.resultado || act.result || 'Exitoso'}</td>
                  <td>${act.direccion_ip || act.ip || '—'}</td>
                  <td>${act.dispositivo || act.device || '—'}</td>
                  <td>${act.descripcion || act.desc || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  useEffect(() => {
    if (activeTab360 === 'actividad' && detailUser?.id) {
      fetchUserActivity(detailUser.id);
    }
  }, [activeTab360, detailUser?.id, activityCurrentPage, activityPageSize, activityModuleFilter, activityResultFilter, activityActionTypeFilter, activityDateFrom, activityDateTo]);

  const [realUserAudits, setRealUserAudits] = useState([]);
  const [auditTotalRecords, setAuditTotalRecords] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditSummaryStats, setAuditSummaryStats] = useState({
    total_eventos: 0,
    creaciones: 0,
    actualizaciones: 0,
    permisos_modificados: 0,
    reseteos_password: 0,
    revocaciones_sesion: 0,
    cambios_roles: 0,
    bloqueos: 0,
    desbloqueos: 0
  });
  const [auditAvailableActions, setAuditAvailableActions] = useState([]);
  const [auditAvailableAdmins, setAuditAvailableAdmins] = useState([]);
  const [auditFetchError, setAuditFetchError] = useState('');

  const [isLoadingAudits, setIsLoadingAudits] = useState(false);
  const [sortConfigAuditoria, setSortConfigAuditoria] = useState({ key: 'performed_at', direction: 'desc' });
  const [selectedAuditDetail, setSelectedAuditDetail] = useState(null);
  const [auditSearchText, setAuditSearchText] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('Todos');
  const [auditAdminFilter, setAuditAdminFilter] = useState('Todos');
  const [auditResultFilter, setAuditResultFilter] = useState('Todos');
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedAuditDetail) {
        setSelectedAuditDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAuditDetail]);

  const fetchUserAudits = async (userId, customParams = {}) => {
    if (!userId) return;
    setIsLoadingAudits(true);
    setAuditFetchError('');
    try {
      if (typeof usersService?.getUserAuditoria === 'function') {
        const queryParams = {
          page: customParams.page !== undefined ? customParams.page : auditCurrentPage,
          pageSize: customParams.pageSize !== undefined ? customParams.pageSize : auditPageSize,
          fechaDesde: customParams.fechaDesde !== undefined ? customParams.fechaDesde : auditDateFrom,
          fechaHasta: customParams.fechaHasta !== undefined ? customParams.fechaHasta : auditDateTo,
          accion: customParams.accion !== undefined ? customParams.accion : auditActionFilter,
          adminId: customParams.adminId !== undefined ? customParams.adminId : auditAdminFilter,
          resultado: customParams.resultado !== undefined ? customParams.resultado : auditResultFilter,
          search: customParams.search !== undefined ? customParams.search : auditSearchText
        };
        const response = await usersService.getUserAuditoria(userId, queryParams);
        if (response && response.error) {
          setAuditFetchError(response.error);
          setRealUserAudits([]);
          setAuditTotalRecords(0);
          setAuditTotalPages(1);
        } else if (response && Array.isArray(response.items)) {
          setRealUserAudits(response.items || []);
          setAuditTotalRecords(response.total || 0);
          setAuditTotalPages(response.totalPages || 1);
          if (response.summaryStats) setAuditSummaryStats(response.summaryStats);
          if (Array.isArray(response.availableActions)) setAuditAvailableActions(response.availableActions);
          if (Array.isArray(response.availableAdmins)) setAuditAvailableAdmins(response.availableAdmins);
        } else if (Array.isArray(response)) {
          setRealUserAudits(response);
          setAuditTotalRecords(response.length);
          setAuditTotalPages(1);
        } else {
          setRealUserAudits([]);
          setAuditTotalRecords(0);
          setAuditTotalPages(1);
        }
      } else {
        setRealUserAudits([]);
      }
    } catch (error) {
      console.error('Error fetching audits:', error);
      setAuditFetchError(error.message || 'Error de conexión con el servidor.');
      setRealUserAudits([]);
    } finally {
      setIsLoadingAudits(false);
    }
  };

  useEffect(() => {
    if (activeTab360 === 'auditoria' && detailUser?.id) {
      fetchUserAudits(detailUser.id);
    }
  }, [activeTab360, detailUser?.id, auditCurrentPage, auditPageSize, auditActionFilter, auditAdminFilter, auditResultFilter, auditDateFrom, auditDateTo]);

  const handleExportAuditExcel = async () => {
    if (!detailUser?.id) return;
    try {
      const response = await usersService.getUserAuditoria(detailUser.id, {
        fechaDesde: auditDateFrom,
        fechaHasta: auditDateTo,
        accion: auditActionFilter,
        adminId: auditAdminFilter,
        resultado: auditResultFilter,
        search: auditSearchText,
        all: true
      });
      const dataToExport = (response && Array.isArray(response.items)) ? response.items : (Array.isArray(response) ? response : []);
      if (dataToExport.length === 0) return;

      const headers = ['ID Auditoría', 'Fecha y Hora', 'Acción', 'Administrador', 'Resultado', 'IP', 'Dispositivo', 'Motivo', 'Antes', 'Después'];
      const csvRows = [headers.join(',')];

      dataToExport.forEach(aud => {
        const row = [
          `"${aud.auditoria_id || aud.id || ''}"`,
          `"${formatSafeDateTime(aud.timestamp || aud.performed_at || aud.fecha_hora)}"`,
          `"${(aud.accion || aud.action || '').replace(/"/g, '""')}"`,
          `"${(aud.admin_nombre || aud.performed_by || '').replace(/"/g, '""')}"`,
          `"${(aud.resultado || aud.result || '').replace(/"/g, '""')}"`,
          `"${aud.direccion_ip || aud.ip || ''}"`,
          `"${(aud.dispositivo || aud.device || '').replace(/"/g, '""')}"`,
          `"${(aud.motivo || aud.reason || '').replace(/"/g, '""')}"`,
          `"${(aud.valor_anterior || aud.before_value || '').replace(/"/g, '""')}"`,
          `"${(aud.valor_nuevo || aud.after_value || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bitacora_auditoria_${(detailUser.full_name || 'usuario').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting audit CSV:', err);
    }
  };

  const handleExportAuditPdf = async () => {
    if (!detailUser?.id) return;
    try {
      const response = await usersService.getUserAuditoria(detailUser.id, {
        fechaDesde: auditDateFrom,
        fechaHasta: auditDateTo,
        accion: auditActionFilter,
        adminId: auditAdminFilter,
        resultado: auditResultFilter,
        search: auditSearchText,
        all: true
      });
      const audits = (response && Array.isArray(response.items)) ? response.items : (Array.isArray(response) ? response : []);
      if (audits.length === 0) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reporte de Auditoría - ${detailUser.full_name || 'Usuario'}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #111; padding: 24px; }
              .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
              h1 { font-size: 18px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
              .meta { font-size: 11px; color: #444; display: flex; gap: 16px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
              th { background-color: #f4f4f5; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #333; }
              .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; text-transform: uppercase; }
              .badge-success { background: #dcfce7; color: #166534; }
              .badge-danger { background: #fee2e2; color: #991b1b; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Ride Lab — Bitácora de Auditoría Administrativa</h1>
              <div class="meta">
                <span><strong>Usuario Auditado:</strong> ${detailUser.full_name || 'N/A'} (${detailUser.email || 'N/A'})</span>
                <span><strong>Fecha de Generación:</strong> ${new Date().toLocaleString('es-DO')}</span>
                <span><strong>Total Eventos:</strong> ${audits.length}</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Acción</th>
                  <th>Administrador</th>
                  <th>Resultado</th>
                  <th>IP</th>
                  <th>Motivo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                ${audits.map(aud => `
                  <tr>
                    <td style="white-space:nowrap;">${formatSafeDateTime(aud.timestamp || aud.performed_at || aud.fecha_hora)}</td>
                    <td><strong>${aud.accion || aud.action || 'Auditoría'}</strong></td>
                    <td>${aud.admin_nombre || aud.performed_by || 'Sistema'}</td>
                    <td><span class="badge ${String(aud.resultado || '').toUpperCase().includes('ERR') ? 'badge-danger' : 'badge-success'}">${aud.resultado || 'EXITOSO'}</span></td>
                    <td>${aud.direccion_ip || aud.ip || '—'}</td>
                    <td>${aud.motivo || aud.reason || '—'}</td>
                    <td style="font-family:monospace;font-size:10px;">${aud.valor_anterior || aud.before_value || '—'}</td>
                    <td style="font-family:monospace;font-size:10px;">${aud.valor_nuevo || aud.after_value || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (err) {
      console.error('Error exporting audit PDF:', err);
    }
  };

  const getFriendlyActionTitle = (accionStr) => {
    const act = String(accionStr || '').toUpperCase();
    if (act.includes('CREATE_USER') || act.includes('CREAR_USUARIO')) return 'Creación de Cuenta';
    if (act.includes('UPDATE_USER') || act.includes('EDITAR_USUARIO')) return 'Actualización de Perfil';
    if (act.includes('DELETE_USER') || act.includes('ELIMINAR_USUARIO')) return 'Eliminación de Cuenta';
    if (act.includes('RESET_PASSWORD')) return 'Restablecimiento de Contraseña';
    if (act.includes('CHANGE_PASSWORD')) return 'Cambio de Contraseña';
    if (act.includes('ASSIGN_ROLE')) return 'Asignación de Rol';
    if (act.includes('REMOVE_ROLE')) return 'Remoción de Rol';
    if (act.includes('PERMISSION')) return 'Modificación de Permisos';
    if (act.includes('ALL_SESSIONS_REVOKED')) return 'Revocación Masiva de Sesiones';
    if (act.includes('SESSION_REVOKED')) return 'Revocación de Sesión';
    if (act.includes('LOGOUT')) return 'Cierre de Sesión';
    if (act.includes('LOGIN')) return 'Inicio de Sesión';
    if (act.includes('LOCK_ACCOUNT')) return 'Bloqueo de Cuenta';
    if (act.includes('UNLOCK_ACCOUNT')) return 'Desbloqueo de Cuenta';
    if (act.includes('ENABLE_MFA')) return 'Activación de MFA';
    if (act.includes('DISABLE_MFA')) return 'Desactivación de MFA';
    if (act.includes('CHANGE_EMAIL')) return 'Cambio de Correo Electrónico';
    if (act.includes('CHANGE_COMPANY')) return 'Cambio de Empresa';
    if (act.includes('CHANGE_DEPARTMENT')) return 'Cambio de Departamento';
    if (act.includes('CHANGE_AREA')) return 'Cambio de Área';
    if (act.includes('CHANGE_POSITION')) return 'Cambio de Cargo';
    return accionStr || 'Evento de Auditoría';
  };

  const getNaturalSummaryText = (audit) => {
    const act = String(audit.accion || audit.action || '').toUpperCase();
    const reason = audit.motivo || audit.reason || '';

    if (act.includes('RESET_PASSWORD')) return 'Un administrador restableció forzosamente la contraseña de esta cuenta.';
    if (act.includes('ALL_SESSIONS_REVOKED')) return 'Se revocaron todas las sesiones activas en todos los dispositivos.';
    if (act.includes('SESSION_REVOKED')) return reason || 'Se revocó una sesión de usuario específica por razones de seguridad.';
    if (act.includes('CREATE')) return 'Se creó el registro inicial de la cuenta en el directorio de usuarios.';
    if (act.includes('UPDATE')) return reason || 'Se modificaron datos del perfil o configuración del usuario.';
    if (act.includes('ROLE')) return reason || 'Se actualizaron los roles funcionales asignados a esta cuenta.';
    if (act.includes('PERMIS')) return reason || 'Se modificó la matriz de permisos administrativos de la cuenta.';
    if (act.includes('LOCK')) return 'La cuenta de usuario fue bloqueada administrativamente.';
    if (act.includes('UNLOCK')) return 'La cuenta de usuario fue desbloqueada por un administrador.';

    return reason || 'Operación administrativa registrada en la bitácora.';
  };

  const getSemanticColorClass = (audit) => {
    const res = String(audit.resultado || audit.result || '').toUpperCase();
    const act = String(audit.accion || audit.action || '').toUpperCase();

    // Priority 1: Error -> Red
    if (res.includes('ERROR') || res.includes('FALLID') || res.includes('RECHAZAD')) {
      return {
        border: 'border-rose-500/30',
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        nodeBg: 'bg-rose-500',
        badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    }
    // Priority 2: Warning -> Amber
    if (res.includes('ADVERT') || res.includes('WARN') || act.includes('LOCK') || act.includes('BLOQUE')) {
      return {
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        nodeBg: 'bg-amber-500',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    }
    // Priority 3: Permissions & Roles -> Purple
    if (act.includes('PERMIS') || act.includes('ROLE') || act.includes('ROL')) {
      return {
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        nodeBg: 'bg-purple-500',
        badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      };
    }
    // Priority 4: Security (Password, Revoke, MFA) -> Amber or Emerald based on status
    if (act.includes('PASSWORD') || act.includes('SESSION') || act.includes('MFA')) {
      return {
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        nodeBg: 'bg-amber-500',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    }
    // Priority 5: Normal Successful Operation -> Emerald
    if (res.includes('EXITO') || res.includes('ÉXITO') || res.includes('COMPLET') || res.includes('OK')) {
      return {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        nodeBg: 'bg-emerald-500',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    }
    // Priority 6: Information / Default -> Sky / Project Accent
    return {
      border: 'border-sky-500/30',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      nodeBg: 'bg-sky-500',
      badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    };
  };

  const groupAuditsByDate = (audits) => {
    const groups = {};
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    (audits || []).forEach(audit => {
      let rawDate = audit.fecha_hora || audit.performed_at || audit.timestamp;
      let dateObj = null;
      if (rawDate) {
        let str = String(rawDate).trim();
        if (str.includes(' ') && !str.includes('T')) {
          str = str.replace(' ', 'T');
        }
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
      }

      if (!dateObj) {
        const key = 'Histórico';
        if (!groups[key]) groups[key] = [];
        groups[key].push(audit);
        return;
      }

      const dateStr = dateObj.toDateString();
      let label = '';
      if (dateStr === todayStr) {
        label = 'Hoy';
      } else if (dateStr === yesterdayStr) {
        label = 'Ayer';
      } else {
        const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 7) {
          label = 'Esta semana';
        } else if (diffDays <= 30) {
          label = 'Este mes';
        } else {
          label = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
        }
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(audit);
    });

    return groups;
  };

  const parseDiffValues = (beforeVal, afterVal) => {
    const sensitiveKeys = ['password', 'password_hash', 'pass', 'token', 'refresh_token', 'secret', 'otp', 'cookie', 'credential'];
    
    let beforeObj = null;
    let afterObj = null;

    try {
      if (typeof beforeVal === 'object' && beforeVal !== null) beforeObj = beforeVal;
      else if (typeof beforeVal === 'string' && (beforeVal.startsWith('{') || beforeVal.startsWith('['))) beforeObj = JSON.parse(beforeVal);
    } catch (e) {}

    try {
      if (typeof afterVal === 'object' && afterVal !== null) afterObj = afterVal;
      else if (typeof afterVal === 'string' && (afterVal.startsWith('{') || afterVal.startsWith('['))) afterObj = JSON.parse(afterVal);
    } catch (e) {}

    if (beforeObj && afterObj && typeof beforeObj === 'object' && typeof afterObj === 'object') {
      const diffs = [];
      const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

      allKeys.forEach(k => {
        const isSensitive = sensitiveKeys.some(sk => k.toLowerCase().includes(sk));
        if (isSensitive) return;

        const valBefore = beforeObj[k];
        const valAfter = afterObj[k];

        if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
          diffs.push({
            field: k.replace(/_/g, ' ').toUpperCase(),
            before: valBefore !== undefined && valBefore !== null ? String(valBefore) : '—',
            after: valAfter !== undefined && valAfter !== null ? String(valAfter) : '—'
          });
        }
      });

      if (diffs.length > 0) return { isParsed: true, diffs };
    }

    const parseSimpleString = (str) => {
      if (!str || str === '—') return null;
      const parts = str.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
        if (isSensitive) return { field: key, value: '••••••••' };
        return { field: key, value: parts[1].trim() };
      }
      return null;
    };

    const bSimple = parseSimpleString(String(beforeVal || ''));
    const aSimple = parseSimpleString(String(afterVal || ''));

    if (bSimple || aSimple) {
      const field = (aSimple?.field || bSimple?.field || 'ESTADO').toUpperCase();
      return {
        isParsed: true,
        diffs: [{
          field,
          before: bSimple ? bSimple.value : String(beforeVal || '—'),
          after: aSimple ? aSimple.value : String(afterVal || '—')
        }]
      };
    }

    return {
      isParsed: false,
      before: String(beforeVal || '—'),
      after: String(afterVal || '—')
    };
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
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 cursor-pointer" 
        onClick={() => handleStartEdit360(item, 'resumen')}
      >
        <Edit2 size={13} className="text-[var(--text-muted)]" /> Editar perfil
      </button>,
      <button 
        key="reset-password-manual"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 cursor-pointer" 
        onClick={() => handleOpenResetPasswordModal(item)}
      >
        <KeyRound size={13} className="text-primary" /> Restablecer contraseña
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
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
            onClick={() => handleOpenResetPasswordModal(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
          </button>
        );
      } else if (actStatus === 'FIRST_LOGIN_COMPLETED') {
        items.push(
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
            onClick={() => handleOpenResetPasswordModal(item)}
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
            key="reset-pw-doc"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleOpenResetPasswordModal(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
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
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
          </button>
        );
      } else if (actStatus === 'INITIAL_PASSWORD_CHANGED') {
        items.push(
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
            onClick={() => handleOpenResetPasswordModal(item)}
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
            key="reset-pw-blocked"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleOpenResetPasswordModal(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Restablecer clave
          </button>,
          <button 
            key="view-history"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5" 
            onClick={() => handleViewDetail(item, 'resumen')}
          >
            <Clock size={13} className="text-[var(--text-muted)]" /> Ver detalle
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
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-foreground-disabled dark:bg-surface-subtle dark:text-foreground-muted">Estado no disponible</span>;
    }

    const isEmail = method === 'EMAIL';
    
    if (isEmail) {
      switch (finalStatus) {
        case 'DRAFT':
        case 'INVITATION_PENDING':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-foreground-disabled dark:bg-surface-subtle dark:text-foreground-muted">Pendiente de envío</span>;
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
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-700/10 dark:text-foreground-muted">Revocada</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-foreground-disabled dark:bg-surface-subtle dark:text-foreground-muted">Estado no disponible</span>;
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
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-700/10 dark:text-foreground-muted">Revocada</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-foreground-disabled dark:bg-surface-subtle dark:text-foreground-muted">Estado no disponible</span>;
      }
    }
  };

  function renderUserDetail() {
    if (isLoading && isSelfMode) {
      return (
        <div className="p-12 text-center text-foreground-muted font-mono">
          <RotateCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <span>Cargando perfil...</span>
        </div>
      );
    }

    if (profileLoadError && isSelfMode) {
      return (
        <div className="p-8 text-center bg-card border border-rose-500/30 rounded-2xl my-8 font-mono shadow-xl max-w-xl mx-auto">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">Error de Carga</h3>
          <p className="text-sm text-foreground-secondary mb-6">{profileLoadError}</p>
          <button
            type="button"
            onClick={loadSelfProfile}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/20 transition-all shadow-lg cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (!detailUser) return null;
    return (
      <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300 p-6 font-mono text-xs w-full">
        
        {/* Toast Notification Banner */}
        {resetToast && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between font-mono text-xs shadow-xl animate-in slide-in-from-top duration-300 ${
            resetToast.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <div className="flex items-center gap-2.5">
              {resetToast.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
              <span className="font-bold">{resetToast.message}</span>
            </div>
            <button onClick={() => setResetToast(null)} className="p-1 hover:opacity-80 cursor-pointer rounded-lg hover:bg-surface-subtle transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 360 Header Banner */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
          
          <div className="flex items-center gap-4">
            {!isSelfMode && (
              <button 
                type="button"
                onClick={handleGoBack}
                className="p-2 rounded-xl bg-input border border-border text-foreground-muted hover:text-foreground hover:border-primary transition-all shadow-lg shrink-0 cursor-pointer"
                title="Volver al listado"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="w-12 h-12 rounded-xl bg-surface-subtle text-primary border border-border flex items-center justify-center font-bold text-sm shrink-0 shadow-lg font-mono">
              {detailUser.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-foreground font-mono">{detailUser.full_name}</h2>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  (String(detailUser.status || detailUser.estado || '').toUpperCase() === 'ACTIVO' || String(detailUser.status || detailUser.estado || '').toUpperCase() === 'ACTIVE') 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>{detailUser.status || detailUser.estado}</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">{detailUser.role}</span>
              </div>
              <p className="text-xs text-foreground-muted font-mono mt-1 flex items-center gap-2">
                <span>{detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_type === 'DOCUMENT' ? 'Documento' : 'Correo'}: <strong className="text-primary">{detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_value || detailUser.email}</strong></span> • <span>MFA: <strong className="text-foreground">{detailUser.mfaEnabled ? 'Activo' : 'Inactivo'}</strong></span>
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
                  className="px-4 py-2 rounded-xl border border-border bg-input hover:border-slate-500 text-foreground-secondary text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => handleTriggerSaveEdit360()}
                  className="px-5 py-2 rounded-xl border border-primary bg-primary hover:bg-primary text-primary-foreground text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Save size={14} /> Guardar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenResetPasswordModal(detailUser)}
                  className="px-4 py-2 rounded-xl border border-primary/40 hover:bg-primary/20 text-xs font-bold transition-all text-primary bg-primary/10 flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <KeyRound size={13} />
                  <span>Restablecer contraseña</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    handleStartEdit360(detailUser, 'resumen');
                  }}
                  className="px-4 py-2 rounded-xl border border-primary/40 hover:bg-primary/20 text-xs font-bold transition-all text-primary bg-primary/10 flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Edit2 size={13} /> Editar
                </button>
              </>
            )}
            <button onClick={handleGoBack} className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-subtle rounded-xl transition-all cursor-pointer" title="Cerrar detalle">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Selector */}
        <div className="bg-card border border-border rounded-2xl p-2 flex items-center gap-2 font-mono text-xs overflow-x-auto scrollbar-none shadow-xl select-none">
          {[
            { id: 'resumen', label: 'Resumen' },
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
              className={`px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                activeTab360 === t.id 
                  ? 'bg-primary/10 border border-primary/40 text-primary' 
                  : 'bg-transparent border border-transparent text-foreground-muted hover:text-foreground hover:bg-input'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="space-y-6 font-mono text-xs">
          
          {/* TAB RESUMEN */}
          {activeTab360 === 'resumen' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {isEditing360 && wizardData ? (
                // EDIT MODE FORM
                <div className="space-y-6">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Información Personal Edit */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                      <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Users size={16} className="text-primary" /> Información Personal</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 flex items-center gap-2 mb-1">
                          <label className="font-bold text-foreground-muted text-xs">Usuario ID:</label>
                          <span className="font-mono font-bold text-foreground text-xs">{detailUser.id || detailUser.usuario_id || '—'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs items-center">
                        <span className="text-foreground-muted font-bold">Nombre: <span className="text-red-400">*</span></span>
                        <div className="flex flex-col w-full">
                          <input
                            type="text"
                            value={wizardData.first_name || ''}
                            onChange={(e) => handleChange('first_name', e.target.value)}
                            className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none w-full ${formErrors360.first_name ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                            placeholder="Nombre"
                          />
                          {formErrors360.first_name && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.first_name}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Apellido: <span className="text-red-400">*</span></span>
                        <div className="flex flex-col w-full">
                          <input
                            type="text"
                            value={wizardData.last_name || ''}
                            onChange={(e) => handleChange('last_name', e.target.value)}
                            className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none w-full ${formErrors360.last_name ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                            placeholder="Apellido"
                          />
                          {formErrors360.last_name && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.last_name}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Documento:</span>
                        <div className="flex flex-col w-full">
                          <div className="flex gap-2 w-full">
                            <select
                              value={wizardData.document_type || 'Cédula'}
                              onChange={(e) => handleChange('document_type', e.target.value)}
                              className="px-2 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary"
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
                              className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none flex-1 min-w-0 ${formErrors360.document_number ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                              placeholder="Número"
                            />
                          </div>
                          {formErrors360.document_number && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.document_number}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Correo Electrónico:</span>
                        <div className="flex flex-col w-full">
                          <input
                            type="email"
                            value={wizardData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none w-full ${formErrors360.email ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                            placeholder="Correo electrónico"
                          />
                          {formErrors360.email && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.email}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Departamento:</span>
                        <select
                          value={wizardData.department_id || ''}
                          onChange={(e) => {
                            const deptId = e.target.value;
                            const deptObj = departments.find(d => d.id == deptId);
                            handleChange('department_id', deptId);
                            handleChange('department', deptObj ? deptObj.name : '');
                          }}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Departamento</option>
                          {departments
                            
                            .map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))
                          }
                        </select>
                        <span className="text-foreground-muted font-bold">Área:</span>
                        <select
                          value={wizardData.area_id || ''}
                          onChange={(e) => {
                            const aId = e.target.value;
                            const aObj = areas.find(a => a.id == aId);
                            handleChange('area_id', aId);
                            handleChange('area', aObj ? aObj.name : '');
                          }}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Área</option>
                          {areas
                            .filter(a => a.department_id == wizardData.department_id)
                            .map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))
                          }
                        </select>
                        <span className="text-foreground-muted font-bold">Cargo / Posición:</span>
                        <select value={wizardData.cargo_id || ''} onChange={(e) => { const cId = e.target.value; handleChange('cargo_id', cId); const cargoObj = cargos.find(c => c.id == cId); handleChange('job_title', cargoObj ? cargoObj.name : ''); }}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Cargo</option>
                          {cargos.map(c => ( <option key={c.id} value={c.id}>{c.name}</option> ))}
                        </select>
                      </div>
                    </div>
 
                    {/* Parámetros de Acceso Edit */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                      <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Key size={16} className="text-primary" /> Parámetros de Acceso</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs items-center">
                        <span className="text-foreground-muted font-bold">Método de acceso principal:</span>
                        <select
                          value={wizardData.primary_access_type || 'EMAIL'}
                          onChange={(e) => handleChange('primary_access_type', e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="EMAIL">Correo electrónico</option>
                          <option value="DOCUMENT">Documento</option>
                        </select>
                        
                        <span className="text-foreground-muted font-bold">Identificador de acceso:</span>
                        {wizardData.primary_access_type === 'EMAIL' ? (
                          <div className="flex flex-col w-full">
                            <span className="font-mono font-bold text-foreground-secondary bg-input px-3 py-2 rounded-xl border border-border truncate opacity-70 cursor-not-allowed text-xs" title={wizardData.email}>
                              {wizardData.email || 'Se utilizará el correo indicado arriba'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col w-full">
                            <span className="font-mono font-bold text-foreground-secondary bg-input px-3 py-2 rounded-xl border border-border truncate opacity-70 cursor-not-allowed text-xs" title={wizardData.document_number}>
                              {wizardData.document_number || 'Se utilizará el documento indicado arriba'}
                            </span>
                          </div>
                        )}
                        
                        <span className="text-foreground-muted font-bold">Canales Permitidos:</span>
                        <div className="flex gap-4 items-center font-mono">
                          <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                            <input
                              type="checkbox"
                              checked={!!wizardData.web_access_enabled}
                              onChange={(e) => handleChange('web_access_enabled', e.target.checked)}
                              className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4"
                            />
                            Web
                          </label>
                          <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                            <input
                              type="checkbox"
                              checked={!!wizardData.mobile_access_enabled}
                              onChange={(e) => handleChange('mobile_access_enabled', e.target.checked)}
                              className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4"
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
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                      <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Building2 size={16} className="text-primary" /> Relación y Asignación</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs items-center">
                        <span className="text-foreground-muted font-bold">Empresa: <span className="text-red-400">*</span></span>
                        <div className="flex flex-col w-full">
                          <select
                            value={wizardData.companyId || ''}
                            onChange={(e) => handleChange('companyId', e.target.value)}
                            className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none w-full ${formErrors360.companyId ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                          >
                            <option value="">Seleccione Empresa</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {formErrors360.companyId && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.companyId}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Tipo de Usuario:</span>
                        <select
                          value={wizardData.tipo_usuario_id || ''}
                          onChange={(e) => {
                            const valId = e.target.value;
                            const obj = userTypes.find(t => t.id == valId);
                            handleChange('tipo_usuario_id', valId);
                            if (obj) handleChange('user_type', obj.name);
                          }}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="">Seleccione Tipo</option>
                          {userTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <span className="text-foreground-muted font-bold">Rol Asignado: <span className="text-red-400">*</span></span>
                        <div className="flex flex-col w-full">
                          <select value={wizardData.rol_id || ''} onChange={(e) => { const rId = e.target.value; handleChange('rol_id', rId); const rolObj = roles.find(r => r.id == rId); handleChange('role', rolObj ? rolObj.name : ''); }}
                            className={`px-3 py-2 text-xs rounded-xl border bg-input text-foreground font-mono font-bold focus:outline-none w-full ${formErrors360.rol_id ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-primary'}`}
                          >
                            <option value="">Seleccione Rol</option>
                            {roles.map(r => ( <option key={r.id} value={r.id}>{r.name}</option> ))}
                          </select>
                          {formErrors360.rol_id && <span className="text-red-400 text-[10px] mt-0.5 font-bold">{formErrors360.rol_id}</span>}
                        </div>
                        <span className="text-foreground-muted font-bold">Roles Adicionales:</span>
                        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto border border-border p-2.5 rounded-xl bg-input custom-scrollbar">
{roles.filter(r => r.id != wizardData.rol_id).map(r => (
  <label key={r.id} className="flex items-center gap-2 font-bold cursor-pointer select-none text-xs text-foreground">
    <input
      type="checkbox"
      checked={(wizardData.roles_additional || []).includes(r.id)}
      onChange={(e) => {
        const newRoles = e.target.checked 
          ? [...(wizardData.roles_additional || []), r.id] 
          : (wizardData.roles_additional || []).filter(roleId => roleId !== r.id);
        handleChange('roles_additional', newRoles);
      }}
      className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4"
    />
    {r.name}
  </label>
))}
</div>
                      </div>
                    </div>
 
                    {/* Seguridad e Inicios Edit */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                      <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><ShieldCheck size={16} className="text-primary" /> Seguridad e Inicios</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs items-center">
                        <span className="text-foreground-muted font-bold">Autenticación MFA:</span>
                        <div className="flex gap-2 items-center">
                          <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                            <input
                              type="checkbox"
                              checked={!!wizardData.mfaEnabled}
                              onChange={(e) => handleChange('mfaEnabled', e.target.checked)}
                              className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4"
                            />
                            Activo
                          </label>
                          {wizardData.mfaEnabled && (
                            <select
                              value={wizardData.mfa_method || 'App autenticadora'}
                              onChange={(e) => handleChange('mfa_method', e.target.value)}
                              className="px-2 py-1 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary"
                            >
                              <option value="App autenticadora">App autenticadora</option>
                              <option value="SMS">SMS (Mensaje)</option>
                              <option value="Correo electrónico">Correo electrónico</option>
                            </select>
                          )}
                        </div>
                        <span className="text-foreground-muted font-bold">Expiración de acceso:</span>
                        <div className="flex gap-2 items-center w-full">
                          <input
                            type="date"
                            value={wizardData.access_expires_at ? wizardData.access_expires_at.split('T')[0] : ''}
                            onChange={(e) => handleChange('access_expires_at', e.target.value)}
                            className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleChange('access_expires_at', '')}
                            className="px-3 py-2 text-xs bg-input hover:bg-surface-subtle rounded-xl border border-border font-bold text-foreground-secondary transition-colors cursor-pointer"
                          >
                            Sin expiración
                          </button>
                        </div>
                        <span className="text-foreground-muted font-bold">Horario de acceso:</span>
                        <select
                          value={wizardData.allowed_hours || 'Cualquier horario'}
                          onChange={(e) => handleChange('allowed_hours', e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                        >
                          <option value="Cualquier horario">Sin restricción horaria (24/7)</option>
                          <option value="Horario de oficina (08:00 - 18:00)">Horario comercial (08:00 - 18:00)</option>
                          <option value="Horario diurno (06:00 - 22:00)">Horario diurno (06:00 - 22:00)</option>
                        </select>
                        <span className="text-foreground-muted font-bold">Restricción IP:</span>
                        <input
                          type="text"
                          value={wizardData.allowed_ips || '*'}
                          onChange={(e) => handleChange('allowed_ips', e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full"
                          placeholder="e.g. * o 192.168.1.1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Row 3 (Configuración Avanzada Edit) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                      <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Settings size={16} className="text-primary" /> Configuración Avanzada</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs items-center">
                        <span className="text-foreground-muted font-bold">Correo de Acceso:</span>
                        <input type="email" value={wizardData.correo_acceso || ''} onChange={(e) => handleChange('correo_acceso', e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full" placeholder="recovery@ejemplo.com" />
                        
                        <span className="text-foreground-muted font-bold">Enviar Invitación:</span>
                        <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                          <input type="checkbox" checked={!!wizardData.enviar_invitacion_correo} onChange={(e) => handleChange('enviar_invitacion_correo', e.target.checked)} className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4" /> Sí
                        </label>

                        <span className="text-foreground-muted font-bold">Generar Clave Automática:</span>
                        <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                          <input type="checkbox" checked={!!wizardData.generar_clave_automatica} onChange={(e) => handleChange('generar_clave_automatica', e.target.checked)} className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4" /> Sí
                        </label>

                        <span className="text-foreground-muted font-bold">Forzar Cambio de Clave:</span>
                        <label className="flex items-center gap-2 font-bold cursor-pointer select-none text-foreground">
                          <input type="checkbox" checked={!!wizardData.forzar_cambio_clave} onChange={(e) => handleChange('forzar_cambio_clave', e.target.checked)} className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4" /> Sí
                        </label>

                        <span className="text-foreground-muted font-bold">Idioma Preferido:</span>
                        <select value={wizardData.idioma_preferido || 'es'} onChange={(e) => handleChange('idioma_preferido', e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full">
                          <option value="es">Español</option>
                          <option value="en">Inglés</option>
                        </select>

                        <span className="text-foreground-muted font-bold">Zona Horaria:</span>
                        <select value={wizardData.zona_horaria || 'America/Santo_Domingo'} onChange={(e) => handleChange('zona_horaria', e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full">
                          <option value="America/Santo_Domingo">América/Santo Domingo</option>
                          <option value="America/New_York">América/New York</option>
                        </select>

                        <span className="text-foreground-muted font-bold">Formato de Fecha:</span>
                        <select value={wizardData.formato_fecha || 'DD/MM/YYYY'} onChange={(e) => handleChange('formato_fecha', e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-border bg-input text-foreground font-mono font-bold focus:outline-none focus:border-primary w-full">
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
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                    <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Users size={16} className="text-primary" /> Información Personal</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                      <span className="text-foreground-muted font-bold">Usuario ID:</span>
                      <span className="font-mono font-bold text-foreground">{detailUser.id || detailUser.usuario_id || '—'}</span>
                      <span className="text-foreground-muted font-bold">Nombre: <span className="text-red-400">*</span></span>
                      <span className="font-bold text-foreground">{detailUser.first_name || '—'}</span>
                      <span className="text-foreground-muted font-bold">Apellido: <span className="text-red-400">*</span></span>
                      <span className="font-bold text-foreground">{detailUser.last_name || '—'}</span>
                      <span className="text-foreground-muted font-bold">Documento:</span>
                      <span className="font-bold text-foreground">
                        {detailUser.document_number ? `${detailUser.document_type || 'Documento'}: ${detailUser.document_number}` : 'No registrado'}
                      </span>
                      <span className="text-foreground-muted font-bold">Correo Electrónico:</span>
                      <span className="font-bold text-primary hover:underline cursor-pointer">
                        {detailUser.email || 'No registrado'}
                      </span>
                      <span className="text-foreground-muted font-bold">Departamento:</span>
                      <span className="font-bold text-foreground">{detailUser.departamento_nombre || detailUser.department || 'No registrado'}</span>
                      <span className="text-foreground-muted font-bold">Área:</span>
                      <span className="font-bold text-foreground">{detailUser.area_nombre || detailUser.area || 'No registrada'}</span>
                      <span className="text-foreground-muted font-bold">Cargo / Posición:</span>
                      <span className="font-bold text-foreground">{detailUser.cargo_nombre || detailUser.job_title || 'No registrado'}</span>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                    <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Key size={16} className="text-primary" /> Parámetros de Acceso</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                      <span className="text-foreground-muted font-bold">Método de acceso principal:</span>
                      <span className="font-bold text-foreground">
                        {detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_type === 'DOCUMENT' ? 'Documento' : 'Correo electrónico'}
                      </span>
                      
                      <span className="text-foreground-muted font-bold">Identificador de acceso:</span>
                      <span className="font-mono font-bold text-primary">
                        {detailUser.login_identifiers?.find(id => id.is_primary)?.identifier_value || '—'}
                      </span>
                      
                      <span className="text-foreground-muted font-bold">Estado de verificación:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase border tracking-wider ${
                        detailUser.estado_verificacion === 'Verificado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {detailUser.estado_verificacion || 'No verificado'}
                      </span>

                      <span className="text-foreground-muted font-bold">Canales Permitidos:</span>
                      <span className="font-bold text-foreground">
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
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                    <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Building2 size={16} className="text-primary" /> Relación y Asignación</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                      <span className="text-foreground-muted font-bold">Empresa: <span className="text-red-400">*</span></span>
                      <span className="font-bold text-foreground">
                        {detailUser.empresa_nombre || companies.find(c => c.id == detailUser.companyId)?.name || 'Sin empresa asignada'}
                      </span>
                      <span className="text-foreground-muted font-bold">Tipo de Usuario:</span>
                      <span className="bg-surface-subtle border border-border text-foreground-secondary font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded w-fit">{detailUser.user_type || userTypes.find(t => t.id == detailUser.tipo_usuario_id)?.name || '—'}</span>
                      <span className="text-foreground-muted font-bold">Rol Asignado: <span className="text-red-400">*</span></span>
                      <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit">{detailUser.role || detailUser.role_name || '—'}</span>
                      <span className="text-foreground-muted font-bold">Permisos:</span>
                      <span className="font-bold text-foreground">
                        {Object.keys(detailUser.permissionsOverride || {}).length > 0 ? 'Específica (Permisos Adicionales)' : 'Heredados del rol'}
                      </span>
                      <span className="text-foreground-muted font-bold">Roles Adicionales:</span>
                      <span className="font-bold text-foreground">
                        {detailUser.roles_additional?.length > 0 
                          ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') 
                          : 'Ninguno'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                    <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><ShieldCheck size={16} className="text-primary" /> Seguridad e Inicios</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                      <span className="text-foreground-muted font-bold">Autenticación MFA:</span>
                      <span className="font-bold text-foreground">{detailUser.mfaEnabled ? `Sí (${detailUser.mfa_method || '—'})` : 'No'}</span>
                      <span className="text-foreground-muted font-bold">Expiración de acceso:</span>
                      <span className="font-bold text-foreground">{formatExpiracionDate(detailUser.access_expires_at)}</span>
                      <span className="text-foreground-muted font-bold">Horario de acceso:</span>
                      <span className="font-bold text-foreground">
                        {!detailUser.allowed_hours || detailUser.allowed_hours === 'Cualquier horario' ? 'Sin restricción horaria' : detailUser.allowed_hours}
                      </span>
                      <span className="text-foreground-muted font-bold">Restricción IP:</span>
                      <span className="font-bold text-foreground font-mono">
                        {!detailUser.allowed_ips || detailUser.allowed_ips === '*' ? 'Sin restricción' : detailUser.allowed_ips}
                      </span>
                      <span className="text-foreground-muted font-bold">Creado El:</span>
                      <span className="font-bold text-foreground">{formatSafeDate(detailUser.createdAt)}</span>
                      <span className="text-foreground-muted font-bold">Último Acceso:</span>
                      <span className="font-bold text-foreground">{detailUser.last_login_at ? formatSafeDateTime(detailUser.last_login_at) : 'Nunca'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3 (Configuración Avanzada) */}
              {!isEditing360 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
                    <h4 className="font-bold text-foreground text-xs border-b border-border pb-3 flex items-center gap-2 uppercase tracking-wider"><Settings size={16} className="text-primary" /> Configuración Avanzada</h4>
                    <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                      <span className="text-foreground-muted font-bold">Correo de Acceso (Recovery):</span>
                      <span className="font-bold text-primary font-mono">{detailUser.correo_acceso || 'No registrado'}</span>
                      
                      <span className="text-foreground-muted font-bold">Enviar Invitación (Email):</span>
                      <span className="font-bold text-foreground">{detailUser.enviar_invitacion_correo ? 'Sí' : 'No'}</span>
                      
                      <span className="text-foreground-muted font-bold">Generar Clave Automática:</span>
                      <span className="font-bold text-foreground">{detailUser.generar_clave_automatica ? 'Sí' : 'No'}</span>
                      
                      <span className="text-foreground-muted font-bold">Forzar Cambio de Clave:</span>
                      <span className="font-bold text-foreground">{detailUser.forzar_cambio_clave ? 'Sí' : 'No'}</span>
                      
                      <span className="text-foreground-muted font-bold">Idioma Preferido:</span>
                      <span className="font-bold text-foreground">
                        {detailUser.idioma_preferido === 'en' ? 'Inglés' : detailUser.idioma_preferido === 'es' ? 'Español' : (detailUser.idioma_preferido || 'es')}
                      </span>
                      
                      <span className="text-foreground-muted font-bold">Zona Horaria:</span>
                      <span className="font-bold text-foreground">{detailUser.zona_horaria || 'America/Santo_Domingo'}</span>
                      
                      <span className="text-foreground-muted font-bold">Formato de Fecha:</span>
                      <span className="font-bold text-foreground">{detailUser.formato_fecha || 'DD/MM/YYYY'}</span>
                    </div>
                  </div>
                </div>
              )}
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
                    <div className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-xl font-mono text-xs">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Rol Principal</span>
                      {isEditing360 && wizardData ? (
                        <select 
                          value={wizardData.rol_id || ''} 
                          onChange={(e) => { 
                            const rId = e.target.value; 
                            handleChange('rol_id', rId); 
                            const rolObj = roles.find(r => r.id == rId); 
                            handleChange('role', rolObj ? rolObj.name : ''); 
                          }}
                          className="w-full bg-input border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-primary focus:outline-none focus:border-primary"
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
                    <div className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-xl font-mono text-xs">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Roles adicionales</span>
                      {isEditing360 && wizardData ? (
                        <div className="relative group">
                          <div className="w-full bg-input border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground cursor-pointer flex justify-between items-center shadow-sm">
                             <span className="truncate">
                               {(wizardData.roles_additional?.length || 0)} roles seleccionados
                             </span>
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-muted"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                          <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-50 hidden group-hover:block max-h-[160px] overflow-y-auto custom-scrollbar">
                            {roles.filter(r => r.id != wizardData.rol_id).map(r => (
                               <label key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-input cursor-pointer border-b border-border/50 last:border-0 transition-colors">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-primary focus:ring-primary bg-input border-border cursor-pointer"
                                    checked={(wizardData.roles_additional || []).includes(r.id)}
                                    onChange={() => {
                                      const newRoles = (wizardData.roles_additional || []).includes(r.id)
                                        ? (wizardData.roles_additional || []).filter(roleId => roleId !== r.id)
                                        : [...(wizardData.roles_additional || []), r.id];
                                      handleChange('roles_additional', newRoles);
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-foreground">{r.name}</span>
                               </label>
                            ))}
                            {roles.filter(r => r.id != wizardData.rol_id).length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-foreground-muted italic">No hay más roles disponibles.</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-foreground block mt-1 truncate" title={detailUser.roles_additional?.length > 0 ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') : 'Ninguno'}>
                          {detailUser.roles_additional?.length > 0 
                            ? detailUser.roles_additional.map(id => roles.find(r => r.id == id)?.name || id).join(', ') 
                            : 'Ninguno'}
                        </span>
                      )}
                    </div>
                    <div className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-xl font-mono text-xs">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">Permisos adicionales creados</span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        {overridesCount}
                      </span>
                    </div>
                    <div className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-xl font-mono text-xs">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">Módulos permitidos</span>
                      <span className="text-sm font-black text-foreground font-mono">
                        {modulesCount} / {modules.length}
                      </span>
                    </div>
                    <div className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-xl font-mono text-xs col-span-1 sm:col-span-2 lg:col-span-1">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">Acciones críticas</span>
                      <span className="text-xs font-bold text-primary truncate block" title={criticalsStr}>
                        {criticalsStr}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-border pb-3 gap-3 font-mono text-xs">
                <div>
                  <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">Matriz de Permisos Efectivos</h4>
                  <p className="text-[11px] text-foreground-muted mt-0.5">Consulta de permisos consolidados (Heredados + Adicionales). No modificable directamente.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold select-none">
                  <span className="text-[10px] text-foreground-muted mr-1 uppercase tracking-wider">Filtrar:</span>
                  <button 
                    onClick={() => setMatrixFilter('all')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      matrixFilter === 'all'
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                        : 'bg-card text-foreground-muted border-border hover:text-foreground hover:bg-input'
                    }`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setMatrixFilter('base')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      matrixFilter === 'base'
                        ? 'bg-primary/20 text-primary border-primary/50 shadow-lg'
                        : 'bg-card text-foreground-muted border-border hover:text-foreground hover:bg-input'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary"></span> 
                    Rol Principal
                  </button>
                  <button 
                    onClick={() => setMatrixFilter('additional')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      matrixFilter === 'additional'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-lg'
                        : 'bg-card text-foreground-muted border-border hover:text-foreground hover:bg-input'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span> 
                    Roles Adicionales
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-border rounded-2xl bg-card custom-scrollbar shadow-xl">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-input font-bold text-foreground-muted text-[11px] uppercase tracking-wider">
                      <th className="py-3.5 px-4 tracking-wider text-foreground">Módulo / Sección</th>
                      <th className="py-3.5 px-1 text-center w-14 tracking-wider text-primary">FULL</th>
                      {ALL_ACTIONS.map(act => <th key={act.id} className="py-3.5 px-1 text-center w-14 tracking-wider text-foreground-muted">{act.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3748] bg-card">
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
                        <tr key={mod.id} className="hover:bg-hover transition-colors">
                          <td className="py-3 px-4 font-bold text-foreground text-xs uppercase">{mod.name || mod.label || mod.nombre || `Módulo ${mod.id}`}</td>
                          
                          {/* FULL Column (Read Only) */}
                          <td className="py-3 px-1 text-center select-none">
                            <div className="flex justify-center">
                              {allChecked ? (
                                <CheckSquare size={16} className="text-primary" />
                              ) : (
                                <Square size={16} className="text-foreground-muted opacity-30" />
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
                                        <CheckSquare size={16} className="text-primary" />
                                      )}
                                    </div>
                                  ) : (
                                    <Square size={16} className="text-foreground-muted opacity-30" />
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
            <div className="space-y-4 animate-in fade-in duration-200 font-mono">
              {(() => {
                const userSessions = realUserSessions;
                const activeSessionsCount = userSessions.filter(s => s.estado === 'ACTIVA').length;
                const staleSessionsCount = userSessions.filter(s => s.estado === 'POSIBLEMENTE COLGADA').length;
                const closedSessionsCount = userSessions.filter(s => s.estado === 'CERRADA').length;
                const revokedSessionsCount = userSessions.filter(s => s.estado === 'REVOCADA').length;
                const expiredSessionsCount = userSessions.filter(s => s.estado === 'EXPIRADA').length;

                // Filtering & Search
                const filtered = userSessions.filter(s => {
                  const matchesSearch = !sessionSearchText || 
                    (s.device || s.dispositivo_navegador || '').toLowerCase().includes(sessionSearchText.toLowerCase()) ||
                    (s.ip || s.direccion_ip || '').toLowerCase().includes(sessionSearchText.toLowerCase()) ||
                    (s.location || s.ubicacion || '').toLowerCase().includes(sessionSearchText.toLowerCase());

                  if (!matchesSearch) return false;

                  if (sessionFilterStatus === 'Activas') return s.estado === 'ACTIVA';
                  if (sessionFilterStatus === 'Posiblemente colgadas') return s.estado === 'POSIBLEMENTE COLGADA';
                  if (sessionFilterStatus === 'Cerradas') return s.estado === 'CERRADA';
                  if (sessionFilterStatus === 'Revocadas') return s.estado === 'REVOCADA';
                  if (sessionFilterStatus === 'Expiradas') return s.estado === 'EXPIRADA';
                  return true;
                });

                // Sorting
                const sorted = [...filtered].sort((a, b) => {
                  const key = sortConfigSesiones.key;
                  let aVal = a[key] || '';
                  let bVal = b[key] || '';
                  if (key === 'last_activity_at' || key === 'ultima_actividad') {
                    aVal = new Date(a.last_activity_at || a.ultima_actividad || a.login_time || a.fecha_inicio || 0).getTime();
                    bVal = new Date(b.last_activity_at || b.ultima_actividad || b.login_time || b.fecha_inicio || 0).getTime();
                  } else if (key === 'login_time' || key === 'fecha_inicio') {
                    aVal = new Date(a.login_time || a.fecha_inicio || 0).getTime();
                    bVal = new Date(b.login_time || b.fecha_inicio || 0).getTime();
                  }
                  if (aVal < bVal) return sortConfigSesiones.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortConfigSesiones.direction === 'asc' ? 1 : -1;
                  return 0;
                });

                // Pagination
                const totalPages = Math.ceil(sorted.length / sessionPageSize) || 1;
                const currentPage = Math.min(sessionCurrentPage, totalPages);
                const paginated = sorted.slice((currentPage - 1) * sessionPageSize, currentPage * sessionPageSize);

                return (
                  <>
                    {/* Section Header & Bulk Revoke */}
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h4 className="font-black text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                          <ShieldCheck className="text-primary" size={18} />
                          HISTORIAL DE SESIONES
                        </h4>
                        <p className="text-[11px] text-foreground-muted mt-0.5">
                          Monitor continuo de conexiones activas, historial de accesos e inactividad en Ride Lab.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchUserSessions(detailUser.id)}
                          className="p-2.5 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs transition-all cursor-pointer"
                          title="Actualizar lista de sesiones"
                        >
                          <RefreshCw size={14} className={isLoadingSessions ? "animate-spin text-primary" : ""} />
                        </button>
                        <button 
                          onClick={() => handleRevokeAllSessions(detailUser.id)}
                          className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                        >
                          <ShieldX size={15} />
                          Revocar todas las sesiones
                        </button>
                      </div>
                    </div>

                    {/* Toolbar & Filters */}
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 text-xs">
                      
                      {/* Filter pills */}
                      <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto">
                        {[
                          { key: 'Todos', label: 'Todos', count: userSessions.length },
                          { key: 'Activas', label: 'Activas', count: activeSessionsCount, color: 'text-emerald-400' },
                          { key: 'Posiblemente colgadas', label: 'Colgadas', count: staleSessionsCount, color: 'text-amber-400' },
                          { key: 'Cerradas', label: 'Cerradas', count: closedSessionsCount },
                          { key: 'Revocadas', label: 'Revocadas', count: revokedSessionsCount, color: 'text-rose-400' },
                          { key: 'Expiradas', label: 'Expiradas', count: expiredSessionsCount }
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => {
                              setSessionFilterStatus(f.key);
                              setSessionCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              sessionFilterStatus === f.key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-input text-foreground-secondary border-border hover:border-slate-500'
                            }`}
                          >
                            <span>{f.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                              sessionFilterStatus === f.key ? 'bg-surface-subtle/20 text-primary-foreground' : 'bg-card text-foreground-muted'
                            }`}>
                              {f.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Search and Page Size */}
                      <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        <div className="relative flex-1 sm:w-64">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                          <input
                            type="text"
                            placeholder="Buscar por IP o Dispositivo..."
                            value={sessionSearchText}
                            onChange={(e) => {
                              setSessionSearchText(e.target.value);
                              setSessionCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-input border border-border text-foreground text-xs placeholder:text-foreground-disabled focus:outline-none focus:border-primary"
                          />
                          {sessionSearchText && (
                            <button
                              onClick={() => setSessionSearchText('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        <select
                          value={sessionPageSize}
                          onChange={(e) => {
                            setSessionPageSize(Number(e.target.value));
                            setSessionCurrentPage(1);
                          }}
                          className="py-2 px-3 rounded-xl bg-input border border-border text-foreground text-xs focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value={10}>10 por pág.</option>
                          <option value={25}>25 por pág.</option>
                          <option value={50}>50 por pág.</option>
                        </select>
                      </div>
                    </div>

                    {/* Sessions Table */}
                    <div className="border border-border rounded-2xl overflow-hidden bg-input shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-card select-none">
                              <th 
                                className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('device')}
                              >
                                DISPOSITIVO / NAVEGADOR {sortConfigSesiones.key === 'device' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('ip')}
                              >
                                DIRECCIÓN IP {sortConfigSesiones.key === 'ip' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('location')}
                              >
                                UBICACIÓN {sortConfigSesiones.key === 'location' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('login_time')}
                              >
                                INICIO DE SESIÓN {sortConfigSesiones.key === 'login_time' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('last_activity_at')}
                              >
                                ÚLTIMA ACTIVIDAD {sortConfigSesiones.key === 'last_activity_at' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase">
                                DURACIÓN
                              </th>
                              <th 
                                className="py-3.5 px-4 text-center font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase cursor-pointer hover:text-foreground"
                                onClick={() => handleSortSesiones('estado')}
                              >
                                ESTADO {sortConfigSesiones.key === 'estado' && (sortConfigSesiones.direction === 'asc' ? '↑' : '↓')}
                              </th>
                              <th className="py-3.5 px-4 text-right pr-4 font-mono text-[10px] text-foreground-secondary font-bold tracking-wider uppercase">
                                ACCIONES
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2d3748]">
                            {paginated.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-8 px-4 text-center text-foreground-muted font-mono text-xs italic">
                                  No se encontraron sesiones registradas con los filtros seleccionados.
                                </td>
                              </tr>
                            ) : (
                              paginated.map(session => (
                                <tr 
                                  key={session.id} 
                                  onClick={() => setSelectedSessionDetail(session)}
                                  className="hover:bg-hover transition-colors cursor-pointer group"
                                >
                                  <td className="py-3.5 px-4 font-bold text-foreground font-mono text-xs">
                                    <div className="flex items-center gap-2">
                                      <span>{session.device || session.dispositivo_navegador}</span>
                                      {session.is_current && (
                                        <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-[9px] font-bold uppercase tracking-wider">
                                          ★ Sesión actual
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs">
                                    <span className="px-2.5 py-1 rounded-lg bg-input border border-border text-foreground-secondary font-mono">
                                      {session.ip || session.direccion_ip}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs text-foreground-secondary">
                                    {session.location || session.ubicacion || 'No disponible'}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs text-foreground-secondary">
                                    {formatSafeDateTime(session.login_time || session.fecha_inicio)}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs text-foreground-secondary">
                                    {formatSafeDateTime(session.last_activity_at || session.ultima_actividad)}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs text-primary">
                                    {session.duration || '—'}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                      session.estado === 'ACTIVA' 
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                        : session.estado === 'POSIBLEMENTE COLGADA'
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                        : session.estado === 'REVOCADA'
                                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        : session.estado === 'EXPIRADA'
                                        ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                        : 'bg-surface-subtle text-foreground-muted border border-border'
                                    }`}>
                                      ● {session.estado}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSessionDetail(session);
                                        }}
                                        className="p-1.5 rounded-lg bg-card border border-border text-foreground-muted hover:text-foreground hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
                                        title="Ver detalle de sesión"
                                        aria-label="Ver detalle de sesión"
                                      >
                                        <Eye size={14} />
                                      </button>
                                      {(session.estado === 'ACTIVA' || session.estado === 'POSIBLEMENTE COLGADA') && (
                                        <button 
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRevokeSingleSession(session);
                                          }}
                                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                          title="Revocar esta sesión"
                                          aria-label="Revocar esta sesión"
                                        >
                                          Revocar
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      <div className="px-4 py-3 bg-card border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <span className="text-foreground-muted">
                          Mostrando {paginated.length > 0 ? (currentPage - 1) * sessionPageSize + 1 : 0} - {Math.min(currentPage * sessionPageSize, sorted.length)} de {sorted.length} sesiones
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => setSessionCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                          >
                            Anterior
                          </button>
                          <span className="px-3 py-1 text-foreground-secondary font-bold">
                            Página {currentPage} de {totalPages}
                          </span>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setSessionCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB ACTIVIDAD */}
          {activeTab360 === 'actividad' && (
            <div className="space-y-4 animate-in fade-in duration-200 font-mono">
              {(() => {
                const userActs = realUserActivity || [];

                // Metrics Calculation from server stats or local list
                const todayCount = activitySummaryStats?.eventos_hoy ?? userActs.filter(act => {
                  const actDateStr = (act.timestamp || act.fecha_hora) ? new Date(act.timestamp || act.fecha_hora).toISOString().split('T')[0] : '';
                  return actDateStr === new Date().toISOString().split('T')[0];
                }).length;
                const last7DaysCount = activitySummaryStats?.eventos_7dias ?? userActs.length;
                const errorCount = activitySummaryStats?.eventos_error ?? 0;
                const successCount = activitySummaryStats?.eventos_exito ?? userActs.length;

                // Unique Modules for filter
                const defaultModules = ['Todos', 'Seguridad', 'CRM', 'Taller', 'Inventario', 'Compras', 'Facturación', 'Configuración', 'Reportes', 'Catálogos'];
                const allModulesList = Array.from(new Set([...defaultModules, ...(activityAvailableModules || [])]));

                // Sorting
                const sortedActs = [...userActs].sort((a, b) => {
                  const key = sortConfigActividad.key;
                  let aVal = a[key] || '';
                  let bVal = b[key] || '';
                  if (key === 'timestamp' || key === 'fecha_hora') {
                    aVal = new Date(a.timestamp || a.fecha_hora || 0).getTime();
                    bVal = new Date(b.timestamp || b.fecha_hora || 0).getTime();
                  }
                  if (aVal < bVal) return sortConfigActividad.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortConfigActividad.direction === 'asc' ? 1 : -1;
                  return 0;
                });

                const totalPages = activityTotalPages || 1;
                const currentPage = activityCurrentPage || 1;
                const totalRecords = activityTotalRecords || sortedActs.length;
                const paginatedActs = sortedActs;

                return (
                  <>
                    {/* Header & Main Actions */}
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h4 className="font-black text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                          <Clock className="text-primary" size={18} />
                          ACTIVIDAD DEL USUARIO
                        </h4>
                        <p className="text-[11px] text-foreground-muted mt-0.5">
                          Registro cronológico de todas las operaciones realizadas por este usuario dentro de Ride Lab.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* View Switcher */}
                        <div className="flex items-center bg-input border border-border rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => setActivityViewMode('table')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              activityViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
                            }`}
                            title="Vista Tabla"
                          >
                            <List size={14} />
                            <span>Tabla</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivityViewMode('timeline')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              activityViewMode === 'timeline' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
                            }`}
                            title="Vista Timeline"
                          >
                            <Clock size={14} />
                            <span>Timeline</span>
                          </button>
                        </div>

                        {/* Exports */}
                        <button
                          type="button"
                          onClick={() => exportActivityToExcel(sortedActs, detailUser?.full_name)}
                          className="px-3 py-2 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          title="Exportar a Excel (CSV)"
                        >
                          <Download size={14} className="text-primary" />
                          <span>Excel</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportActivityToPdf(sortedActs, detailUser?.full_name)}
                          className="px-3 py-2 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          title="Exportar a PDF / Imprimir"
                        >
                          <FileText size={14} className="text-primary" />
                          <span>PDF</span>
                        </button>

                        {/* Refresh */}
                        <button
                          type="button"
                          onClick={() => fetchUserActivity(detailUser.id)}
                          className="p-2.5 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs transition-all cursor-pointer"
                          title="Actualizar registro de actividad"
                        >
                          <RefreshCw size={14} className={isLoadingActivity ? "animate-spin text-primary" : ""} />
                        </button>
                      </div>
                    </div>

                    {/* Toolbar & Filters */}
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-xl space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        
                        {/* Fecha Desde */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Fecha Desde</label>
                          <input
                            type="date"
                            value={activityDateFrom}
                            onChange={(e) => { setActivityDateFrom(e.target.value); setActivityCurrentPage(1); }}
                            className="w-full bg-input border border-border rounded-xl px-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* Fecha Hasta */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Fecha Hasta</label>
                          <input
                            type="date"
                            value={activityDateTo}
                            onChange={(e) => { setActivityDateTo(e.target.value); setActivityCurrentPage(1); }}
                            className="w-full bg-input border border-border rounded-xl px-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* Módulo */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Módulo</label>
                          <select
                            value={activityModuleFilter}
                            onChange={(e) => { setActivityModuleFilter(e.target.value); setActivityCurrentPage(1); }}
                            className="w-full bg-input border border-border rounded-xl px-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                          >
                            {allModulesList.map(mod => (
                              <option key={mod} value={mod}>{mod}</option>
                            ))}
                          </select>
                        </div>

                        {/* Resultado */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Resultado</label>
                          <select
                            value={activityResultFilter}
                            onChange={(e) => { setActivityResultFilter(e.target.value); setActivityCurrentPage(1); }}
                            className="w-full bg-input border border-border rounded-xl px-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                          >
                            <option value="Todos">Todos los resultados</option>
                            <option value="Exitoso">Exitoso (Verde)</option>
                            <option value="Advertencia">Advertencia (Amarillo)</option>
                            <option value="Fallido">Fallido / Error (Rojo)</option>
                            <option value="Denegado">Denegado</option>
                          </select>
                        </div>

                        {/* Evento / Acción */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Evento</label>
                          <select
                            value={activityActionTypeFilter}
                            onChange={(e) => { setActivityActionTypeFilter(e.target.value); setActivityCurrentPage(1); }}
                            className="w-full bg-input border border-border rounded-xl px-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                          >
                            <option value="Todos">Todos los eventos</option>
                            <option value="LOGIN">LOGIN</option>
                            <option value="LOGOUT">LOGOUT</option>
                            <option value="EDITAR_USUARIO">EDITAR_USUARIO</option>
                            <option value="RESET_PASSWORD_MANUAL">RESET_PASSWORD_MANUAL</option>
                            <option value="REVOCAR_SESION">REVOCAR_SESION</option>
                            <option value="REVOCAR_TODAS_SESIONES">REVOCAR_TODAS_SESIONES</option>
                          </select>
                        </div>

                        {/* Buscador */}
                        <div>
                          <label className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block mb-1">Buscar</label>
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                            <input
                              type="text"
                              placeholder="Evento, IP, texto..."
                              value={activitySearchText}
                              onChange={(e) => { setActivitySearchText(e.target.value); setActivityCurrentPage(1); }}
                              className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-1.5 text-foreground-secondary focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* VISTA TABLA / TIMELINE */}
                    {paginatedActs.length === 0 ? (
                      <div className="py-12 border border-dashed border-border rounded-xl bg-input text-center space-y-2">
                        <Clock className="mx-auto text-slate-600 animate-pulse" size={32} />
                        <p className="font-bold text-xs text-foreground">No se encontraron actividades en esta consulta.</p>
                        <p className="text-[11px] text-foreground-muted font-mono">Prueba ajustando los filtros de fecha, módulo o término de búsqueda.</p>
                      </div>
                    ) : activityViewMode === 'table' ? (
                      /* VISTA TABLA */
                      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-border bg-input select-none">
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase cursor-pointer" onClick={() => handleSortActividad('timestamp')}>
                                  FECHA Y HORA {sortConfigActividad.key === 'timestamp' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase cursor-pointer" onClick={() => handleSortActividad('evento')}>
                                  ACCIÓN {sortConfigActividad.key === 'evento' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase">
                                  DESCRIPCIÓN
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase cursor-pointer" onClick={() => handleSortActividad('modulo')}>
                                  MÓDULO {sortConfigActividad.key === 'modulo' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase cursor-pointer" onClick={() => handleSortActividad('resultado')}>
                                  RESULTADO {sortConfigActividad.key === 'resultado' && (sortConfigActividad.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase">
                                  IP
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase">
                                  DISPOSITIVO
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase">
                                  DURACIÓN
                                </th>
                                <th className="py-3.5 px-4 font-mono text-[10px] text-foreground-muted font-bold uppercase text-right pr-4">
                                  ACCIONES
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2d3748]">
                              {paginatedActs.map(act => {
                                const resUpper = String(act.resultado || act.result || '').toUpperCase();
                                let resultBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                                if (resUpper.includes('ERROR') || resUpper.includes('FALLID')) resultBadge = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                                else if (resUpper.includes('ADVERT') || resUpper.includes('WARN')) resultBadge = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                                else if (resUpper.includes('CANCEL') || resUpper.includes('DENEG')) resultBadge = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                                else if (resUpper.includes('INFO')) resultBadge = 'bg-sky-500/15 text-sky-400 border-sky-500/30';

                                return (
                                  <tr 
                                    key={act.id || act.actividad_id} 
                                    onClick={() => setSelectedActivityDetail(act)}
                                    className="hover:bg-hover transition-colors cursor-pointer"
                                  >
                                    <td className="py-3.5 px-4 font-mono text-xs text-foreground-secondary whitespace-nowrap">
                                      {formatSafeDateTime(act.timestamp || act.fecha_hora)}
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <span className="font-bold text-foreground text-xs block">
                                        {act.evento || act.event || '—'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 max-w-xs">
                                      <span className="text-foreground-secondary text-xs block truncate" title={act.descripcion || act.desc}>
                                        {act.descripcion || act.desc || '—'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <span className="px-2.5 py-1 rounded-lg bg-input border border-border text-primary font-mono text-[10px] font-bold uppercase">
                                        {act.modulo || act.module || '—'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider border ${resultBadge}`}>
                                        ● {act.resultado || act.result || '—'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-xs text-primary select-all whitespace-nowrap">
                                      {act.direccion_ip || act.ip || '—'}
                                    </td>
                                    <td className="py-3.5 px-4 text-xs text-foreground-secondary whitespace-nowrap max-w-[150px] truncate" title={act.dispositivo || act.device}>
                                      {act.dispositivo || act.device || 'No registrado'}
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-xs text-foreground-muted whitespace-nowrap">
                                      {act.duracion_ms ? `${act.duracion_ms} ms` : '—'}
                                    </td>
                                    <td className="py-3.5 px-4 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedActivityDetail(act);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-input border border-border text-foreground-secondary hover:text-foreground hover:border-primary transition-all cursor-pointer flex items-center gap-1.5 ml-auto text-xs"
                                        title="Ver detalle del evento"
                                        aria-label="Ver detalle del evento"
                                      >
                                        <Eye size={13} />
                                        <span>Ver Detalle</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* VISTA TIMELINE */
                      <div className="p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
                        {(() => {
                          const groups = {};
                          paginatedActs.forEach(act => {
                            const dateObj = act.timestamp || act.fecha_hora ? new Date(act.timestamp || act.fecha_hora) : new Date();
                            const dateKey = dateObj.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            if (!groups[dateKey]) groups[dateKey] = [];
                            groups[dateKey].push(act);
                          });

                          return Object.keys(groups).map(dateGroup => (
                            <div key={dateGroup} className="space-y-4">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-input border border-border rounded-xl text-xs font-bold text-primary uppercase tracking-wider">
                                  {dateGroup}
                                </span>
                                <div className="flex-1 h-[1px] bg-surface-subtle" />
                              </div>

                              <div className="relative pl-6 space-y-4 border-l-2 border-border">
                                {groups[dateGroup].map(act => {
                                  const dateObj = act.timestamp || act.fecha_hora ? new Date(act.timestamp || act.fecha_hora) : new Date();
                                  const timeStr = dateObj.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                  const resUpper = String(act.resultado || act.result || '').toUpperCase();
                                  let nodeColor = 'bg-emerald-400 border-emerald-500/50';
                                  if (resUpper.includes('ERROR') || resUpper.includes('FALLID')) nodeColor = 'bg-rose-400 border-rose-500/50';
                                  else if (resUpper.includes('ADVERT') || resUpper.includes('WARN')) nodeColor = 'bg-amber-400 border-amber-500/50';

                                  return (
                                    <div 
                                      key={act.id || act.actividad_id}
                                      onClick={() => setSelectedActivityDetail(act)}
                                      className="relative group p-4 bg-input border border-border hover:border-primary rounded-xl transition-all cursor-pointer shadow-md space-y-2"
                                    >
                                      <div className={`absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full border-2 ${nodeColor} shadow-lg`} />

                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-xs font-bold text-primary">{timeStr}</span>
                                          <span className="text-foreground font-bold text-xs">{act.evento || act.event || '—'}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-card border border-border text-[10px] text-primary uppercase font-bold">
                                          {act.modulo || act.module || '—'}
                                        </span>
                                      </div>

                                      <p className="text-foreground-secondary text-xs leading-relaxed">
                                        {act.descripcion || act.desc || '—'}
                                      </p>

                                      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px] text-foreground-muted">
                                        <span>IP: <strong className="text-foreground-secondary font-mono">{act.direccion_ip || act.ip || '—'}</strong></span>
                                        <span className="text-primary font-bold group-hover:underline flex items-center gap-1">
                                          Ver detalle completo <ArrowRight size={10} />
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    {/* Pagination Footer */}
                    <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-foreground-muted">
                        <span>Mostrando</span>
                        <span className="text-foreground font-bold">{paginatedActs.length}</span>
                        <span>de</span>
                        <span className="text-foreground font-bold">{totalRecords}</span>
                        <span>actividades registradas</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage <= 1}
                          onClick={() => setActivityCurrentPage(prev => Math.max(1, prev - 1))}
                          className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                        >
                          Anterior
                        </button>
                        <span className="px-3 py-1 text-foreground-secondary font-bold">
                          Página {currentPage} de {totalPages}
                        </span>
                        <button
                          disabled={currentPage >= totalPages}
                          onClick={() => setActivityCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* TAB AUDITORIA */}
          {activeTab360 === 'auditoria' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Header & Main Actions */}
              <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="font-black text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="text-primary" size={18} />
                    BITÁCORA DE AUDITORÍA
                  </h4>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    Registro oficial e inalterable de todos los cambios administrativos realizados sobre esta cuenta.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export Excel */}
                  <button
                    type="button"
                    onClick={handleExportAuditExcel}
                    className="px-3 py-2 bg-input border border-border hover:border-emerald-500/50 text-foreground-secondary hover:text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Exportar a Excel (CSV)"
                  >
                    <Download size={14} className="text-emerald-400" />
                    <span>Excel</span>
                  </button>

                  {/* Export PDF */}
                  <button
                    type="button"
                    onClick={handleExportAuditPdf}
                    className="px-3 py-2 bg-input border border-border hover:border-rose-500/50 text-foreground-secondary hover:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Exportar a PDF"
                  >
                    <Printer size={14} className="text-rose-400" />
                    <span>PDF</span>
                  </button>

                  {/* Refresh */}
                  <button
                    type="button"
                    onClick={() => fetchUserAudits(detailUser.id)}
                    className="p-2.5 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                    title="Actualizar bitácora de auditoría"
                  >
                    <RefreshCw size={14} className={isLoadingAudits ? "animate-spin text-primary" : ""} />
                  </button>
                </div>
              </div>

              {/* Resumen Superior / Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2.5 text-xs">
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-foreground-muted font-bold uppercase tracking-wider block truncate">Total Eventos</span>
                  <span className="text-base font-black text-foreground font-mono">{auditSummaryStats.total_eventos || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block truncate">Creaciones</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{auditSummaryStats.creaciones || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider block truncate">Ediciones</span>
                  <span className="text-base font-black text-sky-400 font-mono">{auditSummaryStats.actualizaciones || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block truncate">Permisos</span>
                  <span className="text-base font-black text-purple-400 font-mono">{auditSummaryStats.permisos_modificados || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block truncate">Passwords</span>
                  <span className="text-base font-black text-amber-400 font-mono">{auditSummaryStats.reseteos_password || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block truncate">Sesiones</span>
                  <span className="text-base font-black text-amber-400 font-mono">{auditSummaryStats.revocaciones_sesion || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block truncate">Roles</span>
                  <span className="text-base font-black text-purple-400 font-mono">{auditSummaryStats.cambios_roles || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider block truncate">Bloqueos</span>
                  <span className="text-base font-black text-rose-400 font-mono">{auditSummaryStats.bloqueos || 0}</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-xl space-y-1 shadow-md">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block truncate">Desbloqueos</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{auditSummaryStats.desbloqueos || 0}</span>
                </div>
              </div>

              {/* Toolbar & Server-side Filters */}
              <div className="bg-card border border-border p-4 rounded-2xl shadow-xl space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  {/* Fecha Desde */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Desde</label>
                    <input
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => { setAuditDateFrom(e.target.value); setAuditCurrentPage(1); }}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Fecha Hasta */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Hasta</label>
                    <input
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => { setAuditDateTo(e.target.value); setAuditCurrentPage(1); }}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Acción */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Acción</label>
                    <select
                      value={auditActionFilter}
                      onChange={(e) => { setAuditActionFilter(e.target.value); setAuditCurrentPage(1); }}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                    >
                      <option value="Todos">Todas las Acciones</option>
                      {auditAvailableActions.map(act => (
                        <option key={act} value={act}>{getFriendlyActionTitle(act)} ({act})</option>
                      ))}
                    </select>
                  </div>

                  {/* Administrador */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Administrador</label>
                    <select
                      value={auditAdminFilter}
                      onChange={(e) => { setAuditAdminFilter(e.target.value); setAuditCurrentPage(1); }}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                    >
                      <option value="Todos">Todos los Admins</option>
                      {auditAvailableAdmins.map(adm => (
                        <option key={adm.admin_id} value={adm.admin_id}>{adm.admin_nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Resultado */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Resultado</label>
                    <select
                      value={auditResultFilter}
                      onChange={(e) => { setAuditResultFilter(e.target.value); setAuditCurrentPage(1); }}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                    >
                      <option value="Todos">Todos</option>
                      <option value="EXITOSO">Exitoso / Completado</option>
                      <option value="ADVERTENCIA">Advertencia / Warning</option>
                      <option value="ERROR">Error / Fallido</option>
                    </select>
                  </div>

                  {/* Buscador */}
                  <div>
                    <label className="text-[10px] text-foreground-muted font-bold uppercase block mb-1">Buscar</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-foreground-disabled" />
                      <input
                        type="text"
                        placeholder="Admin, IP, motivo..."
                        value={auditSearchText}
                        onChange={(e) => setAuditSearchText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setAuditCurrentPage(1); fetchUserAudits(detailUser.id); } }}
                        className="w-full bg-input border border-border rounded-xl pl-8 pr-3 py-2 text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: Timeline Cards / Stream */}
              {isLoadingAudits ? (
                <div className="w-full min-h-[220px] py-14 px-6 border border-dashed border-border rounded-2xl bg-input flex flex-col items-center justify-center space-y-3 shadow-xl">
                  <div className="w-8 h-8 border-4 border-border border-t-[#bfce7f] rounded-full animate-spin"></div>
                  <p className="text-xs text-foreground-muted font-mono">Consultando bitácora de auditoría administrativa...</p>
                </div>
              ) : auditFetchError ? (
                <div className="w-full min-h-[220px] py-12 px-6 border border-rose-500/30 rounded-2xl bg-rose-500/5 flex flex-col items-center justify-center text-center space-y-3 shadow-xl">
                  <AlertCircle className="mx-auto text-rose-400" size={38} />
                  <p className="font-bold text-sm text-foreground">No se pudo cargar la bitácora de auditoría.</p>
                  <p className="text-xs text-rose-300/80 max-w-md mx-auto">{auditFetchError}</p>
                  <button
                    type="button"
                    onClick={() => fetchUserAudits(detailUser.id)}
                    className="px-4 py-2 bg-card border border-rose-500/40 hover:border-rose-400 text-rose-300 hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 mt-1"
                  >
                    <RefreshCw size={14} />
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : realUserAudits.length === 0 ? (
                <div className="w-full min-h-[240px] py-12 px-6 border border-dashed border-border rounded-2xl bg-input flex flex-col items-center justify-center text-center space-y-3 shadow-xl">
                  <ShieldAlert className="mx-auto text-foreground-disabled animate-pulse" size={40} />
                  <div className="max-w-[520px] mx-auto space-y-1">
                    <p className="font-bold text-sm text-foreground">
                      {(auditActionFilter !== 'Todos' || auditAdminFilter !== 'Todos' || auditResultFilter !== 'Todos' || auditSearchText || auditDateFrom || auditDateTo)
                        ? 'No se encontraron eventos con los filtros seleccionados.'
                        : 'No existen registros de auditoría para este usuario.'}
                    </p>
                    <p className="text-xs text-foreground-muted leading-relaxed">
                      Los cambios de configuración, reseteos de clave, revocación de sesiones y modificaciones de perfil efectuadas por administradores se registran inalterablemente aquí.
                    </p>
                  </div>

                  {(auditActionFilter !== 'Todos' || auditAdminFilter !== 'Todos' || auditResultFilter !== 'Todos' || auditSearchText || auditDateFrom || auditDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuditActionFilter('Todos');
                        setAuditAdminFilter('Todos');
                        setAuditResultFilter('Todos');
                        setAuditSearchText('');
                        setAuditDateFrom('');
                        setAuditDateTo('');
                        setAuditCurrentPage(1);
                      }}
                      className="px-4 py-2 bg-card border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer mt-2 shadow-sm"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Timeline Stream Grouped by Date */}
                  {Object.entries(groupAuditsByDate(realUserAudits)).map(([dateGroup, items]) => (
                    <div key={dateGroup} className="space-y-3">
                      {/* Date Group Heading */}
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-card border border-border rounded-lg text-xs font-bold text-primary uppercase tracking-wider font-mono shadow-sm">
                          {dateGroup}
                        </span>
                        <div className="flex-1 h-[1px] bg-surface-subtle" />
                      </div>

                      {/* Event Cards */}
                      <div className="space-y-3 relative pl-4 border-l-2 border-border/80 ml-3">
                        {items.map(audit => {
                          const semantic = getSemanticColorClass(audit);
                          const friendlyTitle = getFriendlyActionTitle(audit.accion || audit.action);
                          const naturalText = getNaturalSummaryText(audit);

                          return (
                            <div 
                              key={audit.id}
                              className={`relative bg-card border ${semantic.border} rounded-2xl p-4 shadow-xl hover:border-primary/50 transition-all space-y-3`}
                            >
                              {/* Node Indicator Dot */}
                              <div className={`absolute -left-[23px] top-5 w-3.5 h-3.5 rounded-full ${semantic.nodeBg} ring-4 ring-surface-subtle`} />

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border font-mono ${semantic.badge}`}>
                                    ● {friendlyTitle}
                                  </span>
                                  <span className="text-[11px] text-foreground-muted font-mono">
                                    {formatSafeDateTime(audit.fecha_hora || audit.performed_at || audit.timestamp)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-foreground-muted font-medium">Ejecutado por:</span>
                                  <span className="px-2 py-0.5 bg-input border border-border rounded-md font-bold text-foreground text-xs font-mono">
                                    {audit.admin_nombre || audit.performed_by || 'Sistema'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono border ${
                                    String(audit.resultado || '').toUpperCase().includes('ERR')
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  }`}>
                                    {audit.resultado || 'EXITOSO'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                <div className="space-y-1 flex-1">
                                  <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider block">Resumen Operativo</span>
                                  <p className="text-xs font-medium text-foreground-secondary leading-relaxed">
                                    {naturalText}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditDetail(audit)}
                                  className="px-3.5 py-2 bg-input border border-border hover:border-primary text-foreground-secondary hover:text-foreground rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                                >
                                  <Eye size={14} className="text-primary" />
                                  <span>Ver detalle</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Server-Side Pagination Bar */}
                  <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-mono">
                    <div className="text-foreground-muted">
                      Mostrando página <span className="text-foreground font-bold">{auditCurrentPage}</span> de <span className="text-foreground font-bold">{auditTotalPages}</span> ({auditTotalRecords} eventos en total)
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={auditPageSize}
                        onChange={(e) => { setAuditPageSize(Number(e.target.value)); setAuditCurrentPage(1); }}
                        className="bg-input border border-border rounded-xl px-2.5 py-1.5 text-foreground font-mono focus:outline-none"
                      >
                        <option value={10}>10 por página</option>
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                      </select>

                      <button
                        disabled={auditCurrentPage <= 1}
                        onClick={() => setAuditCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                      >
                        Anterior
                      </button>

                      <button
                        disabled={auditCurrentPage >= auditTotalPages}
                        onClick={() => setAuditCurrentPage(prev => Math.min(auditTotalPages, prev + 1))}
                        className="px-3 py-1.5 rounded-xl border border-border bg-input text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-hover transition-colors cursor-pointer"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Ficha Footer */}
        <div className="p-4 md:p-6 border-t border-border bg-input flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
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
                  className="px-5 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-surface-subtle font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar Edición
                </button>
                <button
                  type="button"
                  onClick={handleTriggerSaveEdit360}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-mono text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  Guardar Cambios
                </button>
              </>
            ) : (
              <button 
                type="button"
                onClick={handleGoBack}
                className="px-5 py-2.5 border border-border bg-card text-foreground hover:bg-surface-subtle transition-all font-mono text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                Volver al Listado
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  const totalPages = Math.ceil((sortedData?.length || 0) / pageSize) || 1;

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
        (profileLoadError && isSelfMode) ? (
          <div className="w-full max-w-2xl mx-auto my-12 p-8 text-center bg-card border border-rose-500/30 rounded-2xl font-mono shadow-2xl animate-in fade-in duration-200">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Error de Carga</h3>
            <p className="text-sm text-foreground-secondary mb-6">{profileLoadError}</p>
            <button
              type="button"
              onClick={loadSelfProfile}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/20 transition-all shadow-lg cursor-pointer font-mono"
            >
              Reintentar
            </button>
          </div>
        ) : (searchParams.get('userId') || isSelfMode) ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-border border-t-[#bfce7f] rounded-full animate-spin shadow-sm"></div>
            <p className="mt-4 text-xs font-bold text-foreground-muted animate-pulse font-mono">Cargando perfil del usuario...</p>
          </div>
        ) : (
          <div className="max-w-[1550px] mx-auto space-y-6 animate-in fade-in duration-300 p-6 font-mono text-xs w-full">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-primary mb-1">
            <span>Seguridad</span>
            <span>/</span>
            <span className="text-foreground font-bold">Usuarios</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Users className="text-primary" size={24} />
            Usuarios
          </h1>
          <p className="text-foreground-muted font-mono text-xs md:text-sm mt-1">
            Administra los usuarios, accesos, roles, permisos y alcance operativo dentro de Ride Lab.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleExport}
            className="bg-card border border-border hover:border-primary text-foreground font-mono text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer" 
            title="Exportar a Excel (CSV)"
          >
            <Download size={16}/> Exportar Excel
          </button>
          <button 
            onClick={handleAddNew}
            className="bg-primary hover:bg-primary text-primary-foreground font-mono text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus size={18}/> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Grid of upper metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-foreground-muted uppercase tracking-wider block">Total</span>
          <span className="font-mono text-2xl font-black text-foreground mt-1">{data.length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Activos</span>
          <span className="font-mono text-2xl font-black text-emerald-400 mt-1">{data.filter(u => u.status === 'Activo').length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Bloqueados</span>
          <span className="font-mono text-2xl font-black text-rose-400 mt-1">{data.filter(u => u.status === 'Bloqueado').length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-sky-400 uppercase tracking-wider block">Inv. Enviadas</span>
          <span className="font-mono text-2xl font-black text-sky-400 mt-1">{data.filter(u => u.activation?.activation_status === 'INVITATION_SENT' || u.activation?.activation_status === 'INVITATION_OPENED').length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Pend. Registro</span>
          <span className="font-mono text-2xl font-black text-amber-400 mt-1">{data.filter(u => u.activation?.activation_status === 'INVITATION_PENDING' || u.activation?.activation_status === 'INVITATION_SENT' || u.activation?.activation_status === 'INVITATION_OPENED').length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Reg. sin Login</span>
          <span className="font-mono text-2xl font-black text-indigo-400 mt-1">{data.filter(u => u.activation?.activation_status === 'REGISTRATION_COMPLETED').length}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Primer Login</span>
          <span className="font-mono text-2xl font-black text-emerald-400 mt-1">{data.filter(u => u.activation?.activation_status === 'FIRST_LOGIN_COMPLETED').length}</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" size={18} />
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full bg-input border border-border rounded-xl pl-10 pr-4 py-2.5 font-mono text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary" 
            placeholder="Buscar por nombre, correo, usuario o documento..." 
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setViewMode('table')} 
            className={`p-2.5 border rounded-xl transition-colors cursor-pointer ${
              viewMode === 'table' 
                ? 'bg-primary/10 border-primary/40 text-primary' 
                : 'bg-input border-border text-foreground-muted hover:text-foreground'
            }`}
            title="Vista de Tabla"
          >
            <List size={16} />
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('grid')} 
            className={`p-2.5 border rounded-xl transition-colors cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-primary/10 border-primary/40 text-primary' 
                : 'bg-input border-border text-foreground-muted hover:text-foreground'
            }`}
            title="Vista de Cuadrícula (Grid)"
          >
            <LayoutGrid size={16} />
          </button>

          {activeFiltersCount > 0 && (
            <button onClick={handleClearFilters} className="text-xs font-mono font-bold text-primary hover:underline ml-2">Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Selected rows actions bar */}
      {selectedIds.length > 0 && (
        <div className="p-4 bg-card border border-primary/40 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2 shadow-xl">
          <span className="text-xs font-bold text-primary">
            {selectedIds.length} usuarios seleccionados
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleMassToggleStatus} 
              className="px-4 py-2 bg-input border border-border text-foreground rounded-xl text-xs font-bold hover:border-primary transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ToggleRight size={14} /> Rotar Estado
            </button>
            <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-foreground-muted hover:text-foreground text-xs font-bold transition-colors cursor-pointer">
              Limpiar Selección
            </button>
          </div>
        </div>
      )}

      {/* Users Catalog List */}
      {viewMode === 'table' ? (
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse font-mono text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-input border-b border-border select-none text-foreground-muted font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length > 0 && selectedIds.length === sortedData.length} 
                      onChange={toggleAll} 
                      className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer"
                    />
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
              <tbody className="divide-y divide-[#2d3748]">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-foreground-muted font-mono">
                      <Users size={40} className="mx-auto text-foreground-disabled opacity-40 mb-3" />
                      <h3 className="text-sm font-bold text-foreground">Sin registros encontrados</h3>
                      <p className="text-xs text-foreground-muted mt-1">Prueba limpiando los filtros o realizando otra búsqueda.</p>
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
                        className={`hover:bg-hover transition-colors cursor-pointer group ${isChecked ? 'bg-primary/5' : ''}`}
                        onClick={() => handleViewDetail(item, 'resumen')}
                      >
                        <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => toggleSelection(item.id, e)}
                            className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer"
                          />
                        </td>
                        
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center font-bold text-primary border border-border shrink-0 font-mono text-xs">
                              {item.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {item.full_name}
                              </span>
                              <span className="text-[11px] text-foreground-muted font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                <Mail size={12} className="text-foreground-disabled shrink-0" />
                                <span>{item.login_identifiers?.find(id => id.is_primary)?.identifier_value || item.email || '—'}</span>
                              </span>
                              {item.phone && (
                                <span className="text-[11px] text-foreground-muted font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                  <Phone size={12} className="text-foreground-disabled shrink-0" />
                                  <span>{item.phone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {company ? (
                            <div className="flex items-center gap-2">
                              <Building2 size={13} className="text-foreground-muted" />
                              <span className="font-bold text-foreground-secondary font-mono text-xs">{company.name}</span>
                            </div>
                          ) : (
                            <span className="text-foreground-disabled font-mono">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                            {item.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="bg-surface-subtle border border-border text-foreground-secondary font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded">
                            {item.user_type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-foreground-secondary font-mono text-xs">
                          {item.last_login_at ? new Date(item.last_login_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex justify-center">
                            {item.mfaEnabled ? (
                              <ShieldCheck className="text-emerald-400" size={18} title={`MFA: ${item.mfa_method}`} />
                            ) : (
                              <ShieldX className="text-foreground-disabled" size={18} title="MFA Deshabilitado" />
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            (String(item.status || item.estado || '').toUpperCase() === 'ACTIVO' || String(item.status || item.estado || '').toUpperCase() === 'ACTIVE')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : (String(item.status || item.estado || '').toUpperCase() === 'BLOQUEADO' || String(item.status || item.estado || '').toUpperCase() === 'INACTIVO')
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-surface-subtle text-foreground-muted border-border'
                          }`}>
                            {item.status || item.estado}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {renderActivationBadge(item.estado_activacion, item.primary_access_type, item)}
                        </td>

                        <td className="py-3.5 px-4 text-right pr-6 relative" onClick={e => e.stopPropagation()}>
                          <button 
                            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-subtle rounded-lg transition-colors cursor-pointer inline-block"
                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(isDropdownOpen ? null : item.id); }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          
                          {isDropdownOpen && (
                            <div className="absolute right-6 top-8 w-52 bg-card rounded-xl shadow-2xl border border-border py-1.5 z-50 text-left font-mono">
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

          {/* Table Footer & Pagination */}
          <div className="p-4 bg-input border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-foreground-muted">Filas por página:</span>
              <select 
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value) || 5);
                  setCurrentPage(1);
                }}
                className="bg-card border border-border rounded-lg px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
            
            <span className="text-foreground-muted">
              Mostrando <strong className="text-foreground">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedData.length)}</strong> de <strong className="text-foreground">{sortedData.length}</strong> registros
            </span>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Ant
              </button>
              <span className="px-3 py-1.5 bg-input rounded text-xs font-bold text-foreground font-mono border border-border">
                {currentPage}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                Sig <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-200">
          {sortedData.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-card border border-border rounded-2xl shadow-xl font-mono">
              <Users size={40} className="mx-auto text-foreground-disabled opacity-40 mb-3" />
              <h3 className="text-sm font-bold text-foreground">Sin registros encontrados</h3>
              <p className="text-xs text-foreground-muted mt-1">Prueba limpiando los filtros o realizando otra búsqueda.</p>
            </div>
          ) : (
            paginatedData.map(item => {
              const isChecked = selectedIds.includes(item.id);
              const isDropdownOpen = activeDropdown === item.id;
              const company = companies.find(c => c.id == item.companyId);
              
              return (
                <div 
                  key={item.id} 
                  className={`bg-card border rounded-2xl p-5 hover:border-primary/50 transition-all cursor-pointer relative flex flex-col justify-between min-h-[220px] shadow-xl group font-mono text-xs ${
                    isChecked ? 'border-primary bg-primary/5' : 'border-border'
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
                        className="rounded border-border bg-input text-primary focus:ring-primary cursor-pointer w-4 h-4"
                      />
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${
                        (String(item.status || item.estado || '').toUpperCase() === 'ACTIVO' || String(item.status || item.estado || '').toUpperCase() === 'ACTIVE')
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : (String(item.status || item.estado || '').toUpperCase() === 'BLOQUEADO' || String(item.status || item.estado || '').toUpperCase() === 'INACTIVO')
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-surface-subtle text-foreground-muted border-border'
                      }`}>
                        {item.status || item.estado}
                      </span>
                    </div>
                    
                    <div className="relative">
                      <button 
                        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-subtle rounded-lg transition-colors cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(isDropdownOpen ? null : item.id); }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {isDropdownOpen && (
                        <div className="absolute right-0 top-6 w-52 bg-card rounded-xl shadow-2xl border border-border py-1.5 z-50 text-left font-mono">
                          {renderDropdownItems(item)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: Avatar and User Details */}
                  <div className="flex items-center gap-3 my-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-subtle text-primary border border-border flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                      {item.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate text-xs">{item.full_name}</span>
                      <div className="text-[11px] text-foreground-muted font-mono mt-1 flex flex-col gap-0.5">
                         <span className="flex items-center gap-1"><Mail size={10} /> {item.email || '—'}</span>
                         <span className="flex items-center gap-1"><Phone size={10} /> {item.phone || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta Section: Role & User Type & Company */}
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-foreground-muted font-bold">Rol:</span>
                        <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider truncate mt-0.5">{item.role}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground-muted font-bold">Tipo:</span>
                        <span className="bg-surface-subtle border border-border text-foreground-secondary font-mono text-[9px] font-bold tracking-wider px-2 py-0.5 rounded truncate mt-0.5">{item.user_type}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-foreground-muted font-bold">Empresa:</span>
                      <span className="font-bold text-foreground-secondary truncate max-w-[150px]">
                        {company?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-foreground-muted font-bold">Activación:</span>
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

      {/* Pagination Footer outside table when in grid view or general */}
      {viewMode === 'grid' && (
        <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono text-xs shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-foreground-muted">Filas por página:</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(parseInt(e.target.value) || 5);
                setCurrentPage(1);
              }}
              className="bg-input border border-border rounded-lg px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          <span className="text-foreground-muted">
            Mostrando <strong className="text-foreground">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedData.length)}</strong> de <strong className="text-foreground">{sortedData.length}</strong> registros
          </span>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 bg-input border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Ant
            </button>
            <span className="px-3 py-1.5 bg-input rounded text-xs font-bold text-foreground font-mono border border-border">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 bg-input border border-border rounded-lg text-foreground-secondary hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
            >
              Sig <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
) : (
  renderUserDetail()
)}

      {/* ADVANCED FILTER MODAL (React Portal) */}
      {isFilterModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-subtle/50 backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)}></div>
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
                      {roles.map(r => <option key={r.id || r.name} value={r.name}>{r.name}</option>)}
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

      {/* CREATE / EDIT WIZARD (React Portal Modal) */}
      {isCreating && wizardData && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-surface-subtle/80 backdrop-blur-md" onClick={handleCancel}></div>
          <div className="relative w-full max-w-5xl md:max-w-6xl bg-surface-elevated max-h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-border overflow-hidden animate-in zoom-in-95 duration-200 text-foreground-secondary font-sans">
            
            {/* 1. ENCABEZADO SUPERIOR */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle shrink-0 z-20">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <UserPlus size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">
                      {isCreating ? 'Nuevo usuario' : `Editar usuario: ${wizardData.full_name}`}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20">
                      Paso {currentStep} de 5
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted font-normal mt-0.5">
                    {isCreating ? 'Configure la identidad, empresa, rol, acceso y políticas de seguridad.' : `ID de Cuenta: ${wizardData.id}`}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCancel} 
                className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-subtle/70 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2. STEPPER HORIZONTAL */}
            <div className="bg-surface-subtle border-b border-border px-6 py-3 shrink-0 z-10">
              <div className="max-w-5xl mx-auto space-y-2.5">
                <div className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {[
                    { step: 1, label: 'Identidad', desc: 'Datos e identificación' },
                    { step: 2, label: 'Empresa y Rol', desc: 'Asociación y perfil RBAC' },
                    { step: 3, label: 'Acceso', desc: 'Credenciales y canales' },
                    { step: 4, label: 'Seguridad', desc: 'Políticas y autenticación' },
                    { step: 5, label: 'Confirmación', desc: 'Resumen de cuenta' }
                  ].map((s, idx, arr) => {
                    const isActive = currentStep === s.step;
                    const isCompleted = currentStep > s.step;
                    return (
                      <Fragment key={s.step}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCompleted || s.step < currentStep) {
                              setCurrentStep(s.step);
                            }
                          }}
                          disabled={!(isCompleted || s.step < currentStep)}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all text-left outline-none shrink-0 ${
                            isActive 
                              ? 'bg-primary/10 border border-primary/40 shadow-sm' 
                              : isCompleted 
                              ? 'hover:bg-surface-subtle/60 cursor-pointer' 
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div 
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold transition-all ${
                              isActive 
                                ? 'bg-primary text-slate-950 font-extrabold shadow-sm' 
                                : isCompleted 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-surface-subtle border border-border text-foreground-muted'
                            }`}
                          >
                            {isCompleted ? <Check size={13} strokeWidth={3} /> : s.step}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[12px] font-semibold ${isActive ? 'text-primary font-bold' : isCompleted ? 'text-foreground-secondary' : 'text-foreground-muted'}`}>
                              {s.label}
                            </span>
                          </div>
                        </button>
                        {idx < arr.length - 1 && (
                          <div className={`h-[1px] flex-1 min-w-[16px] max-w-[40px] transition-colors ${isCompleted ? 'bg-emerald-500/60' : 'bg-surface-subtle'}`}></div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>

                {/* Micro Barra de Progreso */}
                <div className="flex items-center justify-between text-[11px] font-medium text-foreground-muted">
                  <span>Paso {currentStep} de 5</span>
                  <span className="text-primary font-semibold">{Math.round((currentStep / 5) * 100)}% completado</span>
                </div>
                <div className="w-full h-1 bg-surface-subtle rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${(currentStep / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 3. CONTENEDOR PRINCIPAL DEL FORMULARIO */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-surface-subtle">
              <div className="max-w-5xl mx-auto space-y-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2.5 text-xs font-semibold shadow-sm animate-shake">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* STEP 1: IDENTIDAD */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Seccion 1: Identidad personal */}
                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Identidad personal
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Ingresa los datos personales y de contacto del usuario.</p>
                      </div>

                      {/* Row 1: Nombre | Apellido */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Nombre *</label>
                          <input 
                            type="text" 
                            required
                            value={wizardData.first_name || ''} 
                            onChange={(e) => handleChange('first_name', e.target.value)} 
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.first_name ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                            placeholder="Ej. Juan"
                          />
                          {fieldErrors.first_name && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.first_name}</span>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Apellido *</label>
                          <input 
                            type="text" 
                            required
                            value={wizardData.last_name || ''} 
                            onChange={(e) => handleChange('last_name', e.target.value)} 
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.last_name ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                            placeholder="Ej. Pérez"
                          />
                          {fieldErrors.last_name && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.last_name}</span>}
                        </div>
                      </div>

                      {/* Row 2: Tipo de documento | Número de documento | Teléfono */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Tipo de documento (Opcional)</label>
                          <select 
                            value={wizardData.document_type || 'Cédula'} 
                            onChange={(e) => handleChange('document_type', e.target.value)} 
                            className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option value="Cédula">Cédula</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="RNC">RNC</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Número de documento (Opcional)</label>
                          <input 
                            type="text" 
                            value={wizardData.document_number || ''} 
                            onChange={(e) => handleChange('document_number', e.target.value)} 
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.document_number ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                            placeholder="Ej. 001-1234567-8"
                          />
                          {fieldErrors.document_number && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.document_number}</span>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Teléfono (Opcional)</label>
                          <input 
                            type="text" 
                            value={wizardData.phone || ''} 
                            onChange={(e) => handleChange('phone', e.target.value)} 
                            className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary" 
                            placeholder="Ej. +1 (809) 555-0101"
                          />
                        </div>
                      </div>

                      {/* Row 3: Correo electrónico (ancho completo) */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Correo electrónico *</label>
                        <input 
                          type="email" 
                          value={wizardData.email || ''} 
                          onChange={(e) => handleChange('email', e.target.value)} 
                          className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.email ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                          placeholder="Ej. juan.perez@empresa.com"
                        />
                        {fieldErrors.email && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.email}</span>}
                      </div>
                    </div>

                    {/* Seccion 2: Asignación organizativa */}
                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Asignación organizativa
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Asigna la empresa, cargo, departamento y área correspondiente.</p>
                      </div>

                      {/* Row 1: Empresa | Cargo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Empresa / Consorcio *</label>
                          <select
                            value={wizardData.companyId || ''}
                            onChange={(e) => handleChange('companyId', e.target.value ? Number(e.target.value) : '')}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.companyId ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                            disabled={isLoadingEmpresas}
                          >
                            {isLoadingEmpresas && <option value="">Cargando empresas...</option>}
                            {empresasError && <option value="">{empresasError}</option>}
                            {!isLoadingEmpresas && !empresasError && companies.length === 0 && (
                              <option value="">No existen empresas activas en la base de datos.</option>
                            )}
                            {!isLoadingEmpresas && !empresasError && companies.length > 0 && (
                              <>
                                <option value="">-- Selecciona Empresa --</option>
                                {companies.map(c => (
                                  <option key={c.empresa_id} value={c.empresa_id}>
                                    {c.nombre_comercial}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                          {fieldErrors.companyId && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.companyId}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Cargo / Posición</label>
                          <select
                            value={wizardData.cargo_id || ''}
                            onChange={(e) => {
                              const cId = e.target.value ? Number(e.target.value) : '';
                              const cargoObj = cargos.find(c => Number(c.cargo_id) === Number(cId));
                              handleChange('cargo_id', cId);
                              handleChange('job_title', cargoObj ? cargoObj.nombre : '');
                            }}
                            className={`w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary cursor-pointer ${fieldErrors.cargo_id ? 'border-rose-500 bg-rose-500/5' : ''}`}
                            disabled={isLoadingCargos}
                          >
                            {isLoadingCargos && <option value="">Cargando cargos...</option>}
                            {cargosError && <option value="">{cargosError}</option>}
                            {!isLoadingCargos && !cargosError && cargos.length === 0 && (
                              <option value="">No existen cargos activos en la base de datos.</option>
                            )}
                            {!isLoadingCargos && !cargosError && cargos.length > 0 && (
                              <>
                                <option value="">Buscar o seleccionar cargo...</option>
                                {cargos.map(c => (
                                  <option key={c.cargo_id} value={c.cargo_id}>
                                    {c.nombre}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Departamento | Área */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Departamento *</label>
                          <select
                            value={wizardData.department_id || ''}
                            onChange={(e) => {
                              const dId = e.target.value ? Number(e.target.value) : '';
                              const depObj = departments.find(d => Number(d.departamento_id) === Number(dId));
                              handleChange('department_id', dId);
                              handleChange('department', depObj ? depObj.nombre : '');
                              handleChange('area_id', '');
                              handleChange('area', '');
                              fetchAreasForDepartamento(dId);
                            }}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.department_id ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                            disabled={isLoadingDepartamentos}
                          >
                            {isLoadingDepartamentos && <option value="">Cargando departamentos...</option>}
                            {departamentosError && <option value="">{departamentosError}</option>}
                            {!isLoadingDepartamentos && !departamentosError && departments.length === 0 && (
                              <option value="">No existen departamentos activos en la base de datos.</option>
                            )}
                            {!isLoadingDepartamentos && !departamentosError && departments.length > 0 && (
                              <>
                                <option value="">-- Selecciona Departamento --</option>
                                {departments.map(d => (
                                  <option key={d.departamento_id} value={d.departamento_id}>
                                    {d.nombre}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                          {fieldErrors.department_id && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.department_id}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Área</label>
                          <select
                            value={wizardData.area_id || ''}
                            onChange={(e) => {
                              const aId = e.target.value ? Number(e.target.value) : '';
                              const arObj = areas.find(a => Number(a.area_id) === Number(aId));
                              handleChange('area_id', aId);
                              handleChange('area', arObj ? arObj.nombre : '');
                            }}
                            className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                            disabled={!wizardData.department_id || isLoadingAreas}
                          >
                            {!wizardData.department_id && (
                              <option value="">Seleccione primero un departamento</option>
                            )}
                            {wizardData.department_id && isLoadingAreas && (
                              <option value="">Cargando áreas...</option>
                            )}
                            {wizardData.department_id && !isLoadingAreas && areasError && (
                              <option value="">{areasError}</option>
                            )}
                            {wizardData.department_id && !isLoadingAreas && !areasError && areas.length === 0 && (
                              <option value="">No existen áreas activas para este departamento.</option>
                            )}
                            {wizardData.department_id && !isLoadingAreas && !areasError && areas.length > 0 && (
                              <>
                                <option value="">-- Selecciona Área --</option>
                                {areas.map(a => (
                                  <option key={a.area_id} value={a.area_id}>
                                    {a.nombre}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Card Informativa */}
                    <div className="p-4 rounded-xl bg-surface-subtle/60 border-l-4 border-l-[#bfce7f] border border-border text-xs text-foreground-secondary flex items-center gap-3 shadow-sm">
                      <Info size={18} className="text-primary shrink-0" />
                      <div>
                        <span className="font-bold text-foreground block text-xs">Directiva de seguridad</span>
                        <span className="text-xs text-foreground-muted">Las credenciales temporales expiran en 7 días y todas las asignaciones quedan registradas en auditoría.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: EMPRESA Y ROL */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Configuración de Empresa y Perfil
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Asocia la empresa y asigna el perfil de usuario correspondiente.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Empresa / Consorcio *</label>
                          <select
                            value={wizardData.companyId || ''}
                            onChange={(e) => handleChange('companyId', e.target.value ? Number(e.target.value) : '')}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.companyId ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                            disabled={isLoadingEmpresas}
                          >
                            {isLoadingEmpresas && <option value="">Cargando empresas...</option>}
                            {empresasError && <option value="">{empresasError}</option>}
                            {!isLoadingEmpresas && !empresasError && companies.length === 0 && (
                              <option value="">No existen empresas activas en la base de datos.</option>
                            )}
                            {!isLoadingEmpresas && !empresasError && companies.length > 0 && (
                              <>
                                <option value="">-- Selecciona Empresa --</option>
                                {companies.map(c => (
                                  <option key={c.empresa_id} value={c.empresa_id}>
                                    {c.nombre_comercial}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                          {fieldErrors.companyId && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.companyId}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Tipo de Usuario *</label>
                          <select
                            value={wizardData.tipo_usuario_id || ''}
                            onChange={(e) => {
                              const valId = e.target.value ? Number(e.target.value) : '';
                              handleChange('tipo_usuario_id', valId);
                              const obj = userTypes.find(t => Number(t.tipo_usuario_id) === Number(valId));
                              if (obj) handleChange('user_type', obj.nombre);
                            }}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.tipo_usuario_id ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                          >
                            <option value="">-- Selecciona Tipo --</option>
                            {userTypes.map(t => (
                              <option key={t.tipo_usuario_id} value={t.tipo_usuario_id}>
                                {t.nombre}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.tipo_usuario_id && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.tipo_usuario_id}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Rol y Método de Acceso Principal
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Define el rol de seguridad RBAC y la vía primaria de autenticación.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Rol Principal *</label>
                          <select
                            value={wizardData.rol_id || ''}
                            onChange={(e) => {
                              const rId = e.target.value ? Number(e.target.value) : '';
                              handleChange('rol_id', rId);
                              const rolObj = roles.find(r => Number(r.numericId || r.id) === Number(rId));
                              if (rolObj) handleChange('role', rolObj.nombre);
                            }}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.rol_id ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                          >
                            <option value="">-- Selecciona Rol --</option>
                            {roles.map(r => (
                              <option key={r.numericId || r.id} value={r.numericId || r.id}>
                                {r.nombre}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.rol_id && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.rol_id}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Método de Acceso Principal *</label>
                          <select
                            value={wizardData.primary_access_type || 'EMAIL'}
                            onChange={(e) => handleChange('primary_access_type', e.target.value)}
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.primary_access_type ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                          >
                            <option value="EMAIL">Correo electrónico</option>
                            <option value="DOCUMENT">Documento de identidad</option>
                          </select>
                          {fieldErrors.primary_access_type && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.primary_access_type}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3.5 bg-surface-subtle/60 border border-border text-xs text-foreground-secondary rounded-xl font-medium">
                        <Info size={16} className="text-primary shrink-0" />
                        <span>
                          <strong className="text-foreground">Acceso sugerido: {wizardData.primary_access_type === 'DOCUMENT' ? 'Documento de identidad' : 'Correo electrónico'}.</strong> Recomendado para usuarios corporativos, administradores, supervisores y analistas.
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-4 shadow-sm">
                      <h4 className="font-bold text-xs text-foreground-secondary">Roles Adicionales (Opcional)</h4>
                      <div className="flex flex-wrap gap-2">
                        {roles.filter(r => r.id != wizardData.rol_id).map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              const newRoles = (wizardData.roles_additional || []).includes(r.id)
                                ? (wizardData.roles_additional || []).filter(roleId => roleId !== r.id)
                                : [...(wizardData.roles_additional || []), r.id];
                              handleChange('roles_additional', newRoles);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                              (wizardData.roles_additional || []).includes(r.id)
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-surface-subtle border-border text-foreground-muted hover:border-border hover:text-foreground-secondary'
                            }`}
                          >
                            <span>{(wizardData.roles_additional || []).includes(r.id) ? '✓' : '+'}</span>
                            {r.name}
                          </button>
                        ))}
                        {roles.filter(r => r.id != wizardData.rol_id).length === 0 && (
                          <span className="text-xs text-foreground-disabled italic">No hay más roles disponibles para asignar.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: ACCESO Y CREDENCIALES */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Credenciales de Acceso por {wizardData.primary_access_type === 'DOCUMENT' ? 'Documento' : 'Correo'}
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Configura la forma de ingreso y contraseñas de primer acceso.</p>
                      </div>

                      {wizardData.primary_access_type === 'EMAIL' ? (
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Correo electrónico *</label>
                          <input 
                            type="email" 
                            value={wizardData.email || ''} 
                            onChange={(e) => handleChange('email', e.target.value)} 
                            className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.email ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                            placeholder="Ej. juan.perez@empresa.com"
                          />
                          {fieldErrors.email && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.email}</span>}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Tipo de documento *</label>
                            <select 
                              value={wizardData.document_type || 'Cédula'} 
                              onChange={(e) => handleChange('document_type', e.target.value)} 
                              className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none cursor-pointer transition-colors ${fieldErrors.document_type ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                            >
                              <option value="Cédula">Cédula</option>
                              <option value="Pasaporte">Pasaporte</option>
                              <option value="RNC">RNC</option>
                            </select>
                            {fieldErrors.document_type && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.document_type}</span>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Número de documento *</label>
                            <input 
                              type="text" 
                              value={wizardData.document_number || ''} 
                              onChange={(e) => handleChange('document_number', e.target.value)} 
                              className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.document_number ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                              placeholder="Ej. 001-1234567-8"
                            />
                            {fieldErrors.document_number && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.document_number}</span>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Teléfono *</label>
                            <input 
                              type="text" 
                              value={wizardData.phone || ''} 
                              onChange={(e) => handleChange('phone', e.target.value)} 
                              className={`w-full bg-input border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-foreground-disabled focus:outline-none transition-colors ${fieldErrors.phone ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`} 
                              placeholder="Ej. +1 (809) 555-0101"
                            />
                            {fieldErrors.phone && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.phone}</span>}
                          </div>
                        </div>
                      )}

                      {isCreating && (
                        <div className="border-t border-border pt-4 mt-2 space-y-4">
                          <div>
                            <h5 className="font-semibold text-xs text-foreground mb-1">Definir Contraseña Inicial *</h5>
                            <p className="text-[11px] text-foreground-muted mb-3">La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Contraseña *</label>
                              <div className="relative">
                                <input
                                  type={showCreatePassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  value={wizardData.password || ''}
                                  onChange={(e) => handleChange('password', e.target.value)}
                                  className={`w-full bg-input border rounded-xl px-3.5 py-2.5 pr-10 text-xs font-normal text-foreground focus:outline-none transition-colors ${fieldErrors.password ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                                  placeholder="Introduce la contraseña"
                                />
                                <button
                                  type="button"
                                  aria-label={showCreatePassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground p-1 transition-colors cursor-pointer"
                                >
                                  {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                              {fieldErrors.password && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.password}</span>}
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Confirmar contraseña *</label>
                              <div className="relative">
                                <input
                                  type={showCreateConfirmPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  value={wizardData.confirm_password || ''}
                                  onChange={(e) => handleChange('confirm_password', e.target.value)}
                                  className={`w-full bg-input border rounded-xl px-3.5 py-2.5 pr-10 text-xs font-normal text-foreground focus:outline-none transition-colors ${fieldErrors.confirm_password ? 'border-rose-500 bg-rose-500/5' : 'border-border focus:border-primary'}`}
                                  placeholder="Confirma la contraseña"
                                />
                                <button
                                  type="button"
                                  aria-label={showCreateConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                                  onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground p-1 transition-colors cursor-pointer"
                                >
                                  {showCreateConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                              {fieldErrors.confirm_password && <span className="text-rose-400 text-[11px] mt-1 font-medium block">{fieldErrors.confirm_password}</span>}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-3.5 border-t border-border pt-4">
                        <label className="flex items-center gap-2.5 cursor-pointer group p-2.5 rounded-xl hover:bg-surface-subtle transition-colors">
                          <input type="checkbox" checked={!!wizardData.must_change_password} onChange={(e) => handleChange('must_change_password', e.target.checked)} className="rounded text-primary w-4 h-4 focus:ring-primary border-border bg-surface-subtle" />
                          <span className="font-medium text-foreground-secondary text-xs group-hover:text-foreground">Forzar cambio de contraseña al primer ingreso</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border rounded-2xl p-6 bg-surface-subtle shadow-sm">
                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Idioma preferido</label>
                        <select value={wizardData.preferred_language || 'es'} onChange={(e) => handleChange('preferred_language', e.target.value)} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary">
                          <option value="es">Español (América Latina)</option>
                          <option value="en">Inglés (US)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Zona horaria</label>
                        <select value={wizardData.timezone || 'America/Santo_Domingo'} onChange={(e) => handleChange('timezone', e.target.value)} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary">
                          <option value="America/Santo_Domingo">America/Santo_Domingo (GMT-4)</option>
                          <option value="America/New_York">America/New_York (GMT-4)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Formato de fecha</label>
                        <select value={wizardData.date_format || 'DD/MM/YYYY'} onChange={(e) => handleChange('date_format', e.target.value)} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary">
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: SEGURIDAD */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-5 shadow-sm">
                      <div className="border-b border-border pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                          Políticas de Seguridad y Accesos
                        </h4>
                        <p className="text-xs text-foreground-muted mt-0.5">Define parámetros de inactividad e intentos de autenticación.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Cerrar sesión por inactividad</label>
                          <select value={wizardData.inactivity_timeout_minutes ?? 0} onChange={(e) => handleChange('inactivity_timeout_minutes', parseInt(e.target.value))} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary">
                            <option value={0}>No aplicar</option>
                            <option value={15}>15 minutos</option>
                            <option value={30}>30 minutos</option>
                            <option value={60}>60 minutos</option>
                            <option value={120}>120 minutos</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Bloquear cuenta por intentos fallidos</label>
                          <select value={wizardData.max_failed_attempts ?? 10} onChange={(e) => handleChange('max_failed_attempts', parseInt(e.target.value))} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary">
                            <option value={3}>Bloquear al tercer intento fallido</option>
                            <option value={5}>Bloquear al quinto intento fallido</option>
                            <option value={10}>Bloquear al décimo intento fallido</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-surface-subtle border border-border hover:border-border">
                          <input type="checkbox" checked={wizardData.require_export_approval || false} onChange={(e) => handleChange('require_export_approval', e.target.checked)} className="rounded text-primary w-4 h-4 focus:ring-primary border-border bg-surface-subtle" />
                          <span className="text-xs font-medium text-foreground-secondary">Exigir aprobación para exportaciones de datos sensibles</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-surface-subtle border border-border hover:border-border">
                          <input type="checkbox" checked={wizardData.require_dual_validation || false} onChange={(e) => handleChange('require_dual_validation', e.target.checked)} className="rounded text-primary w-4 h-4 focus:ring-primary border-border bg-surface-subtle" />
                          <span className="text-xs font-medium text-foreground-secondary">Exigir doble validación (Dual control) para cambios críticos</span>
                        </label>
                      </div>

                      {(wizardData.require_dual_validation || wizardData.role === 'Administrador General') && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                          <ShieldAlert size={16} className="shrink-0" />
                          <span>Atención: Este perfil cuenta con permisos sensibles activados. Se forzará auditoría reforzada.</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-surface-subtle border border-border p-6 rounded-2xl space-y-4 shadow-sm">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <Settings size={16} className="text-primary" />
                        Configuración avanzada
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5">Correo de recuperación (Opcional)</label>
                          <input type="email" value={wizardData.correo_acceso || ''} onChange={(e) => handleChange('correo_acceso', e.target.value)} className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs font-normal text-foreground focus:outline-none focus:border-primary" placeholder="Ej. admin@miempresa.com" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: CONFIRMACION */}
                {currentStep === 5 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="border-b border-border pb-3">
                      <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                        Confirmación del usuario
                      </h4>
                      <p className="text-xs text-foreground-muted mt-1">
                        Revisa la información de identidad, empresa, rol y seguridad antes de finalizar la creación de la cuenta.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Card 1: Identidad */}
                      <div className="bg-surface-subtle p-5 rounded-2xl border border-border space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                            <Users size={15} className="text-primary" /> Identidad
                          </h5>
                          <button 
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <span className="text-foreground-muted font-medium">Nombre:</span>
                          <span className="font-bold text-foreground">{wizardData.full_name}</span>
                          <span className="text-foreground-muted font-medium">Correo:</span>
                          <span className="font-normal text-foreground-secondary">{wizardData.email || '—'}</span>
                          <span className="text-foreground-muted font-medium">Documento:</span>
                          <span className="font-normal text-foreground-secondary">
                            {wizardData.document_number ? `${wizardData.document_type}: ${wizardData.document_number}` : 'No registrado'}
                          </span>
                          <span className="text-foreground-muted font-medium">Posición / Cargo:</span>
                          <span className="font-normal text-foreground-secondary">{wizardData.job_title || '—'} ({wizardData.department || '—'}{wizardData.area ? ` / ${wizardData.area}` : ''})</span>
                        </div>
                      </div>

                      {/* Card 2: Empresa y Rol */}
                      <div className="bg-surface-subtle p-5 rounded-2xl border border-border space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                            <Building2 size={15} className="text-primary" /> Empresa y Rol
                          </h5>
                          <button 
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <span className="text-foreground-muted font-medium">Empresa:</span>
                          <span className="font-bold text-foreground">
                            {companies.find(c => c.empresa_id == wizardData.companyId)?.nombre_comercial || 'Empresa seleccionada'}
                          </span>
                          <span className="text-foreground-muted font-medium">Rol principal:</span>
                          <span className="font-bold text-primary">{wizardData.role}</span>
                          <span className="text-foreground-muted font-medium">Tipo de usuario:</span>
                          <span className="font-normal text-foreground-secondary">{wizardData.user_type || '—'}</span>
                          <span className="text-foreground-muted font-medium">Permisos:</span>
                          <span className="font-normal text-foreground-secondary">
                            {Object.keys(wizardData.permissionsOverride || {}).length > 0 ? 'Permisos específicos' : 'Heredados del rol'}
                          </span>
                        </div>
                      </div>

                      {/* Card 3: Acceso */}
                      <div className="bg-surface-subtle p-5 rounded-2xl border border-border space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                            <Key size={15} className="text-primary" /> Acceso
                          </h5>
                          <button 
                            type="button"
                            onClick={() => setCurrentStep(3)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <span className="text-foreground-muted font-medium">Tipo de acceso:</span>
                          <span className="font-normal text-foreground-secondary">{wizardData.primary_access_type === 'DOCUMENT' ? 'Documento de identidad' : 'Correo electrónico'}</span>
                          <span className="text-foreground-muted font-medium">Identificador:</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {wizardData.primary_access_type === 'DOCUMENT' ? wizardData.document_number : (wizardData.identificador_principal || wizardData.email)}
                          </span>
                          <span className="text-foreground-muted font-medium">Contraseña:</span>
                          <span className="font-semibold text-emerald-500">✓ Configurada</span>
                          <span className="text-foreground-muted font-medium">Cambio clave:</span>
                          <span className="font-normal text-foreground-secondary">{wizardData.must_change_password ? 'Exigido al primer ingreso' : 'No exigido'}</span>
                        </div>
                      </div>

                      {/* Card 4: Seguridad */}
                      <div className="bg-surface-subtle p-5 rounded-2xl border border-border space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                          <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                            <ShieldCheck size={15} className="text-primary" /> Seguridad
                          </h5>
                          <button 
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <span className="text-foreground-muted font-medium">Inactividad:</span>
                          <span className="font-semibold text-foreground">{wizardData.inactivity_timeout_minutes ? `${wizardData.inactivity_timeout_minutes} min` : 'No aplica'}</span>
                          <span className="text-foreground-muted font-medium">Intentos fallidos:</span>
                          <span className="font-semibold text-foreground">{wizardData.max_failed_attempts ? `${wizardData.max_failed_attempts} intentos` : 'No aplica'}</span>
                          <span className="text-foreground-muted font-medium">Estado inicial:</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
                            Pendiente de activación
                          </span>
                          <span className="text-foreground-muted font-medium">Auditoría:</span>
                          <span className="font-normal text-foreground-secondary">Registro permanente habilitado</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. FOOTER FIJO CON ACCIONES */}
            <div className="px-6 py-4 border-t border-border bg-surface-subtle flex items-center justify-between gap-3 shrink-0 z-20">
              <button 
                type="button" 
                disabled={currentStep === 1}
                onClick={handlePrevStep}
                className="px-4 py-2 rounded-xl border border-border hover:bg-surface-subtle/60 text-foreground-secondary font-medium disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                Volver
              </button>

              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={handleCancel} 
                  className="px-4 py-2 rounded-xl border border-border hover:bg-surface-subtle/60 text-foreground-secondary font-medium text-xs transition-colors"
                >
                  Cancelar
                </button>
                
                {currentStep < 5 ? (
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary text-slate-950 font-bold flex items-center gap-1.5 shadow-sm text-xs transition-colors"
                  >
                    Siguiente <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveUser()}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary text-slate-950 font-bold flex items-center gap-1.5 shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? 'Guardando...' : 'Crear usuario'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MOTIVO ADMINISTRATIVO DIALOG (React Portal) */}
      {showReasonModal && reasonAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-subtle/60 backdrop-blur-md"></div>
          
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



      {/* AGENCY SELECTOR SUBMODAL (React Portal) */}
      {isAgencyModalOpen && typeof document !== 'undefined' && wizardData && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-subtle/60 backdrop-blur-md" onClick={() => setIsAgencyModalOpen(false)}></div>
          
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

      {/* CONFIRM EDIT / SAVE MODAL */}
      <SecurityConfirmDialog
        isOpen={showConfirmEditModal || showConfirmSaveModal}
        onClose={() => {
          setShowConfirmEditModal(false);
          setShowConfirmSaveModal(false);
        }}
        onConfirm={showConfirmSaveModal ? handleExecuteSave360 : handleSaveEdit360}
        variant="default"
        title="¿Confirmar guardado?"
        description="¿Desea guardar los cambios realizados en el perfil del usuario?"
        confirmLabel="Guardar cambios"
        isLoading={isSaving}
        loadingLabel="Guardando..."
      />

      {/* CONFIRM REVOKE SINGLE SESSION MODAL */}
      <SecurityConfirmDialog
        isOpen={showRevokeConfirmModal}
        onClose={() => setShowRevokeConfirmModal(false)}
        onConfirm={handleExecuteRevokeSingle}
        variant="danger"
        title="Revocar sesión"
        description="Esta acción cerrará inmediatamente la sesión seleccionada. El usuario deberá iniciar sesión nuevamente en ese dispositivo."
        confirmLabel="Revocar sesión"
        isLoading={isRevokingSession}
        loadingLabel="Revocando..."
        details={sessionToRevoke ? [
          { label: 'Dispositivo', value: sessionToRevoke.device || sessionToRevoke.dispositivo_navegador },
          { label: 'IP', value: sessionToRevoke.ip || sessionToRevoke.direccion_ip, isCode: true },
          { label: 'Inicio de sesión', value: formatSafeDateTime(sessionToRevoke.login_time || sessionToRevoke.fecha_inicio) }
        ] : null}
      />

      {/* CONFIRM REVOKE ALL SESSIONS MODAL */}
      <SecurityConfirmDialog
        isOpen={showRevokeAllConfirmModal}
        onClose={() => setShowRevokeAllConfirmModal(false)}
        onConfirm={handleExecuteRevokeAll}
        variant="danger"
        title="¿Revocar todas las sesiones?"
        description="Esta acción invalidará todas las sesiones activas del usuario, obligando a iniciar sesión nuevamente en todos los dispositivos."
        confirmLabel="Revocar todas"
        isLoading={isRevokingAllSessions}
        loadingLabel="Revocando..."
        extraContent={
          <div className="p-3 rounded-xl bg-input border border-border w-full flex items-center gap-3 text-left">
            <input 
              type="checkbox"
              id="keepCurrentCheck"
              checked={keepCurrentSessionOnRevokeAll}
              onChange={(e) => setKeepCurrentSessionOnRevokeAll(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-subtle text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="keepCurrentCheck" className="text-xs font-bold text-foreground-secondary cursor-pointer select-none">
              Mantener mi sesión actual del administrador abierta
            </label>
          </div>
        }
      />

      {/* CONFIRM DELETE USER MODAL */}
      <SecurityConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDeleteUser}
        variant="danger"
        title="Eliminar usuario"
        description="¿Está seguro de que desea eliminar permanentemente este usuario? Esta acción es irreversible."
        confirmLabel="Eliminar usuario"
        isLoading={isDeleting}
        loadingLabel="Eliminando..."
        details={userToDelete ? [
          { label: 'Usuario', value: userToDelete.full_name },
          { label: 'Rol', value: userToDelete.role }
        ] : null}
      />



      {/* GENERIC ACTION CONFIRMATION MODAL */}
      <SecurityConfirmDialog
        isOpen={genericConfirmModal.isOpen}
        onClose={() => setGenericConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={genericConfirmModal.onConfirm}
        variant={genericConfirmModal.variant}
        title={genericConfirmModal.title}
        description={genericConfirmModal.description}
        confirmLabel={genericConfirmModal.confirmLabel}
        details={genericConfirmModal.details}
      />

      {/* SESSION DETAIL DRAWER */}
      {selectedSessionDetail && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999998] flex justify-end font-mono">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedSessionDetail(null)}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-[500px] h-full bg-card border-l border-border shadow-2xl z-[999999] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-border bg-input flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border text-primary flex items-center justify-center font-bold shadow-inner">
                  <Laptop size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Detalle de sesión</h3>
                  <p className="text-[11px] text-foreground-muted font-medium leading-tight">
                    Información técnica e historial de la conexión seleccionada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="w-8 h-8 rounded-lg bg-card border border-border text-foreground-muted hover:text-foreground hover:border-primary flex items-center justify-center transition-all cursor-pointer"
                title="Cerrar detalle"
                aria-label="Cerrar detalle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
              
              {/* Section 1: Estado */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">1. Estado</span>
                  <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                    selectedSessionDetail.estado === 'ACTIVA' 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : selectedSessionDetail.estado === 'POSIBLEMENTE COLGADA'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : selectedSessionDetail.estado === 'REVOCADA'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : selectedSessionDetail.estado === 'CERRADA'
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    ● {selectedSessionDetail.estado || 'No registrado'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">ID de Sesión</span>
                    <span className="font-mono text-foreground-secondary font-bold select-all">
                      {selectedSessionDetail.sesion_id || selectedSessionDetail.id || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Sesión Actual</span>
                    <span className={`font-bold ${selectedSessionDetail.is_current ? 'text-primary' : 'text-foreground-secondary'}`}>
                      {selectedSessionDetail.is_current ? 'Sí (Este navegador)' : 'No'}
                    </span>
                  </div>
                </div>

                {detailUser && (
                  <div className="pt-2 border-t border-border/50">
                    <span className="text-[10px] text-foreground-muted block font-medium">Usuario</span>
                    <span className="font-bold text-foreground">
                      {detailUser.full_name || 'No registrado'}
                      {detailUser.email && <span className="text-foreground-muted font-normal ml-1">({detailUser.email})</span>}
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Dispositivo */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">2. Dispositivo</span>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Navegador / Sistema Operativo</span>
                    <span className="font-bold text-foreground-secondary block break-words leading-relaxed">
                      {selectedSessionDetail.dispositivo_navegador || selectedSessionDetail.device || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Red */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">3. Red</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Dirección IP</span>
                    <span className="font-mono text-primary font-bold select-all">
                      {selectedSessionDetail.direccion_ip || selectedSessionDetail.ip || 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Ubicación</span>
                    <span className="text-foreground-secondary font-bold">
                      {selectedSessionDetail.ubicacion || selectedSessionDetail.location || 'No registrada'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Tiempos */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">4. Tiempos</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Fecha/Hora de Inicio</span>
                    <span className="text-foreground-secondary font-bold">
                      {formatSafeDateTime(selectedSessionDetail.fecha_inicio || selectedSessionDetail.login_time)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Última Actividad</span>
                    <span className="text-foreground-secondary font-bold">
                      {formatSafeDateTime(selectedSessionDetail.ultima_actividad || selectedSessionDetail.last_activity_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Duración Total</span>
                    <span className="text-primary font-bold">
                      {selectedSessionDetail.duration || 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Fecha Expiración</span>
                    <span className="text-foreground-secondary font-bold">
                      {formatSafeDateTime(selectedSessionDetail.fecha_expiracion)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5: Cierre / Revocación */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">5. Cierre / Revocación</span>
                
                {selectedSessionDetail.estado === 'REVOCADA' && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-rose-400 text-xs">
                      <ShieldX size={14} /> Sesión Revocada por Administrador
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="opacity-75 block text-[10px]">Fecha de Revocación:</span>
                        <span className="font-bold text-foreground">{formatSafeDateTime(selectedSessionDetail.fecha_revocacion || selectedSessionDetail.fecha_cierre)}</span>
                      </div>
                      <div>
                        <span className="opacity-75 block text-[10px]">Administrador que Revocó:</span>
                        <span className="font-bold text-foreground">{selectedSessionDetail.revocado_por_nombre || (selectedSessionDetail.revocado_por ? `Admin #${selectedSessionDetail.revocado_por}` : 'Administrador')}</span>
                      </div>
                    </div>
                    {(selectedSessionDetail.motivo_cierre || selectedSessionDetail.motivo_revocacion) && (
                      <div className="text-[11px] pt-1 border-t border-rose-500/20">
                        <span className="opacity-75 block text-[10px]">Motivo de Revocación:</span>
                        <span className="font-medium text-foreground">{selectedSessionDetail.motivo_cierre || selectedSessionDetail.motivo_revocacion}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedSessionDetail.estado === 'CERRADA' && (
                  <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-sky-400 text-xs">
                      <CheckCircle2 size={14} /> Sesión Cerrada Correctamente
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="opacity-75 block text-[10px]">Fecha de Cierre:</span>
                        <span className="font-bold text-foreground">{formatSafeDateTime(selectedSessionDetail.fecha_cierre || selectedSessionDetail.ultima_actividad)}</span>
                      </div>
                      <div>
                        <span className="opacity-75 block text-[10px]">Causa / Motivo:</span>
                        <span className="font-bold text-foreground">{selectedSessionDetail.motivo_cierre || selectedSessionDetail.tipo_cierre || 'Logout voluntario'}</span>
                      </div>
                    </div>
                    {selectedSessionDetail.tipo_cierre && (
                      <div className="text-[11px] pt-1 border-t border-sky-500/20">
                        <span className="opacity-75 block text-[10px]">Tipo de Cierre:</span>
                        <span className="font-medium text-foreground">{selectedSessionDetail.tipo_cierre}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedSessionDetail.estado === 'EXPIRADA' && (
                  <div className="p-3.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-zinc-400 text-xs">
                      <Clock size={14} /> Sesión Expirada
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="opacity-75 block text-[10px]">Fecha de Expiración:</span>
                        <span className="font-bold text-foreground">{formatSafeDateTime(selectedSessionDetail.fecha_cierre || selectedSessionDetail.fecha_expiracion)}</span>
                      </div>
                      <div>
                        <span className="opacity-75 block text-[10px]">Duración:</span>
                        <span className="font-bold text-foreground">{selectedSessionDetail.duration || '—'}</span>
                      </div>
                    </div>
                    {selectedSessionDetail.motivo_cierre && (
                      <div className="text-[11px] pt-1 border-t border-zinc-700">
                        <span className="opacity-75 block text-[10px]">Causa:</span>
                        <span className="font-medium text-foreground">{selectedSessionDetail.motivo_cierre}</span>
                      </div>
                    )}
                  </div>
                )}

                {(selectedSessionDetail.estado === 'ACTIVA' || selectedSessionDetail.estado === 'POSIBLEMENTE COLGADA') && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-emerald-400 text-xs">Sesión Activa</div>
                      <span className="text-[10px] text-foreground-muted block mt-0.5">La conexión permanece abierta.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const targetSession = selectedSessionDetail;
                        setSelectedSessionDetail(null);
                        handleRevokeSingleSession(targetSession);
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
                    >
                      Revocar sesión
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-input flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="px-5 py-2.5 bg-surface-subtle text-foreground text-xs font-bold rounded-xl border border-border hover:bg-surface-subtle transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ACTIVITY DETAIL DRAWER */}
      {selectedActivityDetail && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999998] flex justify-end font-mono">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedActivityDetail(null)}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-[540px] h-full bg-card border-l border-border shadow-2xl z-[999999] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-border bg-input flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border text-primary flex items-center justify-center font-bold shadow-inner">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Detalle de Actividad</h3>
                  <p className="text-[11px] text-foreground-muted font-medium leading-tight">
                    Información técnica e historial del evento seleccionado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActivityDetail(null)}
                className="w-8 h-8 rounded-lg bg-card border border-border text-foreground-muted hover:text-foreground hover:border-primary flex items-center justify-center transition-all cursor-pointer"
                title="Cerrar detalle"
                aria-label="Cerrar detalle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
              
              {/* Section 1: Identificación y Resultado */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">1. Resultado y Estado</span>
                  {(() => {
                    const res = String(selectedActivityDetail.resultado || selectedActivityDetail.result || 'Exitoso').toUpperCase();
                    let badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                    if (res.includes('ERROR') || res.includes('FALLID')) badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                    else if (res.includes('ADVERT') || res.includes('WARN')) badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                    else if (res.includes('CANCEL')) badgeColor = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                    else if (res.includes('INFO')) badgeColor = 'bg-card text-primary border-border';
                    return (
                      <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                        ● {selectedActivityDetail.resultado || selectedActivityDetail.result || 'Exitoso'}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">ID de Actividad</span>
                    <span className="font-mono text-foreground-secondary font-bold select-all">
                      #{selectedActivityDetail.actividad_id || selectedActivityDetail.id || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Usuario</span>
                    <span className="font-bold text-foreground truncate block">
                      {detailUser?.full_name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Evento y Módulo */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">2. Operación y Módulo</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Acción / Evento</span>
                    <span className="font-bold text-foreground block">
                      {selectedActivityDetail.evento || selectedActivityDetail.event || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Módulo</span>
                    <span className="font-bold text-primary uppercase block">
                      {selectedActivityDetail.modulo || selectedActivityDetail.module || '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Descripción Completa</span>
                    <p className="text-foreground-secondary font-medium leading-relaxed bg-card p-2.5 rounded-lg border border-border">
                      {selectedActivityDetail.descripcion || selectedActivityDetail.desc || '—'}
                    </p>
                  </div>
                </div>

                {(selectedActivityDetail.tabla_afectada || selectedActivityDetail.registro_afectado) && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <span className="text-[10px] text-foreground-muted block font-medium">Tabla Afectada</span>
                      <span className="font-mono text-foreground-secondary font-bold">{selectedActivityDetail.tabla_afectada || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-foreground-muted block font-medium">Registro ID Afectado</span>
                      <span className="font-mono text-foreground-secondary font-bold">{selectedActivityDetail.registro_afectado || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Red y Entorno */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">3. Red y Dispositivo</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Dirección IP</span>
                    <span className="font-mono text-primary font-bold select-all">
                      {selectedActivityDetail.direccion_ip || selectedActivityDetail.ip || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Dispositivo / Agente</span>
                    <span className="text-foreground-secondary font-bold break-words">
                      {selectedActivityDetail.dispositivo || selectedActivityDetail.device || 'No registrado'}
                    </span>
                  </div>
                </div>

                {(selectedActivityDetail.url || selectedActivityDetail.metodo_http) && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div>
                      <span className="text-[10px] text-foreground-muted block font-medium">Método HTTP</span>
                      <span className="font-mono text-emerald-400 font-bold">{selectedActivityDetail.metodo_http || 'GET'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-foreground-muted block font-medium">Ruta / URL</span>
                      <span className="font-mono text-foreground-secondary truncate block">{selectedActivityDetail.url || '/'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Tiempos */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">4. Tiempos y Rendimiento</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Fecha y Hora</span>
                    <span className="text-foreground-secondary font-bold">
                      {formatSafeDateTime(selectedActivityDetail.timestamp || selectedActivityDetail.fecha_hora)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Tiempo de Ejecución</span>
                    <span className="text-primary font-bold">
                      {selectedActivityDetail.duracion_ms ? `${selectedActivityDetail.duracion_ms} ms` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5: Antes y Después (Visor de Cambios) */}
              {(selectedActivityDetail.antes || selectedActivityDetail.valor_anterior || selectedActivityDetail.despues || selectedActivityDetail.valor_nuevo) && (
                <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                  <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">5. Comparativa de Cambios (Antes / Después)</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Valor Previo</span>
                      <pre className="p-3 rounded-lg bg-card border border-rose-500/20 text-rose-300 font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                        {typeof (selectedActivityDetail.antes || selectedActivityDetail.valor_anterior) === 'object'
                          ? JSON.stringify(selectedActivityDetail.antes || selectedActivityDetail.valor_anterior, null, 2)
                          : String(selectedActivityDetail.antes || selectedActivityDetail.valor_anterior || 'No registrado')}
                      </pre>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Nuevo Valor</span>
                      <pre className="p-3 rounded-lg bg-card border border-emerald-500/20 text-emerald-300 font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                        {typeof (selectedActivityDetail.despues || selectedActivityDetail.valor_nuevo) === 'object'
                          ? JSON.stringify(selectedActivityDetail.despues || selectedActivityDetail.valor_nuevo, null, 2)
                          : String(selectedActivityDetail.despues || selectedActivityDetail.valor_nuevo || 'No registrado')}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-input flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedActivityDetail(null)}
                className="px-5 py-2.5 bg-surface-subtle text-foreground text-xs font-bold rounded-xl border border-border hover:bg-surface-subtle transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AUDIT DETAIL DRAWER */}
      {selectedAuditDetail && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999998] flex justify-end font-mono">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedAuditDetail(null)}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-[540px] h-full bg-card border-l border-border shadow-2xl z-[999999] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-border bg-input flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border text-primary flex items-center justify-center font-bold shadow-inner">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Detalle de Auditoría</h3>
                  <p className="text-[11px] text-foreground-muted font-medium leading-tight">
                    Historial oficial e inalterable de la modificación administrativa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditDetail(null)}
                className="w-8 h-8 rounded-lg bg-card border border-border text-foreground-muted hover:text-foreground hover:border-primary flex items-center justify-center transition-all cursor-pointer"
                title="Cerrar detalle"
                aria-label="Cerrar detalle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
              
              {/* Section 1: Evento y Resultado */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">1. Evento y Estado</span>
                  <span className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider border ${
                    String(selectedAuditDetail.resultado || '').toUpperCase().includes('ERR')
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}>
                    ● {selectedAuditDetail.resultado || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">ID de Auditoría</span>
                    <span className="font-mono text-foreground-secondary font-bold select-all">
                      #{selectedAuditDetail.auditoria_id || selectedAuditDetail.id || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Usuario Afectado</span>
                    <span className="font-bold text-foreground truncate block">
                      {detailUser?.full_name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Información Administrativa */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">2. Operación y Ejecutor</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Acción Registrada</span>
                    <span className="font-bold text-primary block">
                      {getFriendlyActionTitle(selectedAuditDetail.accion || selectedAuditDetail.action)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Ejecutado Por (Admin)</span>
                    <span className="font-bold text-foreground block">
                      {selectedAuditDetail.admin_nombre || selectedAuditDetail.performed_by || '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Motivo / Justificación</span>
                    <p className="text-foreground-secondary font-medium leading-relaxed bg-card p-2.5 rounded-lg border border-border">
                      {selectedAuditDetail.motivo || selectedAuditDetail.reason || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Red y Entorno */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">3. Red y Dispositivo</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Dirección IP</span>
                    <span className="font-mono text-primary font-bold select-all">
                      {selectedAuditDetail.direccion_ip || selectedAuditDetail.ip || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground-muted block font-medium">Dispositivo / Agente</span>
                    <span className="text-foreground-secondary font-bold break-words">
                      {selectedAuditDetail.dispositivo || selectedAuditDetail.device || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Fechas */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">4. Marca Temporal</span>
                
                <div>
                  <span className="text-[10px] text-foreground-muted block font-medium">Fecha y Hora Exacta</span>
                  <span className="text-foreground-secondary font-bold">
                    {formatSafeDateTime(selectedAuditDetail.fecha_hora || selectedAuditDetail.timestamp || selectedAuditDetail.performed_at)}
                  </span>
                </div>
              </div>

              {/* Section 5: Cambios Realizados (Visor Comparativo ANTES / DESPUÉS) */}
              {(() => {
                const diffRes = parseDiffValues(
                  selectedAuditDetail.valor_anterior || selectedAuditDetail.before_value,
                  selectedAuditDetail.valor_nuevo || selectedAuditDetail.after_value
                );

                return (
                  <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                    <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider block">5. Cambios Realizados (Antes → Después)</span>

                    {diffRes.isParsed && diffRes.diffs ? (
                      <div className="space-y-2.5 pt-1">
                        {diffRes.diffs.map((d, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-card border border-border space-y-2">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                              Campo: {d.field}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-0.5">
                                <span className="text-[9px] font-bold uppercase text-rose-400 block">Antes</span>
                                <span className="font-mono text-foreground-secondary font-medium break-all">{d.before}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-0.5">
                                <span className="text-[9px] font-bold uppercase text-emerald-400 block">Después</span>
                                <span className="font-mono text-foreground-secondary font-medium break-all">{d.after}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Valor Anterior (ANTES)</span>
                          <span className="font-mono text-foreground-secondary break-words block">
                            {diffRes.before}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Valor Nuevo (DESPUÉS)</span>
                          <span className="font-mono text-foreground-secondary break-words block">
                            {diffRes.after}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-input flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAuditDetail(null)}
                className="px-5 py-2.5 bg-surface-subtle text-foreground text-xs font-bold rounded-xl border border-border hover:bg-surface-subtle transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Bikers' Fort Toast Notification */}
      {toastNotification && typeof window !== 'undefined' && createPortal(
        <div
          role={toastNotification.type === 'error' ? 'alert' : 'status'}
          aria-live={toastNotification.type === 'error' ? 'assertive' : 'polite'}
          className={`fixed top-16 right-6 z-[9999] w-[380px] max-w-[calc(100vw-32px)] p-4 rounded-xl border shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toastNotification.type === 'success'
              ? 'bg-surface-subtle border-primary text-foreground'
              : 'bg-error/10 border-error text-foreground'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {toastNotification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-error" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <h4 className="text-sm font-semibold text-foreground leading-tight">
                {toastNotification.title}
              </h4>
              <p className={`text-xs mt-1 leading-relaxed whitespace-normal break-words ${
                toastNotification.type === 'success' ? 'text-primary' : 'text-error'
              }`}>
                {toastNotification.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className={`shrink-0 p-1 rounded-lg transition-colors cursor-pointer ${
                toastNotification.type === 'success'
                  ? 'text-primary/70 hover:text-primary hover:bg-primary/10'
                  : 'text-error/70 hover:text-error hover:bg-error/10'
              }`}
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MANUAL RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && resetPasswordUser && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 font-sans">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
            onClick={handleCloseResetPasswordModal} 
          />
          
          <div 
            role="dialog"
            aria-modal="true"
            className="relative w-[480px] max-w-[calc(100vw-32px)] min-w-[320px] bg-surface-elevated border border-border rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-foreground shrink-0"
          >
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border bg-surface-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center text-primary">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground font-sans">Restablecer contraseña</h3>
                  <p className="text-[11px] text-foreground-muted font-sans">Asigna una nueva contraseña para este usuario.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCloseResetPasswordModal}
                disabled={isManualResetting}
                className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitManualResetPassword} className="p-6 space-y-4 font-sans">
              
              {/* User Context Badge */}
              <div className="p-3 bg-surface-subtle border border-border rounded-xl flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-mono font-bold text-foreground-muted uppercase tracking-wider">Usuario:</span>
                  <span className="font-bold text-foreground truncate max-w-[240px]">
                    {getUserDisplayName(resetPasswordUser)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-mono font-bold text-foreground-muted uppercase tracking-wider">Dato de Acceso (Login):</span>
                  <span className="font-mono font-bold text-primary truncate max-w-[240px]">
                    {getLoginAccessIdentifier(resetPasswordUser)}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {resetPasswordError && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-xl flex items-start gap-2.5 text-error text-xs">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{resetPasswordError}</span>
                </div>
              )}

              {/* New Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1.5 font-mono">
                  Nueva contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showResetNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo"
                    disabled={isManualResetting}
                    className="w-full bg-input border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label={showResetNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                    onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                    tabIndex={0}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer p-1 transition-colors"
                  >
                    {showResetNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-1.5 font-mono">
                  Confirmar contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showResetConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    disabled={isManualResetting}
                    className="w-full bg-input border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-foreground placeholder:text-foreground-disabled focus:outline-none focus:border-primary transition-colors font-mono"
                  />
                  <button
                    type="button"
                    aria-label={showResetConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    tabIndex={0}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer p-1 transition-colors"
                  >
                    {showResetConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Policy note */}
              <p className="text-[11px] text-foreground-muted font-sans">
                La contraseña debe cumplir la política de seguridad del sistema (8+ caracteres, mayúscula, minúscula, número y símbolo).
              </p>

              {/* Force change checkbox */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none text-xs text-foreground font-medium">
                <input
                  type="checkbox"
                  checked={resetForceChange}
                  onChange={(e) => setResetForceChange(e.target.checked)}
                  disabled={isManualResetting}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
                <span>Solicitar cambio de contraseña en el próximo inicio de sesión</span>
              </label>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseResetPasswordModal}
                  disabled={isManualResetting}
                  className="px-4 py-2.5 text-xs font-semibold text-foreground-secondary hover:text-foreground bg-surface-subtle hover:bg-hover border border-border rounded-xl transition-all cursor-pointer disabled:opacity-50 font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isManualResetting || !resetNewPassword || !resetConfirmPassword}
                  className="px-5 py-2.5 bg-primary-button-bg hover:brightness-110 text-primary-foreground text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isManualResetting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Restableciendo...
                    </>
                  ) : (
                    <>
                      <KeyRound size={14} />
                      Restablecer contraseña
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}