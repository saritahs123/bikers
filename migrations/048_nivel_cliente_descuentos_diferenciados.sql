-- ============================================================================
-- MIGRATION 048: DESCUENTOS DIFERENCIADOS POR NIVEL DE CLIENTE (SERVICIOS Y PRODUCTOS)
-- ============================================================================
-- Proyecto: Bikers' Fort Core — Ride Lab
-- Fase: 6.4.16
-- 
-- Permite configurar y aplicar dos porcentajes de descuento independientes por nivel:
-- - descuento_servicio (NUMERIC(5,2) entre 0 y 100)
-- - descuento_producto (NUMERIC(5,2) entre 0 y 100)
--
-- Sustituye el campo histórico porciento_descuento en admin.nivel_cliente.
-- Agrega columnas de trazabilidad diferenciada en admin.facturas preservando
-- los datos históricos intactos.
-- ============================================================================

-- 1. Agregar nuevas columnas a admin.nivel_cliente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND column_name = 'descuento_servicio'
  ) THEN
    ALTER TABLE admin.nivel_cliente ADD COLUMN descuento_servicio NUMERIC(5,2) NOT NULL DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND column_name = 'descuento_producto'
  ) THEN
    ALTER TABLE admin.nivel_cliente ADD COLUMN descuento_producto NUMERIC(5,2) NOT NULL DEFAULT 0.00;
  END IF;
END $$;

-- 2. Restricciones CHECK para rango 0 a 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND constraint_name = 'ck_nivel_cliente_descuento_servicio'
  ) THEN
    ALTER TABLE admin.nivel_cliente 
      ADD CONSTRAINT ck_nivel_cliente_descuento_servicio 
      CHECK (descuento_servicio >= 0 AND descuento_servicio <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND constraint_name = 'ck_nivel_cliente_descuento_producto'
  ) THEN
    ALTER TABLE admin.nivel_cliente 
      ADD CONSTRAINT ck_nivel_cliente_descuento_producto 
      CHECK (descuento_producto >= 0 AND descuento_producto <= 100);
  END IF;
END $$;

-- 3. Migrar valores existentes desde porciento_descuento hacia ambos campos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND column_name = 'porciento_descuento'
  ) THEN
    UPDATE admin.nivel_cliente 
    SET descuento_servicio = porciento_descuento,
        descuento_producto = porciento_descuento
    WHERE porciento_descuento IS NOT NULL;
  END IF;
END $$;

-- 4. Retirar restricción antigua y columna porciento_descuento de admin.nivel_cliente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND constraint_name = 'ck_nivel_cliente_descuento'
  ) THEN
    ALTER TABLE admin.nivel_cliente DROP CONSTRAINT ck_nivel_cliente_descuento;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' AND column_name = 'porciento_descuento'
  ) THEN
    ALTER TABLE admin.nivel_cliente DROP COLUMN porciento_descuento;
  END IF;
END $$;

-- 5. Agregar columnas de trazabilidad en admin.facturas
-- Nota: Por defecto NULL en porcentajes para distinguir facturas históricas (legacy) de facturas nuevas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'porciento_descuento_servicio'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN porciento_descuento_servicio NUMERIC(5,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'porciento_descuento_producto'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN porciento_descuento_producto NUMERIC(5,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'descuento_servicio'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN descuento_servicio NUMERIC(12,2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'descuento_producto'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN descuento_producto NUMERIC(12,2) DEFAULT 0.00;
  END IF;
END $$;
