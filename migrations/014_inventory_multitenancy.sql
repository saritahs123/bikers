-- ============================================================================
-- MIGRATION: 014_inventory_multitenancy.sql
-- DESCRIPTION: Multi-tenant isolation and sequence hardening for Inventory Module:
--              1. Sequence creation, assignment, and sync for almacenes PK.
--              2. Adds empresa_id with FK to admin.empresa on admin.almacenes.
--                 Replaces global UNIQUEs with tenant-scoped (empresa_id, codigo) and (empresa_id, nombre).
--              3. Adds empresa_id with FK to admin.empresa on admin.productos.
--                 Replaces global UNIQUE with tenant-scoped (empresa_id, codigo_producto).
--              4. Sequence creation, assignment, and sync for proveedores PK.
--              5. Adds empresa_id with FK to admin.empresa on admin.proveedores.
--                 Replaces global UNIQUEs with tenant-scoped (empresa_id, codigo_proveedor) and (empresa_id, nombre_comercial).
--              6. Sequence creation, assignment, and sync for producto_proveedor PK.
--              7. Adds empresa_id with FK to admin.empresa on admin.existencias_producto with backfill and tenant index.
--              8. Adds empresa_id with FK to admin.empresa on admin.movimientos_inventario with backfill and tenant index.
-- IDEMPOTENT: Yes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. admin.almacenes (Sequence & Tenant isolation)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS admin.almacenes_almacen_id_seq;
ALTER SEQUENCE admin.almacenes_almacen_id_seq OWNED BY admin.almacenes.almacen_id;
ALTER TABLE admin.almacenes ALTER COLUMN almacen_id SET DEFAULT nextval('admin.almacenes_almacen_id_seq');
SELECT setval(
  'admin.almacenes_almacen_id_seq',
  COALESCE((SELECT MAX(almacen_id) FROM admin.almacenes), 1),
  (SELECT MAX(almacen_id) FROM admin.almacenes) IS NOT NULL
);

ALTER TABLE admin.almacenes ADD COLUMN IF NOT EXISTS empresa_id integer NULL;

-- Backfill existing almacenes to active primary company (empresa_id = 1)
UPDATE admin.almacenes
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE admin.almacenes ALTER COLUMN empresa_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'almacenes_empresa_fk'
      AND conrelid = 'admin.almacenes'::regclass
  ) THEN
    ALTER TABLE admin.almacenes
      ADD CONSTRAINT almacenes_empresa_fk
      FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
  END IF;
END $$;

-- Replace global UNIQUEs with tenant-scoped UNIQUE constraints
ALTER TABLE admin.almacenes DROP CONSTRAINT IF EXISTS almacenes_codigo_uk;
ALTER TABLE admin.almacenes DROP CONSTRAINT IF EXISTS almacenes_nombre_uk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'almacenes_empresa_codigo_uk'
      AND conrelid = 'admin.almacenes'::regclass
  ) THEN
    ALTER TABLE admin.almacenes
      ADD CONSTRAINT almacenes_empresa_codigo_uk UNIQUE (empresa_id, codigo);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'almacenes_empresa_nombre_uk'
      AND conrelid = 'admin.almacenes'::regclass
  ) THEN
    ALTER TABLE admin.almacenes
      ADD CONSTRAINT almacenes_empresa_nombre_uk UNIQUE (empresa_id, nombre);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS almacenes_empresa_idx ON admin.almacenes (empresa_id);

-- ----------------------------------------------------------------------------
-- 2. admin.productos (Tenant isolation)
-- ----------------------------------------------------------------------------
ALTER TABLE admin.productos ADD COLUMN IF NOT EXISTS empresa_id integer NULL;

-- Backfill existing productos to primary company (empresa_id = 1)
UPDATE admin.productos
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE admin.productos ALTER COLUMN empresa_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productos_empresa_fk'
      AND conrelid = 'admin.productos'::regclass
  ) THEN
    ALTER TABLE admin.productos
      ADD CONSTRAINT productos_empresa_fk
      FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
  END IF;
END $$;

-- Replace global UNIQUE with tenant-scoped UNIQUE (empresa_id, codigo_producto)
ALTER TABLE admin.productos DROP CONSTRAINT IF EXISTS productos_codigo_uk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productos_empresa_codigo_uk'
      AND conrelid = 'admin.productos'::regclass
  ) THEN
    ALTER TABLE admin.productos
      ADD CONSTRAINT productos_empresa_codigo_uk UNIQUE (empresa_id, codigo_producto);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS productos_empresa_idx ON admin.productos (empresa_id);

