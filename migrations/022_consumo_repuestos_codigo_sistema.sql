-- ============================================================================
-- MIGRATION: 022_consumo_repuestos_codigo_sistema.sql
-- DESCRIPTION: Registra el código de sistema canónico (ID 12) para consumo
--              físico de repuestos en órdenes de trabajo de taller (CRT).
--              Actualiza admin.provisionar_codigos_sistema_empresa(p_empresa_id)
--              para incluir de forma idempotente el código 12.
-- IDEMPOTENT: Sí
-- ============================================================================

-- 1. Insertar codigo_sistema_id = 12 para todas las empresas existentes
INSERT INTO admin.codigo_sistema (
    codigo_sistema_id,
    empresa_id,
    tipo_transaccion,
    prefijo,
    periodo,
    ultimo_numero,
    longitud_numero,
    activo,
    es_catalogo,
    fecha_creacion,
    fecha_actualizacion
)
SELECT
    12,
    e.empresa_id,
    'CONSUMO_REPUESTO_TALLER',
    'CRT',
    TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'),
    0,
    6,
    true,
    false,
    NOW(),
    NOW()
FROM admin.empresa e
ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

-- 2. Actualizar función admin.provisionar_codigos_sistema_empresa
CREATE OR REPLACE FUNCTION admin.provisionar_codigos_sistema_empresa(p_empresa_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_periodo_actual CHAR(6);
BEGIN
    v_periodo_actual := TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM');

    -- 5: ENTRADA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        5, p_empresa_id, 'ENTRADA_INVENTARIO', 'EI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 6: SALIDA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        6, p_empresa_id, 'SALIDA_INVENTARIO', 'SI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 7: AJUSTE_POSITIVO_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        7, p_empresa_id, 'AJUSTE_POSITIVO_INVENTARIO', 'API', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 8: AJUSTE_NEGATIVO_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        8, p_empresa_id, 'AJUSTE_NEGATIVO_INVENTARIO', 'ANI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 9: TRANSFERENCIA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        9, p_empresa_id, 'TRANSFERENCIA_INVENTARIO', 'TRFI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 10: INVENTARIO_INCIAL (Preserva typo canónico existente en catálogo)
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        10, p_empresa_id, 'INVENTARIO_INCIAL', 'INVI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 12: CONSUMO_REPUESTO_TALLER
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        12, p_empresa_id, 'CONSUMO_REPUESTO_TALLER', 'CRT', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;
END;
$function$;
