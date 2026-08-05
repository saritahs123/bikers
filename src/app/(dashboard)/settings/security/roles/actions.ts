"use server";

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type FullRoleData = {
  roles: any[];
  modulos: any[];
  matriz: any[];
};

export async function getUnifiedRoleData(): Promise<FullRoleData> {
  try {
    const rolesRes = await query(
      "SELECT rol_funcional_id, nombre, descripcion, estado, fecha_creacion FROM admin.rol_funcional ORDER BY rol_funcional_id ASC"
    );
    const modulosRes = await query(
      "SELECT modulo_sistema_id, nombre, orden FROM admin.modulo_sistema WHERE estado = 'ACTIVO' ORDER BY orden ASC"
    );
    const matrizRes = await query(
      "SELECT * FROM admin.matriz_acceso_rol"
    );
    
    return {
      roles: rolesRes as any[],
      modulos: modulosRes as any[],
      matriz: matrizRes as any[],
    };
  } catch (error) {
    console.error("Error fetching unified role data:", error);
    return { roles: [], modulos: [], matriz: [] };
  }
}

export async function createRole(formData: FormData) {
  const nombre = formData.get("nombre") as string;
  const descripcion = formData.get("descripcion") as string;

  if (!nombre) {
    return { error: "El nombre es requerido" };
  }

  try {
    await query(
      "INSERT INTO admin.rol_funcional (nombre, descripcion, estado) VALUES ($1, $2, 'ACTIVO')",
      [nombre, descripcion]
    );

    revalidatePath("/settings/security/roles");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating role:", error);
    try {
      const maxRes = await query("SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional");
      const nextId = (maxRes as any[])[0].next_id;
      
      await query(
        "INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado) VALUES ($1, $2, $3, 'ACTIVO')",
        [nextId, nombre, descripcion]
      );
      
      revalidatePath("/settings/security/roles");
      return { success: true };
    } catch (fallbackError: any) {
      return { error: fallbackError.message };
    }
  }
}

export type MatrixRowUpdate = {
  modulo_sistema_id: number;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_inactivar: boolean;
  puede_exportar: boolean;
  puede_importar: boolean;
  puede_aprobar: boolean;
  puede_asignar: boolean;
  puede_mover: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  puede_eliminar: boolean;
};

export async function saveRoleMatrix(rol_funcional_id: number, updates: MatrixRowUpdate[]) {
  try {
    for (const update of updates) {
      const existing = await query(
        "SELECT matriz_acceso_rol_id FROM admin.matriz_acceso_rol WHERE rol_funcional_id = $1 AND modulo_sistema_id = $2",
        [rol_funcional_id, update.modulo_sistema_id]
      ) as any[];

      if (existing.length > 0) {
        await query(
          `UPDATE admin.matriz_acceso_rol 
           SET puede_ver = $1, puede_crear = $2, puede_editar = $3, puede_inactivar = $4,
               puede_exportar = $5, puede_importar = $6, puede_aprobar = $7, puede_asignar = $8,
               puede_mover = $9, puede_cerrar = $10, puede_reabrir = $11, puede_eliminar = $12,
               fecha_actualizacion = clock_timestamp() 
           WHERE matriz_acceso_rol_id = $13`,
          [
            update.puede_ver, update.puede_crear, update.puede_editar, update.puede_inactivar,
            update.puede_exportar, update.puede_importar, update.puede_aprobar, update.puede_asignar,
            update.puede_mover, update.puede_cerrar, update.puede_reabrir, update.puede_eliminar,
            existing[0].matriz_acceso_rol_id
          ]
        );
      } else {
        const maxRes = await query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 AS next_id FROM admin.matriz_acceso_rol");
        const nextId = (maxRes as any[])[0].next_id;
        
        await query(
          `INSERT INTO admin.matriz_acceso_rol 
           (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, 
            puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
            puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ACTIVO')`,
          [
            nextId, rol_funcional_id, update.modulo_sistema_id,
            update.puede_ver, update.puede_crear, update.puede_editar, update.puede_inactivar,
            update.puede_exportar, update.puede_importar, update.puede_aprobar, update.puede_asignar,
            update.puede_mover, update.puede_cerrar, update.puede_reabrir, update.puede_eliminar
          ]
        );
      }
    }
    
    revalidatePath("/settings/security/roles");
    return { success: true };
  } catch (error: any) {
    console.error("Error saving role matrix:", error);
    return { error: error.message };
  }
}
