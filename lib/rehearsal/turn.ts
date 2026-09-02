// lib/rehearsal/turn.ts
//
// One practice turn against HiveJournal's rehearsal engine.
// Contract: crosstalk/contracts/rehearsal-engine.md (§1c is the envelope).
//
// ⚠️ THE ENVELOPE IS NOT THE LANE SPEC. The whole artifact goes under one `lane` key and the
// turn's fields sit BESIDE it. A body one level off does NOT fail where the mistake is: their
// normalizer accepts the lane id at either depth, so it passes the id check and dies two fields
// later complaining that honesty rules are missing when they are merely misplaced. That cost
// HiveJournal their first real turn.
//
// ⚠️ A prospect's identity must never reach this function (contract §4). Archetypes are types of
// people; the business owner being practised against agreed to nothing and has no reason to exist
// in anyone's prompt or logs.
import { GEO_DOMAIN_RENTAL_LANE } from '@/lib/sales/lanes/geoDomainRental';
import { toEngineLaneSpec } from '@/lib/sales/laneSpec';
import { partnerHeaders, rehearsalTurnUrl, rehearsalEnabled } from '@/lib/rehearsal/config';
import { recordTurnUsage, type TurnUsageEnvelope } from '@/lib/rehearsal/usage';

export type TranscriptTurn = { who: 'rep' | 'prospect'; text: string };

export type HonestyFlag = {
  rule_id: string;
  /** Verbatim from what the rep said — HJ verifies this rather than trusting it. */
  quote: string;
  why?: string;
};

export type EngineTurn = {
  prospect_line?: string;
  objection_id?: string | null;
  call_state?: string;
  coaching?: string;
  honesty_flags?: HonestyFlag[];
  flags_dropped?: number;
  would_keep_listening?: 'yes' | 'no' | 'unclear';
  usage?: TurnUsageEnvelope;
};

export type TurnOutcome =
  | { ok: true; result: EngineTurn; isolating: boolean[]; latencyMs: number }
  | { ok: false; status: number; error: string; latencyMs: number };

/**
 * Does a flag's quote point at PART of what the rep said, or just hand the whole line back?
 *
 * HJ's guard verifies a quote is REAL (`haystack.includes(needle)`) — it cannot verify that the
 * quote ISOLATES anything, and on the first real turn the model returned the entire rep line
 * character for character. That satisfies `includes()` in the one way that proves nothing, and
 * it is useless to a rep: nothing in it says which words were the promise.
 *
 * We compute this ourselves rather than waiting for the engine to, because our surface has to
 * decide whether it can highlight a span. A flag that isolates nothing gets labelled as such
 * instead of highlighting the whole sentence and calling it coaching.
 */
export function isolatingQuote(quote: string, repSaid: string): boolean {
  const q = (quote || '').trim();
  const r = (repSaid || '').trim();
  if (!q || !r) return false;
  return q.length < r.length && r.toLowerCase().includes(q.toLowerCase());
}

export async function runPracticeTurn(input: {
  repSaid: string;
  archetypeId?: string;
  transcript?: TranscriptTurn[];
  userId?: string | null;
  orgId?: string | null;
}): Promise<TurnOutcome> {
  const started = Date.now();
  if (!rehearsalEnabled()) {
    return { ok: false, status: 503, error: 'rehearsal is not configured', latencyMs: 0 };
  }

  const lane = GEO_DOMAIN_RENTAL_LANE;
  const body = {
    // §1c: the artifact whole, under one key. `body.lane.lane.id` is correct, not a typo.
    lane: toEngineLaneSpec(lane),
    archetype_id: input.archetypeId || lane.archetypes[0].id,
    grounding: lane.trueClaims.join('\n'),
    transcript: (input.transcript || []).slice(-40),
    rep_said: input.repSaid,
  };

  let res: Response;
  try {
    res = await fetch(rehearsalTurnUrl(), {
      method: 'POST',
      headers: { ...partnerHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    await recordTurnUsage({ lane: lane.id, error: `network: ${err?.message || err}`, latencyMs });
    return { ok: false, status: 502, error: 'could not reach the rehearsal engine', latencyMs };
  }

  const latencyMs = Date.now() - started;
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const error = parsed?.error || `engine returned ${res.status}`;
    // A failed turn is a real row: a revoked grant shows up here and nowhere else, because our
    // config gate can only see that a value is present, never that it still works.
    await recordTurnUsage({ lane: lane.id, error, latencyMs, userId: input.userId, orgId: input.orgId });
    return { ok: false, status: res.status, error, latencyMs };
  }

  const result = (parsed || {}) as EngineTurn;
  const flags = result.honesty_flags || [];
  await recordTurnUsage({
    lane: lane.id,
    usage: result.usage,
    latencyMs,
    userId: input.userId,
    orgId: input.orgId,
    flagsRaised: flags.length,
    flagsDropped: typeof result.flags_dropped === 'number' ? result.flags_dropped : null,
  });

  return {
    ok: true,
    result,
    isolating: flags.map((f) => isolatingQuote(f.quote, input.repSaid)),
    latencyMs,
  };
}
