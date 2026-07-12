// lib/outreach/recSummary.ts
//
// Import-light helpers for the LLM "top 3" synthesis — types, the enable gate, and the
// pure JSON validator. Kept separate from synthesizeRecs.ts (which pulls in OpenAI +
// the metering chain) so these stay unit-testable without a network/db stack.

export type RecStep = { title: string; why: string };
export type RecSummary = { steps: RecStep[]; model: string };

export function geoRecsLlmEnabled(): boolean {
  return (
    (process.env.GEO_RECS_LLM_ENABLED === '1' || process.env.GEO_RECS_LLM_ENABLED === 'true') &&
    !!process.env.OPENAI_API_KEY
  );
}

/** Validate the model's JSON into at most 3 clean steps, or null. Pure. */
export function parseTopThree(raw: string | null | undefined): RecStep[] | null {
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
