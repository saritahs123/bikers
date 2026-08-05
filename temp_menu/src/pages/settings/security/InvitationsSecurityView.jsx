import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  Users, MoreVertical, X, Check, AlertCircle, RotateCw, ChevronLeft, ChevronRight, ChevronDown, Filter, SlidersHorizontal, ToggleLeft, ToggleRight,
  ShieldCheck, Shield, Key, Mail, Phone, Building2, Eye, EyeOff, LayoutGrid, List, FileText, Calendar, Clock, Info, ShieldX, User, ArrowRight, CheckSquare, Search, UserPlus
} from 'lucide-react';
import { INITIAL_USERS_DATA, USER_TYPES, USER_ROLES } from '../../../config/catalogs/usersCatalog';
import { INITIAL_COMPANIES_DATA } from '../../../config/catalogs/companiesCatalog';

export default function InvitationsSecurityView({ onOpenSidebar }) {
  const navigate = useNavigate();

  // Load persistence from window database or mock data
  const [data, setData] = useState(() => {
    if (typeof window !== 'undefined' && window.usersData) {
      return window.usersData;
    }
    return INITIAL_USERS_DATA;
  });

  const [companies] = useState(() => {
    if (typeof window !== 'undefined' && window.companiesData) {
      return window.companiesData;
    }
    return INITIAL_COMPANIES_DATA;
  });

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedInvitation, setSelectedInvitation] = useState(null); // Side panel selected user
  const [toast, setToast] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);

  // Filters State
  const [filterCompany, setFilterCompany] = useState('Todos');
  const [filterMethod, setFilterMethod] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterUserType, setFilterUserType] = useState('Todos');
  const [filterSentDate, setFilterSentDate] = useState('');
  const [filterExpireDate, setFilterExpireDate] = useState('');
  const [filterLoginRealized, setFilterLoginRealized] = useState('Todos');
  const [searchText, setSearchText] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Sync to window global database
  const syncData = (newData) => {
    setData(newData);
    if (typeof window !== 'undefined') {
      window.usersData = newData;
    }
    // Update side panel detail user in real-time if open
    if (selectedInvitation) {
      const refreshed = newData.find(u => u.id === selectedInvitation.id);
      if (refreshed) setSelectedInvitation(refreshed);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const addAuditLog = (userId, action, entity, before, after, reason) => {
    if (typeof window !== 'undefined') {
      if (!window.auditData) window.auditData = [];
      window.auditData.unshift({
        id: `AUD-NEW-${Date.now()}`,
        user_id: userId,
        action,
        entity,
        before_state: before,
        after_state: after,
        ip_address: '192.168.1.102',
        device: 'macOS Chrome Admin Console',
        performed_by: 'Admin',
        timestamp: new Date().toISOString(),
        reason
      });
    }
  };

  const addActivityLog = (userId, title, description) => {
    if (typeof window !== 'undefined') {
      if (!window.activitiesData) window.activitiesData = [];
      window.activitiesData.unshift({
        id: `ACT-NEW-${Date.now()}`,
        user_id: userId,
        event_type: 'onboarding',
        title,
        description,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Global listener to close dropdowns
  useEffect(() => {
    const handleGlobalClick = () => {
      if (activeDropdown) setActiveDropdown(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeDropdown]);

  // General random pass/PIN generator
  const generateRandomPassword = (isPin = false) => {
    if (isPin) {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Administrative Lifecycle Handlers
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
            status_detail: 'Invitación enviada por correo electrónico',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Envío de Invitación', 'users', 'Pendiente de envío', 'Invitación enviada', 'Invitación enviada por el administrador.');
    addActivityLog(user.id, 'Invitación Enviada', 'Correo electrónico de activación despachado.');
    showToast('Invitación enviada con éxito.');
  };

  const handleResendInvitationDirect = (user) => {
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
            status_detail: 'Invitación reenviada manualmente por administrador',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addActivityLog(user.id, 'Invitación Reenviada', 'Correo electrónico de activación reenviado.');
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
            activation_status: 'REVOKED',
            invitation_sent_at: null,
            invitation_opened_at: null,
            registration_completed_at: null,
            invitation_expires_at: null,
            status_detail: 'Invitación revocada por el administrador',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Revocación de Acceso', 'users', 'Activa', 'Revocada', 'Acceso/Invitación revocada por administrador.');
    addActivityLog(user.id, 'Invitación Revocada', 'Acceso anulado y cuenta convertida a revocada.');
    showToast('Invitación y acceso revocados.');
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
            status_detail: 'Invitación regenerada con nuevo token de expiración',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Regeneración de Invitación', 'users', 'Expirada', 'Invitación enviada', 'Invitación regenerada.');
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
            status_detail: 'Recordatorio enviado por correo electrónico',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addActivityLog(user.id, 'Recordatorio Enviado', 'Recordatorio de inicio de sesión enviado por correo.');
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
            status_detail: 'Credenciales temporales regeneradas',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Regeneración de Credencial', 'users', 'PIN previo', 'Nuevo PIN generado', 'PIN temporal restablecido por administrador.');
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
            status_detail: 'Credenciales marcadas como entregadas físicamente',
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

  // Metrics calculation
  const metrics = useMemo(() => {
    let counts = {
      enviadas: 0,
      pendientesEnvio: 0,
      pendientesRegistro: 0,
      registradosSinLogin: 0,
      primerLogin: 0,
      expiradas: 0,
      rebotadas: 0,
      pendientePrimerIngreso: 0
    };

    data.forEach(u => {
      const act = u.activation;
      if (!act) return;
      const status = act.activation_status;

      if (status === 'INVITATION_SENT' || status === 'INVITATION_OPENED') counts.enviadas++;
      if (status === 'DRAFT' || status === 'INVITATION_PENDING') counts.pendientesEnvio++;
      if (status === 'INVITATION_SENT' || status === 'INVITATION_OPENED') counts.pendientesRegistro++;
      if (status === 'REGISTRATION_COMPLETED') counts.registradosSinLogin++;
      if (status === 'FIRST_LOGIN_COMPLETED' || status === 'INITIAL_PASSWORD_CHANGED') counts.primerLogin++;
      if (status === 'INVITATION_EXPIRED') counts.expiradas++;
      if (status === 'INVITATION_BOUNCED') counts.rebotadas++;
      if (status === 'CREDENTIALS_GENERATED' || status === 'PENDING_FIRST_LOGIN') counts.pendientePrimerIngreso++;
    });

    return counts;
  }, [data]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    let result = [...data];

    // Filter by text search: name, email, or document
    if (searchText.trim()) {
      const term = searchText.toLowerCase();
      result = result.filter(u => 
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.document_number && u.document_number.includes(term))
      );
    }

    // Filter by company
    if (filterCompany !== 'Todos') {
      result = result.filter(u => u.companyId === filterCompany);
    }

    // Filter by method
    if (filterMethod !== 'Todos') {
      result = result.filter(u => u.activation?.access_method === filterMethod);
    }

    // Filter by activation status
    if (filterStatus !== 'Todos') {
      result = result.filter(u => u.activation?.activation_status === filterStatus);
    }

    // Filter by user type
    if (filterUserType !== 'Todos') {
      result = result.filter(u => u.user_type === filterUserType);
    }

    // Filter by login realized
    if (filterLoginRealized !== 'Todos') {
      const realized = filterLoginRealized === 'Si';
      result = result.filter(u => {
        const hasLogin = u.activation?.activation_status === 'FIRST_LOGIN_COMPLETED' || u.activation?.activation_status === 'INITIAL_PASSWORD_CHANGED' || !!u.activation?.first_login_at;
        return realized ? hasLogin : !hasLogin;
      });
    }

    // Filter by sent date (approx date check)
    if (filterSentDate) {
      result = result.filter(u => {
        const dateStr = u.activation?.invitation_sent_at || u.activation?.temporary_credentials_generated_at;
        if (!dateStr) return false;
        return dateStr.startsWith(filterSentDate);
      });
    }

    // Filter by expire date (approx date check)
    if (filterExpireDate) {
      result = result.filter(u => {
        const dateStr = u.activation?.invitation_expires_at;
        if (!dateStr) return false;
        return dateStr.startsWith(filterExpireDate);
      });
    }

    return result;
  }, [data, searchText, filterCompany, filterMethod, filterStatus, filterUserType, filterLoginRealized, filterSentDate, filterExpireDate]);

  // Clean Filters Handler
  const handleClearFilters = () => {
    setFilterCompany('Todos');
    setFilterMethod('Todos');
    setFilterStatus('Todos');
    setFilterUserType('Todos');
    setFilterSentDate('');
    setFilterExpireDate('');
    setFilterLoginRealized('Todos');
    setSearchText('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterCompany !== 'Todos') count++;
    if (filterMethod !== 'Todos') count++;
    if (filterStatus !== 'Todos') count++;
    if (filterUserType !== 'Todos') count++;
    if (filterSentDate) count++;
    if (filterExpireDate) count++;
    if (filterLoginRealized !== 'Todos') count++;
    if (searchText) count++;
    return count;
  }, [filterCompany, filterMethod, filterStatus, filterUserType, filterSentDate, filterExpireDate, filterLoginRealized, searchText]);

  // Status Badge Builder
  const renderActivationBadge = (status, accessMethod, item) => {
    let finalStatus = status;
    const method = accessMethod || item?.activation?.access_method || 'EMAIL';

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
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-455">Invitación expirada</span>;
        case 'INVITATION_BOUNCED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-300 bg-rose-100 text-rose-600 dark:bg-rose-700/10 dark:text-rose-400">Invitación rebotada</span>;
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
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-350 bg-rose-50 text-rose-600 dark:bg-rose-900/10 dark:text-rose-400">Acceso bloqueado</span>;
        case 'REVOKED':
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-700/10 dark:text-slate-400">Revocada</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Estado no disponible</span>;
      }
    }
  };

  // Administrative required action text resolver
  const getRequiredAction = (item) => {
    const accessMethod = item.activation?.access_method || 'EMAIL';
    const status = item.activation?.activation_status || 'DRAFT';

    if (status === 'REVOKED') return 'Sin acción requerida';

    if (accessMethod === 'EMAIL') {
      switch (status) {
        case 'DRAFT':
        case 'INVITATION_PENDING':
          return 'Enviar invitación';
        case 'INVITATION_SENT':
          return 'Esperar apertura / Reenviar';
        case 'INVITATION_OPENED':
          return 'Enviar recordatorio';
        case 'REGISTRATION_COMPLETED':
          return 'Recordar primer login';
        case 'FIRST_LOGIN_COMPLETED':
          return 'Sin acción requerida';
        case 'INVITATION_EXPIRED':
          return 'Regenerar invitación';
        case 'INVITATION_BOUNCED':
          return 'Corregir correo';
        default:
          return 'Sin acción requerida';
      }
    } else {
      switch (status) {
        case 'CREDENTIALS_GENERATED':
          return 'Entregar instrucciones';
        case 'PENDING_FIRST_LOGIN':
          return 'Regenerar PIN / Recordar ingreso';
        case 'INITIAL_PASSWORD_CHANGED':
          return 'Esperar primer acceso';
        case 'FIRST_LOGIN_COMPLETED':
          return 'Sin acción requerida';
        case 'ACCESS_BLOCKED':
          return 'Desbloquear acceso';
        default:
          return 'Sin acción requerida';
      }
    }
  };

  // Row Action Renderer
  const renderRowActions = (item) => {
    const accessMethod = item.activation?.access_method || 'EMAIL';
    const actStatus = item.activation?.activation_status || 'DRAFT';
    const actions = [];

    // General "Ver activación"
    actions.push(
      <button
        key="ver-activacion"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
        onClick={() => setSelectedInvitation(item)}
      >
        <Eye size={13} className="text-[var(--text-muted)]" /> Ver activación
      </button>
    );

    // General "Ver usuario" (Redirects back to main users grid)
    actions.push(
      <button
        key="ver-usuario"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
        onClick={() => navigate(`/settings/security/users?search=${item.full_name}`)}
      >
        <User size={13} className="text-[var(--text-muted)]" /> Ver usuario
      </button>
    );

    // Dynamic actions based on states
    if (accessMethod === 'EMAIL') {
      if (actStatus === 'INVITATION_EXPIRED' || actStatus === 'INVITATION_BOUNCED') {
        actions.push(
          <button
            key="regenerar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleRegenerateInvitationDirect(item)}
          >
            <RotateCw size={13} className="text-[var(--text-muted)]" /> Regenerar invitación
          </button>
        );
      } else if (actStatus === 'INVITATION_SENT') {
        actions.push(
          <button
            key="reenviar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleResendInvitationDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Reenviar invitación
          </button>,
          <button
            key="copiar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleCopyActivationLink(item)}
          >
            <CheckSquare size={13} className="text-[var(--text-muted)]" /> Copiar enlace
          </button>,
          <button
            key="revocar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-rose-500 font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleRevokeInvitationDirect(item)}
          >
            <ShieldX size={13} /> Revocar invitación
          </button>
        );
      } else if (actStatus === 'INVITATION_OPENED') {
        actions.push(
          <button
            key="recordatorio"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleSendReminderDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Enviar recordatorio
          </button>,
          <button
            key="revocar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-rose-500 font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleRevokeInvitationDirect(item)}
          >
            <ShieldX size={13} /> Revocar invitación
          </button>
        );
      } else if (actStatus === 'REGISTRATION_COMPLETED') {
        actions.push(
          <button
            key="recordatorio"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleSendReminderDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Enviar recordatorio
          </button>
        );
      } else if (actStatus === 'DRAFT' || actStatus === 'INVITATION_PENDING') {
        actions.push(
          <button
            key="enviar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleSendInvitationDirect(item)}
          >
            <Mail size={13} className="text-[var(--text-muted)]" /> Enviar invitación
          </button>
        );
      }
    } else { // DOCUMENT access
      if (actStatus === 'CREDENTIALS_GENERATED' || actStatus === 'PENDING_FIRST_LOGIN') {
        actions.push(
          <button
            key="regenerar-pin"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleRegeneratePinDirect(item)}
          >
            <Key size={13} className="text-[var(--text-muted)]" /> Regenerar PIN temporal
          </button>,
          <button
            key="entregar"
            className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
            onClick={() => handleMarkInstructionsDelivered(item)}
          >
            <Check size={13} className="text-[var(--text-muted)]" /> Entregar instrucciones
          </button>
        );
      }
    }

    // General "Ver historial" (Redirects back to audit logs for that user)
    actions.push(
      <button
        key="ver-historial"
        className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5 border-t border-[var(--border-color)] pt-1"
        onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
      >
        <FileText size={13} className="text-[var(--text-muted)]" /> Ver historial
      </button>
    );

    // Overwrite for REVOKED users: only allow "Ver activación" and "Ver historial"
    if (actStatus === 'REVOKED') {
      return [
        <button
          key="ver-activacion"
          className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
          onClick={() => setSelectedInvitation(item)}
        >
          <Eye size={13} className="text-[var(--text-muted)]" /> Ver activación
        </button>,
        <button
          key="ver-historial"
          className="w-full text-left px-4 py-1.5 text-[13px] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-color)] flex items-center gap-1.5"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
        >
          <FileText size={13} className="text-[var(--text-muted)]" /> Ver historial
        </button>
      ];
    }

    return actions;
  };

  // Helper to edit email address
  const handleEditEmail = (user) => {
    const newEmail = prompt('Ingrese el nuevo correo electrónico:', user.email);
    if (newEmail === null) return; // Cancelled
    if (!newEmail || !newEmail.includes('@')) {
      showToast('Correo electrónico inválido.', 'error');
      return;
    }
    const updated = data.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          email: newEmail,
          activation: {
            ...u.activation,
            activation_status: 'INVITATION_PENDING', // set to pending to resend
            status_detail: 'Correo actualizado por administrador. Listo para enviar.',
            updated_at: new Date().toISOString()
          }
        };
      }
      return u;
    });
    syncData(updated);
    addAuditLog(user.id, 'Edición de Correo', 'users', user.email, newEmail, 'Correo electrónico corregido por rebote.');
    addActivityLog(user.id, 'Correo Editado', `Dirección corregida a: ${newEmail}`);
    showToast('Correo electrónico actualizado con éxito.');
  };

  // Helper for password reset
  const handleResetPasswordAction = (user) => {
    const confirmReset = window.confirm(`¿Está seguro de restablecer la contraseña para ${user.full_name}? Se enviará un enlace.`);
    if (!confirmReset) return;
    showToast('Enlace de restablecimiento enviado con éxito.');
    addAuditLog(user.id, 'Restablecer Clave', 'users', 'Activo', 'Enlace enviado', 'Restablecimiento de contraseña solicitado por administrador.');
    addActivityLog(user.id, 'Clave Restablecida', 'Se solicitó el enlace de restablecimiento de contraseña.');
  };

  // Helper for revoking sessions
  const handleRevokeSessions = (user) => {
    const confirmRevoke = window.confirm(`¿Desea revocar todas las sesiones activas de ${user.full_name}?`);
    if (!confirmRevoke) return;
    showToast('Todas las sesiones activas han sido revocadas.');
    addAuditLog(user.id, 'Revocar Sesiones', 'users', 'Sesiones activas', 'Sesiones cerradas', 'Cierre de sesión forzado.');
    addActivityLog(user.id, 'Sesiones Revocadas', 'Se cerraron todas las sesiones activas del usuario.');
  };

  // Helper for sending push/in-app notification
  const handleSendNotification = (user) => {
    const msg = prompt('Escriba el mensaje a enviar al usuario:');
    if (!msg) return;
    showToast('Notificación enviada con éxito.');
    addActivityLog(user.id, 'Notificación Enviada', `Mensaje: "${msg}"`);
  };

  const renderQuickActions = (item) => {
    const method = item.activation?.access_method || 'EMAIL';
    let status = item.activation?.activation_status || 'DRAFT';

    // If first_login_at or last_login_at exists, it's FIRST_LOGIN_COMPLETED
    const hasLogin = !!item.activation?.first_login_at || !!item.last_login_at;
    if (hasLogin) {
      status = 'FIRST_LOGIN_COMPLETED';
    }

    const actionButtons = [];

    // "Ver usuario" is present for all states
    actionButtons.push(
      <button
        key="quick-ver-user"
        onClick={() => navigate(`/settings/security/users?search=${item.full_name}`)}
        className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
      >
        <User size={12} /> Ver usuario
      </button>
    );

    // Contextual buttons
    if (status === 'FIRST_LOGIN_COMPLETED') {
      actionButtons.push(
        <button
          key="quick-ver-audit"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver auditoría
        </button>,
        <button
          key="quick-reset-pass"
          onClick={() => handleResetPasswordAction(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Key size={12} /> Restablecer contraseña
        </button>,
        <button
          key="quick-revoke-sess"
          onClick={() => handleRevokeSessions(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-rose-500 font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <ShieldX size={12} /> Revocar sesiones
        </button>,
        <button
          key="quick-send-notif"
          onClick={() => handleSendNotification(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Info size={12} /> Enviar notificación
        </button>
      );
    } else if (status === 'INVITATION_SENT') {
      actionButtons.push(
        <button
          key="quick-resend"
          onClick={() => handleResendInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Reenviar invitación
        </button>,
        <button
          key="quick-copy-link"
          onClick={() => handleCopyActivationLink(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <CheckSquare size={12} /> Copiar enlace
        </button>,
        <button
          key="quick-revoke"
          onClick={() => handleRevokeInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-rose-500 font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <ShieldX size={12} /> Revocar invitación
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else if (status === 'INVITATION_OPENED') {
      actionButtons.push(
        <button
          key="quick-reminder"
          onClick={() => handleSendReminderDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Enviar recordatorio
        </button>,
        <button
          key="quick-revoke"
          onClick={() => handleRevokeInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-rose-500 font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <ShieldX size={12} /> Revocar invitación
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else if (status === 'REGISTRATION_COMPLETED') {
      actionButtons.push(
        <button
          key="quick-reminder"
          onClick={() => handleSendReminderDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Enviar recordatorio
        </button>,
        <button
          key="quick-reset-pass"
          onClick={() => handleResetPasswordAction(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Key size={12} /> Restablecer contraseña
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else if (status === 'INVITATION_EXPIRED') {
      actionButtons.push(
        <button
          key="quick-regenerate"
          onClick={() => handleRegenerateInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <RotateCw size={12} /> Regenerar invitación
        </button>,
        <button
          key="quick-resend"
          onClick={() => handleResendInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Reenviar invitación
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else if (status === 'INVITATION_BOUNCED') {
      actionButtons.push(
        <button
          key="quick-edit-email"
          onClick={() => handleEditEmail(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Editar correo
        </button>,
        <button
          key="quick-resend"
          onClick={() => handleResendInvitationDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Mail size={12} /> Reenviar invitación
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else if (method === 'DOCUMENT' && (status === 'PENDING_FIRST_LOGIN' || status === 'CREDENTIALS_GENERATED' || status === 'INITIAL_PASSWORD_CHANGED')) {
      actionButtons.push(
        <button
          key="quick-regen-pin"
          onClick={() => handleRegeneratePinDirect(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Key size={12} /> Regenerar PIN
        </button>,
        <button
          key="quick-mark-delivered"
          onClick={() => handleMarkInstructionsDelivered(item)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <Check size={12} /> Marcar entregado
        </button>,
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    } else {
      // Default fallback / Revocada / Inactivo
      actionButtons.push(
        <button
          key="quick-ver-historial"
          onClick={() => navigate(`/settings/security/users?search=${item.full_name}&tab=auditoria`)}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] text-[var(--text-secondary)] font-bold text-[10.5px] flex items-center gap-1 transition-all"
        >
          <FileText size={12} /> Ver historial
        </button>
      );
    }

    return actionButtons;
  };

  return (
    <div className="p-6 pb-12 flex flex-col min-h-full space-y-6">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 border ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/10' : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/10'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
          <span className="text-[12.5px] font-bold">{toast.message}</span>
        </div>
      )}

      {/* Temp Password PIN Display Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border-color)] max-w-sm w-full p-6 space-y-4 relative overflow-hidden animate-in zoom-in duration-200 text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto">
              <Key size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Credenciales Generadas Exitosamente</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Copia y entrega este código temporal de forma segura.</p>
            </div>
            <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)] text-lg font-mono font-black text-blue-500 select-all tracking-wider">
              {tempPassword}
            </div>
            <button
              onClick={() => { setShowPassModal(false); setTempPassword(''); }}
              className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm"
            >
              Entendido y Copiado
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumbs and Title Header */}
      <header className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-500 shadow-sm"
            onClick={onOpenSidebar}
          >
            <Filter size={16} />
          </button>
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-color)] w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Users size={12} />
            Identidad y Cuentas
          </div>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Invitaciones y Activación
          </h1>
          <p className="text-[12.5px] text-[var(--text-muted)] mt-1 max-w-3xl leading-relaxed">
            Monitorea el envío, apertura, registro y primer acceso de los usuarios invitados.
          </p>
        </div>
      </header>

      {/* Metrics Upper Grid (7 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        {[
          { label: 'Enviadas', value: metrics.enviadas, sub: 'Correo despachado', color: 'border-blue-500/20 text-blue-500 bg-blue-500/5' },
          { label: 'Pend. envío', value: metrics.pendientesEnvio, sub: 'Borrador / pendiente', color: 'border-slate-500/20 text-slate-500 bg-slate-500/5' },
          { label: 'Pend. registro', value: metrics.pendientesRegistro, sub: 'Sin completar registro', color: 'border-purple-500/20 text-purple-500 bg-purple-500/5' },
          { label: 'Sin primer login', value: metrics.registradosSinLogin, sub: 'Registro listo', color: 'border-cyan-500/20 text-cyan-500 bg-cyan-500/5' },
          { label: 'Acceso confirmado', value: metrics.primerLogin, sub: 'Primer login realizado', color: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' },
          { label: 'Expiradas', value: metrics.expiradas, sub: 'Superó 48h', color: 'border-rose-400/20 text-rose-455 bg-rose-500/5' },
          { label: 'Rebotadas', value: metrics.rebotadas, sub: 'Falló entrega', color: 'border-rose-600/30 text-rose-600 bg-rose-700/5' }
        ].map((c, i) => (
          <div key={i} className={`bg-[var(--bg-elevated)] border rounded-xl p-3 shadow-xs flex flex-col justify-between space-y-1.5 transition-all ${c.color}`} title={c.label === 'Acceso confirmado' ? 'Primer login realizado' : undefined}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 leading-tight">{c.label}</span>
            <div className="text-xl font-black font-mono leading-none">{c.value}</div>
            <span className="text-[9px] opacity-70 leading-none">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* Filters and Search Bar Container */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm flex flex-col gap-4 shrink-0">
        
        {/* Search input, Method Filter and Action buttons */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o documento..."
              className="block w-full rounded-lg border-0 bg-[var(--bg-color)] py-2.5 pl-9 pr-8 text-[var(--text-primary)] ring-1 ring-inset ring-[var(--border-color)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-inset focus:ring-rose-500 text-xs transition-all outline-none"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button 
                onClick={() => setSearchText('')}
                className="absolute inset-y-0 right-3 my-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick horizontal filter chips for Method */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-muted)] flex items-center gap-1">
              <Filter size={11} /> Método:
            </span>
            <div className="flex gap-1.5">
              {['Todos', 'EMAIL', 'DOCUMENT'].map(m => (
                <button
                  key={m}
                  onClick={() => setFilterMethod(m)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    filterMethod === m
                      ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                      : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                  }`}
                >
                  {m === 'Todos' ? 'Todos' : m === 'EMAIL' ? 'Correo' : 'Documento'}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowFiltersModal(true)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                activeFiltersCount > 0 
                  ? 'border-rose-200 bg-rose-50 text-rose-600 dark:bg-rose-500/10' 
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-color)]'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtros Avanzados
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white font-bold font-mono text-[9px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2.5 rounded-lg border border-rose-200 text-rose-500 text-xs font-bold hover:bg-rose-50 transition-all shadow-xs"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Advanced Filters Overlay Portal / Dialog */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
            <header className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-rose-500" />
                Filtros de Activación y Onboarding
              </h2>
              <button onClick={() => setShowFiltersModal(false)} className="p-1 rounded-full hover:bg-[var(--bg-color)]">
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar text-xs">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Company filter */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Empresa / Consorcio</label>
                  <select
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                  >
                    <option value="Todos">Todas las Empresas</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* User Type filter */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Tipo de Usuario</label>
                  <select
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterUserType}
                    onChange={(e) => setFilterUserType(e.target.value)}
                  >
                    <option value="Todos">Todos los Tipos</option>
                    {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Activation Status filter */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Estado de Activación</label>
                  <select
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="Todos">Todos los Estados</option>
                    <option value="DRAFT">Pendiente de envío (Correo)</option>
                    <option value="INVITATION_SENT">Invitación enviada (Correo)</option>
                    <option value="INVITATION_OPENED">Invitación abierta (Correo)</option>
                    <option value="REGISTRATION_COMPLETED">Registro completado (Correo)</option>
                    <option value="FIRST_LOGIN_COMPLETED">Primer login realizado</option>
                    <option value="INVITATION_EXPIRED">Invitación expirada (Correo)</option>
                    <option value="INVITATION_BOUNCED">Invitación rebotada (Correo)</option>
                    <option value="CREDENTIALS_GENERATED">Credenciales generadas (Doc)</option>
                    <option value="PENDING_FIRST_LOGIN">Pendiente primer ingreso (Doc)</option>
                    <option value="INITIAL_PASSWORD_CHANGED">PIN / contraseña cambiado (Doc)</option>
                    <option value="ACCESS_BLOCKED">Acceso bloqueado (Doc)</option>
                    <option value="REVOKED">Revocada</option>
                  </select>
                </div>

                {/* Login Realized filter */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Primer Login Realizado</label>
                  <select
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterLoginRealized}
                    onChange={(e) => setFilterLoginRealized(e.target.value)}
                  >
                    <option value="Todos">Cualquier Estado</option>
                    <option value="Si">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Sent Date */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Fecha de Envío / Generación</label>
                  <input
                    type="date"
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterSentDate}
                    onChange={(e) => setFilterSentDate(e.target.value)}
                  />
                </div>

                {/* Expire Date */}
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-secondary)]">Fecha de Expiración</label>
                  <input
                    type="date"
                    className="w-full p-2 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-semibold focus:ring-1 focus:ring-rose-500 outline-none"
                    value={filterExpireDate}
                    onChange={(e) => setFilterExpireDate(e.target.value)}
                  />
                </div>

              </div>
            </div>

            <footer className="pt-3 border-t border-[var(--border-color)] flex gap-2 justify-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-xs font-bold hover:bg-[var(--bg-color)]"
              >
                Restablecer
              </button>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 shadow-sm"
              >
                Aplicar Filtros
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Main Invitations Data Table */}
      <div className="flex-1 overflow-hidden border border-[var(--border-color)] rounded-xl bg-[var(--bg-elevated)] shadow-sm flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs relative min-w-[1400px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)] text-[10.5px] font-bold text-[var(--text-muted)] sticky top-0 z-20 select-none">
                <th className="py-3 px-4 w-[240px] sticky left-0 bg-[var(--bg-color)] border-r border-[var(--border-color)] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Usuario</th>
                <th className="py-3 px-4">Identificador principal</th>
                <th className="py-3 px-4">Empresa / Consorcio</th>
                <th className="py-3 px-4">Tipo de usuario</th>
                <th className="py-3 px-4 text-center">Método de acceso</th>
                <th className="py-3 px-4 text-center w-[160px]">Estado de activación</th>
                <th className="py-3 px-4 w-[180px]">Acción requerida</th>
                <th className="py-3 px-4">Envío / generación</th>
                <th className="py-3 px-4">Apertura</th>
                <th className="py-3 px-4">Registro</th>
                <th className="py-3 px-4">Primer acceso</th>
                <th className="py-3 px-4">Expira en</th>
                <th className="py-3 px-4 text-center">Reenvíos</th>
                <th className="py-3 px-4 text-right pr-6 w-[80px] sticky right-0 bg-[var(--bg-color)] border-l border-[var(--border-color)] z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-[var(--text-muted)] font-medium">
                    No se encontraron registros de invitación con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredData.map(item => {
                  const act = item.activation || {};
                  const isDropdownOpen = activeDropdown === item.id;
                  
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedInvitation(item)}
                      className="hover:bg-[var(--bg-color)] transition-colors cursor-pointer group select-none"
                    >
                      {/* User Column */}
                      <td className="py-3 px-4 sticky left-0 bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-color)] transition-colors border-r border-[var(--border-color)] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center justify-center font-bold text-[10.5px] shrink-0">
                            {item.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <span className="font-extrabold text-[var(--text-primary)] block truncate leading-tight group-hover:text-rose-500 transition-colors">
                              {item.full_name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] block truncate font-mono mt-0.5">
                              {item.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Primary Identifier */}
                      <td className="py-3 px-4 font-mono font-bold text-indigo-500">
                        {item.login_identifiers?.find(id => id.is_primary)?.identifier_value || item.email}
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">
                        {companies.find(c => c.id === item.companyId)?.name || 'Loteka'}
                      </td>

                      {/* User Type */}
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">
                        {item.user_type}
                      </td>

                      {/* Access Method */}
                      <td className="py-3 px-4 text-center font-bold">
                        {act.access_method === 'DOCUMENT' ? (
                          <span className="text-amber-600 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-200/50">Documento</span>
                        ) : (
                          <span className="text-blue-600 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-200/50">Correo electrónico</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderActivationBadge(act.activation_status, act.access_method, item)}
                      </td>

                      {/* Required Action */}
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">
                        {getRequiredAction(item)}
                      </td>

                      {/* Sent Date */}
                      <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">
                        {act.invitation_sent_at || act.temporary_credentials_generated_at ? (
                          new Date(act.invitation_sent_at || act.temporary_credentials_generated_at).toLocaleDateString()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Opened Date */}
                      <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">
                        {act.invitation_opened_at ? (
                          new Date(act.invitation_opened_at).toLocaleDateString()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Registration Completed Date */}
                      <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">
                        {act.registration_completed_at ? (
                          new Date(act.registration_completed_at).toLocaleDateString()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* First Login Date */}
                      <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">
                        {act.first_login_at ? (
                          new Date(act.first_login_at).toLocaleDateString()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Expires At */}
                      <td className="py-3 px-4 text-rose-500 font-bold font-mono">
                        {act.invitation_expires_at ? (
                          new Date(act.invitation_expires_at) < new Date() ? (
                            <span className="text-rose-600 font-black">Expirado</span>
                          ) : (
                            new Date(act.invitation_expires_at).toLocaleDateString()
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Resends */}
                      <td className="py-3 px-4 text-center font-bold font-mono text-[var(--text-secondary)]">
                        {act.resend_count || 0}
                      </td>

                      {/* Action Cell */}
                      <td className="py-3 px-4 text-right pr-6 relative sticky right-0 bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-color)] transition-colors border-l border-[var(--border-color)] z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.02)]" onClick={e => e.stopPropagation()}>
                        <button
                          className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-color)] rounded-lg transition-colors inline-block outline-none"
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(isDropdownOpen ? null : item.id); }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {isDropdownOpen && (
                          <div className="absolute right-12 top-2 mt-1 w-52 bg-[var(--bg-elevated)] rounded-lg shadow-xl border border-[var(--border-color)] py-1.5 z-40 text-left">
                            {renderRowActions(item)}
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

      {/* Side Detail Overlay: "Detalle de activación" */}
      {selectedInvitation && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedInvitation(null)}
        >
          <div 
            className="relative w-full sm:w-[500px] h-full bg-[var(--bg-elevated)] border-l border-[var(--border-color)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Sidebar Header */}
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-color)] shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)] text-sm md:text-base">Detalle de activación</h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Seguimiento del acceso inicial del usuario.</p>
                </div>
                <button 
                  onClick={() => setSelectedInvitation(null)}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-color)]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Identity Info card inside header */}
              <div className="flex items-center gap-3 bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-color)]">
                <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs">
                  {selectedInvitation.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').replace(/\./g, '').substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1">
                  <h4 className="font-black text-sm text-[var(--text-primary)] truncate leading-tight">{selectedInvitation.full_name}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate font-semibold">
                    {selectedInvitation.role} · {companies.find(c => c.id === selectedInvitation.companyId)?.name || 'Loteka'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {renderActivationBadge(selectedInvitation.activation?.activation_status, selectedInvitation.activation?.access_method, selectedInvitation)}
                    {selectedInvitation.activation?.access_method === 'DOCUMENT' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200/50 bg-amber-500/5 text-amber-600">Documento</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200/50 bg-blue-500/5 text-blue-600">Correo electrónico</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="px-5 py-3.5 bg-[var(--bg-color)] border-b border-[var(--border-color)] shrink-0">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Acciones rápidas</h5>
              <div className="flex flex-wrap gap-2">
                {renderQuickActions(selectedInvitation)}
              </div>
            </div>

            {/* Sidebar Body (Internal Scroll) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
              
              {/* A. Resumen del usuario */}
              <div className="space-y-3">
                <h4 className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1">
                  <User size={12} className="text-[var(--text-muted)]" /> Resumen del usuario
                </h4>
                <div className="grid grid-cols-2 gap-y-2 text-[11px] bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--border-color)]">
                  <span className="text-[var(--text-muted)] font-semibold">Usuario:</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedInvitation.full_name} ({selectedInvitation.id})</span>

                  <span className="text-[var(--text-muted)] font-semibold">Empresa / Consorcio:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {companies.find(c => c.id === selectedInvitation.companyId)?.name || 'Loteka'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Tipo de usuario:</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedInvitation.user_type}</span>

                  <span className="text-[var(--text-muted)] font-semibold">Rol principal:</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedInvitation.role}</span>

                  <span className="text-[var(--text-muted)] font-semibold">Método de acceso:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedInvitation.activation?.access_method === 'DOCUMENT' ? 'Documento' : 'Correo electrónico'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Identificador principal:</span>
                  <span className="font-mono font-bold text-indigo-500 truncate">
                    {selectedInvitation.login_identifiers?.find(id => id.is_primary)?.identifier_value || selectedInvitation.email}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Estado de activación:</span>
                  <span className="flex items-center">
                    {renderActivationBadge(selectedInvitation.activation?.activation_status, selectedInvitation.activation?.access_method, selectedInvitation)}
                  </span>
                </div>
              </div>

              {/* B. Datos del onboarding */}
              <div className="space-y-3">
                <h4 className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1">
                  <Clock size={12} className="text-[var(--text-muted)]" /> Datos del onboarding
                </h4>
                <div className="grid grid-cols-2 gap-y-2 text-[11px] bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--border-color)]">
                  <span className="text-[var(--text-muted)] font-semibold">Canal:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedInvitation.activation?.channel === 'EMAIL' ? 'Correo electrónico' : 'Ficha física impresa'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Fecha de creación:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedInvitation.createdAt ? new Date(selectedInvitation.createdAt).toLocaleString() : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Fecha de envío / generación:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedInvitation.activation?.invitation_sent_at || selectedInvitation.activation?.temporary_credentials_generated_at ? (
                      new Date(selectedInvitation.activation.invitation_sent_at || selectedInvitation.activation.temporary_credentials_generated_at).toLocaleString()
                    ) : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Fecha de apertura:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedInvitation.activation?.invitation_opened_at ? new Date(selectedInvitation.activation.invitation_opened_at).toLocaleString() : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Fecha de registro:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedInvitation.activation?.registration_completed_at ? new Date(selectedInvitation.activation.registration_completed_at).toLocaleString() : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Primer acceso realizado:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedInvitation.activation?.first_login_at ? new Date(selectedInvitation.activation.first_login_at).toLocaleString() : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Expira en:</span>
                  <span className="font-bold text-rose-500 font-mono">
                    {selectedInvitation.activation?.invitation_expires_at ? (
                      new Date(selectedInvitation.activation.invitation_expires_at) < new Date() ? (
                        <span className="text-rose-600 font-black">Expirado</span>
                      ) : (
                        new Date(selectedInvitation.activation.invitation_expires_at).toLocaleString()
                      )
                    ) : '—'}
                  </span>

                  <span className="text-[var(--text-muted)] font-semibold">Reenvíos:</span>
                  <span className="font-bold font-mono text-[var(--text-primary)]">{selectedInvitation.activation?.resend_count || 0}</span>

                  <div className="col-span-2 mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Resultado de envío / Detalle</span>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">
                      {((selectedInvitation.activation?.first_login_at || selectedInvitation.last_login_at) ? (
                        "Onboarding completado y acceso inicial confirmado."
                      ) : (
                        selectedInvitation.activation?.status_detail || 'Sin detalles disponibles.'
                      ))}
                    </p>
                  </div>
                </div>
              </div>

              {/* C. Línea de tiempo visual */}
              <div className="space-y-4">
                <h4 className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1">
                  <Calendar size={12} className="text-[var(--text-muted)]" /> Línea de tiempo visual
                </h4>
                {(() => {
                  const method = selectedInvitation.activation?.access_method || 'EMAIL';
                  const currentStatus = selectedInvitation.activation?.activation_status || 'DRAFT';
                  
                  let steps = [];
                  if (method === 'EMAIL') {
                    const hasSent = !!selectedInvitation.activation?.invitation_sent_at;
                    const hasOpened = !!selectedInvitation.activation?.invitation_opened_at;
                    const hasRegistered = !!selectedInvitation.activation?.registration_completed_at;
                    const hasLogined = !!selectedInvitation.activation?.first_login_at || !!selectedInvitation.last_login_at;

                    const isBounced = currentStatus === 'INVITATION_BOUNCED';
                    const isExpired = currentStatus === 'INVITATION_EXPIRED';

                    steps = [
                      {
                        label: 'Usuario creado',
                        time: selectedInvitation.createdAt,
                        state: 'completed',
                        desc: 'Registro inicial de datos'
                      },
                      {
                        label: 'Invitación enviada',
                        time: selectedInvitation.activation?.invitation_sent_at,
                        state: isBounced || isExpired ? 'error' : hasSent ? 'completed' : currentStatus === 'INVITATION_PENDING' ? 'active' : 'pending',
                        desc: isBounced ? 'Fallo en entrega de correo (Rebotada)' : isExpired ? 'Plazo de 48h superado (Expirada)' : hasSent ? 'Correo electrónico despachado' : 'Correo electrónico pendiente de envío'
                      },
                      {
                        label: 'Link abierto',
                        time: selectedInvitation.activation?.invitation_opened_at,
                        state: hasOpened ? 'completed' : (hasSent && !isBounced && !isExpired && currentStatus === 'INVITATION_SENT') ? 'active' : 'pending',
                        desc: hasOpened ? 'El usuario abrió el enlace de activación' : 'Esperando apertura del enlace por el usuario'
                      },
                      {
                        label: 'Registro completado',
                        time: selectedInvitation.activation?.registration_completed_at,
                        state: hasRegistered ? 'completed' : (hasOpened && currentStatus === 'INVITATION_OPENED') ? 'active' : 'pending',
                        desc: hasRegistered ? 'Contraseña y datos confirmados' : 'Pendiente de confirmación de contraseña y datos'
                      },
                      {
                        label: 'Primer acceso realizado',
                        time: selectedInvitation.activation?.first_login_at || selectedInvitation.last_login_at,
                        state: hasLogined ? 'completed' : (hasRegistered && currentStatus === 'REGISTRATION_COMPLETED') ? 'active' : 'pending',
                        desc: hasLogined ? 'Ingreso activo al portal' : 'Pendiente de primer inicio de sesión'
                      }
                    ];
                  } else {
                    const hasGenerated = !!selectedInvitation.activation?.temporary_credentials_generated_at;
                    const hasDelivered = !!selectedInvitation.activation?.temporary_credentials_delivered_at;
                    const hasPinChanged = !!selectedInvitation.activation?.initial_password_changed_at;
                    const hasLogined = !!selectedInvitation.activation?.first_login_at || !!selectedInvitation.last_login_at;

                    const isBlocked = currentStatus === 'ACCESS_BLOCKED';

                    steps = [
                      {
                        label: 'Usuario creado',
                        time: selectedInvitation.createdAt,
                        state: 'completed',
                        desc: 'Registro inicial del documento'
                      },
                      {
                        label: 'Credenciales generadas',
                        time: selectedInvitation.activation?.temporary_credentials_generated_at,
                        state: hasGenerated ? 'completed' : 'pending',
                        desc: hasGenerated ? 'PIN de acceso temporal listo' : 'Pendiente de generación de PIN'
                      },
                      {
                        label: 'Instrucciones entregadas',
                        time: selectedInvitation.activation?.temporary_credentials_delivered_at,
                        state: hasDelivered ? 'completed' : (hasGenerated && currentStatus === 'CREDENTIALS_GENERATED') ? 'active' : 'pending',
                        desc: hasDelivered ? 'Ficha o PIN entregado físicamente' : 'Pendiente de entrega física de instrucciones'
                      },
                      {
                        label: 'Primer ingreso realizado',
                        time: selectedInvitation.activation?.first_login_at || selectedInvitation.last_login_at,
                        state: hasLogined ? 'completed' : (hasDelivered && currentStatus === 'PENDING_FIRST_LOGIN') ? 'active' : 'pending',
                        desc: hasLogined ? 'Primer acceso usando PIN temporal' : 'Pendiente de primer ingreso al portal'
                      },
                      {
                        label: 'PIN / contraseña cambiado',
                        time: selectedInvitation.activation?.initial_password_changed_at,
                        state: isBlocked ? 'error' : hasPinChanged ? 'completed' : (hasLogined && !hasPinChanged) ? 'active' : 'pending',
                        desc: isBlocked ? 'Acceso bloqueado por administrador' : hasPinChanged ? 'Cambio de clave obligatoria realizado' : 'Pendiente de cambio de PIN temporal por definitivo'
                      }
                    ];
                  }

                  return (
                    <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3.5 space-y-5 py-1">
                      {steps.map((st, i) => {
                        let bulletColor = 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700';
                        let titleColor = 'text-[var(--text-secondary)] font-bold';
                        let textColor = 'text-[var(--text-muted)]';

                        if (st.state === 'completed') {
                          bulletColor = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
                          titleColor = 'text-emerald-700 dark:text-emerald-400 font-extrabold';
                          textColor = 'text-[var(--text-primary)] font-medium';
                        } else if (st.state === 'active') {
                          bulletColor = 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 animate-pulse';
                          titleColor = 'text-amber-700 dark:text-amber-400 font-extrabold';
                          textColor = 'text-[var(--text-primary)] font-medium';
                        } else if (st.state === 'error') {
                          bulletColor = 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/20';
                          titleColor = 'text-rose-600 dark:text-rose-400 font-extrabold';
                          textColor = 'text-rose-500 dark:text-rose-400 font-medium';
                        }

                        return (
                          <div key={i} className="relative pl-7">
                            <div className={`absolute -left-[11px] top-0.5 w-5.5 h-5.5 rounded-full border flex items-center justify-center text-[10px] transition-all shadow-xs ${bulletColor}`}>
                              {i + 1}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[11.5px] ${titleColor}`}>{st.label}</span>
                                {st.time && (
                                  <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-color)] border border-[var(--border-color)] px-1 py-0.2 rounded">
                                    {new Date(st.time).toLocaleDateString()} {new Date(st.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] leading-tight ${textColor}`}>{st.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* D. Historial reciente */}
              <div className="space-y-3">
                <h4 className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] border-b border-[var(--border-color)] pb-1.5 flex items-center gap-1">
                  <FileText size={12} className="text-[var(--text-muted)]" /> Historial de eventos reciente
                </h4>
                <div className="space-y-2">
                  {(() => {
                    let userLogs = [];
                    if (typeof window !== 'undefined') {
                      const audits = (window.auditData || []).filter(log => log.user_id === selectedInvitation.id);
                      const activities = (window.activitiesData || []).filter(log => log.user_id === selectedInvitation.id);
                      
                      audits.forEach(a => {
                        userLogs.push({
                          timestamp: a.timestamp,
                          title: a.action,
                          desc: `${a.before_state} ➔ ${a.after_state}. IP: ${a.ip_address}`,
                          by: a.performed_by || 'Admin',
                          type: 'audit'
                        });
                      });
                      
                      activities.forEach(ac => {
                        userLogs.push({
                          timestamp: ac.timestamp,
                          title: ac.title,
                          desc: ac.description,
                          by: 'Sistema',
                          type: 'activity'
                        });
                      });
                    }

                    if (userLogs.length === 0) {
                      const actObj = selectedInvitation.activation || {};
                      if (selectedInvitation.createdAt) {
                        userLogs.push({
                          timestamp: selectedInvitation.createdAt,
                          title: 'Usuario registrado',
                          desc: 'Registro inicial de datos de identidad creado en consola.',
                          by: 'Administrador',
                          type: 'audit'
                        });
                      }
                      if (actObj.invitation_sent_at || actObj.temporary_credentials_generated_at) {
                        userLogs.push({
                          timestamp: actObj.invitation_sent_at || actObj.temporary_credentials_generated_at,
                          title: actObj.access_method === 'DOCUMENT' ? 'PIN Temporal Generado' : 'Invitación despachada',
                          desc: actObj.access_method === 'DOCUMENT' ? 'Código temporal de 6 dígitos creado para acceso.' : 'Correo electrónico enviado al buzón principal.',
                          by: 'Sistema',
                          type: 'activity'
                        });
                      }
                      if (actObj.invitation_opened_at) {
                        userLogs.push({
                          timestamp: actObj.invitation_opened_at,
                          title: 'Enlace de activación abierto',
                          desc: 'El usuario accedió al portal de registro desde el enlace recibido.',
                          by: 'Usuario',
                          type: 'activity'
                        });
                      }
                      if (actObj.registration_completed_at) {
                        userLogs.push({
                          timestamp: actObj.registration_completed_at,
                          title: 'Contraseña establecida',
                          desc: 'Registro completado. Contraseña y alcances validados con éxito.',
                          by: 'Usuario',
                          type: 'activity'
                        });
                      }
                      if (actObj.first_login_at) {
                        userLogs.push({
                          timestamp: actObj.first_login_at,
                          title: 'Primer acceso exitoso',
                          desc: 'Inicio de sesión activo completado en la plataforma.',
                          by: 'Usuario',
                          type: 'activity'
                        });
                      }
                    }

                    userLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    return userLogs.map((log, index) => (
                      <div key={index} className="p-2.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)] text-[11px] space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-extrabold text-[var(--text-primary)]">{log.title}</span>
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">
                            {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{log.desc}</p>
                        <div className="flex justify-between items-center text-[9px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)] mt-1.5">
                          <span>Ejecutado por: <strong className="text-[var(--text-secondary)]">{log.by}</strong></span>
                          <span className={`px-1 py-0.2 rounded font-bold uppercase text-[8px] ${
                            log.type === 'audit' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {log.type === 'audit' ? 'Auditoría' : 'Sistema'}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>

            {/* Sidebar Footer Operations */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-color)] flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedInvitation(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] font-bold text-xs transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setSelectedInvitation(null);
                    navigate(`/settings/security/users?search=${selectedInvitation.full_name}`);
                  }}
                  className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-bold text-xs transition-colors flex items-center gap-1"
                >
                  <User size={13} /> Ver usuario
                </button>
              </div>

              {(() => {
                const accessMethod = selectedInvitation.activation?.access_method || 'EMAIL';
                let actStatus = selectedInvitation.activation?.activation_status || 'DRAFT';

                const hasLogin = !!selectedInvitation.activation?.first_login_at || !!selectedInvitation.last_login_at;
                if (hasLogin) {
                  actStatus = 'FIRST_LOGIN_COMPLETED';
                }

                if (actStatus === 'REVOKED') return null;

                // Si estado = Acceso confirmado ➔ Ver auditoría
                if (actStatus === 'FIRST_LOGIN_COMPLETED') {
                  return (
                    <button
                      onClick={() => {
                        setSelectedInvitation(null);
                        navigate(`/settings/security/users?search=${selectedInvitation.full_name}&tab=auditoria`);
                      }}
                      className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      Ver auditoría
                    </button>
                  );
                }

                if (accessMethod === 'EMAIL') {
                  // Si estado = Invitación enviada ➔ Reenviar invitación
                  if (actStatus === 'INVITATION_SENT') {
                    return (
                      <button
                        onClick={() => handleResendInvitationDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Reenviar invitación
                      </button>
                    );
                  }
                  if (actStatus === 'INVITATION_PENDING' || actStatus === 'DRAFT') {
                    return (
                      <button
                        onClick={() => handleSendInvitationDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Enviar invitación
                      </button>
                    );
                  }
                  // Si estado = Invitación expirada ➔ Regenerar invitación
                  if (actStatus === 'INVITATION_EXPIRED' || actStatus === 'INVITATION_BOUNCED') {
                    return (
                      <button
                        onClick={() => handleRegenerateInvitationDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Regenerar invitación
                      </button>
                    );
                  }
                  // Si estado = Invitación abierta ➔ Enviar recordatorio
                  if (actStatus === 'INVITATION_OPENED') {
                    return (
                      <button
                        onClick={() => handleSendReminderDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Enviar recordatorio
                      </button>
                    );
                  }
                  // Si estado = Registro completado sin primer acceso ➔ Enviar recordatorio
                  if (actStatus === 'REGISTRATION_COMPLETED' && !hasLogin) {
                    return (
                      <button
                        onClick={() => handleSendReminderDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Enviar recordatorio
                      </button>
                    );
                  }
                } else {
                  // Si método = Documento y estado = Pendiente de primer ingreso ➔ Regenerar PIN
                  if (actStatus === 'PENDING_FIRST_LOGIN') {
                    return (
                      <button
                        onClick={() => handleRegeneratePinDirect(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Regenerar PIN
                      </button>
                    );
                  }
                  if (actStatus === 'CREDENTIALS_GENERATED') {
                    return (
                      <button
                        onClick={() => handleMarkInstructionsDelivered(selectedInvitation)}
                        className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        Marcar entregado
                      </button>
                    );
                  }
                }

                return null;
              })()}
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
