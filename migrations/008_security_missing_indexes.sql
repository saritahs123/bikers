-- =============================================================================
-- MIGRACIÓN DE SEGURIDAD: ÍNDICES DE RENDIMIENTO Y AUTENTICACIÓN
-- Archivo: migrations/008_security_missing_indexes.sql
-- Finalidad: Optimizar búsquedas case-insensitive de usuario y validación de tokens de sesión activos.
-- =============================================================================

-- 1. Índice funcional para acelerar la búsqueda y login de usuarios por correo electrónico normalizado en minúsculas
CREATE INDEX IF NOT EXISTS idx_usuario_identidad_correo_lower
ON admin.usuario_identidad (LOWER(correo_electronico));

-- 2. Índice compuesto para acelerar la validación y verificación de estado de sesiones por token
CREATE INDEX IF NOT EXISTS idx_usuario_sesion_token_estado
ON admin.usuario_sesion (token_identificador, estado);
