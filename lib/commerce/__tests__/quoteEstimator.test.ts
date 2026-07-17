/**
 * @jest-environment node
 */
// lib/commerce/__tests__/quoteEstimator.test.ts
//
// The multi-trade estimator registry (contract quote-estimate-embed.md). Pins the
// gating (only deck is live until DeckSketch deploys the phase-1 models), the input
// whitelist/coercion per trade, and the required-field check. No network — these are
// the pure config that decides what QS will offer + send.

import {
  TRADE_REGISTRY,
  ALL_TRADES,
  isTradeKey,
  isLiveTrade,
  liveTrades,
  normalizeTradeInput,
  hasRequiredInputs,
} from '@/lib/commerce/quoteEstimator';

describe('trade gating', () => {
  it('only deck is live until DeckSketch deploys the phase-1 models', () => {
    expect(isLiveTrade('deck')).toBe(true);
    for (const t of ['fence', 'concrete_patio', 'turf', 'epoxy_floor', 'paving']) {
      expect(isLiveTrade(t)).toBe(false);
    }
    expect(liveTrades().map((t) => t.key)).toEqual(['deck']);
  });
  it('rejects unknown trades', () => {
    expect(isTradeKey('roofing')).toBe(false); // v2, not built
    expect(isTradeKey('solar')).toBe(false); // out of scope
    expect(isTradeKey('deck')).toBe(true);
  });
  it('registers all 6 phase-1 trades with contract-accurate enums', () => {
    expect(ALL_TRADES).toHaveLength(6);
    const fenceMat = TRADE_REGISTRY.fence.fields.find((f) => f.key === 'material');
    expect(fenceMat?.options?.map((o) => o.value)).toEqual(['wood_pt', 'cedar', 'vinyl', 'chain_link', 'aluminum']);
  });
});

describe('normalizeTradeInput', () => {
  it('whitelists fence fields + coerces, dropping junk', () => {
    const body = normalizeTradeInput('fence', {
      linear_ft: '150', material: 'cedar', height_ft: 6, gates: 2,
      evil: 'DROP ME', sqft: 999, // fence isn't an area trade → sqft ignored
    });
    expect(body).toEqual({ linear_ft: 150, material: 'cedar', height_ft: 6, gates: 2 });
    expect((body as any).evil).toBeUndefined();
    expect((body as any).sqft).toBeUndefined();
  });
  it('accepts sqft OR length×width for area trades and rejects bad enums', () => {
    const a = normalizeTradeInput('concrete_patio', { sqft: 400, finish: 'stamped', thickness_in: 6 });
    expect(a).toEqual({ sqft: 400, finish: 'stamped', thickness_in: 6 });
    const b = normalizeTradeInput('concrete_patio', { length_ft: 20, width_ft: 20, finish: 'not_a_finish' });
    expect(b).toEqual({ length_ft: 20, width_ft: 20 }); // bad enum dropped
  });
});

describe('hasRequiredInputs', () => {
  it('fence needs linear_ft + material', () => {
    expect(hasRequiredInputs('fence', { linear_ft: 150, material: 'cedar' })).toBe(true);
    expect(hasRequiredInputs('fence', { linear_ft: 150 })).toBe(false); // no material
  });
  it('area trades need an area', () => {
    expect(hasRequiredInputs('turf', { sqft: 500 })).toBe(true);
    expect(hasRequiredInputs('turf', {})).toBe(false);
  });
});
