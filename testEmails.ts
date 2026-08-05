import { query } from './src/lib/db'; 
async function run() { 
  const res = await query('SELECT correo_electronico FROM admin.usuario_identidad'); 
  console.log(res); 
} 
run();
