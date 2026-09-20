// app/api/leads/dispute/route.ts — a business contests one charge from its statement page.
// Token-authenticated (the statement link), rate-limited per IP, window + ownership checked in
// lib/ppl/disputes. Emails the operator so a human listens to the recording and decides.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { verifyStatementToken } from '@/lib/ppl/statementToken';
import { getPplAccount } from '@/lib/ppl/accounts';
import { openDispute, DISPUTE_CATEGORIES } from '@/lib/ppl/disputes';
import { sendEmail } from '@/lib/email';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  token: z.string().min(10),
  ledgerId: z.string().uuid(),
  category: z.string().min(2).max(8),
  explanation: z.string().min(10).max(2000),
});

export async function POST(req: Request) {
  const limited = await rateLimitOr429(req, 'ppl-dispute', 10, 3600);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const v = verifyStatementToken(parsed.data.token);
  if (!v) return NextResponse.json({ error: 'invalid or expired link' }, { status: 403 });
  const account = await getPplAccount(v.accountId);
  if (!account || account.status === 'closed')
    return NextResponse.json({ error: 'account not found' }, { status: 404 });

  const r = await openDispute({
    account,
    ledgerId: parsed.data.ledgerId,
    category: parsed.data.category,
    explanation: parsed.data.explanation,
  });
  if (!r.ok) {
    const msg: Record<string, string> = {
      not_a_charge: 'That entry is not a charge.',
      wrong_account: 'That charge is not on this account.',
      window_closed: 'The 72-hour window for this charge has closed.',
      already_disputed: 'This charge has already been contested.',
      bad_category: 'Pick a reason from the list.',
    };
    return NextResponse.json({ error: msg[r.reason] ?? r.reason }, { status: 409 });
  }

  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (admins.length) {
    await sendEmail({
      to: admins[0],
      subject: `PPL dispute: ${account.business_name} — ${DISPUTE_CATEGORIES[parsed.data.category] ?? parsed.data.category}`,
      html: `<p><strong>${account.business_name}</strong> contested a charge (${parsed.data.category}).</p><p>${parsed.data.explanation.replace(/</g, '&lt;')}</p><p><a href="${publicBaseUrl()}/admin/ppl">Decide on /admin/ppl</a></p>`,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, disputeId: r.dispute.id });
}
