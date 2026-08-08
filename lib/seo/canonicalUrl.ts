// lib/seo/canonicalUrl.ts
//
// The public URL of a rendered site page — the one a visitor typed, not the one our router
// resolved it to.
//
// ⚠️ WHY THIS EXISTS. Every tenant host is a `NextResponse.rewrite` onto `/sites/<slug>/<page>`,
// and the renderer only ever sees the rewritten path. Building a canonical out of that publishes
// our routing table: `www.graftontowing.com/` declared `<link rel="canonical"
// href="https://www.graftontowing.com/sites/home">` — a URL that exists (it 200s) but is an
// implementation detail nothing links to. Fleet-wide, on custom domains and platform subdomains
// alike. Found while checking why a site was not indexed.
//
// ⚠️ THIS IS THE FAILURE SHAPE THAT LOOKS LIKE SUCCESS. A wrong canonical does not error. The tag
// is well-formed, the page renders, `curl` is 200, and the only symptom is a search engine
// quietly filing the page under an address no human will ever visit. Nothing in this repo could
// have caught it except looking at the served HTML — which is the same reason the render gate
// verifies the received artefact rather than the inputs that produced it.
//
// ⚠️ THE CANONICAL IS SELF-REFERENCING, DELIBERATELY. A page reached on host H canonicalises to
// host H. It does NOT try to nominate a "preferred" host when a site is reachable at both
// `<slug>.quicksites.ai` and its custom domain — that would need the domain's real attachment
// state, and a canonical pointing at a domain whose DNS is not live is worse than the bug it
// replaces. Self-referencing is true on whichever host you are on. Cross-host consolidation is a
// separate decision with a real prerequisite; see the note in the PR.

/** Request header carrying the path the visitor actually requested, set by `middleware.ts`. */
export const PUBLIC_PATH_HEADER = 'x-qsites-public-path';

function normalizePath(p: string): string {
  const trimmed = p.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  // Strip a trailing slash so `/menu` and `/menu/` do not become two canonicals.
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

/**
 * The public path for a site page.
 *
 * `headerPath` is authoritative when present — it is the literal request path, so it is right by
 * construction for every rewrite shape we have (subdomain, custom domain, `delivered.menu/<slug>`
 * apex form) without this module having to know which one it is looking at.
 *
 * The fallback covers the one case that is NOT rewritten: a direct hit on the platform host at
 * `/sites/<slug>/<rest>`, where the requested path and the routed path are the same thing.
 */
export function publicPathFor(args: {
  headerPath?: string | null;
  slug: string;
  rest?: string[] | null;
}): string {
  const { headerPath, slug, rest } = args;
  if (typeof headerPath === 'string' && headerPath.trim()) return normalizePath(headerPath);
  const tail = (rest ?? []).filter(Boolean).join('/');
  return normalizePath(`/sites/${slug}${tail ? `/${tail}` : ''}`);
}

/** Join an origin and a public path into an absolute URL. No trailing slash except at the root. */
export function absoluteUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, '');
  const p = normalizePath(path);
  return p === '/' ? `${base}/` : `${base}${p}`;
}

/**
 * ⚠️ `home` IS A ROUTING ARTEFACT, NOT A PAGE THE VISITOR ASKED FOR. `middleware.ts` rewrites a
 * bare tenant root `/` to `/sites/<slug>/home`, so the home page arrives carrying an explicit
 * page slug it never had in the URL. Anything reconstructing a path from the ROUTED segments must
 * drop it, or the site's front door canonicalises to `/home` — a second URL for the same page,
 * which is precisely the duplicate a canonical exists to prevent.
 */
export function stripHomeSegment(rest?: string[] | null): string[] {
  const list = (rest ?? []).filter(Boolean);
  return list.length === 1 && list[0] === 'home' ? [] : list;
}

/** Domains where the leftmost label is a site slug (mirrors `PLATFORM_DOMAINS` in middleware.ts). */
export const PLATFORM_SITE_DOMAINS = ['quicksites.ai', 'cedarsites.com', 'pointsevenstudio.com'];

/**
 * Site slug for a platform-subdomain host — `sandon.quicksites.ai` → `sandon`.
 * Returns null for an apex, a custom domain, or the reserved `www`/`app` labels.
 */
export function siteSlugFromHost(host: string): string | null {
  const h = (host || '').toLowerCase().replace(/\.$/, '').split(':')[0];
  for (const base of PLATFORM_SITE_DOMAINS) {
    if (!h.endsWith(`.${base}`)) continue;
    const left = h.slice(0, -(base.length + 1)).split('.')[0];
    if (!left || left === 'www' || left === 'app') return null;
    return left;
  }
  return null;
}

/**
 * Public path of one page WITHIN a site, on the site's own host.
 *
 * ⚠️ The home page is `/`, never `/home`. `home` is the slug our editor gives the first page and
 * the segment middleware injects when rewriting a bare root; neither is an address.
 */
export function sitePagePath(
  pageSlug: string | null | undefined,
  opts: { isFirstPage?: boolean } = {},
): string {
  const s = (pageSlug ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
  // ⚠️ `home` is not the only name a front page has. Sandon's site calls its only page `index`,
  // so a `home`-only rule put `https://sandon.quicksites.ai/index` in his sitemap — one page
  // advertised at two addresses, which is the duplicate this module exists to prevent. The
  // positional rule is the reliable one: whatever the first page is called, it is the root.
  if (!s || s === 'home' || s === 'index' || opts.isFirstPage) return '/';
  return `/${s}`;
}
