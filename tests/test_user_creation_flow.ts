import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { query } from "../src/lib/db";
import { hashSessionToken, verifyPassword } from "../src/lib/auth";
import { POST as createUserRoute } from "../src/app/api/usuarios/route";
import { GET as getTallerCatalogosRoute } from "../src/app/api/taller/catalogos/route";

async function runTests() {
  console.log("====================================================");
  console.log("STARTING TEST SUITE: DEFINITIVE USER CREATION & TIPO_USUARIO");
  console.log("====================================================\n");

  const createdUserIds: number[] = [];
  let testSessionId: number | null = null;
  const testSessionToken = `test_ses_creator_${Date.now()}`;
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
    console.log(`[AUTH SETUP] Active test session initialized for Admin User ID ${adminUserId}.`);

    const compRes = await query<{ empresa_id: number }>(`SELECT empresa_id FROM admin.empresa LIMIT 1`);
    const companyId = compRes[0]?.empresa_id || 1;

    const rolRes = await query<{ rol_funcional_id: number }>(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE UPPER(nombre) LIKE '%ADMIN%' LIMIT 1`);
    const roleId = rolRes[0]?.rol_funcional_id || 1;

    // Get active and inactive user types for testing
    const activeMecRes = await query<{ tipo_usuario_id: number }>(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE codigo = 'MECANICO' AND estado = 'ACTIVO' LIMIT 1`);
    const tipoMecanicoId = activeMecRes[0]?.tipo_usuario_id || 2;

    const activeSupRes = await query<{ tipo_usuario_id: number }>(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE codigo = 'SUPERVISOR' AND estado = 'ACTIVO' LIMIT 1`);
    const tipoSupervisorId = activeSupRes[0]?.tipo_usuario_id || 3;

    const inactiveRes = await query<{ tipo_usuario_id: number }>(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE estado = 'INACTIVO' LIMIT 1`);
    const tipoInactivoId = inactiveRes[0]?.tipo_usuario_id || 1;

    // ----------------------------------------------------
    // TEST A: Crear sin Tipo de usuario => 400 controlado
    // ----------------------------------------------------
    console.log("\n--- TEST A: Crear sin Tipo de usuario ---");
    const reqA = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Test",
        last_name: "NoUserType",
        email: `test_notype_${Date.now()}@bikers.com`,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId
        // tipo_usuario_id omitted
      })
    });
    const resA = await createUserRoute(reqA);
    const dataA = await resA.json();
    if (resA.status !== 400 || dataA.error !== "El tipo de usuario es obligatorio.") {
      throw new Error(`Test A Failed: Expected 400 'El tipo de usuario es obligatorio.', got ${resA.status}: ${JSON.stringify(dataA)}`);
    }
    console.log(`[PASS] Test A: Rejected with controlled 400 error: "${dataA.error}"`);

    // ----------------------------------------------------
    // TEST B: Tipo inexistente => rechazo 400
    // ----------------------------------------------------
    console.log("\n--- TEST B: Tipo de usuario inexistente ---");
    const reqB = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Test",
        last_name: "InvalidType",
        email: `test_invtype_${Date.now()}@bikers.com`,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: 999999
      })
    });
    const resB = await createUserRoute(reqB);
    const dataB = await resB.json();
    if (resB.status !== 400 || dataB.error !== "El tipo de usuario seleccionado no existe.") {
      throw new Error(`Test B Failed: Expected 400 'El tipo de usuario seleccionado no existe.', got ${resB.status}: ${JSON.stringify(dataB)}`);
    }
    console.log(`[PASS] Test B: Rejected with controlled 400 error: "${dataB.error}"`);

    // ----------------------------------------------------
    // TEST C: Tipo INACTIVO (ADMIN ID 1) => rechazo 400
    // ----------------------------------------------------
    console.log("\n--- TEST C: Tipo de usuario INACTIVO ---");
    const reqC = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Test",
        last_name: "InactiveType",
        email: `test_inactype_${Date.now()}@bikers.com`,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: tipoInactivoId
      })
    });
    const resC = await createUserRoute(reqC);
    const dataC = await resC.json();
    if (resC.status !== 400 || dataC.error !== "El tipo de usuario seleccionado no se encuentra activo.") {
      throw new Error(`Test C Failed: Expected 400 'El tipo de usuario seleccionado no se encuentra activo.', got ${resC.status}: ${JSON.stringify(dataC)}`);
    }
    console.log(`[PASS] Test C: Rejected inactive user type with controlled 400 error: "${dataC.error}"`);

    // ----------------------------------------------------
    // TEST D: Tipo MECANICO => creado correctamente => aparece en Taller
    // ----------------------------------------------------
    console.log("\n--- TEST D: Tipo MECANICO => creado y validado en Taller ---");
    const emailD = `test_mec_${Date.now()}@bikers.com`;
    const reqD = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Mario",
        last_name: "Mecanico",
        email: emailD,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: tipoMecanicoId
      })
    });
    const resD = await createUserRoute(reqD);
    const dataD = await resD.json();
    if (resD.status !== 200 || !dataD.success) {
      throw new Error(`Test D Failed: ${JSON.stringify(dataD)}`);
    }
    const userIdD = dataD.user_id || dataD.usuario_id;
    createdUserIds.push(userIdD);

    // Verify in Taller Catalogos mechanics list
    const resTallerCat = await getTallerCatalogosRoute();
    const tallerCatData = await resTallerCat.json();
    const isMecInTaller = (tallerCatData.data?.mecanicos || tallerCatData.mecanicos || []).some(
      (m: any) => Number(m.usuario_id) === Number(userIdD)
    );
    if (!isMecInTaller) {
      throw new Error(`Test D Failed: User with MECANICO type was NOT found in taller mechanics list!`);
    }
    console.log(`[PASS] Test D: User ${userIdD} created with tipo MECANICO and correctly appeared in Taller mechanics list.`);

    // ----------------------------------------------------
    // TEST E: Tipo SUPERVISOR => creado correctamente => NO aparece en Taller
    // ----------------------------------------------------
    console.log("\n--- TEST E: Tipo SUPERVISOR => creado y NO aparece en Taller ---");
    const emailE = `test_sup_${Date.now()}@bikers.com`;
    const reqE = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Sofia",
        last_name: "Supervisora",
        email: emailE,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: tipoSupervisorId
      })
    });
    const resE = await createUserRoute(reqE);
    const dataE = await resE.json();
    if (resE.status !== 200 || !dataE.success) {
      throw new Error(`Test E Failed: ${JSON.stringify(dataE)}`);
    }
    const userIdE = dataE.user_id || dataE.usuario_id;
    createdUserIds.push(userIdE);

    // Verify in Taller Catalogos that Supervisor is NOT in mechanics list
    const resTallerCatE = await getTallerCatalogosRoute();
    const tallerCatDataE = await resTallerCatE.json();
    const isSupInTaller = (tallerCatDataE.data?.mecanicos || tallerCatDataE.mecanicos || []).some(
      (m: any) => Number(m.usuario_id) === Number(userIdE)
    );
    if (isSupInTaller) {
      throw new Error(`Test E Failed: User with SUPERVISOR type unexpectedly appeared in taller mechanics list!`);
    }
    console.log(`[PASS] Test E: User ${userIdE} created with tipo SUPERVISOR and correctly excluded from Taller mechanics list.`);

    // ----------------------------------------------------
    // TEST F: Rol Administrador General + MECANICO => aparece como mecánico
    // ----------------------------------------------------
    console.log("\n--- TEST F: Rol Administrador General + MECANICO ---");
    const emailF = `test_admin_mec_${Date.now()}@bikers.com`;
    const reqF = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Admin",
        last_name: "Mecanico",
        email: emailF,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId: 1, // Administrador General
        tipo_usuario_id: tipoMecanicoId
      })
    });
    const resF = await createUserRoute(reqF);
    const dataF = await resF.json();
    if (resF.status !== 200 || !dataF.success) {
      throw new Error(`Test F Failed: ${JSON.stringify(dataF)}`);
    }
    const userIdF = dataF.user_id || dataF.usuario_id;
    createdUserIds.push(userIdF);

    const resTallerCatF = await getTallerCatalogosRoute();
    const tallerCatDataF = await resTallerCatF.json();
    const isAdminMecInTaller = (tallerCatDataF.data?.mecanicos || tallerCatDataF.mecanicos || []).some(
      (m: any) => Number(m.usuario_id) === Number(userIdF)
    );
    if (!isAdminMecInTaller) {
      throw new Error(`Test F Failed: Admin with MECANICO type was not found in taller mechanics list!`);
    }
    console.log(`[PASS] Test F: Admin General user with MECANICO type correctly included in Taller.`);

    // ----------------------------------------------------
    // TEST G: Rol Administrador General + SUPERVISOR => no aparece como mecánico
    // ----------------------------------------------------
    console.log("\n--- TEST G: Rol Administrador General + SUPERVISOR ---");
    const emailG = `test_admin_sup_${Date.now()}@bikers.com`;
    const reqG = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Admin",
        last_name: "Supervisor",
        email: emailG,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId: 1, // Administrador General
        tipo_usuario_id: tipoSupervisorId
      })
    });
    const resG = await createUserRoute(reqG);
    const dataG = await resG.json();
    if (resG.status !== 200 || !dataG.success) {
      throw new Error(`Test G Failed: ${JSON.stringify(dataG)}`);
    }
    const userIdG = dataG.user_id || dataG.usuario_id;
    createdUserIds.push(userIdG);

    const resTallerCatG = await getTallerCatalogosRoute();
    const tallerCatDataG = await resTallerCatG.json();
    const isAdminSupInTaller = (tallerCatDataG.data?.mecanicos || tallerCatDataG.mecanicos || []).some(
      (m: any) => Number(m.usuario_id) === Number(userIdG)
    );
    if (isAdminSupInTaller) {
      throw new Error(`Test G Failed: Admin with SUPERVISOR type unexpectedly appeared in taller mechanics list!`);
    }
    console.log(`[PASS] Test G: Admin General user with SUPERVISOR type correctly excluded from Taller mechanics.`);

    // ----------------------------------------------------
    // TEST G2: Tipo VENDEDOR + ACTIVO => NO aparece en Taller
    // ----------------------------------------------------
    console.log("\n--- TEST G2: Tipo VENDEDOR + ACTIVO ---");
    const activeVendRes = await query<{ tipo_usuario_id: number }>(`SELECT tipo_usuario_id FROM admin.tipo_usuario WHERE codigo = 'VENDEDOR' AND estado = 'ACTIVO' LIMIT 1`);
    const tipoVendedorId = activeVendRes[0]?.tipo_usuario_id || 5;
    const emailG2 = `test_vend_${Date.now()}@bikers.com`;
    const reqG2 = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Valeria",
        last_name: "Vendedora",
        email: emailG2,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: tipoVendedorId
      })
    });
    const resG2 = await createUserRoute(reqG2);
    const dataG2 = await resG2.json();
    if (resG2.status !== 200 || !dataG2.success) {
      throw new Error(`Test G2 Failed: ${JSON.stringify(dataG2)}`);
    }
    const userIdG2 = dataG2.user_id || dataG2.usuario_id;
    createdUserIds.push(userIdG2);

    const resTallerCatG2 = await getTallerCatalogosRoute();
    const tallerCatDataG2 = await resTallerCatG2.json();
    const isVendInTaller = (tallerCatDataG2.data?.mecanicos || tallerCatDataG2.mecanicos || []).some(
      (m: any) => Number(m.usuario_id) === Number(userIdG2)
    );
    if (isVendInTaller) {
      throw new Error(`Test G2 Failed: User with VENDEDOR type unexpectedly appeared in taller mechanics list!`);
    }
    console.log(`[PASS] Test G2: User ${userIdG2} with VENDEDOR type correctly excluded from Taller mechanics.`);

    // ----------------------------------------------------
    // TEST H: Documento vacío => persistido como NULL
    // ----------------------------------------------------
    console.log("\n--- TEST H: Documento vacío => persistido como NULL ---");
    const docRow = await query<any>(`SELECT numero_documento FROM admin.usuario_identidad WHERE usuario_id = $1`, [userIdG]);
    if (docRow[0].numero_documento !== null) {
      throw new Error(`Test H Failed: Expected numero_documento = NULL, got ${docRow[0].numero_documento}`);
    }
    console.log(`[PASS] Test H: DB confirms numero_documento = NULL.`);

    // ----------------------------------------------------
    // TEST I: Departamento/Área/Cargo => persistidos como NULL
    // ----------------------------------------------------
    console.log("\n--- TEST I: Departamento/Área/Cargo => persistidos como NULL ---");
    const orgRow = await query<any>(`SELECT departamento_id, area_id, cargo_id FROM admin.usuario_identidad WHERE usuario_id = $1`, [userIdG]);
    if (orgRow[0].departamento_id !== null || orgRow[0].area_id !== null || orgRow[0].cargo_id !== null) {
      throw new Error(`Test I Failed: Expected org columns to be NULL, got ${JSON.stringify(orgRow[0])}`);
    }
    console.log(`[PASS] Test I: DB confirms departamento_id=NULL, area_id=NULL, cargo_id=NULL.`);

    // ----------------------------------------------------
    // TEST J: Forzar cambio marcado => flujo obligatorio E2E
    // ----------------------------------------------------
    console.log("\n--- TEST J: Forzar cambio de contraseña marcado ---");
    const emailJ = `test_force_${Date.now()}@bikers.com`;
    const reqJ = new Request("http://localhost/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: "Force",
        last_name: "PasswordUser",
        email: emailJ,
        password: "ValidPassword123!",
        confirm_password: "ValidPassword123!",
        companyId,
        roleId,
        tipo_usuario_id: tipoMecanicoId,
        must_change_password: true,
        forzar_cambio_clave: true
      })
    });
    const resJ = await createUserRoute(reqJ);
    const dataJ = await resJ.json();
    if (resJ.status !== 200 || !dataJ.success) {
      throw new Error(`Test J Failed: ${JSON.stringify(dataJ)}`);
    }
    const userIdJ = dataJ.user_id || dataJ.usuario_id;
    createdUserIds.push(userIdJ);

    const secRowJ = await query<any>(`SELECT forzar_cambio_clave, requiere_cambio_clave FROM admin.usuario_seguridad WHERE usuario_id = $1`, [userIdJ]);
    if (secRowJ[0].forzar_cambio_clave !== true) {
      throw new Error(`Test J Failed: Expected forzar_cambio_clave = true`);
    }
    console.log(`[PASS] Test J: forzar_cambio_clave=true confirmed in DB.`);

  } finally {
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
      console.log(`\n[CLEANUP] Cleaned up ${createdUserIds.length} test user records.`);
    }

    if (testSessionId) {
      await query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = $1`, [testSessionId]);
      console.log(`[CLEANUP] Cleaned up test session ID ${testSessionId}.`);
    }
  }

  console.log("\n====================================================");
  console.log("TEST SUMMARY: 10 PASSED (A - J), 0 FAILED");
  console.log("====================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("FATAL ERROR in test suite:", err);
  process.exit(1);
});
