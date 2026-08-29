import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateAndTouchSession } from "@/lib/sessionLifecycle";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token")?.value;

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "No hay sesión activa." },
        { status: 401 }
      );
    }

    const validation = await validateAndTouchSession(tokenCookie);
    if (!validation.valid) {
      cookieStore.delete("session_user_id");
      cookieStore.delete("session_token");

      if (validation.reason === "REVOKED") {
        return NextResponse.json(
          { error: "SESSION_REVOKED", message: "Su sesión fue revocada. Por favor, vuelva a iniciar sesión." },
          { status: 401 }
        );
      }
      if (validation.reason === "EXPIRED") {
        return NextResponse.json(
          { error: "SESSION_EXPIRED", message: "Su sesión ha expirado por límite de tiempo. Por favor, vuelva a iniciar sesión." },
          { status: 401 }
        );
      }
      if (validation.reason === "CLOSED") {
        return NextResponse.json(
          { error: "SESSION_CLOSED", message: "La sesión ha sido cerrada." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "SESSION_INVALID", message: "La sesión no es válida." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      active: true,
      updatedActivity: validation.updatedActivity
    });
  } catch (error: any) {
    console.error("Heartbeat API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
