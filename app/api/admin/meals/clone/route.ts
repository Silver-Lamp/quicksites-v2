import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { randomUUID } from 'crypto';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa!;

  const { meal_id, meal_slug, new_title, qty_available, is_active = false } = await req.json();

  // Fetch source meal
  let { data: src } = await supa
    .from('meals')
    .select('id, site_id, merchant_id, chef_id, title, description, price_cents, image_url, max_per_order, cuisines, tags, slug')
    .or(meal_id ? `id.eq.${meal_id}` : `slug.eq.${meal_slug}`)
    .maybeSingle();

  if (!src) return NextResponse.json({ error: 'source meal not found' }, { status: 404 });

  // New title & slug (collision-safe per site)
  const title = new_title || `${src.title} (Copy)`;
  const base = slugify(src.slug || title);
  const { data: siblings } = await supa
    .from('meals')
    .select('slug')
    .eq('site_id', src.site_id)
    .neq('id', src.id)
    .ilike('slug', `${base}%`);

  const used = new Set<string>((siblings || []).map(r => r.slug).filter(Boolean));
  const reservedHas = (s:string)=> Array.isArray(RESERVED_SLUGS) ? RESERVED_SLUGS.includes(s) : (RESERVED_SLUGS as any)?.has?.(s);
  let candidate = base;
  let i = 2;
  while (used.has(candidate) || reservedHas(candidate)) candidate = `${base}-${i++}`;

  const id = randomUUID();
  const now = Date.now();

  const clone: any = {
    id,
    site_id: src.site_id,
    merchant_id: src.merchant_id,
    chef_id: src.chef_id,
    title,
    description: src.description,
    price_cents: src.price_cents,
    image_url: src.image_url,
    available_from: new Date(now + 60 * 60 * 1000).toISOString(),
    available_to:   new Date(now + 72 * 60 * 60 * 1000).toISOString(),
    max_per_order: src.max_per_order ?? 2,
    qty_available: qty_available != null ? Number(qty_available) : 0,
    is_active: Boolean(is_active),
    cuisines: src.cuisines ?? null,
    tags: src.tags ?? null,
    slug: candidate,
  };

  const { error: insErr, data: created } = await supa.from('meals').insert(clone).select('*').maybeSingle();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, meal: created });
}
