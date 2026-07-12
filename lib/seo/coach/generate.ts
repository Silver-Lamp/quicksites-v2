// lib/seo/coach/generate.ts
//
// Grounded LLM polish for coaching content. The model may ONLY select/merge/rephrase the
// deterministic recommendations it's given — never invent advice, numbers, or tactics.
// Metered via lib/ai/meter (never raw OpenAI), gated by AI_SEO_COACH_LLM_ENABLED, and
// best-effort: any failure returns null so the caller falls back to deterministic text.
// Attributes cost to the site owner (user_id) for per-user budgeting. See docs/AI_SEO_COACHING.md.

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { aiSeoCoachLlmEnabled, parseDailyStep, parseWeeklySteps } from '@/lib/seo/coach/flags';
import type { RecStep, SeoRec } from '@/lib/seo/coach/types';

const MODEL = 'gpt-4o-mini';

const groundedSystem = (mode: 'daily' | 'weekly') =>
  'You are a friendly local-SEO coach for small-business website owners. ' +
  'You are given ALREADY-COMPUTED, factual recommendations for one site. ' +
  (mode === 'daily'
    ? 'Pick the SINGLE highest-impact next step and rewrite it as one encouraging, plain-language action the owner can do today. '
    : 'Pick the 3 highest-impact next steps and rewrite them as short, encouraging, plain-language actions for this week. ') +
  'STRICT RULES: use ONLY the provided recommendations — never invent new advice, numbers, tactics, or facts; merge duplicates; order by impact. ' +
  (mode === 'daily'
    ? 'Output strict JSON {"step":{"title":"…","why":"…"}}. Keep the title under ~8 words and the why under ~24 words.'
    : 'Output strict JSON {"steps":[{"title":"…","why":"…"}]} with at most 3 steps. Keep each title under ~8 words and each why under ~20 words.');

type Meta = { ownerId: string; templateId: string; domain: string | null; siteName: string };

function payload(meta: Meta, recs: SeoRec[], extra?: Record<string, unknown>): string {
  return JSON.stringify({
    site: meta.siteName,
    domain: meta.domain,
    ...extra,
    recommendations: recs.map((r) => ({ category: r.category, priority: r.priority, title: r.title, detail: r.detail })),
  });
}

/** One friendly next step for the daily email, or null (→ deterministic fallback). */
export async function generateDailyNextStep(meta: Meta, recs: SeoRec[]): Promise<RecStep | null> {
  if (!aiSeoCoachLlmEnabled() || !recs.length) return null;
  try {
    const openai = getOpenAI('chat');
    return await meterLLMCall<RecStep | null>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: meta.ownerId, template_id: meta.templateId, route: '/api/cron/seo-coach-daily' },
      async () => {
        const r = await openai.chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: groundedSystem('daily') },
            { role: 'user', content: payload(meta, recs.slice(0, 5)) },
          ],
        });
        return {
          value: parseDailyStep(r.choices[0]?.message?.content ?? null),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
  } catch {
    return null; // includes LLMBudgetExceededError — caller falls back to deterministic text
  }
}

/** Up to 3 friendly steps for the weekly email, or null (→ deterministic fallback). */
export async function generateWeeklyTopThree(
  meta: Meta,
  recs: SeoRec[],
  ctx: { score: number; scoreDelta: number | null },
): Promise<RecStep[] | null> {
  if (!aiSeoCoachLlmEnabled() || !recs.length) return null;
  try {
    const openai = getOpenAI('chat');
    return await meterLLMCall<RecStep[] | null>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: meta.ownerId, template_id: meta.templateId, route: '/api/cron/seo-coach-weekly' },
      async () => {
        const r = await openai.chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: groundedSystem('weekly') },
            { role: 'user', content: payload(meta, recs, { seoScore: ctx.score, scoreChange: ctx.scoreDelta }) },
          ],
        });
        return {
          value: parseWeeklySteps(r.choices[0]?.message?.content ?? null),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
  } catch {
    return null;
  }
}
