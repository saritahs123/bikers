import { config } from "dotenv";
config({ path: ".env.local" });

import { query } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import readline from "readline";

/**
 * CONTROLLED PASSWORD RESET SCRIPT
 * 
 * IMPORTANT: This script is intended strictly for administrative password assignment.
 * DO NOT execute against production databases without explicit user authorization!
 */

async function askQuestion(queryText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function resetPassword() {
  console.log("=== SCRIPT CONTROLADO DE RESTABLECIMIENTO DE CONTRASEÑA ===");
  console.log("ADVERTENCIA: No ejecutar contra bases de datos reales sin autorización explícita.\n");

  const targetEmail = (
    process.env.RESET_USER_EMAIL ||
    (await askQuestion("Ingrese el correo electrónico del usuario a restablecer: "))
  ).trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes("@")) {
    console.error("Error: Debe proporcionar un correo electrónico válido.");
    process.exit(1);
  }

  const newPassword = (
    process.env.NEW_PASSWORD ||
    (await askQuestion("Ingrese la nueva contraseña (mínimo 8 caracteres, máx 128): "))
  );

  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    console.error("Error: La contraseña debe tener entre 8 y 128 caracteres.");
    process.exit(1);
  }

  try {
    // 1. Locate user by email
    const users = await query(
      `SELECT u.usuario_id, ui.nombre, ui.apellido, u.estado 
       FROM admin.usuario_identidad ui
       JOIN admin.usuario u ON ui.usuario_id = u.usuario_id
       WHERE LOWER(ui.correo_electronico) = $1
       LIMIT 1`,
      [targetEmail]
    );

    if (!users || users.length === 0) {
      console.error(`Error: No se encontró ningún usuario registrado con el correo: ${targetEmail}`);
      process.exit(1);
    }

    const user = users[0];
    const userId = user.usuario_id;

    // 2. Generate secure scrypt hash using centralized utility
    const passwordHash = hashPassword(newPassword);

    // 3. Update password hash, reset failed attempts and unlock account atomically
    const existingSeg = await query(
      `SELECT 1 FROM admin.usuario_seguridad WHERE usuario_id = $1`,
      [userId]
    );

    if (existingSeg && existingSeg.length > 0) {
      await query(
        `UPDATE admin.usuario_seguridad
         SET 
           password = $1,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           motivo_bloqueo = NULL,
           fecha_ultimo_cambio_password = CURRENT_TIMESTAMP
         WHERE usuario_id = $2`,
        [passwordHash, userId]
      );
    } else {
      const maxSeg = await query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
      const nextSegId = Number(maxSeg[0]?.next_id || 1);

      await query(
        `INSERT INTO admin.usuario_seguridad
         (usuario_seguridad_id, usuario_id, password, intentos_fallidos, bloqueado_hasta, fecha_ultimo_cambio_password)
         VALUES ($1, $2, $3, 0, NULL, CURRENT_TIMESTAMP)`,
        [nextSegId, userId, passwordHash]
      );
    }

    // Audit log
    await query(
      `INSERT INTO admin.usuario_auditoria
       (auditoria_id, usuario_id, admin_id, fecha_hora, accion, valor_anterior, valor_nuevo, motivo, resultado, direccion_ip, dispositivo)
       VALUES 
       ((SELECT COALESCE(MAX(auditoria_id), 0) + 1 FROM admin.usuario_auditoria), $1, $1, CURRENT_TIMESTAMP, 'PASSWORD_RESET_SCRIPT', 'Hash anterior', 'Nuevo hash scrypt', 'Restablecimiento por script administrativo', 'COMPLETADO', '127.0.0.1', 'CLI Script')`,
      [userId]
    ).catch(() => {});

    console.log(`\n[ÉXITO] La contraseña del usuario '${targetEmail}' (ID: ${userId}) ha sido restablecida correctamente.`);
    console.log("Nota de Seguridad: La nueva contraseña y su hash NO han sido impresos en pantalla.");
  } catch (error: any) {
    console.error("Error durante el restablecimiento de contraseña:", error.message || error);
    process.exit(1);
  }
}

// Ensure it's not automatically run when imported
if (require.main === module) {
  resetPassword();
}
