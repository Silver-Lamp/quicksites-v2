// lib/commerce/rentalLedger.ts
//
// Reads live geo-domain rentals and applies lib/commerce/rentalSplits to each one, so
// "who is owed what this month" has a single answer computed in one place.
//
// ⚠️ This is a REPORT, not a ledger. The commerce side writes commission_ledger rows at
// markOrderPaid(); the rental webhook writes none, so nothing here is persisted, owed,
// or paid by the software — a human reads these numbers and sends the money. Until the
// rental rail writes real ledger rows, do not let this page's confidence imply otherwise.

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  splitRentalPayment,
  monthlyEquivalentCents,
  type RentalSplit,
  type SplitVariant,
} from '@/lib/commerce/rentalSplits';

export type RentalRow = {
  id: string;
  domain: string;
  city: string;
  industry_key: string;
  renter_email: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  billing_interval: string | null;
  /** What each charge actually bills — the effective (locked vs full) rate. */
  chargeCents: number;
  monthlyEquivalentCents: number;
  payment_count: number;
  last_payment_at: string | null;
  last_payment_cents: number | null;
  sold_by: string | null;
  sold_by_manager: string | null;
  manager_is_recruiter: boolean;
  variant: SplitVariant;
  split: RentalSplit;
  /** True when nobody is credited — the split is computable but unpayable. */
  unassigned: boolean;
};

export type RentalLedger = {
  rows: RentalRow[];
  totals: {
    /** Rentals that have actually billed at least once. */
    billing: number;
    grossMonthlyCents: number;
    feeMonthlyCents: number;
    netMonthlyCents: number;
    closerMonthlyCents: number;
    managerMonthlyCents: number;
    houseMonthlyCents: number;
    /** Monthly value sitting on rentals with nobody credited. */
    unassignedMonthlyCents: number;
  };
  /** Per-person monthly totals, for the people actually named on rentals. */
  byPerson: { name: string; asCloser: number; asManager: number; total: number }[];
};

/** Statuses that mean money is still arriving. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * The rate a rental actually charges right now: the locked founder rate until the domain
 * reaches page one, then the full rate. Mirrors effectivePriceCents in lib/outreach/
 * geoPricing — kept in sync deliberately rather than imported, because that module pulls
 * industry types this report does not need.
 */
function effectiveChargeCents(c: {
  pricing_model: string | null;
  price_cents: number | null;
  locked_rate_cents: number | null;
  rank_status: string | null;
}): number {
  if (c.pricing_model !== 'flat') return 0;
  if (c.rank_status === 'page1') return c.price_cents ?? c.locked_rate_cents ?? 0;
  return c.locked_rate_cents ?? c.price_cents ?? 0;
}

export async function getRentalLedger(): Promise<RentalLedger> {
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select(
      'id, domain, city, industry_key, renter_email, subscription_status, stripe_subscription_id, ' +
        'billing_interval, pricing_model, price_cents, locked_rate_cents, rank_status, ' +
        'payment_count, last_payment_at, last_payment_cents, sold_by, sold_by_manager, manager_is_recruiter'
    )
    .not('subscription_status', 'is', null)
    .order('last_payment_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`getRentalLedger failed: ${error.message}`);

  const rows: RentalRow[] = (data ?? []).map((c: any) => {
    const chargeCents = effectiveChargeCents(c);
    const variant: SplitVariant = c.manager_is_recruiter ? 'recruit' : 'standard';
    const monthly = monthlyEquivalentCents(chargeCents, c.billing_interval);
    return {
      id: c.id,
      domain: c.domain,
      city: c.city,
      industry_key: c.industry_key,
      renter_email: c.renter_email,
      subscription_status: c.subscription_status,
      stripe_subscription_id: c.stripe_subscription_id,
      billing_interval: c.billing_interval,
      chargeCents,
      monthlyEquivalentCents: monthly,
      payment_count: c.payment_count ?? 0,
      last_payment_at: c.last_payment_at,
      last_payment_cents: c.last_payment_cents,
      sold_by: c.sold_by,
      sold_by_manager: c.sold_by_manager,
      manager_is_recruiter: !!c.manager_is_recruiter,
      variant,
      // Split the MONTHLY equivalent so every rental is comparable regardless of the
      // interval it bills on — a $1/day test rental must not read as $1 of revenue.
      split: splitRentalPayment(monthly, variant),
      unassigned: !c.sold_by,
    };
  });

  const live = rows.filter((r) => LIVE_STATUSES.has(r.subscription_status ?? ''));

  const totals = live.reduce(
    (acc, r) => {
      acc.grossMonthlyCents += r.split.grossCents;
      acc.feeMonthlyCents += r.split.feeCents;
      acc.netMonthlyCents += r.split.netCents;
      acc.closerMonthlyCents += r.split.closerCents;
      // With nobody credited as manager, that share stays with the house rather than
      // silently accruing to a person who does not exist.
      if (r.sold_by_manager) acc.managerMonthlyCents += r.split.managerCents;
      else acc.houseMonthlyCents += r.split.managerCents;
      acc.houseMonthlyCents += r.split.houseCents;
      if (r.unassigned) acc.unassignedMonthlyCents += r.split.netCents;
      return acc;
    },
    {
      billing: live.filter((r) => r.payment_count > 0).length,
      grossMonthlyCents: 0,
      feeMonthlyCents: 0,
      netMonthlyCents: 0,
      closerMonthlyCents: 0,
      managerMonthlyCents: 0,
      houseMonthlyCents: 0,
      unassignedMonthlyCents: 0,
    }
  );

  const people = new Map<string, { name: string; asCloser: number; asManager: number }>();
  const bump = (name: string | null, field: 'asCloser' | 'asManager', cents: number) => {
    if (!name) return;
    const key = name.trim().toLowerCase();
    if (!key) return;
    const rec = people.get(key) ?? { name: name.trim(), asCloser: 0, asManager: 0 };
    rec[field] += cents;
    people.set(key, rec);
  };
  for (const r of live) {
    bump(r.sold_by, 'asCloser', r.split.closerCents);
    bump(r.sold_by_manager, 'asManager', r.split.managerCents);
  }

  const byPerson = [...people.values()]
    .map((p) => ({ ...p, total: p.asCloser + p.asManager }))
    .sort((a, b) => b.total - a.total);

  return { rows, totals, byPerson };
}
