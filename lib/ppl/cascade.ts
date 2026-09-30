// lib/ppl/cascade.ts
//
// RING LOCAL BUSINESSES ONE AT A TIME UNTIL ONE TAKES THE CALL.
// Phase 1 of docs/CALL_CASCADE_PLAN.md. Pure: given a market and what has happened so far,
// decide who to ring next and what to say. All Twilio and DB work lives in the routes.
//
// Why this exists: two destinations for covingtontow.com, chosen independently, both went to
// voicemail. A tow operator is driving a truck and does not answer an unknown number, so
// single-destination forwarding is the wrong mechanism for the trade — not a sign we picked
// badly. Left alone, `forward_unresponsive` would have eaten the whole market one honest
// observation at a time.
//
// ⚠️ THE ACCEPT KEYPRESS IS THE DESIGN, NOT A FLOURISH. Twilio counts a voicemail pickup as an
// answer, so a cascade without one dials Prime Towing, Prime's voicemail answers in 3 seconds,
// the cascade stops, and a stranded driver is bridged to a greeting — today's bug with more
// steps and a bigger bill. A voicemail cannot press 1.
//
// ⚠️ AND ACCEPTANCE IS RECORDED, NEVER INFERRED FROM `DialCallStatus`. A rejected whisper and a
// short real conversation both surface as `completed` with a small duration. Reading `completed`
// as "a person took this call" is the exact mistake that produced this whole line of work.
import { normalizePhone } from './forwardCandidates';

/** Businesses rung before we stop and take a message. Owner decision, plan §9.1. */
export const CASCADE_MAX_ATTEMPTS = 5;

/** Seconds each business is rung. Longer reaches more people and loses more callers (§9.2). */
export const CASCADE_RING_SECONDS = 22;

export type CascadeCandidate = {
  prospectId: string | null;
  businessName: string | null;
  /** E.164. */
  phone: string;
  /** Answered calls we can attribute to this destination — null when unknown, never 0 for unknown. */
  connected: number | null;
  unanswered: number | null;
};

export type CascadeAttempt = {
  phone: string;
  accepted: boolean;
};

/**
 * Order the pool by who actually answers.
 *
 * ⚠️ THIS IS WHAT `forward_unresponsive` AND `forwardHealth` ARE FOR NOW — a ranking, not a
 * blacklist. A business that never picks up simply sorts last instead of being struck off, which
 * is both kinder and more useful: on a thin market the fifth-best is still worth a ring, and a
 * business that starts answering climbs back on its own without anyone clearing a row.
 *
 * ⚠️ Unknown sorts BETWEEN known-good and known-bad, and deliberately not at either end. Putting
 * it last means a fresh market never gets rung; putting it first means one lucky answer outranks
 * a business with a real record. Most of the pool is unknown at any time.
 */
export function orderCascade(candidates: CascadeCandidate[]): CascadeCandidate[] {
  const rank = (c: CascadeCandidate): number => {
    const a = c.connected;
    const u = c.unanswered;
    if (a === null && u === null) return 1; // never rung — middle
    if ((a ?? 0) > 0) return 0; // has connected us — first
    if ((u ?? 0) > 0) return 2; // rung and never connected — last
    return 1;
  };
  return [...candidates].sort((x, y) => {
    const rx = rank(x);
    const ry = rank(y);
    if (rx !== ry) return rx - ry;
    // Within a band, more answers first, then fewer failures, then a stable name so the same
    // pool always produces the same order — a cascade that reshuffles cannot be reasoned about.
    const ax = x.connected ?? 0;
    const ay = y.connected ?? 0;
    if (ax !== ay) return ay - ax;
    const ux = x.unanswered ?? 0;
    const uy = y.unanswered ?? 0;
    if (ux !== uy) return ux - uy;
    return (x.businessName ?? '').localeCompare(y.businessName ?? '');
  });
}

export type NextStep =
  | { kind: 'ring'; candidate: CascadeCandidate; attempt: number; remaining: number }
  | { kind: 'exhausted'; tried: number };

/**
 * Who to ring next, given who has already been tried on this call.
 *
 * ⚠️ Dedupes on the PHONE. One operator can appear twice in the pool under two listings (the
 * fleet has "Space Age Wrecker and Recovery" on one number from two sweeps), and ringing the
 * same phone twice burns two of five attempts on one business while the caller holds.
 */
export function nextCascadeStep(
  ordered: CascadeCandidate[],
  tried: CascadeAttempt[],
  maxAttempts = CASCADE_MAX_ATTEMPTS,
): NextStep {
  const done = new Set(tried.map((t) => normalizePhone(t.phone)));
  const attempt = tried.length + 1;
  if (tried.length >= maxAttempts) return { kind: 'exhausted', tried: tried.length };

  const seen = new Set<string>();
  for (const c of ordered) {
    const key = normalizePhone(c.phone);
    if (!key || done.has(key) || seen.has(key)) continue;
    seen.add(key);
    return { kind: 'ring', candidate: c, attempt, remaining: maxAttempts - attempt };
  }
  return { kind: 'exhausted', tried: tried.length };
}

