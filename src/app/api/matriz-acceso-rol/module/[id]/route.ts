import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await query("UPDATE admin.modulo_sistema SET nombre = $1, orden = $2, estado = $3 WHERE modulo_sistema_id = $4", 
      [body.nombre, body.orden || null, body.estado || 'ACTIVO', id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("UPDATE admin.modulo_sistema SET estado = 'INACTIVO' WHERE modulo_sistema_id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
