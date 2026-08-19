// lib/sites/publicUrl.ts
//
// Where a published template actually lives on the web.
//
// ⚠️ ORDER MATTERS AND IS NOT COSMETIC. A site with a custom domain is reachable at BOTH its
// custom domain and its platform subdomain, but only one of them is the address its owner gives
// people. Showing the subdomain to someone who bought a domain reads as "the thing I paid for
// isn't wired up", and any link we generate from it teaches the wrong URL to whoever we send it to.

export type SiteAddress = {
  custom_domain?: string | null;
  default_subdomain?: string | null;
  slug?: string | null;
};

const PLATFORM_BASE = 'quicksites.ai';

/** The host a visitor should be given, or null if the site has no address at all. */
export function publicSiteHost(site: SiteAddress): string | null {
  const custom = (site.custom_domain ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (custom) return custom;
  const sub = (site.default_subdomain ?? '').trim();
  if (sub) return sub.includes('.') ? sub : `${sub}.${PLATFORM_BASE}`;
  const slug = (site.slug ?? '').trim();
  return slug ? `${slug}.${PLATFORM_BASE}` : null;
}

export function publicSiteUrl(site: SiteAddress): string | null {
  const host = publicSiteHost(site);
  return host ? `https://${host}` : null;
}

/**
 * The public résumé download for a site.
 *
 * ⚠️ Built from the SLUG, not the host, because the route resolves a template by slug
 * (`/api/resume/<slug>/<format>`) — and on a custom domain the middleware still rewrites to
 * `/sites/<slug>`, so the same relative path resolves on either address. Passing a host here
 * would produce a URL that works only on one of them.
 */
export function resumeDownloadPath(site: SiteAddress, format: string): string | null {
  const slug = (site.slug ?? '').trim();
  return slug ? `/api/resume/${slug}/${format}` : null;
}
