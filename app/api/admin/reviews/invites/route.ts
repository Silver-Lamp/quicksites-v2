import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

async function resolveMeal({ supa, meal_id, meal_slug, email }:{
  supa: ReturnType<typeof createServerClient<Database>>;
  meal_id?: string; meal_slug?: string; email?: string;
}) {
  if (meal_id) {
    const { data } = await supa.from('meals').select('id, site_id, chef_id, title, slug').eq('id', meal_id).maybeSingle();
    return data;
  }
  if (meal_slug) {
    const { data } = await supa.from('meals').select('id, site_id, chef_id, title, slug').eq('slug', meal_slug).maybeSingle();
    return data;
  }
  if (email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (!u) return null;
    const { data: chef } = await supa.from('chefs').select('id').eq('user_id', u.id).maybeSingle();
    if (!chef) return null;
    const { data: meal } = await supa
      .from('meals')
      .select('id, site_id, chef_id, title, slug')
      .eq('chef_id', chef.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    return meal ?? null;
  }
  return null;
}

/**
 * Body: { meal_id?, meal_slug?, email? (fallback), count=10, expires_in_days=90, include_qr_png?: boolean }
 * Returns: { ok, meal, invites: [{token, url, pngDataUrl?}] }
 */
export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createServerClient<Database>>;

  const { meal_id, meal_slug, email, count = 10, expires_in_days = 90, include_qr_png = true } = await req.json();
  const meal = await resolveMeal({ supa, meal_id, meal_slug, email });
  if (!meal) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  // Ensure table exists (will throw if not). If you haven’t added it yet, see SQL migration below.
  const now = Date.now();
  const exp = new Date(now + Math.max(1, Number(expires_in_days)) * 24 * 3600 * 1000).toISOString();

  const tokens = Array.from({ length: Math.max(1, Math.min(200, Number(count))) }, () => crypto.randomUUID());
  const rows = tokens.map(t => ({
    id: crypto.randomUUID(),
    token: t,
    meal_id: meal.id,
    chef_id: meal.chef_id,
    site_id: meal.site_id,
    status: 'active',
    created_at: new Date().toISOString(),
    expires_at: exp,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await supa.from('review_invites').insert(rows as any);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const base = (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  const invites = rows.map(r => ({
    token: r.token,
    url: `${base}/reviews/start?t=${r.token}`
  }));

  // Optional: embed PNG data URLs for quick sticker printing
  if (include_qr_png) {
    try {
      const QR = await import('qrcode'); // npm i qrcode
      await Promise.all(invites.map(async inv => {
        (inv as any)['pngDataUrl'] = await QR.toDataURL(inv.url, { margin: 1, scale: 6 });
      }));
    } catch {
      // If the lib isn't installed, just return URLs
    }
  }

  return NextResponse.json({
    ok: true,
    meal: { id: meal.id, title: meal.title, slug: meal.slug },
    invites
  });
}
