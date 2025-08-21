import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { getXClient } from '@/lib/social/_disabled_x';
import { render, defaultCaption } from '@/lib/text-template';
import { composeHashtags } from '@/lib/hashtags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function buildWebhookMessage(db: any, p: any, hook: any) {
  // Fetch minimal meal info for template variables
  const { data: meal } = await db
    .from('meals')
    .select('id, slug, title, price_cents, cuisines, qty_available, hashtags, hashtags_mode')
    .eq('id', p.meal_id).maybeSingle();

  const base = process.env.APP_BASE_URL!;
  const handle = meal?.slug || meal?.id || p.meal_id;
  const price = meal ? `$${(meal.price_cents/100).toFixed(2)}` : '';
  const cuisines = (meal?.cuisines || []).slice(0, 3);
  const hashtags = composeHashtags({
    base: ['localfood','homemade'],
    cuisines: meal?.cuisines || [],
    connectorDefault: hook.default_hashtags || '',
    mealHashtags: meal?.hashtags || '',
    mode: (meal?.hashtags_mode as 'append'|'replace') || 'append',
    cap: 6
  });
  
  const ctx = {
    meal_title: meal?.title || 'Meal',
    price,
    chef_name: '',
    link: p.link_url,
    qty: meal?.qty_available ?? '',
    cuisines: (meal?.cuisines || []).slice(0,3).join(', '),
    site_name: 'delivered.menu',
    hashtags,
    kind: p.kind,
    network: 'webhook'
  };

  const tpl =
    (p.kind === 'last_call' && hook.template_text_last_call) ? hook.template_text_last_call :
    (p.kind === 'drop' && hook.template_text_drop) ? hook.template_text_drop :
    hook.template_text_custom;

  const text = render(tpl, ctx) || p.text || defaultCaption(p.kind, ctx);
  const link = hook.template_include_link !== false ? ctx.link : undefined;
  const image = hook.template_include_image !== false ? p.image_url : undefined;
  return { text, link, image };
}

// async function postToX(acc:any, text:string, imageUrl?:string, link?:string) {
//   const { client, updated } = await getXClient(acc);
//   if (updated) {
//     await db.from('social_accounts').update(updated).eq('id', acc.id);
//   }

//   let mediaId: string | undefined;
//   if (imageUrl) {
//     const resp = await fetch(imageUrl);
//     const buf = Buffer.from(await resp.arrayBuffer());
//     const u = await client.v1.uploadMedia(buf, { mimeType: 'image/png' });
//     mediaId = u;
//   }

//   const full = link ? `${text}\n${link}` : text;
//   await client.v2.tweet({ text: full, media: mediaId ? { media_ids: [mediaId] } : undefined });
// }
async function postWebhook(hook:any, text:string, link:string, image?:string) {
  const url = hook.endpoint_url as string;
  if (/hooks\.slack\.com/.test(url)) {
    // Minimal Slack payload (Incoming Webhook)
    const payload = {
      text: `${text}\n${link}`,
      // Optional blocks with image
      ...(image ? {
        attachments: [{ image_url: image, text: ' ' }]
      } : {})
    };
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return;
  }
  if (/discord\.com\/api\/webhooks/.test(url)) {
    const payload:any = { content: `${text}\n${link}` };
    if (image) {
      payload.embeds = [{ image: { url: image } }];
    }
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return;
  }
  // Generic: send structured JSON — Zapier/Make can map these fields
  const payload = { text, link, image };
  await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: due } = await db
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100);

  let sent = 0;

  for (const p of due || []) {
    try {

      if (p.network === 'webhook') {
        const { data: hook } = await db
          .from('social_webhooks')
          .select('id, endpoint_url, kind, template_text_drop, template_text_last_call, template_text_custom, template_include_image, template_include_link, enabled')
          .eq('id', p.webhook_id)
          .eq('merchant_id', p.merchant_id)
          .maybeSingle();
        if (!hook) throw new Error('Webhook not found');
        if (hook.enabled === false) { // skip silently
          await db.from('scheduled_posts').update({ status: 'skipped', attempts: p.attempts + 1, last_error: 'disabled' }).eq('id', p.id);
          continue;
        }
      
        const msg = await buildWebhookMessage(db, p, hook);
      
        // Reuse existing postWebhook helper
        await postWebhook(hook, msg.text, msg.link, msg.image);
      }
      //  else if (p.network === 'x') {
      //     const { data: acc } = await db
      //       .from('social_accounts')
      //       .select('id, access_token, refresh_token, expires_at')
      //       .eq('merchant_id', p.merchant_id)
      //       .eq('provider', 'x')
      //       .maybeSingle();
      //     if (!acc) throw new Error('No X account connected');
      //     await postToX(acc, p.text, p.image_url || undefined, p.link_url);
      //   }
      
      
      await db.from('scheduled_posts')
        .update({ status: 'sent', attempts: p.attempts + 1, sent_at: new Date().toISOString(), last_error: null })
        .eq('id', p.id);
      sent++;
    } catch (e:any) {
      await db.from('scheduled_posts')
        .update({ status: 'failed', attempts: p.attempts + 1, last_error: String(e?.message || e) })
        .eq('id', p.id);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
