// lib/partners/whiteLabel.ts
//
// Data layer for partner self-serve white-label activation. Every write here is what an
// operator used to do by hand in a SQL console (organizations + org_members + org_domains),
// in the Vercel dashboard (attach the host) and in Resend (add the sending domain).
//
// Ownership model: a partner (owner of an active `provider_rep` referral code) owns at most
// ONE reseller org — the org where they are `org_members.role='owner'` and
// `billing_mode='reseller'`. Everything below is scoped through that lookup, never through a
// client-supplied org id.
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireUser';
import { addProjectDomain, getProjectDomainConfig } from '@/lib/domains/vercel';
import {
  dnsInstructionsFor,
  emailFromFor,
  isReservedHost,
  normalizeHost,
  orgSlugFromName,
  whiteLabelSteps,
  type WhiteLabelState,
} from '@/lib/partners/whiteLabelRules';

const db = supabaseAdmin as any;

export type PartnerGate = { user: { id: string; email?: string | null }; codes: string[] };

/** Signed-in, non-anonymous, and the owner of at least one active partner code. */
export async function requirePartner(): Promise<PartnerGate | NextResponse> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { data } = await db
    .from('referral_codes')
    .select('code')
    .eq('owner_type', 'provider_rep')
    .eq('owner_id', gate.user.id)
    .eq('status', 'active');
  const codes = (data ?? []).map((r: { code: string }) => r.code);
  if (!codes.length) return NextResponse.json({ error: 'Join the partner program first.' }, { status: 403 });
  return { user: gate.user, codes };
}

export type PartnerOrg = {
  id: string;
  slug: string;
  name: string;
  support_email: string | null;
  logo_url: string | null;
  dark_logo_url: string | null;
  favicon_url: string | null;
  theme_json: Record<string, unknown> | null;
  admin_domain: string | null;
  email_from: string | null;
  branding: Record<string, any> | null;
};

const ORG_COLS = 'id, slug, name, support_email, logo_url, dark_logo_url, favicon_url, theme_json, admin_domain, email_from, branding';

/** The partner's reseller org, or null. */
export async function getPartnerOrg(userId: string): Promise<PartnerOrg | null> {
  const { data: memberships } = await db.from('org_members').select('org_id').eq('user_id', userId).eq('role', 'owner');
  const ids = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
  if (!ids.length) return null;
  const { data } = await db
    .from('organizations')
    .select(ORG_COLS)
    .in('id', ids)
    .eq('billing_mode', 'reseller')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as PartnerOrg) ?? null;
}

export type BrandInput = {
  name: string;
  support_email?: string | null;
  accent?: string | null;
  logo_url?: string | null;
  dark_logo_url?: string | null;
};

/**
 * Create the partner's reseller org on first save (org + owner membership), update it after.
 * The slug is derived from the name once and never changes — hosts and cookies key on it.
 */
export async function upsertPartnerOrg(userId: string, input: BrandInput): Promise<PartnerOrg> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new Error('Brand name is required.');
  const support = input.support_email?.trim().toLowerCase() || null;
  if (support && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support)) throw new Error('Support email is not valid.');
  const accent = input.accent && /^#[0-9a-f]{6}$/i.test(input.accent.trim()) ? input.accent.trim().toLowerCase() : null;

  const existing = await getPartnerOrg(userId);
  const patch: Record<string, unknown> = {
    name,
    support_email: support,
    ...(input.logo_url !== undefined ? { logo_url: input.logo_url } : {}),
    ...(input.dark_logo_url !== undefined ? { dark_logo_url: input.dark_logo_url } : {}),
    ...(accent ? { theme_json: { ...(existing?.theme_json ?? {}), primary: accent } } : {}),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await db.from('organizations').update(patch).eq('id', existing.id).select(ORG_COLS).single();
    if (error) throw new Error(error.message);
    return data as PartnerOrg;
  }

  // First save: pick a free slug (two tries, then salt), insert, add the owner membership.
  let slug = orgSlugFromName(name);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: taken } = await db.from('organizations').select('id').eq('slug', slug).maybeSingle();
    if (!taken) break;
    slug = orgSlugFromName(name, Math.random().toString(36).slice(2, 6));
  }
  const { data: org, error } = await db
    .from('organizations')
    .insert({ slug, billing_mode: 'reseller', canonical_host: 'www', ...patch })
    .select(ORG_COLS)
    .single();
  if (error) throw new Error(error.message);
  const { error: memErr } = await db.from('org_members').insert({ org_id: org.id, user_id: userId, role: 'owner' });
  if (memErr) throw new Error(memErr.message);
  return org as PartnerOrg;
}

