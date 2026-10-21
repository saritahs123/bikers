-- ============================================================================
-- MIGRATION 041: NIVELES DE CLIENTES Y DESCUENTOS EN FACTURACIÓN
-- ============================================================================

-- 1. Tabla de Catálogo de Niveles de Clientes
CREATE TABLE IF NOT EXISTS admin.nivel_cliente (
  nivel_cliente_id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  porciento_descuento NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  descripcion VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_nivel_cliente_descuento CHECK (porciento_descuento >= 0 AND porciento_descuento <= 100),
  CONSTRAINT uq_nivel_cliente_nombre UNIQUE (nombre)
);

-- Seed / Actualización de niveles canónicos
INSERT INTO admin.nivel_cliente (nombre, porciento_descuento, descripcion, activo)
VALUES 
  ('VIP', 15.00, 'Nivel VIP con 15% de descuento preferencial', true),
  ('INTERMEDIO', 5.00, 'Nivel Intermedio con 5% de descuento', true),
  ('BASICO', 0.00, 'Nivel básico sin descuento', true)
ON CONFLICT (nombre) DO UPDATE
SET porciento_descuento = EXCLUDED.porciento_descuento,
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo;

-- 2. Clave foránea en admin.clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'clientes' AND column_name = 'nivel_cliente_id'
  ) THEN
    ALTER TABLE admin.clientes ADD COLUMN nivel_cliente_id INT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'admin' AND table_name = 'clientes' AND constraint_name = 'cliente_nivel_cliente_fkey'
  ) THEN
    ALTER TABLE admin.clientes 
      ADD CONSTRAINT cliente_nivel_cliente_fkey 
      FOREIGN KEY (nivel_cliente_id) REFERENCES admin.nivel_cliente(nivel_cliente_id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Columnas de trazabilidad inmutable en admin.facturas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'nivel_cliente_id'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN nivel_cliente_id INT NULL;
    ALTER TABLE admin.facturas 
      ADD CONSTRAINT factura_nivel_cliente_fkey 
      FOREIGN KEY (nivel_cliente_id) REFERENCES admin.nivel_cliente(nivel_cliente_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'porciento_descuento_nivel'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN porciento_descuento_nivel NUMERIC(5,2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'descuento_nivel'
  ) THEN
    ALTER TABLE admin.facturas ADD COLUMN descuento_nivel NUMERIC(12,2) DEFAULT 0.00;
  END IF;
END $$;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_nivel_cliente_id ON admin.clientes(nivel_cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_nivel_cliente_id ON admin.facturas(nivel_cliente_id);
