// lib/domains/ownedInventoryServer.ts
//
// Assembles the owned-domain inventory (I/O) from three sources and hands the pure
// rollup/projection helpers a clean list:
//   1. public.owned_domains  — the cost ledger (manual/external entries + cached Vercel
//                              renewal prices + notes). Source of truth for `renewalCents`.
//   2. Vercel account list    — every domain in the account (expiry, auto-renew, whether
//                              it's registered through Vercel) so we surface domains that
//                              aren't tied to a campaign too.
//   3. Geo campaigns          — joins rent (rented? monthly rent) + rank so we can show how
//                              much of the cost is offset, and which domains are pure bleed.
// `syncOwnedDomains()` refreshes the ledger: pulls the Vercel list, fetches each Vercel
// domain's renewal price, and upserts. GET stays cheap (no per-domain registrar calls).

import { createClient } from '@supabase/supabase-js';
import { listVercelOwnedDomains, getRenewalPriceUsd } from '@/lib/domains/registrar';
import { listGeoCampaigns } from '@/lib/outreach/geoCampaigns';
import { effectivePriceCents } from '@/lib/outreach/geoPricing';
import { normalizeDomain } from '@/lib/prospects/ownedDomains';
import {
  rollupDomains,
  projectFromRollup,
  projectDomainSpendByExpiry,
  type InventoryDomain,
  type DomainRollup,
  type SpendProjectionPoint,
} from '@/lib/domains/ownedInventory';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
// Untyped service-role client — owned_domains isn't in the generated types yet.
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type OwnedRow = {
  domain: string;
  source: string | null;
  registrar: string | null;
  renewal_cents: number | null;
  expires_at: string | null;
  auto_renew: boolean | null;
  notes: string | null;
};

const msToIso = (ms: number | null): string | null => (ms ? new Date(ms).toISOString() : null);
const isRanking = (rank?: string | null) => rank === 'page1' || rank === 'ranking';

export type OwnedInventory = {
  domains: InventoryDomain[];
  rollup: DomainRollup;
  /** Level monthly-burn (amortized) cumulative spend. */
  projection: SpendProjectionPoint[];
  /** Lumpy truth: spend stepped by each domain's actual renewal month. */
  projectionByExpiry: SpendProjectionPoint[];
  /** True when we couldn't reach Vercel (so the list may be missing account-only domains). */
  vercelUnavailable: boolean;
};

/** Read + merge the inventory. Cheap: no per-domain registrar calls (use sync for prices). */
export async function assembleOwnedInventory(months = 12): Promise<OwnedInventory> {
  const [ownedRes, campaigns, vercelList] = await Promise.all([
    admin.from('owned_domains').select('domain, source, registrar, renewal_cents, expires_at, auto_renew, notes'),
    listGeoCampaigns(500).catch(() => []),
    listVercelOwnedDomains().catch(() => null),
  ]);

  const ownedByDomain = new Map<string, OwnedRow>();
  for (const r of (ownedRes.data as OwnedRow[] | null) ?? []) {
    const key = normalizeDomain(r.domain);
    if (key) ownedByDomain.set(key, r);
  }

  // Campaigns whose domain we actually own (registered), keyed by normalized domain.
  const campByDomain = new Map<string, (typeof campaigns)[number]>();
  for (const c of campaigns) {
    if (c.domain_status !== 'registered') continue;
    const key = normalizeDomain(c.domain);
    if (key) campByDomain.set(key, c);
  }

  const vercelByDomain = new Map<string, NonNullable<Awaited<ReturnType<typeof listVercelOwnedDomains>>>[number]>();
  for (const d of vercelList ?? []) {
    const key = normalizeDomain(d.domain);
    if (key) vercelByDomain.set(key, d);
  }

  // Union of every domain we know we own.
  const keys = new Set<string>([...ownedByDomain.keys(), ...campByDomain.keys(), ...vercelByDomain.keys()]);

  const domains: InventoryDomain[] = [];
  for (const key of keys) {
    const owned = ownedByDomain.get(key);
    const camp = campByDomain.get(key);
    const vc = vercelByDomain.get(key);

    const source: InventoryDomain['source'] =
      (owned?.source as InventoryDomain['source']) ??
      (vc ? 'vercel' : camp ? 'campaign' : 'manual');

    const rented = camp?.subscription_status === 'active';
    const monthlyRentCents = (rented && camp ? effectivePriceCents(camp) : 0) ?? 0;

    domains.push({
      domain: key,
      source,
      registrar: owned?.registrar ?? (vc?.registeredWithVercel ? 'vercel' : null),
      renewalCents: owned?.renewal_cents ?? null,
      expiresAt: owned?.expires_at ?? msToIso(vc?.expiresAt ?? null),
      autoRenew: owned?.auto_renew ?? vc?.autoRenew ?? null,
      campaignId: camp?.id ?? null,
      city: camp?.city ?? null,
      industryKey: (camp?.industry_key as string | undefined) ?? null,
      monthlyRentCents,
      rented: !!rented,
      ranking: isRanking(camp?.rank_status),
      notes: owned?.notes ?? null,
    });
  }

  // Stable, useful order: unknown-cost first (needs follow-up), then priciest, then name.
  domains.sort((a, b) => {
    const au = a.renewalCents == null ? 1 : 0;
    const bu = b.renewalCents == null ? 1 : 0;
    if (au !== bu) return bu - au;
    if ((b.renewalCents ?? 0) !== (a.renewalCents ?? 0)) return (b.renewalCents ?? 0) - (a.renewalCents ?? 0);
    return a.domain.localeCompare(b.domain);
  });

  const rollup = rollupDomains(domains);
  return {
    domains,
    rollup,
    projection: projectFromRollup(rollup, months),
    projectionByExpiry: projectDomainSpendByExpiry(domains, { months, nowMs: Date.now() }),
    vercelUnavailable: vercelList === null,
  };
}

