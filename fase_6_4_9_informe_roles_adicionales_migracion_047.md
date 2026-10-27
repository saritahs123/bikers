# RIDE LAB — FASE 6.4.9: INFORME TÉCNICO DE CIERRE
## GESTIÓN COMPLETA DE ROLES ADICIONALES Y MIGRACIÓN 047 EN TEST

**Proyecto:** Bikers' Fort Core — Ride Lab  
**Repositorio:** `saritahs123/bikers`  
**Rama:** `feature/segurid-crm-taller-ajustes-validaciones`  
**Ambiente Autorizado:** PostgreSQL 18.6 TEST local — `127.0.0.1:5432/bikers_dbtest`  
**Fecha:** 23 de Octubre de 2026  
**Estado:** ✅ **COMPLETADO CON ÉXITO — 100% DE PRUEBAS SUPERADAS**

---

## 1. RESUMEN EJECUTIVO

En la **Fase 6.4.9**, se ha completado de manera rigurosa, segura y estandarizada la administración integral de **Roles Adicionales (Secundarios)** para los usuarios del sistema Ride Lab. Esta implementación resolvió la carencia estructural de autoincremento y secuencias en la tabla `admin.usuario_rol_adicional`, incorporó restricciones únicas formales para prevenir duplicidades e inconsistencias en roles y módulos del sistema, y desplegó la infraestructura completa en backend y frontend para la gestión visual de roles adicionales, preservando de manera inviolable el blindaje de privilegios institucionales establecido en la Fase 6.4.8.

### Logros Principales:
1. **Migración 047 Oficial:** Creada y aplicada de forma controlada mediante el motor institucional `scripts/db_migrations.js` en el entorno TEST local (`bikers_dbtest`), alcanzando un historial consolidado de 47 migraciones verificadas e inmutables (0 alteradas).
2. **Secuencia PostgreSQL y Concurrencia:** Columna `usuario_rol_adicional_id` asociada a secuencia dedicada con `OWNED BY`, valor `DEFAULT nextval(...)`, sincronización con `setval` bajo bloqueo transaccional `SHARE ROW EXCLUSIVE MODE`, garantizando cero colisiones en inserciones paralelas concurrentes.
3. **Restricciones UNIQUE Consolidadas:** Verificación de la restricción preexistente en `admin.usuario_rol_adicional` sobre `(usuario_id, rol_funcional_id)` y creación segura de `uq_matriz_acceso_rol` sobre `admin.matriz_acceso_rol(rol_funcional_id, modulo_sistema_id)` previa confirmación de ausencia de duplicados.
4. **Backend Transaccional y Seguro:**
   - `POST /api/usuarios`: Eliminación definitiva de la generación manual concurrente vulnerable `MAX(id) + 1`; adopción del `DEFAULT` nativo de PostgreSQL.
   - `GET /api/usuarios/[id]` y `GET /api/usuarios`: Devolución estructurada de `roles_additional: number[]` y `additional_roles: { id, name }[]`.
   - `PUT /api/usuarios/[id]`: Sincronización atómica mediante `withTransaction` y bloqueo de fila con `SELECT ... FOR UPDATE`, distinguiendo campo omitido (conservación) de arreglo vacío `[]` (remoción total), impidiendo autoasignación, y prohibiendo terminantemente la asignación del Rol 1 (SuperAdmin) por actores no autorizados.
   - `GET /api/auth/me`: Inclusión de `roles_additional: number[]` para sesión y navegación inmediata.
5. **Interfaz de Usuario (UsersSecurityView.jsx):**
   - Integración reactiva en el Wizard de Creación y en el Modal de Edición User 360.
   - Selector dinámico de roles secundarios con badges estilizados, botón de remoción `(x)` y filtrado preventivo en cliente que excluye el Rol 1 para operadores que no posean credenciales de Administrador General.
   - Resumen visual en modo lectura (User 360 Resumen y Paso 2 del Wizard).
   - Plena adherencia al sistema de tokens semánticos (Light / Dark mode).
6. **Validación Exhaustiva:** Superación del 100% de los 26 escenarios de prueba de la Fase 6.4.9 y ejecución satisfactoria de las suites de regresión (Fase 6.4.8, 6.4.6, 6.4.5 y 6.4.1).

---

## 2. SQL DEFINITIVO DE LA MIGRACIÓN 047

Archivo: `migrations/047_usuario_rol_adicional_sequence_and_constraints.sql`

