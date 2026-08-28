// lib/commerce/quoteEstimator.ts
//
// The multi-trade generalization of the deck estimator (contract:
// crosstalk/contracts/quote-estimate-embed.md — supersedes deck-estimate-embed.md,
// deck is now the `trade:"deck"` case). ONE endpoint, ONE proxy, ONE attribution key,
// ONE response contract — each trade is a net-new DeckSketch parametric model; only the
// QS rendering is config, and THIS registry is that config.
//
// GATING: `live` says whether DeckSketch's model for a trade is deployed. ALL 9 trades
// went LIVE + prod-verified 2026-07-17 (DeckSketch deployed enh-multi-trade-estimate;
// contract quote-estimate-embed.md Status: LIVE) — every trade's first call hit byte-parity
// with its contract sample. `live` stays as the switch: if DeckSketch ever pulls a trade,
// flip it false and QS stops offering it (gated 400, no speculative call).

import { DECK_ESTIMATE_BASE_URL } from './deckEstimate';

export type TradeKey =
  | 'deck'
  | 'fence'
  | 'concrete_patio'
  | 'turf'
  | 'epoxy_floor'
  | 'paving'
  // v2 ("messier" trades — built + verified, gated with the rest until deploy)
  | 'roofing'
  | 'siding'
  | 'retaining_wall';

export type FieldDef = {
  key: string; // the body field name sent to /api/estimate
  label: string;
  type: 'number' | 'select' | 'boolean';
  unit?: string; // 'ft' | 'in'
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  required?: boolean; // required vs. optional refiner
  min?: number;
};

export type TradeDef = {
  key: TradeKey;
  label: string;
  /** DeckSketch's model for this trade is deployed + smokeable. Flip on their deploy ping. */
  live: boolean;
  /** Whether this trade takes an area input (sqft OR length_ft×width_ft). */
  area: boolean;
  /** At least one of these fields must be present (e.g. roofing: squares OR roof_sqft). */
  requiresOneOf?: string[];
  /** Non-area fields (dimensions/enums/refiners), in display order. */
  fields: FieldDef[];
};

const MATERIAL = (options: [string, string][], def?: string): FieldDef => ({
  key: 'material',
  label: 'Material',
  type: 'select',
  options: options.map(([value, label]) => ({ value, label })),
  ...(def ? { default: def } : {}),
  required: true,
});

