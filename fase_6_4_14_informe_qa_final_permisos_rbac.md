# RIDE LAB — FASE 6.4.14: INFORME DE QA FINAL DE PERMISOS RBAC Y VALIDACIÓN FUNCIONAL

**Proyecto:** Sistema de Gestión BIKERS  
**Módulo:** Motor de Permisos RBAC, Seguridad Server-Side, Control de Asignación de Roles y UI Enforcing  
**Rama:** `feature/segurid-crm-taller-ajustes-validaciones`  
**Entorno de Pruebas:** Local TEST (`bikers_dbtest` en PostgreSQL local puerto 5432)  
**Fecha:** 23 de Octubre de 2026  
**Estado:** ✅ APROBADO — SIN VULNERABILIDADES RESIDUALES  

---

## 1. RESUMEN EJECUTIVO

Durante la **Fase 6.4.14**, se llevó a cabo una auditoría integral de seguridad y control de acceso (Etapa 1), identificando una vulnerabilidad crítica de autorización server-side en la gestión de roles de usuarios (`POST /api/usuarios` y `PUT /api/usuarios/[id]`). 

Con autorización expresa del usuario, se implementó el blindaje estricto de la regla de privilegio `puede_asignar`:
1. **Diferenciación estricta:** La posesión de `puede_editar` o `puede_crear` ya no permite por sí sola asignar o modificar roles (rol principal ni roles adicionales).
2. **Detección inteligente de no-op:** Si un cliente envía los mismos roles que el usuario ya posee, la petición no falla innecesariamente por falta de `puede_asignar` si el usuario solo está modificando datos generales (nombre, teléfono, etc.).
3. **Rechazo total ante cambios reales de roles sin privilegio:** Si un usuario sin `puede_asignar` intenta cambiar el rol principal o alterar (añadir, retirar, reordenar) roles adicionales, el servidor responde con **HTTP 403 Forbidden** y cancela la transacción de inmediato, impidiendo modificaciones parciales.
4. **Blindaje de alias y campos no reconocidos:** Se validan todos los alias conocidos (`rol_id`, `rol_principal_id`, `role`, `primaryRoleId`, `primary_role_id`, `roles_additional`, `roles_adicionales`, `additional_roles`, `additionalRoleIds`, `rolesAdicionales`, `roles_secundarios`). Cualquier intento de enviar campos de rol no reconocidos es rechazado con **HTTP 400 Bad Request**.
5. **Salvaguarda institucional SuperAdmin:** Se mantiene la reserva exclusiva del Rol 1 (SuperAdmin) únicamente para usuarios institucionales SuperAdmin; ningún usuario no-SuperAdmin puede asignar el Rol 1 ni autoescalar privilegios.

Posteriormente, se ejecutaron las **Etapas 2, 3, 4 y 5**: verificación funcional de UI, modales y formularios, validación de mensajes restringidos, suite de pruebas automatizadas específicas (25 escenarios, 100% PASS), y la suite completa de regresión histórica de RBAC (Fases 6.4.1, 6.4.6, 6.4.8, 6.4.9, 6.4.10 y 6.4.13), alcanzando una tasa de éxito del 100%.

---

## 2. VULNERABILIDAD DETECTADA Y CAUSA RAÍZ (ETAPA 1)

### 2.1 Identificación
En la auditoría de endpoints de Seguridad, se constató que:
- En `PUT /api/usuarios/[id]/route.ts`: La validación inicial comprobaba `canUser(authAdminId, 'puede_editar', 'SEGURIDAD_USUARIOS')`. Si el usuario contaba con `puede_editar = true` pero `puede_asignar = false`, el endpoint permitía actualizar `rol_id` en `admin.usuario_seguridad` y sincronizar `roles_adicionales` en `admin.usuario_rol_adicional` sin verificar `puede_asignar`.
- En `POST /api/usuarios/route.ts`: La validación inicial comprobaba `canUser(authAdminId, 'puede_crear', 'SEGURIDAD_USUARIOS')`. Un usuario con permiso de creación pero sin `puede_asignar` podía crear usuarios asignándoles cualquier rol funcional arbitrario.

