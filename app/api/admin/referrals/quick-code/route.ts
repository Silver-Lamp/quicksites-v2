// app/api/admin/referrals/quick-code/route.ts
//
// Mint a vanity referral code without needing the owner to exist yet — the "just make a code
// 'daniel'" path. Admin-gated. The person claims it (owner + Stripe Connect) later; commissions
// accrue in the meantime and transfer on claim (or at spend, if already connected). See the
// referral-codes feature.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { createVanityCode, referralLinks } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const lifetime = body?.lifetime === true || Number(body?.durationMonths) === 0;
  const res = await createVanityCode({
    code: String(body?.code ?? ''),
    label: typeof body?.label === 'string' ? body.label : undefined,
    ownerEmail: typeof body?.ownerEmail === 'string' ? body.ownerEmail : undefined,
    ratePct: Number.isFinite(Number(body?.ratePct)) ? Number(body.ratePct) : 20,
    durationMonths: lifetime
      ? 0
      : Number.isFinite(Number(body?.durationMonths))
        ? Number(body.durationMonths)
        : 12,
    createdBy: admin.user.id,
  });
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(
    { ok: true, code: res.code, links: referralLinks(res.code.code) },
    { status: 201 }
  );
}
