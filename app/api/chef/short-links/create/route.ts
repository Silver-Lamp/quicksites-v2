import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function randCode(len=7) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s=''; for (let i=0;i<len;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
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

  const { mealId, longUrl } = await req.json();
  if (!mealId || !longUrl) return NextResponse.json({ error: 'mealId and longUrl required' }, { status: 400 });

  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'No merchant for user' }, { status: 400 });

  // verify meal ownership
  const { data: meal } = await supa.from('meals').select('id').eq('id', mealId).eq('merchant_id', merchant.id).maybeSingle();
  if (!meal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const baseUrl = process.env.APP_BASE_URL!;
  let code = randCode();
  for (let i=0;i<8;i++) {
    const { data: exists } = await supa.from('short_links').select('code').eq('code', code).maybeSingle();
    if (!exists) break;
    code = randCode();
  }

  const { error } = await supa.from('short_links').insert({
    code, long_url: longUrl, merchant_id: merchant.id, meal_id: meal.id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, code, shortUrl: `${baseUrl}/l/${code}` });
}
