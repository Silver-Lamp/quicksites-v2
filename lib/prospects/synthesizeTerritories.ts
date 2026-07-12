// lib/prospects/synthesizeTerritories.ts
//
// LLM narration for the territory scorer: turns the top few deterministically-scored
// cells into a short "target these next, because…" brief. GROUNDED — the model may only
// rephrase the facts it's handed (rent, competition cards, no-website counts), never
// invent areas or numbers. Metered via lib/ai/meter (never raw OpenAI), reuses the same
// GEO_RECS_LLM_ENABLED flag as the campaign rec synthesis, and best-effort: any failure
// returns null so the UI just shows the deterministic scores (the source of truth).

import OpenAI from 'openai';
import { meterLLMCall } from '@/lib/ai/meter';
import { geoRecsLlmEnabled } from '@/lib/outreach/recSummary';
import type { TerritoryScore } from '@/lib/prospects/territoryScore';

export type TerritoryBrief = { label: string; why: string };

const MODEL = 'gpt-4o-mini';
const ROUTE = '/api/admin/prospects/territory-score';

/** Validate the model's JSON into clean {label, why} briefs, or null. Pure. */
export function parseBriefs(raw: string | null | undefined): TerritoryBrief[] | null {
  if (!raw) return null;
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  const arr = Array.isArray(j?.areas) ? j.areas : Array.isArray(j) ? j : null;
  if (!arr) return null;
  const clean = arr
    .map((a: any) => ({ label: String(a?.label ?? '').trim(), why: String(a?.why ?? a?.reason ?? '').trim() }))
    .filter((a: TerritoryBrief) => a.label.length > 0 && a.why.length > 0)
    .slice(0, 5);
  return clean.length ? clean : null;
}

/** Compact, model-facing fact bag for one cell — only what it's allowed to reason over. */
function factsFor(t: TerritoryScore) {
  return {
    label: t.label,
    score: t.score,
    estMonthlyRentUsd: Math.round(t.estMonthlyRentCents / 100),
    competitionCards: t.viableCards,
    noWebsite: t.rationale.noWebsite,
    dated: t.rationale.dated,
    totalBusinesses: t.count,
    saturationPct: Math.round(t.saturation * 100),
    viableIndustries: t.clusters
      .filter((c) => c.landGrabViable)
      .map((c) => ({ industry: c.industry, noWebsite: c.noWebsite, rentUsd: Math.round(c.rentValueCents / 100) })),
  };
}

/**
 * Narrate the top scored cells. Pass the already-ranked territories (top ~8); the model
 * selects and explains the best 3. Returns null when the flag is off or on any failure.
 */
export async function synthesizeTerritoryBrief(territories: TerritoryScore[]): Promise<TerritoryBrief[] | null> {
  if (!geoRecsLlmEnabled()) return null;
  const candidates = territories.filter((t) => t.viableCards > 0).slice(0, 8);
  if (!candidates.length) return null;

  const sys =
    'You are a local-market sales-ops assistant for a company that builds ordering/service websites for ' +
    'businesses with no website, then rents ranked exact-match geo-domains. You are given ALREADY-SCORED ' +
    'map areas with factual signals. Pick the 3 best areas to work next and explain each in one plain sentence. ' +
    'STRICT RULES: use ONLY the provided facts — never invent areas, numbers, industries, or tactics; ' +
    'prefer higher unlockable rent and more competition cards; note saturation as a caveat when high. ' +
    'Output strict JSON {"areas":[{"label":"…","why":"…"}]} with at most 3 areas. Reuse each area\'s exact label. ' +
    'Keep each why under ~24 words.';

  const user = JSON.stringify({ areas: candidates.map(factsFor) });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const briefs = await meterLLMCall<TerritoryBrief[] | null>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: null, route: ROUTE },
      async () => {
        const r = await openai.chat.completions.create({
          model: MODEL,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        });
        return {
          value: parseBriefs(r.choices[0]?.message?.content ?? null),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
    return briefs && briefs.length ? briefs : null;
  } catch {
    return null;
  }
}
