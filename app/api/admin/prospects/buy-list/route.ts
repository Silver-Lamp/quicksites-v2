// app/api/admin/prospects/buy-list/route.ts
//
// Domain buy-list planner: score city×industry candidates from swept prospects, optionally
// batch-check availability/price via the registrar (read-only, no spend), and fill a fixed
// budget hottest-first. Answers "$1000 → which ~90 domains?" See
// docs/DOMAIN_ACQUISITION_PLAN.md. Admin-gated; read-only (no domain is purchased here).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listProspects } from '@/lib/outreach/prospects';
import {
  buildBuyList,
  fillBudget,
  type BuyCandidateInput,
  type AvailabilityInfo,
} from '@/lib/prospects/buyList';
import { PREMIUM_INDUSTRIES } from '@/lib/outreach/geoPricing';
import { checkAvailability } from '@/lib/domains/registrar';
import { fetchKeywordVolumes, applyKeywordVolume, keywordVolumeEnabled } from '@/lib/prospects/keywordVolume';
import { resolveIndustryKey, type IndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // batch availability can fan out ~120 registrar checks

/** Bounded-concurrency map (mirrors the discover route's helper). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

type Body = {
  /** Explicit city list to fan the industries across (in addition to swept cities). */
  cities?: Array<{ city: string; region?: string | null }>;
  /** Industries to consider (default: the premium tier). */
  industries?: string[];
  /** Fixed budget to fill, in whole USD (default 1000). */
  budgetUsd?: number;
  /** Batch-check availability + price via the registrar (read-only). Default false. */
  checkAvailability?: boolean;
  /** Enrich with keyword search volume (DataForSEO — flag-gated, costs money). Default false. */
  checkVolume?: boolean;
  /** How many top candidates to availability-check / return (default 120). */
  maxCandidates?: number;
  /** Assumed yearly price (USD) when availability is unknown/unchecked (default 12). */
  defaultPriceUsd?: number;
  /** Max domains per industry in the budget fill (spread the bet). */
  perIndustryCap?: Record<string, number>;
  /** Drop city×industry buckets with fewer than N swept prospects (default 0). */
  minGroup?: number;
  tld?: string;
};

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const budgetUsd = Number.isFinite(body.budgetUsd) ? Math.max(0, Number(body.budgetUsd)) : 1000;
  const maxCandidates = Math.min(Math.max(1, Number(body.maxCandidates) || 120), 500);
  const defaultPriceUsd = Number.isFinite(body.defaultPriceUsd) ? Number(body.defaultPriceUsd) : 12;
  const tld = (body.tld || 'com').replace(/[^a-z0-9]/gi, '') || 'com';

  // Resolve/dedupe the requested industries (default → premium tier).
  const industries: IndustryKey[] = Array.from(
    new Set(
      (body.industries?.length ? body.industries : [...PREMIUM_INDUSTRIES]).map((s) =>
        resolveIndustryKey(String(s)),
      ),
    ),
  );

  // Explicit city × industry candidates (plan a region even before it's swept).
  const candidates: BuyCandidateInput[] = [];
  for (const c of body.cities ?? []) {
    const city = String(c?.city || '').trim();
    if (!city) continue;
    for (const industryKey of industries) {
      candidates.push({ city, region: c?.region ?? null, industryKey });
    }
  }

  // Score from all swept prospects (grounded demand + saturation).
  const prospects = await listProspects({ limit: 2000 });
  let ranked = buildBuyList(prospects, {
    industries,
    candidates,
    tld,
    minGroup: Number.isFinite(body.minGroup) ? Number(body.minGroup) : 0,
  });

  const totalScored = ranked.length;
  ranked = ranked.slice(0, maxCandidates);

  // Optional read-only availability + price (no purchase).
  let availabilityByDomain: Record<string, AvailabilityInfo> | undefined;
  let availabilityChecked = false;
  if (body.checkAvailability) {
    availabilityByDomain = {};
    // Concurrency 4 (down from 8) to stay under Vercel's domain-status rate limit — a 429
    // there would otherwise surface as a false "Taken".
    const infos = await mapLimit(ranked, 4, async (c) => {
      try {
        const a = await checkAvailability(c.domain);
        return {
          domain: c.domain,
          info: { available: a.available, priceUsd: a.priceUsd, premium: a.premium, error: a.error },
        };
      } catch (e: any) {
        // The call threw (e.g. missing token) → unknown, not taken.
        return { domain: c.domain, info: { available: false, error: `threw:${e?.message || 'error'}` } as AvailabilityInfo };
      }
    });
    for (const { domain, info } of infos) if (info) availabilityByDomain[domain] = info;
    availabilityChecked = true;
  }

  // Optional keyword-volume enrichment (flag-gated, costs money) — re-ranks by volume-adjusted score.
  let volumeChecked = false;
  if (body.checkVolume && keywordVolumeEnabled()) {
    const volumeByDomain = await fetchKeywordVolumes(
      ranked.map((c) => ({ domain: c.domain, city: c.city, industryKey: c.industryKey })),
    );
    if (Object.keys(volumeByDomain).length) {
      ranked = applyKeywordVolume(ranked, volumeByDomain);
      volumeChecked = true;
    }
  }

  const perIndustryCap = body.perIndustryCap
    ? (Object.fromEntries(
        Object.entries(body.perIndustryCap).map(([k, v]) => [resolveIndustryKey(k), Number(v)]),
      ) as Partial<Record<IndustryKey, number>>)
    : undefined;

  const fill = fillBudget(ranked, {
    budgetUsd,
    availabilityByDomain,
    defaultPriceUsd,
    perIndustryCap,
  });

  return NextResponse.json({
    ok: true,
    budgetUsd,
    industries,
    totalScored,
    returned: ranked.length,
    availabilityChecked,
    availabilityByDomain: availabilityByDomain ?? {},
    volumeChecked,
    volumeAvailable: keywordVolumeEnabled(),
    candidates: ranked,
    fill: {
      count: fill.count,
      totalSpendUsd: fill.totalSpendUsd,
      projectedMonthlyRentCents: fill.projectedMonthlyRentCents,
      projectedFullMonthlyRentCents: fill.projectedFullMonthlyRentCents,
      acceptedDomains: fill.accepted.map((c) => c.domain),
      skipped: fill.skipped.map((s) => ({ domain: s.candidate.domain, reason: s.reason, priceUsd: s.priceUsd })),
    },
  });
}
