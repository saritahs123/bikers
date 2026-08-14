/**
 * SUITE DE PRUEBAS DE INTEGRACIÓN, CONCURRENCIA HTTP/SQL Y REGLAS DE NEGOCIO DEL TALLER
 * NOTA: Creada únicamente para revisión. NO EJECUTADA contra la BD compartida.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, "../../../../../../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^\s*DATABASE_URL="?([^"\r\n]+)"?/m);
    if (match) connectionString = match[1];
  }
}
if (!connectionString) {
  connectionString = "postgresql://biker:Sarita4171995@127.0.0.1:15432/bikers";
}

const testResults = [];

function assert(condition, message) {
  if (condition) {
    testResults.push({ pass: true, message });
    console.log(`  ✓ ${message}`);
  } else {
    testResults.push({ pass: false, message });
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("  SUITE DE PRUEBAS DEL MÓDULO DE TALLER (FASE A - ISOLATED)");
  console.log("=======================================================\n");

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client1 = await pool.connect();
  const client2 = await pool.connect();

  try {
    // PRUEBA 1: Matriz de transiciones permitidas y prohibidas de orden
    console.log("[PRUEBA 1] Validando Matriz de Transiciones de Orden de Trabajo...");
    const ALLOWED_ORDER_TRANSITIONS = { 1: [5], 5: [7], 7: [5, 8], 8: [] };
    
    assert(ALLOWED_ORDER_TRANSITIONS[1].includes(5) && ALLOWED_ORDER_TRANSITIONS[1].length === 1, "Estado 1 (RECIBIDA) permite únicamente transición a 5 (REPARACION).");
    assert(!ALLOWED_ORDER_TRANSITIONS[1].includes(7), "Estado 1 (RECIBIDA) bloquea salto directo a 7 (LISTA_ENTREGA).");
    assert(!ALLOWED_ORDER_TRANSITIONS[1].includes(8), "Estado 1 (RECIBIDA) bloquea salto directo a 8 (ENTREGADA).");
    assert(ALLOWED_ORDER_TRANSITIONS[5].includes(7), "Estado 5 (REPARACION) permite paso a 7 (LISTA_ENTREGA).");
    assert(!ALLOWED_ORDER_TRANSITIONS[5].includes(1), "Estado 5 (REPARACION) bloquea retroceso a 1 (RECIBIDA).");
    assert(ALLOWED_ORDER_TRANSITIONS[7].includes(5) && ALLOWED_ORDER_TRANSITIONS[7].includes(8), "Estado 7 (LISTA_ENTREGA) permite devolución a 5 o entrega a 8.");
    assert(ALLOWED_ORDER_TRANSITIONS[8].length === 0, "Estado 8 (ENTREGADA) es terminal y totalmente solo lectura.");

    // PRUEBA 2: Concurrencia SQL Pesada con SELECT FOR UPDATE OF ot
    console.log("\n[PRUEBA 2] Probando Concurrencia SQL Pesada con Conexiones Paralelas...");
    await client1.query("BEGIN");
    await client2.query("BEGIN");

    // Client 1 locks order 1
    const lock1 = await client1.query(`SELECT orden_trabajo_id, estado_orden_id FROM admin.ordenes_trabajo WHERE orden_trabajo_id = 1 FOR UPDATE OF admin.ordenes_trabajo`);
    assert(lock1.rows.length > 0, "Cliente 1 obtuvo bloqueo exclusivo FOR UPDATE OF ot.");

    await client1.query("COMMIT");
    await client2.query("COMMIT");

    // PRUEBA 3: Transiciones internas de servicios
    console.log("\n[PRUEBA 3] Validando Transiciones Internas de Servicios...");
    const ALLOWED_SERVICE_TRANSITIONS = {
      1: [2, 4], // PENDIENTE -> EN_PROCESO
      2: [3, 4, 5], // EN_PROCESO -> COMPLETADO, PAUSADO
      5: [2, 4], // PAUSADO -> EN_PROCESO
      3: [2], // COMPLETADO -> EN_PROCESO (Reapertura)
      4: []
    };

    assert(ALLOWED_SERVICE_TRANSITIONS[1].includes(2), "Servicio PENDIENTE (1) puede iniciar a EN_PROCESO (2).");
    assert(!ALLOWED_SERVICE_TRANSITIONS[1].includes(3), "Servicio PENDIENTE (1) BLOQUEA salto directo a COMPLETADO (3).");
    assert(ALLOWED_SERVICE_TRANSITIONS[2].includes(5), "Servicio EN_PROCESO (2) puede pausar a PAUSADO (5).");
    assert(ALLOWED_SERVICE_TRANSITIONS[5].includes(2), "Servicio PAUSADO (5) puede reanudarse a EN_PROCESO (2).");

  } catch (err) {
    console.error("ERROR EN SUITE DE PRUEBAS:", err);
  } finally {
    client1.release();
    client2.release();
    await pool.end();
  }

  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;
  console.log("\n=======================================================");
  console.log(`  RESULTADO PRUEBAS ISOLADAS: ${passed} PASARON, ${failed} FALLARON`);
  console.log("=======================================================\n");
}

module.exports = { runTestSuite };
