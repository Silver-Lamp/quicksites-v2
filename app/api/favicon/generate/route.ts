// app/api/favicon/generate/route.ts
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id?: string;
  business_name?: string;
  industry?: string;
  size?: '1024x1024';
  transparent?: boolean;
};

// simple per-instance limiter
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiFaviconBucket || new Map<string, Bucket>();
(globalThis as any).__aiFaviconBucket = mem;
function limited(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (arr) => arr.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
        cookieEncoding: 'base64url',
      }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    if (limited(`favicon:${auth.user.id}:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    // pull from DB if template_id
    let biz = (body.business_name ?? '').toString();
    let ind = (body.industry ?? '').toString();
    if (body.template_id) {
      const { data } = await supabase
        .from('templates')
        .select('business_name, industry')
        .eq('id', body.template_id)
        .single();
      biz = (data?.business_name ?? biz).toString();
      ind = (data?.industry ?? ind).toString();
    }

    const size = body.size || '1024x1024';
    const transparent = body.transparent !== false;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const prompt = [
      `${biz ? `${biz} ` : ''}${ind || 'local services'} favicon icon.`,
      'Flat minimal mark suitable for 16–32px, crisp edges, centered, simple geometry.',
      'No text unless monogram looks clean at 16px; otherwise avoid text.',
      'High contrast; clear silhouette. Works on dark and light backgrounds.',
    ].join(' ');

    const img = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
    //   response_format: 'b64_json',
      ...(transparent ? { background: 'transparent' as const } : {}),
    });

    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return new Response(JSON.stringify({ error: 'No image returned' }), { status: 500 });

    return new Response(JSON.stringify({ image_base64: b64 }), { status: 200 });
  } catch (e: any) {
    console.error('[favicon/generate] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'AI error' }), { status: 500 });
  }
}
