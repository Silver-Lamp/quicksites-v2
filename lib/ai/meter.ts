// lib/ai/meter.ts
//
// LLM metering = MEASURE + LIMIT.
//
// Logging already exists (`logActualCost` → ai_usage_events) but (a) it was wired
// into ~zero of the 21 OpenAI routes and (b) there was no enforcement. This module
// adds the enforcement layer (budget guard) and a one-call wrapper that combines:
//   pre-call budget check  →  run the LLM call  →  log cost  →  mirror to PostHog.
//
// Limits are env-driven (see .env.example LLM_*). When LLM_METERING_ENABLED is not
// 'true', the guard is a no-op (still logs), so you can roll out gradually.
//
// Rollout: replace a raw OpenAI call in an /api/.../route.ts with `meterLLMCall(...)`.
// See docs/LLM_METERING.md for the route-by-route checklist.
import { createClient } from '@supabase/supabase-js';
import { logActualCost } from '@/lib/ai/withCostLogging';
import { captureServer } from '@/lib/analytics/posthog-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

const ENABLED = process.env.LLM_METERING_ENABLED === 'true';
const DAILY_USD = Number(process.env.LLM_DAILY_USD_LIMIT ?? '0') || 0; // 0 = unlimited
const MONTHLY_USD = Number(process.env.LLM_MONTHLY_USD_LIMIT ?? '0') || 0;
const PER_USER_DAILY_CENTS = Number(process.env.LLM_PER_USER_DAILY_CENTS ?? '0') || 0;

export class LLMBudgetExceededError extends Error {
  constructor(public scope: 'global_daily' | 'global_monthly' | 'user_daily', public detail: string) {
    super(`LLM budget exceeded (${scope}): ${detail}`);
    this.name = 'LLMBudgetExceededError';
  }
}

type Modality = 'chat' | 'embeddings' | 'image' | 'audio_stt' | 'audio_tts';

export type MeterMeta = {
  provider: string; // 'openai'
  model_code: string; // 'gpt-4o-mini'
  modality: Modality;
  user_id?: string | null;
  site_id?: string | null;
  template_id?: string | null;
  route?: string; // e.g. '/api/ai/suggest' — for per-route attribution
};

type UsageDelta = {
  input_tokens?: number;
  output_tokens?: number;
  images?: number;
  minutes_audio?: number;
  metadata?: Record<string, any>;
};

function startOfTodayUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Sum cost_usd since a timestamp, optionally scoped to a user. */
async function spendSince(sinceISO: string, userId?: string | null): Promise<number> {
  let q = supabaseAdmin.from('ai_usage_events').select('cost_usd').gte('created_at', sinceISO);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) {
    // Fail open on read errors so analytics outages don't take down AI features;
    // the post-call log still records spend for later reconciliation.
    console.warn('[llm-meter] spend read failed, allowing call:', error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, r: any) => sum + Number(r.cost_usd || 0), 0);
}

/**
 * Throws LLMBudgetExceededError if the next call would exceed a configured cap.
 * No-ops when metering is disabled or no caps are set. Call before the LLM request.
 */
export async function assertAiBudget(userId?: string | null): Promise<void> {
  if (!ENABLED) return;

  if (DAILY_USD > 0) {
    const spent = await spendSince(startOfTodayUTC());
    if (spent >= DAILY_USD)
      throw new LLMBudgetExceededError('global_daily', `$${spent.toFixed(2)} / $${DAILY_USD}`);
  }
  if (MONTHLY_USD > 0) {
    const spent = await spendSince(startOfMonthUTC());
    if (spent >= MONTHLY_USD)
      throw new LLMBudgetExceededError('global_monthly', `$${spent.toFixed(2)} / $${MONTHLY_USD}`);
  }
  if (PER_USER_DAILY_CENTS > 0 && userId) {
    const spent = await spendSince(startOfTodayUTC(), userId);
    const capUsd = PER_USER_DAILY_CENTS / 100;
    if (spent >= capUsd)
      throw new LLMBudgetExceededError('user_daily', `$${spent.toFixed(2)} / $${capUsd.toFixed(2)} for user ${userId}`);
  }
}

/**
 * Meter one LLM call end-to-end. `run` performs the provider call and returns the
 * value plus the token/usage delta pulled from the provider response.
 *
 *   const text = await meterLLMCall(
 *     { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', user_id, route: '/api/ai/suggest' },
 *     async () => {
 *       const r = await openai.chat.completions.create({ ... });
 *       return { value: r.choices[0].message.content ?? '',
 *                usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens } };
 *     },
 *   );
 */
export async function meterLLMCall<T>(
  meta: MeterMeta,
  run: () => Promise<{ value: T; usage: UsageDelta }>
): Promise<T> {
  await assertAiBudget(meta.user_id);

  const { value, usage } = await run();

  // Log actual cost (computed from the pricing table) — never let logging failures
  // break the user-facing response.
  let cost = 0;
  try {
    cost = await logActualCost({
      provider: meta.provider,
      model_code: meta.model_code,
      modality: meta.modality,
      user_id: meta.user_id ?? undefined,
      site_id: meta.site_id ?? undefined,
      template_id: meta.template_id ?? undefined,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      images: usage.images,
      minutes_audio: usage.minutes_audio,
      metadata: { route: meta.route, ...(usage.metadata ?? {}) },
    });
  } catch (e: any) {
    console.warn('[llm-meter] logActualCost failed:', e?.message);
  }

  // Mirror to PostHog so AI spend shows up next to product/revenue analytics.
  await captureServer(
    'llm_call',
    {
      provider: meta.provider,
      model: meta.model_code,
      modality: meta.modality,
      route: meta.route,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cost_usd: cost,
    },
    meta.user_id ?? null
  );

  return value;
}