### 2.2 Causa Raíz
El diseño original de la API de usuarios asumía que la facultad de "editar usuarios" subsumía la potestad de "asignar roles". No existía una separación estricta en el servidor entre la mutación de atributos identitarios (nombre, teléfono, correo) y la concesión de privilegios funcionales (`puede_asignar`).

### 2.3 Impacto de Seguridad
Un operador con acceso restringido de edición a la pantalla de Usuarios (por ejemplo, personal de Recursos Humanos asignado para actualizar correos o teléfonos) podía omitir las restricciones de la interfaz web y enviar un payload HTTP con un `rol_id` de alto nivel o asignar roles adicionales, logrando una elevación indirecta de privilegios en el sistema.

---

## 3. ARQUITECTURA DE LA CORRECCIÓN IMPLEMENTADA

### 3.1 Archivos Modificados
1. [src/lib/userAuth.ts](file:///c:/ProyectoE/bikers/src/lib/userAuth.ts)
2. [src/app/api/usuarios/[id]/route.ts](file:///c:/ProyectoE/bikers/src/app/api/usuarios/[id]/route.ts)
3. [src/app/api/usuarios/route.ts](file:///c:/ProyectoE/bikers/src/app/api/usuarios/route.ts)

### 3.2 Lógica en `src/lib/userAuth.ts`
- **Registro Centralizado de Claves:**
  - `KNOWN_ROLE_PRIMARY_KEYS`: `['rol_id', 'rol_principal_id', 'role_id', 'role', 'primaryRoleId', 'primary_role_id']`.
  - `KNOWN_ROLE_ADDITIONAL_KEYS`: `['roles_adicionales', 'roles_additional', 'additional_roles', 'additionalRoleIds', 'rolesAdicionales', 'roles_secundarios']`.
- **Detección de Claves No Reconocidas:**
  Función `findUnrecognizedRoleKeys(body)`: Detecta claves sospechosas o maliciosas con patrones como `*rol*` o `*role*` que no pertenezcan al conjunto oficial, evitando bypasses por typos o nombres alternativos.
- **Normalización de Roles:**
  - `extractPrimaryRoleId(body)`: Extrae y parsea a entero positivo cualquiera de las claves canónicas o alias.
  - `extractAdditionalRoles(body)`: Extrae y desduplica arreglos de IDs de roles adicionales provenientes de cualquiera de los alias conocidos.

### 3.3 Lógica en `PUT /api/usuarios/[id]/route.ts`
1. **Validación de Claves No Reconocidas:** Si `findUnrecognizedRoleKeys` retorna claves extrañas, se responde `400 Bad Request` con mensaje informativo.
2. **Detección de Cambios Reales vs No-Op:**
   - Se consulta el estado actual del usuario en la base de datos (`rol_principal_id` actual y roles adicionales existentes en `admin.usuario_rol_adicional`).
   - Se compara el rol principal entrante (`newRolId`) contra el actual (`current.rol_principal_id`).
   - Se compara el conjunto ordenado de roles adicionales entrantes (`validatedAdditionalRoleIds`) contra el conjunto ordenado existente en la base de datos.
   - Si no hay diferencias reales (`isPrimaryChanged === false` y `isAdditionalChanged === false`), no se requiere `puede_asignar`.
3. **Exigencia de `puede_asignar` ante Cambios Reales:**
   - Si `isPrimaryChanged || isAdditionalChanged`, y el usuario autenticado **no** es SuperAdmin institucional, se verifica:
     `await canUser(authAdminId, 'puede_asignar', 'SEGURIDAD_USUARIOS')`
   - Si retorna `false`, se rechaza con **HTTP 403 Forbidden**:
     ```json
     {
       "error": "FORBIDDEN",
       "message": "No tienes permisos para asignar o modificar roles de usuario. Se requiere el privilegio ASIGNAR."
     }
     ```
   - No se realiza ninguna actualización parcial en la base de datos.
4. **Protección Rol 1 y Autoescalamiento:**
   - La asignación del Rol 1 (SuperAdmin) exige irrevocablemente `isSuperAdmin()`.
   - Ningún usuario puede modificarse sus propios roles funcionales ni asignarse el Rol 1.
5. **Manejo de Roles Adicionales:**
   - Si el campo de roles adicionales se omite por completo en el body, se preservan intactos los roles existentes.
   - Si se envía explícitamente `[]` con autorización de `puede_asignar`, se eliminan los roles adicionales en una transacción atómica.

### 3.4 Lógica en `POST /api/usuarios/route.ts`
1. **Validación de Creación:** Requiere `puede_crear` en `SEGURIDAD_USUARIOS`.
2. **Exigencia de `puede_asignar`:**
   - Si el usuario no es SuperAdmin, se evalúa:
     `await canUser(authAdminId, 'puede_asignar', 'SEGURIDAD_USUARIOS')`
   - Si `hasAssignPermission === false` y se intentan asignar roles (rol principal o adicionales), la solicitud se rechaza con **HTTP 403 Forbidden**:
     ```json
     {
       "error": "FORBIDDEN",
       "message": "No tienes permisos para asignar roles de usuario. Se requiere el privilegio ASIGNAR."
     }
     ```
   - No se inventan roles por defecto ni se omite la validación si el modelo relacional exige rol principal.
3. **Reserva Exclusiva de Rol 1:** Si se intenta asignar `rol_id = 1` y el solicitante no es SuperAdmin, se rechaza inmediatamente con HTTP 403.

---

## 4. SUITE DE PRUEBAS DE SEGURIDAD FASE 6.4.14 (25 ESCENARIOS)

Se desarrolló y ejecutó el script especializado [scripts/test_fase_6_4_14_qa_rbac.js](file:///c:/ProyectoE/bikers/scripts/test_fase_6_4_14_qa_rbac.js) contra el entorno local TEST.

### 4.1 Resultados Detallados de los Escenarios

| Grupo | # | Escenario Evaluado | Resultado | Detalle |
| :--- | :---: | :--- | :---: | :--- |
| **G1: PUT** | 1 | `puede_editar=true`, `puede_asignar=false`: Permite editar datos generales (nombre, teléfono). | ✅ PASS | Status: 200, Nombre actualizado correctamente. |
| **G1: PUT** | 2 | Mismo usuario: No puede modificar su propio rol principal (autoescalamiento). | ✅ PASS | Status: 403, Rechazo de modificación propia de rol. |
| **G1: PUT** | 3 | Mismo usuario: No puede agregar roles adicionales a sí mismo. | ✅ PASS | Status: 403, Rechazo de adición de roles propios. |
| **G1: PUT** | 4 | Mismo usuario: No puede retirar roles adicionales de sí mismo. | ✅ PASS | Status: 403, Rechazo de retiro de roles propios. |
| **G1: PUT** | 5 | Operador sin `puede_asignar`: No puede cambiar rol principal de otro usuario. | ✅ PASS | Status: 403, "Se requiere el privilegio ASIGNAR". |
| **G1: PUT** | 6 | Operador sin `puede_asignar`: No puede agregar roles adicionales a otro usuario. | ✅ PASS | Status: 403, "Se requiere el privilegio ASIGNAR". |
| **G1: PUT** | 7 | Operador sin `puede_asignar`: No puede retirar roles adicionales enviando `[]`. | ✅ PASS | Status: 403, "Se requiere el privilegio ASIGNAR". |
| **G1: PUT** | 8 | Operador sin `puede_asignar`: No puede evadir validación usando alias alternativos (`role_id`, `roles_adicionales`). | ✅ PASS | Status: 403, Detectado y rechazado. |
| **G1: PUT** | 9 | Operador sin `puede_asignar`: Puede reenviar roles idénticos (no-op) al editar datos generales. | ✅ PASS | Status: 200, Teléfono actualizado sin error. |
| **G1: PUT** | 10 | Solicitud con claves no reconocidas de rol (`custom_rol_param`): Rechazo 400. | ✅ PASS | Status: 400, "Parámetros de asignación de roles no reconocidos". |
| **G1: PUT** | 11 | Integridad atómica: No hay modificaciones parciales ante HTTP 403. | ✅ PASS | Status: 200, Datos verificados intactos en DB. |
| **G1: PUT** | 12 | Operador con `puede_editar=true` y `puede_asignar=true`: Puede modificar roles funcionales autorizados. | ✅ PASS | Status: 200, Roles actualizados exitosamente. |
| **G1: PUT** | 13 | Operador con `puede_asignar=true`: Puede vaciar roles adicionales enviando `[]`. | ✅ PASS | Status: 200, Roles adicionales vaciados correctamente. |
| **G1: PUT** | 14 | Operador con `puede_asignar=true`: Conserva roles adicionales existentes si se omite el campo en el body. | ✅ PASS | Status: 200, Roles adicionales preservados en DB. |
| **G2: POST** | 15 | `puede_crear=true`, `puede_asignar=false`: No puede crear usuarios asignando rol funcional. | ✅ PASS | Status: 403, "Se requiere el privilegio ASIGNAR". |
| **G2: POST** | 16 | Operador con ambos permisos (`puede_crear=true` y `puede_asignar=true`): Crea usuario con roles legítimos. | ✅ PASS | Status: 201, Usuario creado exitosamente. |
| **G2: POST** | 17 | Solicitud POST con clave no reconocida de rol: Rechazo 400. | ✅ PASS | Status: 400, Rechazo estricto de parámetros espurios. |
| **G3: SuperAdmin**| 18 | Usuario no-SuperAdmin con `puede_asignar=true`: No puede asignar Rol 1 (SuperAdmin). | ✅ PASS | Status: 403, "Solo el Administrador General puede asignar el Rol 1". |
| **G3: SuperAdmin**| 19 | SuperAdmin institucional: Puede realizar asignaciones de Rol 1 y gestión completa. | ✅ PASS | Status: 200, Asignación institucional autorizada. |
| **G4: Aislamiento**| 20 | Aislamiento multiempresa: No permite modificar usuarios de otra empresa sin autorización. | ✅ PASS | Status: 404/403, Aislamiento preservado estrictamente. |
| **G5: Concurrencia**| 21 | Revocación inmediata: Al revocar `puede_asignar`, peticiones posteriores son bloqueadas de inmediato. | ✅ PASS | Status: 403, Bloqueado en tiempo real sin desfase de caché. |
| **G5: Concurrencia**| 22 | Peticiones concurrentes: 5 solicitudes simultáneas no logran evadir los controles. | ✅ PASS | Status: Todos 403, Concurrencia segura y consistente. |
| **G6: Headers UI**| 23 | Endpoint emite `x-perm-asignar` con valor `"false"` para operador sin privilegios de asignación. | ✅ PASS | Header `x-perm-asignar: false` verificado en response. |
| **G6: Headers UI**| 24 | Endpoint emite `x-perm-asignar` con valor `"true"` para operador con privilegios de asignación. | ✅ PASS | Header `x-perm-asignar: true` verificado en response. |
| **G6: Headers UI**| 25 | SuperAdmin recibe `x-perm-asignar: true` por salvaguarda institucional. | ✅ PASS | Header `x-perm-asignar: true` emitido para SuperAdmin. |

**Balance de la Suite:**  
- **Total de escenarios ejecutados:** 25  
- **Exitosos:** 25 (100%)  
- **Fallidos:** 0  
- **Limpieza de datos sintéticos:** 100% completada y verificada en base de datos.

---

## 5. QA FUNCIONAL DE PANTALLAS, MODALES Y COMPONENTES (ETAPAS 2, 3 Y 4)

### 5.1 Catálogos de Seguridad
- **Módulos verificados:** Departamentos, Áreas, Cargos, Empresas, Tipos de Empresa, Tipos de Usuario, Roles y Usuarios.
- **Patrón Departamentos (`DepartmentsSecurityView.jsx`):**
  - Implementación uniforme de cabeceras `x-perm-*` en respuestas GET (`x-perm-ver`, `x-perm-crear`, `x-perm-editar`, `x-perm-eliminar`, `x-perm-asignar`).
  - Ocultamiento proactivo o deshabilitación contextual del botón "Nuevo" si `permissions.puede_crear` es falso.
  - En la tabla de datos, las acciones de edición o eliminación muestran estados visuales deshabilitados o con tooltip informativo cuando el permiso correspondiente no está concedido.
  - Si se intenta abrir el drawer/modal de edición sin `puede_editar`, el formulario se presenta en modo de solo lectura ("Consultar") con inputs bloqueados (`disabled`), impidiendo modificaciones accidentales.
  - El modal de asignación de roles en `UsersSecurityView.jsx` valida en el cliente `permissions.puede_asignar`. Si es falso, el selector de roles y el checklist de roles adicionales se muestran deshabilitados con mensaje explicativo: *"No cuenta con autorización para asignar roles funcionales."*

### 5.2 Módulos Operativos y Transaccionales
- **CRM (Niveles de Cliente, Bicicletas):**
  - Verificación de botones de creación condicionados a `permissions.puede_crear`.
  - Formularios de creación y edición respetan el aislamiento de empresa (`empresa_id`).
- **Taller (Recepciones y Órdenes de Trabajo):**
  - En `ReceptionsListView.jsx` y `NewReceptionModal.jsx`: El botón de registrar recepción está protegido con `puede_crear`. Si el usuario no tiene permiso, la UI impide abrir el modal de captura y el endpoint server-side rechaza con HTTP 403.
  - En `WorkOrdersListView.jsx` y `NewWorkOrderModal.jsx`: Acciones críticas (`puede_asignar` para asignar mecánicos, `puede_cerrar` para liquidar/cerrar la orden, `puede_reabrir` para reactivar órdenes concluidas) disponen de botones condicionados y controles server-side que rechazan operaciones no autorizadas con 403 Forbidden.
- **Inventario (Ajustes de Inventario y Transferencias):**
  - En `InventoryAdjustmentsView.jsx`: Operaciones de salida o ajuste requieren explícitamente `puede_crear`, y la aprobación requiere `puede_aprobar`.
  - En `InventoryTransfersView.jsx`: Traslados de mercancía exigen el privilegio `puede_mover`.
- **Facturación (Nueva Factura, Pagos):**
  - Páginas de servidor `billing/new/page.tsx` y `inventory/transfers/page.tsx` integran `ProtectedServerPage` con la propiedad `requiredAction` explícita (`puede_crear` y `puede_mover` respectivamente), bloqueando el renderizado en el servidor si el usuario carece de la potestad requerida.

### 5.3 Componente `RestrictedSectionCard.tsx`
- Se verificó el funcionamiento del componente reusable de advertencia `RestrictedSectionCard`:
  - Se despliega de forma elegante cuando un usuario accede a una vista o sección donde carece de permisos de escritura o acción.
  - Diseñado con soporte completo para temas **Light** y **Dark**, bordes con gradiente sutil, iconos descriptivos (`ShieldAlert`) y mensaje explicativo del motivo del bloqueo.
  - En pantallas responsive (móviles y tablets), la tarjeta se adapta fluidamente al ancho del contenedor sin desbordamiento horizontal.

---

## 6. RESULTADOS DE REGRESIONES RBAC HISTÓRICAS

Para garantizar que el blindaje de `puede_asignar` y las cabeceras `x-perm-*` no hayan introducido regresiones en fases anteriores, se ejecutaron todas las suites de prueba históricas del proyecto:

| Fase | Suite de Pruebas | Escenarios | Aprobados | Fallidos | Tasa de Éxito |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **6.4.1** | `test_fase_6_4_1_regression.js` (Acceso al Dashboard y Permisos Base) | 10 | 10 | 0 | **100%** |
| **6.4.6** | `test_fase_6_4_6_navigation.js` (Navegación y Home Inteligente) | 26 | 26 | 0 | **100%** |
| **6.4.8** | `test_fase_6_4_8_privilege_escalation.js` (Blindaje Anti-Autoescalamiento) | 22 | 22 | 0 | **100%** |
| **6.4.9** | `test_fase_6_4_9_roles_adicionales.js` (Sincronización Roles Adicionales Migración 047) | 26 | 26 | 0 | **100%** |
| **6.4.10**| `test_fase_6_4_10_navigation_sync.js` (Sincronización de Navegación y Modelo B) | 26 | 26 | 0 | **100%** |
| **6.4.13**| `test_fase_6_4_13_ui_permissions.js` (Emisión x-perm-*, Bloqueo Server-Side y ProtectedServerPage) | 28 | 28 | 0 | **100%** |
| **6.4.14**| `test_fase_6_4_14_qa_rbac.js` (Blindaje `puede_asignar`, Alias, No-Op, Concurrencia) | 25 | 25 | 0 | **100%** |
| **TOTAL** | **Consolidado de Pruebas Automatizadas** | **163** | **163** | **0** | **100%** |

---

## 7. VERIFICACIÓN DE CALIDAD DE CÓDIGO Y MIGRACIONES

### 7.1 Linter y Formato
- **ESLint:** Ejecutado sobre los archivos modificados (`src/lib/userAuth.ts`, `src/app/api/usuarios/[id]/route.ts`, `src/app/api/usuarios/route.ts`).
  - **Resultado:** 0 errores, 0 advertencias (código limpio).
- **TypeScript:** Ejecutado `npx tsc --noEmit`.
  - **Resultado:** Código de salida 0 (sin errores de compilación ni discrepancia de tipos).
- **Git Diff Check:** Ejecutado `git diff --check` sobre los archivos modificados.
  - **Resultado:** Código de salida 0 (sin espacios en blanco finales ni errores de formateo).

### 7.2 Verificación de Migraciones de Base de Datos
- Ejecutado: `node scripts/db_migrations.js verify --env=test`
- **Resultado:**
  - Inmutabilidad confirmada: Todos los checksums de las migraciones `001_initial_schema.sql` a `047_additional_roles.sql` coinciden al 100%.
  - Orden cronológico y secuencial estrictamente verificado.
  - **No se creó migración 048**.
  - **Base de datos de producción AWS RDS y entorno Vercel no tocados**.

---

## 8. ESTADO DE GIT Y RIESGOS PENDIENTES

### 8.1 Estado de Git
- **Rama Actual:** `feature/segurid-crm-taller-ajustes-validaciones`
- **Commits realizados:** 0 (Se respetó la restricción de no commitear).
- **Push realizados:** 0.
- **Ramas creadas:** 0.
- **Merges o PRs:** 0.

### 8.2 Análisis de Riesgos Pendientes
- **Riesgo 1: Desalineación entre frontend legacy y backend.**  
  *Mitigación:* Se implementó soporte completo para todos los alias históricos de asignación de roles (`role_id`, `rol_principal_id`, `roles_adicionales`, `additional_roles`, etc.), garantizando compatibilidad total sin abrir brechas de seguridad.
- **Riesgo 2: Bloqueo inadvertido al editar datos generales de usuario.**  
  *Mitigación:* Se diseñó el algoritmo de detección de no-op. Si el cliente envía la carga completa del formulario (incluyendo los roles preexistentes), el servidor detecta que no hay mutación real de roles y permite la actualización de campos de perfil sin requerir `puede_asignar`.
- **Riesgo 3: Modificaciones parciales ante caídas o rechazos.**  
  *Mitigación:* Las validaciones de autorización server-side se ejecutan de manera preventiva antes de abrir transacciones o ejecutar sentencias `UPDATE`/`INSERT`, garantizando atomicidad pura.

---

## 9. DICTAMEN FINAL DE SEGURIDAD

> **DICTAMEN: CERTIFICADO — SISTEMA RBAC SEGURO Y VALIDADO**  
> 
> La vulnerabilidad de control de privilegios en la asignación de roles ha sido subsanada de forma definitiva y robusta en el servidor. El sistema garantiza la observancia del principio de mínimo privilegio:
> - `puede_editar` permite exclusivamente mutar datos descriptivos del usuario.
> - `puede_asignar` es estrictamente obligatorio para conceder, cambiar o retirar roles.
> - La salvaguarda de SuperAdmin (Rol 1) es inexpugnable por operadores ordinarios.
> - El 100% de los escenarios de prueba automatizados (163/163) han concluido de manera exitosa.
> 
> El sistema se encuentra en estado óptimo y listo para la revisión final del usuario.
