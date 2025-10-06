import maxmind, { CityResponse, AsnResponse, IspResponse } from 'maxmind';
import path from 'path';
import fs from 'fs';
import { lookupProxyCheck } from './proxycheck-lookup';

const DB_PATH_CITY = path.join(process.cwd(), 'public', 'geoip', 'GeoLite2-City.mmdb');
const DB_PATH_ASN = path.join(process.cwd(), 'public', 'geoip', 'GeoLite2-ASN.mmdb');
const DB_PATH_ISP = path.join(process.cwd(), 'public', 'geoip', 'GeoIP2-ISP.mmdb');

export interface GeoData {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  organization: string | null;
  asn: number | null;
  timezone: string | null;
}

function isDataIncomplete(data: GeoData): boolean {
  return !data.country || !data.city || data.city === "Unknown" || !data.timezone || !data.region;
}

/**
 * Lookup IP address in MaxMind databases with ProxyCheck fallback
 */
export async function lookupIP(ip: string): Promise<GeoData> {
  const result: GeoData = {
    country: null,
    city: null,
    region: null,
    latitude: null,
    longitude: null,
    isp: null,
    organization: null,
    asn: null,
    timezone: null,
  };

  // If IP is unknown or invalid, try to get it via ProxyCheck directly
  if (
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    (ip >= "172.16." && ip <= "172.31.")
  ) {
    console.log('⚠️ Invalid or private IP, skipping MaxMind and trying ProxyCheck:', ip);
    
    // Try ProxyCheck directly for unknown IPs
    if (ip === 'unknown') {
      return result;
    }
    
    // For private IPs, just return empty result
    return result;
  }

  console.log('🔍 Looking up IP:', ip);

  // Check if DB files exist
  console.log('📁 Database files check:');
  const cityDbExists = fs.existsSync(DB_PATH_CITY);
  const asnDbExists = fs.existsSync(DB_PATH_ASN);
  const ispDbExists = fs.existsSync(DB_PATH_ISP);
  
  console.log(` - City DB: ${cityDbExists ? '✅' : '❌'}`);
  console.log(` - ASN DB: ${asnDbExists ? '✅' : '❌'}`);
  console.log(` - ISP DB: ${ispDbExists ? '✅' : '❌'}`);

  // City lookup
  if (cityDbExists) {
    try {
      const cityLookup = await maxmind.open<CityResponse>(DB_PATH_CITY);
      const cityResult = cityLookup.get(ip);

      if (cityResult) {
        result.country = cityResult.country?.iso_code || null;
        result.city = cityResult.city?.names?.en || cityResult.subdivisions?.[0]?.names?.en || "Unknown";
        result.region = cityResult.subdivisions?.[0]?.names?.en || null;
        result.latitude = cityResult.location?.latitude || null;
        result.longitude = cityResult.location?.longitude || null;
        result.timezone = cityResult.location?.time_zone || null;

        console.log('✅ City lookup success:', {
          country: result.country,
          city: result.city,
          region: result.region,
        });
      } else {
        console.log('⚠️ No city data found for IP:', ip);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('❌ City lookup error:', err.message);
      }
    }
  }

  // ISP lookup (prioritized from GeoIP2-ISP)
  let ispFound = false;
  if (ispDbExists) {
    try {
      console.log('🔍 Trying GeoIP2-ISP database...');
      const ispLookup = await maxmind.open<IspResponse>(DB_PATH_ISP);
      const ispResult = ispLookup.get(ip);

      console.log('📦 ISP Result:', ispResult);

      if (ispResult) {
        result.isp = ispResult.isp || ispResult.organization || null;
        ispFound = true;
      }
    } catch (err) {
      console.error('❌ GeoIP2-ISP lookup error:', err);
    }
  }

  // ASN lookup - organization and ASN from GeoLite2-ASN
  if (asnDbExists) {
    try {
      console.log('🔍 GeoLite2-ASN database lookup...');
      const asnLookup = await maxmind.open<AsnResponse>(DB_PATH_ASN);
      const asnResult = asnLookup.get(ip);

      console.log('📦 ASN Result:', asnResult);

      if (asnResult) {
        result.organization = asnResult.autonomous_system_organization || null;
        result.asn = asnResult.autonomous_system_number || null;

        // Set isp to organization if isp is missing
        if (!ispFound) {
          result.isp = result.organization;
        }

        console.log('✅ ASN data assigned:', {
          isp: result.isp,
          organization: result.organization,
          asn: result.asn,
        });
      } else {
        console.log('⚠️ No ASN data found for IP:', ip);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('❌ ASN lookup error:', err.message);
      }
    }
  }

  // If MaxMind data is incomplete, fallback to ProxyCheck
  if (isDataIncomplete(result)) {
    console.log(`⚠️ MaxMind data incomplete for ${ip}, falling back to ProxyCheck...`);
    const proxyCheckData = await lookupProxyCheck(ip);

    if (proxyCheckData) {
      // Fill in missing fields with ProxyCheck data
      result.country = result.country || proxyCheckData.country || null;
      result.city = result.city === "Unknown" || !result.city ? proxyCheckData.city || "Unknown" : result.city;
      result.region = result.region || proxyCheckData.region || null;
      result.timezone = result.timezone || proxyCheckData.timezone || null;
      result.isp = result.isp || proxyCheckData.isp || null;
      result.organization = result.organization || proxyCheckData.organization || null;
      result.asn = result.asn || proxyCheckData.asn || null;
      result.latitude = result.latitude || proxyCheckData.latitude || null;
      result.longitude = result.longitude || proxyCheckData.longitude || null;

      console.log('✅ ProxyCheck data filled in:', {
        country: result.country,
        city: result.city,
        timezone: result.timezone,
        isp: result.isp,
      });
    }
  }

  console.log('📊 Final geo lookup result:', result);
  return result;
}
