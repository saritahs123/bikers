-- ============================================================================
-- SCRIPT: cleanup_phase6_synthetic_records.sql
-- PROYECTO: Ride Lab — Bikers' Fort Core
-- RAMA: feature/segurid-crm-taller-ajustes-validaciones
-- OBJETIVO: Limpieza transaccional controlada de usuarios y roles sintéticos
--           generados durante la Fase 6 (IDs Usuarios 227–233, Roles 112–118).
--
-- REGLAS DE SEGURIDAD ESTRICTAS:
-- 1. NO EJECUTAR EN CALIENTE SOBRE PRODUCCIÓN SIN VENTANA APROBADA.
-- 2. El script contiene ROLLBACK por defecto para validar de forma seca.
-- 3. Requiere validar mediante SELECT previo que ningún registro corresponda
--    a usuarios o roles legítimos de la empresa.
-- ============================================================================

-- ============================================================================
-- PARTE 1: CONSULTAS DE PREVALIDACIÓN (SELECT ONLY)
-- Ejecutar estas consultas antes de cualquier operación para confirmar identidad.
-- ============================================================================

-- 1.1. Confirmar que los usuarios 227–233 son 100% sintéticos y corresponden al patrón 'test_p6_%'
SELECT 
    u.usuario_id,
    u.empresa_id,
    u.estado,
    i.nombre,
    i.correo_electronico,
    s.identificador_principal,
    s.metodo_acceso_principal
FROM admin.usuario u
LEFT JOIN admin.usuario_identidad i ON u.usuario_id = i.usuario_id
LEFT JOIN admin.usuario_seguridad s ON u.usuario_id = s.usuario_id
WHERE u.usuario_id BETWEEN 227 AND 233
ORDER BY u.usuario_id;

-- 1.2. Validar que NO EXISTEN usuarios reales o con correos corporativos reales en ese rango
-- (Esta consulta DEBE retornar 0 filas)
SELECT 
    u.usuario_id,
    i.correo_electronico,
    s.identificador_principal
FROM admin.usuario u
LEFT JOIN admin.usuario_identidad i ON u.usuario_id = i.usuario_id
LEFT JOIN admin.usuario_seguridad s ON u.usuario_id = s.usuario_id
WHERE u.usuario_id BETWEEN 227 AND 233
  AND (
    s.identificador_principal NOT LIKE 'test_p6_%'
    OR i.correo_electronico NOT LIKE '%@ridelab.test'
  );

-- 1.3. Confirmar que los roles 112–118 son 100% sintéticos y corresponden al patrón 'TEST_ROL_%'
SELECT 
    r.rol_funcional_id,
    r.nombre,
    r.estado,
    r.fecha_creacion,
    (SELECT COUNT(*) FROM admin.matriz_acceso_pantalla p WHERE p.rol_funcional_id = r.rol_funcional_id) AS pantallas_count,
    (SELECT COUNT(*) FROM admin.matriz_acceso_rol m WHERE m.rol_funcional_id = r.rol_funcional_id) AS modulos_count
FROM admin.rol_funcional r
WHERE r.rol_funcional_id BETWEEN 112 AND 118
ORDER BY r.rol_funcional_id;

-- 1.4. Validar que NO EXISTEN roles de producción en ese rango
-- (Esta consulta DEBE retornar 0 filas)
SELECT 
    rol_funcional_id,
    nombre
FROM admin.rol_funcional
WHERE rol_funcional_id BETWEEN 112 AND 118
  AND nombre NOT LIKE 'TEST_ROL_%';

-- 1.5. Verificar que ningún registro sintético tenga órdenes de trabajo o facturas de negocio reales
-- (Ambas deben retornar 0)
SELECT COUNT(*) AS ots_sinteticas_asociadas 
FROM admin.ordenes_trabajo 
WHERE usuario_registro BETWEEN 227 AND 233 OR mecanico_id BETWEEN 227 AND 233;

SELECT COUNT(*) AS facturas_sinteticas_asociadas 
FROM admin.facturas 
WHERE usuario_registro BETWEEN 227 AND 233 OR usuario_creacion_id BETWEEN 227 AND 233;


-- ============================================================================
-- PARTE 2: BLOQUE TRANSACCIONAL DE ELIMINACIÓN CON ROLLBACK POR DEFECTO
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_users_count INT;
    v_roles_count INT;
    v_foreign_ot_count INT;
    v_foreign_fac_count INT;
BEGIN
    -- Validar conteo exacto de usuarios sintéticos
    SELECT COUNT(*) INTO v_users_count
    FROM admin.usuario_seguridad
    WHERE usuario_id BETWEEN 227 AND 233 AND identificador_principal LIKE 'test_p6_%';

    IF v_users_count <> 7 THEN
        RAISE EXCEPTION 'Abortando limpieza: Se esperaban 7 usuarios sintéticos (IDs 227-233 con test_p6_%%), pero se encontraron %', v_users_count;
    END IF;

    -- Validar conteo exacto de roles sintéticos
    SELECT COUNT(*) INTO v_roles_count
    FROM admin.rol_funcional
    WHERE rol_funcional_id BETWEEN 112 AND 118 AND nombre LIKE 'TEST_ROL_%';

    IF v_roles_count <> 7 THEN
        RAISE EXCEPTION 'Abortando limpieza: Se esperaban 7 roles sintéticos (IDs 112-118 con TEST_ROL_%%), pero se encontraron %', v_roles_count;
    END IF;

    -- Validar que no existan vínculos con órdenes o facturas de producción
    SELECT COUNT(*) INTO v_foreign_ot_count
    FROM admin.ordenes_trabajo
    WHERE usuario_registro BETWEEN 227 AND 233 OR mecanico_id BETWEEN 227 AND 233;

    IF v_foreign_ot_count > 0 THEN
        RAISE EXCEPTION 'Abortando limpieza: Existen % órdenes de trabajo asociadas a los usuarios sintéticos.', v_foreign_ot_count;
    END IF;

    RAISE NOTICE 'Validaciones de integridad superadas exitosamente. Procediendo con el borrado en cascada segura...';
