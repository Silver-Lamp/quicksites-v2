// lib/referrals/codes.ts
//
// Vanity referral codes — the operator-facing layer over `referral_codes` + `referral_signups`.
// Lets you mint a shareable code ("daniel") before the person has an account, share the link,
// let signups + commissions accrue, and finalize the owner (+ Stripe Connect) later. The money
// path is unchanged (qs_ref cookie → attributions → commission_ledger → runPayouts, which holds
// as a 'manual' record until the owner connects Stripe, then transfers). Service-role only —
// these tables are deny-default RLS; every caller is an admin/authed server route.

import { createClient } from '@supabase/supabase-js';

function admin(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

/** Public base for share links. */
export function publicBase(): string {
  return (
    process.env.QS_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.quicksites.ai'
  ).replace(/\/+$/, '');
}

/**
 * Normalize a code to a URL/attribution-safe token. Lowercase, spaces→hyphens, strip anything
 * that isn't [a-z0-9-], collapse hyphens. "Daniel!" → "daniel". Empty if nothing usable.
 */
export function normalizeCode(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

/** The commission plan shape used by the ledger/payout code. duration_months 0 = lifetime. */
export function buildPlan(ratePct: number, durationMonths: number) {
  const rate = Math.min(1, Math.max(0.01, (Number(ratePct) || 20) / 100));
  const months = Math.max(0, Math.round(Number(durationMonths) || 0));
  return { type: 'percent' as const, rate, duration_months: months };
}

export type ReferralCodeRow = {
  code: string;
  owner_type: string | null;
  owner_id: string | null;
  owner_email: string | null;
  label: string | null;
  plan: any;
  status: string;
  claimed_at: string | null;
  created_at: string | null;
};

/** Share links for a code — the front door (/?ref) and the branded invite (/join/<code>). */
export function referralLinks(code: string, base: string = publicBase()) {
  const b = base.replace(/\/+$/, '');
  return {
    ref: `${b}/?ref=${encodeURIComponent(code)}`,
    join: `${b}/join/${encodeURIComponent(code)}`,
  };
}

/**
 * Mint (or update) a vanity code with NO owner required. `ownerEmail`/`label` are just
 * metadata for "who it's for" until they claim. Reuses the standard percent plan.
 */
export async function createVanityCode(input: {
  code: string;
  label?: string;
  ownerEmail?: string;
  ratePct?: number;
  durationMonths?: number;
  createdBy?: string;
}): Promise<{ code: ReferralCodeRow } | { error: string }> {
  const code = normalizeCode(input.code);
  if (!code) return { error: 'Enter a code (letters/numbers).' };
  const db = admin();

  // Don't clobber an already-claimed code.
  const { data: existing } = await db
    .from('referral_codes')
    .select('code, claimed_at, owner_id')
    .eq('code', code)
    .maybeSingle();
  if (existing?.owner_id || existing?.claimed_at) {
    return { error: `Code "${code}" already exists and is claimed.` };
  }

  const row = {
    code,
    owner_type: 'qs_affiliate',
    owner_id: null,
    owner_email: input.ownerEmail?.trim() || null,
    label: input.label?.trim() || null,
    plan: buildPlan(input.ratePct ?? 20, input.durationMonths ?? 12),
    status: 'active',
    created_by: input.createdBy || null,
  };
  const { data, error } = await db.from('referral_codes').upsert(row).select('*').maybeSingle();
  if (error) return { error: error.message };
  return { code: data as ReferralCodeRow };
}

/** One code by its (already-normalized) value. */
export async function getCode(code: string): Promise<ReferralCodeRow | null> {
  const { data } = await admin()
    .from('referral_codes')
    .select('*')
    .eq('code', normalizeCode(code))
    .maybeSingle();
  return (data as ReferralCodeRow) ?? null;
}

/** Does a code exist + is it active? (used by the public apply-code endpoint) */
export async function codeIsUsable(code: string): Promise<boolean> {
  const c = await getCode(code);
  return !!c && c.status !== 'disabled';
}

export type CodeStats = ReferralCodeRow & {
  signups: number;
  held_cents: number; // pending + approved, not yet paid
  paid_cents: number;
  currency: string;
};

/** All codes with signup counts + held/paid balances — the admin coverage view. */
export async function listCodesWithStats(): Promise<CodeStats[]> {
  const db = admin();
  const [{ data: codes }, { data: ledger }, { data: signups }] = await Promise.all([
    db.from('referral_codes').select('*').order('created_at', { ascending: false }),
    db.from('commission_ledger').select('referral_code, amount_cents, status, currency'),
    db.from('referral_signups').select('referral_code'),
  ]);

  const held = new Map<string, { held: number; paid: number; currency: string }>();
  for (const r of (ledger as any[]) ?? []) {
    const agg = held.get(r.referral_code) || { held: 0, paid: 0, currency: r.currency || 'USD' };
    if (r.status === 'pending' || r.status === 'approved') agg.held += r.amount_cents;
    else if (r.status === 'paid') agg.paid += r.amount_cents;
    held.set(r.referral_code, agg);
  }
  const signupCount = new Map<string, number>();
  for (const s of (signups as any[]) ?? [])
    signupCount.set(s.referral_code, (signupCount.get(s.referral_code) || 0) + 1);

  return ((codes as ReferralCodeRow[]) ?? []).map((c) => {
    const h = held.get(c.code) || { held: 0, paid: 0, currency: 'USD' };
    return {
      ...c,
      signups: signupCount.get(c.code) || 0,
      held_cents: h.held,
      paid_cents: h.paid,
      currency: h.currency,
    };
  });
}

/**
 * Codes owned by a user — matched by owner_id OR (pre-claim) by owner_email == their login
 * email, so someone we minted a code FOR can see its earnings the moment they sign up, before
 * the formal claim. Returns each code with held/paid + signup counts (the earnings dashboard).
 */
export async function earningsForOwner(opts: {
  userId: string;
  email?: string | null;
}): Promise<CodeStats[]> {
  const email = (opts.email || '').trim().toLowerCase();
  const all = await listCodesWithStats();
  return all.filter(
    (c) => c.owner_id === opts.userId || (!!email && (c.owner_email || '').toLowerCase() === email)
  );
}

/** Signups (users) attributed to a code — the "who came in under daniel" list. */
export async function listSignupsForCode(code: string, limit = 200) {
  const { data } = await admin()
    .from('referral_signups')
    .select('user_id, email, source, created_at')
    .eq('referral_code', normalizeCode(code))
    .order('created_at', { ascending: false })
    .limit(limit);
  return (
    (data as {
      user_id: string;
      email: string | null;
      source: string | null;
      created_at: string;
    }[]) ?? []
  );
}

/**
 * Finalize a code to a real owner (the person signed up / connected Stripe). Sets owner_id +
 * claimed_at. From here, existing payout runs transfer the held balance to that owner's
 * connected account (or immediately at the next customer spend). Idempotent-ish: re-claiming
 * to the same owner is a no-op; refuses to move an already-claimed code to a different owner.
 */
export async function claimCode(
  code: string,
  ownerId: string
): Promise<{ code: ReferralCodeRow } | { error: string }> {
  const c = normalizeCode(code);
  if (!c || !ownerId) return { error: 'Missing code or owner.' };
  const db = admin();
  const { data: existing } = await db
    .from('referral_codes')
    .select('code, owner_id')
    .eq('code', c)
    .maybeSingle();
  if (!existing) return { error: 'Code not found.' };
  if (existing.owner_id && existing.owner_id !== ownerId)
    return { error: 'Code already claimed by another owner.' };
  const { data, error } = await db
    .from('referral_codes')
    .update({ owner_id: ownerId, owner_type: 'qs_affiliate', claimed_at: new Date().toISOString() })
    .eq('code', c)
    .select('*')
    .maybeSingle();
  if (error) return { error: error.message };
  return { code: data as ReferralCodeRow };
}

/**
 * Record a user-level signup against a code (first-touch: user_id PK, so the earliest code a
 * user arrives with is kept). Silently no-ops if the code doesn't exist (never block signup).
 */
export async function recordSignup(input: {
  userId: string;
  code: string;
  email?: string | null;
  source?: string;
}): Promise<void> {
  const code = normalizeCode(input.code);
  if (!input.userId || !code) return;
  const db = admin();
  if (!(await codeIsUsable(code))) return;
  // Ignore-on-conflict: keep first touch.
  await db
    .from('referral_signups')
    .upsert(
      {
        user_id: input.userId,
        referral_code: code,
        email: input.email || null,
        source: input.source || 'ref_cookie',
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
}
