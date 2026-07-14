// lib/domains/registrar.ts
//
// Provider-agnostic domain registrar: search availability + price, suggest
// alternate TLDs, and purchase a domain end-to-end (buy → attach to project).
//
// The default adapter is **Vercel** because it needs only VERCEL_TOKEN (no
// static-IP allowlist, which Namecheap's API requires and serverless can't
// provide), auto-manages DNS for domains it registers, and attaches to the
// project in the same account. Namecheap remains the operator/bulk path for
// geo-domain land-grabs (see lib/domains/namecheap.ts) — this module does not
// touch it, so the two never fight over credentials.
//
// Purchasing spends real money; the calling route is responsible for the
// admin gate + the VERCEL_DOMAIN_REGISTER_ENABLED flag. This lib assumes the
// caller already authorized the spend.

import { addProjectDomain } from '@/lib/domains/vercel';
import { normalizeApex, withWWW, DOMAIN_RX } from '@/lib/domains/util';

export type RegistrarProvider = 'vercel';

export type DomainAvailability = {
  domain: string;
  available: boolean;
  /** Yearly registration price in whole USD, or null if unknown/unpriced. */
  priceUsd: number | null;
  /** Registration period the price covers, in years. */
  periodYears: number | null;
  /** True when Vercel flags the name as premium (price is often much higher). */
  premium: boolean;
  /**
   * Set when the availability check itself FAILED (auth/scope 403, rate-limit 429, 5xx) —
   * i.e. `available:false` here means "couldn't determine", NOT "registered". Callers must
   * treat an errored result as UNKNOWN, never as taken.
   */
  error?: string;
};

export type RegistrantContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // Vercel wants "+1.4155551234"
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO-2, e.g. "US"
  orgName?: string;
};

export type PurchaseOptions = {
  /** Price the operator saw and approved; guards against a mid-flight price change. */
  expectedPriceUsd?: number | null;
  /** Auto-renew the registration (default true). */
  renew?: boolean;
  /** Attach apex + www to the Vercel project after purchase (default true). */
  attach?: boolean;
};

export type PurchaseResult = {
  ok: boolean;
  domain: string;
  purchased: boolean;
  attached: boolean;
  priceUsd: number | null;
  reason?: string;
};

export const SUGGEST_TLDS = ['com', 'net', 'co', 'io', 'org', 'us'] as const;

/* -------------------------------------------------------------------------- */
/* Vercel adapter                                                             */
/* -------------------------------------------------------------------------- */

const VERCEL_API = 'https://api.vercel.com';

function withTeam(path: string): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return `${VERCEL_API}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${VERCEL_API}${path}${sep}teamId=${encodeURIComponent(teamId)}`;
}

type VercelResult<T> = { ok: boolean; status: number; data: T };