```sql
-- ============================================================================
-- MIGRACIÓN 047: SECUENCIA Y RESTRICCIONES EN ROLES ADICIONALES Y MATRIZ RBAC
-- Ambiente Autorizado: bikers_dbtest (Local TEST)
-- Esquema: admin
-- Motor Oficial: scripts/db_migrations.js
-- ============================================================================

-- 1. Bloqueo transaccional de seguridad sobre usuario_rol_adicional para inicialización atómica
LOCK TABLE admin.usuario_rol_adicional IN SHARE ROW EXCLUSIVE MODE;

-- 2. Crear la secuencia para admin.usuario_rol_adicional.usuario_rol_adicional_id si no existe
CREATE SEQUENCE IF NOT EXISTS admin.usuario_rol_adicional_usuario_rol_adicional_id_seq;

-- 3. Asociar formalmente la secuencia a la columna
ALTER SEQUENCE admin.usuario_rol_adicional_usuario_rol_adicional_id_seq
  OWNED BY admin.usuario_rol_adicional.usuario_rol_adicional_id;

-- 4. Establecer DEFAULT nextval(...) en la columna
ALTER TABLE admin.usuario_rol_adicional
  ALTER COLUMN usuario_rol_adicional_id
  SET DEFAULT nextval('admin.usuario_rol_adicional_usuario_rol_adicional_id_seq');

-- 5. Sincronizar el valor actual de la secuencia con el máximo ID existente
SELECT setval(
  'admin.usuario_rol_adicional_usuario_rol_adicional_id_seq',
  COALESCE((SELECT MAX(usuario_rol_adicional_id) FROM admin.usuario_rol_adicional), 0) + 1,
  false
);

-- 6. Bloqueo transaccional y creación condicional de restricción UNIQUE en matriz_acceso_rol
LOCK TABLE admin.matriz_acceso_rol IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'admin.matriz_acceso_rol'::regclass 
      AND conname = 'uq_matriz_acceso_rol'
  ) THEN
    ALTER TABLE admin.matriz_acceso_rol
      ADD CONSTRAINT uq_matriz_acceso_rol UNIQUE (rol_funcional_id, modulo_sistema_id);
  END IF;
END $$;
```

---

## 3. RESULTADO DE LA APLICACIÓN CONTROLADA

La migración 047 fue ejecutada exclusivamente a través del mecanismo oficial `scripts/db_migrations.js`:

```powershell
node scripts/db_migrations.js migrate --env=test
```

### Salida del Motor:
```text
======================================================================
--- CONTROL DE MIGRACIONES DE BASE DE DATOS (MODO: TEST) ---
======================================================================

[CONEXION OBJETIVO] 127.0.0.1:5432/bikers_dbtest (Ambiente: test)
[ESTADO DE TABLA] Tabla admin.schema_migrations confirmada.
[HISTORIAL ACTUAL] 46 migraciones previamente registradas.

[PROCESANDO ARCHIVOS PENDIENTES]
>> Aplicando migración 047: 047_usuario_rol_adicional_sequence_and_constraints.sql
   Checksum SHA256: 4fa188a1be52e675ae6f7ca2b67ad7817be025bcbe632fa5a78280f2d93e1174
   Ejecutada con éxito en 18ms.

[REGISTRO AUDITABLE] Migración 047 asentada en admin.schema_migrations.
[RESUMEN FINAL] 1 migraciones aplicadas correctamente.
```

### Verificación de Integridad y Checksums:
```powershell
node scripts/db_migrations.js verify --env=test
```
```text
======================================================================
--- CONTROL DE MIGRACIONES DE BASE DE DATOS (MODO: TEST) ---
======================================================================

[CONEXION OBJETIVO] 127.0.0.1:5432/bikers_dbtest (Ambiente: test)
[VERIFICANDO INTEGRIDAD Y CONSISTENCIA]
✅ Inmutabilidad confirmada: Todos los checksums de archivos aplicados coinciden.
✅ Orden cronológico y secuencial de migraciones verificado.

[ÉXITO] Verificación de integridad completada sin inconsistencias.
```

---

## 4. VALIDACIÓN ESTRUCTURAL Y DE CONCURRENCIA EN POSTGRESQL

Se ejecutó un diagnóstico directo de 10 puntos de control para validar el estado del motor de base de datos tras la migración:

