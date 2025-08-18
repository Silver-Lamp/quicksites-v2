import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
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

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createServerClient<Database>>;

  const { email, count = 20, base_title = 'Demo Meal', active_ratio = 0.7 } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const u = list?.users?.find(x => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const { data: chef } = await supa.from('chefs').select('id, merchant_id').eq('user_id', u.id).maybeSingle();
  if (!chef) return NextResponse.json({ error: 'chef not found for user (promote first)' }, { status: 400 });

  // pick site (first site)
  const { data: site } = await supa.from('sites').select('id').order('created_at', { ascending: true }).maybeSingle();
  const site_id = site?.id || null;

  // prefetch existing slugs to avoid collisions
  const { data: existing } = await supa.from('meals').select('slug').eq('site_id', site_id);
  const used = new Set<string>((existing || []).map(r => r.slug).filter(Boolean));
  const reservedHas = (s:string)=> Array.isArray(RESERVED_SLUGS) ? RESERVED_SLUGS.includes(s) : (RESERVED_SLUGS as any)?.has?.(s);

  const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
  const n = clamp(Number(count) || 0, 1, 100);

  const cuisines = [['american'],['vegan'],['bbq'],['mediterranean'],['thai'],['indian']];
  const tagsPool = ['gluten-free','dairy-free','spicy','mild','keto','high-protein'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows:any[] = [];
  const now = Date.now();

  for (let i=1; i<=n; i++) {
    const base = slugify(`${base_title}-${i}`);
    let candidate = base;
    let j = 2;
    while (used.has(candidate) || reservedHas(candidate)) candidate = `${base}-${j++}`;
    used.add(candidate);

    const price = 900 + ((i * 73) % 1200); // 9.00 - 20.99
    const qty = (i % 5 === 0) ? 0 : (5 + (i % 10));
    const active = Math.random() < Number(active_ratio);

    rows.push({
      id: randomUUID(),
      site_id,
      merchant_id: chef.merchant_id,
      chef_id: chef.id,
      title: `${base_title} #${i}`,
      description: 'Bulk seeded meal for testing.',
      price_cents: price,
      image_url: `https://picsum.photos/seed/bulk${i}/800/600`,
      available_from: new Date(now + ((i % 6) * 60 * 60 * 1000)).toISOString(),
      available_to:   new Date(now + (72 * 60 * 60 * 1000)).toISOString(),
      max_per_order: 2 + (i % 2),
      qty_available: qty,
      is_active: active,
      cuisines: cuisines[i % cuisines.length],
      tags: [tagsPool[i % tagsPool.length]],
      slug: candidate,
    });
  }

  const { error: insErr } = await supa.from('meals').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: rows.length, sample: rows[0]?.id });
}
