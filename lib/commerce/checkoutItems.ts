// lib/commerce/checkoutItems.ts
//
// Server-side price authority for the public storefront checkout. The client
// posts catalog item ids + quantities, but the PRICE must come from the DB, never
// from the request — otherwise a buyer can POST unitAmount:1 and buy anything for
// a penny. This reprices each requested line from the authoritative catalog_items
// row and rejects anything that isn't an active item belonging to the merchant.

export type RequestedItem = {
  catalogItemId: string;
  quantity: number;
  // title / unitAmount may be sent by the client but are IGNORED — derived below.
  title?: string;
  unitAmount?: number;
  metadata?: unknown;
};

export type CatalogRow = {
  id: string;
  merchant_id: string;
  title: string | null;
  price_cents: number | null;
  status: string | null;
  metadata?: unknown;
};

export type PricedItem = {
  catalogItemId: string;
  title: string;
  quantity: number;
  unitAmount: number; // authoritative cents from catalog_items.price_cents
  metadata: Record<string, unknown>;
};

export type AuthorizeResult =
  | { ok: true; items: PricedItem[] }
  | { ok: false; error: string; badItemId?: string };

const PURCHASABLE_STATUS = 'active';
const MAX_QUANTITY_PER_LINE = 1000; // guardrail against absurd/overflow quantities

/**
 * Reprice + authorize requested checkout lines against the merchant's catalog.
 * Pure: the caller fetches the catalog rows (by the requested ids) and passes
 * them in. Returns repriced items or the first violation found.
 */
export function authorizeCheckoutItems(input: {
  merchantId: string;
  requested: RequestedItem[];
  catalogRows: CatalogRow[];
}): AuthorizeResult {
  const { merchantId, requested, catalogRows } = input;
  if (!requested?.length) return { ok: false, error: 'No items in cart.' };

  const byId = new Map<string, CatalogRow>();
  for (const row of catalogRows ?? []) if (row?.id) byId.set(row.id, row);

  const items: PricedItem[] = [];
  for (const req of requested) {
    const row = req.catalogItemId ? byId.get(req.catalogItemId) : undefined;
    if (!row) {
      return { ok: false, error: 'One or more items are no longer available.', badItemId: req.catalogItemId };
    }
    if (row.merchant_id !== merchantId) {
      return { ok: false, error: 'An item does not belong to this store.', badItemId: req.catalogItemId };
    }
    if (row.status !== PURCHASABLE_STATUS) {
      return { ok: false, error: `"${row.title ?? 'An item'}" is not available for purchase.`, badItemId: req.catalogItemId };
    }
    // Distinguish an unset price (null/undefined → not for sale) from a legit $0.
    if (row.price_cents == null) {
      return { ok: false, error: `"${row.title ?? 'An item'}" has no price set.`, badItemId: req.catalogItemId };
    }
    const price = Number(row.price_cents);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: `"${row.title ?? 'An item'}" has no valid price.`, badItemId: req.catalogItemId };
    }

    const quantity = Math.floor(Number(req.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, error: 'Invalid quantity.', badItemId: req.catalogItemId };
    }
    if (quantity > MAX_QUANTITY_PER_LINE) {
      return { ok: false, error: `Quantity for "${row.title ?? 'an item'}" exceeds the per-order limit.`, badItemId: req.catalogItemId };
    }

    items.push({
      catalogItemId: row.id,
      title: row.title ?? 'Item',
      quantity,
      unitAmount: price, // authoritative — client-sent unitAmount is discarded
      metadata: (row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}),
    });
  }

  return { ok: true, items };
}
