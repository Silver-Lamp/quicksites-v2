// lib/seo/pageTitle.ts
//
// The <title> for a rendered tenant page.
//
// ⚠️ EVERY SITE WHOSE FIRST PAGE IS CALLED "Home" WAS TITLED "Home". Checked live 2026-08-09:
// `www.graftontowing.com` — a paying customer — and `renton-restaurant.delivered.menu` both
// served `<title>Home</title>`. The chain was `page.meta.title || page.title || template_name`,
// and the builder names the first page "Home" by default, so the page title always existed and
// the site name was never reached.
//
// That is the strongest on-page signal a document has, and it was spending it on a word that
// identifies nothing: not the business, not the trade, not the city. It is also what a visitor
// sees in a browser tab, so a pinned tab for a towing company reads "Home", as does a pinned tab
// for every other QuickSites site they have open.
//
// ⚠️ THE FIX IS TO TREAT A GENERIC PAGE NAME AS ABSENT, NOT TO STOP READING PAGE TITLES. An owner
// who renames their page "Emergency Towing — Grafton MA" means it, and that must still win. The
// only thing being discarded is the builder's own placeholder.
//
// ⚠️ AND NOTHING HERE IS INVENTED. Every part comes from a field the owner filled in — business
// name, city, region, an explicit SEO title. When they are absent the title is shorter, never
// guessed at from an address string or a slug.

/** Page names the builder assigns by default, which say nothing about the site. */
const GENERIC_PAGE_TITLES = new Set([
  'home',
  'index',
  'main',
  'page',
  'new page',
  'untitled',
  'untitled page',
  'landing',
  '',
]);

export function isGenericPageTitle(t: unknown): boolean {
  return GENERIC_PAGE_TITLES.has(String(t ?? '').trim().toLowerCase());
}

function firstNonEmpty(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

/**
 * A slug wearing a business name's clothes — `graftontowing`, `renton-restaurant`.
 *
 * ⚠️ 17 PUBLISHED SITES HAVE NO `business_name`, so the name falls back to `siteTitle`, which the
 * builder sets to the slug. `<title>graftontowing — Grafton, WI</title>` is better than "Home"
 * and still not the business's name: lowercase, unspaced, machine-shaped. It is NOT prettified —
 * splitting "graftontowing" into "Grafton Towing" requires guessing where the words are, and a
 * guess about a business's own name is exactly the kind of invention this file avoids elsewhere.
 * Instead the owner's own headline is preferred, since it is real text they wrote.
 */
export function looksLikeSlug(name: string): boolean {
  const n = name.trim();
  if (!n || /\s/.test(n)) return false;
  return n === n.toLowerCase();
}

export type TitleParts = {
  /** An explicit SEO title the owner typed. Used verbatim when present. */
  seoTitle?: string | null;
  /** The page's own name, e.g. "Services". */
  pageTitle?: string | null;
  /** The business/site name. */
  siteName?: string | null;
  city?: string | null;
  region?: string | null;
  /** The hero headline — owner-written, used when the "name" turns out to be a slug. */
  heroHeadline?: string | null;
  /** True for the site's front page — a subpage keeps its own name in the title. */
  isHomePage?: boolean;
};

/**
 * Compose the title.
 *
 * Home page:    "Grafton Towing — Grafton, MA"      (site + place)
 * Subpage:      "Services — Grafton Towing"          (page + site)
 * Owner's own:  whatever they typed, untouched.
 */
export function buildPageTitle(parts: TitleParts): string {
  const seo = firstNonEmpty(parts.seoTitle);
  if (seo) return seo;

  const rawSite = firstNonEmpty(parts.siteName);
  const headline = firstNonEmpty(parts.heroHeadline);
  // A slug is a URL, not a name. Prefer real words the owner wrote.
  const site = rawSite && looksLikeSlug(rawSite) ? (headline ?? rawSite) : rawSite;
  const page = isGenericPageTitle(parts.pageTitle) ? null : firstNonEmpty(parts.pageTitle);
  const place = [firstNonEmpty(parts.city), firstNonEmpty(parts.region)].filter(Boolean).join(', ');

  // A subpage with a real name leads with it — that is what the visitor clicked.
  if (page && !parts.isHomePage) return site ? `${page} — ${site}` : page;
  if (page && parts.isHomePage && !site) return page;

  if (site) return place ? `${site} — ${place}` : site;
  // Last resort: the page's own name even if generic, then nothing. Better a weak title than the
  // product's name on a business's page, which tells the visitor about US.
  return firstNonEmpty(parts.pageTitle) ?? 'QuickSites';
}
