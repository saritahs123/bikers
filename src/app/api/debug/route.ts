import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' 
      AND table_name IN ('usuario', 'usuario_identidad', 'rol_funcional', 'tipo_usuario', 'departamento', 'area', 'empresa', 'usuario_seguridad', 'usuario_sesion', 'usuario_actividad', 'usuario_auditoria')
    `);
    return NextResponse.json({ schema: res });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
