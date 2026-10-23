# RIDE LAB — GUÍA DEL AMBIENTE LOCAL DE PRUEBAS POSTGRESQL 18

**Proyecto:** Ride Lab — Bikers' Fort Core  
**Fase:** 6.3 — Implementación del Ambiente Local de Pruebas  
**Versión de PostgreSQL Local:** 18.6 (Windows x64)

---

## 1. Arquitectura: Producción vs. Pruebas

| Componente | Ambiente de Producción (AWS) | Ambiente de Pruebas Local (Fase 6.3) |
| :--- | :--- | :--- |
| **Base de Datos** | AWS RDS PostgreSQL + PgBouncer | PostgreSQL 18.6 nativo en Windows (`127.0.0.1:5432`) |
| **Nombre BD** | `bikers_db` (o instancia RDS designada) | `bikers_dbtest` |
| **Esquema** | `admin` | `admin` (copia restaurada de producción) |
| **Usuario BD** | Usuario de producción / RDS | `bikers_test` |
| **Mensajería SMS** | TextBee SMS Gateway (API HTTP real) | Mock local interceptado (`textBeeSmsService.ts`) |
| **Correo Electrónico** | AWS Simple Email Service (SES) | Mock local interceptado (`email.ts`) |
| **Almacenamiento Media** | AWS S3 Buckets (`bikers-core-...`) | Mock local interceptado (`/api/mock-storage/*`) |
| **Servidor Web** | Vercel / Next.js producción | Next.js en servidor local (`npm run dev:test`) |

---

## 2. Configuración de PostgreSQL 18 Local

- **Servicio de Windows:** `postgresql-x64-18`
- **Ruta de Binarios:** `C:\Program Files\PostgreSQL\18\bin`
- **Ruta del Data Directory:** `C:\app\postgresql\18\data`
- **Host:** `127.0.0.1` (o `localhost`)
- **Puerto:** `5432`
- **Base de Datos:** `bikers_dbtest`
- **Esquema:** `admin` (89 tablas y 32 secuencias verificadas)
- **Usuario:** `bikers_test`
- **Empresas Restauradas:**
  - Empresa ID 1: `RIDE LAB TEST`
  - Empresa ID 2: `Taller SD TEST`

---

## 3. Archivos de Entorno y Precedencia

### A. Archivos Disponibles
1. **`.env.local`** (Privado, ignorado en Git):
   - Contiene la configuración habitual de desarrollo conectada a los servicios remotos.
   - **NUNCA** es modificado ni sobrescrito por los comandos de prueba.
2. **`.env.test.example`** (Público, versionado en Git):
   - Plantilla documentada con variables seguras y sin contraseñas ni secretos reales.
3. **`.env.test.local`** (Privado, estrictamente ignorado en `.gitignore`):
   - Contiene la configuración específica de pruebas:
     ```env
     APP_ENV=test
     NODE_ENV=development
     DATABASE_URL=postgresql://bikers_test:[PASSWORD]@127.0.0.1:5432/bikers_dbtest
     DB_SCHEMA=admin
     DISABLE_EXTERNAL_INTEGRATIONS=true
     DISABLE_SMS_GATEWAY=true
     DISABLE_SES_EMAIL=true
     DISABLE_S3_STORAGE=true
     ```

### B. Control de Precedencia
Al ejecutar `npm run dev:test`:
- El cargador `scripts/start_test_server.js` lee `.env.test.local` y asigna explícitamente cada valor a `process.env`.
- Las variables en `process.env` tienen prioridad absoluta sobre los archivos `.env` y `.env.local` que Next.js lee automáticamente, impidiendo que la configuración de producción sobrescriba el entorno de prueba.

---

## 4. Comando `npm run dev:test` y Validaciones Pre-Flight

Para iniciar la aplicación en el ambiente de pruebas local aislado:

```bash
npm run dev:test
```

