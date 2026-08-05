import { query } from "../src/lib/db";

async function main() {
  try {
    console.log("--- BICYCLE FOTOS ---");
    const fotos = await query(`SELECT * FROM admin.bicicleta_fotos LIMIT 20`);
    console.log("Fotos in DB:", JSON.stringify(fotos, null, 2));

    console.log("\n--- BICYCLES ---");
    const bikes = await query(`SELECT bicicleta_id, marca, modelo FROM admin.bicicletas WHERE fecha_eliminacion IS NULL`);
    console.log("Bikes in DB:", JSON.stringify(bikes, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