export type OrgDomainRow = { host: string; kind: string; verified_at: string | null };

export async function getOrgAdminDomain(orgId: string): Promise<OrgDomainRow | null> {
  const { data } = await db.from('org_domains').select('host, kind, verified_at').eq('org_id', orgId).eq('kind', 'admin').maybeSingle();
  return (data as OrgDomainRow) ?? null;
}

/**
 * Attach the partner's portal host: Vercel project domain (idempotent — 409 = already ours)
 * + the org_domains row middleware and resolveOrg() read. Returns what they must add at DNS.
 */
export async function attachOrgDomain(org: PartnerOrg, hostInput: unknown) {
  const host = normalizeHost(hostInput);
  if (!host) throw new Error('Enter a hostname like app.yourbrand.com (no https://, no path).');
  if (isReservedHost(host)) throw new Error('That domain belongs to the platform; use one you own.');
  const { data: clash } = await db.from('org_domains').select('org_id').eq('host', host).neq('org_id', org.id).maybeSingle();
  if (clash) throw new Error('That host is already attached to another account.');

  try {
    await addProjectDomain(host);
  } catch (e: any) {
    // Vercel answers 409 when the domain is already on this project — that is success here.
    if (!/already|409|in use by this project/i.test(String(e?.message ?? ''))) throw new Error(`Vercel: ${e?.message ?? 'attach failed'}`);
  }
  // One admin host per org: replace, never accumulate.
  await db.from('org_domains').delete().eq('org_id', org.id).eq('kind', 'admin');
  const { error } = await db.from('org_domains').insert({ org_id: org.id, host, kind: 'admin' });
  if (error) throw new Error(error.message);
  await db.from('organizations').update({ admin_domain: host, updated_at: new Date().toISOString() }).eq('id', org.id);
  return { host, dns: dnsInstructionsFor(host), verified: false };
}

/** Ask Vercel whether DNS reaches us; on yes, stamp verified_at. Never throws on Vercel errors. */
export async function checkOrgDomain(org: PartnerOrg): Promise<{ host: string | null; verified: boolean; reason?: string; dns: ReturnType<typeof dnsInstructionsFor> }> {
  const row = await getOrgAdminDomain(org.id);
  if (!row) return { host: null, verified: false, reason: 'no_domain', dns: [] };
  const dns = dnsInstructionsFor(row.host);
  if (row.verified_at) return { host: row.host, verified: true, dns };
  let cfg: any;
  try {
    cfg = await getProjectDomainConfig(row.host);
  } catch (e: any) {
    return { host: row.host, verified: false, reason: e?.message ?? 'vercel_error', dns };
  }
  // Vercel: `misconfigured:false` means the records it needs are in place.
  const ok = cfg && cfg.misconfigured === false;
  if (!ok) return { host: row.host, verified: false, reason: 'dns_not_live', dns };
  await db.from('org_domains').update({ verified_at: new Date().toISOString() }).eq('org_id', org.id).eq('host', row.host);
  return { host: row.host, verified: true, dns };
}

type EmailDomainState = { id: string; domain: string; status: string | null; records: any[] };

function resendClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

