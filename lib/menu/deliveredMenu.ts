// lib/menu/deliveredMenu.ts
//
// The "delivered.menu" restaurant surface. A restaurant's default deliverable URL
// is delivered.menu — reachable BOTH as a subdomain (`hawkers.delivered.menu`) and
// as a path (`delivered.menu/hawkers`); both resolve to the same site via
// `/sites/<slug>`. Restaurants may still attach their own custom domain (unchanged);
// delivered.menu is just the zero-setup default.
//
// The same URL works across the lifecycle: an unclaimed outreach draft renders with
// the "not published yet" watermark (noindex); once claimed + published it becomes
// the live, indexable ordering site (watermark drops automatically). See the menu
// branch in `middleware.ts` and the `x-qsites-menu-host` fallback in
// `app/sites/[slug]/[[...rest]]/page.tsx`.
//
// Inert until NEXT_PUBLIC_MENU_BASE_DOMAIN is set (e.g. "delivered.menu"), so this
// can merge before DNS/Vercel are cut over — no delivered.menu traffic reaches the
// app until then, and the env flag keeps the routing + link-builders dormant.

export const MENU_BASE_DOMAIN = (process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || '')
  .toLowerCase()
  .replace(/\.$/, '');

/**
 * First path segments on the apex that are app/marketing routes, NOT restaurant
 * slugs. Everything else on `delivered.menu/<seg>` is treated as a site slug.
 */
const RESERVED_APEX_SEGMENTS = new Set([
  '', 'api', 'admin', 'login', 'logout', 'signup', 'claim-site', 'preview',
  'sites', 'orgs', 'restaurants', 'delivered', 'partners', 'compare', 'build',
  'cart', 'checkout', 'orders', 'host', '_domains', '_next',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json',
]);

export function menuEnabled(): boolean {
  return !!MENU_BASE_DOMAIN;
}

function stripPort(host: string): string {
  return (host || '').toLowerCase().replace(/\.$/, '').split(':')[0];
}

/** apex `delivered.menu` / `www.delivered.menu` (not a per-restaurant subdomain). */
export function isMenuApexHost(host: string): boolean {
  if (!MENU_BASE_DOMAIN) return false;
  const h = stripPort(host);
  return h === MENU_BASE_DOMAIN || h === `www.${MENU_BASE_DOMAIN}`;
}

/** `<slug>.delivered.menu` → the slug (null for apex / www / app). */
export function menuSubdomainSlug(host: string): string | null {
  if (!MENU_BASE_DOMAIN) return null;
  const h = stripPort(host);
  const suffix = `.${MENU_BASE_DOMAIN}`;
  if (!h.endsWith(suffix)) return null;
  const left = h.slice(0, -suffix.length);
  if (!left || left === 'www' || left === 'app') return null;
  return left.split('.')[0];
}

/** Any delivered.menu host (apex or a restaurant subdomain). */
export function isMenuHost(host: string): boolean {
  return isMenuApexHost(host) || menuSubdomainSlug(host) !== null;
}

/** `delivered.menu/<slug>/...` → slug (null when the first segment is a reserved app path). */
export function menuPathSlug(pathname: string): string | null {
  const seg1 = (pathname || '/').replace(/^\/+/, '').split('/')[0] || '';
  if (RESERVED_APEX_SEGMENTS.has(seg1)) return null;
  return seg1;
}

/**
 * The default deliverable URL for a restaurant slug (subdomain form — the cleaner of
 * the two; the path form `delivered.menu/<slug>` resolves to the same site). Falls
 * back to the relative preview path when the surface isn't configured yet.
 */
export function menuSiteUrl(slug: string): string {
  return MENU_BASE_DOMAIN ? `https://${slug}.${MENU_BASE_DOMAIN}` : `/preview/${slug}`;
}
