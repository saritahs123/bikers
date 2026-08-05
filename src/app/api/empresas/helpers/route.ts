import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    // 1. Fetch all company types ordered by name
    let tiposEmpresa: any[] = [];
    try {
      tiposEmpresa = await query(`
        SELECT 
          tipo_empresa_id,
          nombre
        FROM admin.tipo_empresa
        ORDER BY nombre ASC
      `);
    } catch (e) {
      console.warn("Query admin.tipo_empresa for helpers failed:", e);
      try {
        tiposEmpresa = await query(`
          SELECT * FROM admin.tipo_empresa ORDER BY 1 ASC
        `);
      } catch (e2) {
        console.error("Could not query admin.tipo_empresa:", e2);
      }
    }

    // 2. Fetch all parent companies ordered by name
    let empresasPadre: any[] = [];
    try {
      empresasPadre = await query(`
        SELECT 
          empresa_id,
          nombre_comercial
        FROM admin.empresa
        ORDER BY nombre_comercial ASC
      `);
    } catch (e) {
      console.warn("Could not query admin.empresa for parent helpers:", e);
      try {
        empresasPadre = await query(`
          SELECT * FROM admin.empresa ORDER BY 1 ASC
        `);
      } catch (e2) {
        console.error("Could not query admin.empresa:", e2);
      }
    }

    return NextResponse.json({
      tiposEmpresa: (tiposEmpresa || []).map((t: any) => ({
        tipo_empresa_id: t.tipo_empresa_id ?? t.id,
        nombre: t.nombre || t.nombre_comercial || 'Sin Nombre'
      })),
      empresasPadre: (empresasPadre || []).map((e: any) => ({
        empresa_id: e.empresa_id ?? e.id,
        nombre_comercial: e.nombre_comercial || 'Sin Nombre'
      }))
    });
  } catch (error: any) {
    console.error("Error in GET /api/empresas/helpers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
