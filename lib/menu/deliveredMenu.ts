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
 * First path segments on the apex that are app routes, NOT restaurant slugs.
 * Everything else on `delivered.menu/<seg>` is treated as a site slug.
 *
 * ⚠️ THIS LIST ONLY ROTS IN THE SAFE DIRECTION, AND THAT IS THE POINT. A new marketing route
 * added to the app and forgotten here is treated as a restaurant slug, finds no restaurant, and
 * 404s — it does not appear on the deliverable domain. The reverse default (an allow-list of
 * restaurant slugs) would fail by hiding real restaurants. When a list will inevitably be
 * incomplete, choose the direction where incomplete means "absent" rather than "leaked".
 */
const RESERVED_APEX_SEGMENTS = new Set([
  '', 'api', 'admin', 'login', 'logout', 'signup', 'claim-site', 'claim', 'auth',
  'sites', 'orgs', 'delivered', 'cart', 'checkout', 'orders', 'thank-you',
  'host', '_domains', '_next',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json',
]);

/**
 * QuickSites' own marketing pages, which were reachable ON the restaurant's deliverable domain.
 *
 * ⚠️ delivered.menu IS THE RESTAURANT'S ADDRESS, NOT OUR STOREFRONT. An owner handed
 * `delivered.menu/joes-pizza` who clicks around was finding `delivered.menu/partners`
 * ("Resell QuickSites. Earn the slice.") and `delivered.menu/compare` — an agency pitching
 * resellers and comparing itself to Duda, on the domain whose entire job is to look like Joe's
 * own site. Same reasoning as the watermark being a thin strip: the vendor is a footnote here.
 *
 * They redirect rather than 404 because the pages are real and someone linking to them meant
 * something; they just live at quicksites.ai.
 */
const APEX_REDIRECT_SEGMENTS = new Set([
  'restaurants', 'partners', 'compare', 'build', 'preview', 'pricing', 'features',
  'realtors', 'auto-shops', 'book', 'contact', 'verbatim', 'personas', 'tools', 'gigs',
]);

/** Where an apex path that belongs to QuickSites should send the visitor instead. */
export function apexRedirectTarget(pathname: string): string | null {
  const seg1 = (pathname || '/').replace(/^\/+/, '').split('/')[0] || '';
  if (!APEX_REDIRECT_SEGMENTS.has(seg1)) return null;
  return `https://www.quicksites.ai${pathname}`;
}

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
