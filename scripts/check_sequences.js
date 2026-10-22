const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const r = await pool.query(`
    SELECT pg_get_serial_sequence('admin.ordenes_trabajo', 'orden_trabajo_id') as ot_seq,
           pg_get_serial_sequence('admin.facturas', 'factura_id') as fac_seq
  `);
  console.log('SEQUENCES:', r.rows);
  await pool.end();
}
check();
