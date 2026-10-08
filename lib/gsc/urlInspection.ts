// lib/gsc/urlInspection.ts
//
// Server-side pieces of the nightly URL Inspection sweep: which URLs to ask Google about for a
// property, and the one API call. The decision of what an answer MEANS is lib/gsc/indexingTriage.ts.
import { google } from 'googleapis';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import { canonicalOriginFromMeta, sitePagePath } from '@/lib/seo/canonicalUrl';

export type InspectTarget = {
  property: string;
  templateId: string;
  slug: string;
  /** The host we want Google to index — the nominated canonical origin, else the custom domain. */
  origin: string;
  urls: string[];
};

type TemplateRow = { id: string; slug: string | null; data: unknown; custom_domain: string | null };

/** Page URLs of a published site on its canonical origin, from the template's pages. */
export function siteUrls(origin: string, data: unknown): string[] {
  const pages = ((data as { pages?: Array<{ slug?: string | null }> } | null)?.pages ?? []).filter(Boolean);
  const base = origin.replace(/\/+$/, '');
  const paths = new Set<string>(['/']);
  pages.forEach((p, i) => paths.add(sitePagePath(p?.slug, { isFirstPage: i === 0 })));
  return [...paths].map((p) => (p === '/' ? `${base}/` : `${base}${p}`));
}

/**
 * Match connected properties to the sites they cover. A property `sc-domain:foo.com` covers the
 * template whose campaign domain or custom_domain normalises to `foo.com`. The origin we inspect
 * is the one we nominate as canonical (meta.canonical_origin) — never the platform copy.
 */
export function targetsFor(
  properties: string[],
  templates: TemplateRow[],
  campaignDomainByTemplate: Map<string, string>,
): InspectTarget[] {
  const byDomain = new Map<string, string>();
  for (const p of properties) {
    const key = normalizeGscDomain(p);
    if (key && (!byDomain.has(key) || p.startsWith('sc-domain:'))) byDomain.set(key, p);
  }
  const out: InspectTarget[] = [];
  for (const t of templates) {
    const domain = campaignDomainByTemplate.get(t.id) ?? t.custom_domain ?? null;
    if (!domain || !t.slug) continue;
    const property = byDomain.get(normalizeGscDomain(domain));
    if (!property) continue;
    const meta = (t.data as { meta?: unknown } | null)?.meta;
    const origin = canonicalOriginFromMeta(meta) ?? `https://${domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
    out.push({ property, templateId: t.id, slug: t.slug, origin, urls: siteUrls(origin, t.data) });
  }
  return out;
}

/**
 * The sites that live ONLY on the platform (no custom domain, no campaign), inspected under the
 * platform's own property at `<platformOrigin>/sites/<slug>`.
 *
 * ⚠️ Added 2026-10-08 because the first "Merchant listings" email named
 * `https://www.quicksites.ai/sites/starter-auto-dealer` — a published starter with no domain,
 * which `targetsFor` could never reach: it matches properties to CUSTOM domains, so the one
 * property with the most pages on it was the one the sweep never asked about. ~100 published
 * platform-only sites, ~110 pages; well inside the quota.
 *
 * ⚠️ The home URL has NO trailing slash. Next redirects `/sites/x/` → `/sites/x` (308) and the
 * page self-canonicalises without the slash; inspecting the slashed form would file every
 * platform site as "Page with redirect".
 */
export function platformTargetsFor(
  properties: string[],
  templates: Array<TemplateRow & { published?: boolean | null; archived?: boolean | null }>,
  campaignTemplateIds: Set<string>,
  platformOrigin: string,
): InspectTarget[] {
  const origin = platformOrigin.replace(/\/+$/, '');
  const key = normalizeGscDomain(origin);
  const property = properties.find((p) => normalizeGscDomain(p) === key) ?? null;
  if (!property) return [];
  const out: InspectTarget[] = [];
  for (const t of templates) {
    if (!t.slug || !t.published || t.archived) continue;
    if ((t.custom_domain ?? '').trim()) continue;
    if (campaignTemplateIds.has(t.id)) continue;
    const siteOrigin = `${origin}/sites/${encodeURIComponent(t.slug)}`;
    const urls = siteUrls(siteOrigin, t.data).map((u, i) => (i === 0 ? u.replace(/\/+$/, '') : u));
    out.push({ property, templateId: t.id, slug: t.slug, origin: siteOrigin, urls });
  }
  return out;
}

/** One URL Inspection call. Throws on API failure; the cron records the failure per URL. */
export async function inspectUrl(property: string, url: string): Promise<unknown> {
  const auth = await getValidOAuthClient(property);
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: property, languageCode: 'en-US' },
  });
  return res.data;
}
