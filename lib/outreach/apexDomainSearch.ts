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
import { geoDomainFor, restaurantApexCandidates, apexSlugForDomain } from '@/lib/outreach/geoDomain';
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
  // ⚠️ Plural first — see restaurantApexCandidates(). An explicit override (an area card passing
  // its own domain) is honoured as the only candidate rather than being reordered underneath the
  // operator.
  const override = normalizeDomain(input.domain || '') || null;
  const candidates = override
    ? [{ domain: override, slug: apexSlugForDomain(override) }]
    : restaurantApexCandidates(city);
  const primary = candidates[0];
  const domain = primary.domain;
  const purchase = domainPurchaseFlags();

  const base: ApexDomainSearchResult = {
    domain,
    slug: primary.slug,
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

  // 1) A campaign already runs on one of them — ours, whatever the ledger says.
  //
  // ⚠️ Checks EVERY candidate, not just the preferred one. Renton's contest sits on the singular;
  // if a plural-first search only asked about `renton-restaurants.com` it would come back
  // "available" for a city we already run a contest in, and the obvious next click buys a second
  // domain for it. Which form we prefer must not change which cities we can see we already own.
  const all = candidates.map((c) => c.domain);
  try {
    const { data: campaign } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id, kind, domain')
      .in('domain', all)
      .limit(1)
      .maybeSingle();
    if (campaign) {
      const hit = candidates.find((c) => c.domain === (campaign as any).domain) ?? primary;
      return {
        ...base,
        domain: hit.domain,
        slug: hit.slug,
        status: 'contest',
        campaignId: campaign.id,
        campaignKind: (campaign as any).kind ?? null,
      };
    }
  } catch {
    /* fall through to the ledger/registrar */
  }

  // 2) In the owned-domains ledger (bought earlier, contest not launched yet).
  try {
    const { data: owned } = await supabaseAdmin
      .from('owned_domains')
      .select('domain')
      .in('domain', all)
      .limit(1)
      .maybeSingle();
    if (owned) {
      const hit = candidates.find((c) => c.domain === (owned as any).domain) ?? primary;
      return { ...base, domain: hit.domain, slug: hit.slug, status: 'owned' };
    }
  } catch {
    /* fall through to the registrar */
  }

  // 3) Registrar availability + price. No token = unknown, never "taken".
  if (!process.env.VERCEL_TOKEN) {
    return { ...base, error: 'missing_vercel_token' };
  }
  // 3) Registrar, in preference order. The first available candidate becomes the answer; the
  // others are reported as `alt` so the operator can see the whole picture rather than one verdict.
  let firstError: string | null = null;
  const probed: ApexAltResult[] = [];
  for (const c of candidates) {
    const a = await checkAvailability(c.domain);
    if (a.error) {
      firstError = firstError ?? a.error;
      continue;
    }
    probed.push({ domain: c.domain, available: a.available, priceUsd: a.priceUsd, premium: a.premium });
    if (a.available) {
      const others = probed.filter((p) => p.domain !== c.domain);
      return {
        ...base,
        domain: c.domain,
        slug: c.slug,
        status: 'available',
        priceUsd: a.priceUsd,
        premium: a.premium,
        alt: others[0] ?? null,
      };
    }
  }
  if (!probed.length) return { ...base, error: firstError ?? 'registrar_unavailable' };
  // Everything we could check is taken. Report the preferred one as the subject, and any other
  // probed form as the alt (it is taken too, but the operator asked about this city, not this word).
  return { ...base, status: 'taken', alt: probed.find((p) => p.domain !== base.domain) ?? null };
}
