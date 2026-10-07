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

/** One URL Inspection call. Throws on API failure; the cron records the failure per URL. */
export async function inspectUrl(property: string, url: string): Promise<unknown> {
  const auth = await getValidOAuthClient(property);
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: property, languageCode: 'en-US' },
  });
  return res.data;
}
