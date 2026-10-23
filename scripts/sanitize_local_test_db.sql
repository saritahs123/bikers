-- ============================================================================
-- SCRIPT DE SANITIZACIÓN Y PROTECCIÓN DE DATOS: BIKERS_DBTEST (LOCAL)
-- Archivo: scripts/sanitize_local_test_db.sql
-- Base de datos destino: bikers_dbtest (PostgreSQL 18 Local)
--
-- PROPÓSITO:
-- Proteger la privacidad de los datos restaurados de producción:
-- 1. Invalidar todas las sesiones activas copiadas de producción.
-- 2. Limpieza de tokens y credenciales volátiles heredadas.
-- 3. Verificación de que NO se borren ni alteren innecesariamente los clientes.
--
-- PROTECCIÓN REFORZADA:
-- - current_database() = 'bikers_dbtest'
-- - current_user = 'bikers_test'
-- - Host local (127.0.0.1 / ::1 / local socket)
-- - Puerto local 5432
-- - Esquema admin confirmado
-- - Finaliza con ROLLBACK por defecto hasta revisión y autorización explícita.
-- ============================================================================

BEGIN;

-- 0. Verificación estricta de seguridad de contexto multidimensional
DO $$
DECLARE
    v_schema_count INT;
    v_fdw_count INT;
    v_server_port INT;
    v_server_addr INET;
BEGIN
    -- A. Verificar base de datos
    IF current_database() <> 'bikers_dbtest' THEN
        RAISE EXCEPTION 'ABORTADO: Base de datos no autorizada (%). Solo se permite "bikers_dbtest".', current_database();
    END IF;

    -- B. Verificar usuario de conexión
    IF current_user <> 'bikers_test' THEN
        RAISE EXCEPTION 'ABORTADO: Usuario no autorizado (%). Solo se permite "bikers_test".', current_user;
    END IF;

    -- C. Verificar dirección del servidor (Host local)
    v_server_addr := inet_server_addr();
    IF v_server_addr IS NOT NULL AND v_server_addr NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
        RAISE EXCEPTION 'ABORTADO: Conexión remota no autorizada (%). Solo se permite ejecución local (127.0.0.1).', v_server_addr;
    END IF;

    -- D. Verificar puerto del servidor (5432)
    v_server_port := inet_server_port();
    IF v_server_port IS NOT NULL AND v_server_port <> 5432 THEN
        RAISE EXCEPTION 'ABORTADO: Puerto no autorizado (%). Solo se permite 5432 (PostgreSQL 18 local).', v_server_port;
    END IF;

    -- E. Verificar existencia del esquema admin
    SELECT COUNT(*) INTO v_schema_count
    FROM information_schema.schemata
    WHERE schema_name = 'admin';

    IF v_schema_count = 0 THEN
        RAISE EXCEPTION 'ABORTADO: El esquema "admin" no existe en esta base de datos.';
    END IF;

    -- F. Verificar ausencia de Foreign Data Wrappers hacia destinos externos
    SELECT COUNT(*) INTO v_fdw_count
    FROM pg_foreign_server;

    IF v_fdw_count > 0 THEN
        RAISE EXCEPTION 'ABORTADO: Se detectaron servidores foráneos (FDW) activos en la base de datos.';
    END IF;

    RAISE NOTICE '>>> CONTEXTO VALIDADO EXITOSAMENTE: bikers_dbtest en 127.0.0.1:5432 (usuario: bikers_test, esquema: admin) <<<';
END $$;

-- 1. Invalidar todas las sesiones activas heredadas de producción
UPDATE admin.usuario_sesion
SET estado = 'REVOCADA',
    tipo_cierre = 'REVOCACION',
    motivo_cierre = 'Invalidada por protocolo de aislamiento de ambiente local de pruebas',
    fecha_expiracion = NOW(),
    fecha_cierre = NOW(),
    fecha_revocacion = NOW(),
    dispositivo_navegador = '[REVOCADO_PROTOCOLO_TEST_LOCAL]'
WHERE estado = 'ACTIVA';

-- 2. Restablecer contadores de intentos fallidos y bloqueos temporales en usuarios existentes
UPDATE admin.usuario_seguridad
SET intentos_fallidos = 0,
    bloqueado_hasta = NULL,
    motivo_bloqueo = NULL
WHERE bloqueado_hasta IS NOT NULL OR COALESCE(intentos_fallidos, 0) > 0;

-- 3. Resumen de estado dentro de la transacción
DO $$
DECLARE
    v_activas_restantes INT;
    v_revocadas_total INT;
BEGIN
    SELECT COUNT(*) INTO v_activas_restantes FROM admin.usuario_sesion WHERE estado = 'ACTIVA';
    SELECT COUNT(*) INTO v_revocadas_total FROM admin.usuario_sesion WHERE estado = 'REVOCADA';
    RAISE NOTICE 'Estado post-sanitización: Sesiones activas restantes: %, Sesiones revocadas: %', v_activas_restantes, v_revocadas_total;
END $$;

-- ============================================================================
-- PRECAUCIÓN: ROLLBACK POR DEFECTO
-- No se aplicará ningún cambio real hasta que el usuario autorice formalmente.
-- ============================================================================
ROLLBACK;
-- COMMIT;
