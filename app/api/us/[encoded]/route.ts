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

async function getIP(request: NextRequest): Promise<string> {
  if (process.env.USE_TEST_IP === "true" && process.env.TEST_IP) {
    return process.env.TEST_IP;
  }

  let ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "";

  if ('ip' in request && !ip) {
    ip = (request as NextRequestWithIp).ip || "";
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  const isLocalOrPrivate =
    !ip ||
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "0.0.0.0" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.");

  if (isLocalOrPrivate) {
    try {
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        ip = data.ip;
      }
    } catch {
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

    // Extract email from path
    const url = new URL(request.url);
    const pathname = url.pathname;
    const splitIndex = pathname.indexOf('=');
    let email = "";
    if (splitIndex !== -1) {
      email = decodeURIComponent(pathname.substring(splitIndex + 1));
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Decode token
    const data = decodeToken(encoded);
    if (!data) {
      return new NextResponse('Invalid unsubscribe link', { status: 400 });
    }

    // ⚡ Get campaign and redirect URL first
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId! },
      select: {
        cortexUnsbTracking: true,
        offer: { select: { allowedCountries: true } }
      },
    });

    if (!campaign?.cortexUnsbTracking) {
      return new NextResponse('Invalid campaign', { status: 404 });
    }

    const redirectUrl = campaign.cortexUnsbTracking;

    // ⚡ Get IP
    const ip = await getIP(request);

    // ⚡ Parallel execution
    const userAgent = request.headers.get("user-agent") || "";
    const [geoData, ua] = await Promise.all([
      lookupIP(ip),
      Promise.resolve(new UAParser(userAgent).getResult())
    ]);

    const countryCode = geoData.country || "";
    const countryName = countriesByCode[countryCode] ?? countryCode;
    const cityName = geoData.city || geoData.region || "Unknown";

    // ✅ FRAUD DETECTION CHECK
    const fraudCheck = FraudDetector.check({
      ip,
      isp: geoData.isp,
      organization: geoData.organization
    });

    const isFraud = fraudCheck.isFraud;
    const fraudReason = fraudCheck.reason;

    // Check country
    const allowedCountries = campaign.offer.allowedCountries || [];
    const isInvalid = !allowedCountries.includes(countryName);

    // ⚡ BLOCK FRAUD UNSUBSCRIBES
    if (isFraud) {
      console.log(`🚫 FRAUD BLOCKED (Unsubscribe): ${fraudReason} | ${normalizedEmail} from ${ip}`);

      // Save fraud event async
      saveFraudUnsubscribe(data, normalizedEmail, ip, userAgent, geoData, countryName, cityName, ua, fraudReason).catch(console.error);

      return new NextResponse(
        `<html><body><h1>Access Denied</h1></body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // ⚡ REDIRECT IMMEDIATELY - Track in background
    const response = NextResponse.redirect(redirectUrl);

    // Save valid/invalid unsubscribe async
    saveUnsubscribe(data, normalizedEmail, ip, userAgent, geoData, countryName, cityName, ua, isInvalid).catch(console.error);

    console.log(`✅ ${isInvalid ? 'INVALID' : 'VALID'} Unsubscribe: ${normalizedEmail} → ${redirectUrl}`);

    return response;

  } catch (error) {
    console.error("❌ Unsubscribe error:", error);
    return new NextResponse('Error', { status: 500 });
  }
}

// 🚀 ASYNC - Save valid/invalid unsubscribe
async function saveUnsubscribe(
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
        unsubCount: { increment: 1 },
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
        unsubCount: 1,
        lastEvent: new Date(),
      }
    });

    await prisma.trackingEvent.create({
      data: {
        campaignId: data.campaignId,
        offerId: data.offerId,
        eventType: EventType.unsubscribe,
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
        isInvalid,
        isFraud: false,
        createdAt: new Date(),
        emailListId: emailList.id,
      }
    });
  } catch (error) {
    console.error('Failed to save unsubscribe:', error);
  }
}

// 🚫 ASYNC - Save fraud unsubscribe
async function saveFraudUnsubscribe(
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
        eventType: EventType.unsubscribe,
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
        isInvalid: false,
        isFraud: true,
        fraudReason,
        createdAt: new Date(),
      }
    });
  } catch (error) {
    console.error('Failed to save fraud unsubscribe:', error);
  }
}
