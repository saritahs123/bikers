-- =============================================================================
-- Migración: migrations/020_codigo_sistema_composite_key.sql
-- Módulo: Inventario / Sistema (INV-2C)
-- Propósito:
--   1. Convertir admin.codigo_sistema a llave primaria compuesta:
--      PRIMARY KEY (empresa_id, codigo_sistema_id)
--      permitiendo consecutivos independientes con mismos IDs entre diferentes empresas.
--   2. Reemplazar cualquier UNIQUE global por UNIQUE multitenant:
--      UNIQUE (empresa_id, tipo_transaccion, periodo)
--   3. Idempotente, no destructiva, preserva datos y consecutivos existentes.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
  v_uk_name text;
  v_uk_cols text[];
BEGIN
  -- 1. Auditar y migrar PRIMARY KEY en admin.codigo_sistema
  SELECT
    c.conname,
    ARRAY_AGG(a.attname::text ORDER BY u.ord)
  INTO
    v_pk_name,
    v_pk_cols
  FROM pg_constraint c
  JOIN LATERAL UNNEST(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'admin.codigo_sistema'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  -- Si la PK actual no incluye empresa_id de forma compuesta, eliminarla
  IF v_pk_name IS NOT NULL AND NOT (
    v_pk_cols = ARRAY['empresa_id', 'codigo_sistema_id']::text[]
    OR v_pk_cols = ARRAY['codigo_sistema_id', 'empresa_id']::text[]
  ) THEN
    RAISE NOTICE 'Eliminando PK obsoleta en admin.codigo_sistema: % con columnas %', v_pk_name, v_pk_cols;
    EXECUTE format('ALTER TABLE admin.codigo_sistema DROP CONSTRAINT %I', v_pk_name);
    v_pk_name := NULL;
  END IF;

  -- Crear la PRIMARY KEY compuesta (empresa_id, codigo_sistema_id) si no existe
  IF v_pk_name IS NULL THEN
    RAISE NOTICE 'Creando PRIMARY KEY compuesta (empresa_id, codigo_sistema_id) en admin.codigo_sistema';
    ALTER TABLE admin.codigo_sistema
      ADD CONSTRAINT codigo_sistema_pkey PRIMARY KEY (empresa_id, codigo_sistema_id);
  ELSE
    RAISE NOTICE 'PRIMARY KEY compuesta ya existe en admin.codigo_sistema: % (%)', v_pk_name, v_pk_cols;
  END IF;

  -- 2. Eliminar cualquier constraint UNIQUE global obsoleto que no incluya empresa_id
  FOR v_uk_name, v_uk_cols IN
    SELECT
      c.conname,
      ARRAY_AGG(a.attname::text ORDER BY u.ord)
    FROM pg_constraint c
    JOIN LATERAL UNNEST(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    WHERE c.conrelid = 'admin.codigo_sistema'::regclass
      AND c.contype = 'u'
    GROUP BY c.conname
  LOOP
    IF NOT ('empresa_id' = ANY(v_uk_cols)) THEN
      RAISE NOTICE 'Eliminando UNIQUE global obsoleto en admin.codigo_sistema: % con columnas %', v_uk_name, v_uk_cols;
      EXECUTE format('ALTER TABLE admin.codigo_sistema DROP CONSTRAINT %I', v_uk_name);
    END IF;
  END LOOP;

  -- 3. Garantizar UNIQUE multitenant (empresa_id, tipo_transaccion, periodo)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN LATERAL UNNEST(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    WHERE c.conrelid = 'admin.codigo_sistema'::regclass
      AND c.contype = 'u'
    GROUP BY c.conname
    HAVING ARRAY_AGG(a.attname::text ORDER BY u.ord) = ARRAY['empresa_id', 'tipo_transaccion', 'periodo']::text[]
  ) THEN
    RAISE NOTICE 'Creando UNIQUE multitenant (empresa_id, tipo_transaccion, periodo) en admin.codigo_sistema';
    ALTER TABLE admin.codigo_sistema
      ADD CONSTRAINT uk_codigo_sistema UNIQUE (empresa_id, tipo_transaccion, periodo);
  ELSE
    RAISE NOTICE 'UNIQUE multitenant ya existe en admin.codigo_sistema';
  END IF;

END $$;

COMMIT;
