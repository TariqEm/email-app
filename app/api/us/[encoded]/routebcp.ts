import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { countriesByCode } from "@/lib/constants/countries";
import { EventType } from '@prisma/client';
import { lookupIP } from "@/lib/geoip/maxmind-lookup";
import { prisma } from "@/lib/prisma";

interface NextRequestWithIp extends NextRequest {
  ip?: string;
}

function decodeToken(encoded: string) {
  try {
    const clean = encoded.replace("=%EMAIL%", "").replace(/=.*$/, "");
    const decoded = Buffer.from(clean, "base64url").toString("utf-8");
    const params = new URLSearchParams(decoded);

    return {
      event: params.get("e"),
      offerId: params.get("offerID"),
      campaignId: params.get("campaignID"),
      email: params.get("to"),
    };
  } catch {
    return null;
  }
}

async function getIP(request: NextRequest): Promise<string> {
  if (process.env.USE_TEST_IP === "true" && process.env.TEST_IP) {
    console.log("Using TEST IP", process.env.TEST_IP);
    return process.env.TEST_IP;
  }

  let ip = "";

  // Try Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) {
    ip = cfIP;
  }

  // Try X-Real-IP
  if (!ip) {
    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
      ip = realIP;
    }
  }

  // Try X-Forwarded-For
  if (!ip) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0].trim();
      ip = first;
    }
  }

  // Try request.ip if available
  if (!ip) {
    if ('ip' in request) {
      const rIp = (request as NextRequestWithIp).ip;
      if (rIp) {
        ip = rIp;
      }
    }
  }

  // Clean IPv6 mapped IPv4
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // CHECK IF IP IS LOCALHOST/PRIVATE - if so, fetch public IP
  const isLocalOrPrivate = 
    !ip ||
    ip === "::1" || 
    ip === "127.0.0.1" || 
    ip === "0.0.0.0" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.");

  if (isLocalOrPrivate) {
    try {
      console.log("⚠️ Detected local/private IP:", ip, "- fetching public IP...");
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        ip = data.ip;
        console.log("✅ Public IP fetched:", ip);
      } else {
        console.error("❌ Failed to fetch public IP, status:", res.status);
        ip = "unknown";
      }
    } catch (error) {
      console.error("❌ Failed to fetch public IP:", error);
      ip = "unknown";
    }
  }

  return ip;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ encoded: string }> }
) {
  try {
    const { encoded } = await params;

    // Extract actual email from the path after '='
    const url = new URL(request.url);
    const pathname = url.pathname;
    const splitIndex = pathname.indexOf('=');
    let email = "";
    if (splitIndex !== -1) {
      email = decodeURIComponent(pathname.substring(splitIndex + 1));
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Decode token part only (do not use email from inside token!)
    const data = decodeToken(encoded);
    if (!data) {
      // Invalid token, just redirect silently
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Retrieve campaign and check Cortex unsubscribe tracking URL
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId! },
    });

    if (!campaign?.cortexUnsbTracking) {
      // No Cortex unsubscribe URL, fallback redirect
      return NextResponse.redirect(new URL("/", request.url));
    }

    const ip = await getIP(request);
    const userAgent = request.headers.get("user-agent") || "";
    const ua = new UAParser(userAgent).getResult();

    const geoData = await lookupIP(ip);
    const countryCode = geoData.country || "";
    const countryName = countriesByCode[countryCode] ?? countryCode;
    const cityName = geoData.city || geoData.region || "Unknown";

    // Upsert email list record incrementing unsubCount
    const emailList = await prisma.emailList.upsert({
      where: { email: normalizedEmail },
      update: {
        unsubCount: { increment: 1 },
        lastEvent: new Date(),
        country: countryName,
        ipaddress: ip,
        os: ua.os.name ?? null,
        browser: ua.browser.name ?? null,
        timezone: geoData.timezone ?? null,
      },
      create: {
        email: normalizedEmail,
        country: countryName,
        ipaddress: ip,
        os: ua.os.name ?? null,
        browser: ua.browser.name ?? null,
        timezone: geoData.timezone ?? null,
        unsubCount: 1,
        lastEvent: new Date(),
      }
    });

    // Create tracking event
    await prisma.trackingEvent.create({
      data: {
        campaignId: data.campaignId!,
        offerId: data.offerId!,
        eventType: EventType.unsubscribe,
        emailHash: crypto.createHash("sha256").update(normalizedEmail).digest("hex"),
        ip,
        userAgent,
        country: countryName,
        city: cityName,
        region: geoData.region,
        isp: geoData.isp ?? geoData.organization ?? null,
        organization: geoData.organization ?? null,
        asn: geoData.asn ?? undefined,
        timezone: geoData.timezone,
        deviceType: ua.device.type ?? "unknown",
        browser: ua.browser.name ?? null,
        browserVersion: ua.browser.version ?? null,
        os: ua.os.name ?? null,
        createdAt: new Date(),
        emailListId: emailList.id,
      }
    });

    // Redirect to the Cortex unsubscribe tracking URL
    return NextResponse.redirect(campaign.cortexUnsbTracking);

  } catch (error) {
    console.error("Unsubscribe tracking error:", error);
    // Fallback generic redirect or 404 page
    return NextResponse.redirect(new URL("/", request.url));
  }
}
