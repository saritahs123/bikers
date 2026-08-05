import { config } from "dotenv";
config({ path: ".env.local" });
import { query } from "./src/lib/db";

async function run() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'admin'
    `);
    console.log(result.map((r: any) => r.table_name).join(', '));
  } catch (error) {
    console.error(error);
  }
}

run();
