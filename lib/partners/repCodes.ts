// lib/partners/repCodes.ts
//
// Partner-managed sales reps (owner, 2026-10-13: "build out what Daniel needs to manage his side
// and his rep(s)"). A partner mints a code for a rep from /partners/dashboard; the rep gets an
// unlisted page at /for/<code> (the dynamic version of the hand-built /for-abdou) with the live
// restaurants table and the build/text buttons, under the partner's brand.
//
// ⚠️ THE REP'S CODE IS OWNED BY THE PARTNER, NOT THE REP (owner's choice, 2026-10-13). Every order
// the rep brings is recorded against the rep's code and lands on the PARTNER's ledger; the
// partner pays the rep on their own terms, and we never set the rep's rate. That is why
// `owner_id` below is the partner's user id, `label` is the rep's name, `owner_email` the rep's
// email, and `parent_code` the partner's code — the dashboard shows which code brought which
// restaurant, so the arithmetic is the partner's to do. The direct-pay alternative (the rep owns
// their own code and Stripe account) is a different row shape and is set up by the operator.
//
// A rep code never outranks its partner: it inherits the partner's plan verbatim, so the ledger
// pays exactly what the partner's own code would have paid.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPartnerOrg } from '@/lib/partners/whiteLabel';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export type RepRow = {
  code: string;
  name: string;
  email: string | null;
  city: string | null;
  region: string | null;
  parentCode: string | null;
  createdAt: string | null;
  signups: number;
  accruedCents: number;
  pageUrl: string;
  refLink: string;
};

/** Pure: "Priya Shah" → "priyashah"; keeps [a-z0-9], 2–24 chars, or null when nothing survives. */
export function repCodeFromName(name: string): string | null {
  const s = String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
  return s.length >= 2 ? s : null;
}

/** Pure: the two links a rep is handed. */
export function repLinks(code: string, base = publicBaseUrl()): { pageUrl: string; refLink: string } {
  const b = base.replace(/\/+$/, '');
  return { pageUrl: `${b}/for/${encodeURIComponent(code)}`, refLink: `${b}/?ref=${encodeURIComponent(code)}` };
}

/** Pure: validate what a partner typed for a new rep. */
export function validateRepInput(input: { name?: unknown; email?: unknown; city?: unknown; region?: unknown }):
  | { ok: true; name: string; email: string | null; city: string | null; region: string | null }
  | { ok: false; error: string } {
  const name = String(input.name ?? '').trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: 'A name is required.' };
  const email = String(input.email ?? '').trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email does not look right.' };
  const city = String(input.city ?? '').trim().slice(0, 80) || null;
  const region = String(input.region ?? '').trim().slice(0, 40) || null;
  if (region && !city) return { ok: false, error: 'A region needs a city.' };
  return { ok: true, name, email, city, region };
}

export async function listReps(partnerUserId: string, partnerCodes: string[]): Promise<RepRow[]> {
  if (!partnerCodes.length) return [];
  const { data: rows } = await supabaseAdmin
    .from('referral_codes')
    .select('code, label, owner_email, rep_city, rep_region, parent_code, created_at, status')
    .eq('created_by', partnerUserId)
    .in('parent_code', partnerCodes)
    .neq('status', 'disabled')
    .order('created_at', { ascending: true });
  const reps = ((rows ?? []) as any[]).filter((r) => !partnerCodes.includes(r.code));
  if (!reps.length) return [];
  const codes = reps.map((r) => r.code as string);
  const [{ data: signups }, { data: ledger }] = await Promise.all([
    supabaseAdmin.from('referral_signups').select('referral_code').in('referral_code', codes),
    supabaseAdmin.from('commission_ledger').select('referral_code, amount_cents, status').in('referral_code', codes),
  ]);
  const signupCount = new Map<string, number>();
  for (const s of (signups ?? []) as { referral_code: string }[]) signupCount.set(s.referral_code, (signupCount.get(s.referral_code) ?? 0) + 1);
  const accrued = new Map<string, number>();
  for (const l of (ledger ?? []) as { referral_code: string; amount_cents: number; status: string }[]) {
    if (l.status === 'void' || l.status === 'reversed') continue;
    accrued.set(l.referral_code, (accrued.get(l.referral_code) ?? 0) + (Number(l.amount_cents) || 0));
  }
  return reps.map((r) => ({
    code: r.code,
    name: r.label ?? r.code,
    email: r.owner_email ?? null,
    city: r.rep_city ?? null,
    region: r.rep_region ?? null,
    parentCode: r.parent_code ?? null,
    createdAt: r.created_at ?? null,
    signups: signupCount.get(r.code) ?? 0,
    accruedCents: accrued.get(r.code) ?? 0,
    ...repLinks(r.code),
  }));
}

export async function createRepCode(input: {
  partnerUserId: string;
  partnerCode: string;
  name: string;
  email: string | null;
  city: string | null;
  region: string | null;
}): Promise<{ ok: true; code: string; pageUrl: string; refLink: string } | { ok: false; error: string }> {
  const base = repCodeFromName(input.name);
  if (!base) return { ok: false, error: 'That name does not make a code (letters or digits needed).' };
  const { data: parent } = await supabaseAdmin
    .from('referral_codes')
    .select('code, plan, owner_id')
    .eq('code', input.partnerCode)
    .eq('owner_id', input.partnerUserId)
    .maybeSingle();
  if (!parent) return { ok: false, error: 'Your own partner code could not be found.' };
  let code = base;
  for (let i = 0; i < 6; i++) {
    const cand = i === 0 ? base : `${base}${Math.random().toString(36).slice(2, 5)}`;
    const { data: clash } = await supabaseAdmin.from('referral_codes').select('code').eq('code', cand).maybeSingle();
    if (!clash) {
      code = cand;
      break;
    }
    if (i === 5) return { ok: false, error: 'Could not find a free code; try a different name.' };
  }
  const { error } = await supabaseAdmin.from('referral_codes').insert({
    code,
    owner_type: 'provider_rep',
    owner_id: input.partnerUserId, // ⚠️ the partner, never the rep — see the header
    plan: (parent as any).plan,
    parent_code: input.partnerCode,
    label: input.name,
    owner_email: input.email,
    status: 'active',
    created_by: input.partnerUserId,
    claimed_at: new Date().toISOString(),
    rep_city: input.city,
    rep_region: input.region,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code, ...repLinks(code) };
}

export type RepProfile = {
  code: string;
  name: string;
  city: string | null;
  region: string | null;
  ownerId: string;
  parentCode: string | null;
};

/** The rep behind a /for/<code> page: a partner-minted code only (has a parent and a creator). */
export async function repProfile(code: string): Promise<RepProfile | null> {
  const c = String(code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!c) return null;
  const { data } = await supabaseAdmin
    .from('referral_codes')
    .select('code, label, rep_city, rep_region, owner_id, parent_code, created_by, status')
    .eq('code', c)
    .maybeSingle();
  const r = data as any;
  if (!r || r.status === 'disabled' || !r.parent_code || !r.created_by || !r.owner_id) return null;
  return { code: r.code, name: r.label ?? r.code, city: r.rep_city ?? null, region: r.rep_region ?? null, ownerId: r.owner_id, parentCode: r.parent_code };
}

/** The reseller org a code belongs to (its owner's org), or null for a platform code. */
export async function orgIdForCode(code: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('referral_codes').select('owner_id').eq('code', code).maybeSingle();
  const ownerId = (data as { owner_id?: string | null } | null)?.owner_id;
  if (!ownerId) return null;
  const org = await getPartnerOrg(ownerId);
  return org?.id ?? null;
}
