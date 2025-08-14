import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function clientIp(req: NextRequest) {
    const xff = req.headers.get('x-forwarded-for') || '';
    return xff.split(',')[0].trim() || '0.0.0.0';
  }
  
  async function verifyTurnstile(token: string, ip: string) {
    if (!process.env.TURNSTILE_SECRET_KEY) return true; // not configured → skip
    if (!token) return false;
    const body = new URLSearchParams();
    body.append('secret', process.env.TURNSTILE_SECRET_KEY);
    body.append('response', token);
    body.append('remoteip', ip);
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method:'POST', body });
    const data = await resp.json().catch(()=>({success:false}));
    return !!data.success;
  }

  async function getUserId() {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }
  
  export async function POST(req: NextRequest) {
    try {
      const { mealId, email, cfToken } = await req.json();
      if (!mealId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid email and mealId required' }, { status: 400 });
      }
      const ip = clientIp(req);
      if (!(await verifyTurnstile(cfToken || '', ip))) {
        return NextResponse.json({ error: 'Bot verification failed' }, { status: 400 });
      }
      const user = await getUserId();
      // --- SQL fallback rate-limit (5 hits / 10min per IP+meal) ---
      const key = `wl:${mealId}:${ip}`;
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await db.from('ratelimit_events')
        .select('id', { head: true, count: 'exact' })
        .eq('key', key)
        .gte('ts', since);
      if ((count ?? 0) >= 5) {
        return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
      }
      await db.from('ratelimit_events').insert({ key });
  
      // --- existing subscribe logic below ---
      const { data: meal } = await db
        .from('meals').select('id, site_id, merchant_id, is_active, qty_available')
        .eq('id', mealId).maybeSingle();
      if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
  
      const soldOut = meal.qty_available === 0 || !meal.is_active;
      if (!soldOut) return NextResponse.json({ error: 'Meal is currently available' }, { status: 400 });
  
      const { error } = await db.from('waitlist_subscriptions').upsert({
        site_id: meal.site_id,
        merchant_id: meal.merchant_id,
        meal_id: meal.id,
        email: email.toLowerCase(),
        user_id: user,
        status: 'active',
        notified_at: null
      }, { onConflict: 'meal_id,email' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
      return NextResponse.json({ ok: true });
    } catch (e:any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }