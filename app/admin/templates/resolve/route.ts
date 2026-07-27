// app/admin/templates/resolve/route.ts
//
// "Open this site in the editor" — from a tenant host, where we cannot know who you are.
//
// The problem this solves: auth cookies here are HOST-ONLY (no cookie-domain is configured),
// so a session established on www.quicksites.ai is NOT sent to starter-restaurant.delivered.menu,
// a custom domain, or even <slug>.quicksites.ai. A public site page therefore cannot tell an
// admin from a stranger, and cannot render an admin-only control based on the request.
//
// So the tenant page links HERE instead of linking straight at the editor. This route runs on
// the canonical host, where the session DOES exist:
//
//   1. resolve slug -> template id   (public info: the slug is already in the URL)
//   2. require an admin session      (enforced on our domain, where the cookie lives)
//   3. redirect into the editor
//
// The consequence that matters: the tenant page never has to embed a template id to make the
// link work, so the affordance leaks nothing to a stranger who trips over it — they just get
// bounced to login and then a 403.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
  const host = (url.searchParams.get('host') || '').trim().toLowerCase();

  const admin = await getAdminUser();
  if (!admin) {
    // Send them to login and come back here, so the round trip completes in one click.
    const back = `/admin/templates/resolve?slug=${encodeURIComponent(slug)}&host=${encodeURIComponent(host)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, url.origin));
  }

  if (!slug && !host) {
    return NextResponse.redirect(new URL('/admin/templates', url.origin));
  }

  // Match on slug first (what the tenant page always knows), then custom domain as a fallback
  // for hosts whose slug isn't in the path.
  let q = supabaseAdmin.from('templates').select('id, slug').limit(1);
  q = slug ? q.eq('slug', slug) : q.eq('custom_domain', host.replace(/^www\./, ''));
  const { data } = await q.maybeSingle();

  if (!data?.id) {
    // No match — land on the list with the term prefilled rather than a dead end.
    return NextResponse.redirect(
      new URL(`/admin/templates?q=${encodeURIComponent(slug || host)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(`/admin/templates/${data.id}`, url.origin));
}
