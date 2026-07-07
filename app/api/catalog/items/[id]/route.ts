// app/api/catalog/items/[id]/route.ts
//
// GET  — fetch one catalog item (owner-gated by RLS) for the edit drawer.
// PATCH — update an existing item's fields + variants. Reuses normalizeVariants so
//         edited variants are stored identically to created ones. RLS restricts
//         both to the item's owner (normal client, no service role).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { normalizeVariants, mergeVariantMetadata, type InputAxis, type InputVariant } from '@/lib/commerce/variants';
import { normalizeStock } from '@/lib/commerce/inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await getServerSupabase();
  const { data, error } = await supa
    .from('catalog_items')
    .select('id, merchant_id, type, title, slug, description, price_cents, status, images, metadata')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string | null;
    priceCents?: number;
    status?: 'active' | 'inactive' | 'archived';
    // When present (even empty), variants are fully replaced with this authoring state.
    variantOptions?: InputAxis[];
    variants?: InputVariant[];
    // Item-level stock for a plain (variant-less) product. null clears tracking.
    stock?: number | null;
    sku?: string | null; // plain-item SKU (variant SKUs ride in variants[])
    barcode?: string | null; // plain-item UPC/EAN/ISBN
    imageUrl?: string; // main product image (empty string clears it)
  };

  const supa = await getServerSupabase();

  // Load current row (RLS: only the owner sees it) to merge metadata safely.
  const { data: existing, error: readErr } = await supa
    .from('catalog_items')
    .select('id, price_cents, metadata')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const patch: Record<string, any> = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if ('description' in body) patch.description = body.description || null;
  if (body.status) patch.status = body.status;
  if ('imageUrl' in body) {
    const url = String(body.imageUrl ?? '').trim();
    patch.images = url ? [url] : [];
  }

  // Variants: replace wholesale when the key is present. Merge into existing
  // metadata so site_slug / fulfillment_provider / pod_spec are preserved.
  if ('variants' in body) {
    const norm = normalizeVariants({
      variantOptions: body.variantOptions,
      variants: body.variants,
      fallbackBaseCents: body.priceCents ?? existing.price_cents ?? 0,
    });
    const merged = mergeVariantMetadata(existing.metadata as any, norm);
    // Item-level stock applies only to a plain result; per-variant stock governs
    // otherwise. Set/clear it explicitly so a reverted product tracks correctly.
    if (norm.variants.length === 0) {
      const s = normalizeStock(body.stock);
      if (s !== null) merged.metadata.stock = s;
      else delete merged.metadata.stock;
      // Plain-item SKU/barcode: set when non-empty, clear when explicitly blanked.
      if ('sku' in body) {
        const sku = String(body.sku ?? '').trim().slice(0, 64);
        if (sku) merged.metadata.sku = sku; else delete merged.metadata.sku;
      }
      if ('barcode' in body) {
        const barcode = String(body.barcode ?? '').trim().slice(0, 64);
        if (barcode) merged.metadata.barcode = barcode; else delete merged.metadata.barcode;
      }
    } else {
      delete merged.metadata.stock;
      // Variant items carry SKU per-variant; drop any stale plain-item SKU/barcode.
      delete merged.metadata.sku;
      delete merged.metadata.barcode;
    }
    patch.metadata = merged.metadata;
    patch.price_cents = merged.priceCents;
  } else if (typeof body.priceCents === 'number') {
    patch.price_cents = Math.max(0, Math.round(body.priceCents));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { data, error } = await supa
    .from('catalog_items')
    .update(patch as any)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not found or not permitted' }, { status: 404 });
  return NextResponse.json({ ok: true, id: data.id });
}
