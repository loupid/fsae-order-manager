/**
 * Vendor URL Parsers for DigiKey, Mouser, and McMaster-Carr
 * 100% Non-scraping regex extraction.
 */

export const DIGIKEY_PATTERNS = [
  // Modern pattern: /products/detail/{mfg}/{mpn}/{sku} with optional language code /en/, /fr/, etc.
  {
    regex: /digikey\.[a-z.]+\/(?:[a-z]{2}\/)?products\/detail\/([^/?#]+)\/([^/?#]+)\/([0-9A-Za-z_-]+)/i,
    extract: (m) => ({
      supplier: 'DigiKey',
      manufacturer: decodeURIComponent(m[1]).replace(/-/g, ' ').trim(),
      mpn: decodeURIComponent(m[2]).trim(),
      sku: decodeURIComponent(m[3] || m[2]).trim(),
      recognized: true
    })
  },
  // Legacy pattern: /product-detail/{lang}/{mfg}/{mpn}/{sku}
  {
    regex: /digikey\.[a-z.]+\/product-detail\/(?:[a-z]{2}\/)?([^/?#]+)\/([^/?#]+)\/([^/?#]+)/i,
    extract: (m) => ({
      supplier: 'DigiKey',
      manufacturer: decodeURIComponent(m[1]).replace(/-/g, ' ').trim(),
      mpn: decodeURIComponent(m[2]).trim(),
      sku: decodeURIComponent(m[3]).trim(),
      recognized: true
    })
  }
];

export const MOUSER_PATTERNS = [
  // Standard two-segment pattern: /ProductDetail/{mfg}/{partNumber}
  {
    regex: /mouser\.[a-z.]+\/(?:[a-z]{2}\/)?ProductDetail\/([^/?#]+)\/([^/?#]+)/i,
    extract: (m) => ({
      supplier: 'Mouser',
      manufacturer: decodeURIComponent(m[1]).replace(/-/g, ' ').trim(),
      mpn: decodeURIComponent(m[2]).trim(),
      sku: decodeURIComponent(m[2]).trim(),
      recognized: true
    })
  },
  // Single-segment pattern (Mouser PN): /ProductDetail/{mouserPN}
  {
    regex: /mouser\.[a-z.]+\/(?:[a-z]{2}\/)?ProductDetail\/([0-9A-Za-z_-]+)/i,
    extract: (m) => ({
      supplier: 'Mouser',
      manufacturer: '',
      mpn: decodeURIComponent(m[1]).trim(),
      sku: decodeURIComponent(m[1]).trim(),
      recognized: true
    })
  }
];

export const MCMASTER_PATTERNS = [
  // Alphanumeric catalog number in path or URL end
  {
    regex: /mcmaster\.com\/(?:.*\/)?([0-9]{4,6}[A-Z][0-9]{2,4}|[0-9]{4,6}[A-Z]{1,2}[0-9]+|[0-9]{5,9}[A-Z0-9]?)(?:\/|\?|#|$)/i,
    extract: (m) => ({
      supplier: 'McMaster-Carr',
      manufacturer: 'McMaster-Carr',
      mpn: m[1].toUpperCase().trim(),
      sku: m[1].toUpperCase().trim(),
      recognized: true
    })
  }
];

/**
 * Unified Parser extracting vendor metadata from a URL string.
 * @param {string} inputUrl
 * @returns {{ supplier: string, sku: string, mpn: string, manufacturer: string, recognized: boolean, originalUrl: string }}
 */
export function parseVendorUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return {
      supplier: 'Other',
      sku: '',
      mpn: '',
      manufacturer: '',
      recognized: false,
      originalUrl: ''
    };
  }

  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return {
      supplier: 'Other',
      sku: '',
      mpn: '',
      manufacturer: '',
      recognized: false,
      originalUrl: ''
    };
  }

  // 1. Check DigiKey
  for (const p of DIGIKEY_PATTERNS) {
    const match = trimmed.match(p.regex);
    if (match) return { ...p.extract(match), originalUrl: trimmed };
  }

  // 2. Check Mouser
  for (const p of MOUSER_PATTERNS) {
    const match = trimmed.match(p.regex);
    if (match) return { ...p.extract(match), originalUrl: trimmed };
  }

  // 3. Check McMaster-Carr
  for (const p of MCMASTER_PATTERNS) {
    const match = trimmed.match(p.regex);
    if (match) return { ...p.extract(match), originalUrl: trimmed };
  }

  // 4. Domain Fallback
  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '');
    const domainPrefix = host.split('.')[0];
    const cleanSupplier = domainPrefix ? domainPrefix.charAt(0).toUpperCase() + domainPrefix.slice(1) : 'Other';

    return {
      supplier: cleanSupplier || 'Other',
      sku: '',
      mpn: '',
      manufacturer: '',
      recognized: false,
      originalUrl: trimmed
    };
  } catch (e) {
    return {
      supplier: 'Other',
      sku: '',
      mpn: '',
      manufacturer: '',
      recognized: false,
      originalUrl: trimmed
    };
  }
}
