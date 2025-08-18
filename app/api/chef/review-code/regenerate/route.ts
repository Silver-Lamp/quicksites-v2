import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

function randCode(len=7) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s=''; for (let i=0;i<len;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}

export async function POST() {
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
  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'No merchant' }, { status: 400 });

  let code = randCode();
  for (let i=0;i<8;i++){
    const { data: clash } = await supa.from('merchants').select('id').eq('review_code', code).maybeSingle();
    if (!clash) break; code = randCode();
  }
  await supa.from('merchants').update({ review_code: code }).eq('id', merchant.id);
  return NextResponse.json({ ok: true, code });
}
