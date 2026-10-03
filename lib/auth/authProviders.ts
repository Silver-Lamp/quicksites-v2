// lib/auth/authProviders.ts
//
// Which sign-in methods are ACTUALLY available right now, read from the one place that knows:
// Supabase's own `/auth/v1/settings` (public, anon-key, no secrets in the payload).
//
// ⚠️ This replaces a build-time flag, and the reason is the failure the flag produced. "Continue
// with Google" shipped on 2026-07-18 behind NEXT_PUBLIC_GOOGLE_AUTH_ENABLED, to be flipped once the
// provider was configured in the Supabase dashboard. Eleven weeks later neither had happened —
// and the two were independent, so the flag could be set with no provider (every click 400s with
// "Unsupported provider") or the provider enabled with no flag (a working button nobody could
// see). Reading the provider list at runtime collapses both: the moment the owner enables Google
// in Supabase, the button appears on /login and in the guest sign-up box, with no env change and
// no redeploy. NEXT_PUBLIC_GOOGLE_AUTH_ENABLED survives only as a kill switch (`0`/`false`).
//
// ⚠️ Fails CLOSED. If the settings endpoint cannot be read, Google is reported OFF — a button
// that 400s is worse than no button (the guest box's rule). Email+password is reported ON in that
// case because the form has worked without this lookup since July and must not vanish on a
// transient fetch error.
//
// Cached for five minutes via Next's fetch cache. The call is to our own Supabase project, so it
// is cheap and never a cost amplifier, but there is no reason to pay for it on every login render.

import { googleAuthKillSwitch } from '@/lib/flags/googleAuth';

export type AuthProviders = {
  /** Google OAuth is enabled on the Supabase project (and not killed by env). */
  google: boolean;
  /** Email + password / magic link. Always on for this project; reported for completeness. */
  email: boolean;
  /** Where the answer came from — `unavailable` means the lookup failed and we failed closed. */
  source: 'supabase' | 'unavailable' | 'kill_switch';
};

export const PROVIDERS_REVALIDATE_SECONDS = 300;

const CLOSED: AuthProviders = { google: false, email: true, source: 'unavailable' };

/** Pure: turn a raw settings payload into our answer. Exported for the unit test. */
export function providersFromSettings(payload: unknown, killSwitch = false): AuthProviders {
  const external = (payload as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== 'object') return CLOSED;
  const google = external.google === true;
  const email = external.email !== false;
  if (google && killSwitch) return { google: false, email, source: 'kill_switch' };
  return { google, email, source: 'supabase' };
}

/** Server-side: read the live provider list (cached). Never throws. */
export async function getEnabledAuthProviders(): Promise<AuthProviders> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return CLOSED;
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: anon },
      next: { revalidate: PROVIDERS_REVALIDATE_SECONDS },
    });
    if (!res.ok) return CLOSED;
    const json = await res.json();
    return providersFromSettings(json, googleAuthKillSwitch());
  } catch {
    return CLOSED;
  }
}