| # | Control de Base de Datos | Resultado | Detalle Técnico |
|---|---|---|---|
| 1 | Migraciones registradas | **PASS** | 47 migraciones registradas en `admin.schema_migrations` |
| 2 | Integridad de Checksums | **PASS** | 47 archivos validados sin alteraciones ni desfases |
| 3 | Secuencia creada | **PASS** | `admin.usuario_rol_adicional_usuario_rol_adicional_id_seq` |
| 4 | Asociación `OWNED BY` | **PASS** | Secuencia es propietaria de `usuario_rol_adicional_id` |
| 5 | Columna con `DEFAULT` | **PASS** | `DEFAULT nextval('admin.usuario_rol_adicional_usuario_rol_adicional_id_seq')` |
| 6 | Inserción sin especificar ID | **PASS** | Auto-asignación exitosa sin necesidad de SELECT manual |
| 7 | Inserciones concurrentes | **PASS** | Generación paralela sin colisiones de identificadores |
| 8 | Restricción UNIQUE roles | **PASS** | `uk_usuario_rol_adicional_rol_funcional` protege `(usuario_id, rol_funcional_id)` |
| 9 | Restricción UNIQUE matriz | **PASS** | `uq_matriz_acceso_rol` protege `(rol_funcional_id, modulo_sistema_id)` |
| 10 | Conservación Usuario 234 | **PASS** | Registro histórico preservado intacto: ID=1, usuario=234, rol=1 |

---

## 5. MODIFICACIONES DE BACKEND

### 1. `src/app/api/usuarios/route.ts`
- **Eliminación de generación manual de IDs:** Se eliminó la sentencia concurrente vulnerable:
  ```sql
  (SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) + 1 FROM admin.usuario_rol_adicional)
  ```
  y se reemplazó por la delegación directa en el `DEFAULT` de PostgreSQL.
- **GET `/api/usuarios`:** Se enriqueció la consulta de listado para agregar los roles adicionales de cada usuario mediante:
  ```sql
  COALESCE(
    (SELECT array_agg(ura.rol_funcional_id ORDER BY ura.rol_funcional_id)
     FROM admin.usuario_rol_adicional ura
     WHERE ura.usuario_id = u.usuario_id),
    ARRAY[]::integer[]
  ) AS roles_additional
  ```

### 2. `src/app/api/usuarios/[id]/route.ts`
- **GET `/api/usuarios/[id]`:** Consulta atómica a `admin.usuario_rol_adicional` asociando `admin.rol_funcional` para devolver simultáneamente:
  - `roles_additional`: arreglo plano numérico (`[2, 3]`).
  - `additional_roles`: colección de objetos descriptivos (`[{ id: 2, name: 'Administrador de Empresa' }]`).
- **PUT `/api/usuarios/[id]`:**
  - Importación y aplicación de `withTransaction` para atomicidad total.
  - Bloqueo pesimista de fila: `SELECT usuario_id FROM admin.usuario WHERE usuario_id = $1 FOR UPDATE`.
  - Validación unificada mediante `resolveAndValidateAdditionalRoles`:
    - Rechazo estricto de duplicados en la petición (HTTP 400).
    - Rechazo de roles inactivos o inexistentes (HTTP 400).
    - Rechazo de roles que coincidan con el rol principal del usuario (HTTP 400).
    - Blindaje de escalamiento: Rechazo tajante de asignación de Rol 1 si el operador que emite la petición no es SuperAdmin institucional (HTTP 403).
    - Bloqueo de auto-modificación de roles (HTTP 403).
  - Manejo de presencia explícita: Si `roles_additional` se provee explícitamente (incluso como `[]`), sincroniza (DELETE y re-insert); si se omite por completo en una actualización de otros campos, los roles adicionales preexistentes se conservan sin alteración.
  - Respuesta enriquecida devolviendo `usuarioActualizado` con sus roles secundarios actualizados.

### 3. `src/app/api/auth/me/route.ts`
- Se agregó la consulta a `admin.usuario_rol_adicional` para incluir `roles_additional: number[]` e `is_superadmin: boolean` en la carga útil de sesión (`data` y `user`), permitiendo que el cliente y la navegación conozcan los privilegios agregados de forma inmediata.

---

## 6. MODIFICACIONES DE FRONTEND (`UsersSecurityView.jsx`)

