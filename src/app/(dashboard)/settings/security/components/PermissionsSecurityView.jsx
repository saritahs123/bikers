"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Key, ShieldAlert, ToggleLeft, ToggleRight, Save, RotateCw, 
  Info, AlertTriangle, Coins, FileSpreadsheet, Lock, Clock, Settings, ShieldCheck, CheckCircle2
} from 'lucide-react';

const DEFAULT_PERMISSIONS = {
  double_validation_vendedora: false,
  max_cash_limit_day: 50000,
  max_tickets_per_minute: 15,
  require_export_approval: true,
  max_export_rows_limit: 500,
  mfa_enforcement: true,
  session_inactivity_timeout: 30,
  max_login_failed_attempts: 5,
  ip_allowlist_enforcement: false,
  cyber_mfa: true,
  otp_method: 'app',
  access_expiration: '',
  access_schedule: '24/7',
  allowed_ips: '*',
  inactivity_action: 'none',
  failed_attempts_action: 'block_10',
  export_approval_sensitive: false,
  dual_control_critical: false
};

export default function PermissionsSecurityView({ onOpenSidebar }) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const apiBase = '/api';
  const [settings, setSettings] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${apiBase}/regla-operativa-seguridad?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSettings(prev => ({ ...prev, ...data }));
          }
        }
      } catch (error) {
        console.error("Error fetching rules", error);
        setToast('Error al cargar la configuración de la BD.');
        setTimeout(() => setToast(null), 3000);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);


  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNumberChange = (key, val) => {
    setSettings(prev => ({
      ...prev,
      [key]: parseInt(val) || 0
    }));
  };

  const handleSaveClick = () => {
    setShowSaveConfirmModal(true);
  };

  const handleExecuteSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/regla-operativa-seguridad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setShowSaveConfirmModal(false);
        setShowSuccessModal(true);
      } else {
        setShowSaveConfirmModal(false);
        showToast('Error al guardar políticas.');
      }
    } catch (error) {
      console.error(error);
      setShowSaveConfirmModal(false);
      showToast('Error de conexión al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirmModal(true);
  };

  const handleExecuteReset = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/regla-operativa-seguridad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_PERMISSIONS)
      });
      if (res.ok) {
        setSettings({ ...DEFAULT_PERMISSIONS });
        setShowResetConfirmModal(false);
        setShowSuccessModal(true);
      } else {
        showToast('Error al restablecer políticas.');
      }
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al restablecer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 flex flex-col min-h-full animate-in fade-in duration-300">
      
      {/* Toast */}
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
            <ToggleLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-color)] w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Key size={12} className="text-primary" />
              Gobernanza y Autenticación
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight mt-1.5 flex items-center gap-2">
              Reglas Operativas
            </h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-1 font-medium">
              Gestiona límites operativos, aprobaciones de doble firma y umbrales críticos de seguridad perimetral.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button 
            onClick={handleResetClick}
            disabled={saving || loading}
            className={`flex-1 md:flex-initial bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${saving || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RotateCw size={14} className="text-[var(--text-muted)]" />
            Restablecer Umbrales
          </button>
          <button 
            onClick={handleSaveClick}
            disabled={saving || loading}
            className={`flex-1 md:flex-initial font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 ${
              saving || loading 
              ? 'bg-primary text-on-primary cursor-not-allowed opacity-70' 
              : 'bg-primary text-on-primary hover:bg-primary-fixed text-on-primary'
            }`}
          >
            {saving ? (
              <RotateCw size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </header>

      {/* Grid of Sections */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--bg-color)]/60 backdrop-blur-sm rounded-2xl">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg"></div>
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-500 ${loading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Category 3: Seguridad Perimetral */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
            <div className="p-2 bg-primary/10 text-primary-fixed dark:text-primary rounded-lg">
              <Lock size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-[var(--text-primary)] uppercase tracking-wider">Políticas de Sesión y MFA</h3>
          </div>

          <div className="space-y-4">
            {/* Toggle 3 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[75%]">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">MFA Obligatorio Global</span>
                <span className="text-[10px] text-[var(--text-muted)] leading-normal mt-0.5">Fuerza el uso de autenticación de doble factor para todas las cuentas con accesos administrativos.</span>
              </div>
              <button 
                onClick={() => handleToggle('mfa_enforcement')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {settings.mfa_enforcement ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

            {/* Limit 4 */}
            <div className="flex flex-col gap-1.5 pt-4 border-t border-[var(--border-color)]/50">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[var(--text-primary)]">Inactividad de Sesión (Min)</label>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                Tiempo de espera en minutos antes de que el token JWT del usuario expire y obligue un re-login por inactividad.
              </p>
              <input 
                type="number"
                value={settings.session_inactivity_timeout}
                onChange={(e) => handleNumberChange('session_inactivity_timeout', e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Limit 5 */}
            <div className="flex flex-col gap-1.5 pt-4 border-t border-[var(--border-color)]/50">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[var(--text-primary)]">Intentos Fallidos de Login</label>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                Número de contraseñas/PINs erróneos consecutivos antes de bloquear la cuenta administrativamente.
              </p>
              <input 
                type="number"
                value={settings.max_login_failed_attempts}
                onChange={(e) => handleNumberChange('max_login_failed_attempts', e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Toggle 4 */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]/50">
              <div className="flex flex-col max-w-[70%]">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Restricción de IPs Corporativas</span>
                <span className="text-[10px] text-[var(--text-muted)] leading-normal mt-0.5">Exige que las conexiones administrativas provengan del rango de IPs permitido.</span>
              </div>
              <button 
                onClick={() => handleToggle('ip_allowlist_enforcement')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {settings.ip_allowlist_enforcement ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Category 4: Políticas de Ciberseguridad */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
            <div className="p-2 bg-primary/10 text-primary-fixed dark:text-primary rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-[var(--text-primary)] uppercase tracking-wider">Políticas de Ciberseguridad y Control Perimetral</h3>
          </div>

          <div className="space-y-4">
            
            {/* MFA Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[75%]">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Autenticación de Doble Factor (MFA)</span>
              </div>
              <button 
                onClick={() => handleToggle('cyber_mfa')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {settings.cyber_mfa ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

            {/* OTP Method */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Método de Verificación OTP</label>
              <select 
                value={settings.otp_method}
                onChange={(e) => setSettings(prev => ({...prev, otp_method: e.target.value}))}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="app">App Autenticadora (Google Authenticator / Authy)</option>
                <option value="sms">SMS / Mensaje de Texto</option>
                <option value="email">Correo Electrónico</option>
              </select>
            </div>

            {/* Expiration Date */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Fecha de Expiración del Acceso</label>
              <input 
                type="date"
                value={settings.access_expiration}
                onChange={(e) => setSettings(prev => ({...prev, access_expiration: e.target.value}))}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              />
            </div>

            {/* Schedule */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Horario Permitido de Acceso</label>
              <select 
                value={settings.access_schedule}
                onChange={(e) => setSettings(prev => ({...prev, access_schedule: e.target.value}))}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="24/7">Cualquier horario (24/7)</option>
                <option value="business">Horario Laboral (8am - 6pm)</option>
              </select>
            </div>

            {/* Allowed IPs */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Direcciones IP Permitidas</label>
              <input 
                type="text"
                value={settings.allowed_ips}
                onChange={(e) => setSettings(prev => ({...prev, allowed_ips: e.target.value}))}
                placeholder="*"
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              />
            </div>

            {/* Inactivity */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Cerrar Sesión por Inactividad (Minutos)</label>
              <select 
                value={settings.inactivity_action}
                onChange={(e) => setSettings(prev => ({...prev, inactivity_action: e.target.value}))}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="none">No aplicar</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </div>

            {/* Failed Attempts */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Bloquear Cuenta por Intentos Fallidos</label>
              <select 
                value={settings.failed_attempts_action}
                onChange={(e) => setSettings(prev => ({...prev, failed_attempts_action: e.target.value}))}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary"
              >
                <option value="block_3">Bloquear al tercer intento fallido</option>
                <option value="block_5">Bloquear al quinto intento fallido</option>
                <option value="block_10">Bloquear al décimo intento fallido</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.export_approval_sensitive}
                  onChange={(e) => setSettings(prev => ({...prev, export_approval_sensitive: e.target.checked}))}
                  className="rounded border-[var(--border-color)] text-primary focus:ring-primary"
                />
                <span className="text-[11.5px] text-[var(--text-primary)] font-medium leading-tight">Exigir aprobación para exportaciones de datos sensibles</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.dual_control_critical}
                  onChange={(e) => setSettings(prev => ({...prev, dual_control_critical: e.target.checked}))}
                  className="rounded border-[var(--border-color)] text-primary focus:ring-primary"
                />
                <span className="text-[11.5px] text-[var(--text-primary)] font-medium leading-tight">Exigir doble validación (Dual control) para cambios críticos</span>
              </label>
            </div>

          </div>
        </div>
        <div className="flex flex-col gap-6">
  {/* Category 1: Operaciones Comerciales */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm opacity-50 pointer-events-none select-none relative">
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] px-4 py-1.5 rounded-full shadow-lg font-bold text-[11px] text-[var(--text-primary)] uppercase tracking-widest backdrop-blur-md bg-opacity-80">
              Próximamente
            </div>
          </div>
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Coins size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-[var(--text-primary)] uppercase tracking-wider">Límites Comerciales</h3>
          </div>

          <div className="space-y-4">
            {/* Limit 1 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[var(--text-primary)]">Límite Diario de Caja (DOP)</label>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                Monto transaccional máximo diario permitido por terminal antes de requerir una clave de aprobación del supervisor comercial.
              </p>
              <input 
                type="number"
                value={settings.max_cash_limit_day}
                onChange={(e) => handleNumberChange('max_cash_limit_day', e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Limit 2 */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[var(--text-primary)]">Máximo de Tickets / Minuto</label>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                Umbral máximo de sorteos/tickets impresos por minuto en máquinas POS para prevenir transacciones fantasma o fraude automatizado.
              </p>
              <input 
                type="number"
                value={settings.max_tickets_per_minute}
                onChange={(e) => handleNumberChange('max_tickets_per_minute', e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Toggle 1 */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]/50">
              <div className="flex flex-col max-w-[70%]">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Validación Dual de Vendedoras</span>
                <span className="text-[10px] text-[var(--text-muted)] leading-normal mt-0.5">Exige confirmación CISO para crear cuentas móviles.</span>
              </div>
              <button 
                onClick={() => handleToggle('double_validation_vendedora')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {settings.double_validation_vendedora ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>
          </div>
        </div>

          {/* Category 2: Exportaciones y Reportes */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm opacity-50 pointer-events-none select-none relative">
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] px-4 py-1.5 rounded-full shadow-lg font-bold text-[11px] text-[var(--text-primary)] uppercase tracking-widest backdrop-blur-md bg-opacity-80">
              Próximamente
            </div>
          </div>
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <FileSpreadsheet size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-[var(--text-primary)] uppercase tracking-wider">Reportes y Descargas</h3>
          </div>

          <div className="space-y-4">
            {/* Toggle 2 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[75%]">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">Aprobación para Exportar</span>
                <span className="text-[10px] text-[var(--text-muted)] leading-normal mt-0.5">Aprobaciones secundarias obligatorias para exportar bases de usuarios o informes financieros consolidados.</span>
              </div>
              <button 
                onClick={() => handleToggle('require_export_approval')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {settings.require_export_approval ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

            {/* Limit 3 */}
            <div className="flex flex-col gap-1.5 pt-4 border-t border-[var(--border-color)]/50">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[var(--text-primary)]">Filas Máximas sin Aprobación</label>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                Monto máximo de registros/filas que un supervisor comercial puede descargar en formato CSV/Excel sin requerir aprobación del CISO.
              </p>
              <input 
                type="number"
                value={settings.max_export_rows_limit}
                onChange={(e) => handleNumberChange('max_export_rows_limit', e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-primary mt-1"
              />
            </div>
          </div>
        </div>

                </div>
        </div>
      </div>

      {/* Info Alert Box */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 mt-4 animate-in fade-in">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <h4 className="text-[12.5px] font-bold text-amber-800 dark:text-amber-300">Aviso del Oficial de Ciberseguridad (CISO)</h4>
          <p className="text-[10.5px] text-amber-700/95 dark:text-amber-400/90 leading-relaxed mt-0.5">
            Las políticas definidas en esta pantalla se aplican directamente a nivel de API Core de Suivi. Cualquier intento de violar los límites transaccionales bloqueará el proceso y enviará una notificación con geolocalización al equipo de Operaciones de Seguridad (SecOps).
          </p>
        </div>
      </div>

      {/* Confirm Save Modal */}
      {showSaveConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
          <div className="absolute inset-0 bg-black/20 transition-opacity" onClick={() => setShowSaveConfirmModal(false)}></div>
          <div className="relative bg-[var(--bg-elevated)] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-[var(--border-color)] animate-in fade-in zoom-in-95 duration-200">
             <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Save size={36} strokeWidth={2} />
             </div>
             <h3 className="text-[18px] font-bold text-[#1e293b] dark:text-white mb-2">¿Confirmar Guardado?</h3>
             <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
               ¿Desea guardar los cambios realizados en las políticas de seguridad?
             </p>
             <div className="flex gap-3">
               <button onClick={() => setShowSaveConfirmModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-sm font-bold transition-all border border-slate-200">
                 Cancelar
               </button>
               <button onClick={handleExecuteSave} disabled={saving} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                 Confirmar
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
          <div className="absolute inset-0 bg-black/20 transition-opacity" onClick={() => setShowResetConfirmModal(false)}></div>
          <div className="relative bg-[var(--bg-elevated)] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-[var(--border-color)] animate-in fade-in zoom-in-95 duration-200">
             <div className="w-16 h-16 rounded-full bg-rose-50 text-primary flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <RotateCw size={36} strokeWidth={2} />
             </div>
             <h3 className="text-[18px] font-bold text-[#1e293b] dark:text-white mb-2">Restablecer Umbrales</h3>
             <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
               ¿Estás seguro de que deseas restablecer todos los umbrales a sus valores recomendados por defecto?
             </p>
             <div className="flex gap-3">
               <button onClick={() => setShowResetConfirmModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-sm font-bold transition-all border border-slate-200">
                 Cancelar
               </button>
               <button onClick={handleExecuteReset} disabled={saving} className="flex-1 py-2.5 bg-primary text-on-primary hover:bg-primary-fixed active:bg-rose-700 text-on-primary rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                 Restablecer
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal */}
      {showSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
          <div className="absolute inset-0 bg-black/20 transition-opacity" onClick={() => setShowSuccessModal(false)}></div>
          <div className="relative bg-[var(--bg-elevated)] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-[var(--border-color)] animate-in fade-in zoom-in-95 duration-200">
             <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <CheckCircle2 size={36} strokeWidth={2.5} />
             </div>
             <h3 className="text-[18px] font-bold text-[#1e293b] dark:text-white mb-2">¡Guardado Exitosamente!</h3>
             <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
               Las reglas operativas han sido guardadas correctamente en la base de datos.
             </p>
             <button onClick={() => setShowSuccessModal(false)} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all">
               Entendido
             </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
