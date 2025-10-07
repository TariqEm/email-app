import { NextRequest } from "next/server";
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

// 1x1 transparent GIF pixel (base64)
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

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

function hashEmail(email: string | null) {
  if (!email) return "";
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
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
    if (!data) {
      return new Response(TRANSPARENT_PIXEL, { headers: PIXEL_HEADERS });
    }

    const campaignWithOffer = await prisma.campaign.findUnique({
      where: { id: data.campaignId! },
      select: {
        offer: { select: { allowedCountries: true } }
      },
    });

    if (!campaignWithOffer) {
      return new Response(TRANSPARENT_PIXEL, { headers: PIXEL_HEADERS });
    }

    const ip = await getIP(request);
    const userAgent = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || null;

    const [geoDataRaw, ua] = await Promise.all([
      lookupIP(ip),
      Promise.resolve(new UAParser(userAgent).getResult())
    ]);

    const geoData = cleanGeoData(geoDataRaw as unknown as Record<string, unknown>);

    const fraudCheck = FraudDetector.check({
      ip,
      isp: geoData.isp,
      organization: geoData.organization
    });

    const isFraud = fraudCheck.isFraud;
    const fraudReason = fraudCheck.reason;

    const response = new Response(TRANSPARENT_PIXEL, { headers: PIXEL_HEADERS });

    if (data.campaignId && data.offerId) {
      processOpenEvent(
        data.campaignId,
        data.offerId,
        normalizedEmail,
        ip,
        userAgent,
        referer,
        geoData,
        ua,
        campaignWithOffer.offer.allowedCountries,
        isFraud,
        fraudReason
      ).catch(console.error);
    }

    return response;

  } catch (err) {
    console.error("❌ Tracking error:", err);
    return new Response(TRANSPARENT_PIXEL, { headers: PIXEL_HEADERS });
  }
}

async function processOpenEvent(
  campaignId: string,
  offerId: string,
  email: string,
  ip: string,
  userAgent: string,
  referer: string | null,
  geoData: GeoDataClean,
  ua: UAResult,
  allowedCountries: string[],
  isFraud: boolean,
  fraudReason?: string
) {
  try {
    const countryCode = geoData.country || "";
    const countryName = countriesByCode[countryCode] ?? countryCode;
    const cityName = geoData.city || geoData.region || "Unknown";

    const uaLower = userAgent.toLowerCase();
    const osName = ua.os.name?.toLowerCase() || '';
    const isAndroid = osName.includes('android') || uaLower.includes('android');
    const isIOS = osName.includes('ios') || uaLower.includes('iphone') || uaLower.includes('ipad');

    let deviceType = ua.device.type || '';

    if (!deviceType) {
      if (uaLower.includes('mobile') || isAndroid || (isIOS && !uaLower.includes('ipad'))) {
        deviceType = isAndroid ? 'android' : isIOS ? 'ios' : 'mobile';
      } else if (uaLower.includes('tablet') || uaLower.includes('ipad')) {
        deviceType = isAndroid ? 'android-tablet' : isIOS ? 'ios-tablet' : 'tablet';
      } else if (uaLower.includes('bot') || uaLower.includes('crawler') || uaLower.includes('spider')) {
        deviceType = 'bot';
      } else {
        deviceType = 'desktop';
      }
    } else {
      if (deviceType === 'mobile') {
        deviceType = isAndroid ? 'android' : isIOS ? 'ios' : 'mobile';
      } else if (deviceType === 'tablet') {
        deviceType = isAndroid ? 'android-tablet' : isIOS ? 'ios-tablet' : 'tablet';
      }
    }

    const isInvalid = !allowedCountries.includes(countryName);

    if (!isFraud) {
      await prisma.emailList.upsert({
        where: { email },
        update: {
          openCount: { increment: 1 },
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
          openCount: 1,
          lastEvent: new Date(),
        }
      });
    }

    const emailList = await prisma.emailList.findUnique({
      where: { email },
      select: { id: true }
    });

    await prisma.trackingEvent.create({
      data: {
        campaignId,
        offerId,
        eventType: EventType.open,
        emailHash: hashEmail(email),
        ip,
        userAgent,
        referer,
        country: countryName,
        city: cityName,
        region: geoData.region,
        isp: geoData.isp ?? geoData.organization ?? null,
        organization: geoData.organization ?? null,
        asn: geoData.asn ?? undefined,
        timezone: geoData.timezone,
        deviceType,
        browser: ua.browser.name ?? null,
        browserVersion: ua.browser.version ?? null,
        os: ua.os.name ?? null,
        isInvalid,
        isFraud,
        fraudReason,
        createdAt: new Date(),
        emailListId: emailList?.id,
      },
    });

    if (isFraud) {
      console.log(`🚫 FRAUD Open: ${fraudReason} | ${email} from ${ip}`);
    } else {
      console.log(`✅ ${isInvalid ? 'INVALID' : 'VALID'} Open: ${email} from ${ip} (${countryName})`);
    }

  } catch (error) {
    console.error('Failed to process open event:', error);
  }
}
