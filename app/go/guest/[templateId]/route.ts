// app/go/guest/[templateId]/route.ts
//
// Tracked link for a GUEST-BUILT draft — the apology postcard's QR. A guest session's own claim
// token lasts 30 minutes and is minted from inside that session, so a printed QR cannot carry
// it. This route does the minting server-side, days later, on any device: it reads the draft's
// anonymous owner, sets the same `qs_pending_claim` cookie the banner would have set, and sends
// the visitor to sign up with their editor as the return path — after which
// claimPendingGuestDraft transfers the site (the RPC only moves a row still owned by that anon
// uid, so a second scan, or a stranger's scan after the owner claimed, moves nothing).
//
// Once the site has an owner with an email the same link goes to the site itself: a card lands
// a week after it was mailed, and the person may have signed up from a different device.
// The visit is counted as a PostHog event (no schema for guest-card visits yet).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CLAIM_COOKIE, CLAIM_TTL_MS, mintClaimToken } from '@/lib/auth/claimToken';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  const base = tradeSiteBaseUrl();
  const { data: t } = await (supabaseAdmin as any)
    .from('templates')
    .select('id, slug, custom_domain, claim_source, owner_id')
    .eq('id', templateId)
    .maybeSingle();
  if (!t || t.claim_source !== 'guest_build' || !t.owner_id) return NextResponse.redirect(base, 302);

  try { await captureServer(EVENTS.GUEST_CARD_LINK_VISITED, { template_id: t.id }, `guest-card:${t.id}`); } catch { /* advisory */ }

  const { data: owner } = await (supabaseAdmin as any).auth.admin.getUserById(t.owner_id);
  const stillGuest = !!owner?.user?.is_anonymous;
  if (!stillGuest) {
    return NextResponse.redirect(publicSiteUrl({ custom_domain: t.custom_domain, slug: t.slug }) ?? base, 302);
  }

  const next = `/admin/templates/${t.id}`;
  const res = NextResponse.redirect(`${base}/login?next=${encodeURIComponent(next)}&guest=1`, 302);
  res.cookies.set(CLAIM_COOKIE, mintClaimToken(t.id, t.owner_id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(CLAIM_TTL_MS / 1000),
  });
  return res;
}
