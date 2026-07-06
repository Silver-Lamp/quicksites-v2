// lib/auth/claimPendingSiteDraft.ts
//
// Post-login step for the CedarSites outreach flow: if the browser carries a pending
// SITE-claim cookie (set when the prospect opened their claim link), transfer the
// operator-assembled draft it names into the now-authenticated account. Mirrors
// claimPendingGuestDraft but uses the site-claim token + claim_operator_draft RPC.
// Best-effort: never throws, always clears the cookie. Unlike the guest path, this
// applies to any real user (the prospect signs up fresh, not an anon upgrade).
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SITE_CLAIM_COOKIE, verifySiteClaimToken } from './siteClaimToken';

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(arg: { name: string; value: string; [k: string]: any }): void;
};

export async function claimPendingSiteDraft(
  user: User | null | undefined,
  store: CookieStore,
): Promise<void> {
  try {
    if (!user || user.is_anonymous) return;
    const token = store.get(SITE_CLAIM_COOKIE)?.value;
    if (!token) return;
    store.set({ name: SITE_CLAIM_COOKIE, value: '', path: '/', maxAge: 0 });

    const payload = verifySiteClaimToken(token);
    if (!payload) return;

    // The RPC only transfers a row that's still an unclaimed listing_import draft, so
    // this is safe + idempotent (a leaked link no-ops after the first claim).
    await supabaseAdmin.rpc('claim_operator_draft', {
      p_template_id: payload.templateId,
      p_to_owner: user.id,
    });
  } catch (e) {
    console.error('[claim] site draft transfer failed:', (e as any)?.message || e);
  }
}
