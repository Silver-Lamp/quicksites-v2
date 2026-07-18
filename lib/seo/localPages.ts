// lib/seo/localPages.ts
//
// Deterministic builders for the local-SEO landing surfaces a geo pitch site wants:
// a dedicated "<service> in <city>" subpage. It's a strong extra ranking surface for the
// exact query the domain targets, and — crucially — it links back to the site's own pages
// (home + contact), which is the safe, guideline-friendly internal-linking play (never a
// cross-domain link scheme). Pure so it's unit-tested and can run on the server at launch
// or on demand. Blocks use the same shapes buildIndustryStarter emits, so they render.

import { createDefaultBlock } from '@/lib/createDefaultBlock';

export type LocalPage = {
  id: string;
  slug: string;
  title: string;
  show_header: boolean;
  show_footer: boolean;
  content_blocks: any[];
  blocks: any[];
};

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uuid(): string {
  return (globalThis as any).crypto?.randomUUID?.() ?? `p_${Math.random().toString(36).slice(2)}`;
}

/** Canonical slug for a city/service page, e.g. "plumbing-in-renton". */
export function slugForCityService(serviceLabel: string, city: string): string {
  return `${slugify(serviceLabel)}-in-${slugify(city)}`;
}

/** True when a page with this slug already exists (avoid duplicates). */
export function hasPageSlug(data: any, slug: string): boolean {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  return pages.some((p: any) => String(p?.slug ?? '').toLowerCase() === slug.toLowerCase());
}

/**
 * Build a "<serviceLabel> in <city>" landing page. Hero + services + a body block whose
 * HTML links back to the home page and the contact section (own-site internal links), and
 * a closing CTA. `homeHref`/`contactHref` default to the site root + #contact.
 */
export function buildCityServicePage(opts: {
  businessName: string;
  serviceLabel: string;
  city: string;
  region?: string | null;
  services?: string[];
  homeHref?: string;
  contactHref?: string;
}): LocalPage {
  const { businessName, serviceLabel, city } = opts;
  const region = (opts.region ?? '').trim();
  const place = region ? `${city}, ${region}` : city;
  const homeHref = opts.homeHref ?? '/';
  const contactHref = opts.contactHref ?? '#contact';
  const services = (opts.services ?? []).filter(Boolean);

  const hero: any = createDefaultBlock('hero');
  hero.content = hero.content ?? {};
  hero.content.headline = `${serviceLabel} in ${city}`;
  hero.content.subheadline = `Looking for ${serviceLabel.toLowerCase()} in ${place}? ${businessName} is local, fast, and reliable — get a free quote today.`;
  hero.content.cta_text = 'Get a free quote';

  const svc: any = createDefaultBlock('services');
  svc.content = svc.content ?? {};
  if (services.length) {
    if (Array.isArray(svc.content.items)) svc.content.items = services.map((name) => ({ name }));
    else if (Array.isArray(svc.content.services))
      svc.content.services = services.map((name) => ({ name }));
    else svc.content.items = services.map((name) => ({ name }));
  }

  // Body copy with real internal links to the site's own pages (the SEO win).
  const body: any = createDefaultBlock('text');
  body.content = body.content ?? {};
  const svcList = services.length
    ? `<ul>${services.map((s) => `<li>${s}</li>`).join('')}</ul>`
    : '';
  body.content.value =
    `<h2>${serviceLabel} in ${city}</h2>` +
    `<p>${businessName} provides trusted ${serviceLabel.toLowerCase()} across ${place} and nearby areas. ` +
    `Whether it's an emergency or a planned job, our local team shows up on time and does it right.</p>` +
    svcList +
    `<p>See everything we do on our <a href="${homeHref}">home page</a>, or ` +
    `<a href="${contactHref}">contact us</a> for a fast, free quote in ${city}.</p>`;

  const cta: any = createDefaultBlock('cta');
  cta.content = { ...cta.content, label: `Get ${serviceLabel} in ${city}`, link: contactHref };

  const blocks = [hero, svc, body, cta];
  return {
    id: uuid(),
    slug: slugForCityService(serviceLabel, city),
    title: `${serviceLabel} in ${city}`,
    show_header: true,
    show_footer: true,
    content_blocks: blocks,
    blocks,
  };
}

/** Canonical slug for a real-estate area guide, e.g. "homes-for-sale-in-renton-highlands". */
export function slugForArea(area: string): string {
  return `homes-for-sale-in-${slugify(area)}`;
}

/**
 * Build a "Homes for sale in <area>" neighborhood/area-guide landing page for a real-estate
 * agent site — a hyperlocal ranking surface for the exact search buyers/sellers make, with
 * real internal links back to the agent's home + a home-valuation/contact CTA. Pure. Seeds a
 * `listings_grid` so the page shows inventory when the site has it. `region` is the state.
 */
export function buildAreaGuidePage(opts: {
  businessName: string;
  area: string;
  region?: string | null;
  /** A few talking points about the area (schools, commute, lifestyle) — optional. */
  highlights?: string[];
  homeHref?: string;
  contactHref?: string;
}): LocalPage {
  const { businessName, area } = opts;
  const region = (opts.region ?? '').trim();
  const place = region ? `${area}, ${region}` : area;
  const homeHref = opts.homeHref ?? '/';
  const contactHref = opts.contactHref ?? '#contact';
  const highlights = (opts.highlights ?? []).filter(Boolean);

  const hero: any = createDefaultBlock('hero');
  hero.content = hero.content ?? {};
  hero.content.headline = `Homes for sale in ${area}`;
  hero.content.subheadline = `Thinking of buying or selling in ${place}? ${businessName} knows this neighborhood — current listings, real pricing, and local guidance.`;
  hero.content.cta_text = "What's your home worth?";

  const listings: any = createDefaultBlock('listings_grid');

  const body: any = createDefaultBlock('text');
  body.content = body.content ?? {};
  const hiList = highlights.length
    ? `<ul>${highlights.map((h) => `<li>${h}</li>`).join('')}</ul>`
    : '';
  body.content.value =
    `<h2>Living in ${area}</h2>` +
    `<p>${businessName} helps buyers and sellers across ${place}. Whether you're searching for your next home ` +
    `or wondering what yours is worth in today's ${area} market, you'll get local, straight advice.</p>` +
    hiList +
    `<p>Browse the latest homes above, see how I work on my <a href="${homeHref}">home page</a>, or ` +
    `<a href="${contactHref}">get in touch</a> for a personalized look at ${area}.</p>`;

  const cta: any = createDefaultBlock('cta');
  cta.content = { ...cta.content, label: `Explore ${area} homes`, link: contactHref };

  const blocks = [hero, listings, body, cta];
  return {
    id: uuid(),
    slug: slugForArea(area),
    title: `Homes for sale in ${area}`,
    show_header: true,
    show_footer: true,
    content_blocks: blocks,
    blocks,
  };
}

export type InsertResult = { data: any; changed: boolean; slug: string };

/** Append a page to a template `data` blob (idempotent by slug). Pure — clones the input. */
export function insertPage(data: any, page: LocalPage): InsertResult {
  if (hasPageSlug(data, page.slug)) return { data, changed: false, slug: page.slug };
  const next =
    typeof structuredClone === 'function'
      ? structuredClone(data ?? {})
      : JSON.parse(JSON.stringify(data ?? {}));
  if (!Array.isArray(next.pages)) next.pages = [];
  next.pages.push(page);
  return { data: next, changed: true, slug: page.slug };
}
