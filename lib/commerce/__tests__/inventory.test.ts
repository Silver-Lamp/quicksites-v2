// lib/commerce/__tests__/inventory.test.ts
import { normalizeStock, readItemStock, readItemStockCompat, checkStock, readInventoryPolicy, effectiveItemStock } from '../inventory';

describe('normalizeStock', () => {
  it('treats null/undefined/empty as untracked (null)', () => {
    expect(normalizeStock(null)).toBeNull();
    expect(normalizeStock(undefined)).toBeNull();
    expect(normalizeStock('')).toBeNull();
    expect(normalizeStock('abc')).toBeNull();
  });
  it('coerces to a non-negative integer', () => {
    expect(normalizeStock(5)).toBe(5);
    expect(normalizeStock('3')).toBe(3);
    expect(normalizeStock(2.9)).toBe(2);
    expect(normalizeStock(-4)).toBe(0);
    expect(normalizeStock(0)).toBe(0);
  });
});

describe('readItemStock', () => {
  it('reads metadata.stock, untracked when absent', () => {
    expect(readItemStock({ stock: 7 })).toBe(7);
    expect(readItemStock({})).toBeNull();
    expect(readItemStock(null)).toBeNull();
  });
});

describe('readItemStockCompat (display, honors legacy qty_available)', () => {
  it('prefers the enforced stock field', () => {
    expect(readItemStockCompat({ stock: 7, qty_available: 3 })).toBe(7);
    expect(readItemStockCompat({ stock: 0, qty_available: 9 })).toBe(0); // enforced 0 wins
  });
  it('falls back to legacy qty_available when stock is absent', () => {
    expect(readItemStockCompat({ qty_available: 4 })).toBe(4);
  });
  it('is untracked when neither is present', () => {
    expect(readItemStockCompat({})).toBeNull();
    expect(readItemStockCompat(null)).toBeNull();
  });
});

describe('checkStock', () => {
  it('always allows an untracked line', () => {
    expect(checkStock(null, 999)).toEqual({ ok: true });
  });
  it('rejects when sold out', () => {
    expect(checkStock(0, 1)).toEqual({ ok: false, reason: 'sold_out' });
  });
  it('rejects when requesting more than available', () => {
    expect(checkStock(3, 5)).toEqual({ ok: false, reason: 'insufficient' });
  });
  it('allows up to the available amount', () => {
    expect(checkStock(3, 3)).toEqual({ ok: true });
    expect(checkStock(3, 2)).toEqual({ ok: true });
  });
  it('with the continue (backorder) policy, always allows the sale', () => {
    expect(checkStock(0, 5, 'continue')).toEqual({ ok: true });
    expect(checkStock(2, 10, 'continue')).toEqual({ ok: true });
    // 'deny' (default) still blocks.
    expect(checkStock(0, 1, 'deny')).toEqual({ ok: false, reason: 'sold_out' });
  });
});

describe('readInventoryPolicy', () => {
  it("defaults to 'deny', reads 'continue' from metadata", () => {
    expect(readInventoryPolicy({})).toBe('deny');
    expect(readInventoryPolicy(null)).toBe('deny');
    expect(readInventoryPolicy({ inventory_policy: 'continue' })).toBe('continue');
    expect(readInventoryPolicy({ inventory_policy: 'deny' })).toBe('deny');
  });
});

describe('effectiveItemStock', () => {
  it('is untracked when track_inventory is explicitly false, even with a stock number', () => {
    expect(effectiveItemStock({ stock: 5, track_inventory: false })).toBeNull();
  });
  it('otherwise reads the stock number', () => {
    expect(effectiveItemStock({ stock: 5 })).toBe(5);
    expect(effectiveItemStock({})).toBeNull();
  });
});
