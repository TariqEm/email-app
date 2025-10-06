import maxmind, { CityResponse, AsnResponse, IspResponse } from 'maxmind';
import path from 'path';
import fs from 'fs';

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

/**
 * Lookup IP address in MaxMind databases
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

  // Skip private/local IPs
  if (
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    (ip >= "172.16." && ip <= "172.31.")
  ) {
    console.log('⚠️ Skipping private/local IP:', ip);
    return result;
  }

  console.log('🔍 Looking up IP:', ip);

  // Check if DB files exist
  console.log('📁 Database files check:');
  console.log(` - City DB: ${fs.existsSync(DB_PATH_CITY) ? '✅' : '❌'}`);
  console.log(` - ASN DB: ${fs.existsSync(DB_PATH_ASN) ? '✅' : '❌'}`);
  console.log(` - ISP DB: ${fs.existsSync(DB_PATH_ISP) ? '✅' : '❌'}`);

  // City lookup
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
    if (err instanceof Error){
      console.error('❌ City lookup error:', err.message);
    }
  }

  // ISP lookup (prioritized from GeoIP2-ISP)
  let ispFound = false;
  if (fs.existsSync(DB_PATH_ISP)) {
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

  // ASN lookup - organization and ASN from GeoLite2-ASN, always set organization here
  if (fs.existsSync(DB_PATH_ASN)) {
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
      if (err instanceof Error){
        console.error('❌ ASN lookup error:', err.message);
      }
    }
  }

  console.log('📊 Final geo lookup result:', result);
  return result;
}
