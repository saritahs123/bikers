# RIDE LAB — CONTROL DE MIGRACIONES DE BASE DE DATOS

**Proyecto:** Bikers' Fort Core — Ride Lab  
**Entorno Local:** PostgreSQL 18.6 (Windows x64)  
**Entorno Productivo:** AWS RDS PostgreSQL  
**Esquema:** `admin`

---

## 1. Arquitectura del Mecanismo

El control de cambios estructurales y datos de referencia de Ride Lab implementa un flujo unidireccional y seguro: **TEST LOCAL (`bikers_dbtest`) → VALIDACIÓN AUDITADA → PRODUCCIÓN (AWS RDS)**.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       DESARROLLO EN TEST        │       │      DESPLIEGUE EN PRODUCCIÓN    │
│  PostgreSQL 18 Local (Port 5432)│       │          AWS RDS PostgreSQL     │
│  Base: bikers_dbtest            │       │          Base: bikers_db        │
│                                 │       │                                 │
│  1. Crear archivo versionado    │       │  1. Plan estático auditado      │
│     en migrations/NNN_xxx.sql   │       │     npm run db:prod:plan        │
│  2. Inspeccionar plan           │       │  2. Respaldo pg_dump en AWS     │
│     npm run db:test:plan        │ ────> │  3. Túnel seguro / Bastion      │
│  3. Aplicar y verificar en TEST │       │  4. Ejecución manual autorizada │
│     npm run db:test:migrate     │       │     transaccional (BEGIN..COMMIT│
│  4. Verificar integridad        │       │  5. Registro en schema_migration│
│     npm run db:test:verify      │       │                                 │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 2. Convenciones de Nomenclatura

Todo cambio de estructura o datos de catálogo debe residir en un archivo dentro del directorio `migrations/`:

- **Formato:** `NNN_nombre_descriptivo.sql`
- **Numeración:** 3 dígitos correlativos (ej: `044_factura_anulacion_sequence.sql`, `045_nueva_funcionalidad.sql`).
- **Encabezado estándar obligatorio:**
  ```sql
  -- ============================================================================
  -- MIGRATION: 045_nombre_migracion.sql
  -- DESCRIPTION: Resumen conciso de los cambios estructurales o datos semilla
  -- IDEMPOTENT: Sí / No
  -- ============================================================================
  ```
- **Inmutabilidad:** Una vez aplicada una migración, su archivo SQL **NUNCA DEBE MODIFICARSE**. Cualquier corrección debe realizarse en un archivo de migración posterior correlativo.

---

## 3. Tabla de Control: `admin.schema_migrations`

Las ejecuciones y estados de las migraciones se auditan en la tabla centralizada:

```sql
CREATE TABLE IF NOT EXISTS admin.schema_migrations (
    migration_id VARCHAR(100) PRIMARY KEY,
    sequence_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    checksum_sha256 CHAR(64) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    executed_by VARCHAR(100) NOT NULL DEFAULT current_user,
    execution_time_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'APPLIED',
    environment VARCHAR(20) NOT NULL DEFAULT 'test',
    details JSONB,
    CONSTRAINT chk_schema_migrations_status CHECK (status IN ('APPLIED', 'BASELINE', 'FAILED', 'VERIFIED')),
    CONSTRAINT chk_schema_migrations_env CHECK (environment IN ('test', 'production', 'staging', 'development'))
);
```

### Estados Permitidos:
- **`BASELINE`:** Migración histórica cuya estructura ya existe en la base restaurada de producción, registrada sin volver a ejecutar su SQL.
- **`APPLIED`:** Migración ejecutada y confirmada transaccionalmente por el CLI.
- **`FAILED`:** Migración que falló durante su ejecución (registrada para auditoría con detalle del error).
- **`VERIFIED`:** Migración cuyo checksum e integridad fueron validados formalmente.

---

## 4. Comandos de Operación

Todos los comandos se invocan mediante npm:

| Comando | Ambiente | Descripción |
| :--- | :--- | :--- |
| `npm run db:test:status` | TEST | Muestra la tabla de migraciones en disco, cuáles están aplicadas, pendientes o alteradas. |
| `npm run db:test:plan` | TEST | Analiza el impacto de migraciones pendientes (DDL, bloqueos de tablas, DROP) sin modificar datos. |
| `npm run db:test:migrate` | TEST | Aplica de forma atómica y secuencial las migraciones pendientes en `bikers_dbtest`. |
| `npm run db:test:verify` | TEST | Comprueba la inmutabilidad de checksums SHA-256 y el orden de ejecución. |
| `npm run db:prod:plan` | PROD | Genera el informe de despliegue seguro para AWS RDS sin ejecutar cambios en la nube. |

> [!CAUTION]  
> El comando `migrate` está **bloqueado a nivel de código para el ambiente de producción**. Las migraciones en AWS RDS requieren revisión previa, respaldo y ejecución autorizada fuera del flujo local.

---

## 5. Detección de Alteraciones (Tamper Detection) y Advisory Locks

1. **Checksums Criptográficos:** Cada archivo SQL posee un hash SHA-256 único calculado al momento de su ejecución. Si alguien altera un archivo ya aplicado, el comando `verify` y `status` lo marcan como `❌ ALTERADO` y bloquean nuevas migraciones.
2. **Concurrencia con Advisory Locks:** Antes de ejecutar cualquier migración, el CLI solicita un bloqueo exclusivo en PostgreSQL mediante `pg_try_advisory_lock(987654321)`. Si otro proceso o terminal está migrando, la ejecución aborta inmediatamente sin generar bloqueos huérfanos.

---

## 6. Procedimiento de Baseline para Bases Restauradas

Cuando se restaura una base de producción hacia el ambiente de pruebas local (`bikers_dbtest`), la base contiene las estructuras de las migraciones históricas pero carece de los registros en `admin.schema_migrations`.

Para reconciliar este estado sin re-ejecutar scripts históricos destructivamente:

```bash
node scripts/db_migrations.js baseline --env=test --target=43
```

Este procedimiento:
1. Registra las migraciones `001` a `043` con estado `'BASELINE'`.
2. Asocia los checksums SHA-256 oficiales de cada archivo.
3. Deja la migración `044_factura_anulacion_sequence.sql` (y las futuras) con estado `'PENDIENTE'` para ser aplicadas formalmente mediante `npm run db:test:migrate`.

---

## 7. Tratamiento de Errores y Transaccionalidad

- Toda migración se ejecuta dentro de un bloque `BEGIN ... COMMIT`.
- Si una instrucción falla:
  1. PostgreSQL ejecuta un `ROLLBACK` inmediato.
  2. La migración **NO** se marca como aplicada.
  3. Se registra un evento con estado `'FAILED'` en `admin.schema_migrations` conteniendo el mensaje y stack trace de error en la columna `details` (JSONB).
  4. El ejecutor detiene la secuencia completa para evitar inconsistencias en cascada.

---

## 8. Estrategia de Respaldo y Reconstrucción

### A. Respaldo Local Previo a Migraciones
Antes de aplicar migraciones estructurales en `bikers_dbtest`:
```powershell
$env:PGPASSWORD = "tu_password"; & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -p 5432 -U bikers_test -d bikers_dbtest -F c -b -f "backups_locales\pre_migration.dump"; $env:PGPASSWORD = $null
```

### B. Cómo Reconstruir TEST desde un Backup de Producción
1. Crear la base `bikers_dbtest` en PostgreSQL 18 local.
2. Restaurar el volcado productivo mediante `pg_restore`.
3. Ejecutar el script de sanitización: `node scripts/execute_controlled_sanitization.js`.
4. Provisionar el usuario de pruebas: `node scripts/create_local_admin.js`.
5. Establecer el baseline histórico: `node scripts/db_migrations.js baseline --env=test --target=43`.
6. Aplicar migraciones pendientes: `npm run db:test:migrate`.
7. Verificar consistencia: `npm run db:test:verify`.