1. **Estado de Permiso del Operador:** Invocación a `/api/auth/me` dentro de `loadCatalogos` para inicializar de forma segura `currentUserIsSuperAdmin`.
2. **Listado Filtrado de Roles Disponibles (`availableRoles`):**
   ```javascript
   const availableRoles = useMemo(() => {
     if (currentUserIsSuperAdmin) return roles;
     return (roles || []).filter(r => Number(r.numericId || r.id) !== 1);
   }, [roles, currentUserIsSuperAdmin]);
   ```
   Garantiza que ningún usuario sin rol SuperAdmin vea el Rol 1 disponible para selección, complementando la protección estricta en servidor.
3. **Roles Elegibles como Secundarios (`availableRolesForAdditional`):**
   Excluye automáticamente el rol principal actual del usuario y aquellos roles que ya estén asignados como adicionales.
4. **Modal de Edición User 360:**
   - Incorporación de selector para agregar roles adicionales y visualización mediante chips/badges en tonalidad púrpura (`bg-purple-500/10 text-purple-400 border-purple-500/30`).
   - Botón interactivo `(x)` para remover roles adicionales individuales.
   - En el encabezado del banner 360 y en la pestaña Resumen (modo lectura), se despliegan distintivos con los nombres de los roles adicionales vigentes.
5. **Wizard de Creación de Usuarios:**
   - Incorporación del selector de roles adicionales y gestión de badges en el Paso 1.
   - Resumen y desglose de roles adicionales asignados en el Paso 2 de confirmación previa a la persistencia.
   - Persistencia de `wizardData.roles_additional` en `handleSaveUser`.

---

## 7. RESULTADOS DE LA SUITE DE PRUEBAS DE LA FASE 6.4.9

Suite automatizada: `scripts/test_fase_6_4_9_roles_adicionales.js`  
Ejecución: `node scripts/test_fase_6_4_9_roles_adicionales.js`

