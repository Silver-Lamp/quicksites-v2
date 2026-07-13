// lib/rebuild/inferSiteSpec.ts
//
// The AI half of "AI rebuild": take the raw signals scraped from a prospect's
// existing site (lib/rebuild/scrapeSite.ts) and, in ONE metered chat call, produce
// the structured spec we need to assemble a QuickSites draft — the business name,
// best-fit industry, and fresh conversion-oriented copy (headline / subheadline /
// about / services / faqs) grounded in their real content.
//
// This intentionally does the job that inferIndustry + ideateCopy did separately in
// the demo generator, but grounded in scraped text instead of a random seed. All
// OpenAI access goes through meterLLMCall so cost is budgeted + logged.

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { LABEL_TO_KEY, KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { ScrapedSite, MenuPage } from '@/lib/rebuild/scrapeSite';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

const ROUTE = '/api/rebuild';

export type MenuItemSpec = { name: string; description?: string; price?: string };
export type MenuSectionSpec = { name: string; items: MenuItemSpec[] };
export type ContactSpec = { phone?: string; address?: string; email?: string };
export type HoursDaySpec = { day: string; open?: string; close?: string; closed?: boolean };

export type RebuildSpec = {
  businessName: string;
  industryKey: IndustryKey;
  industryLabel: string;
  headline: string;
  subheadline: string;
  about: string;
  services: string[];
  faqs: { q: string; a: string }[];
  menu?: { sections: MenuSectionSpec[] };
  contact?: ContactSpec;
  hours?: HoursDaySpec[];
  // Brand storytelling — 2-4 image+text panels ("Created by…", "How it works").
  story?: { heading: string; body: string }[];
  // The VERBATIM existing copy from the source site (not rewritten), so the user can
  // revert per block to their original wording. Each field omitted if not found.
  original?: {
    headline?: string;
    subheadline?: string;
    about?: string;
    services?: string[];
    faqs?: { q: string; a: string }[];
  };
  // Real e-commerce products, imported deterministically (e.g. Shopify /products.json)
  // — NOT AI-generated. When present, assembleDraft builds a real storefront (products
  // become catalog_items wired into cart/checkout) instead of a services brochure.
  products?: ProductSpec[];
};

/** Infer a full QuickSites draft spec from scraped site signals (one metered call).
 *  `menuPages` (from scrapeMenuPages) lets the model reconstruct a real restaurant
 *  menu; it's ignored for non-food businesses. */
export async function inferSiteSpec(
  scraped: ScrapedSite,
  userId: string | null,
  menuPages: MenuPage[] = [],
): Promise<RebuildSpec> {
  const knownLabels = Object.values(KEY_TO_LABEL).join(', ');
  const hasMenuPages = menuPages.length > 0;

  const sys =
    'You are rebuilding a small business website. From the scraped signals of their ' +
    'CURRENT site, infer the business and write fresh, concise, conversion-oriented ' +
    'copy for a new site. Return JSON ONLY with keys: ' +
    'business_name (string), industry (prefer one of the known labels when it fits, ' +
    'else a concise 1-3 word label), headline (<=8 words), subheadline (<=18 words), ' +
    'about (2-3 sentences), services (array of 5 short service names), ' +
    'faqs (array of 3 objects {q,a}). ' +
    'If this is a restaurant/cafe/bar/bakery or any food business AND menu content is ' +
    'provided below, ALSO return menu: an object with sections (array of ' +
    '{name, items:[{name, description, price}]}). Use the real dish names and prices ' +
    'from the MENU PAGES; keep price as a short display string (e.g. "$14"); group into ' +
    'sensible sections (Breakfast, Lunch, Dinner, Drinks, …). Omit menu entirely if this ' +
    'is not a food business or no menu items are present. ' +
    'Also return original: an object with the VERBATIM existing copy from the source ' +
    'site (do NOT rewrite it) for the same keys where the site has them — headline, ' +
    'subheadline, about, services (array of names), faqs (array of {q,a}). Use the real ' +
    'headline/tagline/about/services/FAQ text found on their CURRENT site so the user ' +
    'can revert to their original wording; omit any key the site does not have. ' +
    'Also return story: an array of 2-4 objects {heading (<=6 words), body (2-3 ' +
    'sentences)} capturing the brand story / key selling points / how-it-works, ' +
    'grounded in the real page content (e.g. who made it, what makes it special, how ' +
    'it works). Omit story if the page has nothing substantive to say. ' +
    'Also return contact: an object {phone, address, email} using the REAL values found ' +
    'on the site (omit any field you cannot find). If business hours are stated, return ' +
    'hours: an array with one entry per day {day: one of mon,tue,wed,thu,fri,sat,sun, ' +
    "open: 'HH:MM' 24-hour, close: 'HH:MM'}, or {day, closed:true} for closed days; omit " +
    'hours if not stated. ' +
    `Known industry labels: ${knownLabels}.`;

  const menuBlock = hasMenuPages
    ? '\n\nMENU PAGES (extract the menu from these):\n' +
      menuPages.map((p) => `## ${p.label}\n${p.text.slice(0, 2500)}`).join('\n\n')
    : '';

  const user = [
    scraped.businessName ? `Current name/title: ${scraped.businessName}` : null,
    scraped.description ? `Meta description: ${scraped.description}` : null,
    scraped.headings.length ? `Headings: ${scraped.headings.join(' | ')}` : null,
    scraped.navLabels.length ? `Navigation: ${scraped.navLabels.join(', ')}` : null,
    scraped.bodyText ? `Page text (truncated): ${scraped.bodyText}` : null,
    `Source URL: ${scraped.sourceUrl}`,
  ]
    .filter(Boolean)
    .join('\n') + menuBlock;

  const fallbackName = scraped.businessName || hostFromUrl(scraped.sourceUrl) || 'Your Business';

  return meterLLMCall<RebuildSpec>(
    { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', user_id: userId, route: ROUTE },
    async () => {
      const openai = getOpenAI('chat');
      const r = await openai.chat.completions.create({
        model: resolveModel('gpt-4o-mini', 'chat'),
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        /* fall through to defaults */
      }

      const businessName = String(parsed.business_name || fallbackName).slice(0, 80);
      const { key, label } = resolveIndustry(parsed.industry);

      const value: RebuildSpec = {
        businessName,
        industryKey: key,
        industryLabel: label,
        headline: String(parsed.headline || businessName).slice(0, 80),
        subheadline: String(parsed.subheadline || scraped.description || `Trusted ${label.toLowerCase()}.`).slice(0, 160),
        about: String(parsed.about || '').slice(0, 600),
        services: Array.isArray(parsed.services) ? parsed.services.map(String).map((s: string) => s.slice(0, 60)).slice(0, 6) : [],
        faqs: Array.isArray(parsed.faqs)
          ? parsed.faqs
              .map((f: any) => ({ q: String(f?.q ?? '').slice(0, 160), a: String(f?.a ?? '').slice(0, 400) }))
              .filter((f: { q: string }) => f.q)
              .slice(0, 3)
          : [],
        menu: parseMenu(parsed.menu),
        contact: parseContact(parsed.contact),
        hours: parseHours(parsed.hours),
        story: parseStory(parsed.story),
        original: parseOriginal(parsed.original),
      };

      return {
        value,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    },
  );
}

/** Coerce the model's `menu` into a clean {sections:[{name,items:[…]}]} or undefined.
 *  Drops empty sections/items so a half-hallucinated menu never reaches the block. */
export function parseMenu(raw: any): { sections: MenuSectionSpec[] } | undefined {
  const rawSections = Array.isArray(raw?.sections) ? raw.sections : Array.isArray(raw) ? raw : [];
  const sections: MenuSectionSpec[] = [];
  for (const s of rawSections.slice(0, 12)) {
    const name = String(s?.name ?? '').trim().slice(0, 60);
    const rawItems = Array.isArray(s?.items) ? s.items : [];
    const items: MenuItemSpec[] = [];
    for (const it of rawItems.slice(0, 40)) {
      const itemName = String(it?.name ?? '').trim().slice(0, 120);
      if (!itemName) continue;
      const description = String(it?.description ?? '').trim().slice(0, 300);
      const price = String(it?.price ?? '').trim().slice(0, 24);
      items.push({ name: itemName, ...(description ? { description } : {}), ...(price ? { price } : {}) });
    }
    if (name && items.length) sections.push({ name, items });
  }
  return sections.length ? { sections } : undefined;
}

/** Coerce the model's verbatim `original` copy into a clean snapshot, or undefined. */
export function parseOriginal(raw: any): RebuildSpec['original'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: NonNullable<RebuildSpec['original']> = {};
  const headline = String(raw.headline ?? '').trim().slice(0, 200);
  const subheadline = String(raw.subheadline ?? '').trim().slice(0, 300);
  const about = String(raw.about ?? '').trim().slice(0, 1000);
  if (headline) out.headline = headline;
  if (subheadline) out.subheadline = subheadline;
  if (about) out.about = about;
  if (Array.isArray(raw.services)) {
    const services = raw.services.map((s: any) => String(s ?? '').trim().slice(0, 80)).filter(Boolean).slice(0, 12);
    if (services.length) out.services = services;
  }
  if (Array.isArray(raw.faqs)) {
    const faqs = raw.faqs
      .map((f: any) => ({ q: String(f?.q ?? '').trim().slice(0, 200), a: String(f?.a ?? '').trim().slice(0, 600) }))
      .filter((f: { q: string }) => f.q)
      .slice(0, 8);
    if (faqs.length) out.faqs = faqs;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Coerce the model's `story` into 2-4 clean {heading, body} panels, or undefined. */
export function parseStory(raw: any): { heading: string; body: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { heading: string; body: string }[] = [];
  for (const s of raw.slice(0, 4)) {
    const heading = String(s?.heading ?? '').trim().slice(0, 80);
    const body = String(s?.body ?? '').trim().slice(0, 500);
    if (heading || body) out.push({ heading: heading || 'Our Story', body });
  }
  return out.length ? out : undefined;
}

/** Pick the string contact fields the model found; undefined if none. */
export function parseContact(raw: any): ContactSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const phone = String(raw.phone ?? '').trim().slice(0, 40);
  const address = String(raw.address ?? '').trim().slice(0, 200);
  const email = String(raw.email ?? '').trim().slice(0, 120);
  const out: ContactSpec = {};
  if (phone) out.phone = phone;
  if (address) out.address = address;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) out.email = email;
  return Object.keys(out).length ? out : undefined;
}

const DAY_KEYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Normalize model hours into validated day entries; undefined if none usable. */
export function parseHours(raw: any): HoursDaySpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: HoursDaySpec[] = [];
  const seen = new Set<string>();
  for (const h of raw) {
    const day = String(h?.day ?? '').trim().toLowerCase().slice(0, 3);
    if (!DAY_KEYS.has(day) || seen.has(day)) continue;
    if (h?.closed === true) {
      seen.add(day);
      out.push({ day, closed: true });
      continue;
    }
    const open = String(h?.open ?? '').trim();
    const close = String(h?.close ?? '').trim();
    if (!HHMM.test(open) || !HHMM.test(close)) continue;
    seen.add(day);
    out.push({ day, open, close });
  }
  return out.length ? out : undefined;
}

/** Map a free-text industry label onto a known IndustryKey, defaulting to 'other'. */
export function resolveIndustry(raw: unknown): { key: IndustryKey; label: string } {
  const label = String(raw || '').trim();
  if (!label) return { key: 'other', label: 'Other' };
  const key = (LABEL_TO_KEY[label.toLowerCase()] ?? 'other') as IndustryKey;
  // Prefer the canonical label for a matched key; keep the model's phrasing for 'other'.
  const canonical = KEY_TO_LABEL[key];
  return { key, label: key === 'other' ? label.slice(0, 40) : canonical };
}

function hostFromUrl(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
