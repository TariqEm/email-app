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

type GeoDataClean = {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: number;
};

type UAResult = {
  os: { name?: string };
  browser: { name?: string; version?: string };
  device: { type?: string };
};

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

function cleanGeoData(geoData: unknown): GeoDataClean {
  const data = geoData as Record<string, unknown>;
  return {
    country: typeof data.country === 'string' ? data.country : undefined,
    region: typeof data.region === 'string' ? data.region : undefined,
    city: typeof data.city === 'string' ? data.city : undefined,
    timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
    isp: typeof data.isp === 'string' ? data.isp : undefined,
    organization: typeof data.organization === 'string' ? data.organization : undefined,
    asn: typeof data.asn === 'number' ? data.asn : undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ encoded: string }> }
) {
  try {
    const { encoded } = await params;

    const url = new URL(request.url);
    const pathname = url.pathname;
    const splitIndex = pathname.indexOf('=');
    let email = "";
    if (splitIndex !== -1) {
      email = decodeURIComponent(pathname.substring(splitIndex + 1));
    }
    const normalizedEmail = email.trim().toLowerCase();

    const data = decodeToken(encoded);
    if (!data || !data.campaignId || !data.offerId) {
      return new NextResponse('Invalid unsubscribe link', { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
      select: {
        cortexUnsbTracking: true,
        offer: { select: { allowedCountries: true } }
      },
    });

    if (!campaign?.cortexUnsbTracking) {
      return new NextResponse('Invalid campaign', { status: 404 });
    }

    const redirectUrl = campaign.cortexUnsbTracking;
    const ip = await getIP(request);

    const userAgent = request.headers.get("user-agent") || "";
    const [geoDataRaw, ua] = await Promise.all([
      lookupIP(ip),
      Promise.resolve(new UAParser(userAgent).getResult())
    ]);

    const geoData = cleanGeoData(geoDataRaw);

    const countryCode = geoData.country || "";
    const countryName = countriesByCode[countryCode] ?? countryCode;
    const cityName = geoData.city || geoData.region || "Unknown";

    const fraudCheck = FraudDetector.check({
      ip,
      isp: geoData.isp,
      organization: geoData.organization
    });

    const isFraud = fraudCheck.isFraud;
    const fraudReason = fraudCheck.reason;

    const allowedCountries = campaign.offer.allowedCountries || [];
    const isInvalid = !allowedCountries.includes(countryName);

    if (isFraud) {
      console.log(`🚫 FRAUD BLOCKED (Unsubscribe): ${fraudReason} | ${normalizedEmail} from ${ip}`);

      saveFraudUnsubscribe(
        data.campaignId,
        data.offerId,
        normalizedEmail,
        ip,
        userAgent,
        geoData,
        countryName,
        cityName,
        ua,
        fraudReason
      ).catch(console.error);

      return new NextResponse(
        `<html><body><h1>Access Denied</h1></body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const response = NextResponse.redirect(redirectUrl);

    saveUnsubscribe(
      data.campaignId,
      data.offerId,
      normalizedEmail,
      ip,
      userAgent,
      geoData,
      countryName,
      cityName,
      ua,
      isInvalid
    ).catch(console.error);

    console.log(`✅ ${isInvalid ? 'INVALID' : 'VALID'} Unsubscribe: ${normalizedEmail} → ${redirectUrl}`);

    return response;

  } catch (error) {
    console.error("❌ Unsubscribe error:", error);
    return new NextResponse('Error', { status: 500 });
  }
}

async function saveUnsubscribe(
  campaignId: string,
  offerId: string,
  email: string,
  ip: string,
  userAgent: string,
  geoData: GeoDataClean,
  countryName: string,
  cityName: string,
  ua: UAResult,
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
        campaignId,
        offerId,
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

async function saveFraudUnsubscribe(
  campaignId: string,
  offerId: string,
  email: string,
  ip: string,
  userAgent: string,
  geoData: GeoDataClean,
  countryName: string,
  cityName: string,
  ua: UAResult,
  fraudReason?: string
) {
  try {
    await prisma.trackingEvent.create({
      data: {
        campaignId,
        offerId,
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
