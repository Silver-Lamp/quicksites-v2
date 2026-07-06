// app/api/menu/publish-catalog/route.ts
//
// "Enable ordering" for a restaurant menu: the owner confirms prices, we ensure they
// have a merchant, create/update catalog_items (one per priced dish, category = menu
// section), and return the mapping so the editor can link the menu block's items +
// set the merchant on the template. The checkout price authority stays server-side
// (authorizeCheckoutItems reprices from catalog_items.price_cents), so this only ever
// writes owner-confirmed prices — never a chargeable client value.
//
// Idempotent: re-running updates existing items (matched by merchant_id + slug)
// instead of duplicating, so an owner can tweak prices and re-publish safely.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { buildCatalogRowsFromMenu } from '@/lib/commerce/menuCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

/** Find the caller's merchant, or create one (owner-scoped). Mirrors billing's ensureMerchantForUser. */
async function ensureMerchantForUser(admin: ReturnType<typeof serviceClient>, user: User, siteSlug: string): Promise<string> {
  const { data: existing } = await admin
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existing?.[0]?.id) return existing[0].id as string;

  const display = (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'My Restaurant';
  const slug = (siteSlug && siteSlug.trim()) || `acct-${user.id.slice(0, 8)}`;
  const { data: created, error } = await admin
    .from('merchants')
    .insert({ owner_id: user.id, user_id: user.id, display_name: display, site_slug: slug, default_currency: 'USD' })
    .select('id')
    .single();
  if (error || !created) throw new Error(error?.message || 'Could not create a merchant.');
  return created.id as string;
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const user = gate.user;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const siteSlug = String(body?.siteSlug || '').trim();
  const rows = buildCatalogRowsFromMenu(Array.isArray(body?.sections) ? body.sections : []);
  if (!rows.length) {
    return NextResponse.json(
      { error: 'No priced menu items to publish. Add a price to at least one item first.' },
      { status: 400 },
    );
  }

  const admin = serviceClient();
  let merchantId: string;
  try {
    merchantId = await ensureMerchantForUser(admin, user, siteSlug);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not set up your merchant account.' }, { status: 500 });
  }

  const items: { section: string; name: string; slug: string; catalog_item_id: string; price_cents: number }[] = [];
  for (const r of rows) {
    const metadata = { site_slug: siteSlug || null, category: r.section || null };
    const images = r.image_url ? [r.image_url] : [];
    // Upsert by (merchant_id, slug) — the table's unique key — so re-publishing updates.
    const { data: existing } = await admin
      .from('catalog_items')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('slug', r.slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from('catalog_items')
        .update({ title: r.name, description: r.description || null, price_cents: r.price_cents, status: 'active', metadata, ...(images.length ? { images } : {}) })
        .eq('id', existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      items.push({ section: r.section, name: r.name, slug: r.slug, catalog_item_id: existing.id as string, price_cents: r.price_cents });
    } else {
      const { data: created, error } = await admin
        .from('catalog_items')
        .insert({
          merchant_id: merchantId,
          type: 'meal',
          title: r.name,
          slug: r.slug,
          description: r.description || null,
          price_cents: r.price_cents,
          status: 'active',
          images,
          metadata,
        })
        .select('id')
        .single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'Could not create an item.' }, { status: 400 });
      items.push({ section: r.section, name: r.name, slug: r.slug, catalog_item_id: created.id as string, price_cents: r.price_cents });
    }
  }

  return NextResponse.json({ ok: true, merchantId, items });
}
