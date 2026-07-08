import { NextResponse } from "next/server";
import { insertLocationPing } from "@/lib/db";

/**
 * POST /api/location
 * Receives a GPS ping from the client and stores it linked to a log entry.
 * Also used by the service worker Background Sync queue.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { logId, lat, lon, accuracy } = body;

    if (!logId || lat == null || lon == null) {
      return NextResponse.json({ error: "Missing required fields: logId, lat, lon" }, { status: 400 });
    }

    insertLocationPing(logId, {
      lat: String(lat),
      lon: String(lon),
      accuracy: typeof accuracy === "number" ? accuracy : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/location] Error saving location ping:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
