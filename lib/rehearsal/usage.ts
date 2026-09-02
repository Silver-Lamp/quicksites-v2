// lib/rehearsal/usage.ts
//
// Records what each rehearsal turn cost. Contract: crosstalk/contracts/rehearsal-engine.md.
//
// HiveJournal returns a usage envelope per call and persists nothing; the rollup is ours,
// because HJ bills QuickSites and QuickSites bills the company. Sourcing our invoices from
// their schema would make our revenue depend on someone else's columns.
//
// ⚠️ TWO RULES HERE ARE ABOUT HONEST NUMBERS, NOT PLUMBING.
//
// 1. **NULL is not zero.** `cost_cents` is null when we do not know what a turn cost and 0 only
//    when it was genuinely free. Defaulting unknown to 0 is how a number meaning nothing gets
//    summed into an invoice — a failure this repo has shipped before, where `$0.00` on a screen
//    meant "we never found out".
// 2. **A failed write is loud.** If our logging breaks we under-bill our own customers, silently
//    and in our favour, which is the kind of failure that survives for years because nothing
//    complains. So a failed insert is reported, never swallowed — but it does NOT fail the turn,
//    because dropping a rep's practice to protect a billing row is the wrong trade.
import { supabaseAdmin } from '@/lib/supabase/admin';

/** The envelope HiveJournal returns alongside a turn result. */
export type TurnUsageEnvelope = {
  partner?: string;
  grant_id?: string;
  lane?: string;
  cost_cents?: number;
  billed?: boolean;
};

export type UsageRow = {
  user_id: string | null;
  org_id: string | null;
  lane: string;
  partner: string | null;
  grant_id: string | null;
  cost_cents: number | null;
  billed: boolean | null;
  latency_ms: number | null;
  status: 'ok' | 'error';
  error: string | null;
};

/**
 * Envelope → row. Pure, so the honesty rules above are testable without a database.
 *
 * Anything the envelope did not actually report stays null. In particular a non-integer or
 * missing `cost_cents` becomes null rather than 0 — we bill in integer cents, and a float here
 * means the far end changed shape, which is worth seeing as "unknown" rather than rounding away.
 */
export function toUsageRow(input: {
  lane: string;
  usage?: TurnUsageEnvelope | null;
  userId?: string | null;
  orgId?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}): UsageRow {
  const failed = !!input.error;
  const u = input.usage ?? null;
  const cost = u && Number.isInteger(u.cost_cents) ? (u.cost_cents as number) : null;

  return {
    user_id: input.userId ?? null,
    org_id: input.orgId ?? null,
    // The engine echoes the lane key back; fall back to what we sent so a row is never laneless.
    lane: (u?.lane || input.lane || 'unknown').slice(0, 120),
    partner: u?.partner ?? null,
    grant_id: u?.grant_id ?? null,
    // A turn we could not complete has no known cost — and the DB constraint enforces that too,
    // so a future caller cannot record an error row carrying a confident number.
    cost_cents: failed ? null : cost,
    billed: typeof u?.billed === 'boolean' ? u.billed : null,
    latency_ms: Number.isFinite(input.latencyMs as number) ? Math.round(input.latencyMs!) : null,
    status: failed ? 'error' : 'ok',
    error: input.error ? String(input.error).slice(0, 500) : null,
  };
}

/**
 * Write one usage row. Best-effort for the CALLER, never silent for us.
 *
 * Returns whether the row landed, so a caller that cares (a reconciliation job, a test) can tell.
 * The practice surface ignores it on purpose: a rep mid-turn should not lose their answer because
 * a billing insert failed.
 */
export async function recordTurnUsage(
  input: Parameters<typeof toUsageRow>[0]
): Promise<boolean> {
  const row = toUsageRow(input);
  try {
    const { error } = await (supabaseAdmin as any).from('rehearsal_usage').insert(row);
    if (error) throw new Error(error.message);
    return true;
  } catch (err: any) {
    // Loud on purpose. This is the failure that would otherwise cost us money quietly.
    console.error(
      '[rehearsal_usage] FAILED TO RECORD A BILLABLE TURN — we will under-bill for it:',
      { lane: row.lane, grant_id: row.grant_id, cost_cents: row.cost_cents },
      err?.message || err
    );
    return false;
  }
}
