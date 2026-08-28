// lib/commerce/inventory.ts
//
// Optional stock tracking for catalog items + variants. Stock lives in metadata:
//   • plain item      → metadata.stock            (units, or absent = untracked)
//   • variant SKU     → variant.stock             (units, or absent = untracked)
// "untracked" (null/undefined) means unlimited — the common default. A tracked
// value of 0 means sold out. Pure helpers so the checkout gate (reject oversell)
// and the paid-order decrement agree exactly.

/** Coerce a raw stock value to a non-negative integer, or null when untracked. */
export function normalizeStock(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

/** Item-level stock off a catalog row's metadata (for a plain, variant-less item).
 *  This is the ENFORCED field — checkout + the decrement RPC read `metadata.stock`. */
export function readItemStock(metadata: unknown): number | null {
  return normalizeStock((metadata as any)?.stock);
}

/**
 * Display-only read that also honors the legacy `metadata.qty_available` alias.
 *
 * Before the stock-field unification, the admin product tools wrote an un-enforced
 * `metadata.qty_available`; `metadata.stock` is now the single source of truth (and a
 * backfill copies qty_available → stock where stock is absent). Use this ONLY for
 * showing a number in admin UIs so pre-backfill rows still display — never for the
 * checkout gate, which must read `readItemStock` (the enforced field) alone.
 */
export function readItemStockCompat(metadata: unknown): number | null {
  const m = (metadata ?? {}) as any;
  if (m.stock !== null && m.stock !== undefined && m.stock !== '') return normalizeStock(m.stock);
  return normalizeStock(m.qty_available);
}

export type InventoryPolicy = 'deny' | 'continue';

/** How an item behaves when it runs out: 'deny' (default, block the sale) or
 *  'continue' (backorder — keep selling past zero). Read from metadata.inventory_policy. */
export function readInventoryPolicy(metadata: unknown): InventoryPolicy {
  return (metadata as any)?.inventory_policy === 'continue' ? 'continue' : 'deny';
}

/** Whether a plain item's stock is tracked. Explicit `track_inventory:false` forces
 *  untracked (unlimited) even if a stock number lingers; otherwise a numeric stock
 *  means tracked. Returns the effective on-hand (null = untracked/unlimited). */
export function effectiveItemStock(metadata: unknown): number | null {
  if ((metadata as any)?.track_inventory === false) return null;
  return readItemStock(metadata);
}

/**
 * Is `requested` units available given `available` (null = untracked/unlimited)?
 * With policy 'continue' (backorder), the sale is always allowed. Returns a machine
 * reason when not, so callers can message "sold out" vs "only N".
 */
export function checkStock(
  available: number | null,
  requested: number,
  policy: InventoryPolicy = 'deny'
): { ok: boolean; reason?: 'sold_out' | 'insufficient' } {
  if (available === null) return { ok: true };
  if (policy === 'continue') return { ok: true }; // backorder: sell past zero
  if (available <= 0) return { ok: false, reason: 'sold_out' };
  if (requested > available) return { ok: false, reason: 'insufficient' };
  return { ok: true };
}

// NOTE: the paid-order decrement is done atomically in the DB via the
// decrement_catalog_stock RPC (supabase/migrations/20260702_atomic_stock_decrement.sql)
// so concurrent orders serialize on the row lock and can't oversell — a JS
// read-modify-write here would race. These pure helpers cover the read-side gate
// (checkStock) + authoring/normalization only.
