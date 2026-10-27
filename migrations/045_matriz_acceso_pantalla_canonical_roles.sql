-- =====================================================================
-- MIGRACIÓN 045: MATRIZ DE ACCESO A PANTALLAS PARA ROLES CANÓNICOS (2 AL 9)
-- Ambientes: test (PostgreSQL 18.6 local) / prod (AWS RDS PostgreSQL)
-- Descripción: Establece la política de control de acceso granular a nivel de
--              pantalla (admin.matriz_acceso_pantalla) para los roles canónicos
--              del sistema (2 al 9), resolviendo definitivamente GAP-03.
-- Idempotencia: Utiliza ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE.
-- Transaccional: Ejecución atómica en un único bloque de transacción.
-- =====================================================================

BEGIN;

-- 1. Verificación previa de existencia de esquema y tablas requeridas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'admin' AND table_name = 'matriz_acceso_pantalla') THEN
    RAISE EXCEPTION 'Tabla admin.matriz_acceso_pantalla no existe en la base de datos.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'admin' AND table_name = 'pantalla_sistema') THEN
    RAISE EXCEPTION 'Tabla admin.pantalla_sistema no existe en la base de datos.';
  END IF;
END $$;

-- 2. Inserción o actualización granular por rol y pantalla

-- ---------------------------------------------------------------------
-- ROL 2: Administrador de Empresa (Gestión administrativa y comercial a nivel empresa)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 1, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 2, true, true, true,
  true, true, true, true,
  true, true, true, true, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 3, true, true, true,
  true, true, true, true,
  true, true, true, true, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 4, true, true, true,
  true, true, true, true,
  true, true, true, true, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 5, true, true, true,
  false, true, false, true,
  false, false, true, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 6, true, true, true,
  false, true, false, true,
  false, false, true, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 7, true, true, true,
  false, true, false, true,
  false, false, true, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 8, true, true, true,
  false, true, false, true,
  false, false, true, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 9, true, true, true,
  false, true, false, false,
  true, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 10, true, true, true,
  false, true, false, false,
  true, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 11, true, true, true,
  false, true, false, false,
  true, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 12, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 13, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 14, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 15, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 16, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 17, true, true, true,
  false, true, false, true,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 18, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 19, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 20, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 21, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 22, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 23, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 24, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 25, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 26, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 27, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 28, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 29, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 30, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 31, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 32, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 33, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 34, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 35, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 36, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 37, true, true, true,
  true, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 38, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  2, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 3: Supervisor Comercial (Supervisión de operaciones de ventas y agencias)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 1, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 2, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 3, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 4, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 5, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 6, true, false, false,
  false, true, false, true,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 7, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 8, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 9, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 10, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 11, true, true, true,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 12, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 13, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 14, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 15, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 16, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 17, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 18, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 19, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 20, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 21, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 22, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 23, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 24, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 25, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 26, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 27, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 28, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 29, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 30, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 31, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 32, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 33, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 34, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 35, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 36, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  3, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 4: Supervisor de Ruta (Control logístico y supervisión de rutas operativas)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 1, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 2, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 3, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 4, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 5, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 6, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 7, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 8, true, false, true,
  false, true, false, false,
  false, false, true, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 9, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 10, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 11, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 12, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 13, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 14, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 15, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 16, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 17, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 18, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 19, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 20, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 21, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 22, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 23, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 24, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 25, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 26, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 27, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 28, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 29, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 30, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 31, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 32, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 33, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 34, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 35, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 36, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  4, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 5: Operador (Operaciones diarias y tareas transaccionales base)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 1, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 2, true, true, true,
  false, false, false, false,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 3, true, true, true,
  false, false, false, false,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 4, true, true, true,
  false, false, false, false,
  false, true, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 5, true, true, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 6, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 7, true, true, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 8, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 9, true, true, true,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 10, true, true, true,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 11, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 12, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 13, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 14, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 15, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 16, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 17, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 18, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 19, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 20, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 21, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 22, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 23, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 24, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 25, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 26, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 27, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 28, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 29, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 30, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 31, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 32, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 33, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 34, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 35, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 36, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  5, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 6: Auditor (Rol de sólo lectura para revisión, auditoría y trazabilidad)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 1, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 2, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 3, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 4, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 5, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 6, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 7, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 8, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 9, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 10, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 11, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 12, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 13, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 14, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 15, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 16, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 17, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 18, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 19, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 20, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 21, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 22, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 23, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 24, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 25, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 26, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 27, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 28, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 29, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 30, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 31, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 32, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 33, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 34, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 35, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 36, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 37, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 38, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  6, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 7: Analista Comercial (Análisis de datos, reportes comerciales y BI)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 1, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 2, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 3, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 4, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 5, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 6, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 7, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 8, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 9, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 10, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 11, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 12, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 13, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 14, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 15, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 16, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 17, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 18, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 19, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 20, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 21, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 22, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 23, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 24, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 25, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 26, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 27, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 28, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 29, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 30, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 31, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 32, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 33, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 34, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 35, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 36, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  7, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 8: Consulta Ejecutiva (Visualización de reportes de alto nivel (Gerencia))
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 1, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 2, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 3, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 4, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 5, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 6, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 7, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 8, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 9, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 10, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 11, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 12, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 13, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 14, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 15, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 16, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 17, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 18, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 19, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 20, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 21, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 22, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 23, true, false, false,
  false, true, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 24, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 25, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 26, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 27, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 28, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 29, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 30, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 31, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 32, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 33, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 34, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 35, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 36, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  8, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- ---------------------------------------------------------------------
-- ROL 9: Soporte Técnico (Soporte, mantenimiento de terminales y configuraciones técnicas)
-- ---------------------------------------------------------------------
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 1, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 2, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 3, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 4, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 5, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 6, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 7, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 8, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 9, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 10, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 11, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 12, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 13, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 14, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 15, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 16, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 17, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 18, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 19, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 20, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 21, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 22, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 23, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 24, true, false, true,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 25, true, false, true,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 26, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 27, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 28, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 29, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 30, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 31, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 32, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 33, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 34, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 35, true, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 36, true, false, true,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 37, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 38, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 39, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 40, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();
INSERT INTO admin.matriz_acceso_pantalla (
  rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
  puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
  puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
  estado, fecha_creacion, fecha_actualizacion
) VALUES (
  9, 41, false, false, false,
  false, false, false, false,
  false, false, false, false, false,
  'ACTIVO', clock_timestamp(), clock_timestamp()
)
ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
  puede_ver = EXCLUDED.puede_ver,
  puede_crear = EXCLUDED.puede_crear,
  puede_editar = EXCLUDED.puede_editar,
  puede_inactivar = EXCLUDED.puede_inactivar,
  puede_exportar = EXCLUDED.puede_exportar,
  puede_importar = EXCLUDED.puede_importar,
  puede_aprobar = EXCLUDED.puede_aprobar,
  puede_asignar = EXCLUDED.puede_asignar,
  puede_mover = EXCLUDED.puede_mover,
  puede_cerrar = EXCLUDED.puede_cerrar,
  puede_reabrir = EXCLUDED.puede_reabrir,
  puede_eliminar = EXCLUDED.puede_eliminar,
  estado = 'ACTIVO',
  fecha_actualizacion = clock_timestamp();

-- 3. Verificación posterior: Comprobar que los roles 2 al 9 tienen 41 pantallas registradas
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM admin.matriz_acceso_pantalla
  WHERE rol_funcional_id BETWEEN 2 AND 9;

  IF v_count < (8 * 41) THEN
    RAISE EXCEPTION 'Verificación fallida: Se esperaban % registros en matriz_acceso_pantalla para roles 2-9, pero se encontraron %.', (8 * 41), v_count;
  END IF;

  RAISE NOTICE 'Migración 045 completada exitosamente. Total registros verificados: %', v_count;
END $$;

COMMIT;
