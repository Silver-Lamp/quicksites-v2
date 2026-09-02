// app/api/admin/rehearsal/simulate/route.ts
// Runs the fixed simulation script against the live engine and records every turn.
//
// Admin OR cron-secret, the same pattern as /api/admin/demos/generate: a person clicking it, or
// an operator with the cron secret running it without a browser session. Both spend real money —
// five turns is well under a cent, but the gate is about who may spend, not how much.
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { json } from '@/lib/api/json';
import { runSimulationSet } from '@/lib/rehearsal/simulations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // five sequential model calls; the default would cut it off

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin && !isCronAuthorized(req)) return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}) as any);
  const only = Array.isArray(body?.only) ? body.only.map(String) : undefined;

  try {
    const { runId, rows } = await runSimulationSet({ only });
    return json({
      run_id: runId,
      ran: rows.length,
      errors: rows.filter((r) => r.status === 'error').length,
      // A summary, not a verdict: `matched_expectation` compares our expectation to what came
      // back, and our expectation is not ground truth.
      results: rows.map((r) => ({
        scenario: r.scenario_key,
        expected_rule_id: r.expected_rule_id,
        flags: (r.honesty_flags as any[]).map((f) => f?.rule_id),
        flags_dropped: r.flags_dropped,
        isolating: r.isolating,
        objection_id: r.objection_id,
        cost_cents: r.cost_cents,
        status: r.status,
        error: r.error,
      })),
    });
  } catch (err: any) {
    return json({ error: err?.message || 'simulation failed' }, 500);
  }
}
