-- =====================================================================
-- MIGRACIÓN 046: CÓDIGO INMUTABLE EN ADMIN.MODULO_SISTEMA
-- Ambientes: test (PostgreSQL 18.6 local) / prod (AWS RDS PostgreSQL)
-- Descripción: Agrega una columna 'codigo' (VARCHAR(50), NOT NULL, UNIQUE)
--              inmutable y libre de caracteres acentuados o diacríticos
--              en admin.modulo_sistema, con triggers para generación
--              automática en inserciones y preservación estricta en updates.
-- Idempotencia: Verificaciones IF NOT EXISTS y DO blocks condicionales.
-- Compatibilidad: Mantiene la columna histórica 'nombre' intacta para
--                 compatibilidad total con el código legacy y reportes.
-- =====================================================================

BEGIN;

-- 1. Agregar columna 'codigo' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'admin' 
      AND table_name = 'modulo_sistema' 
      AND column_name = 'codigo'
  ) THEN
    ALTER TABLE admin.modulo_sistema ADD COLUMN codigo VARCHAR(50);
    RAISE NOTICE 'Columna codigo agregada a admin.modulo_sistema.';
  END IF;
END $$;

-- 2. Poblar códigos canónicos para todos los módulos existentes
UPDATE admin.modulo_sistema SET codigo = 'DASHBOARD' WHERE modulo_sistema_id = 1;
UPDATE admin.modulo_sistema SET codigo = 'SEGURIDAD' WHERE modulo_sistema_id = 2;
UPDATE admin.modulo_sistema SET codigo = 'CRM' WHERE modulo_sistema_id = 3;
UPDATE admin.modulo_sistema SET codigo = 'BICICLETA' WHERE modulo_sistema_id = 4;
UPDATE admin.modulo_sistema SET codigo = 'RECEPCION' WHERE modulo_sistema_id = 5;
UPDATE admin.modulo_sistema SET codigo = 'DIAGNOSTICO' WHERE modulo_sistema_id = 6;
UPDATE admin.modulo_sistema SET codigo = 'TALLER' WHERE modulo_sistema_id = 7;
UPDATE admin.modulo_sistema SET codigo = 'INVENTARIO' WHERE modulo_sistema_id = 8;
UPDATE admin.modulo_sistema SET codigo = 'CONTROL_INVENTARIO' WHERE modulo_sistema_id = 9;
UPDATE admin.modulo_sistema SET codigo = 'FACTURACION' WHERE modulo_sistema_id = 10;
UPDATE admin.modulo_sistema SET codigo = 'PORTAL_CLIENTE' WHERE modulo_sistema_id = 11;
UPDATE admin.modulo_sistema SET codigo = 'VENDEDOR' WHERE modulo_sistema_id = 12;
UPDATE admin.modulo_sistema SET codigo = 'OTROS' WHERE modulo_sistema_id = 13;
UPDATE admin.modulo_sistema SET codigo = 'TEST_MOD_14' WHERE modulo_sistema_id = 14;
UPDATE admin.modulo_sistema SET codigo = 'TEST_MOD_15' WHERE modulo_sistema_id = 15;
UPDATE admin.modulo_sistema SET codigo = 'REPORTES' WHERE modulo_sistema_id = 16;
UPDATE admin.modulo_sistema SET codigo = 'CONFIGURACION' WHERE modulo_sistema_id = 17;

-- Fallback genérico para cualquier módulo futuro que aún tenga código NULL
UPDATE admin.modulo_sistema
SET codigo = SUBSTRING(REGEXP_REPLACE(REGEXP_REPLACE(
  REGEXP_REPLACE(
    UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÄËÏÖÜäëïöüÑñÇç', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouAEIOUaeiouNnCc')),
    '[^A-Z0-9_]+',
    '_',
    'g'
  ), '^_+', ''), '_+$', '') FROM 1 FOR 50)
WHERE codigo IS NULL;

-- 3. Aplicar restricción NOT NULL
ALTER TABLE admin.modulo_sistema ALTER COLUMN codigo SET NOT NULL;

-- 4. Crear índice único si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'admin' 
      AND tablename = 'modulo_sistema' 
      AND indexname = 'uq_modulo_sistema_codigo'
  ) THEN
    CREATE UNIQUE INDEX uq_modulo_sistema_codigo ON admin.modulo_sistema (codigo);
    RAISE NOTICE 'Índice único uq_modulo_sistema_codigo creado exitosamente.';
  END IF;
END $$;

-- 5. Agregar constraint de formato ASCII (solo mayúsculas, dígitos y guión bajo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'admin.modulo_sistema'::regclass 
      AND conname = 'chk_modulo_sistema_codigo_ascii'
  ) THEN
    ALTER TABLE admin.modulo_sistema 
      ADD CONSTRAINT chk_modulo_sistema_codigo_ascii 
      CHECK (codigo ~ '^[A-Z0-9_]+$');
    RAISE NOTICE 'Constraint chk_modulo_sistema_codigo_ascii agregado.';
  END IF;
END $$;