async function vercelFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {}
): Promise<VercelResult<T>> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('Missing VERCEL_TOKEN env');
  const res = await fetch(withTeam(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

// The pre-2025-11-09 /v4/domains/{status,price,buy} endpoints were SUNSETTED; this uses the
// new registrar API (GET /v1/registrar/domains/{domain}/availability + /price, POST …/buy).
// The new availability/price responses carry no "premium" flag, so premium is inferred from
// an unusually high purchase price.
const PREMIUM_PRICE_THRESHOLD_USD = 100;

/** GET /v1/registrar/domains/{domain}/availability (+ /price) — is the name registerable now? */
async function vercelCheckAvailability(apex: string): Promise<DomainAvailability> {
  const path = `/v1/registrar/domains/${encodeURIComponent(apex)}/availability`;
  let status = await vercelFetch<{ available?: boolean }>(path);
  // One retry with a short backoff on rate-limit / transient server errors — a 429 must not
  // be reported as "taken".
  if (!status.ok && (status.status === 429 || status.status >= 500)) {
    await new Promise((r) => setTimeout(r, 600));
    status = await vercelFetch<{ available?: boolean }>(path);
  }

  // A failed check is UNKNOWN, not unavailable — surface the status so callers don't render
  // an errored probe as "Taken".
  if (!status.ok) {
    return {
      domain: apex,
      available: false,
      priceUsd: null,
      periodYears: null,
      premium: false,
      error: `vercel_status_${status.status}`,
    };
  }

  const available = status.data?.available === true;

  let priceUsd: number | null = null;
  let periodYears: number | null = null;
  let premium = false;

  if (available) {
    // GET /v1/registrar/domains/{domain}/price — { years, purchasePrice, renewalPrice, transferPrice }
    const price = await vercelFetch<{ years?: number; purchasePrice?: number }>(
      `/v1/registrar/domains/${encodeURIComponent(apex)}/price?years=1`
    );
    if (price.ok) {
      priceUsd = typeof price.data?.purchasePrice === 'number' ? price.data.purchasePrice : null;
      periodYears = typeof price.data?.years === 'number' ? price.data.years : 1;
      premium = priceUsd != null && priceUsd >= PREMIUM_PRICE_THRESHOLD_USD;
    }
  }

  return { domain: apex, available, priceUsd, periodYears, premium };
}

/** POST /v1/registrar/domains/{domain}/buy — registers the domain into the account/team. */
async function vercelBuy(
  apex: string,
  contact: RegistrantContact,
  expectedPriceUsd: number | null,
  renew: boolean
): Promise<{ ok: boolean; status: number; reason?: string }> {
  // The new registrar API requires expectedPrice (min 0.01) + the contact nested under
  // contactInformation (state/zip naming, ISO-2 country, E.164 phone e.g. "+1.4155551234").
  if (typeof expectedPriceUsd !== 'number' || expectedPriceUsd <= 0) {
    return { ok: false, status: 400, reason: 'missing_expected_price' };
  }
  const body: Record<string, unknown> = {
    autoRenew: renew,
    years: 1,
    expectedPrice: expectedPriceUsd,
    contactInformation: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      address1: contact.address1,
      city: contact.city,
      state: contact.state,
      zip: contact.postalCode,
      country: contact.country,
      ...(contact.orgName ? { companyName: contact.orgName } : {}),
    },
  };

  const res = await vercelFetch<{ orderId?: string; error?: { message?: string }; message?: string; code?: string }>(
    `/v1/registrar/domains/${encodeURIComponent(apex)}/buy`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (res.ok) return { ok: true, status: res.status };
  const reason = res.data?.error?.message || res.data?.message || res.data?.code || `Vercel buy ${res.status}`;
  return { ok: false, status: res.status, reason };
}

/* -------------------------------------------------------------------------- */
/* Registrant contact from env                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reads registrant contact from DOMAIN_REGISTRANT_* env, falling back to the
 * existing NAMECHEAP_REGISTRANT_* vars so a single set of contact details
 * serves both registrars. Returns null (with the missing keys) if incomplete.
 */
export function readRegistrantContact():
  | { ok: true; contact: RegistrantContact }
  | { ok: false; missing: string[] } {
  const pick = (base: string): string =>
    (process.env[`DOMAIN_REGISTRANT_${base}`] ||
      process.env[`NAMECHEAP_REGISTRANT_${base}`] ||
      '').trim();

  const contact: RegistrantContact = {
    firstName: pick('FIRST'),
    lastName: pick('LAST'),
    email: pick('EMAIL'),
    phone: pick('PHONE'),
    address1: pick('ADDRESS'),
    city: pick('CITY'),
    state: pick('STATE'),
    postalCode: pick('ZIP'),
    country: pick('COUNTRY') || 'US',
    orgName: pick('ORG') || undefined,
  };

  const required: Array<[keyof RegistrantContact, string]> = [
    ['firstName', 'FIRST'],
    ['lastName', 'LAST'],
    ['email', 'EMAIL'],
    ['phone', 'PHONE'],
    ['address1', 'ADDRESS'],
    ['city', 'CITY'],
    ['state', 'STATE'],
    ['postalCode', 'ZIP'],
  ];
  const missing = required
    .filter(([key]) => !contact[key])
    .map(([, base]) => `DOMAIN_REGISTRANT_${base}`);

  if (missing.length) return { ok: false, missing };
  return { ok: true, contact };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function getRegistrar(): RegistrarProvider {
  // Only Vercel is wired today; kept as a function so a future Namecheap
  // self-serve adapter can be selected here without touching callers.
  return 'vercel';
}

/** Availability + price for a single, fully-qualified domain. */
export async function checkAvailability(input: string): Promise<DomainAvailability> {
  const apex = normalizeApex(input);
  return vercelCheckAvailability(apex);
}

/**
 * Given a query, return availability for the exact match (if it looks like a
 * full domain) plus alternate-TLD suggestions built from its first label.
 * Deduped, exact-match first, then suggestions in SUGGEST_TLDS order.
 */
export async function suggestDomains(
  query: string,
  opts: { tlds?: readonly string[]; max?: number } = {}
): Promise<DomainAvailability[]> {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return [];

  const tlds = opts.tlds ?? SUGGEST_TLDS;
  const looksFull = DOMAIN_RX.test(raw);
  const base = (looksFull ? raw.split('.')[0] : raw).replace(/[^a-z0-9-]/g, '');
  if (!base) return [];

  const candidates: string[] = [];
  if (looksFull) candidates.push(normalizeApex(raw));
  for (const tld of tlds) {
    const cand = `${base}.${tld}`;
    if (!candidates.includes(cand)) candidates.push(cand);
  }

  const capped = candidates.slice(0, opts.max ?? 8);
  const results = await Promise.all(
    capped.map((c) => vercelCheckAvailability(c).catch(() => null))
  );
  return results.filter((r): r is DomainAvailability => r !== null);
}

/**
 * Buy a domain and (by default) attach apex + www to the Vercel project.
 * Never throws — returns a structured result so the route can report cleanly.
 */
export async function purchaseDomain(
  input: string,
  opts: PurchaseOptions = {}
): Promise<PurchaseResult> {
  let apex: string;
  try {
    apex = normalizeApex(input);
  } catch {
    return { ok: false, domain: String(input), purchased: false, attached: false, priceUsd: null, reason: 'invalid_domain' };
  }

  const registrant = readRegistrantContact();
  if (!registrant.ok) {
    return {
      ok: false,
      domain: apex,
      purchased: false,
      attached: false,
      priceUsd: null,
      reason: `missing_registrant_contact: ${registrant.missing.join(', ')}`,
    };
  }

  // Re-check availability so we never attempt to buy a taken name and so we
  // can price-match against what the operator approved.
  const avail = await vercelCheckAvailability(apex);
  if (!avail.available) {
    return { ok: false, domain: apex, purchased: false, attached: false, priceUsd: avail.priceUsd, reason: 'unavailable' };
  }
  if (
    typeof opts.expectedPriceUsd === 'number' &&
    typeof avail.priceUsd === 'number' &&
    avail.priceUsd > opts.expectedPriceUsd
  ) {
    return {
      ok: false,
      domain: apex,
      purchased: false,
      attached: false,
      priceUsd: avail.priceUsd,
      reason: `price_changed: now $${avail.priceUsd}, approved $${opts.expectedPriceUsd}`,
    };
  }

  const bought = await vercelBuy(apex, registrant.contact, avail.priceUsd, opts.renew ?? true);
  if (!bought.ok) {
    return { ok: false, domain: apex, purchased: false, attached: false, priceUsd: avail.priceUsd, reason: bought.reason };
  }

  // Attach to the project so the site serves immediately. DNS is auto-managed
  // by Vercel for domains registered here, so no manual records are needed.
  let attached = false;
  if (opts.attach !== false) {
    try {
      await addProjectDomain(apex);
      await addProjectDomain(withWWW(apex));
      attached = true;
    } catch (err) {
      // Non-fatal: the domain is bought; connect can be retried from the panel.
      console.warn('purchaseDomain: attach failed', err);
    }
  }

  return { ok: true, domain: apex, purchased: true, attached, priceUsd: avail.priceUsd };
}
