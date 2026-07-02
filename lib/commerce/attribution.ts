import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Bind a just-created merchant to the partner referral code carried in the
 * `qs_ref` cookie (set by middleware from a `/join/<code>` → `?ref=` click), so
 * the partner's residual commissions accrue on that merchant's orders.
 *
 * Must use the SERVICE-ROLE client: `attributions` is RLS deny-default (RLS on,
 * no policies), so a normal user-scoped client is silently rejected — which is
 * exactly how this used to fail closed, recording no attribution and paying the
 * partner nothing while the green-path demos (which insert attributions with the
 * service role directly) still passed. markOrderPaid reads attributions with the
 * service role too, so the read/write sides now match.
 */
export async function ensureAttributionForMerchant(merchantId: string) {
  const ref = (await cookies()).get('qs_ref')?.value;
  if (!ref) return;
  const supabase = await getServerSupabase({ serviceRole: true });

  const { data: existing } = await supabase
    .from('attributions')
    .select('merchant_id, locked_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (existing?.locked_at) return; // already locked by first revenue — never rebind

  const { error } = existing
    ? await supabase.from('attributions').update({ referral_code: ref }).eq('merchant_id', merchantId)
    : await supabase.from('attributions').insert({ merchant_id: merchantId, referral_code: ref });

  // Don't throw (attribution must never block checkout/merchant creation), but do
  // surface failures — a silent miss here means an unpaid partner.
  if (error) {
    console.warn(`ensureAttributionForMerchant failed for merchant ${merchantId}, ref ${ref}:`, error.message);
  }
}
