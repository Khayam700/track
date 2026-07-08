/**
 * GET /api/track
 * 
 * Tracking endpoint that:
 * 1. Extracts the client's public IP from request headers
 * 2. Fetches geolocation data from ip-api.com
 * 3. Saves all collected data to the local SQLite database
 * 4. Performs a fast 302 redirect to https://www.google.com
 * 
 * ⚠️ DEPLOYMENT NOTE:
 * This uses a local SQLite database — only suitable for local dev
 * or platforms with persistent storage (Railway, Render, VPS).
 */

import { NextResponse } from "next/server";
import { insertLog, getSetting } from "@/lib/db";

const DEFAULT_REDIRECT = "https://www.google.com";

export async function GET(request) {
  // Read the configured redirect URL from the database
  const redirectUrl = getSetting("redirect_url") || DEFAULT_REDIRECT;

  try {
    // --- 1. Extract Client IP ---
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    let ip = forwarded
      ? forwarded.split(",")[0].trim()
      : realIp || "127.0.0.1";

    // Strip IPv6-mapped IPv4 prefix if present (e.g. ::ffff:192.168.1.1)
    if (ip.startsWith("::ffff:")) {
      ip = ip.slice(7);
    }

    // Normalize IPv6 localhost to IPv4
    if (ip === "::1") {
      ip = "127.0.0.1";
    }

    // --- 2. Extract Device / User-Agent ---
    const userAgent = request.headers.get("user-agent") || "Unknown";

    // --- 3. Fetch Geolocation Data ---
    let country = "Unknown";
    let city = "Unknown";
    let isp = "Unknown";

    // Skip geo lookup for localhost / private IPs
    const isPrivate =
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.");

    if (!isPrivate) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp`, {
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.status === "success") {
            country = geoData.country || "Unknown";
            city = geoData.city || "Unknown";
            isp = geoData.isp || "Unknown";
          }
        }
      } catch {
        // Geo lookup failed — proceed with defaults
        console.warn(`[track] Geo lookup failed for IP: ${ip}`);
      }
    }

    // --- 4. Save to Database ---
    insertLog({
      ip,
      country,
      city,
      isp,
      device: userAgent,
    });

    // --- 5. Redirect to the configured URL ---
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error("[track] Error in tracking endpoint:", error);
    // Even on error, redirect so the user doesn't see a broken page
    return NextResponse.redirect(redirectUrl, 302);
  }
}
