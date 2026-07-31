// lib/rebuild/importProfile.ts
//
// Build an "About Me" personal site from a public profile URL (LinkedIn /in/,
// about.me, or a personal homepage). Same build-from-a-public-source pattern as the
// listing/Shopify importers, but for a PERSON — and deterministic: the bio is the
// person's own words, so there's NO AI call (unlike the business rebuild's
// inferSiteSpec). Reuses scrapeSite's SSRF-guarded fetch + HTML parse.
//
// Reality check on sources: about.me + personal homepages expose real OpenGraph/
// JSON-LD Person data. LinkedIn public pages are heavily login-walled, so we get
// whatever the public preview yields (usually og:title/description/image) and degrade
// gracefully — a partial draft the person finishes in the editor beats a blank one.

import { scrapeSite, type ScrapedSite } from './scrapeSite';
import type { RebuildSpec } from './inferSiteSpec';

export type ProfileLink = { label: string; href: string };
export type ProfileSpec = {
  name: string | null;
  headline: string | null; // job title / tagline
  bio: string | null; // the "about" text
  photoUrl: string | null;
  location: string | null;
  links: ProfileLink[]; // social/contact links
  /**
   * Résumé-shaped extras (importResume). Optional so the URL path is unchanged — a scraped
   * profile has no structured skills or job history, and inventing them would be exactly the
   * thing the deterministic spirit of this module exists to avoid.
   */
  skills?: string[];
  experience?: { heading: string; body: string }[];
  email?: string | null;
};

const SOCIAL_HOSTS = [
  'linkedin.com', 'github.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
  'youtube.com', 'tiktok.com', 'medium.com', 'substack.com', 'dribbble.com', 'behance.net',
  'about.me', 'threads.net', 'bsky.app', 'mastodon.social',
];

const clean = (s: unknown): string | null => {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t || null;
};

function hostLabel(href: string): string {
  try {
    const h = new URL(href).hostname.replace(/^www\./, '');
    const base = h.split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Link';
  }
}

function dedupeLinks(links: ProfileLink[]): ProfileLink[] {
  const seen = new Set<string>();
  const out: ProfileLink[] = [];
  for (const l of links) {
    if (!clean(l.href)) continue;
    const key = l.href.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: clean(l.label) || hostLabel(l.href), href: l.href });
    if (out.length >= 8) break;
  }
  return out;
}

/** Find the first schema.org Person node anywhere in the parsed JSON-LD (incl. @graph). */
function firstPerson(structuredData: any[]): any | null {
  const flat: any[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === 'object') {
      flat.push(n);
      if (n['@graph']) walk(n['@graph']);
    }
  };
  (structuredData || []).forEach(walk);
  return (
    flat.find((n) => {
      const t = n?.['@type'];
      return t === 'Person' || (Array.isArray(t) && t.includes('Person'));
    }) ?? null
  );
}

/** Pure map: scraped page → profile fields. Deterministic + unit-testable. */
export function profileFromScrape(scraped: ScrapedSite): ProfileSpec {
  const person = firstPerson(scraped.structuredData || []);

  const name =
    clean(person?.name) ||
    clean(scraped.businessName) ||
    clean(scraped.title?.split(/[|\-–—]/)[0]) ||
    clean(scraped.headings?.[0]) ||
    null;

  const personDesc = clean(person?.description);
  const headline =
    clean(person?.jobTitle) ||
    (personDesc && personDesc.length <= 120 ? personDesc : null) ||
    (name && scraped.title && clean(scraped.title) !== name
      ? clean(scraped.title!.replace(name, '').replace(/^[\s|\-–—]+/, ''))
      : null);

  const bio = personDesc || clean(scraped.description) || clean(scraped.bodyText?.slice(0, 800));

  const photoUrl =
    clean(typeof person?.image === 'string' ? person.image : person?.image?.url) ||
    scraped.heroImage ||
    null;

  const location =
    clean(person?.address?.addressLocality) ||
    clean(typeof person?.homeLocation === 'string' ? person.homeLocation : person?.homeLocation?.name) ||
    null;

  const rawLinks: ProfileLink[] = [];
  const sameAs = person?.sameAs;
  if (Array.isArray(sameAs)) sameAs.forEach((h) => typeof h === 'string' && rawLinks.push({ label: hostLabel(h), href: h }));
  else if (typeof sameAs === 'string') rawLinks.push({ label: hostLabel(sameAs), href: sameAs });
  for (const l of scraped.links || []) {
    if (typeof l?.href !== 'string') continue;
    if (SOCIAL_HOSTS.some((h) => l.href.includes(h))) rawLinks.push({ label: l.label, href: l.href });
  }

  return { name, headline, bio, photoUrl, location, links: dedupeLinks(rawLinks) };
}

/** URL hint: does this look like a personal profile page (not a business site)? */
export function looksLikeProfileUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'about.me') return true;
    if ((host === 'linkedin.com' || host.endsWith('.linkedin.com')) && /^\/in\//i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Deterministic profile → personal RebuildSpec. No AI: the bio is the person's own
 * words, so we carry it verbatim (and stash it in `original` so the editor can revert).
 * Flows through the existing buildRebuildTemplate → the `personal` audio-forward scaffold.
 */
export function rebuildSpecFromProfile(profile: ProfileSpec): RebuildSpec {
  const name = profile.name || 'About Me';
  return {
    businessName: name,
    industryKey: 'personal',
    industryLabel: 'Personal / About Me',
    headline: name,
    subheadline: profile.headline || 'Here’s a little about me.',
    about: profile.bio || 'Share who you are, what you’re working on, and what you care about.',
    // Skills become the services list and roles become story panels — both already render in
    // the `personal` scaffold, so a résumé needs no new block types. Empty when absent (the
    // URL path), which leaves that path byte-identical to before.
    services: profile.skills ?? [],
    faqs: [],
    ...(profile.experience?.length ? { story: profile.experience } : {}),
    ...(profile.email || profile.location
      ? { contact: { ...(profile.email ? { email: profile.email } : {}), ...(profile.location ? { address: profile.location } : {}) } as any }
      : {}),
    original: {
      headline: name,
      ...(profile.headline ? { subheadline: profile.headline } : {}),
      ...(profile.bio ? { about: profile.bio } : {}),
    },
  };
}

/** Scrape a profile URL end-to-end (SSRF-guarded via scrapeSite). `fetchImpl` injectable for tests. */
export async function scrapeProfile(url: string, fetchImpl: typeof fetch = fetch): Promise<ProfileSpec> {
  const scraped = await scrapeSite(url, fetchImpl);
  return profileFromScrape(scraped);
}
