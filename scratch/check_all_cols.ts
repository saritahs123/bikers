import { query } from "@/lib/db";

async function checkCols() {
  try {
    const otCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'ordenes_trabajo'
      ORDER BY ordinal_position;
    `);
    console.log("=== ORDENES_TRABAJO COLUMNS ===");
    console.log(otCols);

    const osCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'orden_servicios'
      ORDER BY ordinal_position;
    `);
    console.log("=== ORDEN_SERVICIOS COLUMNS ===");
    console.log(osCols);
  } catch (err) {
    console.error(err);
  }
}

checkCols();
