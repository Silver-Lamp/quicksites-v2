// app/api/catalog/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    merchantId: string; siteSlug: string;
    type: 'meal'|'product'|'service'|'digital';
    title: string; slug: string; description?: string; priceCents: number;
    availability?: { kind: 'always'|'window'|'calendar'; startsAt?: string; endsAt?: string; quantity?: number };
  };

  if (!body.merchantId || !body.type || !body.title || !body.slug) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // RLS protects owner: use normal client (no service role)
  const supa = await getServerSupabase();

  // Insert catalog item
  const { data: item, error } = await supa.from('catalog_items').insert({
    merchant_id: body.merchantId,
    type: body.type,
    title: body.title,
    slug: body.slug,
    description: body.description || null,
    price_cents: body.priceCents,
    status: 'active',
    metadata: { site_slug: body.siteSlug }
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
