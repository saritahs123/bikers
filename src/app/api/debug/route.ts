import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const columns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'usuario_sesion'
      ORDER BY ordinal_position
    `);
    const tableExists = await query(`
      SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'usuario_sesion'
    `);
    return NextResponse.json({ tableExists, columns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
