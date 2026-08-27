"use client";
import React, { useState, useEffect } from 'react';
import { 
  Key, ShieldAlert, ToggleLeft, ToggleRight, Save, RotateCw, 
  AlertTriangle, Coins, FileSpreadsheet, Lock, CheckCircle2
} from 'lucide-react';
import { createPortal } from 'react-dom';
import SecurityConfirmDialog from '@/components/security/SecurityConfirmDialog';

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
  cyber_mfa: false,
  otp_method: 'app',
  access_expiration: '',
  access_schedule: '24/7',
  allowed_ips: '*',
  inactivity_action: 'none',
  failed_attempts_action: 'block_5',
  export_approval_sensitive: false,
  dual_control_critical: false
};

const apiBase = '/api';

export default function PermissionsSecurityView({ onOpenSidebar = () => {} }) {
  const [settings, setSettings] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/regla-operativa-seguridad?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({
            ...prev,
            ...data
          }));
        }
      } catch (error) {
        console.error(error);
        showToast('Error al cargar la configuración.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNumberChange = (key, val) => {
    setSettings(prev => ({
      ...prev,
      [key]: parseInt(val, 10) || 0
    }));
  };

  const handleSaveClick = () => {
    setShowSaveConfirmModal(true);
  };

  const handleExecuteSave = async () => {
    setShowSaveConfirmModal(false);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/regla-operativa-seguridad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setShowSuccessModal(true);
      } else {
        showToast('Error al guardar políticas.');
      }
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirmModal(true);
  };

  const handleExecuteReset = async () => {
    setShowResetConfirmModal(false);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/regla-operativa-seguridad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_PERMISSIONS)
      });
      if (res.ok) {
        setSettings({ ...DEFAULT_PERMISSIONS });
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
    <div className="p-6 md:p-8 space-y-6 flex flex-col min-h-full animate-in fade-in duration-300 font-sans text-foreground">
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-elevated border border-primary/30 shadow-2xl p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-2.5 h-2.5 rounded-full bg-success animate-ping" />
          <span className="text-xs font-bold text-foreground">{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="md:hidden p-1.5 rounded-lg bg-surface-subtle border border-border text-foreground-muted hover:text-primary shadow-sm"
            onClick={onOpenSidebar}
            aria-label="Abrir menú"
          >
            <ToggleLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-foreground-muted bg-surface-subtle border border-border w-max px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Key size={12} className="text-primary" />
              Gobernanza y Autenticación
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1.5 flex items-center gap-2 font-sans">
              Reglas Operativas
            </h1>
            <p className="text-[13px] text-foreground-muted mt-1 font-medium font-sans">
              Gestiona límites operativos, aprobaciones de doble firma y umbrales críticos de seguridad perimetral.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button 
            type="button"
            onClick={handleResetClick}
            disabled={saving || loading}
            className={`flex-1 md:flex-initial bg-surface hover:bg-hover border border-border text-foreground font-mono font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${saving || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RotateCw size={14} className="text-foreground-muted" />
            Restablecer Umbrales
          </button>
          <button 
            type="button"
            onClick={handleSaveClick}
            disabled={saving || loading}
            className={`flex-1 md:flex-initial font-mono font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer ${
              saving || loading 
              ? 'bg-primary-button-bg text-primary-foreground cursor-not-allowed opacity-70' 
              : 'bg-primary-button-bg text-primary-foreground hover:brightness-110'
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
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/60 backdrop-blur-sm rounded-2xl">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-500 ${loading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Category 3: Seguridad Perimetral */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Lock size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-foreground uppercase tracking-wider font-mono">Políticas de Sesión y MFA</h3>
          </div>

          <div className="space-y-4">
            {/* Toggle 3 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[75%]">
                <span className="text-xs font-bold text-foreground font-sans">MFA Obligatorio Global</span>
                <span className="text-[11px] text-foreground-muted leading-normal mt-0.5 font-sans">Fuerza el uso de autenticación de doble factor para todas las cuentas con accesos administrativos.</span>
              </div>
              <button 
                type="button"
                onClick={() => handleToggle('mfa_enforcement')}
                className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
              >
                {settings.mfa_enforcement ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

            {/* Limit 4 */}
            <div className="flex flex-col gap-1.5 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground font-sans">Inactividad de Sesión (Min)</label>
              </div>
              <p className="text-[11px] text-foreground-muted leading-relaxed font-sans">
                Tiempo de espera en minutos antes de que el token JWT del usuario expire y obligue un re-login por inactividad.
              </p>
              <input 
                type="number"
                value={settings.session_inactivity_timeout}
                onChange={(e) => handleNumberChange('session_inactivity_timeout', e.target.value)}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Limit 5 */}
            <div className="flex flex-col gap-1.5 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground font-sans">Intentos Fallidos de Login</label>
              </div>
              <p className="text-[11px] text-foreground-muted leading-relaxed font-sans">
                Número de contraseñas/PINs erróneos consecutivos antes de bloquear la cuenta administrativamente.
              </p>
              <input 
                type="number"
                value={settings.max_login_failed_attempts}
                onChange={(e) => handleNumberChange('max_login_failed_attempts', e.target.value)}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary mt-1"
              />
            </div>

            {/* Toggle 4 */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex flex-col max-w-[70%]">
                <span className="text-xs font-bold text-foreground font-sans">Restricción de IPs Corporativas</span>
                <span className="text-[11px] text-foreground-muted leading-normal mt-0.5 font-sans">Exige que las conexiones administrativas provengan del rango de IPs permitido.</span>
              </div>
              <button 
                type="button"
                onClick={() => handleToggle('ip_allowlist_enforcement')}
                className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <h3 className="font-extrabold text-[13px] text-foreground uppercase tracking-wider font-mono">Control Perimetral</h3>
          </div>

          <div className="space-y-4">
            
            {/* MFA Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[75%]">
                <span className="text-xs font-bold text-foreground font-sans">Autenticación de Doble Factor (MFA)</span>
              </div>
              <button 
                type="button"
                onClick={() => handleToggle('cyber_mfa')}
                className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
              >
                {settings.cyber_mfa ? (
                  <ToggleRight size={38} className="text-primary" />
                ) : (
                  <ToggleLeft size={38} />
                )}
              </button>
            </div>

            {/* OTP Method */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Método de Verificación OTP</label>
              <select 
                value={settings.otp_method}
                onChange={(e) => setSettings(prev => ({...prev, otp_method: e.target.value}))}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-sans font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="app">App Autenticadora (Google Authenticator / Authy)</option>
                <option value="sms">SMS / Mensaje de Texto</option>
                <option value="email">Correo Electrónico</option>
              </select>
            </div>

            {/* Expiration Date */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Fecha de Expiración del Acceso</label>
              <input 
                type="date"
                value={settings.access_expiration}
                onChange={(e) => setSettings(prev => ({...prev, access_expiration: e.target.value}))}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Schedule */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Horario Permitido de Acceso</label>
              <select 
                value={settings.access_schedule}
                onChange={(e) => setSettings(prev => ({...prev, access_schedule: e.target.value}))}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-sans font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="24/7">Cualquier horario (24/7)</option>
                <option value="business">Horario Laboral (8am - 6pm)</option>
              </select>
            </div>

            {/* Allowed IPs */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Direcciones IP Permitidas</label>
              <input 
                type="text"
                value={settings.allowed_ips}
                onChange={(e) => setSettings(prev => ({...prev, allowed_ips: e.target.value}))}
                placeholder="*"
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Inactivity */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Cerrar Sesión por Inactividad (Minutos)</label>
              <select 
                value={settings.inactivity_action}
                onChange={(e) => setSettings(prev => ({...prev, inactivity_action: e.target.value}))}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-sans font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="none">No aplicar</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </div>

            {/* Failed Attempts */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <label className="text-[11px] font-mono font-bold text-foreground-muted uppercase">Bloquear Cuenta por Intentos Fallidos</label>
              <select 
                value={settings.failed_attempts_action}
                onChange={(e) => setSettings(prev => ({...prev, failed_attempts_action: e.target.value}))}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-sans font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="block_3">Bloquear al tercer intento fallido</option>
                <option value="block_5">Bloquear al quinto intento fallido</option>
                <option value="block_10">Bloquear al décimo intento fallido</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.export_approval_sensitive}
                  onChange={(e) => setSettings(prev => ({...prev, export_approval_sensitive: e.target.checked}))}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer w-4 h-4"
                />
                <span className="text-xs text-foreground font-medium leading-tight font-sans">Exigir aprobación para exportaciones de datos sensibles</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={settings.dual_control_critical}
                  onChange={(e) => setSettings(prev => ({...prev, dual_control_critical: e.target.checked}))}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer w-4 h-4"
                />
                <span className="text-xs text-foreground font-medium leading-tight font-sans">Exigir doble validación (Dual control) para cambios críticos</span>
              </label>
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Category 1: Operaciones Comerciales */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm opacity-60 pointer-events-none select-none relative">
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
              <div className="bg-surface-elevated border border-border px-4 py-1.5 rounded-full shadow-lg font-mono font-bold text-[11px] text-foreground uppercase tracking-widest backdrop-blur-md">
                Próximamente
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-info/15 text-info rounded-lg">
                <Coins size={18} />
              </div>
              <h3 className="font-extrabold text-[13px] text-foreground uppercase tracking-wider font-mono">Límites Comerciales</h3>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Límite Diario de Caja (DOP)</label>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Monto transaccional máximo diario permitido por terminal antes de requerir una clave de aprobación.
                </p>
                <input 
                  type="number"
                  value={settings.max_cash_limit_day}
                  onChange={(e) => handleNumberChange('max_cash_limit_day', e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary mt-1"
                />
              </div>

              <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Máximo de Tickets / Minuto</label>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Umbral máximo de tickets impresos por minuto en máquinas POS para prevenir transacciones fantasma.
                </p>
                <input 
                  type="number"
                  value={settings.max_tickets_per_minute}
                  onChange={(e) => handleNumberChange('max_tickets_per_minute', e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary mt-1"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex flex-col max-w-[70%]">
                  <span className="text-xs font-bold text-foreground">Validación Dual de Vendedoras</span>
                  <span className="text-[11px] text-foreground-muted leading-normal mt-0.5">Exige confirmación CISO para crear cuentas móviles.</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleToggle('double_validation_vendedora')}
                  className="text-foreground-muted hover:text-primary"
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
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm opacity-60 pointer-events-none select-none relative">
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
              <div className="bg-surface-elevated border border-border px-4 py-1.5 rounded-full shadow-lg font-mono font-bold text-[11px] text-foreground uppercase tracking-widest backdrop-blur-md">
                Próximamente
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-success/15 text-success rounded-lg">
                <FileSpreadsheet size={18} />
              </div>
              <h3 className="font-extrabold text-[13px] text-foreground uppercase tracking-wider font-mono">Reportes y Descargas</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col max-w-[75%]">
                  <span className="text-xs font-bold text-foreground">Aprobación para Exportar</span>
                  <span className="text-[11px] text-foreground-muted leading-normal mt-0.5">Aprobaciones secundarias obligatorias para exportar bases de usuarios.</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleToggle('require_export_approval')}
                  className="text-foreground-muted hover:text-primary"
                >
                  {settings.require_export_approval ? (
                    <ToggleRight size={38} className="text-primary" />
                  ) : (
                    <ToggleLeft size={38} />
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-1.5 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Filas Máximas sin Aprobación</label>
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Monto máximo de registros/filas descargables en formato CSV/Excel sin requerir aprobación.
                </p>
                <input 
                  type="number"
                  value={settings.max_export_rows_limit}
                  onChange={(e) => handleNumberChange('max_export_rows_limit', e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-primary mt-1"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
      </div>

      {/* Info Alert Box */}
      <div className="p-4 bg-warning/10 border border-warning/30 rounded-2xl flex items-start gap-3 mt-4 animate-in fade-in">
        <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-foreground font-sans">Aviso del Oficial de Ciberseguridad (CISO)</h4>
          <p className="text-[11px] text-foreground-secondary leading-relaxed mt-0.5 font-sans">
            Las políticas definidas en esta pantalla se aplican directamente a nivel de API Core de Suivi. Cualquier intento de violar los límites transaccionales bloqueará el proceso y registrará el evento en la bitácora de auditoría.
          </p>
        </div>
      </div>

      {/* Confirm Save Modal */}
      <SecurityConfirmDialog
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={handleExecuteSave}
        variant="default"
        title="¿Confirmar Guardado?"
        description="¿Desea guardar los cambios realizados en las políticas de seguridad operativa?"
        confirmLabel="Confirmar"
      />

      {/* Reset Confirm Modal */}
      <SecurityConfirmDialog
        isOpen={showResetConfirmModal}
        onClose={() => setShowResetConfirmModal(false)}
        onConfirm={handleExecuteReset}
        variant="warning"
        title="Restablecer Umbrales"
        description="¿Estás seguro de que deseas restablecer todos los umbrales a sus valores recomendados por defecto?"
        confirmLabel="Restablecer"
      />

      {/* Success Modal */}
      {showSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-elevated border border-border rounded-3xl shadow-xl w-[400px] overflow-hidden p-8 text-center text-foreground">
            <div className="w-16 h-16 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 font-sans">¡Guardado Exitosamente!</h3>
            <p className="text-xs text-foreground-secondary mb-6 leading-relaxed font-sans">
              Las reglas operativas han sido guardadas correctamente en la base de datos.
            </p>
            <button 
              type="button"
              onClick={() => setShowSuccessModal(false)} 
              className="w-full py-2.5 bg-primary-button-bg text-primary-foreground font-mono font-bold rounded-xl text-xs shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
