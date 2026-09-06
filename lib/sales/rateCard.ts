// lib/sales/rateCard.ts
//
// Which domains may a rep pitch as "on page one today", what phrase proves it, and at what price.
//
// ⚠️ THE QUALIFICATION RULE IS THE HONESTY CONTROL, NOT A FILTER. A domain qualifies only when it
// holds page one for its OWN city+trade phrase — something the prospect can verify on the call
// while you wait. Everything else is the founder tier, sold as "not ranking yet", because the one
// thing a rep may never do is promise a ranking (`no_ranking_promise` in the rehearsal lane).
//
// ⚠️ NO PRICE LITERALS IN THIS FILE. Rent comes from `priceTier()` so a price change is one edit
// and no surface can quote a stale number at a live prospect — the same rule geoDomainRental.ts
// follows. `fullCents` is the page-one rate; `lockedCents` is the pre-rank founder rate.

import { classifyQuery } from '@/lib/proof/queryKind';
import { priceTier } from '@/lib/outreach/geoPricing';
import type { IndustryKey } from '@/lib/industries';

export type GscQuery = { query: string; clicks: number; impressions: number; position: number };
export type GscSite = {
  host: string;
  clicks: number;
  impressions: number;
  position: number | null;
  queries: GscQuery[];
};

export type SiteFacts = {
  host: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  industryKey?: IndustryKey | null;
};

export type Blocker = {
  id: 'no-service-area' | 'no-phone' | 'thin-volume' | 'area-code-mismatch';
  severity: 'stop' | 'warn';
  label: string;
};

export type RateCardRow = {
  host: string;
  qualifies: boolean;
  /** The phrase to have the prospect type. Chosen by APPEARANCES, not best position — see below. */
  proofQuery: string | null;
  proofPosition: number | null;
  proofAppearances: number;
  otherPageOneQueries: string[];
  city: string | null;
  state: string | null;
  phone: string | null;
  fullCents: number;
  lockedCents: number;
  siteAveragePosition: number | null;
  blockers: Blocker[];
  /** Safe to put in front of a prospect: qualifies AND nothing hard-stopping. */
  pitchable: boolean;
};

/** Page one. GSC positions are averages, so 10.0 is in and 10.4 is not. */
export const PAGE_ONE = 10;
/** Below this many appearances in the window, a rep must sell the name rather than the traffic. */
export const THIN_VOLUME = 10;

// Area codes for the states we actually operate in. An UNKNOWN state yields no verdict rather
// than a pass — a check that quietly approves everything it cannot evaluate is worse than none.
const AREA_CODES_BY_STATE: Record<string, string[]> = {
  WA: ['206', '253', '360', '425', '509', '564'],
  AL: ['205', '251', '256', '334', '659', '938'],
  WI: ['262', '274', '414', '534', '608', '715', '920'],
};

/** null = not checked (state unknown to the map). true/false = a real verdict. */
export function areaCodeMatchesState(phone: string | null | undefined, state: string | null | undefined): boolean | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const codes = AREA_CODES_BY_STATE[String(state ?? '').toUpperCase()];
  if (!codes || digits.length < 10) return null;
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return codes.includes(local.slice(0, 3));
}

/**
 * Pick the phrase that proves the ranking. Deliberately the page-one city+trade query with the
 * MOST APPEARANCES, not the best position: a rep says "search this" and the prospect types it, so
 * it has to be a phrase real people search. graftontowing holds position 1.0 on a query with two
 * appearances in a month and 1.7 on one with seven — the second is the honest proof.
 */
function pickProof(queries: GscQuery[], host: string): GscQuery | null {
  const pageOne = queries.filter(
    (q) => q.position <= PAGE_ONE && classifyQuery(q.query, host) === 'city_trade'
  );
  if (!pageOne.length) return null;
  return pageOne.slice().sort((a, b) => b.impressions - a.impressions || a.position - b.position)[0];
}

export function buildRateCardRow(site: GscSite, facts: SiteFacts | undefined): RateCardRow {
  const proof = pickProof(site.queries ?? [], site.host);
  const tier = priceTier((facts?.industryKey ?? 'other') as IndustryKey);

  const city = facts?.city?.trim() || null;
  const state = facts?.state?.trim() || null;
  const phone = facts?.phone?.trim() || null;

  const blockers: Blocker[] = [];
  if (!city || !state) {
    blockers.push({
      id: 'no-service-area',
      severity: 'stop',
      label: 'No city or state on the site — nothing to pitch to a local business',
    });
  }
  if (!phone) {
    blockers.push({ id: 'no-phone', severity: 'stop', label: 'No phone on the site — a caller has no way through' });
  }
  if (areaCodeMatchesState(phone, state) === false) {
    blockers.push({
      id: 'area-code-mismatch',
      severity: 'warn',
      label: `Phone area code does not belong to ${state} — a prospect may spot it before you do`,
    });
  }
  if (proof && proof.impressions < THIN_VOLUME) {
    blockers.push({
      id: 'thin-volume',
      severity: 'warn',
      label: `Only ${proof.impressions} appearances in the window — sell the name, not the traffic`,
    });
  }

  const qualifies = Boolean(proof);
  return {
    host: site.host,
    qualifies,
    proofQuery: proof?.query ?? null,
    proofPosition: proof ? Math.round(proof.position * 10) / 10 : null,
    proofAppearances: proof?.impressions ?? 0,
    otherPageOneQueries: (site.queries ?? [])
      .filter((q) => q.position <= PAGE_ONE && classifyQuery(q.query, site.host) === 'city_trade')
      .map((q) => q.query)
      .filter((q) => q !== proof?.query),
    city,
    state,
    phone,
    fullCents: tier.fullCents,
    lockedCents: tier.lockedCents,
    siteAveragePosition: site.position ?? null,
    blockers,
    pitchable: qualifies && !blockers.some((b) => b.severity === 'stop'),
  };
}

export function buildRateCard(sites: GscSite[], facts: SiteFacts[]): RateCardRow[] {
  const byHost = new Map(facts.map((f) => [f.host.replace(/^www\./, ''), f]));
  return sites
    .map((s) => buildRateCardRow(s, byHost.get(s.host.replace(/^www\./, ''))))
    // Strongest proof first — by appearances, the same honesty ordering pickProof uses.
    .sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.proofAppearances - a.proofAppearances);
}
