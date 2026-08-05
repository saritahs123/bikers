import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const rolesRes = await query("SELECT rol_funcional_id as \"numericId\", nombre as nombre, descripcion, estado FROM admin.rol_funcional ORDER BY rol_funcional_id ASC");
    const modulosRes = await query("SELECT modulo_sistema_id as id, nombre as label, orden FROM admin.modulo_sistema WHERE estado = 'ACTIVO' ORDER BY orden ASC");
    const matrizRes = await query("SELECT * FROM admin.matriz_acceso_rol");

    const matrixMap: any = {};
    (rolesRes as any[]).forEach(r => {
      matrixMap[r.nombre] = {};
    });

    (matrizRes as any[]).forEach(item => {
      const role = (rolesRes as any[]).find(r => r.numericId === item.rol_funcional_id);
      if (role) {
        const actions = [];
        if (item.puede_ver) actions.push('ver');
        if (item.puede_crear) actions.push('crear');
        if (item.puede_editar) actions.push('editar');
        if (item.puede_inactivar) actions.push('inactivar');
        if (item.puede_exportar) actions.push('exportar');
        if (item.puede_importar) actions.push('importar');
        if (item.puede_aprobar) actions.push('aprobar');
        if (item.puede_asignar) actions.push('asignar');
        if (item.puede_mover) actions.push('mover');
        if (item.puede_cerrar) actions.push('cerrar');
        if (item.puede_reabrir) actions.push('reabrir');
        if (item.puede_eliminar) actions.push('eliminar');
        
        matrixMap[role.nombre][item.modulo_sistema_id] = actions;
      }
    });

    return NextResponse.json({
      modules: modulosRes,
      roles: rolesRes,
      matrix: matrixMap,
      rawMatrix: matrizRes
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const rolesRes = await query("SELECT rol_funcional_id, nombre FROM admin.rol_funcional");
    
    // Clear existing for those roles
    for (const roleName of Object.keys(body)) {
      const role = (rolesRes as any[]).find(r => r.nombre === roleName);
      if (role) {
        await query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = $1", [role.rol_funcional_id]);
        
        const modules = body[roleName];
        
        // Get Max ID once
        const maxRes = await query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) AS max_id FROM admin.matriz_acceso_rol");
        let currentId = Number((maxRes as any[])[0].max_id);
        
        const insertPromises = [];
        for (const modId of Object.keys(modules)) {
          const actions = modules[modId];
          const ver = actions.includes('ver');
          const crear = actions.includes('crear');
          const editar = actions.includes('editar');
          const inactivar = actions.includes('inactivar');
          const exportar = actions.includes('exportar');
          const importar = actions.includes('importar');
          const aprobar = actions.includes('aprobar');
          const asignar = actions.includes('asignar');
          const mover = actions.includes('mover');
          const cerrar = actions.includes('cerrar');
          const reabrir = actions.includes('reabrir');
          const eliminar = actions.includes('eliminar');

          currentId++;

          insertPromises.push(query(
            `INSERT INTO admin.matriz_acceso_rol 
            (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, 
              puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
              puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ACTIVO')`,
            [
              currentId, role.rol_funcional_id, Number(modId),
              ver, crear, editar, inactivar, exportar, importar, aprobar, asignar, mover, cerrar, reabrir, eliminar
            ]
          ));
        }
        await Promise.all(insertPromises);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { nombre } = await req.json();
    const maxRes = await query("SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 AS next_id FROM admin.modulo_sistema");
    const nextId = (maxRes as any[])[0].next_id;
    await query("INSERT INTO admin.modulo_sistema (modulo_sistema_id, nombre, orden, estado) VALUES ($1, $2, $3, 'ACTIVO')", [nextId, nombre, nextId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