/**
 * Refresh the cost ledger from Vercel: upsert every Vercel-owned domain with its live
 * renewal price + expiry. Bounded per-domain price fetches. Returns counts.
 */
export async function syncOwnedDomains(): Promise<{ ok: boolean; found: number; priced: number; error?: string }> {
  const list = await listVercelOwnedDomains();
  if (list === null) return { ok: false, found: 0, priced: 0, error: 'vercel_unavailable' };

  let priced = 0;
  const rows: OwnedRow[] = [];
  for (const d of list) {
    let renewalCents: number | null = null;
    if (d.registeredWithVercel) {
      const usd = await getRenewalPriceUsd(d.domain); // sequential — small N, avoids rate limits
      if (usd != null) {
        renewalCents = Math.round(usd * 100);
        priced++;
      }
    }
    rows.push({
      domain: d.domain,
      source: d.registeredWithVercel ? 'vercel' : 'external',
      registrar: d.registeredWithVercel ? 'vercel' : null,
      renewal_cents: renewalCents,
      expires_at: msToIso(d.expiresAt),
      auto_renew: d.autoRenew,
      notes: null,
    });
  }

  if (rows.length) {
    // Don't clobber a manual cost with null: only overwrite renewal_cents when we found one.
    for (const r of rows) {
      const patch: Record<string, unknown> = {
        domain: r.domain,
        source: r.source,
        registrar: r.registrar,
        expires_at: r.expires_at,
        auto_renew: r.auto_renew,
        updated_at: new Date().toISOString(),
      };
      if (r.renewal_cents != null) patch.renewal_cents = r.renewal_cents;
      await admin.from('owned_domains').upsert(patch, { onConflict: 'domain' });
    }
  }

  return { ok: true, found: list.length, priced };
}

/** Upsert a manual/external domain's cost + metadata (the follow-up for non-Vercel domains). */
export async function upsertManualDomain(input: {
  domain: string;
  renewalCents?: number | null;
  registrar?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}): Promise<{ ok: boolean; domain?: string; error?: string }> {
  const domain = normalizeDomain(input.domain);
  if (!domain) return { ok: false, error: 'invalid_domain' };

  const patch: Record<string, unknown> = { domain, source: 'external', updated_at: new Date().toISOString() };
  if (input.renewalCents !== undefined) patch.renewal_cents = input.renewalCents;
  if (input.registrar !== undefined) patch.registrar = input.registrar;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { error } = await admin.from('owned_domains').upsert(patch, { onConflict: 'domain' });
  if (error) return { ok: false, error: error.message };
  return { ok: true, domain };
}
