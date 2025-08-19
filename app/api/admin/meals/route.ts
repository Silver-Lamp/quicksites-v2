// app/api/admin/meals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Loosened client to avoid TS2589 on adaptive queries
type AnyClient = SupabaseClient<any, any, any>;

/* ------------------------------ utils ------------------------------ */
const msgLower = (e: any) => `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
const missingCol = (e: any) => /does not exist|could not find the/i.test(msgLower(e));
const first = <T>(...vals: Array<T | null | undefined>) => vals.find(v => v !== undefined && v !== null);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64);
}
function usdToCents(v: string | number): number {
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!isFinite(n)) throw new Error('invalid price');
  return Math.round(n * 100);
}
function coalesceName(display?: string, meta?: string, email?: string) {
  return (display?.trim() || meta?.trim() || email?.split('@')[0] || 'Chef').trim();
}
function deriveSiteSlugFromReq(req: NextRequest, fallback = 'deliveredmenu') {
  const explicit = req.headers.get('x-site-slug');
  if (explicit) return explicit;

  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  if (!host) return fallback;
  if (host.startsWith('delivered.menu')) return 'deliveredmenu';
  const sub = host.split(':')[0].split('.')[0];
  if (sub && sub !== 'www' && sub !== 'localhost') {
    return sub.replace(/[^a-z0-9-]/g, '').replace(/-/g, '');
  }
  return fallback;
}

/* ------------------------------ auth gate ------------------------------ */
async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach(c => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );

  const { data: auth } = await (supa as AnyClient).auth.getUser();
  if (!auth.user) return { code: 401 as const, error: 'Not signed in' };

  const { data: admin } = await (supa as AnyClient)
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);

  if (!admin?.[0]) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa: supa as AnyClient };
}

/* ------------------------------ tiny db helpers ------------------------------ */
async function selectFirstId(
  db: AnyClient,
  table: 'merchants' | 'chefs',
  col: string,
  val: any
): Promise<string | null> {
  const { data, error } = await (db as any).from(table).select('id').eq(col as any, val).limit(1);
  if (!error) return data?.[0]?.id ?? null;
  if (!missingCol(error)) throw new Error(error.message);
  return null;
}

/* Resolve or create a merchant for this user_id (by user_id only). */
async function ensureMerchantId(db: AnyClient, userId: string, baseName: string): Promise<string> {
  const id0 = await selectFirstId(db, 'merchants', 'user_id', userId);
  if (id0) return id0;

  const newId = randomUUID();
  const { error } = await (db as any).from('merchants').insert({
    id: newId,
    user_id: userId,
    name: baseName,
    display_name: baseName, // ignored if column doesn't exist
  });
  if (!error) return newId;

  const again = await (db as any).from('merchants').select('id').eq('user_id', userId).limit(1);
  if (!again.error && again.data?.[0]?.id) return again.data[0].id;

  throw new Error(error.message || 'Failed to create merchant');
}

/* Resolve a chef for the user; create one if needed. Returns {chef_id, merchant_id}. */
async function resolveChefIdForUser(opts: {
  db: AnyClient;
  admin: AnyClient;
  email: string;
  baseName: string;
}): Promise<{ chef_id: string; merchant_id: string | null; created?: boolean }> {
  const { db, admin, email, baseName } = opts;

  const { data: list, error: listErr } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(listErr.message);
  const u = list.users.find((x: any) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error('user not found');

  // Merchant (by user_id)
  let merchant_id: string | null = null;
  try {
    merchant_id = await ensureMerchantId(db, u.id, baseName);
  } catch (e: any) {
    if (!/user_id/i.test(String(e.message))) throw e;
  }

  // Chef lookups
  const byUser = await selectFirstId(db, 'chefs', 'user_id', u.id);
  if (byUser) return { chef_id: byUser, merchant_id, created: false };

  if (merchant_id) {
    const byMerch = await selectFirstId(db, 'chefs', 'merchant_id', merchant_id);
    if (byMerch) return { chef_id: byMerch, merchant_id, created: false };
  }

  const byName = await selectFirstId(db, 'chefs', 'name', baseName);
  if (byName) {
    if (merchant_id) {
      const { error: upd } = await (db as any).from('chefs').update({ merchant_id }).eq('id', byName);
      if (upd && !missingCol(upd)) throw new Error(upd.message || 'failed to link chef to merchant');
    }
    return { chef_id: byName, merchant_id, created: false };
  }

  // Create a chef; start rich, back off
  const newId = randomUUID();
  const attempts: Array<Record<string, any>> = [
    { id: newId, name: baseName, user_id: u.id, merchant_id },
    { id: newId, name: baseName, user_id: u.id },
    { id: newId, name: baseName, merchant_id },
    { id: newId, name: baseName },
  ];
  for (const payload of attempts) {
    const { error } = await (db as any).from('chefs').insert(payload);
    if (!error) return { chef_id: newId, merchant_id, created: true };
    if (msgLower(error).includes('duplicate key value')) {
      const againUser = await selectFirstId(db, 'chefs', 'user_id', u.id);
      if (againUser) return { chef_id: againUser, merchant_id, created: false };
      const againName = await selectFirstId(db, 'chefs', 'name', baseName);
      if (againName) return { chef_id: againName, merchant_id, created: false };
    }
    if (!missingCol(error)) throw new Error(error.message || 'chef insert failed');
  }

  const { data: anyChef } = await (db as any).from('chefs').select('id').limit(1);
  if (anyChef?.[0]?.id) return { chef_id: anyChef[0].id, merchant_id, created: false };

  throw new Error('failed to create or find chef');
}

async function getSiteIdBySlug(admin: AnyClient, slug: string) {
  const { data } = await (admin as any).from('sites').select('id').eq('slug', slug).limit(1);
  return data?.[0]?.id ?? null;
}

/* ------------------------------ handler ------------------------------ */
export async function POST(req: NextRequest) {
  // Admin gate (anon client just to verify admin)
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const db = gate.supa as AnyClient;

  // Service-role client (auth admin + RLS-bypassing writes)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as AnyClient;

  // Accept JSON or form-data; support aliases
  let body: any = {};
  try { body = await req.json(); } catch {}
  if (!body || Object.keys(body).length === 0) {
    try {
      const form = await req.formData();
      body = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]));
    } catch {}
  }

  const email = first<string>(body.email, body.user_email, body.chef_email);
  const title = first<string>(body.title, body.meal_title, body.name);
  const price_usd = first<string | number>(body.price_usd, body.priceUSD, body.priceUsd, body.price, body.usd, body.amount);
  const price_cents_input = first<string | number>(body.price_cents, body.cents);
  const quantity = first<string | number>(body.quantity, body.qty, body.qty_available, body.quantity_available);

  const description = first<string>(body.description, body.desc);
  const image_url = first<string>(body.image_url, body.image, body.imageUrl);
  const tags = body.tags;
  const available_from = first<string>(body.available_from, body.availableFrom);
  const available_to   = first<string>(body.available_to, body.availableTo);
  const status = first<string>(body.status);

  // site: id or slug (fall back to derived slug -> id)
  let site_id = first<string>(body.site_id, body.siteId) ?? null;
  const site_slug = first<string>(body.site_slug, body.siteSlug) ?? deriveSiteSlugFromReq(req, 'deliveredmenu');
  if (!site_id && site_slug) {
    site_id = await getSiteIdBySlug(admin, site_slug);
  }

  const missing: string[] = [];
  if (!email) missing.push('email');
  if (!title) missing.push('title');
  if (price_usd == null && price_cents_input == null) missing.push('price_usd|price_cents');
  if (quantity == null) missing.push('quantity');
  if (missing.length) return NextResponse.json({ error: `Missing: ${missing.join(', ')}` }, { status: 400 });

  // Auth user → baseName for chef creation/lookup
  const { data: list, error: listErr } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const u = list.users.find((x: any) => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  const baseName = coalesceName(undefined, (u.user_metadata as any)?.name, u.email ?? undefined);

  // Resolve (or create) chef & merchant using anon db (policies already working for admin)
  let chef_id: string, merchant_id: string | null;
  try {
    const res = await resolveChefIdForUser({ db, admin, email: email as string, baseName });
    chef_id = res.chef_id;
    merchant_id = res.merchant_id;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to resolve chef' }, { status: 500 });
  }

  // price: prefer cents if provided
  let price_cents: number;
  try {
    if (price_cents_input != null) {
      const n = Number(price_cents_input);
      if (!Number.isFinite(n) || n < 0) throw new Error('invalid cents');
      price_cents = Math.round(n);
    } else {
      price_cents = usdToCents(price_usd as any);
    }
  } catch {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  const qty_available = Number(quantity);
  if (!Number.isFinite(qty_available) || qty_available < 1) {
    return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });
  }

  // tags array normalization
  let tagArray: string[] | null = null;
  if (Array.isArray(tags)) tagArray = (tags as any[]).map(String);
  else if (typeof tags === 'string') tagArray = tags.split(',').map(s => s.trim()).filter(Boolean);

  // slug uniqueness check — use service client so RLS can’t block reads
  let slug: string | null = null;
  if (site_id) {
    const base = slugify(title as string);
    let candidate = base || `meal-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await (admin as any)
        .from('meals').select('id')
        .eq('site_id', site_id)
        .eq('slug', candidate)
        .limit(1);
      if (!exists?.[0]) break;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    slug = candidate;
  }

  const mealPayload: any = {
    id: randomUUID(),
    chef_id,
    merchant_id: merchant_id ?? null,
    site_id: site_id ?? null,       // ✅ auto-filled from slug/headers if not provided
    title: String(title),
    description: description ?? null,
    image_url: image_url ?? null,
    tags: tagArray,
    slug,
    price_cents,
    available_from: available_from ? new Date(available_from).toISOString() : null,
    available_to:   available_to   ? new Date(available_to).toISOString()   : null,
    max_per_order: 5,
    qty_available,
    status: status ?? 'draft',
  };

  // Service-role insert bypasses RLS on meals
  const { error: insMeal } = await (admin as any).from('meals').insert(mealPayload);
  if (insMeal) return NextResponse.json({ error: insMeal.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    meal_id: mealPayload.id,
    chef_id,
    merchant_id,
    site_id: mealPayload.site_id,
    slug: mealPayload.slug,
    price_cents,
    qty_available,
    status: mealPayload.status,
  });
}
