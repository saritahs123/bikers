import { NextResponse } from "next/server";
import { getWorkshopSession } from "@/lib/workshop-session";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
  }
  return NextResponse.json({ status: "ok", empresa_id: session.empresa_id, usuario_id: session.usuario_id });
}
