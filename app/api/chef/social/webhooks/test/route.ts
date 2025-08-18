import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { render, defaultCaption } from '@/lib/text-template';
import { composeHashtags } from '@/lib/hashtags';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || '0.0.0.0';
}

async function postWebhook(url: string, kind: string, text: string, link?: string, image?: string) {
  if (/hooks\.slack\.com/.test(url)) {
    const payload: any = { text: link ? `${text}\n${link}` : text };
    if (image) payload.attachments = [{ image_url: image, text: ' ' }];
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`Slack ${r.status}`);
    return;
  }
  if (/discord\.com\/api\/webhooks/.test(url)) {
    const payload: any = { content: link ? `${text}\n${link}` : text };
    if (image) payload.embeds = [{ image: { url: image } }];
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`Discord ${r.status}`);
    return;
  }
  // generic
  const payload = { text, link, image, kind };
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`Generic ${r.status}`);
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

  const { webhook_id, meal_id, kind = 'drop', send = false } = await req.json();
  if (!webhook_id || !meal_id) return NextResponse.json({ error: 'webhook_id and meal_id required' }, { status: 400 });

  // Ratelimit: 3 tests / 5min per webhook+ip
  const ip = clientIp(req);
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supa.from('ratelimit_events').insert({ key: `wh-test:${webhook_id}:${ip}` });
  const { count } = await supa.from('ratelimit_events').select('id', { head: true, count:'exact' }).eq('key', `wh-test:${webhook_id}:${ip}`).gte('ts', since);
  if ((count ?? 0) > 3) return NextResponse.json({ error: 'Too many tests. Try again later.' }, { status: 429 });

  // Ownership & data
  const { data: merchant } = await supa.from('merchants').select('id, display_name, name').eq('user_id', user.id).maybeSingle();
  const { data: hook } = await supa
    .from('social_webhooks')
    .select('*')
    .eq('id', webhook_id)
    .eq('merchant_id', merchant?.id || '')
    .maybeSingle();
  if (!hook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });

  const { data: meal } = await supa
    .from('meals')
    .select('id, slug, title, price_cents, cuisines, qty_available, is_active, site_id, hashtags, hashtags_mode')
    .eq('id', meal_id)
    .eq('merchant_id', merchant?.id || '')
    .maybeSingle();
  if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });

  const handle = meal.slug || meal.id;
  const siteName = 'delivered.menu';
  const base = process.env.APP_BASE_URL || 'https://delivered.menu';
  const link = new URL(`${base}/meals/${handle}`);
  link.searchParams.set('utm_source', 'chef');
  link.searchParams.set('utm_medium', 'social');
  link.searchParams.set('utm_campaign', 'meal_share');
  link.searchParams.set('utm_content', 'webhook');

  const image = `${base}/api/public/meal/${handle}/share-image?size=1080`;
  const price = `$${(meal.price_cents/100).toFixed(2)}`;
  const chefName = merchant?.display_name || merchant?.name || 'Chef';
  const cuisines = (meal.cuisines || []).slice(0, 3);
  const hashtags = composeHashtags({
    base: ['localfood','homemade'],
    cuisines: meal.cuisines || [],
    connectorDefault: hook.default_hashtags || '',
    mealHashtags: meal.hashtags || '',
    mode: (meal.hashtags_mode as 'append'|'replace') || 'append',
    cap: 6
  });
  
  const ctx = {
    meal_title: meal.title,
    price,
    chef_name: chefName,
    link: link.toString(),
    qty: meal.qty_available ?? '',
    cuisines: (meal.cuisines || []).slice(0,3).join(', '),
    site_name: siteName,
    hashtags,
    kind,
    network: 'webhook'
  };
  

  const chosenTpl =
    (kind === 'last_call' && hook.template_text_last_call) ? hook.template_text_last_call :
    (kind === 'drop' && hook.template_text_drop) ? hook.template_text_drop :
    hook.template_text_custom;

  const text = render(chosenTpl, ctx) || defaultCaption(kind, ctx);
  const finalLink = hook.template_include_link !== false ? ctx.link : undefined;
  const finalImg = hook.template_include_image !== false ? image : undefined;

  if (!send) {
    return NextResponse.json({
      preview: { text, link: finalLink || null, image: finalImg || null, kind, to: hook.name, provider: hook.kind }
    });
  }

  try {
    await postWebhook(hook.endpoint_url, kind, text, finalLink, finalImg);
    await supa.from('social_webhooks').update({
      last_test_at: new Date().toISOString(),
      last_test_status: 'sent',
      last_test_error: null
    }).eq('id', hook.id);
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    await supa.from('social_webhooks').update({
      last_test_at: new Date().toISOString(),
      last_test_status: 'failed',
      last_test_error: String(e?.message || e)
    }).eq('id', hook.id);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
