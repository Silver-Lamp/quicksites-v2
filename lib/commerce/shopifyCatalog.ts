// lib/commerce/shopifyCatalog.ts
//
// Turn imported Shopify products (ProductSpec[], from lib/rebuild/importShopify) into
// REAL, purchasable QuickSites catalog_items under the site owner's merchant. This is
// what makes a rebuilt Shopify store a working store, not a picture of one: the rows
// written here are repriced server-side at checkout (authorizeCheckoutItems) and, once
// the owner connects Stripe, charge buyers with the platform take-rate applied.
//
// Mirrors the write shape of app/api/menu/publish-catalog (the restaurant vertical's
// catalog publisher): ensure one merchant per owner, then upsert catalog_items on
// (merchant_id, slug). Service-role — bypasses RLS — so callers MUST have already
// authorized the owner (the rebuild route owns the template as `ownerId`).

import { getServerSupabase } from '@/lib/supabase/server';
import { normalizeVariants } from '@/lib/commerce/variants';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'item';
}

/** One merchant per owner (matches ensureMerchantForUser in publish-catalog): reuse
 *  the owner's earliest merchant, else create one. Returns the merchant id. */
export async function ensureMerchantForOwner(
  supabase: any,
  opts: { ownerId: string; businessName: string; siteSlug: string },
): Promise<string> {
  const { data: existing } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', opts.ownerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('merchants')
    .insert({
      owner_id: opts.ownerId,
      user_id: opts.ownerId, // merged System-1/System-2 shape writes both
      display_name: opts.businessName || 'My Store',
      site_slug: opts.siteSlug,
      default_currency: 'USD',
    })
    .select('id')
    .single();
  if (error || !created?.id) {
    // Lost a race (unique owner_id+site_slug) or partial shape — re-read.
    const { data: retry } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', opts.ownerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (retry?.id) return retry.id as string;
    throw new Error(`ensureMerchantForOwner failed: ${error?.message ?? 'no merchant'}`);
  }
  return created.id as string;
}

/** Build the metadata.variants shape from a ProductSpec's options/variants. A product
 *  with no real axes (Shopify's synthetic "Default Title") stays plain — no variants,
 *  base price only — so checkout uses price_cents directly. */
function buildVariantMetadata(product: ProductSpec): {
  priceCents: number;
  variants?: unknown[];
  variantOptions?: unknown[];
} {
  if (!product.options.length) return { priceCents: product.priceCents };
  const axisNames = product.options.map((o) => o.name);
  const norm = normalizeVariants({
    variantOptions: product.options,
    variants: product.variants.map((v) => ({
      label: v.title,
      priceCents: v.priceCents,
      status: v.available === false ? 'inactive' : 'active',
      options: axisNames.length
        ? Object.fromEntries(
            axisNames
              .map((n, i) => [n, v.options?.[i]] as [string, string | undefined])
              .filter(([, val]) => val),
          )
        : undefined,
    })),
    fallbackBaseCents: product.priceCents,
  });
  if (!norm.variants.length) return { priceCents: product.priceCents };
  return {
    priceCents: norm.basePriceCents,
    variants: norm.variants,
    ...(norm.variant_options.length ? { variantOptions: norm.variant_options } : {}),
  };
}

export type ProvisionResult = {
  merchantId: string;
  /** handle → catalog_item id, for wiring the products_grid block. */
  idByHandle: Record<string, string>;
  created: number;
};

/**
 * Ensure a merchant for the owner and upsert one catalog_item per product. Idempotent
 * on (merchant_id, slug) — re-running refreshes price/description/images instead of
 * duplicating. Best-effort per product: a single row failure is skipped (logged),
 * never aborts the batch.
 */
export async function provisionShopifyCatalog(opts: {
  ownerId: string;
  businessName: string;
  siteSlug: string;
  products: ProductSpec[];
}): Promise<ProvisionResult> {
  // Untyped service-role client: catalog_items.type/status are enum columns the
  // generated types reject as plain strings (same pattern as lib/commerce/orders.ts).
  const supabase: any = await getServerSupabase({ serviceRole: true });
  const merchantId = await ensureMerchantForOwner(supabase, opts);

  const idByHandle: Record<string, string> = {};
  const usedSlugs = new Set<string>();
  let created = 0;

  for (const product of opts.products) {
    const handle = product.handle || slugify(product.title);
    // Slug unique within the merchant; de-collide within this batch.
    let slug = slugify(handle);
    for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(handle)}-${i}`;
    usedSlugs.add(slug);

    const vmeta = buildVariantMetadata(product);
    const metadata: Record<string, any> = {
      site_slug: opts.siteSlug,
      category: product.productType ?? null,
      source: 'shopify_import',
      ...(product.productUrl ? { source_url: product.productUrl } : {}),
      // "Was $X" strike-through price — display only; checkout reprices from price_cents.
      ...(product.compareAtCents && product.compareAtCents > vmeta.priceCents
        ? { compare_at_cents: product.compareAtCents }
        : {}),
      ...(vmeta.variants ? { variants: vmeta.variants } : {}),
      ...(vmeta.variantOptions ? { variant_options: vmeta.variantOptions } : {}),
      // Physical-goods shipping: weight (for weight-based rates) + a flag the fee
      // computation reads. Inert until an operator opts into shipping rates.
      ...(product.requiresShipping
        ? { shipping: { requires_shipping: true, ...(product.grams ? { grams: product.grams } : {}) } }
        : {}),
    };

    const row = {
      merchant_id: merchantId,
      type: 'product',
      title: product.title,
      slug,
      description: product.description || null,
      price_cents: vmeta.priceCents,
      status: 'active',
      images: product.images,
      metadata,
    };

    const { data, error } = await supabase
      .from('catalog_items')
      .upsert(row, { onConflict: 'merchant_id,slug' })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('[shopifyCatalog] upsert failed for', slug, error?.message);
      continue;
    }
    // Key the map by the handle the grid stamped (see applyProductBlocks).
    idByHandle[product.handle || slugify(product.title)] = data.id as string;
    created += 1;
  }

  return { merchantId, idByHandle, created };
}
