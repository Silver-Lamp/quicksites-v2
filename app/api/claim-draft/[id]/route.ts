// app/api/claim-draft/[id]/route.ts
//
// Arm an operator-draft claim: verify the site-claim token binds this template id,
// drop the pending-claim cookie, and send the prospect to sign up. The transfer
// itself happens post-login in claimPendingSiteDraft (auth callback / set-session).
// The token is the grant — public by design (whoever opens the link claims it once).
import { signInHref } from '@/lib/auth/authLinks';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySiteClaimToken, SITE_CLAIM_COOKIE, SITE_CLAIM_TTL_MS } from '@/lib/auth/siteClaimToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const payload = verifySiteClaimToken(token);
  if (!payload || payload.templateId !== params.id) {
    return NextResponse.redirect(new URL(`/claim-site/${params.id}?invalid=1`, url.origin));
  }

  const store = await cookies();
  store.set({
    name: SITE_CLAIM_COOKIE,
    value: token,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SITE_CLAIM_TTL_MS / 1000),
  });

  // Land on the post-claim welcome (shows the demand we captured) rather than straight
  // into the editor; it forwards to the editor.
  const next = `/welcome/${params.id}`;
  return NextResponse.redirect(new URL(signInHref(next), url.origin));
}
