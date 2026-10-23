-- ============================================================================
-- MIGRATION: 047_usuario_rol_adicional_sequence_and_constraints.sql
-- MODULE: Seguridad (Secuencia de Roles Adicionales y Consistencia de Matriz RBAC)
-- DESCRIPTION:
--   1. Bloquea de forma transaccional admin.usuario_rol_adicional para prevenir inserciones concurrentes.
--   2. Crea la secuencia admin.usuario_rol_adicional_usuario_rol_adicional_id_seq de manera idempotente.
--   3. Asocia la secuencia como OWNED BY a la columna correspondiente.
--   4. Configura DEFAULT nextval(...) en la columna usuario_rol_adicional_id.
--   5. Sincroniza el cursor de la secuencia con el ID maximo existente mediante setval().
--   6. Valida la existencia de la restriccion UNIQUE (usuario_id, rol_funcional_id) sin duplicarla.
--   7. Bloquea de forma transaccional admin.matriz_acceso_rol y valida ausencia de duplicados.
--   8. Crea la restriccion uq_matriz_acceso_rol UNIQUE (rol_funcional_id, modulo_sistema_id) de forma idempotente.
-- IDEMPOTENT: Si
-- ============================================================================

-- 1. Bloqueo para evitar inserciones concurrentes durante la inicializacion de la secuencia
LOCK TABLE admin.usuario_rol_adicional IN SHARE ROW EXCLUSIVE MODE;

-- 2. Crear secuencia para la clave primaria de usuario_rol_adicional
CREATE SEQUENCE IF NOT EXISTS admin.usuario_rol_adicional_usuario_rol_adicional_id_seq;

-- 3. Asociar pertenencia de la secuencia a la tabla y columna correspondiente
ALTER SEQUENCE admin.usuario_rol_adicional_usuario_rol_adicional_id_seq
    OWNED BY admin.usuario_rol_adicional.usuario_rol_adicional_id;

-- 4. Asignar nextval como valor predeterminado de la columna para inserciones automaticas
ALTER TABLE admin.usuario_rol_adicional
    ALTER COLUMN usuario_rol_adicional_id
    SET DEFAULT nextval('admin.usuario_rol_adicional_usuario_rol_adicional_id_seq');

-- 5. Sincronizar el cursor de la secuencia con el ID maximo existente
SELECT setval(
    'admin.usuario_rol_adicional_usuario_rol_adicional_id_seq',
    COALESCE((SELECT MAX(usuario_rol_adicional_id) FROM admin.usuario_rol_adicional), 1),
    (SELECT MAX(usuario_rol_adicional_id) FROM admin.usuario_rol_adicional) IS NOT NULL
);

-- 6. Verificar y asegurar que la restriccion UNIQUE de usuario_rol_adicional existe exactamente sin duplicarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'admin.usuario_rol_adicional'::regclass
          AND contype = 'u'
          AND (
            pg_get_constraintdef(oid) = 'UNIQUE (usuario_id, rol_funcional_id)'
            OR conname = 'uk_usuario_rol_adicional_rol_funcional'
          )
    ) THEN
        ALTER TABLE admin.usuario_rol_adicional
            ADD CONSTRAINT uk_usuario_rol_adicional_rol_funcional UNIQUE (usuario_id, rol_funcional_id);
    END IF;
END $$;

-- 7. Bloqueo transaccional de admin.matriz_acceso_rol
LOCK TABLE admin.matriz_acceso_rol IN SHARE ROW EXCLUSIVE MODE;

-- 8. Validar ausencia de duplicados y agregar restriccion UNIQUE en admin.matriz_acceso_rol de forma idempotente
DO $$
DECLARE
    v_dup_count integer;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT rol_funcional_id, modulo_sistema_id
        FROM admin.matriz_acceso_rol
        GROUP BY rol_funcional_id, modulo_sistema_id
        HAVING count(*) > 1
    ) sub;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'No se puede agregar la restriccion UNIQUE en matriz_acceso_rol: existen % pares duplicados', v_dup_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'admin.matriz_acceso_rol'::regclass
          AND contype = 'u'
          AND (
            pg_get_constraintdef(oid) = 'UNIQUE (rol_funcional_id, modulo_sistema_id)'
            OR conname = 'uq_matriz_acceso_rol'
          )
    ) THEN
        ALTER TABLE admin.matriz_acceso_rol
            ADD CONSTRAINT uq_matriz_acceso_rol UNIQUE (rol_funcional_id, modulo_sistema_id);
    END IF;
END $$;