```text
======================================================================
--- FASE 6.4.9: GESTIÓN DE ROLES ADICIONALES Y MIGRACIÓN 047 SUITE ---
======================================================================

[INIT] Conteo inicial de usuarios en bikers_dbtest: 56
[SETUP] Actores sintéticos inicializados con éxito.

✅ PASS [Escenario 01] Creación de usuario sin roles adicionales
   Detalle: HTTP 200 — Registros en usuario_rol_adicional: 0
✅ PASS [Escenario 02] Creación de usuario con 1 rol adicional
   Detalle: HTTP 200 — Rol asignado: 3, Secuencia ID: 37
✅ PASS [Escenario 03] Creación de usuario con múltiples roles adicionales
   Detalle: HTTP 200 — Roles asignados: [3, 4]
✅ PASS [Escenario 04] Edición de roles adicionales existentes (reemplazo [3] -> [4])
   Detalle: HTTP 200 — Roles en DB: [4]
✅ PASS [Escenario 05] Agregar rol secundario en edición ([4] -> [4, 6])
   Detalle: HTTP 200 — Roles en DB: [4, 6]
✅ PASS [Escenario 06] Retirar rol secundario en edición ([4, 6] -> [6])
   Detalle: HTTP 200 — Roles en DB: [6]
✅ PASS [Escenario 07] Retirar todos los roles secundarios (roles_additional: [])
   Detalle: HTTP 200 — Cantidad en DB: 0
✅ PASS [Escenario 08] Omitir campo roles_additional en PUT conserva roles existentes
   Detalle: HTTP 200 — Roles conservados en DB: [3, 4]
✅ PASS [Escenario 09] Rechazo de duplicados en roles_additional ([3, 3])
   Detalle: HTTP 400 — Mensaje: No se permiten roles adicionales duplicados.
✅ PASS [Escenario 10] Rechazo de rol inactivo (Rol 11)
   Detalle: HTTP 400 — Mensaje: Uno o más roles adicionales especificados se encuentran inactivos.
✅ PASS [Escenario 11] Rechazo de rol inexistente (Rol 99999)
   Detalle: HTTP 400 — Mensaje: Uno o más roles adicionales especificados no existen.
✅ PASS [Escenario 12] Rechazo de rol adicional igual al rol principal
   Detalle: HTTP 400 — Mensaje: Un rol no puede ser asignado simultáneamente como rol principal y adicional.
✅ PASS [Escenario 13] Bloqueo de asignación de Rol 1 por usuario no-SuperAdmin
   Detalle: HTTP 403 — Asignaciones de Rol 1 en DB: 0
✅ PASS [Escenario 14] Asignación legítima institucional de Rol 1 por SuperAdmin
   Detalle: HTTP 200 — Asignaciones de Rol 1 en DB: 1
✅ PASS [Escenario 15] Bloqueo de auto-modificación de roles adicionales
   Detalle: HTTP 403 — Rechazo de auto-modificación verificado
✅ PASS [Escenario 16] Rollback transaccional ante error en asignación
   Detalle: HTTP 400 — Estado conservado íntegramente: [3]
✅ PASS [Escenario 17] Generación de IDs concurrentes sin colisión vía secuencia
   Detalle: IDs generados concurrentemente: [48, 51, 50, 49]
✅ PASS [Escenario 18] Restricción UNIQUE en usuario_rol_adicional previene duplicados en DB
   Detalle: Error PostgreSQL 23505 (unique_violation) disparado correctamente
✅ PASS [Escenario 19] Restricción UNIQUE uq_matriz_acceso_rol aplicada y operativa
   Detalle: Constraint uq_matriz_acceso_rol presente en catálogo y rechaza colisiones con error 23505
✅ PASS [Escenario 20] Permisos efectivos combinados devueltos en sesión
   Detalle: HTTP 200 — Roles adicionales en sesión: [2]
✅ PASS [Escenario 21] Revocación inmediata al retirar rol adicional
   Detalle: HTTP 200 — Roles adicionales tras retiro: []
✅ PASS [Escenario 22] Matriz RBAC disponible para cálculo dinámico en frontend
   Detalle: HTTP 200 — Roles en catálogo RBAC: 17
✅ PASS [Escenario 23] Información de autorización para Smart Home Dispatcher
   Detalle: SuperAdmin identificado correctamente para Smart Home Dispatcher: true
✅ PASS [Escenario 24] Aislamiento multiempresa impide modificar roles en otra empresa
   Detalle: HTTP 403 — Roles asignados en otra empresa: 0
✅ PASS [Escenario 25] Persistencia y formato devuelto en GET /api/usuarios/[id]
   Detalle: HTTP 200 — roles_additional: [3, 4], additional_roles: 2 objetos
✅ PASS [Escenario 26] Conservación del registro histórico de usuario 234 con rol 1
   Detalle: Registro usuario 234: ID=1, Rol=1

[CLEANUP] Limpiando datos de prueba sintéticos...
[CLEANUP] 12 usuarios y 4 sesiones sintéticas eliminadas con éxito.

======================================================================
--- RESUMEN FINAL: 26 PASADOS / 0 FALLADOS (TOTAL: 26) ---
======================================================================
```

---

## 8. SUITES DE REGRESIÓN DE FASES ANTERIORES

Para garantizar la estabilidad integral del sistema tras las modificaciones, se ejecutaron las suites de fases previas:

### 1. Regresión Fase 6.4.8 (Blindaje de Privilegios Administrativos y Prevención de Escalamiento)
- Comando: `node scripts/test_fase_6_4_8_privilege_escalation.js`
- Resultado: **22/22 ESCENARIOS SUPERADOS (0 FALLOS)**.
- Confirmación: Ningún actor puede autoescalarse a SuperAdmin, autoasignarse roles o modificar su propia empresa/estado.

### 2. Regresión Fase 6.4.6 (Smart Home Dispatcher & Navegación Centralizada)
- Comando: `npx tsx scripts/test_fase_6_4_6_navigation.js`
- Resultado: **26/26 ESCENARIOS SUPERADOS (0 FALLOS)**.
- Confirmación: El ruteo dinámico hacia destinos de mayor prioridad canónica opera con fluidez y respeta permisos agregados por roles adicionales.

### 3. Regresión Fase 6.4.5 (Motor RBAC & Aislamiento de Reportes y Módulos)
- Comando: `npx tsx scripts/test_fase_6_4_5_rbac.js`
- Resultado: **24/24 ESCENARIOS SUPERADOS (0 FALLOS)**.
- Confirmación: Modelo B intacto; aislamiento multiempresa verificado; salvaguarda administrativa estricta.

### 4. Regresión Fase 6.4.1 (Diagnóstico Perimetral y Acceso al Dashboard)
- Comando: `npx tsx scripts/test_fase_6_4_1_regression.js`
- Resultado: **10/10 ESCENARIOS SUPERADOS (0 FALLOS)**.

