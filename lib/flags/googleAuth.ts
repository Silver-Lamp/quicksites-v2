// lib/flags/googleAuth.ts
//
// KILL SWITCH for "Continue with Google" — not the thing that turns it on.
//
// Whether the button shows is decided by lib/auth/authProviders.ts, which reads the live provider
// list from Supabase. Until 2026-10-03 this file was a build-time ON flag
// (NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1) that had to be set in Vercel AFTER the provider was
// configured in the Supabase dashboard — two independent steps, and in eleven weeks neither
// happened. The flag could also be set with no provider behind it, giving a button that 400s on
// every click. Runtime detection removes the second step entirely; this env var now only forces
// the button OFF (`0` / `false`) if Google ever needs pulling without touching Supabase.
//
// ── To make Google live (owner; the Supabase dashboard cannot be driven headless) ────────────
//   1. Google Cloud Console → the OAuth client already used for Search Console (GOOGLE_CLIENT_ID)
//      → Authorized redirect URIs → add  https://<project-ref>.supabase.co/auth/v1/callback
//      (Supabase brokers the handshake; our app is never Google's redirect target).
//   2. Supabase → Authentication → Providers → Google: enable, paste that client id + secret.
//   3. Supabase → Authentication → URL Configuration: Site URL https://www.quicksites.ai and
//      Redirect URLs  https://quicksites.ai/**  https://www.quicksites.ai/**
//      https://*.quicksites.ai/**  http://localhost:3000/**  (+ each white-label apex).
//   4. Supabase → Authentication → Settings → "Allow manual linking" ON — the guest sign-up box
//      upgrades an anonymous builder with linkIdentity, which 400s without it.
//   5. Optional: leaked-password protection ON (password auth is a new attack surface).
//   Then GET /api/auth/providers answers {"google":true} and the buttons appear. No deploy.

export function googleAuthKillSwitch(): boolean {
  const raw = (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? '').trim().toLowerCase();
  return raw === '0' || raw === 'false' || raw === 'off';
}
