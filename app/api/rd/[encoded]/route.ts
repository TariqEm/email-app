import { NextRequest } from "next/server";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { countriesByCode } from "@/lib/constants/countries";
import { EventType } from '@prisma/client';
import { lookupIP } from "@/lib/geoip/maxmind-lookup";
import { prisma } from "@/lib/prisma";

interface NextRequestWithIp extends NextRequest {
  ip?: string;
}

// 1x1 transparent GIF pixel (base64)
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// async function getIP(request: NextRequest): Promise<string> {
//   if (process.env.USE_TEST_IP === "true" && process.env.TEST_IP) {
//     console.log("Using TEST IP", process.env.TEST_IP);
//     return process.env.TEST_IP;
//   }

//   let ip = "";

//   // Try Cloudflare
//   const cfIP = request.headers.get("cf-connecting-ip");
//   if (cfIP && cfIP !== "::1" && cfIP !== "127.0.0.1") {
//     ip = cfIP;
//   }

//   // Try X-Real-IP
//   if (!ip) {
//     const realIP = request.headers.get("x-real-ip");
//     if (realIP && realIP !== "::1" && realIP !== "127.0.0.1") {
//       ip = realIP;
//     }
//   }

//   // Try X-Forwarded-For
//   if (!ip) {
//     const forwarded = request.headers.get("x-forwarded-for");
//     if (forwarded) {
//       const first = forwarded.split(",")[0].trim();
//       if (first !== "::1" && first !== "127.0.0.1") {
//         ip = first;
//       }
//     }
//   }

//   // Try request.ip if available
//   if (!ip) {
//     if ('ip' in request) {
//       const rIp = (request as NextRequestWithIp).ip;
//       if (rIp && rIp !== "::1" && rIp !== "127.0.0.1") {
//         ip = rIp;
//       }
//     }
//   }

//   // If still no IP or it's localhost, fetch public IP
//   if (!ip || ip === "::1" || ip === "127.0.0.1" || ip === "0.0.0.0") {
//     try {
//       console.log("⚠️ No valid IP from headers, fetching public IP...");
//       const res = await fetch("https://api.ipify.org?format=json", {
//         signal: AbortSignal.timeout(3000),
//       });
//       if (res.ok) {
//         const data = await res.json();
//         ip = data.ip;
//         console.log("✅ Public IP fetched:", ip);
//       }
//     } catch (error) {
//       console.error("❌ Failed to fetch public IP:", error);
//       ip = "unknown";
//     }
//   }

//   // Clean IPv6 mapped IPv4
//   if (ip.startsWith("::ffff:")) {
//     ip = ip.substring(7);
//   }

//   return ip;
// }
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ encoded: string }> }
) {
  try {
    const { encoded } = await params;

    // Extract actual email from path after '='
    const url = new URL(request.url);
    const pathname = url.pathname;
    const splitIndex = pathname.indexOf('=');
    let email = "";
    if (splitIndex !== -1) {
      email = decodeURIComponent(pathname.substring(splitIndex + 1));
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Decode token part only (ignore email from token)
    const data = decodeToken(encoded);
    if (!data) {
      // Return pixel on invalid tokens silently
      return new Response(TRANSPARENT_PIXEL, { headers: { "Content-Type": "image/gif" } });
    }

    const campaignWithOffer = await prisma.campaign.findUnique({
      where: { id: data.campaignId! },
      include: { offer: { select: { allowedCountries: true } } },
    });

    if (!campaignWithOffer) {
      return new Response(TRANSPARENT_PIXEL, { headers: { "Content-Type": "image/gif" } });
    }

    const ip = await getIP(request);
    const userAgent = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || null;

    const uaParser = new UAParser(userAgent);
    const ua = uaParser.getResult();

    const uaLower = userAgent.toLowerCase();
    const osName = ua.os.name?.toLowerCase() || '';
    const isAndroid = osName.includes('android') || uaLower.includes('android');
    const isIOS = osName.includes('ios') || uaLower.includes('iphone') || uaLower.includes('ipad');

    let deviceType = ua.device.type || '';

    if (!deviceType) {
      if (uaLower.includes('mobile') || isAndroid || (isIOS && !uaLower.includes('ipad'))) {
        deviceType = isAndroid ? 'android' : isIOS ? 'ios' : 'mobile';
      } 
      else if (uaLower.includes('tablet') || uaLower.includes('ipad')) {
        deviceType = isAndroid ? 'android-tablet' : isIOS ? 'ios-tablet' : 'tablet';
      } 
      else if (uaLower.includes('bot') || uaLower.includes('crawler') || uaLower.includes('spider')) {
        deviceType = 'bot';
      } 
      else {
        deviceType = 'desktop';
      }
    } else {
      if (deviceType === 'mobile') {
        deviceType = isAndroid ? 'android' : isIOS ? 'ios' : 'mobile';
      } else if (deviceType === 'tablet') {
        deviceType = isAndroid ? 'android-tablet' : isIOS ? 'ios-tablet' : 'tablet';
      }
    }

    const geoData = await lookupIP(ip);
    const cityName = geoData.city || geoData.region || "Unknown";

    const countryCode = geoData.country || ""; // e.g. 'FR'
    const countryName = countriesByCode[countryCode] ?? countryCode; // 'France'

    const allowedCountries = campaignWithOffer.offer.allowedCountries || [];
    const isInvalid = !allowedCountries.includes(countryName);

    const validEvents: string[] = Object.values(EventType);
    const eventType: EventType = data.event && validEvents.includes(data.event) ? data.event as EventType : EventType.open;

    // Use normalizedEmail for upsert
    const emailList = await prisma.emailList.upsert({
      where: { email: normalizedEmail },
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
        email: normalizedEmail,
        country: countryName,
        ipaddress: ip,
        os: ua.os.name ?? null,
        browser: ua.browser.name ?? null,
        timezone: geoData.timezone ?? null,
        openCount: 1,
        lastEvent: new Date(),
      }
    });

    // Insert tracking event
    await prisma.trackingEvent.create({
      data: {
        campaignId: data.campaignId!,
        offerId: data.offerId!,
        eventType,
        emailHash: hashEmail(normalizedEmail),
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
        deviceType: deviceType,
        browser: ua.browser.name ?? null,
        browserVersion: ua.browser.version ?? null,
        os: ua.os.name ?? null,
        isInvalid,
        createdAt: new Date(),
        emailListId: emailList.id,
      },
    });

    return new Response(TRANSPARENT_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err) {
    console.error("Tracking error:", err);
    return new Response(TRANSPARENT_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
}
