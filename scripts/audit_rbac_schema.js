const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No DATABASE_URL in environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  try {
    console.log("=== AUDITORÍA DE ESQUEMA ADMIN ===");
    
    // 1. Todas las tablas en admin
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'admin' ORDER BY table_name;`
    );
    console.log("Tablas en admin:");
    for (const r of tables.rows) {
      console.log("- " + r.table_name);
    }

    // 2. Tablas relevantes
    const tablesOfInterest = [
      'usuario',
      'rol_funcional',
      'usuario_rol_adicional',
      'matriz_acceso_rol',
      'matriz_acceso_pantalla',
      'modulo_sistema',
      'pantalla_sistema',
      'empresa',
      'usuario_permiso_personalizado',
      'permiso_personalizado'
    ];

    for (const t of tablesOfInterest) {
      const exists = tables.rows.some(r => r.table_name === t);
      if (!exists) {
        console.log(`\n❌ Tabla admin.${t}: NO EXISTE`);
        continue;
      }
      console.log(`\n✅ Tabla admin.${t}:`);
      const cols = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default 
         FROM information_schema.columns 
         WHERE table_schema = 'admin' AND table_name = $1 
         ORDER BY ordinal_position;`,
        [t]
      );
      console.table(cols.rows.map(c => ({
        columna: c.column_name,
        tipo: c.data_type,
        nullable: c.is_nullable,
        default: c.column_default
      })));
    }

    // 3. Tablas o columnas con "permiso" o "personalizado" en toda la base de datos
    console.log("\n--- Búsqueda de tablas/columnas relacionadas con 'permiso' o 'personalizado' ---");
    const permisoCols = await pool.query(
      `SELECT table_schema, table_name, column_name 
       FROM information_schema.columns 
       WHERE column_name ILIKE '%permiso%' OR table_name ILIKE '%permiso%'
       ORDER BY table_schema, table_name;`
    );
    console.table(permisoCols.rows);

    // 4. Ver roles funcionales reales
    console.log("\n--- Roles funcionales actuales ---");
    const roles = await pool.query(
      `SELECT rol_funcional_id, nombre, estado, descripcion FROM admin.rol_funcional ORDER BY rol_funcional_id;`
    );
    console.table(roles.rows);

    // 2b. Inspeccionar admin.usuario
    const usuarioCols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'usuario';`
    );
    console.log("Columnas de admin.usuario:", usuarioCols.rows.map(c => c.column_name));

    // 5. Ver usuarios reales y sus asignaciones
    console.log("\n--- Usuarios y sus roles asignados ---");
    const usuarios = await pool.query(
      `SELECT u.usuario_id, ui.nombre, ui.apellido, ui.correo_electronico, u.estado, u.empresa_id, u.rol_principal_id,
              rf.nombre as rol_principal_nombre,
              ARRAY_AGG(ra.rol_funcional_id) FILTER (WHERE ra.rol_funcional_id IS NOT NULL) as roles_adicionales_ids
       FROM admin.usuario u
       LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
       LEFT JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
       LEFT JOIN admin.usuario_rol_adicional ra ON u.usuario_id = ra.usuario_id
       GROUP BY u.usuario_id, ui.nombre, ui.apellido, ui.correo_electronico, u.estado, u.empresa_id, u.rol_principal_id, rf.nombre
       ORDER BY u.usuario_id;`
    );
    console.table(usuarios.rows);

    // 7. Inspección de tablas de acceso y alcance de usuario
    console.log("\n--- Tablas de acceso y alcance de usuario ---");
    const userAccessTables = [
      'usuario_configuracion_acceso',
      'usuario_alcance',
      'usuario_alcance_accion',
      'usuario_alcance_detalle',
      'usuario_rol_adicional'
    ];

    for (const t of userAccessTables) {
      const cols = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = $1 ORDER BY ordinal_position",
        [t]
      );
      console.log("\n=== " + t + " ===");
      console.table(cols.rows);
      const data = await pool.query("SELECT * FROM admin." + t + " LIMIT 5");
      console.log("Muestra de datos (total filas en muestra: " + data.rows.length + "):");
      console.dir(data.rows, { depth: null });
    }

  } catch (err) {
    console.error("Error durante auditoría:", err);
  } finally {
    await pool.end();
  }
}

runAudit();
