-- =====================================================================
-- MIGRACIÓN 049: REUBICAR NIVELES DE CLIENTES EN CONFIGURACIONES Y SINCRONIZAR RBAC
-- Ambientes: test (PostgreSQL 18.6 local) / prod (AWS RDS PostgreSQL)
-- Descripción:
--   1. Retira la pantalla de CRM inactivando 'CRM_NIVELES_CLIENTES' (pantalla_id: 11)
--      en admin.pantalla_sistema (activo = false).
--   2. Garantiza que 'CONFIG_NIVELES_CLIENTES' (pantalla_id: 33) sea la única pantalla
--      activa para la ruta '/crm/client-levels', bajo el módulo 'CONFIGURACIÓN'.
--   3. Sincroniza la matriz RBAC en admin.matriz_acceso_pantalla para 'CONFIG_NIVELES_CLIENTES',
--      preservando estrictamente los derechos de acceso legítimos de los roles autorizados
--      (Roles 1, 2, 3, 6, 7) sin conceder privilegios adicionales a roles no autorizados
--      (Roles 4, 5, 8, 9, etc.).
-- Idempotencia: ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE.
-- Transaccional: Ejecución atómica en un único bloque BEGIN ... COMMIT.
-- =====================================================================

BEGIN;

-- 1. Verificación previa de esquemas y tablas requeridas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'admin' AND table_name = 'pantalla_sistema') THEN
    RAISE EXCEPTION 'Tabla admin.pantalla_sistema no existe.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'admin' AND table_name = 'matriz_acceso_pantalla') THEN
    RAISE EXCEPTION 'Tabla admin.matriz_acceso_pantalla no existe.';
  END IF;
END $$;

-- 2. Inactivar la pantalla duplicada anterior en CRM (pantalla_id = 11 / CRM_NIVELES_CLIENTES)
UPDATE admin.pantalla_sistema
SET activo = false,
    fecha_actualizacion = clock_timestamp()
WHERE codigo = 'CRM_NIVELES_CLIENTES';

-- 3. Asegurar que CONFIG_NIVELES_CLIENTES está activa y asociada al módulo CONFIGURACIÓN
DO $$
DECLARE
  v_mod_config_id INTEGER;
  v_pantalla_config_id INTEGER;
BEGIN
  SELECT modulo_sistema_id INTO v_mod_config_id
  FROM admin.modulo_sistema
  WHERE UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'CONFIGURACION'
     OR UPPER(codigo) = 'CONFIGURACION'
  ORDER BY modulo_sistema_id ASC
  LIMIT 1;

  IF v_mod_config_id IS NULL THEN
    RAISE EXCEPTION 'Módulo CONFIGURACIÓN no encontrado en admin.modulo_sistema.';
  END IF;

  -- Actualizar pantalla existente o insertar si no existiera
  IF EXISTS (SELECT 1 FROM admin.pantalla_sistema WHERE codigo = 'CONFIG_NIVELES_CLIENTES') THEN
    UPDATE admin.pantalla_sistema
    SET modulo_sistema_id = v_mod_config_id,
        nombre = 'Niveles de Clientes',
        ruta = '/crm/client-levels',
        tipo = 'PANTALLA',
        orden = 10,
        activo = true,
        fecha_actualizacion = clock_timestamp()
    WHERE codigo = 'CONFIG_NIVELES_CLIENTES'
    RETURNING pantalla_id INTO v_pantalla_config_id;
  ELSE
    SELECT COALESCE(MAX(pantalla_id), 0) + 1 INTO v_pantalla_config_id FROM admin.pantalla_sistema;
    INSERT INTO admin.pantalla_sistema (
      pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo, fecha_creacion, fecha_actualizacion
    ) VALUES (
      v_pantalla_config_id, v_mod_config_id, 'CONFIG_NIVELES_CLIENTES', 'Niveles de Clientes', '/crm/client-levels', 'PANTALLA', 10, true, clock_timestamp(), clock_timestamp()
    );
  END IF;

  -- 4. Sincronizar permisos granulares en admin.matriz_acceso_pantalla para CONFIG_NIVELES_CLIENTES
  -- Rol 1: Administrador General (SuperAdmin institucional)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    1, v_pantalla_config_id, true, true, true, true,
    true, true, true, true, true, true,
    true, true, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 2: Administrador de Empresa
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    2, v_pantalla_config_id, true, true, true, false,
    true, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 3: Supervisor Comercial (restaurar privilegios de gestión de niveles)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    3, v_pantalla_config_id, true, true, true, false,
    true, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 4: Supervisor de Ruta (sin acceso)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    4, v_pantalla_config_id, false, false, false, false,
    false, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 5: Operador (sin acceso)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    5, v_pantalla_config_id, false, false, false, false,
    false, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 6: Auditor (acceso de consulta y exportación)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    6, v_pantalla_config_id, true, false, false, false,
    true, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 7: Analista Comercial (preservar acceso legítimo de consulta y exportación)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    7, v_pantalla_config_id, true, false, false, false,
    true, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 8: Consulta Ejecutiva (sin acceso)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    8, v_pantalla_config_id, false, false, false, false,
    false, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Rol 9: Soporte Técnico (revocar acceso previo para cumplir directriz de no otorgar privilegios adicionales)
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  ) VALUES (
    9, v_pantalla_config_id, false, false, false, false,
    false, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
    puede_ver = EXCLUDED.puede_ver, puede_crear = EXCLUDED.puede_crear, puede_editar = EXCLUDED.puede_editar,
    puede_inactivar = EXCLUDED.puede_inactivar, puede_exportar = EXCLUDED.puede_exportar,
    puede_importar = EXCLUDED.puede_importar, puede_aprobar = EXCLUDED.puede_aprobar,
    puede_asignar = EXCLUDED.puede_asignar, puede_mover = EXCLUDED.puede_mover,
    puede_cerrar = EXCLUDED.puede_cerrar, puede_reabrir = EXCLUDED.puede_reabrir,
    puede_eliminar = EXCLUDED.puede_eliminar, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp();

  -- Fail-closed: Asegurar que cualquier otro rol funcional activo tenga fila explícita en false
  INSERT INTO admin.matriz_acceso_pantalla (
    rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
    puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
    puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
  )
  SELECT 
    rf.rol_funcional_id,
    v_pantalla_config_id,
    false, false, false, false,
    false, false, false, false, false, false,
    false, false, 'ACTIVO', clock_timestamp(), clock_timestamp()
  FROM admin.rol_funcional rf
  WHERE rf.rol_funcional_id NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9)
    AND (rf.estado = 'ACTIVO' OR rf.estado IS NULL)
  ON CONFLICT (rol_funcional_id, pantalla_id) DO NOTHING;

END $$;

COMMIT;
