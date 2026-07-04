// lib/auth/claimGuestDraft.ts
//
// Post-login step: if the browser carries a pending claim cookie (set by the guest
// banner before we sent them to /login), transfer the guest draft it names into the
// now-authenticated account. Runs server-side in the auth routes BEFORE the redirect
// to the editor, so ownership is settled by the time the editor's owner check runs —
// no client race. Best-effort: never throws, always clears the cookie.
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CLAIM_COOKIE, verifyClaimToken } from './claimToken';

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(arg: { name: string; value: string; [k: string]: any }): void;
};

export async function claimPendingGuestDraft(
  user: User | null | undefined,
  store: CookieStore,
): Promise<void> {
  try {
    if (!user || user.is_anonymous) return;
    const token = store.get(CLAIM_COOKIE)?.value;
    if (!token) return;
    // Clear it up front so a failed/replayed attempt can't linger.
    store.set({ name: CLAIM_COOKIE, value: '', path: '/', maxAge: 0 });

    const payload = verifyClaimToken(token);
    if (!payload) return;

    // The RPC only transfers a row that's still an unclaimed guest draft owned by
    // the token's anon uid, so this is safe + idempotent.
    await supabaseAdmin.rpc('claim_guest_template', {
      p_template_id: payload.templateId,
      p_from_owner: payload.anonUid,
      p_to_owner: user.id,
    });
  } catch (e) {
    console.error('[claim] guest draft transfer failed:', (e as any)?.message || e);
  }
}
