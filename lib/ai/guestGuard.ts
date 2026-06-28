// lib/ai/guestGuard.ts
//
// Per-guest cap on AI generation. Anonymous (guest) users may run a small number
// of AI calls per session before being asked to sign up; signed-in real users are
// not limited here (normal metering/rate-limits still apply).
//
// Counting is keyed on the anonymous user's id in `guest_token_usage` (lifetime =
// per-session, since anon users are ephemeral). Uses the service-role client so
// the count/insert aren't subject to RLS.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { User } from '@supabase/supabase-js';

export const GUEST_AI_LIMIT = Number(process.env.GUEST_AI_CALL_LIMIT ?? '8') || 8;

export const GUEST_LIMIT_MESSAGE =
  'You’ve reached the free guest limit — sign up to keep generating with AI.';

export type GuestGuardResult =
  | { ok: true; remaining: number | null }
  | { ok: false; limit: number };

/**
 * Enforce (and record) the guest AI cap.
 * - Real / absent users: always { ok: true } (no-op).
 * - Guests at/over the cap: { ok: false, limit }.
 * - Guests under the cap: records the use and returns { ok: true, remaining }.
 */
export async function enforceGuestAiLimit(
  user: Pick<User, 'id' | 'is_anonymous'> | null | undefined,
  action: string,
): Promise<GuestGuardResult> {
  if (!user || !user.is_anonymous) return { ok: true, remaining: null };

  const { count } = await supabaseAdmin
    .from('guest_token_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('action', 'ai:%');

  const used = count ?? 0;
  if (used >= GUEST_AI_LIMIT) return { ok: false, limit: GUEST_AI_LIMIT };

  // Record this use up-front (so repeated failing calls still count against the
  // cap). Best-effort — never block generation on a logging failure.
  await supabaseAdmin
    .from('guest_token_usage')
    .insert({ user_id: user.id, action: `ai:${action}` })
    .then(undefined, () => {});

  return { ok: true, remaining: Math.max(0, GUEST_AI_LIMIT - used - 1) };
}

/** Standard JSON body for a guest-limit rejection (status 429). */
export function guestLimitBody(limit: number) {
  return { error: GUEST_LIMIT_MESSAGE, code: 'guest_limit', limit };
}
