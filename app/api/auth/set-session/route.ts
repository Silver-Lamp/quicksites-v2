// app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { captureSignupIfNew } from '@/lib/analytics/funnel';
import { claimPendingGuestDraft } from '@/lib/auth/claimGuestDraft';
import { claimPendingSiteDraft } from '@/lib/auth/claimPendingSiteDraft';
import { provisionPendingAuthorSite } from '@/lib/authorSites/provisionPendingAuthorSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json().catch(() => ({}));

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'missing_tokens' }, { status: 400 });
  }

  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return store.get(name)?.value; },
        set(name: string, value: string, options: any) { store.set({ name, value, ...options }); },
        remove(name: string, options: any) { store.set({ name, value: '', ...options, maxAge: 0 }); },
      },
    }
  );

  // Set the session using the tokens from the fragment
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // Best-effort funnel: fire SIGNUP for a brand-new account (magic-link is the
  // primary signup path). Never blocks the session write.
  try { await captureSignupIfNew(data.user); } catch {}

  // If a guest handed off a draft before logging in, transfer it now (before the
  // client redirects to the editor), so they land owning their work.
  await claimPendingGuestDraft(data.user, store);
  await claimPendingSiteDraft(data.user, store);
  // Provision an HJ author storefront if an author-handoff link was armed; hand the
  // client a redirect into the new editor (the magic-link page honors `redirect`).
  const authorTemplateId = await provisionPendingAuthorSite(data.user, store);
  const redirect = authorTemplateId ? `/admin/templates/${authorTemplateId}` : undefined;

  return NextResponse.json({ ok: true, redirect }, { headers: { 'cache-control': 'no-store' } });
}