-- 6. Trigger BEFORE INSERT para derivación automática de código y validación determinista
CREATE OR REPLACE FUNCTION admin.fn_trg_modulo_sistema_default_codigo()
RETURNS TRIGGER AS $$
DECLARE
  v_generated VARCHAR(50);
BEGIN
  -- Si el código no fue provisto o es solo espacios en blanco, generarlo a partir de 'nombre'
  IF NEW.codigo IS NULL OR TRIM(NEW.codigo) = '' THEN
    IF NEW.nombre IS NULL OR TRIM(NEW.nombre) = '' THEN
      RAISE EXCEPTION 'No se puede registrar un módulo con nombre y código vacíos.';
    END IF;

    -- Normalización ASCII canónica: quitar acentos, pasar a mayúsculas, reemplazar no alfanuméricos por '_'
    v_generated := REGEXP_REPLACE(
      UPPER(TRANSLATE(NEW.nombre, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÄËÏÖÜäëïöüÑñÇç', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouAEIOUaeiouNnCc')),
      '[^A-Z0-9_]+',
      '_',
      'g'
    );
    -- Quitar guiones bajos sobrantes al inicio y final
    v_generated := REGEXP_REPLACE(REGEXP_REPLACE(v_generated, '^_+', ''), '_+$', '');
    -- Limitar longitud máxima a 50 caracteres
    v_generated := SUBSTRING(v_generated FROM 1 FOR 50);

    IF v_generated IS NULL OR v_generated = '' THEN
      RAISE EXCEPTION 'El nombre "%" no genera un código alfanumérico válido.', NEW.nombre;
    END IF;

    NEW.codigo := v_generated;
  ELSE
    -- Si el código fue provisto explícitamente, normalizar mayúsculas y espacios sin sobrescribirlo
    NEW.codigo := UPPER(TRIM(NEW.codigo));
  END IF;

  -- Validar formato ASCII estricto
  IF NEW.codigo !~ '^[A-Z0-9_]+$' THEN
    RAISE EXCEPTION 'El código de módulo "%" contiene caracteres no permitidos. Solo se permiten A-Z, 0-9 y guión bajo.', NEW.codigo;
  END IF;

  -- Detección temprana de duplicados
  IF EXISTS (
    SELECT 1 FROM admin.modulo_sistema
    WHERE codigo = NEW.codigo
      AND modulo_sistema_id <> COALESCE(NEW.modulo_sistema_id, -1)
  ) THEN
    RAISE EXCEPTION 'El código de módulo "%" ya existe en el sistema.', NEW.codigo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_modulo_sistema_default_codigo ON admin.modulo_sistema;
CREATE TRIGGER trg_modulo_sistema_default_codigo
  BEFORE INSERT ON admin.modulo_sistema
  FOR EACH ROW
  EXECUTE FUNCTION admin.fn_trg_modulo_sistema_default_codigo();

-- 7. Trigger BEFORE UPDATE para proteger la inmutabilidad de 'codigo' (no cambia al cambiar nombre visible)
CREATE OR REPLACE FUNCTION admin.fn_trg_modulo_sistema_protect_codigo()
RETURNS TRIGGER AS $$
BEGIN
  -- Si intentan dejar el código NULL o vacío en UPDATE, preservar estrictamente el código original
  IF NEW.codigo IS NULL OR TRIM(NEW.codigo) = '' THEN
    NEW.codigo := OLD.codigo;
  ELSE
    NEW.codigo := UPPER(TRIM(NEW.codigo));
  END IF;

  -- Si intentan alterar el código respecto al original, validar que cumpla el formato y no colisione
  IF NEW.codigo <> OLD.codigo THEN
    IF NEW.codigo !~ '^[A-Z0-9_]+$' THEN
      RAISE EXCEPTION 'El código de módulo "%" contiene caracteres no permitidos.', NEW.codigo;
    END IF;

    IF EXISTS (
      SELECT 1 FROM admin.modulo_sistema
      WHERE codigo = NEW.codigo
        AND modulo_sistema_id <> OLD.modulo_sistema_id
    ) THEN
      RAISE EXCEPTION 'El código de módulo "%" ya pertenece a otro módulo.', NEW.codigo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_modulo_sistema_protect_codigo ON admin.modulo_sistema;
CREATE TRIGGER trg_modulo_sistema_protect_codigo
  BEFORE UPDATE ON admin.modulo_sistema
  FOR EACH ROW
  EXECUTE FUNCTION admin.fn_trg_modulo_sistema_protect_codigo();

-- 8. Verificación posterior de integridad
DO $$
DECLARE
  v_null_count INTEGER;
  v_dup_count INTEGER;
BEGIN
  SELECT count(*) INTO v_null_count FROM admin.modulo_sistema WHERE codigo IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Verificación fallida: Existen % módulos con codigo NULL.', v_null_count;
  END IF;

  SELECT count(*) INTO v_dup_count 
  FROM (
    SELECT codigo, count(*) FROM admin.modulo_sistema GROUP BY codigo HAVING count(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Verificación fallida: Se encontraron codigos duplicados en modulo_sistema.';
  END IF;

  RAISE NOTICE 'Migración 046 completada y validada exitosamente con triggers de compatibilidad.';
END $$;

COMMIT;
