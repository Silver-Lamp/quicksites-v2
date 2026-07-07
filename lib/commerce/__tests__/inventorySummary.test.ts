// lib/commerce/__tests__/inventorySummary.test.ts
import { summarizeInventoryRow, DEFAULT_LOW_STOCK } from '../inventorySummary';

const item = (metadata: any) => ({ id: 'i1', title: 'Widget', type: 'product', status: 'active', metadata });

describe('summarizeInventoryRow', () => {
  it('reads plain-item on-hand and flags low/out', () => {
    expect(summarizeInventoryRow(item({ stock: 100 }))).toMatchObject({ onHand: 100, tracked: true, low: false, out: false });
    expect(summarizeInventoryRow(item({ stock: DEFAULT_LOW_STOCK }))).toMatchObject({ low: true, out: false });
    expect(summarizeInventoryRow(item({ stock: 0 }))).toMatchObject({ out: true, low: false });
  });

  it('treats untracked (no stock / track_inventory:false) as unlimited', () => {
    expect(summarizeInventoryRow(item({}))).toMatchObject({ onHand: null, tracked: false, low: false, out: false });
    expect(summarizeInventoryRow(item({ stock: 3, track_inventory: false }))).toMatchObject({ onHand: null, tracked: false });
  });

  it('honors a per-item low_stock_threshold', () => {
    expect(summarizeInventoryRow(item({ stock: 8, low_stock_threshold: 10 }))).toMatchObject({ low: true });
    expect(summarizeInventoryRow(item({ stock: 8, low_stock_threshold: 2 }))).toMatchObject({ low: false });
  });

  it('a backorder (continue) item at 0 is not "out"', () => {
    expect(summarizeInventoryRow(item({ stock: 0, inventory_policy: 'continue' }))).toMatchObject({ out: false, backorder: true });
  });

  it('aggregates variant stock and counts variants', () => {
    const r = summarizeInventoryRow(item({ variants: [{ id: 's', stock: 4 }, { id: 'm', stock: 6 }, { id: 'l' }] }));
    expect(r.onHand).toBe(10); // 4 + 6; the untracked 'l' is ignored in the sum
    expect(r.variantCount).toBe(3);
    expect(r.tracked).toBe(true);
  });
});
