// app/api/admin/ppl/disputes/[id]/route.ts — the operator's decision on a dispute.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { decideDispute } from '@/lib/ppl/disputes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  decision: z.enum(['approved', 'denied']),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const r = await decideDispute({
    disputeId: id,
    decision: parsed.data.decision,
    note: parsed.data.note,
    actorId: gate.user.id,
  });
  if (!r.ok)
    return NextResponse.json({ error: r.reason }, { status: r.reason === 'not_found' ? 404 : 409 });
  return NextResponse.json({ ok: true, credited: r.credited });
}
