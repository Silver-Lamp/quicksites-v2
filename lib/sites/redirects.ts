// lib/sites/redirects.ts
//
// Per-site redirects + a real 404 for unknown paths on a public site.
//
// ⚠️ WHY. Both public routes (custom domain `app/host/[[...rest]]` and `app/sites/[slug]/[[...rest]]`)
// took the first path segment as a page slug and, when no page matched, FELL BACK TO THE HOMEPAGE
// with a 200 — so `/anything-at-all` on every live site rendered the home page under a
// self-canonical URL. Two consequences, both found 2026-09-17: Google had indexed
// `decatur-towing.com/gigs` as a page, and a migration from an old site (a Tampa law firm on
// WordPress since 2019) could not honour "redirect the old URLs" — the old paths neither
// redirected nor 404'd, they silently served the home page.
//
// Now: `data.meta.redirects` is a list of `{ from, to, permanent? }`; a matching request is
// redirected (308 by default); an unmatched path whose first segment is not a page of the site
// and not a reserved app path is a 404. Matching is on the normalised path only (lowercase, no
// trailing slash, no query), never on the host.
//
// Pure — no I/O. The routes call `resolvePublicPath` and act on the decision.

export type SiteRedirect = {
  /** Path on the site, e.g. "/practice-areas/personal-injury/". Compared normalised. */
  from: string;
  /** Path on the site ("/criminal-defense") or an absolute http(s) URL. */
  to: string;
  /** 308 when true (default), 307 when false. */
  permanent?: boolean;
};

export type PathDecision =
  | { kind: 'redirect'; to: string; permanent: boolean }
  | { kind: 'page'; slug: string }
  | { kind: 'reserved'; segment: string }
  | { kind: 'not_found'; path: string };

/**
 * App paths that ride the same catch-all and must keep their current behaviour, whatever the
 * site's pages are. Kept as a list, not a regex, so adding one is a one-line diff.
 */
export const RESERVED_FIRST_SEGMENTS = new Set([
  'cart',
  'checkout',
  'thank-you',
  'p',
  'product',
  'verbatim',
  'resume',
  'go',
  'claim-site',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'manifest.json',
  '.well-known',
  'api',
  '_next',
]);

/** "/Practice-Areas/DUI/?x=1" → "/practice-areas/dui". Root stays "/". */
export function normalizePath(input: string): string {
  let p = String(input || '').trim();
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/').toLowerCase();
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

const ABS_URL = /^https?:\/\/[^\s]+$/i;

/**
 * Validate + normalise a redirect list from template meta. Invalid entries are dropped, not
 * thrown: a bad row must never take the whole site down. `to` may be a site path or an absolute
 * URL; a redirect from a path to itself is dropped (it would loop).
 */
export function parseSiteRedirects(input: unknown): SiteRedirect[] {
  if (!Array.isArray(input)) return [];
  const out: SiteRedirect[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const fromRaw = (raw as any).from;
    const toRaw = (raw as any).to;
    if (typeof fromRaw !== 'string' || typeof toRaw !== 'string') continue;
    const from = normalizePath(fromRaw);
    if (from === '/') continue; // never redirect the root
    let to = toRaw.trim();
    if (!ABS_URL.test(to)) to = normalizePath(to);
    if (!to || to === from) continue;
    if (seen.has(from)) continue;
    seen.add(from);
    out.push({ from, to, permanent: (raw as any).permanent !== false });
    if (out.length >= 500) break;
  }
  return out;
}

/** The redirect whose `from` equals the normalised path, or null. */
export function matchRedirect(redirects: SiteRedirect[], path: string): SiteRedirect | null {
  const p = normalizePath(path);
  return redirects.find((r) => r.from === p) ?? null;
}

type BlockLike = { type?: string | null };
type PageLike = {
  slug?: string | null;
  id?: string | null;
  content_blocks?: BlockLike[] | null;
  blocks?: BlockLike[] | null;
};

/**
 * The same-page anchor a home-page section answers to, mirroring the renderer: the first
 * block of each type gets id=<type>, and contact_form answers to "contact"
 * (components/sites/site-renderer.tsx). Returns the anchor when `segment` names a section
 * that exists on the home page, else null.
 *
 * Why: 121 of 143 live sites (2026-09-19) carry hero/nav links like "/contact" and
 * "/services" that name a SECTION of the home page, not a page. Before the real-404 change
 * (#965) they fell through to home with a 200; after it they 404'd — "Call Us Now" on a towing
 * site went to a dead page. A redirect to "/#contact" is the honest version of what those
 * links always meant.
 */
export function sectionAnchorOnHome(pages: PageLike[], segment: string): string | null {
  const seg = segment.toLowerCase();
  if (!seg) return null;
  const home = pages.find((p) => p?.slug) ?? pages[0];
  const blocks: BlockLike[] = Array.isArray(home?.content_blocks)
    ? home!.content_blocks!
    : Array.isArray(home?.blocks)
      ? home!.blocks!
      : [];
  for (const b of blocks) {
    const t = String(b?.type ?? '').toLowerCase();
    if (!t) continue;
    const anchor = t === 'contact_form' ? 'contact' : t;
    if (anchor === seg) return anchor;
  }
  return null;
}

/**
 * Decide what a public request for `rest` on this site gets.
 *   1. a redirect (checked on the FULL path, so old multi-segment URLs can be mapped),
 *   2. a page (first segment is a page slug/id, or "home"/empty → the first page),
 *   3. a reserved app path (cart, checkout, product pages…) → untouched,
 *   4. otherwise a 404.
 */
export function resolvePublicPath(
  site: {
    pages?: PageLike[] | null;
    data?: { pages?: PageLike[] | null; meta?: { redirects?: unknown } | null } | null;
  },
  rest: string[] | null | undefined
): PathDecision {
  const pages: PageLike[] = Array.isArray(site?.pages)
    ? site.pages!
    : Array.isArray(site?.data?.pages)
      ? site.data!.pages!
      : [];
  const segments = (rest ?? []).map((s) => String(s ?? '')).filter(Boolean);
  const path = normalizePath(`/${segments.join('/')}`);

  const redirects = parseSiteRedirects(site?.data?.meta?.redirects);
  const hit = matchRedirect(redirects, path);
  if (hit) return { kind: 'redirect', to: hit.to, permanent: hit.permanent !== false };

  const first = (segments[0] ?? '').toLowerCase();
  if (!first || first === 'home') {
    const firstPage = pages.find((p) => p?.slug) ?? pages[0];
    return { kind: 'page', slug: (firstPage?.slug as string) || 'home' };
  }
  if (RESERVED_FIRST_SEGMENTS.has(first)) return { kind: 'reserved', segment: first };

  const page = pages.find(
    (p) =>
      String(p?.slug ?? '').toLowerCase() === first || String(p?.id ?? '').toLowerCase() === first
  );
  if (page) return { kind: 'page', slug: String(page.slug ?? page.id) };

  // A section of the home page, addressed as if it were a page ("/contact" → "/#contact").
  // Temporary redirect on purpose: the section's address is the home page, and a permanent
  // one would let a crawler cache a mapping that changes the day a real /contact page is added.
  if (segments.length === 1) {
    const anchor = sectionAnchorOnHome(pages, first);
    if (anchor) return { kind: 'redirect', to: `/#${anchor}`, permanent: false };
  }

  return { kind: 'not_found', path };
}
