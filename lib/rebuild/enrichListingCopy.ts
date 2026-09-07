// lib/rebuild/enrichListingCopy.ts
//
// The listing-import path (Google Places / Yelp → RebuildSpec via buildSpecFromListing)
// produces PURE TEMPLATED copy: the headline is just the business name and the
// subheadline/about are category slugs glued together ("Bar · Brunch Restaurant —
// order online or stop by."). That reads like a stub and does nothing for SEO.
//
// This module upgrades that copy in ONE metered gpt-4o-mini call — the same
// pattern lib/rebuild/inferSiteSpec.ts / lib/builder/generateDemoSite.ts use — writing
// clean, human headline/subheadline/about/faqs grounded in the REAL business name,
// city, and (for restaurants) the menu, plus a name+locale SEO title/description so
// the page ranks for "<name>" and "<cuisine> in <city>" instead of a generic scaffold
// title. It ALSO always computes a deterministic name-grounded SEO title/description
// (even with the LLM off / no key) so the auto-built site never ships the "Home"
// fallback title.
//
// Best-effort by contract: any failure (disabled, no key, budget cap, bad JSON) falls
// back to the templated copy + deterministic SEO — it never blocks draft assembly.

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { scrubText, scrubFaqs } from '@/lib/rebuild/scrubInventedClaims';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';
import {
  buildDeterministicSeo,
  cap,
  clean,
  stripPlaceholderLocale,
  type ListingCopyContext,
} from '@/lib/rebuild/listingSeo';

export { buildDeterministicSeo, type ListingCopyContext };

const ROUTE = '/api/import-listing';

/** Kill-switch: on by default, set LISTING_COPY_LLM_ENABLED=false to disable the LLM pass. */
function llmEnabled(): boolean {
  if (process.env.LISTING_COPY_LLM_ENABLED === 'false') return false;
  const hasKey =
    !!process.env.OPENAI_API_KEY ||
    (process.env.AI_GATEWAY_ENABLED === 'true' && !!process.env.AI_GATEWAY_API_KEY);
  return hasKey;
}

/**
 * Upgrade a templated listing spec's copy with an LLM (best-effort), and always stamp a
 * name-grounded SEO title/description. Returns a NEW spec; never throws.
 */
export async function enrichListingCopy(
  spec: RebuildSpec,
  ctx: ListingCopyContext = {},
): Promise<RebuildSpec> {
  // Deterministic SEO first — this is applied even when the LLM is off/unavailable.
  const seo = buildDeterministicSeo(spec, ctx);
  const withSeo: RebuildSpec = { ...spec, seoTitle: seo.seoTitle, seoDescription: seo.seoDescription };

  if (!llmEnabled()) return withSeo;

  try {
    return await runEnrich(withSeo, ctx);
  } catch (e: any) {
    console.warn('[listing-copy] LLM enrichment failed, keeping templated copy:', e?.message);
    return withSeo;
  }
}

