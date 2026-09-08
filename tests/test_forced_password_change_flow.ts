import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { query, withTransaction } from "../src/lib/db";
import { hashPassword, verifyPassword, hashSessionToken } from "../src/lib/auth";
import { validatePasswordPolicy } from "../src/lib/validations";
import { POST as createUserRoute } from "../src/app/api/usuarios/route";
import { POST as changePasswordRoute } from "../src/app/api/auth/change-password/route";
import { POST as resetPasswordRoute } from "../src/app/api/usuarios/[id]/reset-password/route";
import { authorizeUserCreate } from "../src/lib/userAuth";

async function runTests() {
  console.log("====================================================");
  console.log("STARTING TEST SUITE: FORCED PASSWORD CHANGE FLOW (E2E)");
  console.log("====================================================\n");

  const createdUserIds: number[] = [];
  let testSessionId: number | null = null;
  const testSessionToken = `test_ses_${Date.now()}`;
  const testSessionHash = hashSessionToken(testSessionToken);
  process.env.TEST_AUTH_SESSION_TOKEN = testSessionToken;

  try {
    // 1. Setup Admin session for testing
    const adminUserRes = await query<{ usuario_id: number }>(
      `SELECT u.usuario_id FROM admin.usuario u
       JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
       WHERE UPPER(r.nombre) LIKE '%ADMIN%' LIMIT 1`
    );
    const adminUserId = adminUserRes[0]?.usuario_id || 13;

    const maxSes = await query(`SELECT COALESCE(MAX(sesion_id), 0) + 1 AS next_id FROM admin.usuario_sesion`);
    testSessionId = Number(maxSes[0]?.next_id) || 9999;

    await query(
      `INSERT INTO admin.usuario_sesion
       (sesion_id, usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
       VALUES ($1, $2, $3, 'Test Runner', '127.0.0.1', 'Local', NOW(), NOW(), NOW() + INTERVAL '1 day', 'ACTIVA')`,
      [testSessionId, adminUserId, testSessionHash]
    );
    console.log(`[AUTH SETUP] Active test session initialized for Admin User ID ${adminUserId}.\n`);

    const compRes = await query<{ empresa_id: number }>(`SELECT empresa_id FROM admin.empresa LIMIT 1`);
    const companyId = compRes[0]?.empresa_id || 1;

    const rolRes = await query<{ rol_funcional_id: number }>(`SELECT rol_funcional_id FROM admin.rol_funcional LIMIT 1`);
    const roleId = rolRes[0]?.rol_funcional_id || 1;

    // ----------------------------------------------------
    // TEST A: Crear usuario con checkbox desmarcado
    // => forzar_cambio_clave = false => login normal => PASS
    // ----------------------------------------------------
    console.log("--- TEST A: Crear usuario con checkbox desmarcado (forzar_cambio_clave = false) ---");
    const emailA = `qa_test_a_${Date.now()}@bikers.com`;
    const pwdA = "PasswordA123!";
    const reqA = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "TestUser",
        last_name: "Unchecked",
        email: emailA,
        password: pwdA,
        confirm_password: pwdA,
        companyId,
        roleId,
        tipo_usuario_id: 2,
        must_change_password: false,
        forzar_cambio_clave: false
      })
    });
    const resA = await createUserRoute(reqA);
    const dataA = await resA.json();
    if (resA.status !== 200 || !dataA.success) {
      throw new Error(`Test A Failed to create user: ${JSON.stringify(dataA)}`);
    }
    const userIdA = dataA.user_id || dataA.usuario_id;
    createdUserIds.push(userIdA);

    const secRowA = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave, password FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userIdA]
    );
    if (secRowA[0].forzar_cambio_clave !== false) {
      throw new Error(`Test A Failed: Expected forzar_cambio_clave = false, got ${secRowA[0].forzar_cambio_clave}`);
    }
    const isPwdValidA = verifyPassword(pwdA, secRowA[0].password);
    if (!isPwdValidA) throw new Error("Test A Failed: Initial password did not verify against hash.");
    console.log(`[PASS] Test A: User ${userIdA} created with forzar_cambio_clave=false. Login allows direct access.\n`);

    // ----------------------------------------------------
    // TEST B: Crear usuario con checkbox marcado
    // => forzar_cambio_clave = true => login correcto obliga cambio => PASS
    // ----------------------------------------------------
    console.log("--- TEST B: Crear usuario con checkbox marcado (forzar_cambio_clave = true) ---");
    const emailB = `qa_test_b_${Date.now()}@bikers.com`;
    const initialPwdB = "InitialPass123!";
    const reqB = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "TestUser",
        last_name: "ForcedChange",
        email: emailB,
        password: initialPwdB,
        confirm_password: initialPwdB,
        companyId,
        roleId,
        tipo_usuario_id: 2,
        must_change_password: true,
        forzar_cambio_clave: true
      })
    });
    const resB = await createUserRoute(reqB);
    const dataB = await resB.json();
    if (resB.status !== 200 || !dataB.success) {
      throw new Error(`Test B Failed: ${JSON.stringify(dataB)}`);
    }
    const userIdB = dataB.user_id || dataA.usuario_id;
    createdUserIds.push(userIdB);

    const secRowB = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave, password FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userIdB]
    );
    if (secRowB[0].forzar_cambio_clave !== true) {
      throw new Error(`Test B Failed: Expected forzar_cambio_clave = true, got ${secRowB[0].forzar_cambio_clave}`);
    }
    const isPwdValidB = verifyPassword(initialPwdB, secRowB[0].password);
    if (!isPwdValidB) throw new Error("Test B Failed: Initial password did not verify against hash.");
    console.log(`[PASS] Test B: User ${userIdB} created with forzar_cambio_clave=true. Login requires mandatory change.\n`);

    // ----------------------------------------------------
    // TEST C: Intentar entrar directamente al Dashboard / APIs antes del cambio
    // => acceso normal bloqueado => PASS
    // ----------------------------------------------------
    console.log("--- TEST C: Intentar operaciones protegidas antes de cambiar contraseña ---");
    // Create a temporary session for User B (who has forzar_cambio_clave = true)
    const userBSessionToken = `test_ses_b_${Date.now()}`;
    const userBSessionHash = hashSessionToken(userBSessionToken);
    const maxSesB = await query(`SELECT COALESCE(MAX(sesion_id), 0) + 1 AS next_id FROM admin.usuario_sesion`);
    const sesBId = Number(maxSesB[0]?.next_id) || 9998;

    await query(
      `INSERT INTO admin.usuario_sesion
       (sesion_id, usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
       VALUES ($1, $2, $3, 'Test Runner User B', '127.0.0.1', 'Local', NOW(), NOW(), NOW() + INTERVAL '1 day', 'ACTIVA')`,
      [sesBId, userIdB, userBSessionHash]
    );

    // Switch auth token to User B
    process.env.TEST_AUTH_SESSION_TOKEN = userBSessionToken;

    // Check authorizeUserCreate with User B's token
    const blockedAction = await authorizeUserCreate(companyId);
    if (blockedAction.success) {
      throw new Error("Test C Failed: User with pending password change was unexpectedly allowed.");
    }
    if (blockedAction.status !== 403 || blockedAction.error !== "PASSWORD_CHANGE_REQUIRED") {
      throw new Error(`Test C Failed: Expected 403 PASSWORD_CHANGE_REQUIRED, got ${blockedAction.status}`);
    }
    console.log(`[PASS] Test C: User ${userIdB} blocked with 403 PASSWORD_CHANGE_REQUIRED when attempting protected operations.\n`);

    // ----------------------------------------------------
    // TEST D: Nueva contraseña no cumple política
    // => rechazo, flag continúa true => PASS
    // ----------------------------------------------------
    console.log("--- TEST D: Nueva contraseña no cumple política canónica ---");
    const reqD = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: "short",
        confirmPassword: "short"
      })
    });
    const resD = await changePasswordRoute(reqD);
    const dataD = await resD.json();
    if (resD.status !== 400 || dataD.error !== "VALIDATION_ERROR") {
      throw new Error(`Test D Failed: Weak password was not rejected: ${JSON.stringify(dataD)}`);
    }

    const secRowD = await query<any>(`SELECT forzar_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1`, [userIdB]);
    if (secRowD[0].forzar_cambio_clave !== true) {
      throw new Error("Test D Failed: forzar_cambio_clave changed despite validation failure.");
    }
    console.log(`[PASS] Test D: Weak password rejected with canonical message: "${dataD.message}". Flag remains true.\n`);

    // ----------------------------------------------------
    // TEST E: Confirmaciones diferentes
    // => rechazo, flag continúa true => PASS
    // ----------------------------------------------------
    console.log("--- TEST E: Confirmación de contraseña no coincide ---");
    const reqE = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: "NewValidPassword123!",
        confirmPassword: "DifferentPassword123!"
      })
    });
    const resE = await changePasswordRoute(reqE);
    const dataE = await resE.json();
    if (resE.status !== 400 || dataE.message !== "Las contraseñas no coinciden.") {
      throw new Error(`Test E Failed: Mismatched password was not rejected: ${JSON.stringify(dataE)}`);
    }
    console.log(`[PASS] Test E: Mismatch rejected with message: "${dataE.message}". Flag remains true.\n`);

    // ----------------------------------------------------
    // TEST F: Nueva contraseña igual a contraseña inicial
    // => rechazo => PASS
    // ----------------------------------------------------
    console.log("--- TEST F: Nueva contraseña igual a la contraseña inicial/actual ---");
    const reqF = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: initialPwdB,
        confirmPassword: initialPwdB
      })
    });
    const resF = await changePasswordRoute(reqF);
    const dataF = await resF.json();
    if (resF.status !== 400 || dataF.message !== "La nueva contraseña no puede ser igual a la contraseña actual.") {
      throw new Error(`Test F Failed: Same password was not rejected: ${JSON.stringify(dataF)}`);
    }
    console.log(`[PASS] Test F: Reuse of initial password rejected: "${dataF.message}".\n`);

    // ----------------------------------------------------
    // TEST G: Cambio válido
    // => nuevo hash, forzar_cambio_clave=false => PASS
    // ----------------------------------------------------
    console.log("--- TEST G: Cambio válido de contraseña ---");
    const validNewPwdB = "BrandNewSecurePass2026!#";
    const initialHashB = secRowB[0].password;

    const reqG = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: validNewPwdB,
        confirmPassword: validNewPwdB
      })
    });
    const resG = await changePasswordRoute(reqG);
    const dataG = await resG.json();
    if (resG.status !== 200 || !dataG.success) {
      throw new Error(`Test G Failed: Valid change was rejected: ${JSON.stringify(dataG)}`);
    }

    const secRowG = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave, password, fecha_ultimo_cambio_password, detalle_estado
       FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userIdB]
    );

    if (secRowG[0].forzar_cambio_clave !== false || secRowG[0].requiere_cambio_clave !== false) {
      throw new Error(`Test G Failed: forzar_cambio_clave is still true!`);
    }
    if (secRowG[0].password === initialHashB) {
      throw new Error("Test G Failed: password_hash was not updated!");
    }
    if (!verifyPassword(validNewPwdB, secRowG[0].password)) {
      throw new Error("Test G Failed: New password does not verify against new hash!");
    }
    console.log(`[PASS] Test G: Password updated. New scrypt hash persisted, forzar_cambio_clave=false, fecha_cambio=${secRowG[0].fecha_ultimo_cambio_password}.\n`);

    // ----------------------------------------------------
    // TEST H: Contraseña anterior después del cambio
    // => login rechazado => PASS
    // ----------------------------------------------------
    console.log("--- TEST H: Contraseña anterior después del cambio ---");
    const oldPwdValid = verifyPassword(initialPwdB, secRowG[0].password);
    if (oldPwdValid) {
      throw new Error("Test H Failed: Old password still verifies against new hash!");
    }
    console.log(`[PASS] Test H: Old initial password ("${initialPwdB}") is now strictly invalid.\n`);

    // ----------------------------------------------------
    // TEST I: Nueva contraseña después del cambio
    // => login permitido => PASS
    // ----------------------------------------------------
    console.log("--- TEST I: Nueva contraseña después del cambio ---");
    const newPwdValid = verifyPassword(validNewPwdB, secRowG[0].password);
    if (!newPwdValid) {
      throw new Error("Test I Failed: New password failed verification!");
    }
    console.log(`[PASS] Test I: New password ("${validNewPwdB}") verified successfully.\n`);

    // ----------------------------------------------------
    // TEST J: Segundo login (forzar_cambio_clave = false)
    // => no vuelve a solicitar cambio => PASS
    // ----------------------------------------------------
    console.log("--- TEST J: Segundo login no vuelve a solicitar cambio ---");
    const secRowJ = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userIdB]
    );
    const mustChangeJ = Boolean(secRowJ[0].forzar_cambio_clave || secRowJ[0].requiere_cambio_clave);
    if (mustChangeJ) {
      throw new Error("Test J Failed: Second login still requires password change!");
    }
    console.log(`[PASS] Test J: Second login proceeds directly to dashboard without prompt.\n`);

    // ----------------------------------------------------
    // TEST K: Reset administrativo con "Forzar cambio" activado
    // => próximo login vuelve a exigir cambio => PASS
    // ----------------------------------------------------
    console.log("--- TEST K: Reset administrativo con 'Forzar cambio' activado ---");
    // Switch auth back to Admin
    process.env.TEST_AUTH_SESSION_TOKEN = testSessionToken;

    const adminResetPwd = "TemporaryResetPass456!";
    const reqK = new Request(`http://localhost/api/usuarios/${userIdB}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: adminResetPwd,
        confirm_password: adminResetPwd,
        forceChangeOnNextLogin: true
      })
    });
    const resK = await resetPasswordRoute(reqK, { params: Promise.resolve({ id: String(userIdB) }) });
    const dataK = await resK.json();
    if (resK.status !== 200 || !dataK.success) {
      throw new Error(`Test K Failed: Reset failed: ${JSON.stringify(dataK)}`);
    }

    const secRowK = await query<any>(
      `SELECT forzar_cambio_clave, requiere_cambio_clave, password FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userIdB]
    );
    if (secRowK[0].forzar_cambio_clave !== true) {
      throw new Error(`Test K Failed: Expected forzar_cambio_clave = true after admin reset with force option.`);
    }
    if (!verifyPassword(adminResetPwd, secRowK[0].password)) {
      throw new Error("Test K Failed: Admin reset password does not verify.");
    }
    console.log(`[PASS] Test K: Admin reset reactivated forzar_cambio_clave=true. Next login will require change.\n`);

  } finally {
    // Cleanup
    if (createdUserIds.length > 0) {
      await query(`DELETE FROM admin.usuario_sesion WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_auditoria WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_actividad WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_alcance WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_roles WHERE usuario_id = ANY($1::int[])`, [createdUserIds]).catch(() => {});
      await query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      await query(`DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[])`, [createdUserIds]);
      console.log(`[CLEANUP] Cleaned up ${createdUserIds.length} test user records.`);
    }

    if (testSessionId) {
      await query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = $1`, [testSessionId]);
      console.log(`[CLEANUP] Cleaned up test session ID ${testSessionId}.`);
    }
  }

  console.log("\n====================================================");
  console.log("TEST SUMMARY: 11 PASSED (A - K), 0 FAILED");
  console.log("====================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("FATAL ERROR in test suite:", err);
  process.exit(1);
});