// Faithful to the contract's per-trade field table. Materials-only pricing (per the
// open calibration note — a shift to installed pricing is a DeckSketch coeff_version
// bump, not a shape change here).
export const TRADE_REGISTRY: Record<TradeKey, TradeDef> = {
  deck: {
    key: 'deck',
    label: 'Deck',
    live: true,
    area: true,
    fields: [
      {
        key: 'height_ft',
        label: 'Height',
        type: 'number',
        unit: 'ft',
        default: 2,
        required: true,
        min: 0,
      },
      {
        key: 'attached',
        label: 'Attached to the house',
        type: 'boolean',
        default: true,
        required: true,
      },
      {
        key: 'material_tier',
        label: 'Material',
        type: 'select',
        required: true,
        default: 'pressure_treated',
        options: [
          { value: 'pressure_treated', label: 'Pressure-treated' },
          { value: 'cedar', label: 'Cedar' },
          { value: 'composite', label: 'Composite' },
        ],
      },
      { key: 'stairs', label: 'Stairs', type: 'boolean' },
      { key: 'railing_ft', label: 'Railing', type: 'number', unit: 'ft', min: 0 },
    ],
  },
  fence: {
    key: 'fence',
    label: 'Fence',
    live: true,
    area: false,
    fields: [
      { key: 'linear_ft', label: 'Length', type: 'number', unit: 'ft', required: true, min: 0 },
      MATERIAL([
        ['wood_pt', 'Wood (pressure-treated)'],
        ['cedar', 'Cedar'],
        ['vinyl', 'Vinyl'],
        ['chain_link', 'Chain link'],
        ['aluminum', 'Aluminum'],
      ]),
      { key: 'height_ft', label: 'Height', type: 'number', unit: 'ft', default: 6, min: 0 },
      { key: 'gates', label: 'Gates', type: 'number', min: 0 },
    ],
  },
  concrete_patio: {
    key: 'concrete_patio',
    label: 'Concrete patio',
    live: true,
    area: true,
    fields: [
      { key: 'thickness_in', label: 'Thickness', type: 'number', unit: 'in', default: 4, min: 0 },
      {
        key: 'finish',
        label: 'Finish',
        type: 'select',
        default: 'broom',
        options: [
          { value: 'broom', label: 'Broom' },
          { value: 'colored', label: 'Colored' },
          { value: 'exposed_aggregate', label: 'Exposed aggregate' },
          { value: 'stamped', label: 'Stamped' },
        ],
      },
    ],
  },
  turf: {
    key: 'turf',
    label: 'Artificial turf',
    live: true,
    area: true,
    fields: [
      {
        key: 'pile',
        label: 'Pile',
        type: 'select',
        default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'premium', label: 'Premium' },
          { value: 'putting', label: 'Putting green' },
        ],
      },
    ],
  },
  epoxy_floor: {
    key: 'epoxy_floor',
    label: 'Epoxy floor',
    live: true,
    area: true,
    fields: [
      {
        key: 'system',
        label: 'System',
        type: 'select',
        default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'flake', label: 'Flake' },
          { value: 'metallic', label: 'Metallic' },
        ],
      },
      { key: 'grind_prep', label: 'Grind prep', type: 'boolean' },
    ],
  },
  paving: {
    key: 'paving',
    label: 'Paving',
    live: true,
    area: true,
    fields: [
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        default: 'concrete',
        options: [
          { value: 'gravel', label: 'Gravel' },
          { value: 'asphalt', label: 'Asphalt' },
          { value: 'concrete', label: 'Concrete' },
          { value: 'pavers', label: 'Pavers' },
        ],
      },
      { key: 'depth_in', label: 'Depth', type: 'number', unit: 'in', min: 0 },
    ],
  },
  roofing: {
    key: 'roofing',
    label: 'Roofing',
    live: true,
    area: false,
    requiresOneOf: ['squares', 'roof_sqft'],
    fields: [
      { key: 'squares', label: 'Roofing squares', type: 'number', min: 0 },
      { key: 'roof_sqft', label: 'Roof area', type: 'number', unit: 'sq ft', min: 0 },
      MATERIAL([
        ['asphalt_shingle', 'Asphalt shingle'],
        ['architectural_shingle', 'Architectural shingle'],
        ['metal', 'Metal'],
        ['tile', 'Tile'],
        ['flat_membrane', 'Flat membrane'],
      ]),
      {
        key: 'pitch',
        label: 'Pitch',
        type: 'select',
        default: 'medium',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'steep', label: 'Steep' },
        ],
      },
      { key: 'tear_off', label: 'Tear off the old roof', type: 'boolean' },
    ],
  },
  siding: {
    key: 'siding',
    label: 'Siding',
    live: true,
    area: true,
    fields: [
      MATERIAL([
        ['vinyl', 'Vinyl'],
        ['wood', 'Wood'],
        ['fiber_cement', 'Fiber cement'],
        ['stucco', 'Stucco'],
        ['brick_veneer', 'Brick veneer'],
      ]),
      { key: 'stories', label: 'Stories', type: 'number', default: 1, min: 0 },
      { key: 'trim_lf', label: 'Trim', type: 'number', unit: 'ft', min: 0 },
    ],
  },
  retaining_wall: {
    // Above 4 ft, DeckSketch auto-adds an engineering + drainage factor (surfaced in
    // `assumptions`) — the honest handling of the "swings 2-3×" concern. QS just renders it.
    key: 'retaining_wall',
    label: 'Retaining wall',
    live: true,
    area: false,
    fields: [
      { key: 'length_ft', label: 'Length', type: 'number', unit: 'ft', required: true, min: 0 },
      { key: 'height_ft', label: 'Height', type: 'number', unit: 'ft', required: true, min: 0 },
      MATERIAL([
        ['timber', 'Timber'],
        ['block_concrete', 'Concrete block'],
        ['poured_concrete', 'Poured concrete'],
        ['natural_stone', 'Natural stone'],
      ]),
    ],
  },
};

