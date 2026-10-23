/**
 * SERVIDOR DE DESARROLLO EN AMBIENTE DE PRUEBAS LOCAL (POSTGRESQL 18)
 * Archivo: scripts/start_test_server.js
 * Proyecto: Ride Lab — Bikers' Fort Core
 *
 * Comando: npm run dev:test
 *
 * Flujo:
 * 1. Carga explícitamente .env.test.local con máxima precedencia.
 * 2. Ejecuta validación estricta de seguridad contra la BD PostgreSQL 18 local (127.0.0.1:5432).
 * 3. Aborta de inmediato si detecta AWS RDS, PgBouncer productivo o cualquier host no local.
 * 4. Fija APP_ENV=test y bloquea el intento de sobreescritura por .env.local.
 * 5. Inicia el servidor Next.js dev con las variables de prueba inyectadas en process.env.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateLocalDatabase } = require('./validate_local_db');

// Cargar explícitamente variables desde .env.test.local
function loadTestEnvironment() {
  const envPath = path.resolve(process.cwd(), '.env.test.local');
  if (!fs.existsSync(envPath)) {
    console.error('\n[ERROR CRÍTICO] No se encontró el archivo .env.test.local.');
    console.error('Copie .env.test.example a .env.test.local y configure la contraseña local.\n');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Fijar en process.env para que tenga máxima prioridad
      process.env[key] = val;
    }
  }

  // Eliminar variables alternativas que pudieran sobrescribir o desviar la conexión
  const dangerousVars = [
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'DATABASE_URL_UNPOOLED',
    'PGHOST',
    'PGPORT',
    'PGDATABASE'
  ];
  for (const v of dangerousVars) {
    delete process.env[v];
  }

  // Garantizar flags de entorno de pruebas inmutables
  process.env.APP_ENV = 'test';
  process.env.DISABLE_EXTERNAL_SERVICES = 'true';
  process.env.DISABLE_SMS_GATEWAY = 'true';
  process.env.DISABLE_SES_EMAIL = 'true';
  process.env.DISABLE_S3_STORAGE = 'true';
  process.env.ENABLE_SMS = 'false';
  process.env.ENABLE_EMAIL = 'false';
}

async function main() {
  console.log('\n======================================================================');
  console.log('--- INICIANDO SERVIDOR EN AMBIENTE LOCAL DE PRUEBAS (DEV:TEST) ---');
  console.log('======================================================================\n');

  loadTestEnvironment();

  // Pre-flight check: Validar PostgreSQL 18 local
  console.log('[FASE 1] Ejecutando validación pre-flight de PostgreSQL 18 local...');
  try {
    await validateLocalDatabase();
  } catch (err) {
    console.error('[BLOQUEO] Falló la validación previa de la base de datos local:', err.message);
    process.exit(1);
  }

  console.log('[FASE 2] Iniciando Next.js en entorno local aislado...');
  console.log('   - Host BD: 127.0.0.1:5432');
  console.log('   - Base de Datos: bikers_dbtest');
  console.log('   - APP_ENV: test');
  console.log('   - SMS & Email: DESACTIVADOS (Simulados)');
  console.log('   - AWS S3: AISLADO (Mock / Protegido)');
  console.log('======================================================================\n');

  const isWindows = process.platform === 'win32';
  const nextCmd = isWindows ? 'npx.cmd' : 'npx';

  const child = spawn(nextCmd, ['next', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      APP_ENV: 'test',
      DISABLE_EXTERNAL_SERVICES: 'true',
      ENABLE_SMS: 'false',
      ENABLE_EMAIL: 'false'
    }
  });

  child.on('error', (err) => {
    console.error('Error al iniciar Next.js:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

main();