async function runEnrich(spec: RebuildSpec, ctx: ListingCopyContext): Promise<RebuildSpec> {
  const city = clean(ctx.city ?? spec.contact?.city ?? '');
  const state = clean(ctx.state ?? spec.contact?.state ?? '');
  const place = [city, state].filter(Boolean).join(', ');
  const categories = (spec.services ?? []).map(clean).filter(Boolean).slice(0, 5);

  // A compact menu digest grounds the copy in real dishes/cuisine (restaurants only).
  const menuDigest =
    ctx.menu?.sections
      ?.slice(0, 6)
      .map((s) => {
        const items = (s.items ?? [])
          .map((it) => clean(it?.name ?? ''))
          .filter(Boolean)
          .slice(0, 6);
        return `${clean(s.name)}: ${items.join(', ')}`;
      })
      .filter(Boolean)
      .join('\n') ?? '';

  const sys =
    'You write clean, human, SEO-minded website copy for a REAL local business. The ' +
    'business name and city are real — use the business name naturally in the headline ' +
    'and SEO fields so it ranks for brand searches, and include the city/cuisine so it ' +
    'ranks for "<category> in <city>" searches. Only mention a city/state if one is ' +
    'provided below — NEVER invent, guess, or infer a location; if none is given, omit the ' +
    'location entirely (do not write "City", "ST", or a placeholder). ' +
    // ⚠️ The same NEVER-invent rule, applied to operational facts. We know this business's name,
    // address, phone and Google category and NOTHING else — not their hours, response time,
    // insurance, pricing or tenure. Asked for conversion copy from that, a model writes "we're
    // here for you 24/7" and "fully licensed and insured" about a real third party. The output is
    // scrubbed regardless (scrubInventedClaims); this is here so the model rarely has to be
    // corrected, NOT because an instruction is a guard.
    'NEVER state hours, availability ("24/7", "around the clock"), response or arrival times, ' +
    'licensing, insurance, bonding, guarantees, warranties, years in business, or prices ' +
    '(including "free estimate" or "free quote") — you do not know any of these, and they are ' +
    'claims about a real business. Where a customer would want one, invite the question instead: ' +
    '"Call and we\'ll tell you what we can do today." Never output ' +
    'underscores, snake_case, or raw category codes; write it the way a human would say it. ' +
    'Return JSON ONLY with keys: ' +
    'headline (<=8 words), subheadline (<=18 words), about (2-3 warm sentences), ' +
    'faqs (array of 3 {q,a}), seo_title (<=60 chars, e.g. "Joe\'s Diner — Brunch in Renton, WA"), ' +
    'seo_description (<=155 chars, includes the name + city + what they offer).';

  const user = [
    `Business name: ${spec.businessName}`,
    `Type: ${spec.industryLabel}`,
    categories.length ? `Categories: ${categories.join(', ')}` : null,
    place ? `Location: ${place}` : null,
    menuDigest ? `Menu (real dishes — use for keywords/flavor):\n${menuDigest}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const enriched = await meterLLMCall<Partial<RebuildSpec>>(
    {
      provider: 'openai',
      model_code: 'gpt-4o-mini',
      modality: 'chat',
      user_id: ctx.operatorId ?? null,
      route: ROUTE,
    },
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
        /* keep templated fallbacks below */
      }

      // ⚠️ Enforced on the OUTPUT, not merely asked for. A model that ignores the instruction —
      // or a future model, or an edited prompt — must still be unable to put "fully licensed and
      // insured" on a real business's page.
      const faqs = Array.isArray(parsed.faqs)
        ? scrubFaqs(parsed.faqs.map((f: any) => ({ q: cap(f?.q ?? '', 160), a: cap(f?.a ?? '', 400) })))
            .faqs.map((f) => ({ q: f.q ?? '', a: f.a ?? '' }))
            .filter((f) => f.q)
            .slice(0, 3)
        : [];

      // When we have NO real city/state, the model still tends to fill the "<category> in
      // <city>" shape with a placeholder ("Your City", "City, ST"). Deterministic SEO (which
      // omits the locale entirely) is authoritative in that case — never ship an invented
      // location. With a real place, trust the (grounded) LLM SEO.
      const hasPlace = !!place;
      const value: Partial<RebuildSpec> = {
        headline:
          scrubText(stripPlaceholderLocale(cap(parsed.headline || spec.headline, 80))).text || spec.headline,
        subheadline:
          scrubText(stripPlaceholderLocale(cap(parsed.subheadline || spec.subheadline, 160))).text ||
          spec.subheadline,
        about: scrubText(cap(parsed.about || spec.about, 600)).text || spec.about,
        ...(faqs.length ? { faqs } : {}),
        seoTitle: hasPlace ? cap(parsed.seo_title || spec.seoTitle || '', 70) || spec.seoTitle : spec.seoTitle,
        seoDescription: hasPlace
          ? cap(parsed.seo_description || spec.seoDescription || '', 160) || spec.seoDescription
          : spec.seoDescription,
      };
      return {
        value,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    },
  );

  return { ...spec, ...enriched };
}
