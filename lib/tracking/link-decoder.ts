interface TrackingData {
  event: string;
  offerId: string;
  campaignId: string;
  email: string;
}

/**
 * Decodes a base64-encoded tracking token
 * @param encoded - Base64-encoded tracking string
 * @returns Decoded tracking data or null if invalid
 */
export function decodeTrackingToken(encoded: string): TrackingData | null {
  try {
    // Remove %EMAIL% placeholder if present
    const cleanEncoded = encoded.replace('=%EMAIL%', '');

    // Decode from base64 (URL-safe)
    const decoded = Buffer.from(cleanEncoded, 'base64url').toString('utf-8');

    // Parse query string format: e=open&offerID=123&campaignID=456&to=email@example.com
    const params = new URLSearchParams(decoded);

    const event = params.get('e');
    const offerId = params.get('offerID');
    const campaignId = params.get('campaignID');
    const email = params.get('to');

    // Validate required fields
    if (!event || !offerId || !campaignId) {
      return null;
    }

    return {
      event,
      offerId,
      campaignId,
      email: email || '',
    };
  } catch (error) {
    console.error('Error decoding tracking token:', error);
    return null;
  }
}

/**
 * Encodes tracking parameters into a base64 URL-safe string
 * @param data - Tracking data to encode
 * @returns Base64-encoded string
 */

export function encodeTrackingToken(data: {
  event: string;
  offerId: string;
  campaignId: string;
  email: string;
}) {
  const queryString = new URLSearchParams({
    e: data.event,
    offerID: data.offerId,
    campaignID: data.campaignId,
    to: data.email,
  }).toString();

  return Buffer.from(queryString, 'utf-8').toString('base64url');
}