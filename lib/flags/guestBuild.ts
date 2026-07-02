// lib/flags/guestBuild.ts
//
// Feature flag for the "guest build → sign up to publish" flow.
//
// Env-gated (default OFF) so it can only run where the prerequisites are met.
// Until flipped on, the homepage hero keeps its previous behavior and no anonymous
// Supabase sessions are minted.
//
// PREREQUISITES to enable in an environment:
//   1. Enable "Allow anonymous sign-ins" in the Supabase project settings.
//      (Manual dashboard step — the client mints sessions via signInAnonymously.)
//   2. [DONE] Anonymous users are confined to the template editor: middleware.ts
//      redirects them away from the broader /admin surface, and publishing is
//      blocked for anonymous users (app/api/templates/[id]/publish → needs_signup).
//   3. [DONE] Abuse guards live: per-guest AI call cap (enforceGuestAiLimit),
//      per-IP guest-draft rate limit (GUEST_DRAFT_HOURLY_LIMIT_PER_IP), the dollar
//      budget guard (meterLLMCall), and the ai-cost-alert cron (email + Sentry).
//
// To turn on: set NEXT_PUBLIC_GUEST_BUILD_ENABLED=1 (build-time; client + server).
//
// Same env var is read on client and server (NEXT_PUBLIC_ is inlined at build time).
export const GUEST_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_GUEST_BUILD_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_GUEST_BUILD_ENABLED === 'true';

export function guestBuildEnabled(): boolean {
  return GUEST_BUILD_ENABLED;
}
