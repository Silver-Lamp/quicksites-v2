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
import { CLAIM_VERIFY_GRANT_COOKIE, verifyVerifyGrant } from './claimVerify';
import { CLAIM_VERIFICATION_ENABLED } from '@/lib/flags/claimVerification';

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(arg: { name: string; value: string; [k: string]: any }): void;
};

/**
 * When verification is enabled, ownership only transfers if the claimer proved control
 * of the business: either THIS browser passed the OTP (a valid verify-grant cookie) or
 * an operator manually verified the draft (a `channel='manual'` verified row). Returns
 * true when the gate is satisfied (or disabled). Also consumes the SMS verification row.
 */
async function verificationSatisfied(
  templateId: string,
  grant: string | undefined
): Promise<boolean> {
  if (!CLAIM_VERIFICATION_ENABLED) return true;

  // claim_verifications isn't in types/supabase.ts yet → use the client untyped.
  const db = supabaseAdmin as any;
  const consume = async (rowId: string) =>
    db
      .from('claim_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', rowId);

  if (verifyVerifyGrant(grant, templateId)) {
    // Mark the freshest verified SMS row consumed (audit; best-effort).
    const { data } = await db
      .from('claim_verifications')
      .select('id')
      .eq('template_id', templateId)
      .not('verified_at', 'is', null)
      .is('consumed_at', null)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) await consume(data.id);
    return true;
  }

  // Operator manual override: an admin-verified row makes the draft claimable with no
  // browser grant (covers no-phone / wrong-number fallbacks).
  const { data: manual } = await db
    .from('claim_verifications')
    .select('id')
    .eq('template_id', templateId)
    .eq('channel', 'manual')
    .not('verified_at', 'is', null)
    .is('consumed_at', null)
    .limit(1)
    .maybeSingle();
  if (manual?.id) {
    await consume(manual.id);
    return true;
  }

  return false;
}

export async function claimPendingSiteDraft(
  user: User | null | undefined,
  store: CookieStore
): Promise<void> {
  try {
    if (!user || user.is_anonymous) return;
    const token = store.get(SITE_CLAIM_COOKIE)?.value;
    if (!token) return;
    store.set({ name: SITE_CLAIM_COOKIE, value: '', path: '/', maxAge: 0 });

    const grant = store.get(CLAIM_VERIFY_GRANT_COOKIE)?.value;
    // Grant is single-use; clear it whether or not it's valid.
    if (grant) store.set({ name: CLAIM_VERIFY_GRANT_COOKIE, value: '', path: '/', maxAge: 0 });

    const payload = verifySiteClaimToken(token);
    if (!payload) return;

    // Gate: don't transfer an unverified claim when verification is enabled.
    if (!(await verificationSatisfied(payload.templateId, grant))) return;

    // The RPC only transfers a row that's still an unclaimed listing_import draft, so
    // this is safe + idempotent (a leaked link no-ops after the first claim).
    await supabaseAdmin.rpc('claim_operator_draft', {
      p_template_id: payload.templateId,
      p_to_owner: user.id,
    });

    // If this draft is part of a restaurant domain-competition, first-claim wins the apex.
    // Best-effort + idempotent (no-op when it isn't a competition or one's already decided).
    try {
      const { awardCompetitionOnClaim } = await import('@/lib/outreach/restaurantCompetition');
      await awardCompetitionOnClaim(payload.templateId);
    } catch (e) {
      console.error('[claim] competition award failed:', (e as any)?.message || e);
    }
  } catch (e) {
    console.error('[claim] site draft transfer failed:', (e as any)?.message || e);
  }
}
