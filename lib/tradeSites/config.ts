// lib/tradeSites/config.ts
//
// Auto-built trade sites: the flags, the price, and what counts as a "trade".
//
// A trade site is a site we built from a public listing for a service business that has no
// transaction to tax — towing, plumbing, HVAC, auto repair, electrical. The restaurant model
// (free site, take-rate on orders) does not transfer, so this has to be SOLD: claim is free, the
// custom-domain tier is a subscription. See docs/TRADE_SITES_PIPELINE.md.
//
// ⚠️ THE PRICE IS A PROPOSAL, and it lives in env so changing it is not a deploy. The business
// plan says $19/mo "for the price of a phone plan"; nobody has paid it yet. Never write the number
// into copy — read it from here, so the plan, the welcome page and Stripe cannot disagree.
import { isPersonIndustry } from '@/lib/sites/personSite';

export const TRADE_SITE_TIER = 'custom_domain' as const;

/** Stripe metadata keys that route a webhook event to this rail rather than the geo rental one. */
export const TRADE_SITE_META_TEMPLATE = 'trade_site_template_id';
export const TRADE_SITE_META_DOMAIN = 'trade_site_domain';

/** Master switch for the paid tier. OFF = the welcome page shows no price and the checkout 403s. */
export function tradeSiteBillingEnabled(): boolean {
  // Read literally, not through a helper: lib/config/__tests__/declarations.test.ts proves every
  // gate key is actually read by scanning for `process.env.<KEY>`, and a dynamic lookup is invisible
  // to it — which would make the boot-time gate cry wolf on a correct deploy.
  const v = process.env.TRADE_SITE_BILLING_ENABLED;
  return v === '1' || v === 'true';
}

/** Monthly price of the custom-domain tier, in cents. Floor $1 so a typo cannot sell for free. */
export function tradeSiteDomainPriceCents(): number {
  const n = Number(process.env.TRADE_SITE_DOMAIN_PRICE_CENTS);
  return Number.isFinite(n) && n >= 100 ? Math.floor(n) : 1900;
}

/**
 * The most we will pay per year to register the domain an owner asks for. At $19/mo a $200/yr
 * premium name loses money; the checkout refuses it rather than eating it silently.
 */
export function tradeSiteMaxDomainPriceUsd(): number {
  const n = Number(process.env.TRADE_SITE_MAX_DOMAIN_PRICE_USD);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/** Industries whose sites are sold some other way (take-rate, person sites) or not at all. */
const NOT_A_TRADE = new Set<string>(['restaurant', 'faith', 'lemonade_stand', 'lemonade']);

/** True for a service business we would sell a custom domain to. */
export function isTradeIndustry(industry: string | null | undefined): boolean {
  if (!industry) return false;
  if (isPersonIndustry(industry)) return false;
  return !NOT_A_TRADE.has(industry);
}

/** A bare apex like `smithtowing.com`. Rejects protocols, paths, www and subdomains. */
export function normalizeApexDomain(input: string): string | null {
  const s = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}$/.test(s)) return null;
  return s;
}

/** Route a Stripe object's metadata to this rail, or null when it belongs to another. */
export function tradeSiteRefFromMetadata(
  meta: Record<string, string | null | undefined> | null | undefined,
): { templateId: string; domain: string | null } | null {
  const templateId = meta?.[TRADE_SITE_META_TEMPLATE];
  if (!templateId) return null;
  return { templateId: String(templateId), domain: meta?.[TRADE_SITE_META_DOMAIN] ? String(meta[TRADE_SITE_META_DOMAIN]) : null };
}
