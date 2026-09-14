-- ============================================================================
-- MIGRATION: 026_billing_direct_sale_inventory.sql
-- MODULE: Facturación (FAC-2 — Nueva Factura / Venta Directa e Inventario)
-- DESCRIPTION:
--   1. Registra tipo de movimiento admin.tipo_movimiento_inventario (SAL_VENTA).
--   2. Registra código de sistema canónico ID 15 ('SALIDA_VENTA', 'SV') en admin.codigo_sistema
--      y actualiza la función admin.provisionar_codigos_sistema_empresa.
--   3. Registra módulo FACTURACION en admin.modulo_sistema y otorga accesos en admin.matriz_acceso_rol.
--   4. Agrega columna almacen_id en admin.detalle_factura con índice de integridad.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Tipo de Movimiento SAL_VENTA en Inventario
-- ----------------------------------------------------------------------------
INSERT INTO admin.tipo_movimiento_inventario (
    codigo,
    nombre,
    naturaleza,
    descripcion,
    estado
)
SELECT
    'SAL_VENTA',
    'Salida por Venta',
    'SALIDA',
    'Salida física de inventario por venta directa de productos facturados.',
    'ACTIVO'
WHERE NOT EXISTS (
    SELECT 1 FROM admin.tipo_movimiento_inventario WHERE UPPER(TRIM(codigo)) = 'SAL_VENTA'
);

-- Asegurar que si ya existía mantenga estado ACTIVO
UPDATE admin.tipo_movimiento_inventario
SET estado = 'ACTIVO',
    nombre = 'Salida por Venta',
    naturaleza = 'SALIDA'
WHERE UPPER(TRIM(codigo)) = 'SAL_VENTA';

-- ----------------------------------------------------------------------------
-- 2. Código de Sistema 15 ('SALIDA_VENTA', 'SV') para Movimientos de Venta
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
    15,
    e.empresa_id,
    'SALIDA_VENTA',
    'SV',
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
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3. Módulo FACTURACION en RBAC
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_next_mod_id INTEGER;
    v_next_orden INTEGER;
    v_mod_id INTEGER;
    v_rol RECORD;
    v_next_matriz_id INTEGER;
BEGIN
    SELECT modulo_sistema_id INTO v_mod_id
    FROM admin.modulo_sistema
    WHERE UPPER(TRIM(nombre)) = 'FACTURACION';

    IF v_mod_id IS NULL THEN
        SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 INTO v_next_mod_id FROM admin.modulo_sistema;
        SELECT COALESCE(MAX(orden), 0) + 1 INTO v_next_orden FROM admin.modulo_sistema;

        INSERT INTO admin.modulo_sistema (modulo_sistema_id, nombre, orden, estado)
        VALUES (v_next_mod_id, 'FACTURACION', v_next_orden, 'ACTIVO');

        v_mod_id := v_next_mod_id;
    END IF;

    -- Provisionar matriz de acceso para roles funcionales existentes
    FOR v_rol IN SELECT rol_funcional_id FROM admin.rol_funcional LOOP
        IF NOT EXISTS (
            SELECT 1 FROM admin.matriz_acceso_rol
            WHERE rol_funcional_id = v_rol.rol_funcional_id AND modulo_sistema_id = v_mod_id
        ) THEN
            SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 INTO v_next_matriz_id FROM admin.matriz_acceso_rol;

            INSERT INTO admin.matriz_acceso_rol (
                matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
                puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
                puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado
            ) VALUES (
                v_next_matriz_id, v_rol.rol_funcional_id, v_mod_id,
                true, true, true, true, true, true,
                true, true, true, true, true, true, 'ACTIVO'
            );
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Almacén en admin.detalle_factura
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'almacen_id'
    ) THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN almacen_id INTEGER NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_detalle_factura_almacen') THEN
        ALTER TABLE admin.detalle_factura
        ADD CONSTRAINT fk_detalle_factura_almacen
        FOREIGN KEY (almacen_id) REFERENCES admin.almacenes(almacen_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_detalle_factura_almacen_id
ON admin.detalle_factura (almacen_id);

COMMIT;
