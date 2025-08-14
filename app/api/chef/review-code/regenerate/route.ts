import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

function randCode(len=7) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s=''; for (let i=0;i<len;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}

export async function POST() {
  const supa = createRouteHandlerClient({ cookies });
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
