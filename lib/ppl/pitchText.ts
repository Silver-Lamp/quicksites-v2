// lib/ppl/pitchText.ts — the text-first pitch, pure.
//
// Owner, 2026-10-18: "the new business model might work over text … a link to terms … text after
// a couple of days letting them know we'll switch to another provider … follow up with a call".
// Two texts, both held to the IVR-forbidden list and the money rule (every figure from DEALS):
//
//   1. The call they got, free; the deal; a link that IS the yes (the deposit checkout); terms.
//   2. The honest nudge, chosen per line: where another no-website shop in the city exists, the
//      REAL re-point date and name (and we re-point on that date, or the next text is a lie);
//      where none exists, "that was the last free one" — also true. Never a bluff.
//
// Never the caller. Same number, same STOP as every text the business already gets from us.
import { DEALS, type DealKey, usd } from '@/lib/ppl/pitchPlan';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { last10 } from '@/lib/ppl/ownNumberCall';

export const FOLLOWUP_AFTER_DAYS = 3;
/** Text 2's "by <date>" is this many days after it is sent. */
export const REPOINT_AFTER_DAYS = 4;

const usDisplay = (e164: string | null): string => {
  const d = last10(e164);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(e164 ?? '');
};

export function shortDay(iso: string | Date, tz = 'America/Los_Angeles'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d);
}
export function shortDate(iso: string | Date, tz = 'America/Los_Angeles'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }).format(d);
}
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

export type PitchText1Args = {
  domain: string;
  lead: { at: string; seconds: number; callerPhone?: string | null } | null;
  deal: DealKey;
  checkoutUrl: string;
  termsUrl: string;
};

export function pitchText1(a: PitchText1Args): string {
  const d = DEALS[a.deal];
  const secs = PPL_DEFAULTS.minBillableSeconds;
  const got = a.lead
    ? `QuickSites: the ${shortDay(a.lead.at)} call from ${a.domain}${a.lead.callerPhone ? ` (${usDisplay(a.lead.callerPhone)})` : ''} was on us.`
    : `QuickSites: the calls you have taken from ${a.domain} were on us.`;
  const deal = a.deal === 'next'
    ? `To keep them coming: pay ${usd(d.cplCents)} for the next one here, then ${usd(d.cplCents)} is charged as each call of ${secs} s+ comes in — always one ahead, nothing after the fact.`
    : `To keep them coming: ${d.leads} calls for ${usd(d.depositCents)} here (${usd(d.cplCents)} each, only calls of ${secs} s+; unused refundable on request).`;
  return `${got} ${deal} ${a.checkoutUrl} Terms: ${a.termsUrl} Reply STOP to stop.`;
}

export type PitchText2Args = {
  domain: string;
  deal: DealKey;
  checkoutUrl: string;
  /** Another no-website shop in the same city and trade we would genuinely re-point to. */
  alternative: { name: string } | null;
  /** When text 2 goes out; the "by" date is REPOINT_AFTER_DAYS later. */
  sentAt: Date;
};

export function pitchFollowupKind(a: Pick<PitchText2Args, 'alternative'>): 'repoint' | 'last_free' {
  return a.alternative ? 'repoint' : 'last_free';
}

export function pitchText2(a: PitchText2Args): { kind: 'repoint' | 'last_free'; by: Date | null; text: string } {
  const d = DEALS[a.deal];
  if (a.alternative) {
    const by = addDays(a.sentAt, REPOINT_AFTER_DAYS);
    return {
      kind: 'repoint',
      by,
      text: `QuickSites: ${a.domain} rings one shop. If I have not heard back by ${shortDate(by)} I will offer the line to ${a.alternative.name}. To keep it: ${a.checkoutUrl} (${a.deal === 'next' ? `${usd(d.cplCents)} for the next call` : `${d.leads} for ${usd(d.depositCents)}`}). Reply STOP to stop.`,
    };
  }
  return {
    kind: 'last_free',
    by: null,
    text: `QuickSites: that was the last free call from ${a.domain}. The line stays on; the next call is ${usd(DEALS.next.cplCents)} if you want it — pay here and it keeps ringing you: ${a.checkoutUrl} Reply STOP to stop.`,
  };
}

/** Where a line is in the funnel, from the campaign row — for the console's chips and the next action. */
export type PitchFunnel = {
  deal: DealKey | null;
  textedAt: string | null;
  followupAt: string | null;
  followupKind: 'repoint' | 'last_free' | null;
  repointBy: string | null;
  calledAt: string | null;
  result: 'paid' | 'no' | 'later' | 'no_reply' | 'repointed' | null;
};

export type PitchNext = { step: 'text1' | 'text2' | 'call' | 'repoint' | 'done'; why: string };

export function pitchNextStep(f: PitchFunnel, nowMs = Date.now()): PitchNext {
  if (f.result === 'paid') return { step: 'done', why: 'They paid — the account is live.' };
  if (f.result === 'no' || f.result === 'repointed') return { step: 'done', why: f.result === 'no' ? 'They said no.' : 'The line was re-pointed.' };
  if (!f.textedAt) return { step: 'text1', why: 'Nothing sent yet. Text 1 is the call they got, the deal, the link that is the yes, and the terms.' };
  const sinceText = (nowMs - Date.parse(f.textedAt)) / 86_400_000;
  if (!f.followupAt) {
    if (sinceText < FOLLOWUP_AFTER_DAYS) return { step: 'text2', why: `Text 1 went ${Math.floor(sinceText)} day(s) ago; the follow-up is due at ${FOLLOWUP_AFTER_DAYS}. A call before then is fine too.` };
    return { step: 'text2', why: `Text 1 went ${Math.floor(sinceText)} days ago with no deposit. Send the follow-up, then call referencing it.` };
  }
  if (!f.calledAt) return { step: 'call', why: 'Both texts are out. Call, and open with the text: "I texted you about the call from the site."' };
  if (f.followupKind === 'repoint' && f.repointBy && nowMs >= Date.parse(f.repointBy)) return { step: 'repoint', why: `The date in text 2 (${f.repointBy}) has passed with no deposit. Re-point the line as promised — or the next text we send is a lie.` };
  return { step: 'done', why: 'Texted, followed up, called. Record the result.' };
}
