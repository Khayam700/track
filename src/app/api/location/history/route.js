import { NextResponse } from "next/server";
import { getLocationHistory } from "@/lib/db";

/**
 * GET /api/location/history?logId=X
 * Returns the full GPS movement history for a specific visitor log entry.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("logId");

    if (!logId) {
      return NextResponse.json({ error: "Missing logId query parameter" }, { status: 400 });
    }

    const history = getLocationHistory(parseInt(logId));
    return NextResponse.json({ history });
  } catch (error) {
    console.error("[api/location/history] Error fetching history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
