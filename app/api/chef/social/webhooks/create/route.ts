import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function detectKind(u: string): 'slack'|'discord'|'generic' {
  if (/hooks\.slack\.com/.test(u)) return 'slack';
  if (/discord\.com\/api\/webhooks/.test(u)) return 'discord';
  return 'generic';
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

  const { name, endpoint_url } = await req.json();
  if (!name || !endpoint_url) return NextResponse.json({ error: 'name and endpoint_url required' }, { status: 400 });

  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'No merchant' }, { status: 400 });

  const kind = detectKind(endpoint_url);
  const { error } = await supa.from('social_webhooks').insert({ merchant_id: merchant.id, name, endpoint_url, kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
