import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { countriesByCode } from "@/lib/constants/countries";
import { EventType } from '@prisma/client';
import { lookupIP } from "@/lib/geoip/maxmind-lookup";
import { prisma } from "@/lib/prisma";
import { FraudDetector } from "@/lib/fraud/fraud-detector";

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

async function getEmailFromUrl(request: NextRequest): Promise<string> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const equalSignIndex = pathname.indexOf('=');
  if (equalSignIndex === -1) return "";
  return decodeURIComponent(pathname.substring(equalSignIndex + 1));
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ encoded: string }> }) {
  try {
    const { encoded } = await params;

    const emailRaw = await getEmailFromUrl(request);
    const email = emailRaw.trim().toLowerCase();

    const data = decodeToken(encoded);
    if (!data) {
      return new NextResponse('Invalid link', { status: 400 });
    }

    // ⚡ STEP 1: Get campaign and redirect URL FIRST (fastest query)
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId! },
      select: { 
        cortexClickTracking: true,
        offer: { select: { allowedCountries: true } }
      },
    });

    if (!campaign?.cortexClickTracking) {
      return new NextResponse('Invalid campaign', { status: 404 });
    }

    const redirectUrl = campaign.cortexClickTracking;

    // ⚡ STEP 2: Get IP immediately
    const ip = await getIP(request);

    // ⚡ STEP 3: Parallel execution - get geo data while parsing user agent
    const userAgent = request.headers.get("user-agent") || "";
    const [geoData, ua] = await Promise.all([
      lookupIP(ip),
      Promise.resolve(new UAParser(userAgent).getResult())
    ]);

    const countryCode = geoData.country || "";
    const countryName = countriesByCode[countryCode] ?? countryCode;
    const cityName = geoData.city || geoData.region || "Unknown";

    // ⚡ STEP 4: Quick fraud check (in-memory, super fast)
    const fraudCheck = FraudDetector.check({
      ip,
      isp: geoData.isp,
      organization: geoData.organization
    });

    const isFraud = fraudCheck.isFraud;
    const fraudReason = fraudCheck.reason;

    // ⚡ STEP 5: Check country (fast array lookup)
    const allowedCountries = campaign.offer.allowedCountries || [];
    const isInvalid = !allowedCountries.includes(countryName);

    // ⚡ STEP 6: IMMEDIATE REDIRECT (don't wait for DB writes)
    if (isFraud) {
      console.log(`🚫 FRAUD BLOCKED: ${fraudReason} | ${email} from ${ip}`);
      
      // Write to DB async (don't await)
      saveFraudEvent(data, email, ip, userAgent, geoData, countryName, cityName, ua, fraudReason).catch(console.error);
      
      return new NextResponse(
        `<html><body><h1>Access Denied</h1></body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // ⚡ REDIRECT IMMEDIATELY - Track in background
    const response = NextResponse.redirect(redirectUrl);

    // Save to DB asynchronously (don't block redirect)
    saveClickEvent(data, email, ip, userAgent, geoData, countryName, cityName, ua, isInvalid).catch(console.error);

    console.log(`✅ ${isInvalid ? 'INVALID' : 'VALID'} Click: ${email} → ${redirectUrl}`);

    return response;

  } catch (error) {
    console.error("❌ Click error:", error);
    return new NextResponse('Error', { status: 500 });
  }
}

// 🚀 ASYNC FUNCTION - Saves valid/invalid click without blocking redirect
async function saveClickEvent(
  data: any,
  email: string,
  ip: string,
  userAgent: string,
  geoData: any,
  countryName: string,
  cityName: string,
  ua: any,
  isInvalid: boolean
) {
  try {
    const emailList = await prisma.emailList.upsert({
      where: { email },
      update: {
        clickCount: { increment: 1 },
        lastEvent: new Date(),
        country: countryName,
        ipaddress: ip,
        os: ua.os.name ?? null,
        browser: ua.browser.name ?? null,
        timezone: geoData.timezone ?? null,
      },
      create: {
        email,
        country: countryName,
        ipaddress: ip,
        os: ua.os.name ?? null,
        browser: ua.browser.name ?? null,
        timezone: geoData.timezone ?? null,
        clickCount: 1,
        lastEvent: new Date(),
      },
    });

    await prisma.trackingEvent.create({
      data: {
        campaignId: data.campaignId,
        offerId: data.offerId,
        eventType: 'click',
        emailHash: crypto.createHash("sha256").update(email).digest("hex"),
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
        isInvalid,  // Country not allowed
        isFraud: false, // Not fraud
        createdAt: new Date(),
        emailListId: emailList.id,
      },
    });
  } catch (error) {
    console.error('Failed to save click event:', error);
  }
}

// 🚫 ASYNC FUNCTION - Saves fraud event without blocking
async function saveFraudEvent(
  data: any,
  email: string,
  ip: string,
  userAgent: string,
  geoData: any,
  countryName: string,
  cityName: string,
  ua: any,
  fraudReason?: string
) {
  try {
    await prisma.trackingEvent.create({
      data: {
        campaignId: data.campaignId,
        offerId: data.offerId,
        eventType: 'click',
        emailHash: crypto.createHash("sha256").update(email).digest("hex"),
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
        isInvalid: false,   // Not tracked as invalid
        isFraud: true,      // Tracked as fraud
        fraudReason,        // Why it was blocked
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to save fraud event:', error);
  }
}
