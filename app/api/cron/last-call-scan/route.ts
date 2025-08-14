import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Meals with finite stock, active, auto flag on, qty between 1 and threshold
  const { data: meals } = await db
    .from('meals')
    .select('id, merchant_id, title, price_cents, slug, qty_available, last_call_threshold, auto_last_call')
    .eq('is_active', true)
    .not('qty_available', 'is', null)
    .gt('qty_available', 0)
    .lte('qty_available', db.rpc as any); // ignore typed RPC; we'll filter in JS instead

  const now = new Date();
  const candidates = (meals || []).filter(m =>
    (m.auto_last_call !== false) && (m.qty_available <= (m.last_call_threshold || 3))
  );

  let created = 0;

  for (const m of candidates) {
    // Skip if we posted last call in the last 12h
    const { data: mark } = await db.from('meal_post_markers').select('last_lastcall_at').eq('meal_id', m.id).maybeSingle();
    if (mark?.last_lastcall_at && (Date.now() - new Date(mark.last_lastcall_at).getTime()) < 12 * 3600 * 1000) {
      continue;
    }

    const handle = m.slug || m.id;
    const link = new URL(`${process.env.APP_BASE_URL}/meals/${handle}`);
    link.searchParams.set('utm_source', 'chef');
    link.searchParams.set('utm_medium', 'social');
    link.searchParams.set('utm_campaign', 'meal_share');
    link.searchParams.set('utm_content', 'x');

    const shareImage = `${process.env.APP_BASE_URL}/api/public/meal/${handle}/share-image?size=1080`;
    const text = `⏳ Last portions of ${m.title} — $${(m.price_cents/100).toFixed(2)}. Grab yours now.`;

    // fetch merchant's webhooks
    const { data: hooks } = await db
        .from('social_webhooks')
        .select('id')
        .eq('merchant_id', m.merchant_id);

    // Only enqueue X for now
    await db.from('scheduled_posts').insert({
        merchant_id: m.merchant_id, meal_id: m.id, network:'x', kind:'last_call',
        scheduled_for: now.toISOString(), text, image_url: shareImage, link_url: link.toString(), status:'pending'
      });

    for (const h of hooks || []) {
        await db.from('scheduled_posts').insert({
          merchant_id: m.merchant_id, meal_id: m.id, network:'webhook', webhook_id: h.id, kind:'last_call',
          scheduled_for: now.toISOString(), text, image_url: shareImage, link_url: link.toString(), status:'pending'
        });
      }
    // Mark
    await db.from('meal_post_markers')
      .upsert({ meal_id: m.id, last_lastcall_at: now.toISOString() });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