/** Has anyone taken this call? Once true the cascade is over. */
export function isAccepted(tried: CascadeAttempt[]): boolean {
  return tried.some((t) => t.accepted);
}

/**
 * For an XML ATTRIBUTE — quotes included, because they would close the attribute.
 */
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

/**
 * For TEXT a voice reads aloud — only the three characters XML actually requires.
 *
 * ⚠️ Escaping quotes inside `<Say>` is not wrong, it is just noise, and it made the copy
 * inconsistent with itself: "couldn&apos;t reach anyone" sat in the same sentence as a literal
 * "I'll pass it on", because one half went through the escaper and the other did not. Both
 * render identically through Polly, so nothing would have sounded wrong — which is exactly why
 * it is worth separating rather than leaving to chance. Attributes use `esc`; speech uses this.
 */
function escText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

/**
 * What the caller hears first.
 *
 * ⚠️ IT SAYS WHAT WE ARE ABOUT TO DO, AND THAT IS WHAT MAKES THE WHOLE THING HONEST. Ringing
 * several businesses behind a caller's back is something done TO them; saying "I'll ring local
 * towing companies until one picks up" makes it a service they are choosing to wait for. The
 * disclosure is the product, not a disclaimer bolted to it.
 *
 * ⚠️ NEVER "our network", "our partners", "approved", "vetted", "licensed". These businesses
 * have mostly never spoken to us. `FORBIDDEN_IVR_PHRASES` is asserted against this string.
 *
 * ⚠️ NEVER imply the caller has reached the business whose site they rang. A caller who thinks
 * they are speaking to the company on the page and gets a different one is a bait-and-switch.
 */
export function cascadeGreetingTwiml(opts: { trade: string; city: string | null; nextUrl: string }): string {
  const where = opts.city ? ` in ${opts.city}` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling. I'll ring ${escText(opts.trade)} companies${escText(where)} until one picks up. Stay on the line.</Say>
  <Redirect method="POST">${esc(opts.nextUrl)}</Redirect>
</Response>`;
}

/** Between attempts. Short — the caller is holding and has heard it before. */
export function cascadeHoldTwiml(opts: { attempt: number; nextUrl: string }): string {
  const line = opts.attempt <= 1 ? 'Ringing the first one now.' : 'Still looking. Trying another.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escText(line)}</Say>
  <Redirect method="POST">${esc(opts.nextUrl)}</Redirect>
</Response>`;
}

/**
 * The whisper the business hears, and the digit that accepts.
 *
 * ⚠️ `numDigits="1"` with a short timeout, and **no digit means no** — the Gather falls through
 * to a Hangup, the leg ends, and the cascade advances. That is what stops a voicemail taking a
 * lead it cannot service.
 *
 * ⚠️ It states the caller is a member of the public and where they came from. A business that
 * presses 1 must know it is accepting a real call from a stranger, not listening to a pitch.
 */
export function cascadeWhisperTwiml(opts: {
  trade: string;
  city: string | null;
  domain: string;
  acceptUrl: string;
}): string {
  const where = opts.city ? ` in ${opts.city}` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="8" action="${esc(opts.acceptUrl)}" method="POST">
    <Say voice="Polly.Joanna">A customer is on the line looking for ${escText(opts.trade)}${escText(where)}, from ${escText(opts.domain)}. Press 1 to take the call.</Say>
  </Gather>
  <Hangup/>
</Response>`;
}

/**
 * Nobody took it.
 *
 * ⚠️ WE SAY SO. The pitch is "I'll ring until one picks up"; when we stop, the caller is told we
 * stopped. A service that advertises persistence and then quietly gives up after five attempts
 * is worse than one that never promised — and ninety seconds of hold followed by silence is
 * worse than the five-second silence this replaced.
 */
export function cascadeExhaustedTwiml(opts: { tried: number; recordActionUrl: string }): string {
  // ⚠️ `tried === 0` is a real state — an empty pool, a market we have never swept — and "I
  // tried 0 and couldn't reach anyone" is the kind of sentence that tells a caller a machine is
  // reading them a variable. It also must not claim attempts that never happened.
  const lead =
    opts.tried === 0
      ? "I couldn't reach anyone right now"
      : opts.tried === 1
        ? "I tried one and couldn't reach them right now"
        : `I tried ${opts.tried} and couldn't reach anyone right now`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escText(lead)}. Leave a message after the tone with your number and I'll pass it on.</Say>
  <Record maxLength="120" playBeep="true" trim="trim-silence" action="${esc(opts.recordActionUrl)}" method="POST"/>
  <Say voice="Polly.Joanna">I didn't get a message. Please try again shortly.</Say>
</Response>`;
}
