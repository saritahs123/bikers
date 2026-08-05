import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    let rows: any[] = [];
    try {
      rows = await query(`SELECT * FROM admin.tipo_empresa ORDER BY 1 ASC`);
    } catch (e) {
      console.warn("Error querying SELECT * FROM admin.tipo_empresa:", e);
    }

    const mapped = (rows || []).map((r: any) => {
      const pkValue = r.tipo_empresa_id ?? r.tipo_id ?? r.id ?? r.empresa_tipo_id ?? r.codigo;
      let estadoVal = 'Activo';
      if (r.estado !== undefined && r.estado !== null) {
        if (typeof r.estado === 'boolean') estadoVal = r.estado ? 'Activo' : 'Inactivo';
        else estadoVal = String(r.estado);
      } else if (r.activo !== undefined && r.activo !== null) {
        estadoVal = r.activo ? 'Activo' : 'Inactivo';
      }

      const fechaCreacion = r.fecha_creacion || r.created_at || r.fecha_registro;
      const fechaActualizacion = r.fecha_actualizacion || r.updated_at || r.fecha_modificacion;

      return {
        id: pkValue,
        tipo_empresa_id: r.tipo_empresa_id ?? pkValue,
        nombre: r.nombre || r.name || r.descripcion_corta || 'Sin Nombre',
        descripcion: r.descripcion || r.description || '',
        estado: estadoVal,
        fecha_creacion: fechaCreacion ? String(fechaCreacion).substring(0, 10) : null,
        fecha_actualizacion: fechaActualizacion ? String(fechaActualizacion).substring(0, 10) : null
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/tipos-empresa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nombre = (body.nombre || body.name || '').trim();
    const descripcion = (body.descripcion || body.description || '').trim();
    const estadoStr = (body.estado || body.status || 'Activo').trim();
    const isActivo = estadoStr.toUpperCase() === 'ACTIVO';

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    // Try 1: Standard INSERT with RETURNING *
    try {
      const sql1 = `
        INSERT INTO admin.tipo_empresa (nombre, descripcion, estado)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const res1 = await query(sql1, [nombre, descripcion, estadoStr]);
      const r = res1[0] || {};
      return NextResponse.json({
        id: r.tipo_empresa_id ?? r.tipo_id ?? r.id ?? Date.now(),
        nombre: r.nombre || nombre,
        descripcion: r.descripcion || descripcion,
        estado: r.estado || estadoStr,
        fecha_creacion: r.fecha_creacion || new Date().toISOString()
      });
    } catch (err1: any) {
      console.warn("POST Try 1 failed:", err1?.message);

      // Try 2: INSERT specifying explicit next ID in case PK lacks auto-increment sequence
      try {
        const sql2 = `
          INSERT INTO admin.tipo_empresa (tipo_empresa_id, nombre, descripcion, estado)
          VALUES (
            (SELECT COALESCE(MAX(tipo_empresa_id), 0) + 1 FROM admin.tipo_empresa),
            $1, $2, $3
          )
          RETURNING *
        `;
        const res2 = await query(sql2, [nombre, descripcion, estadoStr]);
        const r2 = res2[0] || {};
        return NextResponse.json({
          id: r2.tipo_empresa_id ?? r2.tipo_id ?? r2.id ?? Date.now(),
          nombre: r2.nombre || nombre,
          descripcion: r2.descripcion || descripcion,
          estado: r2.estado || estadoStr,
          fecha_creacion: r2.fecha_creacion || new Date().toISOString()
        });
      } catch (err2: any) {
        console.warn("POST Try 2 failed:", err2?.message);

        // Try 3: INSERT with boolean 'activo' column
        try {
          const sql3 = `
            INSERT INTO admin.tipo_empresa (tipo_empresa_id, nombre, descripcion, activo)
            VALUES (
              (SELECT COALESCE(MAX(tipo_empresa_id), 0) + 1 FROM admin.tipo_empresa),
              $1, $2, $3
            )
            RETURNING *
          `;
          const res3 = await query(sql3, [nombre, descripcion, isActivo]);
          const r3 = res3[0] || {};
          return NextResponse.json({
            id: r3.tipo_empresa_id ?? r3.tipo_id ?? r3.id ?? Date.now(),
            nombre: r3.nombre || nombre,
            descripcion: r3.descripcion || descripcion,
            estado: isActivo ? 'Activo' : 'Inactivo',
            fecha_creacion: r3.fecha_creacion || new Date().toISOString()
          });
        } catch (err3: any) {
          console.warn("POST Try 3 failed:", err3?.message);

          // Try 4: Simple INSERT (nombre, descripcion)
          const sql4 = `
            INSERT INTO admin.tipo_empresa (nombre, descripcion)
            VALUES ($1, $2)
            RETURNING *
          `;
          const res4 = await query(sql4, [nombre, descripcion]);
          const r4 = res4[0] || {};
          return NextResponse.json({
            id: r4.tipo_empresa_id ?? r4.id ?? Date.now(),
            nombre: r4.nombre || nombre,
            descripcion: r4.descripcion || descripcion,
            estado: estadoStr,
            fecha_creacion: new Date().toISOString()
          });
        }
      }
    }
  } catch (error: any) {
    console.error("Error in POST /api/tipos-empresa:", error);
    return NextResponse.json({ error: error.message || "Error al registrar tipo de empresa" }, { status: 500 });
  }
}
