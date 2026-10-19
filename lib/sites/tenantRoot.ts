// lib/sites/tenantRoot.ts — THE registry for the host a tenant site is served on.
//
// ⚠️ WHY THIS EXISTS (2026-10-18, docs/INFRA_SPLIT_PLAN.md). Every tenant site also serves at
// `<slug>.quicksites.ai` — the SAME registrable domain as the admin, the marketing site and the
// partner portals. Google Safe Browsing flags a registrable domain, not a subdomain: one phishing
// page on one tenant site puts a red interstitial on every subdomain, the editor and the homepage.
// Shopify sells on `myshopify.com` and Vercel on `vercel.app` for exactly this reason. We had no
// tenant root at all, and the brand root was spelled out in 25 code files and 4 scripts with no
// registry — so moving it was a grep, and a grep that misses one file ships one surface still
// printing the old host (a postcard, a claim link, an OG tag).
//
// So: ONE module, no imports (safe in `'use client'` files and in the Edge middleware), read at
// call time (a test can set the env), and a source guard (`__tests__/tenantRoot.test.ts`) that
// fails the suite if any code outside this file spells a tenant host from the brand root again.
//
// ⚠️ Inert until `NEXT_PUBLIC_TENANT_ROOT` is set — and it must be set only AFTER `*.<root>` and
// `<root>` are attached to the Vercel project, because the middleware then 308s every
// `<slug>.quicksites.ai` request to `<slug>.<root>`; set early, that is a redirect to a host that
// does not answer, fleet-wide. NEXT_PUBLIC_ means a REBUILD, not a redeploy of the same build.
//
// What moves: platform subdomains. What stays: `www.quicksites.ai` (the app), custom domains
// (untouched — they never shared the root), the reseller roots (`<slug>.cedarsites.com` is the
// reseller's own blast radius and the reseller's own choice), delivered.menu / yardsalesites /
// lemonyum (their own roots already).

/** The brand's registrable domain: the app, the marketing site, the admin. Never a tenant root again once one is set. */
export const BRAND_ROOT = 'quicksites.ai';

/** Reseller roots where the leftmost label is still a site slug. Not moved by this module. */
export const RESELLER_SITE_ROOTS: readonly string[] = ['cedarsites.com', 'pointsevenstudio.com'];

/** Labels that are never a site slug on any root. */
const RESERVED_LABELS = new Set(['www', 'app']);

function cleanHost(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0]
    .replace(/\.$/, '');
}

/**
 * The root tenant sites are served on today: `NEXT_PUBLIC_TENANT_ROOT`, else the brand root.
 * A value equal to the brand root, or with no dot in it, counts as unset.
 */
export function tenantRoot(): string {
  const v = cleanHost(process.env.NEXT_PUBLIC_TENANT_ROOT);
  return v && v !== BRAND_ROOT && v.includes('.') ? v : BRAND_ROOT;
}

/** True once tenant sites live somewhere other than the brand domain. Drives the 308. */
export function tenantRootConfigured(): boolean {
  return tenantRoot() !== BRAND_ROOT;
}

/** The roots whose subdomains are PLATFORM tenant hosts (current root + the brand root while sites are still there). */
export function platformSiteRoots(): string[] {
  return Array.from(new Set([tenantRoot(), BRAND_ROOT]));
}

/** Every root where `<label>.<root>` is a site slug: platform roots + reseller roots. Mirrors what middleware resolves. */
export function tenantSiteDomains(): string[] {
  return Array.from(new Set([...platformSiteRoots(), ...RESELLER_SITE_ROOTS]));
}

/** `<slug>.<root>` on the CURRENT tenant root; '' for an empty slug. */
export function tenantSiteHost(slug: string | null | undefined): string {
  const s = String(slug ?? '').trim().toLowerCase();
  return s ? `${s}.${tenantRoot()}` : '';
}

/** `https://<slug>.<root>`; '' for an empty slug. */
export function tenantSiteUrl(slug: string | null | undefined): string {
  const h = tenantSiteHost(slug);
  return h ? `https://${h}` : '';
}

/**
 * Every platform host a slug has EVER been served on — current root first, then the brand root
 * while a legacy row (a `default_subdomain`, a GSC property, a `published_sites.domain`) may
 * still name it. For lookups and key matching, never for a link.
 */
export function tenantSiteHosts(slug: string | null | undefined): string[] {
  const s = String(slug ?? '').trim().toLowerCase();
  return s ? platformSiteRoots().map((r) => `${s}.${r}`) : [];
}

/**
 * Site slug for a platform-subdomain host — `sandon.quicksites.ai` → `sandon`.
 * Null for an apex, a reserved label (`www`, `app`), or a custom domain.
 */
export function siteSlugFromHost(host: string | null | undefined, roots: string[] = tenantSiteDomains()): string | null {
  const h = cleanHost(host);
  for (const base of roots) {
    const suffix = `.${base}`;
    if (!h.endsWith(suffix)) continue;
    const left = h.slice(0, -suffix.length).split('.')[0];
    if (!left || RESERVED_LABELS.has(left)) return null;
    return left;
  }
  return null;
}

/**
 * Where a request on the OLD platform host must go once a tenant root is configured:
 * `<slug>.quicksites.ai` → `<slug>.<root>`. Null when nothing moves (root unset, a custom domain,
 * the apex, `www`/`app`, a reseller root).
 */
export function legacyTenantRedirectHost(host: string | null | undefined): string | null {
  if (!tenantRootConfigured()) return null;
  const slug = siteSlugFromHost(host, [BRAND_ROOT]);
  return slug ? `${slug}.${tenantRoot()}` : null;
}

/** The tenant root's own apex / www — nobody's site; sent to the brand homepage. */
export function isTenantRootApex(host: string | null | undefined): boolean {
  if (!tenantRootConfigured()) return false;
  const h = cleanHost(host);
  const root = tenantRoot();
  return h === root || h === `www.${root}`;
}

/** Is this host the brand root or one of its subdomains (app, www, or a legacy tenant)? */
export function isBrandHost(host: string | null | undefined): boolean {
  const h = cleanHost(host);
  return h === BRAND_ROOT || h.endsWith(`.${BRAND_ROOT}`);
}
