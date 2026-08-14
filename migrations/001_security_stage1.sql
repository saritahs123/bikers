-- =============================================================================
-- MIGRACIÓN DE SEGURIDAD ETAPA 1: ÍNDICES Y RESTRICCIONES DE AUTENTICACIÓN
-- Archivo: migrations/001_security_stage1.sql
-- NOTA: Archivo de migración versionado. NO EJECUTAR SIN AUTORIZACIÓN.
-- =============================================================================

BEGIN;

-- 1. Índice para acelerar la búsqueda de usuarios por correo electrónico normalizado
CREATE INDEX IF NOT EXISTS idx_usuario_identidad_correo_lower 
ON admin.usuario_identidad (LOWER(correo_electronico));

-- 2. Índice para consultas rápidas de sesiones por token e identificador
CREATE INDEX IF NOT EXISTS idx_usuario_sesion_token_estado 
ON admin.usuario_sesion (token_identificador, estado);

-- 3. Índice para acelerar la verificación de estado de usuario y credenciales
CREATE INDEX IF NOT EXISTS idx_usuario_seguridad_usuario_id 
ON admin.usuario_seguridad (usuario_id);

-- 4. Comentario documental sobre columnas de control de bloqueo e intentos fallidos
COMMENT ON COLUMN admin.usuario_seguridad.intentos_fallidos IS 'Contador acumulativo de intentos fallidos de inicio de sesión consecutivos.';
COMMENT ON COLUMN admin.usuario_seguridad.bloqueado_hasta IS 'Fecha y hora hasta la cual la cuenta se encuentra bloqueada por exceso de intentos fallidos.';
COMMENT ON COLUMN admin.usuario_seguridad.motivo_bloqueo IS 'Razón detallada del bloqueo de la cuenta de usuario.';

COMMIT;
