// lib/analytics/funnel.ts
//
// Small server-side helpers for the Model A money funnel (docs/MODEL_A_PLAN.md):
//   signup → builder_activated → site_published → merchant_connected
//          → catalog_item_created → order_created → order_paid → platform_fee_collected
//
// The money-path steps are emitted from lib/commerce/* at their authoritative
// transitions. This module holds the acquisition step that isn't tied to a
// single write: SIGNUP, which we can only infer at session-establishment time.
import { captureServer } from './posthog-server';
import { EVENTS } from './events';

// How fresh a user must be, at first session establishment, to count as a signup
// (vs. a returning login). Magic-link OTP creates the user and signs them in in
// the same request, so a genuine signup is only seconds old here.
const SIGNUP_FRESHNESS_MS = 2 * 60 * 1000;

/**
 * Emit SIGNUP the first time we see a user, best-effort. Both auth-landing paths
 * (OAuth code exchange + magic-link set-session) share the login flow, so we
 * distinguish a new account by how recently it was created. Safe to call on
 * every login; only fires for brand-new users and no-ops without PostHog config.
 */
export async function captureSignupIfNew(
  user: { id: string; created_at?: string | null } | null | undefined
): Promise<void> {
  if (!user?.id || !user.created_at) return;
  const createdMs = new Date(user.created_at).getTime();
  if (!Number.isFinite(createdMs)) return;
  if (Date.now() - createdMs > SIGNUP_FRESHNESS_MS) return; // returning login, not a signup
  await captureServer(EVENTS.SIGNUP, { user_id: user.id }, user.id);
}