-- ----------------------------------------------------------------------------
-- 3. admin.proveedores (Sequence & Tenant isolation)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS admin.proveedores_proveedor_id_seq;
ALTER SEQUENCE admin.proveedores_proveedor_id_seq OWNED BY admin.proveedores.proveedor_id;
ALTER TABLE admin.proveedores ALTER COLUMN proveedor_id SET DEFAULT nextval('admin.proveedores_proveedor_id_seq');
SELECT setval(
  'admin.proveedores_proveedor_id_seq',
  COALESCE((SELECT MAX(proveedor_id) FROM admin.proveedores), 1),
  (SELECT MAX(proveedor_id) FROM admin.proveedores) IS NOT NULL
);

ALTER TABLE admin.proveedores ADD COLUMN IF NOT EXISTS empresa_id integer NULL;

-- Backfill existing proveedores to primary company (empresa_id = 1)
UPDATE admin.proveedores
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE admin.proveedores ALTER COLUMN empresa_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proveedores_empresa_fk'
      AND conrelid = 'admin.proveedores'::regclass
  ) THEN
    ALTER TABLE admin.proveedores
      ADD CONSTRAINT proveedores_empresa_fk
      FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
  END IF;
END $$;

-- Replace global UNIQUEs with tenant-scoped UNIQUE constraints
ALTER TABLE admin.proveedores DROP CONSTRAINT IF EXISTS proveedores_codigo_uk;
ALTER TABLE admin.proveedores DROP CONSTRAINT IF EXISTS proveedores_nombre_uk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proveedores_empresa_codigo_uk'
      AND conrelid = 'admin.proveedores'::regclass
  ) THEN
    ALTER TABLE admin.proveedores
      ADD CONSTRAINT proveedores_empresa_codigo_uk UNIQUE (empresa_id, codigo_proveedor);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proveedores_empresa_nombre_uk'
      AND conrelid = 'admin.proveedores'::regclass
  ) THEN
    ALTER TABLE admin.proveedores
      ADD CONSTRAINT proveedores_empresa_nombre_uk UNIQUE (empresa_id, nombre_comercial);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS proveedores_empresa_idx ON admin.proveedores (empresa_id);

-- ----------------------------------------------------------------------------
-- 4. admin.producto_proveedor (Sequence)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS admin.producto_proveedor_producto_proveedor_id_seq;
ALTER SEQUENCE admin.producto_proveedor_producto_proveedor_id_seq OWNED BY admin.producto_proveedor.producto_proveedor_id;
ALTER TABLE admin.producto_proveedor ALTER COLUMN producto_proveedor_id SET DEFAULT nextval('admin.producto_proveedor_producto_proveedor_id_seq');
SELECT setval(
  'admin.producto_proveedor_producto_proveedor_id_seq',
  COALESCE((SELECT MAX(producto_proveedor_id) FROM admin.producto_proveedor), 1),
  (SELECT MAX(producto_proveedor_id) FROM admin.producto_proveedor) IS NOT NULL
);

-- ----------------------------------------------------------------------------
-- 5. admin.existencias_producto (Defense-in-depth tenant column)
-- ----------------------------------------------------------------------------
ALTER TABLE admin.existencias_producto ADD COLUMN IF NOT EXISTS empresa_id integer NULL;

-- Backfill from warehouse / product company
UPDATE admin.existencias_producto ep
SET empresa_id = COALESCE(a.empresa_id, p.empresa_id, 1)
FROM admin.almacenes a, admin.productos p
WHERE ep.almacen_id = a.almacen_id
  AND ep.producto_id = p.producto_id
  AND ep.empresa_id IS NULL;

UPDATE admin.existencias_producto
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE admin.existencias_producto ALTER COLUMN empresa_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'existencias_producto_empresa_fk'
      AND conrelid = 'admin.existencias_producto'::regclass
  ) THEN
    ALTER TABLE admin.existencias_producto
      ADD CONSTRAINT existencias_producto_empresa_fk
      FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS existencias_producto_empresa_idx
  ON admin.existencias_producto (empresa_id, almacen_id, producto_id);

-- ----------------------------------------------------------------------------
-- 6. admin.movimientos_inventario (Tenant audit & kardex isolation)
-- ----------------------------------------------------------------------------
ALTER TABLE admin.movimientos_inventario ADD COLUMN IF NOT EXISTS empresa_id integer NULL;

-- Backfill from warehouse / product company
UPDATE admin.movimientos_inventario mi
SET empresa_id = COALESCE(a.empresa_id, p.empresa_id, 1)
FROM admin.almacenes a, admin.productos p
WHERE mi.almacen_id = a.almacen_id
  AND mi.producto_id = p.producto_id
  AND mi.empresa_id IS NULL;

UPDATE admin.movimientos_inventario
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE admin.movimientos_inventario ALTER COLUMN empresa_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'movimientos_inventario_empresa_fk'
      AND conrelid = 'admin.movimientos_inventario'::regclass
  ) THEN
    ALTER TABLE admin.movimientos_inventario
      ADD CONSTRAINT movimientos_inventario_empresa_fk
      FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS movimientos_inventario_empresa_fecha_idx
  ON admin.movimientos_inventario (empresa_id, fecha_movimiento DESC);
