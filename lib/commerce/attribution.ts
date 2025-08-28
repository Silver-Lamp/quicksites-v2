import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';

export async function ensureAttributionForMerchant(merchantId: string) {
  const ref = (await cookies()).get('qs_ref')?.value;
  if (!ref) return;
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase.from('attributions').select('merchant_id, locked_at').eq('merchant_id', merchantId).maybeSingle();
  if (existing?.locked_at) return; // already locked by first revenue

  if (!existing) {
    await supabase.from('attributions').insert({ merchant_id: merchantId, referral_code: ref });
  } else {
    await supabase.from('attributions').update({ referral_code: ref }).eq('merchant_id', merchantId);
  }
}