export const ALL_TRADES = Object.keys(TRADE_REGISTRY) as TradeKey[];
export const isTradeKey = (v: unknown): v is TradeKey =>
  typeof v === 'string' && v in TRADE_REGISTRY;
export const tradeDef = (k: TradeKey): TradeDef => TRADE_REGISTRY[k];
export const isLiveTrade = (k: string): boolean => isTradeKey(k) && TRADE_REGISTRY[k].live;
/** Trades whose DeckSketch model is deployed — the only ones we ever offer/estimate. */
export const liveTrades = (): TradeDef[] =>
  ALL_TRADES.map((k) => TRADE_REGISTRY[k]).filter((t) => t.live);

const num = (v: unknown): number | undefined => {
  const n =
    typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Whitelist + coerce a raw client payload into the trade's estimate body (drops junk/PII).
 * Area trades accept sqft OR length_ft×width_ft; every trade includes its registry fields.
 */
export function normalizeTradeInput(trade: TradeKey, raw: any): Record<string, any> {
  const def = TRADE_REGISTRY[trade];
  const out: Record<string, any> = {};
  if (def.area) {
    const l = num(raw?.length_ft);
    const w = num(raw?.width_ft);
    const sqft = num(raw?.sqft);
    if (l && w) {
      out.length_ft = l;
      out.width_ft = w;
    } else if (sqft) {
      out.sqft = sqft;
    }
  }
  for (const f of def.fields) {
    const v = raw?.[f.key];
    if (f.type === 'boolean') {
      if (typeof v === 'boolean') out[f.key] = v;
    } else if (f.type === 'select') {
      const ok = f.options?.some((o) => o.value === v);
      if (ok) out[f.key] = v;
    } else {
      const n = num(v);
      if (n != null) out[f.key] = n;
    }
  }
  return out;
}

/** Enough inputs to estimate: area trades need area; all trades need their required fields. */
export function hasRequiredInputs(trade: TradeKey, body: Record<string, any>): boolean {
  const def = TRADE_REGISTRY[trade];
  if (def.area) {
    const hasArea = !!body.sqft || (!!body.length_ft && !!body.width_ft);
    if (!hasArea) return false;
  }
  if (def.requiresOneOf && !def.requiresOneOf.some((k) => body[k] != null)) return false;
  for (const f of def.fields) {
    if (f.required && body[f.key] == null) return false;
  }
  return true;
}

export type QuoteEstimateResult = {
  estimate_id: string;
  trade?: string;
  coeff_version?: string;
  low_cents: number;
  high_cents: number;
  currency: string;
  label: string;
  confidence: 'rough' | 'refined';
  assumptions: string[];
};

export type QuoteEstimateResponse =
  | { ok: true; estimate: QuoteEstimateResult }
  | { ok: false; status: number; error: string };

/**
 * Server-to-server POST to DeckSketch /api/estimate for any LIVE trade. Sends `trade` +
 * the normalized body + `site_ref` (attached server-side, unspoofable). Deck omits the
 * `trade` field to stay byte-identical to the shipped deck caller (contract: absent ⇒ deck).
 */
export async function requestQuoteEstimate(
  trade: TradeKey,
  input: Record<string, any>,
  siteRef: string,
  signal?: AbortSignal
): Promise<QuoteEstimateResponse> {
  const url = `${DECK_ESTIMATE_BASE_URL}/api/estimate`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (siteRef) headers['X-QS-Site-Ref'] = siteRef;
  const body: Record<string, any> = { ...input };
  if (trade !== 'deck') body.trade = trade; // deck stays absent for back-compat
  if (siteRef) body.site_ref = siteRef;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof j?.error === 'string' ? j.error : 'estimate_failed',
      };
    }
    return { ok: true, estimate: j as QuoteEstimateResult };
  } catch {
    return { ok: false, status: 502, error: 'estimate_unavailable' };
  }
}
