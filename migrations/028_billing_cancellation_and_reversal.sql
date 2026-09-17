-- ============================================================================
-- MIGRATION: 028_billing_cancellation_and_reversal.sql
-- MODULE: Facturación (FAC-6 — Anulación de Factura + Reversos Controlados)
-- DESCRIPTION:
--   1. Agrega campos de trazabilidad de anulación en admin.facturas:
--      - motivo_anulacion TEXT NULL
--      - fecha_anulacion TIMESTAMPTZ NULL
--      - usuario_anulacion_id INTEGER NULL (FK a admin.usuario)
--   2. Registra tipo de movimiento admin.tipo_movimiento_inventario (DEV_VENTA, ENTRADA).
--   3. Registra código de sistema ID 16 ('DEVOLUCION_VENTA', 'DV') en admin.codigo_sistema
--      y actualiza la función admin.provisionar_codigos_sistema_empresa.
--   4. Asegura existencia de índice único condicional sobre movimiento_origen_id en
--      admin.movimientos_inventario para impedir doble reverso a nivel de motor DB.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Campos de anulación en admin.facturas
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND column_name = 'motivo_anulacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD COLUMN motivo_anulacion TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND column_name = 'fecha_anulacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD COLUMN fecha_anulacion TIMESTAMPTZ NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND column_name = 'usuario_anulacion_id'
    ) THEN
        ALTER TABLE admin.facturas
        ADD COLUMN usuario_anulacion_id INTEGER NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND constraint_name = 'fk_facturas_usuario_anulacion'
    ) THEN
        ALTER TABLE admin.facturas
        ADD CONSTRAINT fk_facturas_usuario_anulacion
        FOREIGN KEY (usuario_anulacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tipo de Movimiento DEV_VENTA en Inventario
-- ----------------------------------------------------------------------------
INSERT INTO admin.tipo_movimiento_inventario (
    codigo,
    nombre,
    naturaleza,
    descripcion,
    estado
)
SELECT
    'DEV_VENTA',
    'Devolución por Anulación de Venta',
    'ENTRADA',
    'Reingreso físico a inventario por anulación de factura con venta directa de productos.',
    'ACTIVO'
WHERE NOT EXISTS (
    SELECT 1 FROM admin.tipo_movimiento_inventario WHERE UPPER(TRIM(codigo)) = 'DEV_VENTA'
);

UPDATE admin.tipo_movimiento_inventario
SET estado = 'ACTIVO',
    nombre = 'Devolución por Anulación de Venta',
    naturaleza = 'ENTRADA'
WHERE UPPER(TRIM(codigo)) = 'DEV_VENTA';

-- ----------------------------------------------------------------------------
-- 3. Código de Sistema 16 ('DEVOLUCION_VENTA', 'DV')
-- ----------------------------------------------------------------------------
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
    16,
    e.empresa_id,
    'DEVOLUCION_VENTA',
    'DV',
    TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'),
    0,
    6,
    true,
    false,
    NOW(),
    NOW()
FROM admin.empresa e
ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

-- Actualizar función admin.provisionar_codigos_sistema_empresa
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

    -- 14: FACTURA
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        14, p_empresa_id, 'FACTURA', 'FAC', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 15: SALIDA_VENTA
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        15, p_empresa_id, 'SALIDA_VENTA', 'SV', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 16: DEVOLUCION_VENTA
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        16, p_empresa_id, 'DEVOLUCION_VENTA', 'DV', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4. Asegurar índice único condicional sobre movimiento_origen_id
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_movimiento_origen_unique
ON admin.movimientos_inventario (movimiento_origen_id)
WHERE movimiento_origen_id IS NOT NULL;

COMMIT;
