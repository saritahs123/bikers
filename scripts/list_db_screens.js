const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT p.pantalla_id, p.codigo, p.nombre, p.ruta, m.nombre as modulo, p.activo
    FROM admin.pantalla_sistema p
    JOIN admin.modulo_sistema m ON p.modulo_sistema_id = m.modulo_sistema_id
    ORDER BY m.orden, p.orden;
  `);
  console.table(res.rows);
  console.log(`Total pantallas en base de datos: ${res.rows.length}`);
  await pool.end();
}

main();
