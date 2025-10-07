import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { countriesByCode } from "@/lib/constants/countries";
import { lookupIP } from "@/lib/geoip/maxmind-lookup";
import { prisma } from "@/lib/prisma";
import { FraudDetector } from "@/lib/fraud/fraud-detector";

interface NextRequestWithIp extends NextRequest {
  ip?: string;
}

// Helper type to convert null to undefined
type GeoDataClean = {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: number;
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

async function getEmailFromUrl(request: NextRequest): Promise<string> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const equalSignIndex = pathname.indexOf('=');
  if (equalSignIndex === -1) return "";
  return decodeURIComponent(pathname.substring(equalSignIndex + 1));
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

// Helper to convert GeoData (null) to clean type (undefined)
function cleanGeoData(geoData: any): GeoDataClean {
  return {
    country: geoData.country ?? undefined,
    region: geoData.region ?? undefined,
    city: geoData.city ?? undefined,
    timezone: geoData.timezone ?? undefined,
    isp: geoData.isp ?? undefined,
    organization: geoData.organization ?? undefined,
    asn: geoData.asn ?? undefined,
  };
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

    if (!data.campaignId || !data.offerId) {
      return new NextResponse('Missing campaign or offer ID', { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
      select: {
        cortexClickTracking: true,
        offer: { select: { allowedCountries: true } }
      },
    });

    if (!campaign?.cortexClickTracking) {
      return new NextResponse('Invalid campaign', { status: 404 });
    }

    const redirectUrl = campaign.cortexClickTracking;
    const ip = await getIP(request);

    const userAgent = request.headers.get("user-agent") || "";
    const [geoDataRaw, ua] = await Promise.all([
      lookupIP(ip),
      Promise.resolve(new UAParser(userAgent).getResult())
    ]);

    // Clean geoData (convert null to undefined)
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
      console.log(`🚫 FRAUD BLOCKED: ${fraudReason} | ${email} from ${ip}`);

      saveFraudEvent(
        data.campaignId,
        data.offerId,
        email,
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

    saveClickEvent(
      data.campaignId,
      data.offerId,
      email,
      ip,
      userAgent,
      geoData,
      countryName,
      cityName,
      ua,
      isInvalid
    ).catch(console.error);

    console.log(`✅ ${isInvalid ? 'INVALID' : 'VALID'} Click: ${email} → ${redirectUrl}`);

    return response;

  } catch (error) {
    console.error("❌ Click error:", error);
    return new NextResponse('Error', { status: 500 });
  }
}

async function saveClickEvent(
  campaignId: string,
  offerId: string,
  email: string,
  ip: string,
  userAgent: string,
  geoData: GeoDataClean,
  countryName: string,
  cityName: string,
  ua: { os: { name?: string }; browser: { name?: string; version?: string }; device: { type?: string } },
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
        campaignId,
        offerId,
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
        isInvalid,
        isFraud: false,
        createdAt: new Date(),
        emailListId: emailList.id,
      },
    });
  } catch (error) {
    console.error('Failed to save click event:', error);
  }
}

async function saveFraudEvent(
  campaignId: string,
  offerId: string,
  email: string,
  ip: string,
  userAgent: string,
  geoData: GeoDataClean,
  countryName: string,
  cityName: string,
  ua: { os: { name?: string }; browser: { name?: string; version?: string }; device: { type?: string } },
  fraudReason?: string
) {
  try {
    await prisma.trackingEvent.create({
      data: {
        campaignId,
        offerId,
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
        isInvalid: false,
        isFraud: true,
        fraudReason,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to save fraud event:', error);
  }
}
