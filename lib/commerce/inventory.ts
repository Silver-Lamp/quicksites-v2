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

/** Item-level stock off a catalog row's metadata (for a plain, variant-less item). */
export function readItemStock(metadata: unknown): number | null {
  return normalizeStock((metadata as any)?.stock);
}

/**
 * Is `requested` units available given `available` (null = untracked/unlimited)?
 * Returns a machine reason when not, so callers can message "sold out" vs "only N".
 */
export function checkStock(available: number | null, requested: number): { ok: boolean; reason?: 'sold_out' | 'insufficient' } {
  if (available === null) return { ok: true };
  if (available <= 0) return { ok: false, reason: 'sold_out' };
  if (requested > available) return { ok: false, reason: 'insufficient' };
  return { ok: true };
}

export type StockDecrement = { variantId?: string | null; quantity: number };

/**
 * Apply order-line decrements to a catalog item's metadata, clamping at 0 and only
 * touching TRACKED stock (untracked lines are left alone). Returns the new metadata
 * and whether anything changed (so the caller can skip a no-op write). Never
 * mutates the input.
 */
export function applyStockDecrements(
  metadata: unknown,
  decrements: StockDecrement[],
): { metadata: Record<string, unknown>; changed: boolean } {
  const meta: Record<string, any> = metadata && typeof metadata === 'object' ? { ...(metadata as any) } : {};
  let changed = false;

  const variants: any[] | null = Array.isArray(meta.variants) ? meta.variants.map((v: any) => ({ ...v })) : null;

  for (const d of decrements ?? []) {
    const qty = Math.max(0, Math.floor(Number(d.quantity) || 0));
    if (qty <= 0) continue;

    if (d.variantId && variants) {
      const v = variants.find((x) => x.id === d.variantId);
      if (v && normalizeStock(v.stock) !== null) {
        v.stock = Math.max(0, normalizeStock(v.stock)! - qty);
        changed = true;
      }
    } else if (!d.variantId) {
      const cur = normalizeStock(meta.stock);
      if (cur !== null) {
        meta.stock = Math.max(0, cur - qty);
        changed = true;
      }
    }
  }

  if (variants && changed) meta.variants = variants;
  return { metadata: meta, changed };
}
