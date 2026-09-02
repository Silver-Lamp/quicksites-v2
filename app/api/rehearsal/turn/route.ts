// app/api/rehearsal/turn/route.ts
// One practice turn. Thin: the logic is lib/rehearsal/turn.ts.
//
// ⚠️ ADMIN-GATED FOR NOW, and that is a cost decision rather than a privacy one. Every turn
// spends real money on HiveJournal's side and bills to our partner grant, so until there is a
// per-company access model (the product this becomes), the only people who can spend it are the
// people who pay for it. Widening this to reps means adding that model, not deleting this line.
import { requireAdmin } from '@/lib/auth/requireUser';
import { json, badRequest } from '@/lib/api/json';
import { runPracticeTurn, type TranscriptTurn } from '@/lib/rehearsal/turn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const body = await req.json().catch(() => ({}) as any);
  const repSaid = typeof body?.rep_said === 'string' ? body.rep_said.trim() : '';
  if (!repSaid) return badRequest('rep_said is required — say something first');
  if (repSaid.length > 4000) return badRequest('rep_said is too long');

  const transcript: TranscriptTurn[] = Array.isArray(body?.transcript)
    ? body.transcript
        .filter((t: any) => t && typeof t.text === 'string')
        .map((t: any) => ({ who: t.who === 'prospect' ? 'prospect' : 'rep', text: String(t.text).slice(0, 1000) }))
    : [];

  const outcome = await runPracticeTurn({
    repSaid,
    archetypeId: typeof body?.archetype_id === 'string' ? body.archetype_id : undefined,
    transcript,
    userId: gate.user.id,
  });

  if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
  return json({ ...outcome.result, isolating: outcome.isolating, latency_ms: outcome.latencyMs });
}
