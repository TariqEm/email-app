interface ProxyCheckIpData {
  network?: {
    asn?: string;
    provider?: string;
    organisation?: string;
  };
  location?: {
    country_code?: string;
    city_name?: string;
    region_name?: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface ProxyCheckResponse {
  status: string;
  [ip: string]: ProxyCheckIpData | string; // Allow both types
}

export interface ProxyCheckResult {
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: number;
  latitude?: number;
  longitude?: number;
}

export async function lookupProxyCheck(ip: string): Promise<ProxyCheckResult | null> {
  const apiKey = process.env.PROXYCHECK_API_KEY;
  
  if (!apiKey) {
    console.warn('PROXYCHECK_API_KEY not set in environment variables');
    return null;
  }

  try {
    const response = await fetch(
      `https://proxycheck.io/v3/${ip}?key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      console.error('ProxyCheck API error:', response.status);
      return null;
    }

    const data = await response.json() as ProxyCheckResponse;

    if (data.status !== 'ok') {
      console.error('ProxyCheck returned non-ok status:', data.status);
      return null;
    }

    const ipData = data[ip];
    
    // Type guard to check if ipData is the correct type
    if (!ipData || typeof ipData === 'string') {
      return null;
    }

    // Extract ASN number from string like "AS15169"
    const asnString = ipData.network?.asn;
    let asn: number | undefined;
    if (asnString) {
      const match = asnString.match(/AS(\d+)/);
      if (match) {
        asn = parseInt(match[1], 10);
      }
    }

    return {
      country: ipData.location?.country_code || undefined,
      city: ipData.location?.city_name || undefined,
      region: ipData.location?.region_name || undefined,
      timezone: ipData.location?.timezone || undefined,
      isp: ipData.network?.provider || undefined,
      organization: ipData.network?.organisation || undefined,
      asn,
      latitude: ipData.location?.latitude || undefined,
      longitude: ipData.location?.longitude || undefined,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('ProxyCheck lookup error:', error.message);
    }
    return null;
  }
}
