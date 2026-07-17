// app/api/catalog/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { normalizeVariants, type InputAxis, type InputVariant } from '@/lib/commerce/variants';
import { normalizeStock } from '@/lib/commerce/inventory';
import { screenListing, prohibitedMessage } from '@/lib/safety/prohibitedContent';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    merchantId: string; siteSlug: string;
    type: 'meal'|'product'|'service'|'digital';
    title: string; slug: string; description?: string; priceCents: number;
    availability?: { kind: 'always'|'window'|'calendar'; startsAt?: string; endsAt?: string; quantity?: number };
    // Print-on-demand: when set, this item fulfills via Lulu (book) / Gelato (merch).
    fulfillmentProvider?: 'lulu' | 'gelato' | 'none';
    podSpec?: Record<string, any>;
    // Optional variants. Single- or multi-axis (Size × Color); when present, the
    // base price becomes the cheapest SKU and pricing is resolved per-variant.
    variantOptions?: InputAxis[];
    variants?: InputVariant[];
    // Item-level stock for a plain (variant-less) product. null/absent = untracked.
    stock?: number | null;
    sku?: string | null; // plain-item SKU (variant SKUs ride in variants[])
    barcode?: string | null; // plain-item UPC/EAN/ISBN
    trackInventory?: boolean; // false = untracked/unlimited even if a stock exists
    inventoryPolicy?: 'deny' | 'continue'; // 'continue' = backorder (sell past zero)
    imageUrl?: string; // main product image (stored in the images array)
  };

  if (!body.merchantId || !body.type || !body.title || !body.slug) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Trust & safety: refuse to LIST prohibited/illegal items or services for sale.
  // First-line heuristic (lib/safety/prohibitedContent) — high-confidence categories
  // only; 'review'-severity dual-use matches are allowed through (a human moderation
  // pass is the follow-up), 'block' is refused with a non-echoing message.
  const screen = screenListing({ title: body.title, description: body.description, extra: [body.sku, body.barcode] });
  if (!screen.ok && screen.severity === 'block' && screen.category) {
    return NextResponse.json(
      { error: prohibitedMessage(screen.category), code: 'prohibited_content', category: screen.category },
      { status: 422 },
    );
  }

  // RLS protects owner: use normal client (no service role)
  const supa = await getServerSupabase();

  const metadata: Record<string, any> = { site_slug: body.siteSlug };
  if (body.fulfillmentProvider === 'lulu' || body.fulfillmentProvider === 'gelato') {
    metadata.fulfillment_provider = body.fulfillmentProvider;
    metadata.pod_spec = body.podSpec ?? {};
  }

  // Normalize variants (single- or multi-axis) into stored metadata. Base price =
  // cheapest SKU when variants exist, else the plain price.
  const norm = normalizeVariants({
    variantOptions: body.variantOptions,
    variants: body.variants,
    fallbackBaseCents: Number(body.priceCents) || 0,
  });
  if (norm.variants.length) {
    metadata.variants = norm.variants;
    if (norm.variant_options.length) metadata.variant_options = norm.variant_options;
  } else {
    // Plain item: item-level stock (per-variant stock governs when variants exist).
    const s = normalizeStock(body.stock);
    if (s !== null) metadata.stock = s;
    const sku = String(body.sku ?? '').trim().slice(0, 64);
    if (sku) metadata.sku = sku;
    const barcode = String(body.barcode ?? '').trim().slice(0, 64);
    if (barcode) metadata.barcode = barcode;
  }
  const basePriceCents = norm.basePriceCents;

  // Inventory policy (item-level; applies to variants too).
  if (body.trackInventory === false) metadata.track_inventory = false;
  if (body.inventoryPolicy === 'continue') metadata.inventory_policy = 'continue';

  const imageUrl = String(body.imageUrl ?? '').trim();

  // Insert catalog item
  const { data: item, error } = await supa.from('catalog_items').insert({
    merchant_id: body.merchantId,
    type: body.type,
    title: body.title,
    slug: body.slug,
    description: body.description || null,
    price_cents: basePriceCents,
    status: 'active',
    images: imageUrl ? [imageUrl] : [],
    metadata,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Funnel: merchant listed a catalog item (docs/MODEL_A_PLAN.md A7). Best-effort;
  // keyed to the merchant.
  try {
    await captureServer(
      EVENTS.CATALOG_ITEM_CREATED,
      { merchant_id: body.merchantId, item_id: item.id, type: body.type, site_slug: body.siteSlug },
      body.merchantId
    );
  } catch {}

  // Optional availability
  if (body.availability) {
    const a = body.availability;
    await supa.from('availability').insert({
      catalog_item_id: item.id,
      kind: a.kind,
      starts_at: a.startsAt ? new Date(a.startsAt).toISOString() : null,
      ends_at: a.endsAt ? new Date(a.endsAt).toISOString() : null,
      quantity: a.quantity ?? null
    });
  }

  return NextResponse.json({ id: item.id });
}
