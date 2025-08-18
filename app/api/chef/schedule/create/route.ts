import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildLink(base: string, net: string) {
  const u = new URL(base);
  u.searchParams.set('utm_source', 'chef');
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', 'meal_share');
  u.searchParams.set('utm_content', net);
  return u.toString();
}

export async function POST(req: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { mealId, whenISO, networks, caption, autoLastCall, webhooks } = await req.json();
  if (!mealId || !whenISO || !Array.isArray(networks) || networks.length === 0) {
    return NextResponse.json({ error: 'mealId, whenISO, networks required' }, { status: 400 });
  }

  // Ownership check
  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  const { data: meal } = await supa
    .from('meals')
    .select('id, slug, title, price_cents, site_id')
    .eq('id', mealId)
    .eq('merchant_id', merchant?.id || '')
    .maybeSingle();
  if (!merchant || !meal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const handle = meal.slug || meal.id;
  const baseUrl = `${process.env.APP_BASE_URL}/meals/${handle}`;
  const shareImage = `${process.env.APP_BASE_URL}/api/public/meal/${handle}/share-image?size=1080`;


    const rows:any[] = [];
    for (const net of networks) {
    rows.push({
        merchant_id: merchant.id,
        meal_id: meal.id,
        network: net,
        kind: 'drop',
        scheduled_for: new Date(whenISO).toISOString(),
        text: caption || `🍽️ ${meal.title} is LIVE on delivered.menu — $${(meal.price_cents/100).toFixed(2)}. Limited portions.`,
        image_url: shareImage,
        link_url: buildLink(baseUrl, net),
        status: 'pending'
    });
    }

    const webhookIds: string[] = Array.isArray(webhooks) ? webhooks : [];
    for (const wid of webhookIds) {
    rows.push({
        merchant_id: merchant.id,
        meal_id: meal.id,
        network: 'webhook',
        webhook_id: wid,
        kind: 'drop',
        scheduled_for: new Date(whenISO).toISOString(),
        text: caption || `🍽️ ${meal.title} is LIVE on delivered.menu — $${(meal.price_cents/100).toFixed(2)}. Limited portions.`,
        image_url: shareImage,
        link_url: buildLink(baseUrl, 'webhook'),
        status: 'pending'
    });
    }

    const { error } = await supa.from('scheduled_posts').insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof autoLastCall === 'boolean') {
    await supa.from('meals').update({ auto_last_call: autoLastCall }).eq('id', meal.id);
  }

  return NextResponse.json({ ok: true });
}
