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

import OpenAI from 'openai';
import { meterLLMCall } from '@/lib/ai/meter';
import { LABEL_TO_KEY, KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { ScrapedSite } from '@/lib/rebuild/scrapeSite';

const ROUTE = '/api/rebuild';

export type RebuildSpec = {
  businessName: string;
  industryKey: IndustryKey;
  industryLabel: string;
  headline: string;
  subheadline: string;
  about: string;
  services: string[];
  faqs: { q: string; a: string }[];
};

/** Infer a full QuickSites draft spec from scraped site signals (one metered call). */
export async function inferSiteSpec(scraped: ScrapedSite, userId: string | null): Promise<RebuildSpec> {
  const knownLabels = Object.values(KEY_TO_LABEL).join(', ');

  const sys =
    'You are rebuilding a small business website. From the scraped signals of their ' +
    'CURRENT site, infer the business and write fresh, concise, conversion-oriented ' +
    'copy for a new site. Return JSON ONLY with keys: ' +
    'business_name (string), industry (prefer one of the known labels when it fits, ' +
    'else a concise 1-3 word label), headline (<=8 words), subheadline (<=18 words), ' +
    'about (2-3 sentences), services (array of 5 short service names), ' +
    'faqs (array of 3 objects {q,a}). ' +
    `Known industry labels: ${knownLabels}.`;

  const user = [
    scraped.businessName ? `Current name/title: ${scraped.businessName}` : null,
    scraped.description ? `Meta description: ${scraped.description}` : null,
    scraped.headings.length ? `Headings: ${scraped.headings.join(' | ')}` : null,
    scraped.navLabels.length ? `Navigation: ${scraped.navLabels.join(', ')}` : null,
    scraped.bodyText ? `Page text (truncated): ${scraped.bodyText}` : null,
    `Source URL: ${scraped.sourceUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const fallbackName = scraped.businessName || hostFromUrl(scraped.sourceUrl) || 'Your Business';

  return meterLLMCall<RebuildSpec>(
    { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', user_id: userId, route: ROUTE },
    async () => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
      };

      return {
        value,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    },
  );
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
