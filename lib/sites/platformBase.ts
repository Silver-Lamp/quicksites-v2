// lib/sites/platformBase.ts
//
// A site served at the platform path `/sites/<slug>` has no origin of its own, so a root-relative
// link in its nav (`/`, `/#contact`, `/menu`) leaves the site for the QuickSites homepage. On a
// subdomain or a custom domain the same links are right. The UX scan of /sites/bhard (2026-10-16)
// hit it on the first click: header "Home" → quicksites.ai.
//
// Pure: given the current pathname and a stored href, return the href a visitor should follow.
// Nothing is rewritten when there is no platform base (custom domain, subdomain, the editor).

/** `/sites/<slug>/anything` → `/sites/<slug>`; anything else → ''. */
export function platformBaseFromPathname(pathname: string | null | undefined): string {
  const m = /^\/sites\/([^/?#]+)/.exec(String(pathname ?? ''));
  return m ? `/sites/${m[1]}` : '';
}

/** Root-relative hrefs get the base in front; hashes, mailto/tel, absolute URLs and `//` hosts are untouched. */
export function rebaseSiteHref(href: string | null | undefined, base: string): string {
  const h = String(href ?? '').trim();
  if (!base || !h) return h;
  if (!h.startsWith('/') || h.startsWith('//')) return h;
  if (h === '/') return base;
  if (h.startsWith('/#')) return `${base}${h.slice(1)}`;
  if (h.startsWith(base + '/') || h === base) return h;
  return `${base}${h}`;
}
