import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { nombre } = await req.json();
    const maxRes = await query("SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional");
    const nextId = (maxRes as any[])[0].next_id;
    await query("INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, estado) VALUES ($1, $2, 'ACTIVO')", [nextId, nombre]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
