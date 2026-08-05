const { query } = require('../src/lib/db.ts');

async function checkTables() {
  try {
    const res = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'admin' 
      ORDER BY table_name;
    `);
    console.log("TABLES IN admin SCHEMA:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkTables();
