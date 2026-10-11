// lib/rep/memberCode.ts
//
// A signed-in member IS a rep: "reps are CODES" (rental splits), so building from /for-sales
// while signed in needs a code of their own, or the links they hand out carry no attribution
// and they are never paid. Find the member's active code, or mint one from their email and
// claim it to them. Deterministic per user; a second call returns the same code.
//
// ⚠️ Never a code the member typed — a chosen code can collide with, or impersonate, another
// rep's. The base is the email's local part, suffixed on collision.
import { createClient } from '@supabase/supabase-js';
import { claimCode, createVanityCode, normalizeCode } from '@/lib/referrals/codes';

function admin(): any {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });
}

/**
 * The plan a self-minted member code carries (owner, 2026-10-11, choosing "earn for life" over
 * "earn for a year"): the referral default rate, for the LIFE of the account — duration 0 is
 * lifetime in buildPlan, and matches what the ledger already does (no code enforces a month
 * limit). The public page reads its "how you're paid" line from this, never a typed number.
 */
export const MEMBER_REFERRAL_PLAN = { ratePct: 20, durationMonths: 0 } as const;

/** Pure: the code base a member's email yields ("sandon+tester2@x" → "sandon"). */
export function codeBaseFor(email: string | null | undefined, userId: string): string {
  const local = String(email || '').split('@')[0].split('+')[0];
  const base = normalizeCode(local);
  return base.length >= 3 ? base : `rep-${userId.slice(0, 8)}`;
}

export async function codeForMember(input: { userId: string; email: string | null | undefined }): Promise<string | null> {
  const db = admin();
  const { data: mine } = await db.from('referral_codes').select('code, status').eq('owner_id', input.userId).neq('status', 'disabled').order('created_at', { ascending: true }).limit(1);
  if (mine?.[0]?.code) return mine[0].code as string;
  const base = codeBaseFor(input.email, input.userId);
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 5)}`;
    const made = await createVanityCode({ code: candidate, label: 'member (self-serve, /spread-the-word)', ownerEmail: input.email ?? undefined, createdBy: input.userId, ratePct: MEMBER_REFERRAL_PLAN.ratePct, durationMonths: MEMBER_REFERRAL_PLAN.durationMonths });
    if ('error' in made) continue; // taken — try a suffix
    const claimed = await claimCode(candidate, input.userId);
    if ('error' in claimed) continue;
    return candidate;
  }
  return null;
}
