// lib/commerce/deckEstimate.ts
//
// Server-side helper for the DeckSketch "instant deck estimate" seam
// (crosstalk/contracts/deck-estimate-embed.md, Status: LIVE). Tier A = a
// stateless, PII-free ballpark: dimensions in → price RANGE out, backed by
// DeckSketch's BOM engine. QuickSites proxies this server-to-server (the
// endpoint stays off the public browser surface) and renders its own UI.
//
// THE CUTOVER KNOB: the DeckSketch base URL is ONE config value here. Today it's
// the preview host; when DeckSketch moves to https://app.decksketch.ai the switch
// is a single env edit (DECK_ESTIMATE_BASE_URL), not a code change — as requested
// in the contract's "Open items".

/** Single source of truth for the DeckSketch host. One env edit = full cutover. */
export const DECK_ESTIMATE_BASE_URL =
  (process.env.DECK_ESTIMATE_BASE_URL || 'https://decksketch-preview.vercel.app').replace(/\/+$/, '');

export const MATERIAL_TIERS = ['pressure_treated', 'cedar', 'composite'] as const;
export type MaterialTier = (typeof MATERIAL_TIERS)[number];

/** Inputs QS forwards to /api/estimate. `site_ref` is attached server-side (never client-trusted). */
export type DeckEstimateInput = {
  sqft?: number;
  length_ft?: number;
  width_ft?: number;
  height_ft?: number;
  attached?: boolean;
  material_tier?: MaterialTier;
  // refiners
  stairs?: boolean | number;
  railing_ft?: number;
  zip?: string;
};

/** The verified DeckSketch response shape (contract §/estimate → 200). */
export type DeckEstimateResult = {
  estimate_id: string;
  low_cents: number;
  high_cents: number;
  currency: string;
  label: string;
  confidence: 'rough' | 'refined';
  assumptions: string[];
};

export type DeckEstimateResponse =
  | { ok: true; estimate: DeckEstimateResult }
  | { ok: false; status: number; error: string };

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Whitelist + coerce the client payload into a clean estimate body (drops junk/PII). */
export function normalizeEstimateInput(body: any): DeckEstimateInput {
  const out: DeckEstimateInput = {};
  const sqft = num(body?.sqft);
  const length_ft = num(body?.length_ft);
  const width_ft = num(body?.width_ft);
  if (length_ft && width_ft) {
    out.length_ft = length_ft;
    out.width_ft = width_ft;
  } else if (sqft) {
    out.sqft = sqft;
  }
  const height_ft = num(body?.height_ft);
  if (height_ft) out.height_ft = height_ft;
  if (typeof body?.attached === 'boolean') out.attached = body.attached;
  if ((MATERIAL_TIERS as readonly string[]).includes(body?.material_tier)) out.material_tier = body.material_tier;
  // refiners
  if (typeof body?.stairs === 'boolean') out.stairs = body.stairs;
  else if (num(body?.stairs) != null) out.stairs = num(body?.stairs);
  const railing_ft = num(body?.railing_ft);
  if (railing_ft) out.railing_ft = railing_ft;
  if (typeof body?.zip === 'string' && /^\d{5}$/.test(body.zip.trim())) out.zip = body.zip.trim();
  return out;
}

/** True when the payload has enough to get a ballpark (area + tier). */
export function hasMinimumInputs(i: DeckEstimateInput): boolean {
  const hasArea = !!i.sqft || (!!i.length_ft && !!i.width_ft);
  return hasArea && !!i.material_tier;
}

/**
 * Server-to-server POST to DeckSketch /api/estimate. `siteRef` is the QS
 * template id — attached here (body + X-QS-Site-Ref header) so the browser can't
 * spoof attribution. v1 has no API key (per-IP throttle only on their side).
 */
export async function requestDeckEstimate(
  input: DeckEstimateInput,
  siteRef: string,
  signal?: AbortSignal,
): Promise<DeckEstimateResponse> {
  const url = `${DECK_ESTIMATE_BASE_URL}/api/estimate`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (siteRef) headers['X-QS-Site-Ref'] = siteRef;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(siteRef ? { ...input, site_ref: siteRef } : input),
      signal,
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: typeof j?.error === 'string' ? j.error : 'estimate_failed' };
    }
    return { ok: true, estimate: j as DeckEstimateResult };
  } catch {
    return { ok: false, status: 502, error: 'estimate_unavailable' };
  }
}
