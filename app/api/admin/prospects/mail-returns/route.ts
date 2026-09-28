// app/api/admin/prospects/mail-returns/route.ts
//
// Mark a postcard returned, and act on why.
//
// ⚠️ Deliberately operator-driven. Returns arrive PHYSICALLY — a card in the mailbox — which no
// webhook reports, and Lob's has never fired here anyway (all 164 real rows still read
// `status='created'`). There is no automated source for this fact.
//
// POST { mailingId, reason, note? }            → mark returned; closes the prospect if terminal
// POST { prospectId, address, requeue: true }  → corrected address, re-arm the mailer
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import {
  markReturned,
  requeueWithAddress,
  reopenProspect,
  RETURN_REASONS,
} from '@/lib/outreach/mail/returns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const markSchema = z.object({
  mailingId: z.string().uuid(),
  reason: z.enum(RETURN_REASONS),
  note: z.string().max(500).nullish(),
});

const requeueSchema = z.object({
  prospectId: z.string().uuid(),
  address: z.string().min(8).max(300),
  requeue: z.literal(true),
});

const reopenSchema = z.object({ prospectId: z.string().uuid(), reopen: z.literal(true) });

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const requeue = requeueSchema.safeParse(body);
  if (requeue.success) {
    const r = await requeueWithAddress({
      prospectId: requeue.data.prospectId,
      address: requeue.data.address,
      actorId: operator.id ?? null,
    });
    return r.ok
      ? NextResponse.json({ ok: true, requeued: true })
      : NextResponse.json({ error: r.error }, { status: 400 });
  }

  const reopen = reopenSchema.safeParse(body);
  if (reopen.success) {
    const ok = await reopenProspect(reopen.data.prospectId);
    return ok
      ? NextResponse.json({ ok: true, reopened: true })
      : NextResponse.json({ error: 'could not reopen' }, { status: 400 });
  }

  const mark = markSchema.safeParse(body);
  if (!mark.success) {
    return NextResponse.json(
      { error: `Send { mailingId, reason } with reason one of: ${RETURN_REASONS.join(', ')}` },
      { status: 400 },
    );
  }

  const r = await markReturned({
    mailingId: mark.data.mailingId,
    reason: mark.data.reason,
    actorId: operator.id ?? null,
    note: mark.data.note ?? null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    // The operator needs to know whether this ENDED the relationship or merely this card —
    // that is the whole decision the reason drives.
    prospectClosed: r.prospectClosed,
    resendable: r.resendable,
  });
}
