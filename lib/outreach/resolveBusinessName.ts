// lib/outreach/resolveBusinessName.ts
//
// Resolve a phone number to the registered business name we already hold for it, so the caller
// on a geo tracking number can be told WHO is about to answer (lib/ppl/forwardAnnounce.ts).
//
// ⚠️ MATCH ON THE LAST TEN DIGITS, NOT ON THE STRIPPED STRING. `forward_to` is E.164
// (`+12534425373` → 11 digits) while `outreach_prospects.phone` is however the directory gave it
// (`(253) 442-5373` → 10). Comparing full digit strings returns ZERO matches for every row, which
// reads exactly like "we have no names for these businesses" — the first version of this query
// said so about a table where 10 of 11 resolve.

import { supabaseAdmin } from '@/lib/supabase/admin';

/** Last ten digits, the only part two formats of a NANP number reliably share. */
export function last10(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * The business name we hold for this number, or null. Never guesses: an unresolved number must
 * stay unresolved, because the announcement's fallback ("a local towing company") is true while
 * a guessed name is a claim about who the caller is speaking to.
 */
export async function resolveBusinessNameByPhone(phone: string): Promise<string | null> {
  const key = last10(phone);
  if (!key) return null;

  // No index can serve a suffix match, but this table is small (~1.2k rows) and this runs when an
  // operator picks a destination, never on the call path — so a scan is the right trade here.
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('business_name, phone')
    .not('phone', 'is', null)
    .limit(5000);
  if (error || !Array.isArray(data)) return null;

  for (const row of data as Array<{ business_name: string | null; phone: string | null }>) {
    if (last10(row.phone) === key) {
      const name = (row.business_name ?? '').trim();
      if (name) return name;
    }
  }
  return null;
}
