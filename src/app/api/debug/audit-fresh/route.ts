import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tableCheck = await query(`
      SELECT
        to_regclass('admin.usuario_informacion') AS usuario_informacion,
        to_regclass('admin.usuario_identidad') AS usuario_identidad;
    `);

    const tiposUsuario = await query(`SELECT * FROM admin.tipo_usuario ORDER BY tipo_usuario_id;`);

    const columnasIdentidad = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'admin' AND table_name = 'usuario_identidad'
      ORDER BY ordinal_position;
    `);

    return NextResponse.json({
      tableCheck,
      tiposUsuario,
      columnasIdentidad
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
