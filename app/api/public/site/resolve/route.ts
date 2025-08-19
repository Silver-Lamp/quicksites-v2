import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeHostLike(input: string) {
  const s = input.trim().toLowerCase();
  const noProto = s.replace(/^https?:\/\//, '');
  const host = noProto.replace(/[:/].*$/, '').replace(/^www\./, '');
  return host;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const hint = (url.searchParams.get('hint') || '').trim();
  if (!hint) return NextResponse.json({ ok: false, error: 'hint required' }, { status: 400 });

  const jar = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => jar.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );

  // UUID straight through
  if (UUID.test(hint)) {
    const { data, error } = await supabase.from('sites').select('id, slug, hostname').eq('id', hint).maybeSingle();
    if (data?.id) return NextResponse.json({ ok: true, site_id: data.id, slug: data.slug, hostname: data.hostname });
    return NextResponse.json({ ok: false, error: error?.message || 'not found' }, { status: 404 });
  }

  // Derive host + a "no-dots" slug fallback
  const host = normalizeHostLike(hint);
  const noDots = host.replace(/\./g, '');

  // Try slug, then hostname
  for (const [col, val] of [
    ['slug', hint],
    ['slug', host],
    ['slug', noDots],
    ['hostname', host],
  ] as const) {
    if (!val) continue;
    const { data } = await supabase.from('sites').select('id, slug, hostname').eq(col, val).maybeSingle();
    if (data?.id) return NextResponse.json({ ok: true, site_id: data.id, slug: data.slug, hostname: data.hostname });
  }

  return NextResponse.json({ ok: false, error: 'site not found' }, { status: 404 });
}
