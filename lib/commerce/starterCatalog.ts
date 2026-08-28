// lib/commerce/starterCatalog.ts
//
// Catalog cloning for template duplication — what makes commerce templates usable as
// STARTERS. A template that sells (products_grid ids, service_offer productId,
// meta.ecom.merchant_id) references catalog_items owned by the SOURCE owner's
// merchant; a naive copy would render the seed products but route real money to the
// seed merchant. Cloning gives the new owner their own merchant + their own copies of
// the referenced items, and remaps every id inside the template data.
//
// Used by /api/templates/duplicate (the "start from a template" path) so a crafts-
// store starter duplicates into a fully-working store the new owner actually owns.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureMerchantForOwner } from '@/lib/commerce/shopifyCatalog';

/** Every catalog id a template's data references (products_grid + service_offer). */
export function collectReferencedProductIds(data: any): string[] {
  const ids = new Set<string>();
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks)
      ? p.blocks
      : Array.isArray(p?.content_blocks)
        ? p.content_blocks
        : [];
    for (const b of blocks) {
      const c: any = b?.content ?? {};
      if (b?.type === 'products_grid' || b?.type === 'products-grid') {
        for (const key of ['product_ids', 'productIds', 'ids']) {
          if (Array.isArray(c[key]))
            c[key].forEach((x: any) => typeof x === 'string' && x && ids.add(x));
        }
      }
      if (b?.type === 'service_offer' && typeof c.productId === 'string' && c.productId) {
        ids.add(c.productId);
      }
    }
  }
  return Array.from(ids);
}

/** The merchant a template's data is wired to sell for (or null). */
export function stampedMerchantId(data: any): string | null {
  const m = data?.meta?.ecom?.merchant_id ?? data?.meta?.ecommerce?.merchant_id;
  return typeof m === 'string' && m ? m : null;
}

export type ClonedCatalog = {
  merchantId: string;
  /** old catalog_item id → the new owner's cloned item id */
  idMap: Record<string, string>;
};

/**
 * Clone the catalog items a template references into a merchant owned by the new
 * owner. Only fields that describe the PRODUCT are copied (title/type/description/
 * price/images/variant metadata) — stock/sku/barcode/POD wiring stay behind (the new
 * owner sets their own). Returns null when the template has no commerce wiring.
 */
export async function cloneCatalogForOwner(opts: {
  sourceData: any;
  newOwnerId: string;
  businessName: string;
  siteSlug: string;
}): Promise<ClonedCatalog | null> {
  const refIds = collectReferencedProductIds(opts.sourceData);
  const hasWiring = refIds.length > 0 || !!stampedMerchantId(opts.sourceData);
  if (!hasWiring) return null;

  const merchantId = await ensureMerchantForOwner(supabaseAdmin, {
    ownerId: opts.newOwnerId,
    businessName: opts.businessName,
    siteSlug: opts.siteSlug,
  });

  const idMap: Record<string, string> = {};
  if (refIds.length) {
    const { data: sourceItems } = await supabaseAdmin
      .from('catalog_items')
      .select('id, type, title, slug, description, price_cents, images, metadata')
      .in('id', refIds);

    for (const item of (sourceItems ?? []) as any[]) {
      // Product-shape metadata only: keep variants; drop stock/sku/barcode/POD (the
      // clone must never print or decrement against the source's operations).
      const meta = { ...(item.metadata ?? {}) };
      delete meta.stock;
      delete meta.sku;
      delete meta.barcode;
      delete meta.fulfillment_provider;
      delete meta.pod_spec;
      meta.site_slug = opts.siteSlug;
      meta.cloned_from = item.id;

      const suffix = Math.random().toString(36).slice(2, 6);
      const { data: created } = await supabaseAdmin
        .from('catalog_items')
        .insert({
          merchant_id: merchantId,
          type: item.type,
          title: item.title,
          slug: `${String(item.slug || 'item').slice(0, 56)}-${suffix}`,
          description: item.description,
          price_cents: item.price_cents,
          images: item.images,
          status: 'active',
          metadata: meta,
        })
        .select('id')
        .single();
      if (created?.id) idMap[item.id] = created.id as string;
    }
  }

  return { merchantId, idMap };
}

/**
 * Rewrite a template's data for the cloned catalog: every referenced item id is
 * remapped (uuid string replacement over the serialized JSON — ids are globally
 * unique, so this is exact) and meta.ecom points at the new merchant. Ids with no
 * clone (source item vanished) are dropped from grids so nothing dangles.
 */
export function remapCommerceIds(
  data: any,
  merchantId: string,
  idMap: Record<string, string>
): any {
  let text = JSON.stringify(data ?? {});
  for (const [oldId, newId] of Object.entries(idMap)) {
    text = text.split(oldId).join(newId);
  }
  const next = JSON.parse(text);

  // Drop any referenced ids that didn't get a clone.
  const validIds = new Set(Object.values(idMap));
  const pages: any[] = Array.isArray(next?.pages) ? next.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks)
      ? p.blocks
      : Array.isArray(p?.content_blocks)
        ? p.content_blocks
        : [];
    for (const b of blocks) {
      const c: any = b?.content ?? {};
      if (b?.type === 'products_grid' || b?.type === 'products-grid') {
        for (const key of ['product_ids', 'productIds', 'ids']) {
          if (Array.isArray(c[key])) c[key] = c[key].filter((x: any) => validIds.has(x));
        }
      }
      if (
        b?.type === 'service_offer' &&
        typeof c.productId === 'string' &&
        c.productId &&
        !validIds.has(c.productId)
      ) {
        delete c.productId;
      }
    }
  }

  next.meta = {
    ...(next.meta ?? {}),
    ecom: { ...(next.meta?.ecom ?? {}), merchant_id: merchantId },
  };
  return next;
}

/** Last-resort safety: strip ALL commerce wiring so a copy can never sell for the source. */
export function stripCommerceWiring(data: any): any {
  const next = JSON.parse(JSON.stringify(data ?? {}));
  const pages: any[] = Array.isArray(next?.pages) ? next.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks)
      ? p.blocks
      : Array.isArray(p?.content_blocks)
        ? p.content_blocks
        : [];
    for (const b of blocks) {
      const c: any = b?.content ?? {};
      if (b?.type === 'products_grid' || b?.type === 'products-grid') {
        for (const key of ['product_ids', 'productIds', 'ids']) {
          if (Array.isArray(c[key])) c[key] = [];
        }
      }
      if (b?.type === 'service_offer') delete c.productId;
    }
  }
  if (next?.meta?.ecom) delete next.meta.ecom.merchant_id;
  if (next?.meta?.ecommerce) delete next.meta.ecommerce.merchant_id;
  return next;
}
