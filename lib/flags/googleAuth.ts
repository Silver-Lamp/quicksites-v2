// lib/flags/googleAuth.ts
//
// Feature flag for "Continue with Google" on the login page.
//
// Env-gated (default OFF) because the button is useless — and confusing — until the
// Google provider is configured in the Supabase dashboard. Email + password does NOT
// need this flag (Supabase enables the email/password provider by default); only the
// Google OAuth button is gated.
//
// PREREQUISITES to enable in an environment:
//   1. In Supabase → Authentication → Providers → Google: set the Google OAuth client
//      id + secret (from a Google Cloud OAuth consent screen / credentials).
//   2. In Supabase → Authentication → URL Configuration → Redirect URLs: allowlist the
//      app hosts, e.g. https://quicksites.ai/**, https://*.quicksites.ai/**, and (for
//      dev) http://localhost:3000/**. Google's own "Authorized redirect URI" is the
//      SUPABASE callback (https://<project>.supabase.co/auth/v1/callback), NOT our app —
//      Supabase brokers the handshake and then redirects to our allowlisted redirectTo.
//   3. Custom / white-label branded domains each need adding to the Supabase Redirect
//      URLs allowlist (wildcards cover the platform hosts; branded apexes do not).
//
// To turn on: set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1 (build-time; inlined on the client).
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

export function googleAuthEnabled(): boolean {
  return GOOGLE_AUTH_ENABLED;
}
