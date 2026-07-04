// app/api/templates/[id]/claim-token/route.ts
//
// Mint a short-lived claim token so a guest's draft can follow them into an existing
// account. Called from the guest banner (still in the anonymous session) right before
// we send them to /login. We verify the caller IS the anonymous owner of this
// guest-built draft, then set an httpOnly cookie carrying the signed token — the
// post-login auth routes read it and transfer ownership. See lib/auth/claimToken.ts.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CLAIM_COOKIE, CLAIM_TTL_MS, mintClaimToken } from '@/lib/auth/claimToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  // The minting caller is the guest — an anonymous authenticated user.
  const gate = await requireUser({ allowAnonymous: true });
  if (gate instanceof NextResponse) return gate;
  const user = gate.user;

  // Only an anonymous session needs to hand its draft to a different account. A
  // real user upgrading in place keeps the same uid and auto-claims already.
  if (!user.is_anonymous) {
    return NextResponse.json({ ok: false, reason: 'not_guest' }, { status: 400 });
  }

  // Must be THIS anon user's own guest-built draft.
  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id, claim_source')
    .eq('id', id)
    .maybeSingle();
  if (error || !tpl) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });
  if (tpl.owner_id !== user.id || tpl.claim_source !== 'guest_build') {
    return NextResponse.json({ ok: false, reason: 'not_owner' }, { status: 403 });
  }

  const token = mintClaimToken(id, user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLAIM_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax', // ride the top-level nav back from the magic-link
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(CLAIM_TTL_MS / 1000),
  });
  return res;
}
