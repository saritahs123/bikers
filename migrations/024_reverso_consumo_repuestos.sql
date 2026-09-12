-- ============================================================================
-- Migración 024: Reverso / Devolución de Consumo de Repuestos en Taller
-- 1. Registra tipo_movimiento_id = 11 ('DEV_TALLER', 'ENTRADA')
-- 2. Registra codigo_sistema_id = 13 ('DEVOLUCION_REPUESTO_TALLER', 'DRT')
-- 3. Actualiza función admin.provisionar_codigos_sistema_empresa
-- 4. Agrega columna movimiento_origen_id con FK (ON DELETE RESTRICT)
--    e índice único condicional para impedir doble reverso a nivel DB.
-- ============================================================================

-- 1. Tipo de Movimiento DEV_TALLER (ID 11, ENTRADA)
INSERT INTO admin.tipo_movimiento_inventario (
    tipo_movimiento_id,
    codigo,
    nombre,
    naturaleza,
    descripcion,
    estado,
    fecha_registro,
    usuario_registro
) VALUES (
    11,
    'DEV_TALLER',
    'Devolución de Repuesto de Taller',
    'ENTRADA',
    'Reingreso al almacén de repuesto consumido por error o no utilizado en una orden de trabajo de taller.',
    'ACTIVO',
    NOW(),
    1
) ON CONFLICT (tipo_movimiento_id) DO UPDATE
SET
    codigo = EXCLUDED.codigo,
    nombre = EXCLUDED.nombre,
    naturaleza = EXCLUDED.naturaleza,
    descripcion = EXCLUDED.descripcion,
    estado = EXCLUDED.estado;

-- 2. Código de Sistema 13 (DRT) para empresas existentes
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
    13,
    e.empresa_id,
    'DEVOLUCION_REPUESTO_TALLER',
    'DRT',
    TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'),
    0,
    6,
    true,
    false,
    NOW(),
    NOW()
FROM admin.empresa e
ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

-- 3. Actualizar función admin.provisionar_codigos_sistema_empresa
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

    -- 10: INVENTARIO_INCIAL
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

    -- 13: DEVOLUCION_REPUESTO_TALLER
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        13, p_empresa_id, 'DEVOLUCION_REPUESTO_TALLER', 'DRT', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;
END;
$function$;

-- 4. Agregar columna movimiento_origen_id en admin.movimientos_inventario
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'movimientos_inventario'
          AND column_name = 'movimiento_origen_id'
    ) THEN
        ALTER TABLE admin.movimientos_inventario
        ADD COLUMN movimiento_origen_id INTEGER NULL;
    END IF;
END $$;

-- 5. Clave foránea self-reference hacia admin.movimientos_inventario (ON DELETE RESTRICT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'admin'
          AND table_name = 'movimientos_inventario'
          AND constraint_name = 'movimientos_movimiento_origen_fk'
    ) THEN
        ALTER TABLE admin.movimientos_inventario
        ADD CONSTRAINT movimientos_movimiento_origen_fk
        FOREIGN KEY (movimiento_origen_id)
        REFERENCES admin.movimientos_inventario (movimiento_inventario_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 6. Índice Único Condicional: Cada movimiento SAL_ORDEN solo puede tener UN reverso
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_movimiento_origen_unique
ON admin.movimientos_inventario (movimiento_origen_id)
WHERE movimiento_origen_id IS NOT NULL;
