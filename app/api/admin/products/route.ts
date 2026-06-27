import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin product management — now reads/writes the canonical `catalog_items`
// (open_commerce), same table as the storefront + order path. The admin UI's
// product_type 'physical' maps to catalog_items.type 'product'; qty_available is
// stored in metadata. (Legacy: this used a separate `products` table — retired.)

/* ── env & client ── */
function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── type mapping admin <-> catalog_items ── */
const toCatalogType = (t: string) => (t === 'physical' ? 'product' : t); // admin -> canonical
const toAdminType = (t: string) => (t === 'product' ? 'physical' : t); // canonical -> admin
function firstImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const f = images[0];
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.url ?? f.src ?? null;
  return null;
}

/* ── helpers ── */
async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data: p } = await db.from('profiles').select('user_id').ilike('email', email).maybeSingle();
  if (p?.user_id) return p.user_id as string;
  const { data: au } = await db.from('auth.users' as any).select('id').ilike('email', email).maybeSingle();
  return au?.id ?? null;
}
async function getMerchantIdByEmail(email: string): Promise<string | null> {
  const { data: direct } = await db.from('merchants').select('id').ilike('email', email).maybeSingle();
  if (direct?.id) return direct.id as string;
  const uid = await getUserIdByEmail(email);
  if (!uid) return null;
  const { data: viaUser } = await db.from('merchants').select('id').eq('user_id', uid).maybeSingle();
  return viaUser?.id ?? null;
}
async function ensureMerchantExists(merchantId: string): Promise<boolean> {
  const { data } = await db.from('merchants').select('id').eq('id', merchantId).maybeSingle();
  return !!data?.id;
}

/* ── GET: list products by email or merchantId ── */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('email') || '').trim();
  const merchantIdParam = (url.searchParams.get('merchantId') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)), 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let merchantId: string | null = null;
  if (email) merchantId = await getMerchantIdByEmail(email);
  else if (merchantIdParam) merchantId = merchantIdParam;
  else return NextResponse.json({ error: 'email or merchantId is required' }, { status: 400 });

  if (!merchantId) {
    return NextResponse.json({ products: [], hint: 'No merchant found for provided email/merchantId' }, { status: 200 });
  }

  const { data, error } = await db
    .from('catalog_items')
    .select('id, title, slug, price_cents, images, type, metadata')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((ci: any) => ({
    id: ci.id,
    title: ci.title,
    slug: ci.slug,
    price_cents: ci.price_cents,
    image_url: firstImage(ci.images),
    product_type: toAdminType(ci.type),
    qty_available: Number(ci?.metadata?.qty_available ?? 0),
  }));
  return NextResponse.json({ products }, { status: 200 });
}

/* ── POST: create product ── */
const CreateSchema = z
  .object({
    email: z.string().email().optional(),
    merchantId: z.string().uuid().optional(),
    title: z.string().min(1),
    price_cents: z.number().int().positive(),
    qty_available: z.number().int().min(0),
    image_url: z.string().url().optional().nullable(),
    product_type: z.enum(['service', 'physical', 'digital', 'meal']).default('service'),
  })
  .refine((v) => !!v.email || !!v.merchantId, { message: 'email or merchantId is required', path: ['email'] });

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);

export async function POST(req: NextRequest) {
  try {
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { email, merchantId: merchantIdRaw, title, price_cents, qty_available, image_url, product_type } = parsed.data;

    let merchant_id: string | null = null;
    if (merchantIdRaw) {
      if (!(await ensureMerchantExists(merchantIdRaw)))
        return NextResponse.json({ error: 'merchantId not found' }, { status: 400 });
      merchant_id = merchantIdRaw;
    } else if (email) {
      merchant_id = await getMerchantIdByEmail(email);
      if (!merchant_id) return NextResponse.json({ error: 'No merchant found for email' }, { status: 400 });
    }

    // slug unique within merchant (catalog_items unique on merchant_id,slug)
    let slug = slugify(title) || `prod-${Date.now().toString(36)}`;
    let uniqueSlug = slug;
    let i = 1;
    while (true) {
      const { data: existing } = await db
        .from('catalog_items')
        .select('id')
        .eq('merchant_id', merchant_id!)
        .eq('slug', uniqueSlug)
        .maybeSingle();
      if (!existing) break;
      uniqueSlug = `${slug}-${i++}`;
    }

    const { data, error } = await db
      .from('catalog_items')
      .insert({
        merchant_id,
        type: toCatalogType(product_type),
        title,
        slug: uniqueSlug,
        price_cents,
        images: image_url ? [image_url] : [],
        status: 'active',
        metadata: { qty_available },
      })
      .select('id, title, slug, price_cents, images, type, metadata')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      {
        product: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          price_cents: data.price_cents,
          image_url: firstImage(data.images),
          product_type: toAdminType(data.type),
          qty_available: Number((data as any)?.metadata?.qty_available ?? qty_available),
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}