export function getEmailDomainState(org: PartnerOrg): EmailDomainState | null {
  const s = org.branding?.email_domain;
  return s && typeof s.id === 'string' && typeof s.domain === 'string' ? (s as EmailDomainState) : null;
}

/** Register the sending domain with Resend and keep its DNS records on the org for the checklist. */
export async function createEmailDomain(org: PartnerOrg, domainInput: unknown): Promise<EmailDomainState> {
  const domain = normalizeHost(domainInput);
  if (!domain) throw new Error('Enter a domain like yourbrand.com.');
  if (isReservedHost(domain)) throw new Error('That domain belongs to the platform; use one you own.');
  const resend = resendClient();
  if (!resend) throw new Error('Email sending is not configured on the platform yet.');
  const existing = getEmailDomainState(org);
  if (existing && existing.domain === domain) return existing;
  const { data, error } = await resend.domains.create({ name: domain });
  if (error || !data) throw new Error(`Resend: ${error?.message ?? 'could not add domain'}`);
  const state: EmailDomainState = { id: data.id, domain: data.name, status: data.status ?? 'pending', records: data.records ?? [] };
  await db
    .from('organizations')
    .update({ branding: { ...(org.branding ?? {}), email_domain: state }, updated_at: new Date().toISOString() })
    .eq('id', org.id);
  return state;
}

/** Trigger Resend's verification and, once verified, set the org's sender address. */
export async function checkEmailDomain(org: PartnerOrg): Promise<EmailDomainState | null> {
  const state = getEmailDomainState(org);
  if (!state) return null;
  if (state.status === 'verified' && org.email_from) return state;
  const resend = resendClient();
  if (!resend) return state;
  try {
    await resend.domains.verify(state.id);
  } catch {
    /* verify is a nudge; get() below is the truth */
  }
  const { data } = await resend.domains.get(state.id);
  const next: EmailDomainState = data
    ? { ...state, status: data.status ?? state.status, records: data.records ?? state.records }
    : state;
  const patch: Record<string, unknown> = {
    branding: { ...(org.branding ?? {}), email_domain: next },
    updated_at: new Date().toISOString(),
  };
  if (next.status === 'verified') patch.email_from = emailFromFor(org.name, next.domain);
  await db.from('organizations').update(patch).eq('id', org.id);
  return next;
}

/** Everything the dashboard checklist needs, assembled from the partner's own rows. */
export async function partnerWhiteLabelStatus(gate: PartnerGate) {
  const org = await getPartnerOrg(gate.user.id);
  const [domain, payout] = await Promise.all([
    org ? getOrgAdminDomain(org.id) : Promise.resolve(null),
    db.from('partner_payout_accounts').select('status').eq('user_id', gate.user.id).eq('provider', 'stripe').maybeSingle(),
  ]);
  const email = org ? getEmailDomainState(org) : null;
  const platformBase = (process.env.QS_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');
  const state: WhiteLabelState = {
    org: org ? { slug: org.slug, name: org.name, support_email: org.support_email, logo_url: org.logo_url, dark_logo_url: org.dark_logo_url } : null,
    domain: domain ? { host: domain.host, verified_at: domain.verified_at } : null,
    email: email ? { domain: email.domain, status: email.status } : null,
    payoutsActive: (payout?.data as any)?.status === 'active',
    code: gate.codes[0] ?? null,
    platformBase,
  };
  return {
    steps: whiteLabelSteps(state),
    org: org ? { id: org.id, slug: org.slug, name: org.name, support_email: org.support_email, logo_url: org.logo_url, dark_logo_url: org.dark_logo_url, accent: (org.theme_json as any)?.primary ?? null } : null,
    domain: domain ? { host: domain.host, verified: !!domain.verified_at, dns: dnsInstructionsFor(domain.host) } : null,
    email: email ? { domain: email.domain, status: email.status, records: email.records } : null,
    payoutsActive: state.payoutsActive,
    code: state.code,
  };
}
