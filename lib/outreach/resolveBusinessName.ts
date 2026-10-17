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

  // ⚠️ Narrowed SERVER-SIDE on the last seven digits. This used to fetch "all rows, limit 5000"
  // and compare in JS — but PostgREST caps any response at its `max_rows` (1,000 on Supabase by
  // default), so with 1,429 phoned prospects the scan silently saw the first thousand. On
  // 2026-10-16 two freshly provisioned lines (Lynn, Paterson) resolved to NO name while their
  // prospects sat past row 1,000, and callers would have heard "a local towing company serving
  // Lynn". `.limit(5000)` was not a cap; it was a wish. Phones are stored as typed —
  // "(781) 500-2083" or "+17815002083" — so both spellings of the tail are matched, and the exact
  // last-ten compare below still decides.
  const tail7 = key.slice(-7);
  const dashed = `${tail7.slice(0, 3)}-${tail7.slice(3)}`;
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('business_name, phone')
    .not('phone', 'is', null)
    .or(`phone.ilike.%${dashed},phone.ilike.%${tail7}`)
    .limit(200);
  if (error || !Array.isArray(data)) return null;

  for (const row of data as Array<{ business_name: string | null; phone: string | null }>) {
    if (last10(row.phone) === key) {
      const name = (row.business_name ?? '').trim();
      if (name) return name;
    }
  }
  return null;
}
