// lib/auth/browserSession.ts
//
// Bridge a CLIENT-side Supabase session (from password sign-in / sign-up, or a recovered
// password reset) into SERVER cookies. The app is SSR: middleware + server components read
// the session from cookies via @supabase/ssr, so a browser-only session isn't enough — we
// must POST the tokens to /api/auth/set-session, which sets the cookies AND runs the shared
// post-login work (funnel signup, referral attribution, guest/outreach draft claim, author
// provisioning). This is the SAME finalize endpoint the magic-link fragment flow uses, so
// password + OAuth land guest-build claims exactly like magic links do.

import type { SupabaseClient } from '@supabase/supabase-js';

export type FinalizeResult = { ok: true; redirect?: string } | { ok: false; error: string };

/**
 * Read the current browser session and hand its tokens to the server so it can set cookies.
 * Returns the server's optional redirect (e.g. into a freshly-provisioned author editor).
 */
export async function finalizeBrowserSession(sb: SupabaseClient): Promise<FinalizeResult> {
  const { data, error } = await sb.auth.getSession();
  if (error) return { ok: false, error: error.message };
  const session = data.session;
  if (!session?.access_token || !session?.refresh_token) {
    return { ok: false, error: 'no_session' };
  }
  try {
    const res = await fetch('/api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
    });
    const j = await res.json().catch(() => ({}) as any);
    if (!res.ok || j?.ok === false) return { ok: false, error: j?.error || 'cookie_set_failed' };
    return { ok: true, redirect: typeof j?.redirect === 'string' ? j.redirect : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network_error' };
  }
}
