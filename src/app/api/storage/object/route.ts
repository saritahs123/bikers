import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Generic deletion is disabled for security compliance.
// S3 object deletion MUST be performed via domain-specific endpoints:
// - DELETE /api/crm/bicicletas/[id]/photos
// - DELETE /api/taller/recepciones/[id]
export async function DELETE() {
  return NextResponse.json({
    error: "METHOD_NOT_ALLOWED",
    message: "La eliminación genérica de objetos S3 no está permitida. Utilice los endpoints del dominio correspondiente."
  }, { status: 405 });
}
