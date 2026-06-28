// app/api/public/products/route.ts
//
// Public storefront read. Queries the CANONICAL `catalog_items` table
// (open_commerce / System 2) so the storefront, merchant catalog admin, and the
// order path (order_items.catalog_item_id) all share one source of truth.
// (Legacy: this used to read a separate `products` table — retired 2026-06-26.)
import { NextResponse } from 'next/server';
import { createClient, PostgrestError } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── env & client ── */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── helpers ── */
const missingRelation = (e?: PostgrestError | null) =>
  e?.code === '42P01' || /relation .* does not exist/i.test(e?.message || '');

function parseIds(sp: URLSearchParams): string[] {
  const groups = sp.getAll('ids');
  const one = sp.get('id');
  const raw = [...groups, one ?? ''].filter(Boolean);
  const out = new Set<string>();
  for (const r of raw) r.split(',').forEach((x) => x && out.add(x.trim()));
  return Array.from(out).slice(0, 100);
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** catalog_items.images is jsonb (array of url strings or {url|src} objects). */
function firstImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const f = images[0];
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.url ?? f.src ?? null;
  return null;
}

/** Map a catalog_items row to the shape the storefront block/cart expect. */
function toProduct(ci: any) {
  return {
    id: ci.id,
    slug: ci.slug,
    title: ci.title,
    price_cents: ci.price_cents,
    image_url: firstImage(ci.images),
    product_type: ci.type, // 'product' | 'service' | 'digital' | 'meal'
    qty_available: null as number | null, // availability table is the source if/when enforced
  };
}

const SELECT = 'id,slug,title,price_cents,type,images,status,merchant_id';

// resolve merchantId from email if needed
async function getMerchantIdByEmail(email: string): Promise<string | null> {
  const { data: m1 } = await db.from('merchants').select('id').ilike('email', email).maybeSingle();
  if (m1?.id) return m1.id as string;
  const { data: prof } = await db.from('user_profiles').select('user_id').ilike('email', email).maybeSingle();
  const uid = prof?.user_id as string | undefined;
  if (!uid) return null;
  const { data: m2 } = await db.from('merchants').select('id').eq('user_id', uid).maybeSingle();
  return (m2?.id as string) ?? null;
}

/* ── GET /api/public/products ──
   - ids=uuid,slug,...  (mixed uuids/slugs)
   - OR merchantId=... | email=...  (+ limit)
   Only returns status='active' items.
*/
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = parseIds(url.searchParams);
    const email = (url.searchParams.get('email') || '').trim();
    const merchantIdParam = (url.searchParams.get('merchantId') || '').trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 100);

    // Path A: explicit IDs/slugs
    if (ids.length) {
      const uuids = ids.filter(isUuid);
      const slugs = ids.filter((x) => !isUuid(x));
      const rows: any[] = [];

      if (uuids.length) {
        const { data, error } = await db.from('catalog_items').select(SELECT).in('id', uuids).eq('status', 'active');
        if (error && !missingRelation(error)) return NextResponse.json({ error: error.message }, { status: 500 });
        if (Array.isArray(data)) rows.push(...data);
      }
      if (slugs.length) {
        const { data, error } = await db.from('catalog_items').select(SELECT).in('slug', slugs).eq('status', 'active');
        if (error && !missingRelation(error)) return NextResponse.json({ error: error.message }, { status: 500 });
        if (Array.isArray(data)) rows.push(...data);
      }

      const byId = new Map<string, any>();
      for (const r of rows) if (r?.id && !byId.has(r.id)) byId.set(r.id, toProduct(r));
      return NextResponse.json({ products: Array.from(byId.values()) }, { status: 200 });
    }

    // Path B: by merchant
    let merchantId: string | null = merchantIdParam || null;
    if (!merchantId && email) merchantId = await getMerchantIdByEmail(email);
    if (!merchantId) return NextResponse.json({ products: [], hint: 'no-merchant' }, { status: 200 });

    const { data, error } = await db
      .from('catalog_items')
      .select(SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (missingRelation(error)) return NextResponse.json({ products: [] }, { status: 200 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ products: (data ?? []).map(toProduct) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ products: [], hint: e?.message || 'server error' }, { status: 200 });
  }
}
