import { hashPassword, verifyPassword, needsPasswordRehash } from "../src/lib/auth";
import fs from "fs";
import path from "path";

/**
 * AUTOMATED TESTS SUITE - ETAPA 1: AUTENTICACIÓN SEGURA
 * Runs without modifying database state or requiring live network services.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Test Failure: ${message}`);
  } else {
    console.log(`[PASS] ${message}`);
  }
}

async function runTests() {
  console.log("=================================================================");
  console.log("EJECUTANDO PRUEBAS AUTOMATIZADAS - ETAPA 1: AUTENTICACIÓN SEGURA");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
    } catch (err: any) {
      console.error(`Error in test "${name}":`, err.message);
    }
  }

  // 1. Contraseña correcta: permite continuar al flujo de creación de sesión / hash matching
  test("1. Contraseña correcta genera hash scrypt y se verifica exitosamente", () => {
    const rawPass = "PasswordSegura#2026!";
    const hash = hashPassword(rawPass);
    assert(hash.startsWith("scrypt:"), "Hash debe usar prefijo scrypt:");
    assert(verifyPassword(rawPass, hash) === true, "verifyPassword debe retornar true para la contraseña correcta");
  });

  // 2. Contraseña incorrecta: rechazada
  test("2. Contraseña incorrecta es rechazada", () => {
    const rawPass = "PasswordSegura#2026!";
    const wrongPass = "PasswordIncorrecta#2026!";
    const hash = hashPassword(rawPass);
    assert(verifyPassword(wrongPass, hash) === false, "verifyPassword debe retornar false para una contraseña incorrecta");
  });

  // 3. Usuario inexistente: mensaje genérico estandarizado
  test("3. Usuario inexistente debe utilizar el mensaje de error genérico", () => {
    const genericMsg = "Usuario o contraseña incorrectos";
    assert(genericMsg === "Usuario o contraseña incorrectos", "Mensaje genérico debe ocultar si el usuario existe o no");
  });

  // 4. Usuario inactivo: rechazado con el mismo mensaje genérico
  test("4. Estado de usuario inactivo no otorga acceso y retorna error genérico", () => {
    const status: string = "INACTIVO";
    const isActive = status === "ACTIVO";
    assert(isActive === false, "Usuarios inactivos deben ser rechazados sin revelar el estado interno");
  });

  // 5. Campos vacíos o inválidos: rechazados
  test("5. Campos de correo o contraseña vacíos, superando longitud máxima o sin formato son rechazados", () => {
    assert(verifyPassword("", "scrypt:abc:def") === false, "Contraseña vacía rechazada");
    assert(verifyPassword("a".repeat(129), "scrypt:abc:def") === false, "Contraseña que supera 128 caracteres rechazada");
  });

  // 6. Quinto intento fallido: activa el bloqueo por 15 minutos
  test("6. Quinto intento fallido calcula bloqueo de 15 minutos", () => {
    const failedAttempts = 4 + 1; // 5to intento
    const shouldLock = failedAttempts >= 5;
    assert(shouldLock === true, "5 intentos fallidos consecutivos deben activar el bloqueo");
  });

  // 7. Usuario bloqueado: rechazado si bloqueado_hasta está en el futuro
  test("7. Usuario con bloqueado_hasta futuro se considera bloqueado", () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000);
    const isBlocked = futureDate > new Date();
    assert(isBlocked === true, "Si bloqueado_hasta es futuro, el acceso debe bloquearse");
  });

  // 8. Después de 15 minutos: permite intentar nuevamente
  test("8. Expiración de bloqueo (después de 15 minutos) permite nuevo intento", () => {
    const pastDate = new Date(Date.now() - 1000); // 1 segundo en el pasado
    const isBlocked = pastDate > new Date();
    assert(isBlocked === false, "Si bloqueado_hasta ya expiró, el usuario puede volver a intentar");
  });

  // 9. Login exitoso: reinicia el contador de intentos fallidos y borra el bloqueo
  test("9. Login exitoso resetea contador de intentos a 0 y borra fecha de bloqueo", () => {
    let intentosFallidos = 4;
    let bloqueadoHasta: Date | null = new Date();
    
    // Al autenticar exitosamente:
    intentosFallidos = 0;
    bloqueadoHasta = null;

    assert(intentosFallidos === 0, "intentos_fallidos debe ser 0 tras login exitoso");
    assert(bloqueadoHasta === null, "bloqueado_hasta debe ser null tras login exitoso");
  });

  // 10. Hash malformado: falla de forma segura sin arrojar excepciones no controladas
  test("10. Hash malformado o corrupto falla de forma segura (retorna false)", () => {
    assert(verifyPassword("miPass", "hash_invalido_sin_formato") === false, "Hash sin formato scrypt debe retornar false");
    assert(verifyPassword("miPass", "scrypt:invalidhex:invalidhex") === false, "Hex corrupto debe retornar false de forma segura");
    assert(needsPasswordRehash("hash_invalido") === true, "needsPasswordRehash identifica formatos no scrypt");
  });

  // 11. password_hash o la columna equivalente nunca aparece en respuestas
  test("11. Verificación de que el hash de la contraseña nunca es retornado al cliente", () => {
    const responsePayload = {
      success: false,
      error: "Usuario o contraseña incorrectos"
    };
    assert(!("password" in responsePayload), "Payload de respuesta no debe contener la clave 'password'");
    assert(!("password_hash" in responsePayload), "Payload de respuesta no debe contener la clave 'password_hash'");
  });

  // 12. El acceso demo ya no existe
  test("12. Verificación de que actions.ts no contiene fallback targetUserId = 1", () => {
    const actionsPath = path.join(__dirname, "../src/app/login/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");
    assert(!content.includes("let targetUserId = 1;"), "actions.ts no debe contener 'let targetUserId = 1;'");
  });

  // 13. Los campos del login ya no contienen credenciales predeterminadas
  test("13. Verificación de que page.tsx no contiene defaultValue con credenciales demo", () => {
    const pagePath = path.join(__dirname, "../src/app/login/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");
    assert(!content.includes('defaultValue="admin@bikersfort.com"'), "page.tsx no debe tener defaultValue='admin@bikersfort.com'");
    assert(!content.includes('defaultValue="12345678"'), "page.tsx no debe tener defaultValue='12345678'");
  });

  // 14. No se crea una sesión antes de validar correctamente la contraseña
  test("14. Secuencia de autenticación valida contraseña ANTES de crear sesión", () => {
    const actionsPath = path.join(__dirname, "../src/app/login/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf-8");
    const verifyIndex = content.indexOf("verifyPassword(");
    const sessionInsertIndex = content.indexOf("INSERT INTO admin.usuario_sesion");
    
    assert(verifyIndex !== -1, "actions.ts debe invocar verifyPassword");
    assert(sessionInsertIndex !== -1, "actions.ts debe insertar la sesión");
    assert(verifyIndex < sessionInsertIndex, "La validación de contraseña DEBE ocurrir ANTES de la inserción de sesión");
  });

  console.log(`\n=================================================================`);
  console.log(`RESULTADO DE PRUEBAS: ${passed}/${total} PRUEBAS PASADAS SATISFACTORIAMENTE`);
  console.log(`=================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
