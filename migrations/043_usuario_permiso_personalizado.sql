-- ====================================================================
-- Migración 043: Tabla de Permisos Personalizados por Usuario
-- Fecha: 21 de Octubre de 2026
-- Objetivo: Soportar excepciones de privilegios a nivel de usuario individual
--           (Precedencia: SuperAdmin > Permiso Personalizado > Pantalla > Menú)
-- ====================================================================

CREATE TABLE IF NOT EXISTS admin.usuario_permiso_personalizado (
  usuario_permiso_id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES admin.usuario(usuario_id) ON DELETE CASCADE,
  modulo_sistema_id INTEGER REFERENCES admin.modulo_sistema(modulo_sistema_id) ON DELETE CASCADE,
  pantalla_id INTEGER REFERENCES admin.pantalla_sistema(pantalla_id) ON DELETE CASCADE,
  puede_ver BOOLEAN NULL,
  puede_crear BOOLEAN NULL,
  puede_editar BOOLEAN NULL,
  puede_inactivar BOOLEAN NULL,
  puede_exportar BOOLEAN NULL,
  puede_importar BOOLEAN NULL,
  puede_aprobar BOOLEAN NULL,
  puede_asignar BOOLEAN NULL,
  puede_mover BOOLEAN NULL,
  puede_cerrar BOOLEAN NULL,
  puede_reabrir BOOLEAN NULL,
  puede_eliminar BOOLEAN NULL,
  estado VARCHAR(20) DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMPTZ DEFAULT clock_timestamp(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Índice único compuesto para evitar duplicados por usuario + módulo + pantalla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_usuario_permiso_mod_pant'
  ) THEN
    ALTER TABLE admin.usuario_permiso_personalizado
      ADD CONSTRAINT uq_usuario_permiso_mod_pant UNIQUE NULLS NOT DISTINCT (usuario_id, modulo_sistema_id, pantalla_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuario_permiso_usr ON admin.usuario_permiso_personalizado(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_permiso_pant ON admin.usuario_permiso_personalizado(pantalla_id);
CREATE INDEX IF NOT EXISTS idx_usuario_permiso_mod ON admin.usuario_permiso_personalizado(modulo_sistema_id);
