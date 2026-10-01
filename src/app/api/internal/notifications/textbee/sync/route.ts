import { NextResponse } from "next/server";
import { syncRecentPendingTextBeeNotifications } from "@/lib/notifications/workOrderNotificationService";

/**
 * Internal Endpoint for Periodic TextBee Notification Synchronization (Section 5 & 6).
 * Supports GET (e.g. Vercel Cron) and POST (e.g. external scheduler/curl).
 * Protected via TEXTBEE_SYNC_SECRET or CRON_SECRET authorization header.
 */
export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-sync-secret");
    const syncSecret = process.env.TEXTBEE_SYNC_SECRET?.trim();
    const cronSecret = process.env.CRON_SECRET?.trim();

    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const matchesSecret = (val: string | null | undefined): boolean => {
      if (!val) return false;
      return Boolean((syncSecret && val === syncSecret) || (cronSecret && val === cronSecret));
    };

    // 1. Secret Protection Validation (Section 6)
    const isAuthorized = matchesSecret(customHeader) || matchesSecret(bearerToken);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Acceso no autorizado al sincronizador de notificaciones TextBee.",
        },
        { status: 401 }
      );
    }

    // 2. Parse optional limit parameter (default 50, max 200)
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

    // 3. Process recent pending notifications
    const result = await syncRecentPendingTextBeeNotifications(limit);

    return NextResponse.json({
      success: true,
      totalPending: result.totalPending,
      processed: result.processed,
      updatedCount: result.updatedCount,
      results: result.results.map((r) => ({
        notificacionId: r.notificacionId,
        batchId: r.batchId,
        previousEstadoEnvio: r.previousEstadoEnvio,
        newEstadoEnvio: r.newEstadoEnvio,
        updated: r.updated,
        fechaEnvioReal: r.fechaEnvioReal ? r.fechaEnvioReal.toISOString() : null,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorDetail = error instanceof Error ? error.message : "Error inesperado en sincronizador";
    console.error("Error en sincronizador interno de TextBee:", error);

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: `Error al procesar sincronización TextBee: ${errorDetail}`,
      },
      { status: 500 }
    );
  }
}
