// app/api/admin/agreements/notify/route.ts
//
// Send (or re-send) the "this was signed" notices for one agreement, from the ledger.
//
// ⚠️ THIS EXISTS BECAUSE THE SEND CANNOT BE DONE FROM A LAPTOP. The backfill script works, but
// a local environment has no valid Resend key — the first real attempt failed with
// "API key is invalid", which is a config fact about the developer's machine and not about the
// product. The notice has to be sent from the environment that actually has a mailer, so the
// operator triggers it from the deployed app.
//
// Admin-gated: an endpoint that emails a named third party on demand is not something a visitor,
// or a logged-in customer, gets to call.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getAgreement, getSignature } from '@/lib/agreements/store';
import { notifySigned } from '@/lib/agreements/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const agreementId = String(body?.agreementId ?? '');
  if (!agreementId) return NextResponse.json({ error: 'agreementId required' }, { status: 400 });

  const agreement = await getAgreement(agreementId);
  if (!agreement) return NextResponse.json({ error: 'No such agreement' }, { status: 404 });

  const signature = await getSignature(agreementId);
  if (!signature) {
    // Not an error state worth dressing up: there is nothing to notify anyone about.
    return NextResponse.json(
      { error: 'That agreement has not been signed yet.' },
      { status: 409 },
    );
  }

  const result = await notifySigned(agreement, signature);

  // ⚠️ The failure reason is returned verbatim rather than replaced with a friendly message. The
  // audience is an operator deciding what to do next, and "API key is invalid" is actionable in a
  // way that "couldn't send" is not.
  return NextResponse.json(
    result.ok ? { ok: true } : { ok: false, error: result.error },
    { status: result.ok ? 200 : 502 },
  );
}