### 5. Compilación TypeScript Estricta
- Comando: `npx tsc --noEmit`
- Resultado: **0 errores de compilación**.

---

## 9. CONTROL DE RESTRICCIONES Y ESTADO DE GIT

En estricto apego a las directivas de seguridad dictadas para la Fase 6.4.9:

| Restricción | Estado | Evidencia / Mecanismo |
|---|---|---|
| NO modificar AWS RDS | **CUMPLIDO** | Sin conexiones salientes ni configuraciones remotas alteradas. |
| NO modificar Vercel | **CUMPLIDO** | No se realizaron despliegues ni cambios de infraestructura. |
| NO modificar `.env.local` | **CUMPLIDO** | Archivo `.env.local` intacto; uso exclusivo de `.env.test.local`. |
| NO alterar migraciones 001–046 | **CUMPLIDO** | Checksums SHA-256 de las migraciones 001 a 046 verificados e idénticos. |
| NO modificar usuarios reales | **CUMPLIDO** | Uso exclusivo de usuarios sintéticos eliminados al finalizar cada prueba. |
| Preservar usuario 234 | **CUMPLIDO** | Registro histórico con rol 1 intacto en `admin.usuario_rol_adicional`. |
| NO realizar git commit | **CUMPLIDO** | 0 commits ejecutados durante esta fase. |
| NO hacer git push | **CUMPLIDO** | 0 comandos push ejecutados. |
| NO crear Pull Requests | **CUMPLIDO** | Ningún PR creado. |
| NO ejecutar merges | **CUMPLIDO** | Rama `feature/segurid-crm-taller-ajustes-validaciones` se mantiene aislada. |

### Estado del Working Tree de Git (`git status -s`):
```text
 M scripts/test_phase6_user_acceptance.js
 M src/app/(dashboard)/layout.tsx
 M src/app/(dashboard)/page.tsx
 M src/app/(dashboard)/settings/security/components/RolesSecurityView.jsx
 M src/app/(dashboard)/settings/security/components/UsersSecurityView.jsx
 M src/app/api/auth/me/route.ts
 M src/app/api/usuarios/[id]/route.ts
 M src/app/api/usuarios/route.ts
 M src/components/layout/Sidebar.tsx
 M src/lib/userAuth.ts
 M src/lib/workshop-session.ts
?? fase_6_4_8_informe_blindaje_privilegios_rbac.md
?? fase_6_4_9_informe_roles_adicionales_migracion_047.md
?? migrations/047_usuario_rol_adicional_sequence_and_constraints.sql
?? scripts/fix_test_role_dashboard_access.js
?? scripts/test_fase_6_4_1_regression.js
?? scripts/test_fase_6_4_5_rbac.js
?? scripts/test_fase_6_4_6_navigation.js
?? scripts/test_fase_6_4_8_privilege_escalation.js
?? scripts/test_fase_6_4_9_roles_adicionales.js
?? src/components/auth/NeutralWelcomeView.tsx
```

---

## 10. EVALUACIÓN DE RIESGOS PENDIENTES Y RECOMENDACIONES

1. **Despliegue a Producción (AWS RDS):**
   - Cuando se autorice la promoción a producción, la migración `047_usuario_rol_adicional_sequence_and_constraints.sql` debe aplicarse exclusivamente utilizando `node scripts/db_migrations.js migrate --env=prod`.
   - El bloqueo transaccional `SHARE ROW EXCLUSIVE MODE` incorporado en el script garantiza que las conexiones concurrentes de usuarios en producción esperen de forma segura durante los ~20ms de ejecución de la migración sin generar inconsistencias de secuencia.
2. **Monitoreo de Auditoría Forense:**
   - Cada cambio de roles adicionales emite un registro detallado en `admin.usuario_auditoria` con tipo `UPDATE_USER_ROLES` indicando los identificadores de roles agregados y retirados, facilitando el control de trazabilidad corporativo.
3. **Escalabilidad de Catálogos:**
   - La arquitectura cumple plenamente con la regla oficial de catálogos basada en el módulo de Departamentos, asegurando que futuros catálogos y entidades hereden la misma solidez transaccional y estructural.

---

**CONCLUSIÓN:**  
La **Fase 6.4.9** queda oficialmente concluida y validada con un 100% de éxito en todos los frentes técnicos, arquitecturales, de seguridad y de regresión en el ambiente TEST local.
