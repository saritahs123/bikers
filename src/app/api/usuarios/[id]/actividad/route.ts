import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authorizeUserAccess } from "@/lib/userAuth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;

    const sql = `
      SELECT *
      FROM admin.usuario_actividad
      WHERE usuario_id = $1
      ORDER BY fecha_hora DESC
    `;

    let rows = await query(sql, [userId]);

    const mapped = (rows || []).map((r: any) => ({
      id: r.actividad_id || r.id,
      actividad_id: r.actividad_id || r.id,
      usuario_id: r.usuario_id,
      timestamp: r.fecha_hora || r.timestamp || null,
      fecha_hora: r.fecha_hora || r.timestamp || null,
      event: r.evento || r.event || r.tipo_accion || "Actividad Operativa",
      evento: r.evento || r.event || r.tipo_accion || "Actividad Operativa",
      tipo_accion: r.tipo_accion || r.evento || r.event || "Consultar",
      module: r.modulo || r.module || "Seguridad",
      modulo: r.modulo || r.module || "Seguridad",
      desc: r.descripcion || r.desc || "",
      descripcion: r.descripcion || r.desc || "",
      result: r.resultado || r.result || "Exitoso",
      resultado: r.resultado || r.result || "Exitoso",
      ip: r.direccion_ip || r.ip || "127.0.0.1",
      direccion_ip: r.direccion_ip || r.ip || "127.0.0.1",
      device: r.dispositivo || r.device || "Navegador Web",
      dispositivo: r.dispositivo || r.device || "Navegador Web",
      tabla_afectada: r.tabla_afectada || null,
      registro_afectado: r.registro_afectado || null,
      url: r.url || null,
      metodo_http: r.metodo_http || null,
      duracion_ms: r.duracion_ms || r.duracion || null,
      valor_anterior: r.valor_anterior || r.antes || null,
      valor_nuevo: r.valor_nuevo || r.despues || null,
      antes: r.antes || r.valor_anterior || null,
      despues: r.despues || r.valor_nuevo || null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error fetching usuario_actividad:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authorizeUserAccess(id);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.targetUserId;
    const body = await req.json();

    const { modulo = 'Seguridad', evento = 'Actividad', descripcion = '', resultado = 'Éxito', direccion_ip = '127.0.0.1', dispositivo = 'Navegador Web' } = body;

    await query(`
      INSERT INTO admin.usuario_actividad 
      (usuario_id, fecha_hora, modulo, evento, descripcion, resultado, direccion_ip, dispositivo)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
    `, [userId, modulo, evento, descripcion, resultado, direccion_ip, dispositivo]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error inserting usuario_actividad:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
