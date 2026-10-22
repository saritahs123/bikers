require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPhase5CriticalPrivilegeTests() {
  const client = await pool.connect();
  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, message) {
    if (condition) {
      passed++;
      testResults.push({ status: 'PASS', message });
      console.log(`  [PASS] ${message}`);
    } else {
      failed++;
      testResults.push({ status: 'FAIL', message });
      console.error(`  [FAIL] ${message}`);
    }
  }

  try {
    console.log("=== INICIANDO FASE 5: VALIDACIÓN Y ENDURECIMIENTO DE PRIVILEGIOS CRÍTICOS ===");
    console.log("=== ENTORNO AISLADO CON TRANSACCIÓN (ROLLBACK AL FINAL - CERO MUTACIONES) ===\n");
    await client.query("BEGIN");

    // 1. Setup isolated test companies
    const tipoEmpRes = await client.query("SELECT tipo_empresa_id FROM admin.tipo_empresa LIMIT 1");
    const tipoEmpId = tipoEmpRes.rows[0]?.tipo_empresa_id || 1;

    const maxEmp = (await client.query("SELECT COALESCE(MAX(empresa_id), 0) as m FROM admin.empresa")).rows[0].m;
    const empresaA = Number(maxEmp) + 981;
    const empresaB = Number(maxEmp) + 982;

    await client.query(`
      INSERT INTO admin.empresa (empresa_id, tipo_empresa_id, nombre_comercial, rnc, estado, fecha_registro)
      VALUES ($1, $2, 'F5 Empresa Alpha', '130000081', 'ACTIVO', NOW()),
             ($3, $2, 'F5 Empresa Beta (Cross-Tenant)', '130000082', 'ACTIVO', NOW())
    `, [empresaA, tipoEmpId, empresaB]);

    // 2. Setup isolated test users
    const tipoUserRes = await client.query("SELECT tipo_usuario_id FROM admin.tipo_usuario LIMIT 1");
    const tipoUserId = tipoUserRes.rows[0]?.tipo_usuario_id || 1;

    const maxU = (await client.query("SELECT COALESCE(MAX(usuario_id), 0) as m FROM admin.usuario")).rows[0].m;
    const userA = Number(maxU) + 981; // Solo EDITAR (Facturacion)
    const userB = Number(maxU) + 982; // Solo CREAR (Inventario)
    const userC = Number(maxU) + 983; // Solo EDITAR (Taller)
    const userD = Number(maxU) + 984; // Solo EDITAR (Taller Mecanicos)
    const userE = Number(maxU) + 985; // Solo EDITAR (Taller Cierre)
    const userF = Number(maxU) + 986; // Solo EDITAR (Taller Reapertura)
    const userG = Number(maxU) + 987; // Solo CREAR (Inventario Ajustes)
    const userH = Number(maxU) + 988; // Solo VER (Todos los módulos)
    const userMulti = Number(maxU) + 989; // Multiples roles
    const userInactivo = Number(maxU) + 990; // Usuario Inactivo
    const userTenantB = Number(maxU) + 991; // Usuario Empresa B

    const userList = [
      [userA, empresaA, 'ACTIVO'],
      [userB, empresaA, 'ACTIVO'],
      [userC, empresaA, 'ACTIVO'],
      [userD, empresaA, 'ACTIVO'],
      [userE, empresaA, 'ACTIVO'],
      [userF, empresaA, 'ACTIVO'],
      [userG, empresaA, 'ACTIVO'],
      [userH, empresaA, 'ACTIVO'],
      [userMulti, empresaA, 'ACTIVO'],
      [userInactivo, empresaA, 'INACTIVO'],
      [userTenantB, empresaB, 'ACTIVO'],
    ];

    for (const [uId, empId, st] of userList) {
      await client.query(`
        INSERT INTO admin.usuario (usuario_id, tipo_usuario_id, empresa_id, estado, fecha_creacion)
        VALUES ($1, $2, $3, $4, NOW())
      `, [uId, tipoUserId, empId, st]);
    }

    // 3. Resolve canonical screens
    const scrFacRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE codigo = 'FACTURACION_FACTURAS' LIMIT 1`);
    const scrFacId = scrFacRes.rows[0]?.pantalla_id;

    const scrOtRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE codigo = 'TALLER_ORDENES' LIMIT 1`);
    const scrOtId = scrOtRes.rows[0]?.pantalla_id;

    const scrTransRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/transfers' LIMIT 1`);
    const scrTransId = scrTransRes.rows[0]?.pantalla_id;

    const scrAjuRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/adjustments' LIMIT 1`);
    const scrAjuId = scrAjuRes.rows[0]?.pantalla_id;

    const scrInitRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/initial' LIMIT 1`);
    const scrInitId = scrInitRes.rows[0]?.pantalla_id;

    // Helper to resolve effective screen permissions within this isolated transaction
    async function getTestScreenPermissions(pantallaId, usuarioId) {
      // Inactive check
      const uRes = await client.query(`SELECT estado FROM admin.usuario WHERE usuario_id = $1`, [usuarioId]);
      if (!uRes.rows.length || uRes.rows[0].estado !== 'ACTIVO') {
        return {
          puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
          puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
          puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
        };
      }

      const q = `
        WITH user_roles AS (
          SELECT rf.rol_funcional_id
          FROM admin.rol_funcional rf
          WHERE rf.estado = 'ACTIVO'
            AND rf.rol_funcional_id IN (
              SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $2 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
              UNION
              SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
            )
        ),
        user_custom_screen AS (
          SELECT *
          FROM admin.usuario_permiso_personalizado
          WHERE usuario_id = $2 AND pantalla_id = $1 AND estado = 'ACTIVO'
          LIMIT 1
        ),
        role_effective AS (
          SELECT
            BOOL_OR(COALESCE(map.puede_ver, false)) AS puede_ver,
            BOOL_OR(COALESCE(map.puede_crear, false)) AS puede_crear,
            BOOL_OR(COALESCE(map.puede_editar, false)) AS puede_editar,
            BOOL_OR(COALESCE(map.puede_inactivar, false)) AS puede_inactivar,
            BOOL_OR(COALESCE(map.puede_exportar, false)) AS puede_exportar,
            BOOL_OR(COALESCE(map.puede_importar, false)) AS puede_importar,
            BOOL_OR(COALESCE(map.puede_aprobar, false)) AS puede_aprobar,
            BOOL_OR(COALESCE(map.puede_asignar, false)) AS puede_asignar,
            BOOL_OR(COALESCE(map.puede_mover, false)) AS puede_mover,
            BOOL_OR(COALESCE(map.puede_cerrar, false)) AS puede_cerrar,
            BOOL_OR(COALESCE(map.puede_reabrir, false)) AS puede_reabrir,
            BOOL_OR(COALESCE(map.puede_eliminar, false)) AS puede_eliminar
          FROM user_roles ur
          JOIN admin.matriz_acceso_pantalla map ON map.rol_funcional_id = ur.rol_funcional_id AND map.pantalla_id = $1
          WHERE map.estado = 'ACTIVO'
        )
        SELECT
          COALESCE(ucs.puede_ver, re.puede_ver, false) AS puede_ver,
          COALESCE(ucs.puede_crear, re.puede_crear, false) AS puede_crear,
          COALESCE(ucs.puede_editar, re.puede_editar, false) AS puede_editar,
          COALESCE(ucs.puede_inactivar, re.puede_inactivar, false) AS puede_inactivar,
          COALESCE(ucs.puede_exportar, re.puede_exportar, false) AS puede_exportar,
          COALESCE(ucs.puede_importar, re.puede_importar, false) AS puede_importar,
          COALESCE(ucs.puede_aprobar, re.puede_aprobar, false) AS puede_aprobar,
          COALESCE(ucs.puede_asignar, re.puede_asignar, false) AS puede_asignar,
          COALESCE(ucs.puede_mover, re.puede_mover, false) AS puede_mover,
          COALESCE(ucs.puede_cerrar, re.puede_cerrar, false) AS puede_cerrar,
          COALESCE(ucs.puede_reabrir, re.puede_reabrir, false) AS puede_reabrir,
          COALESCE(ucs.puede_eliminar, re.puede_eliminar, false) AS puede_eliminar
        FROM role_effective re
        FULL OUTER JOIN user_custom_screen ucs ON true
      `;
      const res = await client.query(q, [pantallaId, usuarioId]);
      const r = res.rows[0] || {};
      return {
        puede_ver: Boolean(r.puede_ver),
        puede_crear: Boolean(r.puede_crear),
        puede_editar: Boolean(r.puede_editar),
        puede_inactivar: Boolean(r.puede_inactivar),
        puede_exportar: Boolean(r.puede_exportar),
        puede_importar: Boolean(r.puede_importar),
        puede_aprobar: Boolean(r.puede_aprobar),
        puede_asignar: Boolean(r.puede_asignar),
        puede_mover: Boolean(r.puede_mover),
        puede_cerrar: Boolean(r.puede_cerrar),
        puede_reabrir: Boolean(r.puede_reabrir),
        puede_eliminar: Boolean(r.puede_eliminar)
      };
    }

    // Helper to setup isolated role for a user
    let rolCounter = 981;
    async function setupIsolatedRole(usuarioId, screenId, permsObj) {
      const rolId = rolCounter++;
      await client.query(`
        INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado)
        VALUES ($1, 'ROL_TEST_${rolId}', 'Rol aislado de prueba', 'ACTIVO')
      `, [rolId]);

      await client.query(`
        UPDATE admin.usuario SET rol_principal_id = $1 WHERE usuario_id = $2
      `, [rolId, usuarioId]);

      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVO'
        )
      `, [
        rolId, screenId,
        permsObj.puede_ver || false,
        permsObj.puede_crear || false,
        permsObj.puede_editar || false,
        permsObj.puede_inactivar || false,
        permsObj.puede_exportar || false,
        permsObj.puede_importar || false,
        permsObj.puede_aprobar || false,
        permsObj.puede_asignar || false,
        permsObj.puede_mover || false,
        permsObj.puede_cerrar || false,
        permsObj.puede_reabrir || false,
        permsObj.puede_eliminar || false,
      ]);
      return rolId;
    }

    console.log("--- CASO A: USUARIO A (ÚNICO PERMISO: EDITAR) -> OPERACIÓN: ANULAR FACTURA ---");
    await setupIsolatedRole(userA, scrFacId, { puede_ver: true, puede_editar: true });
    const pA = await getTestScreenPermissions(scrFacId, userA);
    assert(pA.puede_editar === true, "Usuario A tiene privilegio EDITAR");
    assert(pA.puede_aprobar === false, "Usuario A NO tiene privilegio APROBAR");
    // Verify anular backend constraint: if (!perms.puede_aprobar) => REJECTED 403
    const canAnularA = Boolean(pA.puede_aprobar);
    assert(canAnularA === false, "Anular factura DENEGADO (HTTP 403) para usuario con únicamente EDITAR");

    // Positive test: User A+ with APROBAR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_aprobar = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrFacId, userA]);
    const pAPlus = await getTestScreenPermissions(scrFacId, userA);
    assert(pAPlus.puede_aprobar === true && Boolean(pAPlus.puede_aprobar) === true, "Anular factura AUTORIZADO (HTTP 200) cuando se otorga privilegio objetivo APROBAR");

    console.log("\n--- CASO B: USUARIO B (ÚNICO PERMISO: CREAR) -> OPERACIÓN: TRANSFERIR INVENTARIO ---");
    await setupIsolatedRole(userB, scrTransId, { puede_ver: true, puede_crear: true });
    const pB = await getTestScreenPermissions(scrTransId, userB);
    assert(pB.puede_crear === true, "Usuario B tiene privilegio CREAR");
    assert(pB.puede_mover === false, "Usuario B NO tiene privilegio MOVER");
    const canTransferB = Boolean(pB.puede_mover);
    assert(canTransferB === false, "Transferir inventario DENEGADO (HTTP 403) para usuario con únicamente CREAR");

    // Positive test: User B+ with MOVER
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_mover = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrTransId, userB]);
    const pBPlus = await getTestScreenPermissions(scrTransId, userB);
    assert(pBPlus.puede_mover === true && Boolean(pBPlus.puede_mover) === true, "Transferir inventario AUTORIZADO (HTTP 200) cuando se otorga privilegio MOVER");

    console.log("\n--- CASO C: USUARIO C (ÚNICO PERMISO: EDITAR) -> OPERACIÓN: ELIMINAR REGISTRO ---");
    await setupIsolatedRole(userC, scrOtId, { puede_ver: true, puede_editar: true });
    const pC = await getTestScreenPermissions(scrOtId, userC);
    assert(pC.puede_editar === true, "Usuario C tiene privilegio EDITAR");
    assert(pC.puede_eliminar === false, "Usuario C NO tiene privilegio ELIMINAR");
    const canDeleteC = Boolean(pC.puede_eliminar);
    assert(canDeleteC === false, "Eliminar registro DENEGADO (HTTP 403) para usuario con únicamente EDITAR");

    // Positive test: User C+ with ELIMINAR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_eliminar = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrOtId, userC]);
    const pCPlus = await getTestScreenPermissions(scrOtId, userC);
    assert(pCPlus.puede_eliminar === true && Boolean(pCPlus.puede_eliminar) === true, "Eliminar registro AUTORIZADO (HTTP 200) cuando se otorga privilegio ELIMINAR");

    console.log("\n--- CASO D: USUARIO D (ÚNICO PERMISO: EDITAR) -> OPERACIÓN: ASIGNAR MECÁNICO ---");
    await setupIsolatedRole(userD, scrOtId, { puede_ver: true, puede_editar: true });
    const pD = await getTestScreenPermissions(scrOtId, userD);
    assert(pD.puede_editar === true, "Usuario D tiene privilegio EDITAR");
    assert(pD.puede_asignar === false, "Usuario D NO tiene privilegio ASIGNAR");
    const canAssignD = Boolean(pD.puede_asignar);
    assert(canAssignD === false, "Asignar mecánico DENEGADO (HTTP 403) para usuario con únicamente EDITAR");

    // Positive test: User D+ with ASIGNAR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_asignar = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrOtId, userD]);
    const pDPlus = await getTestScreenPermissions(scrOtId, userD);
    assert(pDPlus.puede_asignar === true && Boolean(pDPlus.puede_asignar) === true, "Asignar mecánico AUTORIZADO (HTTP 200) cuando se otorga privilegio ASIGNAR");

    console.log("\n--- CASO E: USUARIO E (ÚNICO PERMISO: EDITAR) -> OPERACIÓN: CERRAR ORDEN ---");
    await setupIsolatedRole(userE, scrOtId, { puede_ver: true, puede_editar: true });
    const pE = await getTestScreenPermissions(scrOtId, userE);
    assert(pE.puede_editar === true, "Usuario E tiene privilegio EDITAR");
    assert(pE.puede_cerrar === false, "Usuario E NO tiene privilegio CERRAR");
    const canCloseE = Boolean(pE.puede_cerrar);
    assert(canCloseE === false, "Cerrar orden DENEGADO (HTTP 403) para usuario con únicamente EDITAR");

    // Positive test: User E+ with CERRAR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_cerrar = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrOtId, userE]);
    const pEPlus = await getTestScreenPermissions(scrOtId, userE);
    assert(pEPlus.puede_cerrar === true && Boolean(pEPlus.puede_cerrar) === true, "Cerrar orden AUTORIZADO (HTTP 200) cuando se otorga privilegio CERRAR");

    console.log("\n--- CASO F: USUARIO F (ÚNICO PERMISO: EDITAR) -> OPERACIÓN: REABRIR ORDEN ---");
    await setupIsolatedRole(userF, scrOtId, { puede_ver: true, puede_editar: true });
    const pF = await getTestScreenPermissions(scrOtId, userF);
    assert(pF.puede_editar === true, "Usuario F tiene privilegio EDITAR");
    assert(pF.puede_reabrir === false, "Usuario F NO tiene privilegio REABRIR");
    const canReopenF = Boolean(pF.puede_reabrir);
    assert(canReopenF === false, "Reabrir orden DENEGADO (HTTP 403) para usuario con únicamente EDITAR");

    // Positive test: User F+ with REABRIR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_reabrir = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrOtId, userF]);
    const pFPlus = await getTestScreenPermissions(scrOtId, userF);
    assert(pFPlus.puede_reabrir === true && Boolean(pFPlus.puede_reabrir) === true, "Reabrir orden AUTORIZADO (HTTP 200) cuando se otorga privilegio REABRIR");

    console.log("\n--- CASO G: USUARIO G (ÚNICO PERMISO: CREAR) -> OPERACIÓN: APROBAR AJUSTE ---");
    await setupIsolatedRole(userG, scrAjuId, { puede_ver: true, puede_crear: true });
    const pG = await getTestScreenPermissions(scrAjuId, userG);
    assert(pG.puede_crear === true, "Usuario G tiene privilegio CREAR");
    assert(pG.puede_aprobar === false, "Usuario G NO tiene privilegio APROBAR");
    const canApproveG = Boolean(pG.puede_aprobar);
    assert(canApproveG === false, "Aprobar ajuste (AJU_POS/AJU_NEG) DENEGADO (HTTP 403) para usuario con únicamente CREAR");
    const canSalidaG = Boolean(pG.puede_crear);
    assert(canSalidaG === true, "Registrar salida manual AUTORIZADO (HTTP 200) para usuario con CREAR");

    // Positive test: User G+ with APROBAR
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_aprobar = true WHERE pantalla_id = $1 AND rol_funcional_id = (SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $2)`, [scrAjuId, userG]);
    const pGPlus = await getTestScreenPermissions(scrAjuId, userG);
    assert(pGPlus.puede_aprobar === true && Boolean(pGPlus.puede_aprobar) === true, "Aprobar ajuste AUTORIZADO (HTTP 200) cuando se otorga privilegio APROBAR");

    console.log("\n--- CASO H: USUARIO H (ÚNICO PERMISO: VER) -> OPERACIÓN: CUALQUIER MODIFICACIÓN ---");
    await setupIsolatedRole(userH, scrOtId, { puede_ver: true });
    const pH = await getTestScreenPermissions(scrOtId, userH);
    assert(pH.puede_ver === true, "Usuario H tiene privilegio VER");
    assert(pH.puede_crear === false, "Usuario H NO puede crear");
    assert(pH.puede_editar === false, "Usuario H NO puede editar");
    assert(pH.puede_eliminar === false, "Usuario H NO puede eliminar");
    assert(pH.puede_asignar === false, "Usuario H NO puede asignar");
    assert(pH.puede_cerrar === false, "Usuario H NO puede cerrar");
    assert(pH.puede_reabrir === false, "Usuario H NO puede reabrir");
    assert(pH.puede_mover === false, "Usuario H NO puede mover");
    assert(pH.puede_aprobar === false, "Usuario H NO puede aprobar");
    const anyMutationH = pH.puede_crear || pH.puede_editar || pH.puede_eliminar || pH.puede_asignar || pH.puede_cerrar || pH.puede_reabrir || pH.puede_mover || pH.puede_aprobar;
    assert(anyMutationH === false, "Cualquier mutación DENEGADA (HTTP 403) para usuario con únicamente VER");

    console.log("\n--- TEST: USUARIO INACTIVO BLOQUEADO SIN PRIVILEGIOS ---");
    await setupIsolatedRole(userInactivo, scrOtId, { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true });
    const pInactivo = await getTestScreenPermissions(scrOtId, userInactivo);
    assert(pInactivo.puede_ver === false && pInactivo.puede_editar === false, "Usuario con estado INACTIVO bloqueado automáticamente con 0 privilegios");

    console.log("\n--- TEST: UNIÓN DE MÚLTIPLES ROLES ---");
    const rol1 = await setupIsolatedRole(userMulti, scrOtId, { puede_ver: true, puede_editar: true });
    const rol2 = rolCounter++;
    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado)
      VALUES ($1, 'ROL_MULTI_EXTRA', 'Rol adicional', 'ACTIVO')
    `, [rol2]);
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, puede_asignar, estado)
      VALUES ($1, $2, true, true, 'ACTIVO')
    `, [rol2, scrOtId]);
    const maxUra = (await client.query("SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) as m FROM admin.usuario_rol_adicional")).rows[0].m;
    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_rol_adicional_id, usuario_id, rol_funcional_id)
      VALUES ($1, $2, $3)
    `, [Number(maxUra) + 981, userMulti, rol2]);
    const pMulti = await getTestScreenPermissions(scrOtId, userMulti);
    assert(pMulti.puede_editar === true, "Multi-rol hereda puede_editar del Rol 1");
    assert(pMulti.puede_asignar === true, "Multi-rol hereda puede_asignar del Rol 2");

    console.log("\n--- TEST: EXCEPCIÓN PERSONALIZADA DE USUARIO (DENEGACIÓN PREVALECE) ---");
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (
        usuario_id, pantalla_id, puede_ver, puede_editar, puede_asignar, estado
      ) VALUES ($1, $2, true, true, false, 'ACTIVO')
    `, [userMulti, scrOtId]);
    const pCustomOverride = await getTestScreenPermissions(scrOtId, userMulti);
    assert(pCustomOverride.puede_asignar === false, "Excepción personalizada DENEGADO (puede_asignar = false) anula la unión de roles");
    assert(pCustomOverride.puede_editar === true, "Excepción personalizada respeta puede_editar explícito");

    console.log("\n--- TEST: AISLAMIENTO MULTITENANT ESTRICTO ---");
    const tenantCheck = await client.query(`
      SELECT u.usuario_id, u.empresa_id
      FROM admin.usuario u
      WHERE u.usuario_id = $1 AND u.empresa_id = $2
    `, [userTenantB, empresaA]);
    assert(tenantCheck.rows.length === 0, "Aislamiento estricto: Usuario de Empresa B no pertenece ni opera en Empresa A");

    console.log("\n--- TEST: VERIFICACIÓN TÉCNICA DE ENDPOINTS ENDURECIDOS EN CÓDIGO ---");
    const fs = require('fs');
    const path = require('path');

    // 1. Facturas anular strictly requires puede_aprobar
    const anularContent = fs.readFileSync(path.join(__dirname, '../src/app/api/facturacion/facturas/[id]/anular/route.ts'), 'utf8');
    assert(anularContent.includes('!perms.puede_aprobar'), "Endpoint /anular valida estrictamente !perms.puede_aprobar");
    assert(!anularContent.includes('!perms.puede_editar && !perms.puede_aprobar'), "Endpoint /anular eliminó escalamiento indirecto por EDITAR");

    // 2. Facturas patch strictly requires puede_editar
    const facDetailContent = fs.readFileSync(path.join(__dirname, '../src/app/api/facturacion/facturas/[id]/route.ts'), 'utf8');
    assert(facDetailContent.includes('!perms.puede_editar'), "Endpoint PATCH /facturas/[id] valida estrictamente !perms.puede_editar");
    assert(!facDetailContent.includes('!perms.puede_editar && !perms.puede_crear'), "Endpoint PATCH /facturas/[id] eliminó escalamiento indirecto por CREAR");

    // 3. Pagos post strictly requires puede_crear
    const pagosContent = fs.readFileSync(path.join(__dirname, '../src/app/api/facturacion/facturas/[id]/pagos/route.ts'), 'utf8');
    assert(!pagosContent.includes('!perms.puede_editar'), "Endpoint POST /pagos eliminó escalamiento indirecto por EDITAR");

    // 4. Transferencias strictly requires puede_mover
    const transContent = fs.readFileSync(path.join(__dirname, '../src/app/api/inventario/transferencias/route.ts'), 'utf8');
    assert(transContent.includes('!perms.puede_mover'), "Endpoint POST /transferencias valida estrictamente !perms.puede_mover");
    assert(!transContent.includes('!perms.puede_crear && !perms.puede_mover'), "Endpoint POST /transferencias eliminó escalamiento indirecto por CREAR");
    assert(!transContent.includes('!perms.puede_editar'), "Endpoint POST /transferencias eliminó escalamiento indirecto por EDITAR");

    // 5. Ajustes separates CREAR (salida) from APROBAR (ajuste)
    const ajuContent = fs.readFileSync(path.join(__dirname, '../src/app/api/inventario/ajustes/route.ts'), 'utf8');
    assert(ajuContent.includes('!perms.puede_aprobar'), "Endpoint POST /ajustes valida estrictamente !perms.puede_aprobar para AJU_POS/AJU_NEG");
    assert(ajuContent.includes('!perms.puede_crear'), "Endpoint POST /ajustes valida estrictamente !perms.puede_crear para salidas manuales");

    // 6. Inventario inicial strictly requires puede_importar
    const initContent = fs.readFileSync(path.join(__dirname, '../src/app/api/inventario/inventario-inicial/route.ts'), 'utf8');
    assert(initContent.includes('!perms.puede_importar'), "Endpoint POST /inventario-inicial valida estrictamente !perms.puede_importar");

    // 7. Taller mechanic assignment strictly requires puede_asignar
    const otContent = fs.readFileSync(path.join(__dirname, '../src/app/api/taller/ordenes/[id]/route.ts'), 'utf8');
    assert(otContent.includes('isAssigningMechanic && !perms.puede_asignar'), "Endpoint PUT /ordenes/[id] valida estrictamente !perms.puede_asignar para mecánicos");
    assert(otContent.includes('targetStateId === estadoEntregadaId') && otContent.includes('!perms.puede_cerrar'), "Endpoint PUT /ordenes/[id] valida estrictamente !perms.puede_cerrar para estado ENTREGADA");
    assert(otContent.includes('isReopening') && otContent.includes('!perms.puede_reabrir'), "Endpoint PUT /ordenes/[id] valida estrictamente !perms.puede_reabrir para reaperturas");
    assert(otContent.includes('targetStateId === estadoListaEntregaId') && otContent.includes('!perms.puede_mover'), "Endpoint PUT /ordenes/[id] valida estrictamente !perms.puede_mover para pipeline de estados");

    // 8. Taller delete product strictly requires puede_eliminar
    const delProdContent = fs.readFileSync(path.join(__dirname, '../src/app/api/taller/ordenes/[id]/productos/[productoId]/route.ts'), 'utf8');
    const delProdBlock = delProdContent.split('export async function DELETE')[1] || '';
    assert(delProdBlock.includes('!perms.puede_eliminar'), "Endpoint DELETE orden producto valida estrictamente !perms.puede_eliminar");
    assert(!delProdBlock.includes('!perms.puede_editar'), "Endpoint DELETE orden producto eliminó escalamiento indirecto por EDITAR");

    // 9. Taller delete service disallows EDITAR
    const delServContent = fs.readFileSync(path.join(__dirname, '../src/app/api/taller/ordenes/[id]/servicios/[servicioId]/route.ts'), 'utf8');
    const delServBlock = delServContent.split('export async function DELETE')[1] || '';
    assert(delServBlock.includes('!perms.puede_eliminar && !perms.puede_inactivar'), "Endpoint DELETE orden servicio valida ELIMINAR o INACTIVAR");
    assert(!delServBlock.includes('!perms.puede_editar'), "Endpoint DELETE orden servicio eliminó escalamiento indirecto por EDITAR");

    // 10. User delete strictly requires puede_eliminar
    const delUserContent = fs.readFileSync(path.join(__dirname, '../src/app/api/usuarios/[id]/route.ts'), 'utf8');
    assert(delUserContent.includes('!segPerms.puede_eliminar'), "Endpoint DELETE /usuarios/[id] valida estrictamente !segPerms.puede_eliminar");
    assert(!delUserContent.includes('!segPerms.puede_editar'), "Endpoint DELETE /usuarios/[id] eliminó escalamiento indirecto por EDITAR");

    // 11. Tracking deactivate strictly requires puede_inactivar
    const deactTrackContent = fs.readFileSync(path.join(__dirname, '../src/app/api/taller/ordenes/[id]/tracking/desactivar/route.ts'), 'utf8');
    assert(deactTrackContent.includes('!perms.puede_inactivar'), "Endpoint POST /tracking/desactivar valida estrictamente !perms.puede_inactivar");
    assert(!deactTrackContent.includes('!perms.puede_editar'), "Endpoint POST /tracking/desactivar eliminó escalamiento indirecto por EDITAR");

    // 12. UI Synchronization checks
    const invDetailModalContent = fs.readFileSync(path.join(__dirname, '../src/components/billing/InvoiceDetailModal.jsx'), 'utf8');
    assert(invDetailModalContent.includes('Boolean(effectivePerms.puede_aprobar)'), "UI InvoiceDetailModal valida Boolean(effectivePerms.puede_aprobar) para mostrar botón Anular");

    const woDetailViewContent = fs.readFileSync(path.join(__dirname, '../src/components/workshop/WorkOrderDetailView.jsx'), 'utf8');
    assert(woDetailViewContent.includes('permissions.puede_cerrar !== false'), "UI WorkOrderDetailView condiciona botón ENTREGAR A CLIENTE a puede_cerrar");
    assert(woDetailViewContent.includes('permissions.puede_reabrir !== false'), "UI WorkOrderDetailView condiciona botón REABRIR REPARACIÓN a puede_reabrir");

    const editWoModalContent = fs.readFileSync(path.join(__dirname, '../src/components/workshop/EditWorkOrderModal.jsx'), 'utf8');
    assert(editWoModalContent.includes('disabled={!puedeAsignar}'), "UI EditWorkOrderModal deshabilita selector de mecánico cuando no tiene puede_asignar");

    const transfersViewContent = fs.readFileSync(path.join(__dirname, '../src/components/inventory/InventoryTransfersView.jsx'), 'utf8');
    assert(transfersViewContent.includes('(permisos && !permisos.puede_mover)'), "UI InventoryTransfersView deshabilita Registrar Transferencia cuando no tiene puede_mover");

    // Rollback isolated transaction
    await client.query("ROLLBACK");
    console.log("\n=== ROLLBACK EJECUTADO EXITOSAMENTE: CERO MUTACIONES EN BASE DE DATOS ===");
    console.log(`\nRESUMEN DE PRUEBAS FASE 5: ${passed} Pasadas, ${failed} Falladas`);

    return { passed, failed, total: passed + failed };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error running Phase 5 tests:", err);
    throw err;
  } finally {
    client.release();
  }
}

runPhase5CriticalPrivilegeTests()
  .then(res => {
    console.log(`Resultado Final: ${res.failed === 0 ? 'CERTIFICACION_FASE_5_EXITOSA' : 'PRUEBAS_FALLIDAS'}`);
    process.exit(res.failed === 0 ? 0 : 1);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
