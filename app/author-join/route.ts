// app/author-join/route.ts
//
// The QS join URL HiveJournal links an author to: /author-join?ht=<handoff-token>.
// Verify the signed handoff token (minted by HJ with the shared AUTHOR_HANDOFF_SECRET),
// drop the pending-provision cookie, and send the author to sign up. The site itself
// is provisioned post-login in provisionPendingAuthorSite (auth callback / set-session),
// so the author lands in the editor of their new reseller-branded storefront.
//
// The token is the grant — a bearer link, exactly like the operator site-claim link.
// Provisioning is idempotent per (org, work_id), so opening it twice is safe.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyAuthorHandoffToken,
  AUTHOR_HANDOFF_COOKIE,
  AUTHOR_HANDOFF_TTL_MS,
} from '@/lib/authorSites/handoffToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('ht') || '';
  const payload = verifyAuthorHandoffToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login?error=author_handoff_invalid', url.origin));
  }

  const store = await cookies();
  store.set({
    name: AUTHOR_HANDOFF_COOKIE,
    value: token,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(AUTHOR_HANDOFF_TTL_MS / 1000),
  });

  // Land in the admin after provisioning; the callback redirects to the new editor
  // when it knows the fresh template id.
  const next = '/admin/templates';
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
}
