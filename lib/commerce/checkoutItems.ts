// lib/commerce/checkoutItems.ts
import { readItemStock, checkStock, normalizeStock } from './inventory';
//
// Server-side price authority for the public storefront checkout. The client
// posts catalog item ids + quantities, but the PRICE must come from the DB, never
// from the request — otherwise a buyer can POST unitAmount:1 and buy anything for
// a penny. This reprices each requested line from the authoritative catalog_items
// row and rejects anything that isn't an active item belonging to the merchant.

export type RequestedItem = {
  catalogItemId: string;
  quantity: number;
  variantId?: string | null; // selected variant, when the item has variants
  addonIds?: string[]; // selected multi-select add-ons (extra cheese, …), priced server-side
  // title / unitAmount may be sent by the client but are IGNORED — derived below.
  title?: string;
  unitAmount?: number;
  metadata?: unknown;
};

export type CatalogAddon = { id: string; label: string; price_cents: number };

export type CatalogVariant = {
  id: string;
  label: string;
  price_cents: number | null;
  status?: string | null;
  options?: Record<string, string> | null; // axis → value, e.g. { Size: 'M', Color: 'Red' } (multi-axis)
  stock?: number | null; // units available; null/absent = untracked (unlimited)
  image?: string | null; // per-variant image URL; absent = use the item's main image
};

export type VariantAxis = { name: string; values: string[] };

export type CatalogRow = {
  id: string;
  merchant_id: string;
  title: string | null;
  price_cents: number | null;
  status: string | null;
  metadata?: unknown;
};

/** Pull the variant list off a catalog row's metadata, if any (defensive). */
export function readVariants(metadata: unknown): CatalogVariant[] {
  const v = (metadata as any)?.variants;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x.id === 'string');
}

/** Pull the multi-select add-ons off a catalog row's metadata, if any. */
export function readAddons(metadata: unknown): CatalogAddon[] {
  const a = (metadata as any)?.addons;
  if (!Array.isArray(a)) return [];
  return a
    .filter((x) => x && typeof x.id === 'string' && Number.isFinite(Number(x.price_cents)))
    .map((x) => ({ id: String(x.id), label: String(x.label ?? ''), price_cents: Math.max(0, Math.round(Number(x.price_cents))) }));
}

/**
 * Pull the variant axes (Size, Color, …) off metadata, if the item is multi-axis.
 * Absent/empty ⇒ the item is a flat single-list of variants (or has none).
 */
export function readVariantOptions(metadata: unknown): VariantAxis[] {
  const a = (metadata as any)?.variant_options;
  if (!Array.isArray(a)) return [];
  return a
    .filter((x) => x && typeof x.name === 'string' && Array.isArray(x.values))
    .map((x) => ({ name: String(x.name), values: x.values.map((v: unknown) => String(v)) }))
    .filter((x) => x.values.length > 0);
}

/**
 * Resolve the variant SKU matching a full selection of axis values (e.g.
 * { Size: 'M', Color: 'Red' }). Returns undefined if no variant matches every
 * chosen axis — i.e. that combination isn't offered. Pure, so the storefront and
 * any server caller agree on which SKU a selection maps to.
 */
export function resolveVariantByOptions(
  variants: CatalogVariant[],
  selected: Record<string, string>,
): CatalogVariant | undefined {
  const axes = Object.keys(selected);
  if (!axes.length) return undefined;
  return (variants ?? []).find((v) => {
    const opts = v.options;
    if (!opts) return false;
    return axes.every((axis) => opts[axis] === selected[axis]);
  });
}

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

    // Resolve the priced entity: a selected variant if the item has any, else the
    // item itself. Either way the PRICE and title come from the DB, not the client.
    const variants = readVariants(row.metadata);
    let title = row.title ?? 'Item';
    let priceSource: number | null = row.price_cents;
    let variant: CatalogVariant | undefined;

    if (variants.length) {
      variant = req.variantId ? variants.find((v) => v.id === req.variantId) : undefined;
      if (!variant) {
        return { ok: false, error: `Please choose an option for "${row.title ?? 'an item'}".`, badItemId: req.catalogItemId };
      }
      if ((variant.status ?? 'active') !== PURCHASABLE_STATUS) {
        return { ok: false, error: `"${variant.label}" is not available.`, badItemId: req.catalogItemId };
      }
      priceSource = variant.price_cents;
      title = `${row.title ?? 'Item'} — ${variant.label}`;
    }

    // Distinguish an unset price (null/undefined → not for sale) from a legit $0.
    if (priceSource == null) {
      return { ok: false, error: `"${title}" has no price set.`, badItemId: req.catalogItemId };
    }
    const price = Number(priceSource);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: `"${title}" has no valid price.`, badItemId: req.catalogItemId };
    }

    const quantity = Math.floor(Number(req.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, error: 'Invalid quantity.', badItemId: req.catalogItemId };
    }
    if (quantity > MAX_QUANTITY_PER_LINE) {
      return { ok: false, error: `Quantity for "${title}" exceeds the per-order limit.`, badItemId: req.catalogItemId };
    }

    // Stock gate: reject overselling a tracked item/variant (untracked ⇒ unlimited).
    const available = variant ? normalizeStock(variant.stock) : readItemStock(row.metadata);
    const stock = checkStock(available, quantity);
    if (!stock.ok) {
      return {
        ok: false,
        error: stock.reason === 'sold_out' ? `"${title}" is sold out.` : `Only ${available} of "${title}" left.`,
        badItemId: req.catalogItemId,
      };
    }

    // Multi-select add-ons (extra cheese, make it a combo, …): validate every
    // requested id against the item's own add-on list and price them server-side.
    // The client sends ids only — never prices — so this stays tamper-proof.
    const availableAddons = readAddons(row.metadata);
    const chosenAddons: CatalogAddon[] = [];
    for (const id of Array.isArray(req.addonIds) ? req.addonIds : []) {
      const a = availableAddons.find((x) => x.id === id);
      if (!a) {
        return { ok: false, error: `An add-on for "${title}" is unavailable.`, badItemId: req.catalogItemId };
      }
      chosenAddons.push(a);
    }
    const addonsTotal = chosenAddons.reduce((s, a) => s + a.price_cents, 0);
    const unitAmount = price + addonsTotal;
    if (chosenAddons.length) title = `${title} (+ ${chosenAddons.map((a) => a.label).join(', ')})`;

    const baseMeta = row.metadata && typeof row.metadata === 'object' ? { ...(row.metadata as Record<string, unknown>) } : {};
    if (variant) {
      baseMeta.variant_id = variant.id;
      baseMeta.variant_label = variant.label;
    }
    if (chosenAddons.length) {
      baseMeta.addons = chosenAddons;
      baseMeta.addon_ids = chosenAddons.map((a) => a.id);
    }

    items.push({
      catalogItemId: row.id,
      title,
      quantity,
      unitAmount, // authoritative — base/variant + validated add-ons; client-sent unitAmount is discarded
      metadata: baseMeta,
    });
  }

  return { ok: true, items };
}
