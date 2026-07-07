// lib/commerce/inventorySummary.ts
//
// Summarize a catalog_items row's inventory for the merchant inventory list
// (INVENTORY_PLAN.md Phase 2). Pure — computes on-hand, tracked, and low/out flags
// from metadata, aggregating variant stock for variant products.

import { effectiveItemStock, readInventoryPolicy, normalizeStock } from './inventory';

export const DEFAULT_LOW_STOCK = 5;

export type InventoryRow = {
  id: string;
  title: string;
  sku: string;
  type: string;
  status: string;
  onHand: number | null; // null = untracked (unlimited)
  tracked: boolean;
  variantCount: number;
  backorder: boolean;
  low: boolean;
  out: boolean;
};

export function summarizeInventoryRow(item: any): InventoryRow {
  const meta = item?.metadata ?? {};
  const variants: any[] = Array.isArray(meta.variants) ? meta.variants : [];
  const sku = typeof meta.sku === 'string' ? meta.sku : '';
  const policy = readInventoryPolicy(meta);
  const threshold = Number.isFinite(Number(meta.low_stock_threshold))
    ? Number(meta.low_stock_threshold)
    : DEFAULT_LOW_STOCK;

  let onHand: number | null;
  let tracked: boolean;
  if (variants.length) {
    const stocks = variants.map((v) => normalizeStock(v?.stock)).filter((n): n is number => n !== null);
    tracked = stocks.length > 0;
    onHand = tracked ? stocks.reduce((a, b) => a + b, 0) : null;
  } else {
    onHand = effectiveItemStock(meta);
    tracked = onHand !== null;
  }

  const out = tracked && onHand !== null && onHand <= 0 && policy !== 'continue';
  const low = tracked && onHand !== null && onHand > 0 && onHand <= threshold;

  return {
    id: item.id,
    title: item.title,
    sku,
    type: item.type,
    status: item.status,
    onHand,
    tracked,
    variantCount: variants.length,
    backorder: policy === 'continue',
    low,
    out,
  };
}