END $$;

-- 2.1. Eliminar auditorías de anulación si las hubiera
DELETE FROM admin.factura_anulacion 
WHERE usuario_anulacion_id BETWEEN 227 AND 233 
   OR usuario_autorizacion_id BETWEEN 227 AND 233;

-- 2.2. Eliminar logs de actividad y auditoría de los usuarios sintéticos
DELETE FROM admin.usuario_actividad 
WHERE usuario_id BETWEEN 227 AND 233;

DELETE FROM admin.usuario_auditoria 
WHERE usuario_id BETWEEN 227 AND 233 
   OR admin_id BETWEEN 227 AND 233;

-- 2.3. Eliminar sesiones activas o inactivas
DELETE FROM admin.usuario_sesion 
WHERE usuario_id BETWEEN 227 AND 233 
   OR revocado_por BETWEEN 227 AND 233;

-- 2.4. Eliminar permisos personalizados asignados a los usuarios sintéticos
DELETE FROM admin.usuario_permiso_personalizado 
WHERE usuario_id BETWEEN 227 AND 233;

-- 2.5. Eliminar roles adicionales y configuraciones de acceso
DELETE FROM admin.usuario_rol_adicional 
WHERE usuario_id BETWEEN 227 AND 233;

DELETE FROM admin.usuario_alcance 
WHERE usuario_id BETWEEN 227 AND 233;

DELETE FROM admin.usuario_configuracion_acceso 
WHERE usuario_id BETWEEN 227 AND 233;

-- 2.6. Eliminar credenciales y datos de identidad
DELETE FROM admin.usuario_seguridad 
WHERE usuario_id BETWEEN 227 AND 233;

DELETE FROM admin.usuario_identidad 
WHERE usuario_id BETWEEN 227 AND 233;

-- 2.7. Eliminar cabecera principal de usuarios
DELETE FROM admin.usuario 
WHERE usuario_id BETWEEN 227 AND 233;

-- 2.8. Eliminar matrices de permisos de los roles sintéticos
DELETE FROM admin.matriz_acceso_rol 
WHERE rol_funcional_id BETWEEN 112 AND 118;

DELETE FROM admin.matriz_acceso_pantalla 
WHERE rol_funcional_id BETWEEN 112 AND 118;

-- 2.9. Eliminar roles funcionales sintéticos
DELETE FROM admin.rol_funcional 
WHERE rol_funcional_id BETWEEN 112 AND 118;

-- PRECAUCIÓN: ROLLBACK por defecto para ejecución en seco.
-- Para persistir de forma definitiva cuando sea autorizado, cambie ROLLBACK por COMMIT.
ROLLBACK;
-- COMMIT;


-- ============================================================================
-- PARTE 3: CONSULTAS DE VERIFICACIÓN POSTERIOR (SELECT ONLY)
-- Ejecutar tras el COMMIT definitivo para asegurar residuo CERO.
-- ============================================================================

-- 3.1. Verificar eliminación completa de usuarios sintéticos
SELECT COUNT(*) AS usuarios_restantes 
FROM admin.usuario 
WHERE usuario_id BETWEEN 227 AND 233;

-- 3.2. Verificar eliminación completa de credenciales sintéticas
SELECT COUNT(*) AS credenciales_restantes 
FROM admin.usuario_seguridad 
WHERE identificador_principal LIKE 'test_p6_%';

-- 3.3. Verificar eliminación completa de sesiones sintéticas
SELECT COUNT(*) AS sesiones_restantes 
FROM admin.usuario_sesion 
WHERE usuario_id BETWEEN 227 AND 233;

-- 3.4. Verificar eliminación completa de permisos personalizados
SELECT COUNT(*) AS permisos_personalizados_restantes 
FROM admin.usuario_permiso_personalizado 
WHERE usuario_id BETWEEN 227 AND 233;

-- 3.5. Verificar eliminación completa de roles sintéticos
SELECT COUNT(*) AS roles_restantes 
FROM admin.rol_funcional 
WHERE rol_funcional_id BETWEEN 112 AND 118;

-- 3.6. Verificar eliminación completa de matrices de pantalla sintéticas
SELECT COUNT(*) AS matriz_pantalla_restantes 
FROM admin.matriz_acceso_pantalla 
WHERE rol_funcional_id BETWEEN 112 AND 118;

-- 3.7. Verificar eliminación completa de matrices de rol sintéticas
SELECT COUNT(*) AS matriz_rol_restantes 
FROM admin.matriz_acceso_rol 
WHERE rol_funcional_id BETWEEN 112 AND 118;
