import React, { useState } from 'react';
import { 
  Key, ShieldAlert, ToggleLeft, ToggleRight, Save, RotateCw, 
  Info, AlertTriangle, Coins, FileSpreadsheet, Lock, Clock, Settings, ShieldCheck
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
  ip_allowlist_enforcement: false
};

export default function OperativeRulesSecurityView({ onOpenSidebar }) {
  if (typeof window !== 'undefined' && !window.transactionalPermissions) {
    window.transactionalPermissions = { ...DEFAULT_PERMISSIONS };
  }

  const [settings, setSettings] = useState(() => {
    return typeof window !== 'undefined' && window.transactionalPermissions
      ? { ...window.transactionalPermissions }
      : { ...DEFAULT_PERMISSIONS };
  });

  const [toast, setToast] = useState(null);

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

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const original = { ...window.transactionalPermissions };
      window.transactionalPermissions = { ...settings };

      // Log audit
      if (window.auditData) {
        const newLog = {
          id: `AUD-TRANS-${Date.now()}`,
          user_id: 'SYSTEM',
          action: 'Actualización Políticas Transaccionales',
          entity: 'transactional_policies',
          before_value: JSON.stringify(original),
          after_value: JSON.stringify(settings),
          performed_by: 'Admin',
          performed_at: new Date().toISOString(),
          reason: 'Modificación de límites transaccionales y aprobaciones IAM',
          ip_address: '186.6.14.99',
          result: 'Exitoso'
        };
        window.auditData = [newLog, ...window.auditData];
      }

      if (window.activitiesData) {
        const newAct = {
          id: `ACT-TRANS-${Date.now()}`,
          user_id: 'SYSTEM',
          event: 'Límites de Seguridad Modificados',
          desc: 'Se actualizaron los parámetros globales de controles transaccionales.',
          timestamp: new Date().toISOString(),
          ip: '186.6.14.99'
        };
        window.activitiesData = [newAct, ...window.activitiesData];
      }
    }
    showToast('Políticas de seguridad transaccional guardadas con éxito.');
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_PERMISSIONS });
    showToast('Políticas restablecidas a valores recomendados.');
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
            onClick={handleReset}
            className="flex-1 md:flex-initial bg-[var(--bg-elevated)] hover:bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <RotateCw size={14} className="text-[var(--text-muted)]" />
            Restablecer Umbrales
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 md:flex-initial bg-primary text-on-primary hover:bg-primary-fixed text-on-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
          >
            <Save size={14} />
            Guardar Configuración
          </button>
        </div>
      </header>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Category 1: Operaciones Comerciales */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm">
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
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5 shadow-sm">
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

    </div>
  );
}
