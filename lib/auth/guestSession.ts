// lib/auth/guestSession.ts
'use client';

import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * True if the given user is a Supabase ANONYMOUS user (guest).
 * Anonymous users are real auth users (they have a uid and a session) but no
 * email/identity. They get upgraded in place — keeping the same uid — when they
 * sign up, which is what makes the guest-build draft auto-claim on signup.
 */
export function isGuestUser(user: Pick<User, 'is_anonymous'> | null | undefined): boolean {
  return !!user?.is_anonymous;
}

export type EnsureGuestResult =
  | { user: User; created: boolean }
  | { user: null; created: false; error: string };

/**
 * Ensure there is a Supabase session, minting an anonymous one if needed.
 *
 * - If a session already exists (guest or real), returns that user untouched.
 * - Otherwise calls signInAnonymously() and returns the new anonymous user.
 *
 * Returns an error result (rather than throwing) if anonymous sign-ins are
 * disabled in the project or the call fails, so callers can fall back to /login.
 */
export async function ensureGuestSession(): Promise<EnsureGuestResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return { user: session.user, created: false };
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      return {
        user: null,
        created: false,
        error: error?.message ?? 'Could not start a guest session',
      };
    }
    return { user: data.user, created: true };
  } catch (e: any) {
    return { user: null, created: false, error: e?.message ?? 'Guest session failed' };
  }
}
