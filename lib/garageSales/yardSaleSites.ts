// lib/garageSales/yardSaleSites.ts
//
// Host helpers for yardsalesites.com — the branded front door for garage sales, the same way
// lemonyum.com fronts lemonade stands and delivered.menu fronts restaurants.
//
// This one earns its domain more than the others do, because the URL is PRINTED ON A STICKER
// that goes on a cardboard sign at a junction:
//
//     quicksites.ai/s/5BC-GP8      →   yardsalesites.com/5BC-GP8
//
// Shorter, self-explaining to a stranger reading it at 20mph, and a `.com`, so it linkifies when
// someone texts it to a friend (a bare `.menu` did not — see docs/LEMONYUM_PLAN.md §1).
//
// Inert until NEXT_PUBLIC_YARDSALE_BASE_DOMAIN is set.
import { isPlausibleCode, normalizeCode } from './codes';

export const YARDSALE_BASE_DOMAIN = (process.env.NEXT_PUBLIC_YARDSALE_BASE_DOMAIN || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

export function yardSaleEnabled(): boolean {
  return !!YARDSALE_BASE_DOMAIN;
}

const strip = (host: string) => (host || '').toLowerCase().split(':')[0].replace(/\.$/, '');

export function isYardSaleApexHost(host: string): boolean {
  if (!YARDSALE_BASE_DOMAIN) return false;
  const h = strip(host);
  return h === YARDSALE_BASE_DOMAIN || h === `www.${YARDSALE_BASE_DOMAIN}`;
}

/** 5bcgp8.yardsalesites.com → "5BCGP8". Null unless the label is a real code shape. */
export function yardSaleSubdomainCode(host: string): string | null {
  if (!YARDSALE_BASE_DOMAIN) return null;
  const h = strip(host);
  const suffix = `.${YARDSALE_BASE_DOMAIN}`;
  if (!h.endsWith(suffix)) return null;
  const left = h.slice(0, -suffix.length).split('.')[0];
  if (!left || left === 'www') return null;
  const code = normalizeCode(left);
  return isPlausibleCode(code) ? code : null;
}

export function isYardSaleHost(host: string): boolean {
  return isYardSaleApexHost(host) || !!yardSaleSubdomainCode(host);
}

/**
 * Paths on the apex that are NOT a sticker code and are ours to serve.
 *
 * ⚠️ THE FENCE WORKS DIFFERENTLY HERE THAN ON lemonyum.com, AND THE DIFFERENCE MATTERS.
 *
 * On a slug-shaped namespace, an unknown path is *probably a tenant*, so treating unknowns as
 * tenants is the safe default — a forgotten marketing route goes missing rather than leaking
 * (the delivered.menu lesson, PR #722).
 *
 * A sticker code is not slug-shaped: it is exactly six characters of a known alphabet. So an
 * unknown path here is definitely NOT a sale, and "treat unknowns as tenants" would send
 * `/pricing` to a sale lookup and 404 it — fine — but `/some-new-page` would too, and anything
 * we ever add would be invisible. The honest rule for a fixed-shape namespace is the inverse:
 * match the SHAPE, allowlist the few pages that belong here, and send everything else to the
 * directory rather than serving QuickSites' marketing on a stranger's yard-sale sign.
 */
// ⚠️ THIS FENCE IS A TRAP FOR NEW PAGES AND IT IS INVERTED ON PURPOSE. Anything not listed here
// is redirected to the directory on yardsalesites.com — which is right (a stranger's yard-sale
// sign must not lead to QuickSites marketing) and means a page you add is INVISIBLE on the brand
// host until its first segment appears in this set. It fails quietly: the page works perfectly on
// quicksites.ai and 307s away on the domain it was built for.
//
// 'yard-sale' is the self-serve front door (/yard-sale/new). It is the one page a seller arriving
// at the apex most needs to reach, so its absence here would have made the tool unreachable at
// exactly the address we are trying to rank.
const APEX_PAGES = new Set(['', 'privacy', 'terms', 'about', 'yard-sale']);

/** yardsalesites.com/5BC-GP8 → "5BCGP8". Null when the first segment isn't a code. */
export function yardSaleCodeFromPath(pathname: string): string | null {
  const seg = (pathname || '/').split('/').filter(Boolean)[0];
  if (!seg) return null;
  const code = normalizeCode(seg);
  return isPlausibleCode(code) ? code : null;
}

/** True when the apex should serve this path itself rather than redirecting to the directory. */
export function isYardSaleApexPage(pathname: string): boolean {
  const seg = (pathname || '/').split('/').filter(Boolean)[0] ?? '';
  return APEX_PAGES.has(seg.toLowerCase());
}

/**
 * App entry points that must escape the brand host — same reasoning as lemonYum's, and needed
 * here too: a code-shaped fence sends `/admin/...` to the directory instead of the builder,
 * which is a friendlier wrong answer but still a wrong one.
 */
const APP_SEGMENTS = new Set(['admin', 'login', 'signup', 'build', 'merchant', 'dashboard', 'account']);

export function yardSaleAppRedirect(pathname: string, search: string): string | null {
  const seg = (pathname || '/').split('/').filter(Boolean)[0]?.toLowerCase();
  if (!seg || !APP_SEGMENTS.has(seg)) return null;
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');
  return `${base}${pathname}${search || ''}`;
}

/** The URL to print on a sticker, or null when the branded host isn't configured. */
export function yardSaleStickerUrl(code: string): string | null {
  if (!YARDSALE_BASE_DOMAIN || !code) return null;
  return `https://${YARDSALE_BASE_DOMAIN}/${code}`;
}
