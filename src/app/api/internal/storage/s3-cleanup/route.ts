import { NextResponse } from "next/server";
import { processPendingS3Cleanups } from "@/lib/storage/s3CleanupQueue";

/**
 * Internal Vercel Cron Endpoint for S3 Cleanup Queue
 * Protected via CRON_SECRET authorization header.
 */
export async function GET(req: Request) {
  return handleS3CleanupCron(req);
}

export async function POST(req: Request) {
  return handleS3CleanupCron(req);
}

async function handleS3CleanupCron(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Reject if CRON_SECRET is not configured or authHeader doesn't match Bearer <CRON_SECRET>
    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Acceso no autorizado al cron interno de almacenamiento." },
        { status: 401 }
      );
    }

    // Parse optional limit from URL search params (default: 50, max: 200)
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

    const result = await processPendingS3Cleanups(limit);

    // Return sanitized metrics without exposing S3 keys or internal credentials
    return NextResponse.json({
      success: true,
      reaped: result.reaped || 0,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error executing S3 cleanup cron:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Error interno al procesar la cola de limpieza S3." },
      { status: 500 }
    );
  }
}
