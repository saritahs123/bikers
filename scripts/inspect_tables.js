const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const us = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'usuario_seguridad'
    ORDER BY ordinal_position
  `);
  console.log('USUARIO_SEGURIDAD:', us.rows);

  const ui = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'usuario_identidad'
    ORDER BY ordinal_position
  `);
  console.log('USUARIO_IDENTIDAD:', ui.rows);

  const ses = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'admin' AND table_name = 'usuario_sesion'
    ORDER BY ordinal_position
  `);
  console.log('USUARIO_SESION:', ses.rows);

  await pool.end();
}
check();
