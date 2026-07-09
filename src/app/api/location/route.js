import { NextResponse } from "next/server";
import { insertLocationPing, updateLogCoordinates } from "@/lib/db";

/**
 * تاكد من انه بعد ان يتم الدخول الى الموقع و عمل له سمح با الوصول يتم تسجيله و اظهر البيانات في الداش برد لني الان قمت با التجربه و فعلت لم يظهر في الداش بورد كذالك تحدص و تظهر ان هذا ما زال مستمر في تسجسل حركته و لم ادخل يظهر اخر احدثيات تم تسجسلها له و قبل كم من الوقت و تاكد من كل شي 
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

    // Also update the main log entry with the latest accurate GPS location
    updateLogCoordinates(logId, { lat, lon });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/location] Error saving location ping:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
