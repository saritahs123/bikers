import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get("session_token")?.value;

  if (!tokenCookie || !tokenCookie.trim()) {
    return null;
  }

  const sessionCheck = await query<{ usuario_id: number; fecha_expiracion: string | Date | null; estado: string }>(
    `SELECT usuario_id, fecha_expiracion, estado
     FROM admin.usuario_sesion
     WHERE token_identificador = $1 AND estado = 'ACTIVA'
     LIMIT 1`,
    [tokenCookie]
  );

  if (!sessionCheck || sessionCheck.length === 0) {
    return null;
  }

  const session = sessionCheck[0];
  const isExpired = session.fecha_expiracion && new Date(session.fecha_expiracion) < new Date();
  if (isExpired || session.estado !== "ACTIVA") {
    return null;
  }

  const targetUserId = session.usuario_id;
  if (!targetUserId || isNaN(Number(targetUserId))) {
    return null;
  }

  const userRows = await query<any>(
    `SELECT 
       u.usuario_id,
       u.estado AS usuario_estado,
       ui.nombre,
       ui.apellido,
       ui.correo_electronico,
       us.correo_acceso,
       us.identificador_principal,
       r.nombre AS rol_nombre,
       c.nombre AS cargo_nombre,
       e.nombre_comercial AS empresa_nombre
     FROM admin.usuario u
     LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
     LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
     LEFT JOIN admin.rol_funcional r ON u.rol_principal_id = r.rol_funcional_id
     LEFT JOIN admin.empresa e ON u.empresa_id = e.empresa_id
     LEFT JOIN admin.cargo c ON ui.cargo_id = c.cargo_id
     WHERE u.usuario_id = $1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
     LIMIT 1`,
    [targetUserId]
  );

  if (!userRows || userRows.length === 0) {
    return null;
  }

  const row = userRows[0];
  const nombre = (row.nombre || "").trim();
  const apellido = (row.apellido || "").trim();

  let nombreCompleto = "";
  if (nombre && apellido) {
    nombreCompleto = `${nombre} ${apellido}`;
  } else if (nombre) {
    nombreCompleto = nombre;
  } else if (apellido) {
    nombreCompleto = apellido;
  } else if (row.identificador_principal) {
    nombreCompleto = row.identificador_principal;
  } else {
    nombreCompleto = "Sin nombre registrado";
  }

  let iniciales = "--";
  if (nombre && apellido) {
    iniciales = `${nombre[0]}${apellido[0]}`.toUpperCase();
  } else if (nombre) {
    iniciales = nombre.substring(0, 2).toUpperCase();
  } else if (nombreCompleto && nombreCompleto !== "Sin nombre registrado") {
    iniciales = nombreCompleto.substring(0, 2).toUpperCase();
  }

  const rolNombre = row.rol_nombre || "Sin rol asignado";
  const cargoNombre = row.cargo_nombre || rolNombre;
  const empresaNombre = row.empresa_nombre || "Biker's Fort";

  return {
    usuario_id: row.usuario_id,
    nombre,
    apellido,
    nombre_completo: nombreCompleto,
    identificador_principal: row.identificador_principal || "",
    correo_acceso: row.correo_acceso || "",
    correo_electronico: row.correo_electronico || "",
    rol: rolNombre,
    rol_nombre: rolNombre,
    cargo_nombre: cargoNombre,
    empresa_nombre: empresaNombre,
    iniciales,
    foto_url: null
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let dbError = false;

  try {
    user = await getAuthenticatedUser();
  } catch (err) {
    console.error("DashboardLayout PostgreSQL session query failure:", err);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#090b0e] text-slate-300 font-mono text-xs p-4">
        <div className="p-8 bg-[#161a21] border border-rose-500/30 rounded-2xl max-w-md text-center shadow-2xl">
          <h2 className="text-base font-bold text-rose-400 mb-2">Servicio No Disponible</h2>
          <p className="text-slate-400">No fue posible validar la sesión con el servidor de base de datos. Por favor reintente más tarde.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/login");
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
