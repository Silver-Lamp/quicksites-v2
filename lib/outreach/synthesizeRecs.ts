// lib/outreach/synthesizeRecs.ts
//
// Phase 3: an LLM pass that turns the deterministic recommendations into a friendly,
// prioritized "top 3 this week" plan. GROUNDED — the model may only select/merge/rephrase
// the rules it's given, never invent advice. Metered via lib/ai/meter (never raw OpenAI),
// flag-gated (GEO_RECS_LLM_ENABLED + OPENAI_API_KEY), and best-effort: any failure returns
// null so the UI falls back to the deterministic list (still the source of truth).

import OpenAI from 'openai';
import { meterLLMCall } from '@/lib/ai/meter';
import { parseTopThree, geoRecsLlmEnabled, type RecStep, type RecSummary } from '@/lib/outreach/recSummary';
import type { Recommendation } from '@/lib/outreach/recommendations';
import type { NextAction } from '@/lib/outreach/nextAction';

export type { RecStep, RecSummary } from '@/lib/outreach/recSummary';
export { parseTopThree, geoRecsLlmEnabled } from '@/lib/outreach/recSummary';

const MODEL = 'gpt-4o-mini';
const ROUTE = '/api/cron/geo-rank-sync';

export async function synthesizeTopThree(input: {
  domain: string;
  city: string;
  industryLabel: string;
  ranking: Recommendation[];
  nextAction: NextAction | null;
}): Promise<RecSummary | null> {
  if (!geoRecsLlmEnabled()) return null;
  if (!input.ranking.length && !input.nextAction) return null;

  const sys =
    'You are a local-SEO and sales-ops assistant for a company that ranks and rents local service websites. ' +
    'You are given ALREADY-COMPUTED, factual recommendations for one campaign. ' +
    'Pick the 3 highest-impact next steps and rewrite them as short, plain-language actions an operator can do this week. ' +
    'STRICT RULES: use ONLY the provided recommendations — never invent new advice, numbers, tactics, or facts; merge duplicates; order by impact. ' +
    'Output strict JSON {"steps":[{"title":"…","why":"…"}]} with at most 3 steps. Keep each title under ~8 words and each why under ~20 words.';

  const user = JSON.stringify({
    domain: input.domain,
    city: input.city,
    industry: input.industryLabel,
    outreachNextAction: input.nextAction ? { action: input.nextAction.action, reason: input.nextAction.reason } : null,
    rankingRecommendations: input.ranking.map((r) => ({ category: r.category, priority: r.priority, title: r.title, detail: r.detail })),
  });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const steps = await meterLLMCall<RecStep[] | null>(
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
          value: parseTopThree(r.choices[0]?.message?.content ?? null),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
    return steps && steps.length ? { steps, model: MODEL } : null;
  } catch {
    return null;
  }
}
