// lib/commerce/__tests__/inventorySummary.test.ts
import { summarizeInventoryRow, DEFAULT_LOW_STOCK, lowStockTransitions } from '../inventorySummary';

const item = (metadata: any) => ({
  id: 'i1',
  title: 'Widget',
  type: 'product',
  status: 'active',
  metadata,
});

describe('summarizeInventoryRow', () => {
  it('reads plain-item on-hand and flags low/out', () => {
    expect(summarizeInventoryRow(item({ stock: 100 }))).toMatchObject({
      onHand: 100,
      tracked: true,
      low: false,
      out: false,
    });
    expect(summarizeInventoryRow(item({ stock: DEFAULT_LOW_STOCK }))).toMatchObject({
      low: true,
      out: false,
    });
    expect(summarizeInventoryRow(item({ stock: 0 }))).toMatchObject({ out: true, low: false });
  });

  it('treats untracked (no stock / track_inventory:false) as unlimited', () => {
    expect(summarizeInventoryRow(item({}))).toMatchObject({
      onHand: null,
      tracked: false,
      low: false,
      out: false,
    });
    expect(summarizeInventoryRow(item({ stock: 3, track_inventory: false }))).toMatchObject({
      onHand: null,
      tracked: false,
    });
  });

  it('honors a per-item low_stock_threshold', () => {
    expect(summarizeInventoryRow(item({ stock: 8, low_stock_threshold: 10 }))).toMatchObject({
      low: true,
    });
    expect(summarizeInventoryRow(item({ stock: 8, low_stock_threshold: 2 }))).toMatchObject({
      low: false,
    });
  });

  it('a backorder (continue) item at 0 is not "out"', () => {
    expect(summarizeInventoryRow(item({ stock: 0, inventory_policy: 'continue' }))).toMatchObject({
      out: false,
      backorder: true,
    });
  });

  it('aggregates variant stock and counts variants', () => {
    const r = summarizeInventoryRow(
      item({ variants: [{ id: 's', stock: 4 }, { id: 'm', stock: 6 }, { id: 'l' }] })
    );
    expect(r.onHand).toBe(10); // 4 + 6; the untracked 'l' is ignored in the sum
    expect(r.variantCount).toBe(3);
    expect(r.tracked).toBe(true);
  });
});

describe('lowStockTransitions', () => {
  const item = (id: string, metadata: any) => ({
    id,
    title: id,
    type: 'product',
    status: 'active',
    metadata,
  });

  it('alerts newly-low/out items and skips already-flagged ones', () => {
    const { alert } = lowStockTransitions([
      item('a', { stock: 2 }), // low → alert
      item('b', { stock: 0 }), // out → alert
      item('c', { stock: 1, low_stock_alerted: true }), // already alerted → skip
      item('d', { stock: 100 }), // healthy → skip
    ]);
    expect(alert.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('clears the flag on restocked items', () => {
    const { clearIds } = lowStockTransitions([
      item('a', { stock: 100, low_stock_alerted: true }), // restocked → clear
      item('b', { stock: 1, low_stock_alerted: true }), // still low → keep
    ]);
    expect(clearIds).toEqual(['a']);
  });
});
