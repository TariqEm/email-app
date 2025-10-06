/**
 * Returns a 1x1 transparent GIF pixel as Buffer
 * Base64: R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
 */
export function getTransparentPixel(): Buffer {
  const base64Pixel = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return Buffer.from(base64Pixel, 'base64');
}
