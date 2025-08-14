import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

  const { email, title, price_cents, qty_available = 10, image_url, is_active = true } = await req.json();
  if (!email || !title || !price_cents) {
    return NextResponse.json({ error: 'email, title, price_cents required' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const u = list.users.find((x) => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const { data: chef } = await supa.from('chefs').select('id, merchant_id').eq('user_id', u.id).maybeSingle();
  if (!chef) return NextResponse.json({ error: 'chef not found for user (promote first)' }, { status: 400 });

  // Pick a site if you use multi-site (try first one)
  const { data: site } = await supa.from('sites').select('id').order('created_at', { ascending: true }).maybeSingle();
  const site_id = site?.id || null;

  const id = randomUUID();
  const now = new Date();
  const img = image_url || `https://picsum.photos/seed/${id}/800/600`;

  const meal = {
    id,
    site_id,
    merchant_id: chef.merchant_id,
    chef_id: chef.id,
    title,
    description: 'Seeded via Admin Tools',
    price_cents: Number(price_cents),
    image_url: img,
    available_from: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    available_to:   new Date(now.getTime() + 72 * 3600 * 1000).toISOString(),
    max_per_order: 2,
    qty_available: Number(qty_available),
    is_active: Boolean(is_active),
    cuisines: ['demo'],
    tags: ['admin'],
  };

  const { error: ins } = await supa.from('meals').insert(meal as any);
  if (ins) return NextResponse.json({ error: ins.message }, { status: 500 });

  return NextResponse.json({ ok: true, meal });
}
