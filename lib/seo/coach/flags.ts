// lib/seo/coach/flags.ts
//
// Import-light helpers for the coaching LLM layer — the enable gate, the deterministic
// fallback picker, and pure JSON validators. Kept free of OpenAI/db imports so they
// stay unit-testable (mirrors lib/outreach/recSummary.ts).

import type { RecStep, SeoRec } from '@/lib/seo/coach/types';

/** Master gate for the two coaching crons (independent of the LLM flag). */
export function aiSeoCoachEnabled(): boolean {
  return process.env.AI_SEO_COACH_ENABLED === '1' || process.env.AI_SEO_COACH_ENABLED === 'true';
}

/** Is the grounded-LLM polish enabled? Falls back to deterministic text when false. */
export function aiSeoCoachLlmEnabled(): boolean {
  return (
    (process.env.AI_SEO_COACH_LLM_ENABLED === '1' || process.env.AI_SEO_COACH_LLM_ENABLED === 'true') &&
    !!process.env.OPENAI_API_KEY
  );
}

/** The single highest-priority rec, as the deterministic daily fallback. */
export function pickDeterministicNextStep(recs: SeoRec[]): SeoRec | null {
  return recs.length ? recs[0] : null;
}

/** A SeoRec → RecStep (title + short why), for a uniform email/LLM shape. */
export function recToStep(rec: SeoRec): RecStep {
  return { title: rec.title, why: rec.detail };
}

/** Validate the model's single-step JSON, or null. Pure. */
export function parseDailyStep(raw: string | null | undefined): RecStep | null {
  if (!raw) return null;
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  const s = j?.step ?? (Array.isArray(j?.steps) ? j.steps[0] : j);
  const title = String(s?.title ?? '').trim();
  const why = String(s?.why ?? s?.detail ?? '').trim();
  return title ? { title, why } : null;
}

/** Validate the model's JSON into at most 3 clean steps, or null. Pure. */
export function parseWeeklySteps(raw: string | null | undefined): RecStep[] | null {
  if (!raw) return null;
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  const arr = Array.isArray(j?.steps) ? j.steps : Array.isArray(j) ? j : null;
  if (!arr) return null;
  const clean = arr
    .map((s: any) => ({ title: String(s?.title ?? '').trim(), why: String(s?.why ?? s?.detail ?? '').trim() }))
    .filter((s: RecStep) => s.title.length > 0)
    .slice(0, 3);
  return clean.length ? clean : null;
}
