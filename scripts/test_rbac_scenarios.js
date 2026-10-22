const { Pool } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Helper de consulta
let dbClient;
async function query(sql, params = []) {
  const res = await dbClient.query(sql, params);
  return res.rows;
}

// Simulador idéntico del motor RBAC de src/lib/workshop-session.ts
async function isSuperAdmin(usuarioId) {
  if (!usuarioId) return false;
  const rows = await query(
    `SELECT 1
     FROM admin.usuario u
     JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
     WHERE u.usuario_id = $1
       AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       AND (r.estado = 'ACTIVO' OR r.estado IS NULL)
       AND (
         u.rol_principal_id = 1
         OR UPPER(COALESCE(r.nombre, '')) = 'ADMINISTRADOR GENERAL'
         OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPER%'
       )
     LIMIT 1`,
    [usuarioId]
  );
  return Boolean(rows && rows.length > 0);
}

async function getModulePermissions(moduloNameOrId, usuarioId) {
  const fullPerms = {
    puede_ver: true, puede_crear: true, puede_editar: true, puede_inactivar: true,
    puede_exportar: true, puede_importar: true, puede_aprobar: true, puede_asignar: true,
    puede_mover: true, puede_cerrar: true, puede_reabrir: true, puede_eliminar: true
  };
  const noPerms = {
    puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
    puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
    puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
  };

  if (!usuarioId) return noPerms;

  const userCheck = await query(
    `SELECT estado FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
    [usuarioId]
  );
  if (!userCheck || userCheck.length === 0 || (userCheck[0].estado && userCheck[0].estado !== 'ACTIVO')) {
    return noPerms;
  }

  if (await isSuperAdmin(usuarioId)) return fullPerms;

  const isId = typeof moduloNameOrId === 'number' || /^\d+$/.test(String(moduloNameOrId));
  const targetModule = isId ? Number(moduloNameOrId) : String(moduloNameOrId).toUpperCase();

  const modRows = await query(
    `SELECT modulo_sistema_id
     FROM admin.modulo_sistema
     WHERE ${isId ? 'modulo_sistema_id = $1' : `(
       UPPER(nombre) = UPPER($1)
       OR UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = UPPER(TRANSLATE($1, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
     )`}
     LIMIT 1`,
    [targetModule]
  );

  if (!modRows || modRows.length === 0) return noPerms;
  const moduloId = modRows[0].modulo_sistema_id;

  const rows = await query(
    `WITH user_roles AS (
       SELECT rf.rol_funcional_id
       FROM admin.rol_funcional rf
       WHERE rf.estado = 'ACTIVO'
         AND rf.rol_funcional_id IN (
           SELECT u.rol_principal_id FROM admin.usuario u WHERE u.usuario_id = $2 AND u.rol_principal_id IS NOT NULL AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
           UNION
           SELECT ura.rol_funcional_id FROM admin.usuario_rol_adicional ura JOIN admin.usuario u ON ura.usuario_id = u.usuario_id WHERE ura.usuario_id = $2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
         )
     ),
     user_custom AS (
       SELECT *
       FROM admin.usuario_permiso_personalizado
       WHERE usuario_id = $2 AND modulo_sistema_id = $1 AND pantalla_id IS NULL AND estado = 'ACTIVO'
       LIMIT 1
     ),
     role_perms AS (
       SELECT
         BOOL_OR(m.puede_ver) AS puede_ver,
         BOOL_OR(m.puede_crear) AS puede_crear,
         BOOL_OR(m.puede_editar) AS puede_editar,
         BOOL_OR(m.puede_inactivar) AS puede_inactivar,
         BOOL_OR(m.puede_exportar) AS puede_exportar,
         BOOL_OR(m.puede_importar) AS puede_importar,
         BOOL_OR(m.puede_aprobar) AS puede_aprobar,
         BOOL_OR(m.puede_asignar) AS puede_asignar,
         BOOL_OR(m.puede_mover) AS puede_mover,
         BOOL_OR(m.puede_cerrar) AS puede_cerrar,
         BOOL_OR(m.puede_reabrir) AS puede_reabrir,
         BOOL_OR(m.puede_eliminar) AS puede_eliminar
       FROM user_roles ur
       JOIN admin.matriz_acceso_rol m ON m.rol_funcional_id = ur.rol_funcional_id AND m.modulo_sistema_id = $1
     )
     SELECT
       COALESCE(uc.puede_ver, rp.puede_ver, false) AS puede_ver,
       COALESCE(uc.puede_crear, rp.puede_crear, false) AS puede_crear,
       COALESCE(uc.puede_editar, rp.puede_editar, false) AS puede_editar,
       COALESCE(uc.puede_inactivar, rp.puede_inactivar, false) AS puede_inactivar,
       COALESCE(uc.puede_exportar, rp.puede_exportar, false) AS puede_exportar,
       COALESCE(uc.puede_importar, rp.puede_importar, false) AS puede_importar,
       COALESCE(uc.puede_aprobar, rp.puede_aprobar, false) AS puede_aprobar,
       COALESCE(uc.puede_asignar, rp.puede_asignar, false) AS puede_asignar,
       COALESCE(uc.puede_mover, rp.puede_mover, false) AS puede_mover,
       COALESCE(uc.puede_cerrar, rp.puede_cerrar, false) AS puede_cerrar,
       COALESCE(uc.puede_reabrir, rp.puede_reabrir, false) AS puede_reabrir,
       COALESCE(uc.puede_eliminar, rp.puede_eliminar, false) AS puede_eliminar
     FROM role_perms rp
     FULL OUTER JOIN user_custom uc ON true`,
    [moduloId, usuarioId]
  );

  if (!rows || rows.length === 0 || !rows[0]) return noPerms;
  const r = rows[0];
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

async function getScreenPermissions(screenCodeOrPath, usuarioId) {
  const fullPerms = {
    puede_ver: true, puede_crear: true, puede_editar: true, puede_inactivar: true,
    puede_exportar: true, puede_importar: true, puede_aprobar: true, puede_asignar: true,
    puede_mover: true, puede_cerrar: true, puede_reabrir: true, puede_eliminar: true
  };
  const noPerms = {
    puede_ver: false, puede_crear: false, puede_editar: false, puede_inactivar: false,
    puede_exportar: false, puede_importar: false, puede_aprobar: false, puede_asignar: false,
    puede_mover: false, puede_cerrar: false, puede_reabrir: false, puede_eliminar: false
  };

  if (!usuarioId) return noPerms;

  const userCheck = await query(
    `SELECT estado FROM admin.usuario WHERE usuario_id = $1 LIMIT 1`,
    [usuarioId]
  );
  if (!userCheck || userCheck.length === 0 || (userCheck[0].estado && userCheck[0].estado !== 'ACTIVO')) {
    return noPerms;
  }

  if (await isSuperAdmin(usuarioId)) return fullPerms;

  const screenRows = await query(
    `SELECT pantalla_id, modulo_sistema_id
     FROM admin.pantalla_sistema
     WHERE activo = true
       AND (
         UPPER(codigo) = UPPER($1)
         OR ruta = $1
         OR (ruta LIKE '%?%' AND split_part(ruta, '?', 1) = split_part($1, '?', 1))
         OR ($1 LIKE (ruta || '%'))
       )
     ORDER BY CASE WHEN ruta = $1 THEN 1 WHEN UPPER(codigo) = UPPER($1) THEN 2 ELSE 3 END
     LIMIT 1`,
    [screenCodeOrPath]
  );

  if (!screenRows || screenRows.length === 0) {
    return getModulePermissions(screenCodeOrPath, usuarioId);
  }

  const pantallaId = screenRows[0].pantalla_id;
  const moduloId = screenRows[0].modulo_sistema_id;

  const rows = await query(
    `WITH user_roles AS (
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
     user_custom_module AS (
       SELECT *
       FROM admin.usuario_permiso_personalizado
       WHERE usuario_id = $2 AND modulo_sistema_id = $3 AND pantalla_id IS NULL AND estado = 'ACTIVO'
       LIMIT 1
     ),
     role_effective AS (
       SELECT
         BOOL_OR(COALESCE(map.puede_ver, mar.puede_ver, false)) AS puede_ver,
         BOOL_OR(COALESCE(map.puede_crear, mar.puede_crear, false)) AS puede_crear,
         BOOL_OR(COALESCE(map.puede_editar, mar.puede_editar, false)) AS puede_editar,
         BOOL_OR(COALESCE(map.puede_inactivar, mar.puede_inactivar, false)) AS puede_inactivar,
         BOOL_OR(COALESCE(map.puede_exportar, mar.puede_exportar, false)) AS puede_exportar,
         BOOL_OR(COALESCE(map.puede_importar, mar.puede_importar, false)) AS puede_importar,
         BOOL_OR(COALESCE(map.puede_aprobar, mar.puede_aprobar, false)) AS puede_aprobar,
         BOOL_OR(COALESCE(map.puede_asignar, mar.puede_asignar, false)) AS puede_asignar,
         BOOL_OR(COALESCE(map.puede_mover, mar.puede_mover, false)) AS puede_mover,
         BOOL_OR(COALESCE(map.puede_cerrar, mar.puede_cerrar, false)) AS puede_cerrar,
         BOOL_OR(COALESCE(map.puede_reabrir, mar.puede_reabrir, false)) AS puede_reabrir,
         BOOL_OR(COALESCE(map.puede_eliminar, mar.puede_eliminar, false)) AS puede_eliminar
       FROM user_roles ur
       LEFT JOIN admin.matriz_acceso_pantalla map 
         ON map.rol_funcional_id = ur.rol_funcional_id AND map.pantalla_id = $1
       LEFT JOIN admin.matriz_acceso_rol mar 
         ON mar.rol_funcional_id = ur.rol_funcional_id AND mar.modulo_sistema_id = $3
     )
     SELECT
       COALESCE(ucs.puede_ver, ucm.puede_ver, re.puede_ver, false) AS puede_ver,
       COALESCE(ucs.puede_crear, ucm.puede_crear, re.puede_crear, false) AS puede_crear,
       COALESCE(ucs.puede_editar, ucm.puede_editar, re.puede_editar, false) AS puede_editar,
       COALESCE(ucs.puede_inactivar, ucm.puede_inactivar, re.puede_inactivar, false) AS puede_inactivar,
       COALESCE(ucs.puede_exportar, ucm.puede_exportar, re.puede_exportar, false) AS puede_exportar,
       COALESCE(ucs.puede_importar, ucm.puede_importar, re.puede_importar, false) AS puede_importar,
       COALESCE(ucs.puede_aprobar, ucm.puede_aprobar, re.puede_aprobar, false) AS puede_aprobar,
       COALESCE(ucs.puede_asignar, ucm.puede_asignar, re.puede_asignar, false) AS puede_asignar,
       COALESCE(ucs.puede_mover, ucm.puede_mover, re.puede_mover, false) AS puede_mover,
       COALESCE(ucs.puede_cerrar, ucm.puede_cerrar, re.puede_cerrar, false) AS puede_cerrar,
       COALESCE(ucs.puede_reabrir, ucm.puede_reabrir, re.puede_reabrir, false) AS puede_reabrir,
       COALESCE(ucs.puede_eliminar, ucm.puede_eliminar, re.puede_eliminar, false) AS puede_eliminar
     FROM role_effective re
     LEFT JOIN user_custom_screen ucs ON true
     LEFT JOIN user_custom_module ucm ON true`,
    [pantallaId, usuarioId, moduloId]
  );

  if (!rows || rows.length === 0 || !rows[0]) return noPerms;
  const r = rows[0];
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

function validateCompanyAccess(sessionEmpresaId, targetEmpresaId, isSuper = false) {
  if (isSuper) return true;
  if (!sessionEmpresaId || !targetEmpresaId) return false;
  return Number(sessionEmpresaId) === Number(targetEmpresaId);
}

// SUITE DE PRUEBAS
const testResults = [];

function recordTest(suite, scenario, expected, actual, passed, details = "") {
  testResults.push({
    suite,
    scenario,
    expected,
    actual,
    status: passed ? "APROBADO" : "FALLIDO",
    details
  });
  console.log(`[${passed ? "APROBADO" : "FALLIDO"}] ${suite} :: ${scenario} -> ${details}`);
}

async function runAllTests() {
  console.log("\n========================================================");
  console.log("    EJECUTANDO AUDITORÍA Y TEST RBAC EN TIEMPO REAL     ");
  console.log("========================================================\n");

  dbClient = await pool.connect();

  try {
    // ---------------------------------------------------------
    // TEST 1: Super Administrador (Global Privileges)
    // ---------------------------------------------------------
    const superAdminUsers = await query(
      `SELECT u.usuario_id, r.nombre as rol
       FROM admin.usuario u
       JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
       WHERE u.rol_principal_id = 1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       LIMIT 1`
    );

    const testMod = (await query("SELECT modulo_sistema_id, nombre FROM admin.modulo_sistema WHERE estado = 'ACTIVO' LIMIT 1"))[0];
    const testScreen = (await query("SELECT pantalla_id, codigo, ruta, modulo_sistema_id FROM admin.pantalla_sistema WHERE activo = true LIMIT 1"))[0];

    if (superAdminUsers.length > 0) {
      const sId = superAdminUsers[0].usuario_id;
      const isSuper = await isSuperAdmin(sId);
      const sPerms = await getScreenPermissions(testScreen.ruta, sId);
      const allTrue = Object.values(sPerms).every(v => v === true);

      recordTest(
        "SuperAdmin",
        "Super Administrador activo conserva privilegios FULL globales",
        "isSuper: true, all 12 perms: true",
        `isSuper: ${isSuper}, all: ${allTrue}`,
        isSuper && allTrue,
        `Usuario ID ${sId} con rol ${superAdminUsers[0].rol}`
      );
    } else {
      recordTest("SuperAdmin", "Super Administrador existente", "Al menos 1 SuperAdmin activo", "0 encontrados", false);
    }

    // ---------------------------------------------------------
    // INICIAR TRANSACCIÓN AISLADA PARA LOS ESCENARIOS A - F
    // Esto garantiza que NO modificamos ni corrompemos datos de producción
    // ---------------------------------------------------------
    await dbClient.query("BEGIN");

    let currentRoleId = Number((await dbClient.query("SELECT COALESCE(MAX(rol_funcional_id), 0) AS id FROM admin.rol_funcional")).rows[0].id) + 5000;
    let currentUserId = Number((await dbClient.query("SELECT COALESCE(MAX(usuario_id), 0) AS id FROM admin.usuario")).rows[0].id) + 5000;
    let currentMatrizId = Number((await dbClient.query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) AS id FROM admin.matriz_acceso_rol")).rows[0].id) + 5000;

    async function createTempRole(nombre, descripcion, estado = 'ACTIVO') {
      currentRoleId++;
      await dbClient.query(
        `INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado)
         VALUES ($1, $2, $3, $4)`,
        [currentRoleId, nombre, descripcion, estado]
      );
      return currentRoleId;
    }

    async function createTempUser(rolPrincipalId, estado = 'ACTIVO') {
      currentUserId++;
      await dbClient.query(
        `INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, fecha_creacion)
         VALUES ($1, 1, COALESCE((SELECT tipo_usuario_id FROM admin.tipo_usuario LIMIT 1), 1), $2, $3, now())`,
        [currentUserId, rolPrincipalId, estado]
      );
      return currentUserId;
    }

    // ---------------------------------------------------------
    // ESCENARIO A: Usuario Consulta
    // ---------------------------------------------------------
    const rolConsultaId = await createTempRole('TEST_ROL_CONSULTA', 'Rol temporal de solo consulta');
    currentMatrizId++;
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_rol 
       (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO')`,
      [currentMatrizId, rolConsultaId, testMod.modulo_sistema_id]
    );

    const userAId = await createTempUser(rolConsultaId);

    const permsA = await getModulePermissions(testMod.modulo_sistema_id, userAId);
    const passA = permsA.puede_ver === true &&
                  permsA.puede_crear === false &&
                  permsA.puede_editar === false &&
                  permsA.puede_eliminar === false &&
                  permsA.puede_exportar === false &&
                  permsA.puede_aprobar === false;
    recordTest(
      "Escenario A",
      "Usuario Consulta puede VER pero no crear, editar, eliminar, exportar ni aprobar",
      "puede_ver: true, resto: false",
      `puede_ver: ${permsA.puede_ver}, puede_crear: ${permsA.puede_crear}, puede_editar: ${permsA.puede_editar}, puede_exportar: ${permsA.puede_exportar}`,
      passA,
      `Usuario ${userAId} con rol temporal ${rolConsultaId}`
    );

    // ---------------------------------------------------------
    // ESCENARIO B: Usuario Operador (VER, CREAR, EDITAR en pantalla autorizada)
    // ---------------------------------------------------------
    const rolOperadorId = await createTempRole('TEST_ROL_OPERADOR', 'Rol operador temporal');
    currentMatrizId++;
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_rol 
       (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, true, true, false, false, false, false, false, false, false, false, false, 'ACTIVO')`,
      [currentMatrizId, rolOperadorId, testScreen.modulo_sistema_id]
    );

    const userBId = await createTempUser(rolOperadorId);

    const permsB = await getScreenPermissions(testScreen.ruta, userBId);
    const passB = permsB.puede_ver === true &&
                  permsB.puede_crear === true &&
                  permsB.puede_editar === true &&
                  permsB.puede_eliminar === false &&
                  permsB.puede_aprobar === false;
    recordTest(
      "Escenario B",
      "Usuario Operador puede VER, CREAR y EDITAR, sin privilegios administrativos",
      "ver: true, crear: true, editar: true, eliminar: false, aprobar: false",
      `ver: ${permsB.puede_ver}, crear: ${permsB.puede_crear}, editar: ${permsB.puede_editar}, eliminar: ${permsB.puede_eliminar}, aprobar: ${permsB.puede_aprobar}`,
      passB,
      `Usuario ${userBId} con rol operador ${rolOperadorId}`
    );

    // ---------------------------------------------------------
    // ESCENARIO C: Usuario Supervisor (Operaciones extendidas: APROBAR, ASIGNAR, CERRAR, REABRIR)
    // ---------------------------------------------------------
    const rolSupervisorId = await createTempRole('TEST_ROL_SUPERVISOR', 'Rol supervisor temporal');
    currentMatrizId++;
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_rol 
       (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, true, true, true, true, false, true, true, true, true, true, false, 'ACTIVO')`,
      [currentMatrizId, rolSupervisorId, testScreen.modulo_sistema_id]
    );

    const userCId = await createTempUser(rolSupervisorId);

    const permsC = await getScreenPermissions(testScreen.ruta, userCId);
    const passC = permsC.puede_aprobar === true &&
                  permsC.puede_asignar === true &&
                  permsC.puede_cerrar === true &&
                  permsC.puede_reabrir === true &&
                  permsC.puede_mover === true;
    recordTest(
      "Escenario C",
      "Usuario Supervisor puede APROBAR, ASIGNAR, CERRAR, REABRIR y MOVER",
      "aprobar: true, asignar: true, cerrar: true, reabrir: true, mover: true",
      `aprobar: ${permsC.puede_aprobar}, asignar: ${permsC.puede_asignar}, cerrar: ${permsC.puede_cerrar}, reabrir: ${permsC.puede_reabrir}`,
      passC,
      `Usuario ${userCId} con rol supervisor ${rolSupervisorId}`
    );

    // ---------------------------------------------------------
    // ESCENARIO D: Acceso Restringido (Menú FULL pero Pantalla denegada explícitamente)
    // ---------------------------------------------------------
    const rolMenuFullId = await createTempRole('TEST_ROL_MENUGENERAL_FULL', 'Rol con modulo FULL pero pantalla restringida');
    currentMatrizId++;
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_rol 
       (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, true, true, true, true, true, true, true, true, true, true, true, 'ACTIVO')`,
      [currentMatrizId, rolMenuFullId, testScreen.modulo_sistema_id]
    );

    // Override en admin.matriz_acceso_pantalla: DENIEGA ACCESO A LA PANTALLA (puede_ver = false)
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_pantalla 
       (rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO')`,
      [rolMenuFullId, testScreen.pantalla_id]
    );

    const userDId = await createTempUser(rolMenuFullId);

    // Comprobar que en el módulo general puede_ver es true, pero en la pantalla específica es false
    const modPermsD = await getModulePermissions(testScreen.modulo_sistema_id, userDId);
    const screenPermsD = await getScreenPermissions(testScreen.ruta, userDId);

    const passD = modPermsD.puede_ver === true && screenPermsD.puede_ver === false;
    recordTest(
      "Escenario D",
      "Permiso general de Menú FULL NO anula la denegación específica de una Pantalla",
      "Menu puede_ver: true, Pantalla puede_ver: false",
      `Menu: ${modPermsD.puede_ver}, Pantalla: ${screenPermsD.puede_ver}`,
      passD,
      `Rol ${rolMenuFullId} con override en pantalla ${testScreen.pantalla_id}`
    );

    // ---------------------------------------------------------
    // ESCENARIO E: Permisos Personalizados (Excepción de Usuario prevalece sobre Rol)
    // ---------------------------------------------------------
    // Rol tiene puede_editar = true, pero usuario_permiso_personalizado tiene puede_editar = false
    await dbClient.query(
      `INSERT INTO admin.usuario_permiso_personalizado
       (usuario_id, pantalla_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, true, false, false, false, false, false, false, false, false, false, false, 'ACTIVO')`,
      [userBId, testScreen.pantalla_id, testScreen.modulo_sistema_id]
    );

    const permsE = await getScreenPermissions(testScreen.ruta, userBId);
    const passE = permsE.puede_ver === true && permsE.puede_crear === true && permsE.puede_editar === false;
    recordTest(
      "Escenario E",
      "Permiso personalizado del usuario anula y prevalece sobre la configuración del Rol",
      "puede_editar: false (a pesar de que el rol operador tiene puede_editar: true)",
      `puede_ver: ${permsE.puede_ver}, puede_crear: ${permsE.puede_crear}, puede_editar: ${permsE.puede_editar}`,
      passE,
      `Usuario ${userBId} con excepción en usuario_permiso_personalizado`
    );

    // ---------------------------------------------------------
    // ESCENARIO F1: Usuario Inactivo (estado = 'INACTIVO')
    // ---------------------------------------------------------
    const userInactivoId = await createTempUser(rolMenuFullId, 'INACTIVO');

    const permsF1 = await getScreenPermissions(testScreen.ruta, userInactivoId);
    const passF1 = Object.values(permsF1).every(v => v === false);
    recordTest(
      "Escenario F1",
      "Usuario inactivo recibe denegación total (0 permisos)",
      "Todos los permisos: false",
      `puede_ver: ${permsF1.puede_ver}, puede_editar: ${permsF1.puede_editar}`,
      passF1,
      `Usuario ID ${userInactivoId} con estado INACTIVO`
    );

    // ---------------------------------------------------------
    // ESCENARIO F2: Rol Inactivo (rol con estado = 'INACTIVO')
    // ---------------------------------------------------------
    const rolInactivoId = await createTempRole('TEST_ROL_INACTIVO', 'Rol inactivo temporal', 'INACTIVO');
    currentMatrizId++;
    await dbClient.query(
      `INSERT INTO admin.matriz_acceso_rol 
       (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado)
       VALUES ($1, $2, $3, true, true, true, true, true, true, true, true, true, true, true, true, 'ACTIVO')`,
      [currentMatrizId, rolInactivoId, testScreen.modulo_sistema_id]
    );

    const userWithInactiveRoleId = await createTempUser(rolInactivoId);

    const permsF2 = await getScreenPermissions(testScreen.ruta, userWithInactiveRoleId);
    const passF2 = Object.values(permsF2).every(v => v === false);
    recordTest(
      "Escenario F2",
      "Rol inactivo NO concede ningún privilegio al usuario",
      "Todos los permisos: false",
      `puede_ver: ${permsF2.puede_ver}, puede_editar: ${permsF2.puede_editar}`,
      passF2,
      `Usuario ${userWithInactiveRoleId} con rol ${rolInactivoId} en estado INACTIVO`
    );

    // ---------------------------------------------------------
    // ESCENARIO F3: Usuario sin roles asignados
    // ---------------------------------------------------------
    const userSinRolId = await createTempUser(null);

    const permsF3 = await getScreenPermissions(testScreen.ruta, userSinRolId);
    const passF3 = Object.values(permsF3).every(v => v === false);
    recordTest(
      "Escenario F3",
      "Usuario sin roles asignados produce denegación total (ausencia = denegación)",
      "Todos los permisos: false",
      `puede_ver: ${permsF3.puede_ver}`,
      passF3,
      `Usuario ${userSinRolId} sin rol_principal_id ni roles adicionales`
    );

    // ---------------------------------------------------------
    // ESCENARIO MULTITENANCY: Aislamiento por Empresa
    // ---------------------------------------------------------
    const multiEmp1 = validateCompanyAccess(1, 1, false);
    const multiEmp2 = validateCompanyAccess(1, 2, false);
    const multiEmpSuper = validateCompanyAccess(1, 2, true);
    const multiEmpNull = validateCompanyAccess(null, 1, false);

    const passMulti = multiEmp1 === true && multiEmp2 === false && multiEmpSuper === true && multiEmpNull === false;
    recordTest(
      "Multitenancy",
      "Aislamiento estricto de empresa: Empresa 1 no puede operar datos de Empresa 2",
      "Misma empresa: true, Diferente empresa: false, SuperAdmin: true, Sin empresa: false",
      `Misma: ${multiEmp1}, Distinta: ${multiEmp2}, Super: ${multiEmpSuper}, Nula: ${multiEmpNull}`,
      passMulti,
      "Validación de sesión y verificación de relaciones autorizadas"
    );

    // ---------------------------------------------------------
    // VALIDACIÓN EXHAUSTIVA DE CADA UNO DE LOS 12 PRIVILEGIOS
    // ---------------------------------------------------------
    const privilegeActions = [
      { name: "VER", key: "puede_ver" },
      { name: "CREAR", key: "puede_crear" },
      { name: "EDITAR", key: "puede_editar" },
      { name: "INACTIVAR", key: "puede_inactivar" },
      { name: "EXPORTAR", key: "puede_exportar" },
      { name: "IMPORTAR", key: "puede_importar" },
      { name: "APROBAR", key: "puede_aprobar" },
      { name: "ASIGNAR", key: "puede_asignar" },
      { name: "MOVER", key: "puede_mover" },
      { name: "CERRAR", key: "puede_cerrar" },
      { name: "REABRIR", key: "puede_reabrir" },
      { name: "ELIMINAR", key: "puede_eliminar" }
    ];

    for (const priv of privilegeActions) {
      const privRoleId = await createTempRole(`TEST_ROL_${priv.name}`, `Rol probando únicamente ${priv.name}`);
      currentMatrizId++;
      
      const cols = ["matriz_acceso_rol_id", "rol_funcional_id", "modulo_sistema_id", "estado"];
      const vals = [currentMatrizId, privRoleId, testScreen.modulo_sistema_id, 'ACTIVO'];
      
      for (const p of privilegeActions) {
        cols.push(p.key);
        vals.push(p.key === priv.key);
      }

      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      await dbClient.query(
        `INSERT INTO admin.matriz_acceso_rol (${cols.join(", ")}) VALUES (${placeholders})`,
        vals
      );

      const privUserId = await createTempUser(privRoleId);
      const privPerms = await getScreenPermissions(testScreen.ruta, privUserId);

      const isGranted = privPerms[priv.key] === true;
      const otherKeysCorrect = privilegeActions
        .filter(p => p.key !== priv.key)
        .every(p => privPerms[p.key] === false);

      recordTest(
        "Privilegio",
        `Privilegio aislado [${priv.name}] concedido exclusivamente`,
        `${priv.key}: true, resto: false`,
        `${priv.key}: ${privPerms[priv.key]}, otros: ${otherKeysCorrect ? "todos false" : "error"}`,
        isGranted && otherKeysCorrect,
        `Verificación de concesión y denegación atómica de ${priv.name}`
      );
    }

    // ---------------------------------------------------------
    // ROLLBACK DE LA TRANSACCIÓN AISLADA
    // No deja ningún registro temporal en la base de datos de producción
    // ---------------------------------------------------------
    await dbClient.query("ROLLBACK");
    console.log("\n✅ Transacción de prueba revertida (ROLLBACK) limpiamente. Base de datos intacta.");

  } catch (err) {
    if (dbClient) await dbClient.query("ROLLBACK").catch(() => {});
    console.error("❌ Error durante la ejecución de las pruebas:", err);
  } finally {
    if (dbClient) dbClient.release();
  }

  // Resumen
  console.log("\n========================================================");
  console.log("            MATRIZ RESUMEN DE PRUEBAS RBAC              ");
  console.log("========================================================");
  const total = testResults.length;
  const passed = testResults.filter(t => t.status === "APROBADO").length;
  const failed = testResults.filter(t => t.status === "FALLIDO").length;
  console.table(testResults.map(r => ({
    Suite: r.suite,
    Escenario: r.scenario,
    Resultado: r.status,
    Evidencia: r.details
  })));
  console.log(`\nTOTAL PRUEBAS: ${total} | APROBADAS: ${passed} | FALLIDAS: ${failed}`);

  await pool.end();
}

runAllTests();
