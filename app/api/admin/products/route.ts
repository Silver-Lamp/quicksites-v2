import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// If your project has these helpers, keep these imports.
// Otherwise swap the admin-check with your own logic.
import { getServerSupabase } from '@/lib/supabase/server'; // TODO: confirm path

// ---------- Config ----------
export const dynamic = 'force-dynamic';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

// Service client (bypasses RLS; guard strictly via admin check)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Validation ----------
const BodySchema = z.object({
  email: z.string().email(),
  title: z.string().min(1).max(200),
  price_cents: z.number().int().positive().optional(),
  price_usd: z.union([z.string(), z.number()]).optional(),
  qty_available: z.number().int().nonnegative(),
  image_url: z.string().url().nullable().optional(),
  product_type: z.enum(['meal', 'physical', 'digital', 'service']),
});

function usdToCents(usd: string | number): number | null {
  if (typeof usd === 'number' && Number.isFinite(usd)) {
    return Math.round(usd * 100);
  }
  const s = String(usd).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// ---------- Auth / Admin Check ----------
async function assertAdmin() {
  // Uses your existing server client (cookie-bound) to read the caller.
  const supabase = await getServerSupabase({ serviceRole: true });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { ok: false as const, status: 401, message: 'Not signed in' };
  }

  // Check your profile/role — tweak to match your schema:
  // Option A: profiles.id === auth uid and has is_admin or role
  const { data: profile, error: pErr } = await supabase
    .from('profiles') // TODO: confirm table
    .select('id, role, is_admin')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (pErr) {
    return { ok: false as const, status: 500, message: `Profile lookup failed: ${pErr.message}` };
  }

  const isAdmin =
    (profile as any)?.is_admin === true ||
    (profile as any)?.role === 'admin' ||
    (profile as any)?.role === 'superadmin';

  if (!isAdmin) {
    return { ok: false as const, status: 403, message: 'Admins only' };
  }

  return { ok: true as const, userId: auth.user.id };
}

// ---------- Merchant Resolution ----------
async function resolveUserIdByEmail(email: string): Promise<string | null> {
  // Preferred: mirror email in profiles (common pattern).
  const { data: prof, error } = await supabaseAdmin
    .from('profiles') // TODO: confirm table & email column
    .select('id, user_id, email')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    // If your profiles table doesn't store email, swap this with an auth-admin lookup.
    // Example (Supabase JS v2): await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200, ... })
    // and filter by email on the app side or via the API's filter options.
    return null;
  }

  // Some schemas use profiles.id === auth.uid; others store user_id FK
  const userId = (prof as any)?.user_id || (prof as any)?.id;
  return userId ?? null;
}

async function resolveMerchantIdForUser(userId: string): Promise<string | null> {
  // Direct merchant attached to the user?
  const { data: merchant, error: mErr } = await supabaseAdmin
    .from('merchants') // TODO: confirm table & user_id column
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (merchant?.id) return merchant.id;

  // Or user is a chef, and chef points at a merchant
  const { data: chef, error: cErr } = await supabaseAdmin
    .from('chefs') // TODO: confirm table & columns
    .select('merchant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (chef?.merchant_id) return chef.merchant_id;

  // Optionally: also try merchants_users join table if you support multi-user merchants
  // const { data: mu } = await supabaseAdmin.from('merchants_users').select('merchant_id').eq('user_id', userId).maybeSingle();

  return null;
}

// ---------- Handler ----------
export async function POST(req: Request) {
  try {
    const admin = await assertAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      email,
      title,
      price_cents,
      price_usd,
      qty_available,
      image_url = null,
      product_type,
    } = parsed.data;

    // price: allow either cents or usd
    const cents =
      typeof price_cents === 'number'
        ? price_cents
        : price_usd != null
        ? usdToCents(price_usd)
        : null;

    if (!Number.isInteger(cents) || (cents as number) <= 0) {
      return NextResponse.json({ error: 'price_cents or price_usd is required and must be positive' }, { status: 400 });
    }

    // 1) resolve user by email
    const userId = await resolveUserIdByEmail(email.toLowerCase().trim());
    if (!userId) {
      return NextResponse.json({ error: `User not found for email ${email}` }, { status: 404 });
    }

    // 2) resolve merchant for that user (direct merchant or via chef)
    const merchantId = await resolveMerchantIdForUser(userId);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found for user. Promote to merchant or link chef → merchant first.' },
        { status: 400 }
      );
    }

    // 3) insert product
    const insertPayload = {
      merchant_id: merchantId,
      title,
      price_cents: cents,
      qty_available,
      image_url,     // nullable
      product_type,  // 'meal' | 'physical' | 'digital' | 'service'
      // status: 'active', // TODO: add if your schema has it
      // sku, slug, etc…
    };

    const { data: product, error: insErr } = await supabaseAdmin
      .from('products') // TODO: confirm table & columns
      .insert(insertPayload)
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (e: any) {
    console.error('[admin/products] POST error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