### Validaciones Automáticas antes de Iniciar:
El script `scripts/start_test_server.js` ejecuta un ciclo de validación exhaustivo antes de invocar `next dev`:
1. **Verificación de Host Local:** Comprueba que el host sea estrictamente `127.0.0.1` o `localhost` y que el puerto sea `5432`.
2. **Detección Anti-AWS / Anti-PgBouncer:** Si el hostname contiene `rds.amazonaws.com`, `.rds.`, o el puerto es `6432` (PgBouncer), el proceso se **ABORTA INMEDIATAMENTE**.
3. **Verificación de Base de Datos:** Comprueba mediante `SELECT current_database()` que la conexión activa sea efectivamente `bikers_dbtest`.
4. **Verificación de Versión:** Comprueba que el motor sea PostgreSQL 18.x.
5. **Verificación de Esquema:** Confirma la existencia de las tablas del esquema `admin`.
6. **Guardia en Runtime (`src/lib/db.ts`):** Si en cualquier momento el pool se recrea y `APP_ENV === "test"`, una aserción interna bloquea cualquier cadena de conexión que no coincida con `127.0.0.1:5432/bikers_dbtest`.

---

## 5. Bloqueo de Integraciones Externas

Durante el modo de prueba (`APP_ENV=test` / `DISABLE_EXTERNAL_INTEGRATIONS=true`), el código neutraliza cualquier salida externa:

### A. SMS (TextBee)
- **Archivo:** `src/lib/notifications/textBeeSmsService.ts`
- **Comportamiento en Test:** Las funciones `sendSms` y `getDeliveryStatus` interceptan el llamado, imprimen un log `[MOCK SMS]` en la consola del servidor y devuelven un identificador ficticio con estado de entrega simulado exitoso (`sent`). No se realiza ninguna petición HTTP hacia los servidores de TextBee.

### B. Correo Electrónico (AWS SES)
- **Archivo:** `src/lib/email.ts`
- **Comportamiento en Test:** El cliente SES es reemplazado por un objeto mock que intercepta `SendEmailCommand` y `SendRawEmailCommand`. El mensaje es registrado localmente en consola con el prefijo `[MOCK EMAIL]` y se simula un `MessageId` sin tocar AWS SES.

### C. Almacenamiento de Archivos (AWS S3)
- **Archivo:** `src/lib/storage/s3.ts`
- **Endpoints Locales:** `/api/mock-storage/upload` y `/api/mock-storage/download`
- **Comportamiento en Test:**
  - `getPresignedUploadUrl`: Genera una URL que apunta al endpoint local de subida simulada.
  - `getPresignedDownloadUrl`: Genera una URL apuntando al endpoint local de descarga simulada.
  - `deleteS3Object`: Intercepta la orden y confirma eliminación simulada sin tocar ningún bucket real de AWS.
  - `checkS3ObjectExists` y `verifyS3ObjectMetadata`: Retornan confirmación afirmativa simulada.

---

## 6. Protección de Datos Restaurados

La base `bikers_dbtest` contiene una copia de producción restaurada. Para garantizar la seguridad operativa:

1. **Sesiones Copiadas:** Se detectaron 36 sesiones activas que pertenecían a usuarios de producción.
2. **Script de Sanitización:** Se ha preparado el script:
   `scripts/sanitize_local_test_db.sql`
   - Invalida todas las sesiones heredadas (`estado = 'INACTIVA'`).
   - Anonimiza números telefónicos y correos de clientes si se requiere para pruebas.
   - Contiene una guarda que verifica `current_database() = 'bikers_dbtest'` y por defecto termina en `ROLLBACK;` para requerir confirmación explícita del operador antes de persistir cambios.

---

## 7. Flujo de Trabajo: Detener Pruebas y Volver a Producción

### Para Detener el Ambiente de Pruebas:
Presione `Ctrl + C` en la terminal donde se esté ejecutando `npm run dev:test`.

### Para Regresar al Ambiente Normal de Desarrollo:
Ejecute el comando estándar:
```bash
npm run dev
```
Este comando continuará utilizando `.env.local` tal como estaba configurado originalmente.

---

## 8. Seguridad y Exclusión de Archivos en Git

- El archivo `.gitignore` ha sido configurado para:
  - Ignorar `*.local` (incluye `.env.test.local` y `.env.local`).
  - Permitir explícitamente `!.env.test.example` para que sirva de referencia al equipo.
- No se han almacenado contraseñas ni cadenas de conexión en el repositorio Git.
