// lib/commerce/__tests__/inventory.test.ts
import { normalizeStock, readItemStock, checkStock, applyStockDecrements } from '../inventory';

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
});

describe('applyStockDecrements', () => {
  it('decrements item-level stock and clamps at 0', () => {
    const r = applyStockDecrements({ stock: 5 }, [{ quantity: 2 }]);
    expect(r.changed).toBe(true);
    expect(r.metadata.stock).toBe(3);
    const r2 = applyStockDecrements({ stock: 1 }, [{ quantity: 5 }]);
    expect(r2.metadata.stock).toBe(0); // clamped, no negative
  });

  it('decrements a specific variant SKU by id, leaving others + untracked ones alone', () => {
    const meta = {
      variants: [
        { id: 's', stock: 4 },
        { id: 'm', stock: 2 },
        { id: 'l' }, // untracked
      ],
    };
    const r = applyStockDecrements(meta, [{ variantId: 'm', quantity: 1 }, { variantId: 'l', quantity: 3 }]);
    expect(r.changed).toBe(true);
    const byId = Object.fromEntries((r.metadata.variants as any[]).map((v) => [v.id, v.stock]));
    expect(byId).toEqual({ s: 4, m: 1, l: undefined }); // only m changed; l stays untracked
  });

  it('does not touch untracked item stock and reports no change', () => {
    const r = applyStockDecrements({ title: 'x' }, [{ quantity: 3 }]);
    expect(r.changed).toBe(false);
    expect(r.metadata.stock).toBeUndefined();
  });

  it('never mutates the input metadata', () => {
    const meta = { stock: 5, variants: [{ id: 's', stock: 4 }] };
    applyStockDecrements(meta, [{ quantity: 1 }, { variantId: 's', quantity: 1 }]);
    expect(meta.stock).toBe(5);
    expect(meta.variants[0].stock).toBe(4);
  });

  it('ignores zero/negative quantities', () => {
    const r = applyStockDecrements({ stock: 5 }, [{ quantity: 0 }, { quantity: -3 }]);
    expect(r.changed).toBe(false);
    expect(r.metadata.stock).toBe(5);
  });
});
