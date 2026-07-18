// app/api/admin/referrals/claim/route.ts
//
// Finalize a vanity code to a real owner — the "Daniel signed up + connected Stripe" step.
// Links the code to a user (by user id, or resolved from an email that has an account). After
// this, existing payout runs transfer the held balance to that owner's connected account. The
// actual money transfer stays in the payout wizard (a surfaced admin action) — this only sets
// ownership. Admin-gated.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { claimCode } from '@/lib/referrals/codes';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve a login email to its auth user id (best-effort; null if no account yet). */
async function userIdForEmail(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  // user_profiles mirrors auth emails and is queryable with the service role.
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, email')
    .ilike('email', e)
    .maybeSingle();
  return (data as any)?.user_id ?? null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const code = typeof body?.code === 'string' ? body.code : '';
  let ownerId = typeof body?.ownerId === 'string' ? body.ownerId.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!ownerId && email) {
    const resolved = await userIdForEmail(email);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `No account found for ${email}. They need to sign up first (they can still use the code now).`,
        },
        { status: 404 }
      );
    }
    ownerId = resolved;
  }
  if (!ownerId)
    return NextResponse.json(
      { error: 'Provide the owner’s user id or account email.' },
      { status: 400 }
    );

  const res = await claimCode(code, ownerId);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: res.code });
}
