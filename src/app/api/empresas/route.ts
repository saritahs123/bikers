import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateRNC, validatePhoneDR, validateEmail, validateURL, validateRequiredText } from "@/lib/validations";

export async function GET() {
  try {
    const sql = `
      SELECT 
        e.empresa_id AS id,
        e.empresa_id,
        e.rnc,
        e.codigo,
        e.nombre_comercial,
        e.alias,
        e.tipo_empresa_id,
        te.nombre AS tipo_empresa_nombre,
        e.empresa_padre_id,
        p.nombre_comercial AS empresa_padre_nombre,
        e.logotipo_url,
        e.estado,
        e.color_identificador,
        e.direccion,
        e.telefono,
        e.email,
        e.descripcion,
        e.fecha_registro,
        e.fecha_actualizacion
      FROM admin.empresa e
      LEFT JOIN admin.tipo_empresa te ON e.tipo_empresa_id = te.tipo_empresa_id
      LEFT JOIN admin.empresa p ON e.empresa_padre_id = p.empresa_id
      ORDER BY e.empresa_id ASC
    `;

    let rows: any[] = [];
    try {
      rows = await query(sql);
    } catch (e) {
      console.warn("Fallback query for GET admin.empresa:", e);
      try {
        rows = await query(`SELECT * FROM admin.empresa ORDER BY empresa_id ASC`);
      } catch (e2) {
        console.error("Could not query admin.empresa:", e2);
      }
    }

    const mapped = (rows || []).map((r: any) => ({
      id: r.empresa_id ?? r.id,
      empresa_id: r.empresa_id ?? r.id,
      rnc: r.rnc || '',
      codigo: r.codigo || '',
      nombre_comercial: r.nombre_comercial || r.nombre || 'Sin Nombre',
      alias: r.alias || '',
      tipo_empresa_id: r.tipo_empresa_id != null ? r.tipo_empresa_id : null,
      tipo_empresa_nombre: r.tipo_empresa_nombre || 'Sin Asignar',
      empresa_padre_id: r.empresa_padre_id != null ? r.empresa_padre_id : null,
      empresa_padre_nombre: r.empresa_padre_nombre || 'Ninguna',
      logotipo_url: r.logotipo_url || '',
      estado: r.estado || 'Activo',
      color_identificador: r.color_identificador || '#bfce7f',
      direccion: r.direccion || '',
      telefono: r.telefono || '',
      email: r.email || '',
      descripcion: r.descripcion || '',
      fecha_registro: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/empresas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rncRaw = (body.rnc || '').trim();
    const codigo = (body.codigo || '').trim();
    const nombre_comercial = (body.nombre_comercial || '').trim();
    const alias = (body.alias || '').trim();
    const tipo_empresa_id = body.tipo_empresa_id ? parseInt(body.tipo_empresa_id, 10) : null;
    const empresa_padre_id = body.empresa_padre_id ? parseInt(body.empresa_padre_id, 10) : null;
    const logotipo_url = (body.logotipo_url || '').trim();
    const estado = body.estado || 'Activo';
    const color_identificador = body.color_identificador || '#bfce7f';
    const direccion = (body.direccion || '').trim();
    const telefonoRaw = (body.telefono || '').trim();
    const emailRaw = (body.email || '').trim();
    const descripcion = (body.descripcion || '').trim();

    // 1. RNC Validation
    const rncVal = validateRNC(rncRaw, true);
    if (!rncVal.isValid) {
      return NextResponse.json({ error: rncVal.message }, { status: 400 });
    }
    const rnc = rncVal.sanitized;

    // 2. Nombre Comercial Validation
    const nameVal = validateRequiredText(nombre_comercial, "El Nombre Comercial", 100);
    if (!nameVal.isValid) {
      return NextResponse.json({ error: nameVal.message }, { status: 400 });
    }

    // 3. Tipo Empresa Validation
    if (!tipo_empresa_id) {
      return NextResponse.json({ error: "Debe seleccionar un Tipo de Empresa." }, { status: 400 });
    }

    // 4. Telefono Validation
    const phoneVal = validatePhoneDR(telefonoRaw, false);
    if (!phoneVal.isValid) {
      return NextResponse.json({ error: phoneVal.message }, { status: 400 });
    }
    const telefono = phoneVal.digits;

    // 5. Email Validation (auto lowercase & trim)
    const emailVal = validateEmail(emailRaw, false);
    if (!emailVal.isValid) {
      return NextResponse.json({ error: emailVal.message }, { status: 400 });
    }
    const email = emailVal.sanitized;

    // 6. URL Validation
    const urlVal = validateURL(logotipo_url, false);
    if (!urlVal.isValid) {
      return NextResponse.json({ error: urlVal.message }, { status: 400 });
    }

    // Check RNC uniqueness
    try {
      const rncCheck = await query(
        `SELECT 1 FROM admin.empresa WHERE LOWER(rnc) = LOWER($1) LIMIT 1`,
        [rnc]
      );
      if (rncCheck && rncCheck.length > 0) {
        return NextResponse.json(
          { error: `El RNC "${rnc}" ya se encuentra registrado en el sistema.` },
          { status: 400 }
        );
      }
    } catch (e) {
      console.warn("RNC uniqueness check error:", e);
    }

    // Check Codigo uniqueness if provided
    if (codigo) {
      try {
        const codCheck = await query(
          `SELECT 1 FROM admin.empresa WHERE LOWER(codigo) = LOWER($1) LIMIT 1`,
          [codigo]
        );
        if (codCheck && codCheck.length > 0) {
          return NextResponse.json(
            { error: `El código "${codigo}" ya está registrado en otra empresa.` },
            { status: 400 }
          );
        }
      } catch (e) {
        console.warn("Codigo uniqueness check error:", e);
      }
    }

    // Attempt 1: Standard INSERT
    try {
      const sql1 = `
        INSERT INTO admin.empresa (
          rnc, codigo, nombre_comercial, alias, tipo_empresa_id, empresa_padre_id,
          logotipo_url, estado, color_identificador, direccion, telefono, email, descripcion, fecha_registro
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *
      `;
      const res1 = await query(sql1, [
        rnc, codigo || null, nombre_comercial, alias || null, tipo_empresa_id, empresa_padre_id || null,
        logotipo_url || null, estado, color_identificador, direccion || null, telefono || null, email || null, descripcion || null
      ]);
      return NextResponse.json({ success: true, item: res1[0] || {} });
    } catch (err1: any) {
      console.warn("POST Try 1 failed:", err1?.message);

      // Attempt 2: Explicit ID auto-calculation in case PK lacks auto-increment sequence
      try {
        const sql2 = `
          INSERT INTO admin.empresa (
            empresa_id, rnc, codigo, nombre_comercial, alias, tipo_empresa_id, empresa_padre_id,
            logotipo_url, estado, color_identificador, direccion, telefono, email, descripcion, fecha_registro
          )
          VALUES (
            (SELECT COALESCE(MAX(empresa_id), 0) + 1 FROM admin.empresa),
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
          )
          RETURNING *
        `;
        const res2 = await query(sql2, [
          rnc, codigo || null, nombre_comercial, alias || null, tipo_empresa_id, empresa_padre_id || null,
          logotipo_url || null, estado, color_identificador, direccion || null, telefono || null, email || null, descripcion || null
        ]);
        return NextResponse.json({ success: true, item: res2[0] || {} });
      } catch (err2: any) {
        console.error("POST Try 2 failed:", err2);
        return NextResponse.json({ error: "Error al guardar la empresa en PostgreSQL: " + (err2?.message || err1?.message) }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in POST /api/empresas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
