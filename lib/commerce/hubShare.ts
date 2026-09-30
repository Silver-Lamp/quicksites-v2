// lib/commerce/hubShare.ts
//
// What rate is ACTUALLY configured for the person above a given code.
//
// ⚠️ THIS EXISTS SO A PAGE CANNOT BE WRONG ABOUT SOMEBODY'S PAY. `/for-amy` told her for months
// that her commerce rate was "not set" — true when written, and quietly false from 2026-09-30.
// A page that states a person's compensation from a constant is a claim with an expiry date on
// it and no alarm attached, which is the same failure class as a count nobody re-derives.
//
// ⚠️ Returns null rather than 0 when the code is missing. Zero is a rate somebody chose; null is
// "there is no row", and a page that renders "0%" for a missing code tells a partner they earn
// nothing when the truth is that nobody has set it up yet. Different sentences, different fixes.
//
// ⚠️ The share is stored on the CHILD — `referral_codes.override_share` on code X is what X's
// PARENT earns when X sells. So asking "what does Amy get" means reading Daryle's row, which is
// counter-intuitive enough that every caller should go through a named function rather than
// working it out at the call site.
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function hubShareFor(downlineCode: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .select('parent_code, override_share')
    .eq('code', downlineCode)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { parent_code: string | null; override_share: number | null };
  // No parent means nobody is above this code, so there is no override to report — distinct
  // from a parent configured at zero.
  if (!row.parent_code) return null;
  const share = Number(row.override_share);
  return Number.isFinite(share) ? share : null;
}
