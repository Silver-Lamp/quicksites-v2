// lib/billing/estimateSavings.ts
//
// Turn a redacted cloud bill into a SAVINGS RANGE with its assumptions attached.
//
// ⚠️ THE OUTPUT IS AN ESTIMATE FROM ONE BILL, AND EVERY LAYER SAYS SO. "You'd save 34%" is a
// promise about infrastructure we have seen one month of, made to someone who is deciding
// whether to move production workloads. So this returns a RANGE, the assumptions it rests on,
// and — the part that makes it trustworthy — a `recommendSwitch: false` path.
//
// ⚠️ THE HONEST "NO" IS A FIRST-CLASS RESULT, NOT AN ERROR CASE. A bill that is mostly managed
// services (RDS, Lambda, managed Kafka, support contracts) does not port to cheaper compute, and
// telling that person to switch would cost them a migration to save nothing. The site's own FAQ
// already promises "if it is not a fit, I tell you" — this is where that promise is kept or
// broken, so the model is instructed to reach that conclusion and the type makes room for it.
//
// The comparison figure (20–50%) belongs to the PROVIDER, not to us. It is passed through as
// their published claim and labelled as such wherever it is shown.

import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';

export type SavingsEstimate = {
  /** Monthly spend we could read off the bill, in dollars. Null when the bill was unreadable. */
  currentMonthlyUsd: number | null;
  /** The saving RANGE, never a single number. */
  lowPct: number;
  highPct: number;
  /** What the range rests on — shown next to it, never in a footnote. */
  assumptions: string[];
  /**
   * False when the honest answer is "don't move". Not an error: the most credible thing this
   * tool can do is talk someone out of a migration that wouldn't pay.
   */
  recommendSwitch: boolean;
  /** One paragraph a human can read, in plain language. */
  summary: string;
  /** Line items the model could identify, for the owner's follow-up. */
  notableLines: Array<{ label: string; monthlyUsd: number | null }>;
};

const SYSTEM = [
  'You are estimating what a company might save by moving cloud workloads to a lower-cost provider.',
  'You will be given the text of a bill with identifying details already removed.',
  '',
  'Return JSON ONLY with keys: currentMonthlyUsd (number|null), lowPct (number), highPct (number),',
  'assumptions (array of short strings), recommendSwitch (boolean), summary (string),',
  'notableLines (array of {label, monthlyUsd}).',
  '',
  'RULES, in priority order:',
  '1. NEVER return a single percentage. Always a range, and widen it when the bill is thin.',
  '2. If the spend is mostly MANAGED SERVICES (databases, serverless, managed queues/search,',
  '   support plans) rather than raw compute/storage/egress, set recommendSwitch=false and say',
  '   plainly in summary that a move would not pay. This answer is expected and welcome.',
  '3. State assumptions you actually made — commitment discounts, egress, re-platforming effort,',
  '   staff time. If you assumed on-demand pricing, say so.',
  '4. Never invent a figure the bill does not support. currentMonthlyUsd may be null.',
  '5. Do not name a provider or quote a competitor discount. Estimate from the bill alone.',
].join('\n');

/**
 * Estimate from redacted bill text. Metered, so cost lands in ai_usage_events like every other
 * inference call in this codebase.
 */
export async function estimateSavings(
  redactedText: string,
  actorId: string | null,
): Promise<SavingsEstimate | null> {
  const text = String(redactedText ?? '').slice(0, 20_000);
  if (text.trim().length < 40) return null;

  return meterLLMCall<SavingsEstimate | null>(
    {
      provider: 'openai',
      model_code: 'gpt-4o-mini',
      modality: 'chat',
      user_id: actorId,
      route: '/api/billing/estimate',
    },
    async () => {
      const r = await getOpenAI('chat').chat.completions.create({
        model: resolveModel('gpt-4o-mini', 'chat'),
        temperature: 0.2, // an estimate, not a creative writing exercise
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        return { value: null, usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens } };
      }

      const num = (v: any): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;

      let low = num(parsed.lowPct) ?? 0;
      let high = num(parsed.highPct) ?? 0;
      if (high < low) [low, high] = [high, low];

      // ⚠️ A ZERO-WIDTH RANGE IS A SINGLE NUMBER WEARING A RANGE'S CLOTHES. The rule above says
      // "never a single percentage"; a model that returns 34–34 has complied with the letter and
      // broken the point, and the UI would render it as a promise. Widen it rather than trust it.
      if (high - low < 5 && high > 0) {
        low = Math.max(0, low - 5);
        high = high + 5;
      }

      const value: SavingsEstimate = {
        currentMonthlyUsd: num(parsed.currentMonthlyUsd),
        lowPct: Math.max(0, Math.round(low)),
        highPct: Math.max(0, Math.round(high)),
        assumptions: Array.isArray(parsed.assumptions)
          ? parsed.assumptions.map(String).filter(Boolean).slice(0, 6)
          : [],
        // Default to NOT recommending. An absent/garbled field must not read as a green light.
        recommendSwitch: parsed.recommendSwitch === true,
        summary: String(parsed.summary ?? '').slice(0, 1200),
        notableLines: Array.isArray(parsed.notableLines)
          ? parsed.notableLines
              .map((l: any) => ({ label: String(l?.label ?? '').slice(0, 80), monthlyUsd: num(l?.monthlyUsd) }))
              .filter((l: any) => l.label)
              .slice(0, 12)
          : [],
      };
      return { value, usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens } };
    },
  );
}
