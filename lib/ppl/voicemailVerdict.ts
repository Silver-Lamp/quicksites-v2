// lib/ppl/voicemailVerdict.ts
//
// Is this voicemail a LEAD for the trade the site sells? (owner, 2026-10-12: "add an LLM call step
// to analyze voicemails for validity before sending them on"). The first call on cullmantow.com
// was a home-care agency ringing "about your account" — a vendor on a recycled or misdialled
// number — and the towing company was texted a recording link as if a customer had called.
//
// Three answers, and the decision each one drives (decideVoicemailRelay):
//   lead      — a person who needs the trade's service: text the business, as before.
//   not_lead  — vendor, sales, billing, recruiter, wrong number, spam: do NOT text the business;
//               the operator's email says what it was and that it was held.
//   unclear   — anything the model cannot place, and every failure (no key, timeout, bad JSON):
//               text the business. ⚠️ FAIL OPEN toward the business — a lost customer is the
//               worse error, and "unclear" is reported as unclear, never dressed up as a verdict.
// The caller's phone number is never shown to the model: a verdict must rest on what was SAID.
// Metered like every other model call here (lib/ai/meter.ts).
import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { INDUSTRIES } from '@/lib/industries';
import type { VoicemailSpeech } from '@/lib/ppl/voicemailSpeech';

/** "towing" → "Towing"; an unknown key reads as its words. Pure. */
export function industryLabelFor(key: string | null | undefined): string {
  const k = String(key ?? '').trim();
  if (!k) return 'local service';
  return INDUSTRIES.find((i) => i.key === k)?.label ?? k.replace(/_/g, ' ');
}

export type VoicemailVerdict = 'lead' | 'not_lead' | 'unclear';
export type VerdictResult = { verdict: VoicemailVerdict; reason: string };

const MODEL = 'gpt-4o-mini';
const ROUTE = '/api/twilio/geo/[campaignId]/voicemail';

/** Pure: the model's JSON → a verdict; anything malformed is `unclear`, never a guess. */
export function parseVerdict(raw: unknown): VerdictResult {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const v = String((obj as { verdict?: unknown })?.verdict ?? '').trim().toLowerCase();
    const reason = String((obj as { reason?: unknown })?.reason ?? '').trim().slice(0, 240);
    if (v === 'lead' || v === 'not_lead' || v === 'unclear') return { verdict: v, reason: reason || v };
  } catch {
    /* fall through */
  }
  return { verdict: 'unclear', reason: 'could not read the verdict' };
}

/**
 * Pure: who gets told. The business is texted for a lead and for anything unclear; never for a
 * non-lead, never for a recording with no speech. The operator always hears, with the verdict.
 */
export function decideVoicemailRelay(input: { speech: VoicemailSpeech; verdict: VoicemailVerdict | null }): {
  textBusiness: boolean;
  skipped: 'no_speech' | 'not_lead' | null;
} {
  if (input.speech === 'no_speech') return { textBusiness: false, skipped: 'no_speech' };
  if (input.verdict === 'not_lead') return { textBusiness: false, skipped: 'not_lead' };
  return { textBusiness: true, skipped: null };
}

/** One line for the operator's email and the call-alert digest. */
export function verdictLine(v: { verdict: VoicemailVerdict; reason: string } | null | undefined): string | null {
  if (!v) return null;
  if (v.verdict === 'lead') return `judged a lead — ${v.reason}`;
  if (v.verdict === 'not_lead') return `judged NOT a lead — ${v.reason}. The business was not texted; nothing to relay.`;
  return `could not judge — ${v.reason}. Treated as a possible lead: the business was texted.`;
}

export const VERDICT_SYSTEM_PROMPT =
  'You read the transcript of a voicemail left on a phone number that belongs to a local-business website, ' +
  'and decide whether the caller is a CUSTOMER who wants that business\'s service. ' +
  'Answer with JSON only: {"verdict":"lead"|"not_lead"|"unclear","reason":"<one short sentence>"}. ' +
  '"lead": a person who needs the service the business sells (now or soon), or is asking about availability, price or location of that service. ' +
  '"not_lead": a vendor, supplier, salesperson, recruiter, billing or "about your account" call, a political or charity call, a robocall, a survey, ' +
  'a caller clearly trying to reach a different kind of business, or a wrong number. ' +
  '"unclear": you cannot tell. Judge only from the words; never assume. Prefer "unclear" over a confident guess.';

export async function judgeVoicemail(input: {
  transcript: string;
  industryLabel: string;
  city: string | null;
  domain: string;
  callSid?: string;
}): Promise<VerdictResult> {
  const text = input.transcript.trim();
  if (!text) return { verdict: 'unclear', reason: 'empty transcript' };
  try {
    const user =
      `The business: a ${input.industryLabel} company${input.city ? ` serving ${input.city}` : ''}, reached through ${input.domain}.\n` +
      `Voicemail transcript:\n"""${text.slice(0, 2000)}"""`;
    const raw = await meterLLMCall<string>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: null, route: ROUTE },
      async () => {
        const r = await getOpenAI('chat').chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: VERDICT_SYSTEM_PROMPT },
            { role: 'user', content: user },
          ],
        });
        return {
          value: r.choices?.[0]?.message?.content ?? '',
          usage: { input_tokens: r.usage?.prompt_tokens ?? 0, output_tokens: r.usage?.completion_tokens ?? 0 },
        };
      },
    );
    return parseVerdict(raw);
  } catch (e) {
    return { verdict: 'unclear', reason: `judge failed: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}` };
  }
}
