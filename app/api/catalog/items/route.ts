// app/api/catalog/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    merchantId: string; siteSlug: string;
    type: 'meal'|'product'|'service'|'digital';
    title: string; slug: string; description?: string; priceCents: number;
    availability?: { kind: 'always'|'window'|'calendar'; startsAt?: string; endsAt?: string; quantity?: number };
    // Print-on-demand: when set, this item fulfills via Lulu (book) / Gelato (merch).
    fulfillmentProvider?: 'lulu' | 'gelato' | 'none';
    podSpec?: Record<string, any>;
    // Optional variants (size/color, each its own price). When present, the base
    // price_cents becomes the cheapest variant and pricing is resolved per-variant.
    variants?: Array<{ label: string; priceCents: number }>;
  };

  if (!body.merchantId || !body.type || !body.title || !body.slug) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // RLS protects owner: use normal client (no service role)
  const supa = await getServerSupabase();

  const metadata: Record<string, any> = { site_slug: body.siteSlug };
  if (body.fulfillmentProvider === 'lulu' || body.fulfillmentProvider === 'gelato') {
    metadata.fulfillment_provider = body.fulfillmentProvider;
    metadata.pod_spec = body.podSpec ?? {};
  }

  // Normalize variants: stable slug ids (deduped), non-negative integer prices,
  // active by default. Blank rows are dropped. Base price = cheapest variant.
  let basePriceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
  const rawVariants = (body.variants ?? []).filter((v) => v && String(v.label ?? '').trim());
  if (rawVariants.length) {
    const seen = new Set<string>();
    const variants = rawVariants.map((v) => {
      const label = String(v.label).trim();
      const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'opt';
      let id = base;
      for (let i = 2; seen.has(id); i++) id = `${base}-${i}`;
      seen.add(id);
      return { id, label, price_cents: Math.max(0, Math.round(Number(v.priceCents) || 0)), status: 'active' };
    });
    metadata.variants = variants;
    basePriceCents = Math.min(...variants.map((v) => v.price_cents));
  }

  // Insert catalog item
  const { data: item, error } = await supa.from('catalog_items').insert({
    merchant_id: body.merchantId,
    type: body.type,
    title: body.title,
    slug: body.slug,
    description: body.description || null,
    price_cents: basePriceCents,
    status: 'active',
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
