-- =============================================================================
-- Migración: migrations/016_catalog_sequences.sql
-- Módulo: Inventario / Configuración (CFG-INV-1)
-- Propósito: Configurar secuencias dinámicas, seguras e idempotentes con
--            DEFAULT nextval para las PKs de los catálogos globales de inventario:
--              - admin.tipo_producto (tipo_producto_id)
--              - admin.categoria_producto (categoria_producto_id)
--              - admin.marca_producto (marca_producto_id)
--              - admin.unidad_medida (unidad_medida_id)
-- Reglas críticas:
--   1. CERO valores hardcodeados. El avance se calcula dinámicamente en ejecución.
--   2. NUNCA retroceder secuencias que ya estén más adelantadas que MAX(pk)
--      por registros creados y eliminados previamente.
--   3. Idempotente: seguro para re-ejecución sin generar colisiones ni errores.
-- =============================================================================

BEGIN;

-- 1. admin.tipo_producto
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_target BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'tipo_producto_tipo_producto_id_seq' AND n.nspname = 'admin'
  ) THEN
    CREATE SEQUENCE admin.tipo_producto_tipo_producto_id_seq;
  END IF;

  ALTER SEQUENCE admin.tipo_producto_tipo_producto_id_seq OWNED BY admin.tipo_producto.tipo_producto_id;

  SELECT COALESCE(MAX(tipo_producto_id), 0) INTO v_max_id FROM admin.tipo_producto;

  SELECT COALESCE(last_value, 1) INTO v_curr_val
  FROM pg_sequences
  WHERE schemaname = 'admin' AND sequencename = 'tipo_producto_tipo_producto_id_seq';

  v_target := GREATEST(v_max_id, v_curr_val);

  IF v_max_id = 0 AND v_curr_val <= 1 THEN
    PERFORM setval('admin.tipo_producto_tipo_producto_id_seq', 1, false);
  ELSE
    PERFORM setval('admin.tipo_producto_tipo_producto_id_seq', v_target, true);
  END IF;

  ALTER TABLE admin.tipo_producto
    ALTER COLUMN tipo_producto_id SET DEFAULT nextval('admin.tipo_producto_tipo_producto_id_seq');
END $$;

-- 2. admin.categoria_producto
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_target BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'categoria_producto_categoria_producto_id_seq' AND n.nspname = 'admin'
  ) THEN
    CREATE SEQUENCE admin.categoria_producto_categoria_producto_id_seq;
  END IF;

  ALTER SEQUENCE admin.categoria_producto_categoria_producto_id_seq OWNED BY admin.categoria_producto.categoria_producto_id;

  SELECT COALESCE(MAX(categoria_producto_id), 0) INTO v_max_id FROM admin.categoria_producto;

  SELECT COALESCE(last_value, 1) INTO v_curr_val
  FROM pg_sequences
  WHERE schemaname = 'admin' AND sequencename = 'categoria_producto_categoria_producto_id_seq';

  v_target := GREATEST(v_max_id, v_curr_val);

  IF v_max_id = 0 AND v_curr_val <= 1 THEN
    PERFORM setval('admin.categoria_producto_categoria_producto_id_seq', 1, false);
  ELSE
    PERFORM setval('admin.categoria_producto_categoria_producto_id_seq', v_target, true);
  END IF;

  ALTER TABLE admin.categoria_producto
    ALTER COLUMN categoria_producto_id SET DEFAULT nextval('admin.categoria_producto_categoria_producto_id_seq');
END $$;

-- 3. admin.marca_producto
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_target BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'marca_producto_marca_producto_id_seq' AND n.nspname = 'admin'
  ) THEN
    CREATE SEQUENCE admin.marca_producto_marca_producto_id_seq;
  END IF;

  ALTER SEQUENCE admin.marca_producto_marca_producto_id_seq OWNED BY admin.marca_producto.marca_producto_id;

  SELECT COALESCE(MAX(marca_producto_id), 0) INTO v_max_id FROM admin.marca_producto;

  SELECT COALESCE(last_value, 1) INTO v_curr_val
  FROM pg_sequences
  WHERE schemaname = 'admin' AND sequencename = 'marca_producto_marca_producto_id_seq';

  v_target := GREATEST(v_max_id, v_curr_val);

  IF v_max_id = 0 AND v_curr_val <= 1 THEN
    PERFORM setval('admin.marca_producto_marca_producto_id_seq', 1, false);
  ELSE
    PERFORM setval('admin.marca_producto_marca_producto_id_seq', v_target, true);
  END IF;

  ALTER TABLE admin.marca_producto
    ALTER COLUMN marca_producto_id SET DEFAULT nextval('admin.marca_producto_marca_producto_id_seq');
END $$;

-- 4. admin.unidad_medida
DO $$
DECLARE
  v_max_id BIGINT;
  v_curr_val BIGINT;
  v_target BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'unidad_medida_unidad_medida_id_seq' AND n.nspname = 'admin'
  ) THEN
    CREATE SEQUENCE admin.unidad_medida_unidad_medida_id_seq;
  END IF;

  ALTER SEQUENCE admin.unidad_medida_unidad_medida_id_seq OWNED BY admin.unidad_medida.unidad_medida_id;

  SELECT COALESCE(MAX(unidad_medida_id), 0) INTO v_max_id FROM admin.unidad_medida;

  SELECT COALESCE(last_value, 1) INTO v_curr_val
  FROM pg_sequences
  WHERE schemaname = 'admin' AND sequencename = 'unidad_medida_unidad_medida_id_seq';

  v_target := GREATEST(v_max_id, v_curr_val);

  IF v_max_id = 0 AND v_curr_val <= 1 THEN
    PERFORM setval('admin.unidad_medida_unidad_medida_id_seq', 1, false);
  ELSE
    PERFORM setval('admin.unidad_medida_unidad_medida_id_seq', v_target, true);
  END IF;

  ALTER TABLE admin.unidad_medida
    ALTER COLUMN unidad_medida_id SET DEFAULT nextval('admin.unidad_medida_unidad_medida_id_seq');
END $$;

COMMIT;
