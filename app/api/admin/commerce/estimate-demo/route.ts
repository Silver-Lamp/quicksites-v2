// app/api/admin/commerce/estimate-demo/route.ts
//
// Green-path health check for the DeckSketch multi-trade estimator seam (§5b pattern —
// admin-gated, in-app, asserts the numbers). Runs a representative request for EVERY
// live trade through the same server-side path the proxy uses, and asserts each returns
// a valid range (low < high, a label, the right `trade` echoed). One click confirms
// "the whole estimator seam is healthy" — deck + 8 trades — against the live endpoint.
//
// PII-free + free (no money, no vendor cost) — the estimate endpoint is stateless.
// Optional { trade } to check a single trade; { expectParity } to also assert each range
// matches the contract's verified sample (catches a coeff_version drift on DeckSketch's side).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { DECK_ESTIMATE_BASE_URL } from '@/lib/commerce/deckEstimate';
import {
  ALL_TRADES,
  isTradeKey,
  isLiveTrade,
  normalizeTradeInput,
  requestQuoteEstimate,
  type TradeKey,
} from '@/lib/commerce/quoteEstimator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Representative inputs per trade + the contract's verified sample cents (for parity).
const SAMPLES: Record<TradeKey, { input: Record<string, any>; low: number; high: number }> = {
  deck: { input: { length_ft: 16, width_ft: 20, height_ft: 3, attached: true, material_tier: 'pressure_treated' }, low: 298454, high: 466812 },
  fence: { input: { linear_ft: 150, height_ft: 6, material: 'cedar', gates: 2 }, low: 403680, high: 524320 },
  concrete_patio: { input: { sqft: 400, thickness_in: 6, finish: 'stamped' }, low: 709920, high: 922080 },
  turf: { input: { sqft: 500, pile: 'putting' }, low: 609000, high: 791000 },
  epoxy_floor: { input: { sqft: 600, system: 'metallic', grind_prep: true }, low: 587250, high: 762750 },
  paving: { input: { sqft: 800, material: 'pavers' }, low: 1044000, high: 1356000 },
  roofing: { input: { squares: 20, material: 'architectural_shingle', pitch: 'steep', tear_off: true }, low: 418644, high: 543756 },
  siding: { input: { sqft: 1800, material: 'fiber_cement', stories: 2, trim_lf: 120 }, low: 1182330, high: 1535670 },
  retaining_wall: { input: { length_ft: 40, height_ft: 6, material: 'natural_stone' }, low: 1550340, high: 2013660 },
};

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const only = typeof body?.trade === 'string' && isTradeKey(body.trade) ? (body.trade as TradeKey) : null;
  const expectParity = body?.expectParity === true;
  const siteRef = 'qs_estimate_demo';

  const trades = (only ? [only] : ALL_TRADES).filter((t) => isLiveTrade(t));

  const results = await Promise.all(
    trades.map(async (trade) => {
      const sample = SAMPLES[trade];
      // Parity samples are the MATERIALS basis; pin to it so parity survives the
      // installed-pricing default switch (DeckSketch bumped coeff_version v1→v2).
      const input = { ...normalizeTradeInput(trade, sample.input), ...(expectParity ? { pricing_mode: 'materials' } : {}) };
      const r = await requestQuoteEstimate(trade, input, siteRef);
      if (!r.ok) return { trade, ok: false, error: r.error, status: r.status };
      const e = r.estimate;
      const validRange = Number.isFinite(e.low_cents) && Number.isFinite(e.high_cents) && e.low_cents > 0 && e.low_cents < e.high_cents;
      const hasLabel = typeof e.label === 'string' && e.label.length > 0;
      const tradeEcho = trade === 'deck' ? true : e.trade === trade; // deck omits `trade` (back-compat)
      const parity = !expectParity || (e.low_cents === sample.low && e.high_cents === sample.high);
      return {
        trade,
        ok: validRange && hasLabel && tradeEcho && parity,
        label: e.label,
        low_cents: e.low_cents,
        high_cents: e.high_cents,
        coeff_version: e.coeff_version ?? null,
        ...(expectParity ? { parity, expected: { low: sample.low, high: sample.high } } : {}),
        ...(validRange && hasLabel && tradeEcho ? {} : { checks: { validRange, hasLabel, tradeEcho } }),
      };
    }),
  );

  const passed = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: passed === results.length,
    endpoint: `${DECK_ESTIMATE_BASE_URL}/api/estimate`,
    summary: `${passed}/${results.length} trades healthy`,
    expectParity,
    results,
  });
}
