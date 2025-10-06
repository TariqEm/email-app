import { NextRequest } from 'next/server';

/**
 * Extracts the real client IP address from request headers
 * Handles various proxy scenarios (Cloudflare, Nginx, etc.)
 * @param request - Next.js request object
 * @returns Real IP address or fallback
 */
export function extractRealIP(request: NextRequest): string {
  const headers = request.headers;

  // Cloudflare specific header (most reliable if using CF)
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // X-Real-IP (set by Nginx and other proxies)
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // X-Forwarded-For (can contain multiple IPs, get the first one)
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP in the chain (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Fallback to connection remote address
  // Note: In production behind a proxy, this will be the proxy IP
  return '0.0.0.0';
}
