// lib/lemonade/lemonYum.ts
//
// Host helpers for lemonyum.com — the consumer-facing brand for parent-facilitated lemonade
// stands. Deliberately a near-copy of lib/menu/deliveredMenu.ts: that is the reference
// implementation for a branded host in this codebase and it has already absorbed the mistakes,
// so divergence here would be a new set of them rather than an improvement.
//
// Inert until NEXT_PUBLIC_LEMONYUM_BASE_DOMAIN is set, so this ships dark and nothing changes
// until the domain is pointed at Vercel.
//
// See docs/LEMONYUM_PLAN.md.

export const LEMONYUM_BASE_DOMAIN = (process.env.NEXT_PUBLIC_LEMONYUM_BASE_DOMAIN || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

export function lemonYumEnabled(): boolean {
  return !!LEMONYUM_BASE_DOMAIN;
}

const strip = (host: string) => (host || '').toLowerCase().split(':')[0].replace(/\.$/, '');

/** lemonyum.com or www.lemonyum.com */
export function isLemonYumApexHost(host: string): boolean {
  if (!LEMONYUM_BASE_DOMAIN) return false;
  const h = strip(host);
  return h === LEMONYUM_BASE_DOMAIN || h === `www.${LEMONYUM_BASE_DOMAIN}`;
}

/** ellie.lemonyum.com → "ellie". Null for the apex, www, and anything else. */
export function lemonYumSubdomainSlug(host: string): string | null {
  if (!LEMONYUM_BASE_DOMAIN) return null;
  const h = strip(host);
  const suffix = `.${LEMONYUM_BASE_DOMAIN}`;
  if (!h.endsWith(suffix)) return null;
  const left = h.slice(0, -suffix.length);
  if (!left || left === 'www') return null;
  return left.split('.')[0];
}

export function isLemonYumHost(host: string): boolean {
  return isLemonYumApexHost(host) || !!lemonYumSubdomainSlug(host);
}

/**
 * ⚠️ THE RESERVED LIST MUST ROT IN THE SAFE DIRECTION, and this is the whole reason it is a
 * short allowlist rather than "everything QuickSites serves".
 *
 * `delivered.menu` shipped with five QuickSites marketing pages live on what was meant to be the
 * restaurant's own address, and they had to be 307'd away (PR #722). The fix that stuck was to
 * treat an UNKNOWN first path segment as a tenant slug — so a marketing route added next year is
 * simply absent from this host, rather than silently appearing on it. The failure mode of
 * forgetting to update this list is a 404 on a stand that does not exist, not our pricing page
 * showing up on a child's lemonade stand domain.
 */
/**
 * ⚠️ APP ENTRY POINTS THAT MUST ESCAPE THE BRAND HOST.
 *
 * The rule above ("an unknown first segment is a stand slug") protects a customer's domain from
 * leaking our marketing — but I wrote that it "rots in the safe direction" without naming what it
 * breaks, and this is what: a slug-shaped APP route gets swallowed too. `/admin/templates/new` —
 * the target of the first CTA on the page I shipped — rewrote to `/sites/admin/templates/new`
 * and 404'd on lemonyum.com.
 *
 * Both failure directions are real. The reserved list stops marketing leaking ONTO the brand
 * host; this list stops the app disappearing FROM it. Neither is the "safe" default on its own,
 * and claiming one of them was is what let a broken CTA ship.
 *
 * These redirect to the app rather than rendering here: the builder wants a logged-in session on
 * the app's own domain, and serving /admin under a lemonade brand is confusing even when it works.
 */
const APP_SEGMENTS = new Set(['admin', 'login', 'signup', 'build', 'merchant', 'dashboard', 'account']);

export function lemonYumAppRedirect(pathname: string, search: string): string | null {
  const seg = (pathname || '/').split('/').filter(Boolean)[0]?.toLowerCase();
  if (!seg || !APP_SEGMENTS.has(seg)) return null;
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');
  return `${base}${pathname}${search || ''}`;
}

const RESERVED_SEGMENTS = new Set([
  'api',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'setup',   // the parent-facing setup guide
  'privacy',
  'terms',
]);

/** lemonyum.com/ellie → "ellie". Null for the apex and reserved paths. */
export function lemonYumPathSlug(pathname: string): string | null {
  const seg = (pathname || '/').split('/').filter(Boolean)[0];
  if (!seg) return null;
  const s = seg.toLowerCase();
  if (RESERVED_SEGMENTS.has(s)) return null;
  // A slug is what our own slugs look like. Anything else is not a stand.
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(s)) return null;
  return s;
}

/** Public URL for a stand on the branded host, or null when the host is not configured. */
export function lemonYumSiteUrl(slug: string): string | null {
  if (!LEMONYUM_BASE_DOMAIN || !slug) return null;
  // PATH form, not subdomain. `lemonyum.com/ellie` is shorter to print on a sign, easier to read
  // aloud, and — the part that matters — reliably linkified by phone messaging apps. Both forms
  // resolve; this is the one we hand out.
  return `https://${LEMONYUM_BASE_DOMAIN}/${slug}`;
}
