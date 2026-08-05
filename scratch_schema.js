const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:BikersFort2026@localhost:5432/bikers_fort_db', // Adjust if needed
});

async function run() {
  const tables = [
    'usuario', 'usuario_identidad', 'departamento', 'cargo', 'rol_funcional', 'matriz_acceso_rol'
  ];
  
  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = $1
    `, [table]);
    console.log(`\n--- TABLE: admin.${table} ---`);
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (Nullable: ${r.is_nullable}, Default: ${r.column_default})`));
  }
  pool.end();
}

run();
