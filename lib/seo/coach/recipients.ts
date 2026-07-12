// lib/seo/coach/recipients.ts
//
// Enumerate the paid, opted-in owners who should receive SEO coaching, with their
// published sites + email + preferences. Efficient single-pass over user_plans →
// user_profiles → templates → email_preferences. user_plans has no generated type
// (CLAUDE.md §8), so we query it untyped and keep typed domain objects above the boundary.
//
// NOTE (v1 limitation): enrollment reads user_plans (the authoritative per-user plan).
// merchant_billing-only paid users won't be enrolled until they have a user_plans row.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ACTIVE_PLAN_STATUSES, isPaidPlan } from '@/lib/billing/plans';
import type { CoachSiteRow } from '@/lib/seo/coach/signals';

type AnyClient = SupabaseClient<any, any, any>;

export type CoachPrefs = {
  daily: boolean;
  weekly: boolean;
  unsubscribedAll: boolean;
  lastDailySentOn: string | null;
  lastWeeklySentOn: string | null;
};

export type CoachRecipient = {
  ownerId: string;
  email: string;
  sites: CoachSiteRow[];
  prefs: CoachPrefs;
};

const DEFAULT_PREFS: CoachPrefs = {
  daily: true,
  weekly: true,
  unsubscribedAll: false,
  lastDailySentOn: null,
  lastWeeklySentOn: null,
};

function hasRealContent(data: any): boolean {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  return pages.some((p: any) => Array.isArray(p?.blocks) && p.blocks.length > 0);
}

/**
 * Paid, active owners with ≥1 published content site. `limit` caps owners per run.
 * Preference filtering (opt-out / already-sent-this-period) is left to the caller so
 * daily vs weekly can apply their own idempotency window.
 */
export async function listPaidCoachRecipients(admin: AnyClient, limit = 500): Promise<CoachRecipient[]> {
  // 1) Paid + active plans (authoritative per-user).
  const { data: planRows } = await (admin as any)
    .from('user_plans')
    .select('user_id, plan, status')
    .limit(2000);

  const paidOwnerIds = ((planRows as any[]) ?? [])
    .filter((r) => isPaidPlan(r?.plan) && ACTIVE_PLAN_STATUSES.has(r?.status ?? 'none'))
    .map((r) => String(r.user_id));
  const ownerIds = Array.from(new Set(paidOwnerIds)).slice(0, limit);
  if (!ownerIds.length) return [];

  // 2) Their published content sites.
  const { data: tplRows } = await (admin as any)
    .from('templates')
    .select('id, owner_id, slug, data, custom_domain, domain')
    .in('owner_id', ownerIds)
    .eq('is_site', true)
    .eq('archived', false)
    .eq('published', true);

  const sitesByOwner = new Map<string, CoachSiteRow[]>();
  for (const t of ((tplRows as any[]) ?? [])) {
    if (!hasRealContent(t?.data)) continue;
    const arr = sitesByOwner.get(t.owner_id) ?? [];
    arr.push(t as CoachSiteRow);
    sitesByOwner.set(t.owner_id, arr);
  }

  const ownersWithSites = ownerIds.filter((id) => (sitesByOwner.get(id)?.length ?? 0) > 0);
  if (!ownersWithSites.length) return [];

  // 3) Emails + 4) preferences, in bulk.
  const [{ data: profileRows }, { data: prefRows }] = await Promise.all([
    (admin as any).from('user_profiles').select('user_id, email').in('user_id', ownersWithSites),
    (admin as any)
      .from('email_preferences')
      .select('user_id, seo_coach_daily, seo_coach_weekly, unsubscribed_all, last_daily_sent_on, last_weekly_sent_on')
      .in('user_id', ownersWithSites),
  ]);

  const emailByOwner = new Map<string, string>();
  for (const r of ((profileRows as any[]) ?? [])) if (r?.email) emailByOwner.set(r.user_id, r.email);

  // Fall back to the auth record's email for owners with no user_profiles.email
  // (profile rows can lag account creation) so a payer isn't silently skipped.
  const missingEmail = ownersWithSites.filter((id) => !emailByOwner.has(id));
  for (const id of missingEmail) {
    try {
      const { data } = await (admin as any).auth.admin.getUserById(id);
      const email = data?.user?.email;
      if (email) emailByOwner.set(id, email);
    } catch {
      /* best-effort — owner stays skipped if we can't resolve an address */
    }
  }

  const prefsByOwner = new Map<string, CoachPrefs>();
  for (const r of ((prefRows as any[]) ?? [])) {
    prefsByOwner.set(r.user_id, {
      daily: r.seo_coach_daily ?? true,
      weekly: r.seo_coach_weekly ?? true,
      unsubscribedAll: r.unsubscribed_all ?? false,
      lastDailySentOn: r.last_daily_sent_on ?? null,
      lastWeeklySentOn: r.last_weekly_sent_on ?? null,
    });
  }

  const out: CoachRecipient[] = [];
  for (const ownerId of ownersWithSites) {
    const email = emailByOwner.get(ownerId);
    if (!email) continue; // no address → can't coach
    out.push({
      ownerId,
      email,
      sites: sitesByOwner.get(ownerId) ?? [],
      prefs: prefsByOwner.get(ownerId) ?? { ...DEFAULT_PREFS },
    });
  }
  return out;
}
