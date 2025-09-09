import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── env & client ── */
function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── helpers ── */
async function getUserIdByEmail(email: string): Promise<string | null> {
  // profiles first
  const { data: p } = await db.from('profiles').select('user_id').ilike('email', email).maybeSingle();
  if (p?.user_id) return p.user_id as string;
  // fallback to auth.users (service role)
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
    .from('products')
    .select('id, title, price_cents, image_url, product_type, qty_available')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] }, { status: 200 });
}

/* ── POST: create product (email OR merchantId) ── */
const CreateSchema = z.object({
  email: z.string().email().optional(),
  merchantId: z.string().uuid().optional(),
  title: z.string().min(1),
  price_cents: z.number().int().positive(),
  qty_available: z.number().int().min(0),
  image_url: z.string().url().optional().nullable(),
  product_type: z.enum(['service', 'physical', 'digital', 'meal']).default('service'),
}).refine((v) => !!v.email || !!v.merchantId, {
  message: 'email or merchantId is required',
  path: ['email'], // keep a single place for form error display
});

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumerics with -
    .replace(/^-+|-+$/g, '')     // trim leading/trailing -
    .substring(0, 60);           // keep it short
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.flatten();
      return NextResponse.json({ error: 'Invalid payload', issues: issue }, { status: 400 });
    }
    const { email, merchantId: merchantIdRaw, title, price_cents, qty_available, image_url, product_type } = parsed.data;

    // Resolve merchant_id
    let merchant_id: string | null = null;
    if (merchantIdRaw) {
      const exists = await ensureMerchantExists(merchantIdRaw);
      if (!exists) return NextResponse.json({ error: 'merchantId not found' }, { status: 400 });
      merchant_id = merchantIdRaw;
    } else if (email) {
      merchant_id = await getMerchantIdByEmail(email);
      if (!merchant_id) return NextResponse.json({ error: 'No merchant found for email' }, { status: 400 });
    }

    // Generate slug (unique-ish)
    let slug = slugify(title);
    if (!slug) slug = `prod-${Date.now().toString(36)}`;

    // Ensure uniqueness by appending suffix if necessary
    let uniqueSlug = slug;
    let i = 1;
    while (true) {
      const { data: existing } = await db.from('products').select('id').eq('slug', uniqueSlug).maybeSingle();
      if (!existing) break;
      uniqueSlug = `${slug}-${i++}`;
    }

    const { data, error } = await db
      .from('products')
      .insert({
        merchant_id,
        title,
        slug: uniqueSlug,
        price_cents,
        qty_available,
        image_url: image_url || null,
        product_type,
      })
      .select('id, title, slug, price_cents, qty_available, image_url, product_type')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}

