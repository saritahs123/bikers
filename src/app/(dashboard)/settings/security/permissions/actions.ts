"use server";

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPermissionsData() {
  try {
    const rolesRes = await query("SELECT rol_funcional_id, nombre FROM admin.rol_funcional WHERE estado = 'ACTIVO' ORDER BY rol_funcional_id ASC");
    const modulosRes = await query("SELECT modulo_sistema_id, nombre, orden FROM admin.modulo_sistema WHERE estado = 'ACTIVO' ORDER BY orden ASC");
    const matrizRes = await query("SELECT * FROM admin.matriz_acceso_rol");

    return {
      roles: rolesRes as any[],
      modulos: modulosRes as any[],
      matriz: matrizRes as any[],
    };
  } catch (error) {
    console.error("Error fetching permissions data:", error);
    return { roles: [], modulos: [], matriz: [] };
  }
}

export type PermissionUpdate = {
  rol_funcional_id: number;
  modulo_sistema_id: number;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
};

export async function savePermissions(updates: PermissionUpdate[]) {
  try {
    // In a real scenario we might do a transaction, but we'll do sequential updates here for simplicity
    for (const update of updates) {
      // Check if it exists
      const existing = await query(
        "SELECT matriz_acceso_rol_id FROM admin.matriz_acceso_rol WHERE rol_funcional_id = $1 AND modulo_sistema_id = $2",
        [update.rol_funcional_id, update.modulo_sistema_id]
      ) as any[];

      if (existing.length > 0) {
        // Update
        await query(
          `UPDATE admin.matriz_acceso_rol 
           SET puede_ver = $1, puede_crear = $2, puede_editar = $3, puede_eliminar = $4, fecha_actualizacion = clock_timestamp() 
           WHERE matriz_acceso_rol_id = $5`,
          [update.puede_ver, update.puede_crear, update.puede_editar, update.puede_eliminar, existing[0].matriz_acceso_rol_id]
        );
      } else {
        // Insert
        // Calculate max ID for insert just in case
        const maxRes = await query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 AS next_id FROM admin.matriz_acceso_rol");
        const nextId = (maxRes as any[])[0].next_id;
        
        await query(
          `INSERT INTO admin.matriz_acceso_rol 
           (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar, puede_eliminar, estado) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVO')`,
          [nextId, update.rol_funcional_id, update.modulo_sistema_id, update.puede_ver, update.puede_crear, update.puede_editar, update.puede_eliminar]
        );
      }
    }
    
    revalidatePath("/settings/security/permissions");
    return { success: true };
  } catch (error: any) {
    console.error("Error saving permissions:", error);
    return { error: error.message };
  }
}
