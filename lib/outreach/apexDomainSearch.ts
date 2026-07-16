// lib/outreach/apexDomainSearch.ts
//
// "Is the apex for this city ours / buyable?" — the one question both restaurant
// growth surfaces ask: the prospects sweep (check the apex the moment a city is
// swept) and the Location Domains cockpit (per-area check + buy). Resolves the
// canonical <city>-restaurant.com through three layers:
//   1. a geo campaign already runs on it            → 'contest' (link to the card)
//   2. it's in our owned_domains ledger             → 'owned' (launch the contest)
//   3. the Vercel registrar availability + price    → 'available' / 'taken' / 'unknown'
// When the canonical is taken, the plural alt (<city>-restaurants.com) is probed as
// a fallback candidate. Read-only — buying happens in the buy-apex route.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { geoDomainFor } from '@/lib/outreach/geoDomain';
import { normalizeDomain } from '@/lib/prospects/ownedDomains';
import { checkAvailability, readRegistrantContact } from '@/lib/domains/registrar';

export type ApexAltResult = {
  domain: string;
  available: boolean;
  priceUsd: number | null;
  premium: boolean;
};

export type ApexDomainSearchResult = {
  /** The canonical apex checked (<city>-restaurant.com, or the caller's override). */
  domain: string;
  slug: string;
  city: string;
  region: string | null;
  status: 'contest' | 'owned' | 'available' | 'taken' | 'unknown';
  /** Set when a geo campaign already runs on the domain. */
  campaignId: string | null;
  campaignKind: string | null;
  priceUsd: number | null;
  premium: boolean;
  /** Plural fallback (<city>-restaurants.com), probed only when the canonical is taken. */
  alt: ApexAltResult | null;
  /** Whether the one-click buy path is usable (flag + registrant contact). */
  purchase: { enabled: boolean; registerFlag: boolean; contactReady: boolean };
  /** Present when status is 'unknown' (no token / registrar error) — never render as taken. */
  error?: string;
};

export function domainPurchaseFlags(): ApexDomainSearchResult['purchase'] {
  const registerFlag =
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true';
  const contactReady = readRegistrantContact().ok;
  return { enabled: registerFlag && contactReady, registerFlag, contactReady };
}

/**
 * Search the restaurant apex for a city (or an explicit domain override from an
 * area card). Never throws; registrar failures come back as status 'unknown'.
 */
export async function searchRestaurantApex(input: {
  city: string;
  region?: string | null;
  /** Check this exact domain instead of the derived canonical (area cards pass theirs). */
  domain?: string | null;
}): Promise<ApexDomainSearchResult> {
  const city = input.city.trim();
  const derived = geoDomainFor(city, 'restaurant');
  const domain = normalizeDomain(input.domain || derived.domain) || derived.domain;
  const purchase = domainPurchaseFlags();

  const base: ApexDomainSearchResult = {
    domain,
    slug: derived.slug,
    city,
    region: input.region?.trim() || null,
    status: 'unknown',
    campaignId: null,
    campaignKind: null,
    priceUsd: null,
    premium: false,
    alt: null,
    purchase,
  };

  // 1) A campaign already runs on it — ours, whatever the ledger says.
  try {
    const { data: campaign } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id, kind')
      .eq('domain', domain)
      .maybeSingle();
    if (campaign) {
      return { ...base, status: 'contest', campaignId: campaign.id, campaignKind: campaign.kind ?? null };
    }
  } catch {
    /* fall through to the ledger/registrar */
  }

  // 2) In the owned-domains ledger (bought earlier, contest not launched yet).
  try {
    const { data: owned } = await supabaseAdmin
      .from('owned_domains')
      .select('domain')
      .eq('domain', domain)
      .maybeSingle();
    if (owned) return { ...base, status: 'owned' };
  } catch {
    /* fall through to the registrar */
  }

  // 3) Registrar availability + price. No token = unknown, never "taken".
  if (!process.env.VERCEL_TOKEN) {
    return { ...base, error: 'missing_vercel_token' };
  }
  const avail = await checkAvailability(domain);
  if (avail.error) return { ...base, error: avail.error };
  if (avail.available) {
    return { ...base, status: 'available', priceUsd: avail.priceUsd, premium: avail.premium };
  }

  // Canonical taken → probe the plural fallback so the operator still gets a candidate.
  let alt: ApexAltResult | null = null;
  const plural = `${derived.slug}s.com`;
  if (plural !== domain) {
    const altAvail = await checkAvailability(plural);
    if (!altAvail.error) {
      alt = { domain: plural, available: altAvail.available, priceUsd: altAvail.priceUsd, premium: altAvail.premium };
    }
  }
  return { ...base, status: 'taken', alt };
}
