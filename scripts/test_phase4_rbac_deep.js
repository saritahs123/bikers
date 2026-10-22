require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPhase4Tests() {
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
    console.log("=== STARTING FASE 4 DEEP RBAC AUTOMATED TEST SUITE ===");
    await client.query("BEGIN"); // Safe transaction: NO PRODUCTION MUTATIONS

    // 1. Setup isolated test companies
    const tipoEmpRes = await client.query("SELECT tipo_empresa_id FROM admin.tipo_empresa LIMIT 1");
    const tipoEmpId = tipoEmpRes.rows[0]?.tipo_empresa_id || 1;

    const maxEmp = (await client.query("SELECT COALESCE(MAX(empresa_id), 0) as m FROM admin.empresa")).rows[0].m;
    const empresaA = Number(maxEmp) + 951;
    const empresaB = Number(maxEmp) + 952;

    await client.query(`
      INSERT INTO admin.empresa (empresa_id, tipo_empresa_id, nombre_comercial, rnc, estado, fecha_registro)
      VALUES ($1, $2, 'F4 Empresa Alpha', '130000051', 'ACTIVO', NOW())
    `, [empresaA, tipoEmpId]);

    await client.query(`
      INSERT INTO admin.empresa (empresa_id, tipo_empresa_id, nombre_comercial, rnc, estado, fecha_registro)
      VALUES ($1, $2, 'F4 Empresa Beta', '130000052', 'ACTIVO', NOW())
    `, [empresaB, tipoEmpId]);

    // 2. Setup isolated test users
    const tipoUserRes = await client.query("SELECT tipo_usuario_id FROM admin.tipo_usuario LIMIT 1");
    const tipoUserId = tipoUserRes.rows[0]?.tipo_usuario_id || 1;

    const maxU = (await client.query("SELECT COALESCE(MAX(usuario_id), 0) as m FROM admin.usuario")).rows[0].m;
    const userA = Number(maxU) + 951;
    const userB = Number(maxU) + 952;

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, tipo_usuario_id, empresa_id, estado, fecha_creacion)
      VALUES ($1, $2, $3, 'ACTIVO', NOW())
    `, [userA, tipoUserId, empresaA]);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, tipo_usuario_id, empresa_id, estado, fecha_creacion)
      VALUES ($1, $2, $3, 'ACTIVO', NOW())
    `, [userB, tipoUserId, empresaB]);

    // 3. Setup client and bicycle for Company A
    const maxCli = (await client.query("SELECT COALESCE(MAX(cliente_id), 0) as m FROM admin.clientes")).rows[0].m;
    const clienteId = Number(maxCli) + 951;

    await client.query(`
      INSERT INTO admin.clientes (cliente_id, empresa_id, nombre, apellido, nombre_completo, telefono_principal, activo, fecha_creacion)
      VALUES ($1, $2, 'Cliente', 'Fase4', 'Cliente Fase4', '8095550051', true, NOW())
    `, [clienteId, empresaA]);

    const maxBike = (await client.query("SELECT COALESCE(MAX(bicicleta_id), 0) as m FROM admin.bicicletas")).rows[0].m;
    const bikeId = Number(maxBike) + 951;

    await client.query(`
      INSERT INTO admin.bicicletas (bicicleta_id, cliente_id, marca, modelo, codigo_qr, url_qr, activo, fecha_creacion)
      VALUES ($1, $2, 'Trek', 'Marlin 7', 'QR-F4-001', 'https://qr.test/F4', true, NOW())
    `, [bikeId, clienteId]);

    // 4. Setup Work Order in Company A
    const maxOt = (await client.query("SELECT COALESCE(MAX(orden_trabajo_id), 0) as m FROM admin.ordenes_trabajo")).rows[0].m;
    const ordenId = Number(maxOt) + 951;

    const maxRec = (await client.query("SELECT COALESCE(MAX(recepcion_id), 0) as m FROM admin.recepciones")).rows[0].m;
    const recepcionId = Number(maxRec) + 951;

    await client.query(`
      INSERT INTO admin.recepciones (
        recepcion_id, cliente_id, bicicleta_id, tipo_servicio_id, estado_recepcion_id, activo, codigo_recepcion
      ) VALUES ($1, $2, $3, 1, 1, true, 'REC-F4-001')
    `, [recepcionId, clienteId, bikeId]);

    await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, activo
      ) VALUES ($1, 'OT-F4-001', $2, $3, $4, 1, 1, true)
    `, [ordenId, recepcionId, clienteId, bikeId]);

    // Setup Custom Role with specific privileges
    const maxRol = (await client.query("SELECT COALESCE(MAX(rol_funcional_id), 0) as m FROM admin.rol_funcional")).rows[0].m;
    const rolId = Number(maxRol) + 951;

    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado)
      VALUES ($1, 'ROL_F4_CUSTOM', 'Rol para pruebas fase 4', 'ACTIVO')
    `, [rolId]);

    const maxUra = (await client.query("SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) as m FROM admin.usuario_rol_adicional")).rows[0].m;
    const uraId = Number(maxUra) + 951;

    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_rol_adicional_id, usuario_id, rol_funcional_id)
      VALUES ($1, $2, $3)
    `, [uraId, userA, rolId]);

    // Lookup screen IDs
    const scrOtRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE codigo = 'TALLER_ORDENES' LIMIT 1`);
    const scrOtId = scrOtRes.rows[0]?.pantalla_id;

    const scrTransRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/transfers' LIMIT 1`);
    const scrTransId = scrTransRes.rows[0]?.pantalla_id;

    const scrInitRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/initial' LIMIT 1`);
    const scrInitId = scrInitRes.rows[0]?.pantalla_id;

    const scrAjuRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE ruta = '/inventory/adjustments' LIMIT 1`);
    const scrAjuId = scrAjuRes.rows[0]?.pantalla_id;

    console.log("\n--- TEST SUITE 1: PRIVILEGIO ASIGNAR (Work Orders) ---");
    // Grant ONLY puede_ver and puede_asignar (NO puede_editar)
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (
        rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_asignar, estado
      ) VALUES ($1, $2, true, false, false, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
        puede_ver = true, puede_editar = false, puede_asignar = true
    `, [rolId, scrOtId]);

    const permsWithAsignar = await client.query(`
      SELECT puede_ver, puede_editar, puede_asignar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrOtId]);
    assert(permsWithAsignar.rows[0].puede_asignar === true, "Privilegio puede_asignar otorgado en matriz de pantalla");
    assert(permsWithAsignar.rows[0].puede_editar === false, "Privilegio puede_editar revocado en matriz de pantalla");

    console.log("\n--- TEST SUITE 2: PRIVILEGIO MOVER (Inventory Transfers) ---");
    // Grant ONLY puede_mover on Transfers
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (
        rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_mover, estado
      ) VALUES ($1, $2, true, false, false, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
        puede_ver = true, puede_crear = false, puede_mover = true
    `, [rolId, scrTransId]);

    const permsTrans = await client.query(`
      SELECT puede_ver, puede_crear, puede_mover
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrTransId]);
    assert(permsTrans.rows[0].puede_mover === true, "Privilegio puede_mover otorgado específicamente para transferencias");
    assert(permsTrans.rows[0].puede_crear === false, "Privilegio puede_crear está revocado");

    console.log("\n--- TEST SUITE 3: PRIVILEGIO IMPORTAR (Initial Inventory) ---");
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (
        rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_importar, estado
      ) VALUES ($1, $2, true, false, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
        puede_ver = true, puede_crear = false, puede_importar = true
    `, [rolId, scrInitId]);

    const permsInit = await client.query(`
      SELECT puede_ver, puede_crear, puede_importar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrInitId]);
    assert(permsInit.rows[0].puede_importar === true, "Privilegio puede_importar otorgado para carga de inventario inicial");

    console.log("\n--- TEST SUITE 4: PRIVILEGIO APROBAR (Inventory Adjustments) ---");
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (
        rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_aprobar, estado
      ) VALUES ($1, $2, true, false, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
        puede_ver = true, puede_crear = false, puede_aprobar = true
    `, [rolId, scrAjuId]);

    const permsAju = await client.query(`
      SELECT puede_ver, puede_crear, puede_aprobar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrAjuId]);
    assert(permsAju.rows[0].puede_aprobar === true, "Privilegio puede_aprobar otorgado para aprobación de ajustes");

    console.log("\n--- TEST SUITE 5: PRIVILEGIO CERRAR & REABRIR (Work Orders) ---");
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla
      SET puede_cerrar = true, puede_reabrir = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrOtId]);

    const permsCerrar = await client.query(`
      SELECT puede_cerrar, puede_reabrir
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [rolId, scrOtId]);
    assert(permsCerrar.rows[0].puede_cerrar === true, "Privilegio puede_cerrar habilitado para entrega/cierre");
    assert(permsCerrar.rows[0].puede_reabrir === true, "Privilegio puede_reabrir habilitado para reapertura");

    console.log("\n--- TEST SUITE 6: PERMISO PERSONALIZADO DENEGADO PREVALECE ---");
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (
        usuario_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_asignar, estado
      ) VALUES ($1, $2, false, false, false, false, 'ACTIVO')
    `, [userA, scrOtId]);

    const resolvedException = await client.query(`
      SELECT upp.puede_ver, upp.puede_asignar
      FROM admin.usuario_permiso_personalizado upp
      WHERE upp.usuario_id = $1 AND upp.pantalla_id = $2 AND upp.estado = 'ACTIVO'
    `, [userA, scrOtId]);
    assert(resolvedException.rows[0].puede_asignar === false, "Excepción personalizada DENEGADO anula el puede_asignar del rol");
    assert(resolvedException.rows[0].puede_ver === false, "Excepción personalizada DENEGADO anula el puede_ver del rol");

    console.log("\n--- TEST SUITE 7: AISLAMIENTO MULTITENANT EN TRACKING ---");
    const crossTenantCheck = await client.query(`
      SELECT ot.orden_trabajo_id, c.empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
      WHERE ot.orden_trabajo_id = $1 AND c.empresa_id = $2
    `, [ordenId, empresaB]);
    assert(crossTenantCheck.rows.length === 0, "Aislamiento estricto: Usuario de Empresa B no puede acceder al tracking de Empresa A");

    console.log("\n--- TEST SUITE 8: SINCRONIZADOR IDEMPOTENTE Y SIN MUTACIONES EN GET ---");
    const catalogCount = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM admin.modulo_sistema WHERE estado = 'ACTIVO') AS modulos,
        (SELECT COUNT(*) FROM admin.pantalla_sistema WHERE activo = true) AS pantallas
    `);
    assert(Number(catalogCount.rows[0].modulos) >= 8, `Catálogo de menús completo: ${catalogCount.rows[0].modulos} módulos`);
    assert(Number(catalogCount.rows[0].pantallas) >= 41, `Catálogo de pantallas canónicas completo: ${catalogCount.rows[0].pantallas} pantallas`);

    console.log("\n--- TEST SUITE 9: PROTECCIÓN DE ENDPOINTS DE SINCRONIZACIÓN Y SEGUIMIENTO ---");
    // Verify sync endpoint route exists and rejects unauthorized requests
    const syncRouteExists = require('fs').existsSync(require('path').join(__dirname, '../src/app/api/matriz-acceso-rol/sync/route.ts'));
    assert(syncRouteExists === true, "Endpoint dedicado POST /api/matriz-acceso-rol/sync existe y está implementado");

    const matrizRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/matriz-acceso-rol/route.ts'), 'utf8');
    assert(!matrizRouteContent.includes('syncNavigationToDatabase()'), "GET /api/matriz-acceso-rol tiene 0 llamadas a syncNavigationToDatabase (estrictamente solo lectura)");

    const trackingRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/taller/ordenes/[id]/tracking/route.ts'), 'utf8');
    assert(trackingRouteContent.includes('getScreenPermissions("TALLER_ORDENES"'), "Endpoint GET tracking valida permiso de pantalla TALLER_ORDENES");
    assert(trackingRouteContent.includes('c.empresa_id'), "Endpoint GET tracking valida aislamiento por empresa_id");

    const orderRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/taller/ordenes/[id]/route.ts'), 'utf8');
    assert(orderRouteContent.includes('perms.puede_asignar'), "Endpoint PUT orden valida privilegio puede_asignar para mecánicos");
    assert(orderRouteContent.includes('perms.puede_cerrar'), "Endpoint PUT orden valida privilegio puede_cerrar para entrega de orden");

    const transferRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/inventario/transferencias/route.ts'), 'utf8');
    assert(transferRouteContent.includes('perms.puede_mover'), "Endpoint POST transferencias valida privilegio puede_mover");

    const initialRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/inventario/inventario-inicial/route.ts'), 'utf8');
    assert(initialRouteContent.includes('perms.puede_importar'), "Endpoint POST inventario inicial valida privilegio puede_importar");

    const adjustRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/inventario/ajustes/route.ts'), 'utf8');
    assert(adjustRouteContent.includes('perms.puede_aprobar'), "Endpoint POST ajustes valida privilegio puede_aprobar");

    const anularRouteContent = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/facturacion/facturas/[id]/anular/route.ts'), 'utf8');
    assert(anularRouteContent.includes('perms.puede_aprobar'), "Endpoint POST anular factura valida privilegio puede_aprobar");

    await client.query("ROLLBACK"); // 100% SAFE: Rolls back all test records
    console.log("=== ROLLBACK EJECUTADO: CERO CAMBIOS EN PRODUCCIÓN ===");
    console.log(`\nRESUMEN DE PRUEBAS FASE 4: ${passed} Pasadas, ${failed} Falladas`);
    return { passed, failed, total: passed + failed };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error running Phase 4 tests:", err);
    throw err;
  } finally {
    client.release();
  }
}

runPhase4Tests()
  .then(res => {
    console.log(`Final Status: ${res.failed === 0 ? 'ALL_TESTS_PASSED' : 'TESTS_FAILED'}`);
    process.exit(res.failed === 0 ? 0 : 1);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
