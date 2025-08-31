// app/api/services/suggest/route.ts
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id?: string;
  industry?: string;
  city?: string;
  state?: string;
  count?: number; // default 6
};

// simple per-instance limiter
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__svcSuggestBucket || new Map<string, Bucket>();
(globalThis as any).__svcSuggestBucket = mem;
function limited(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

function cleanList(arr: any, n: number) {
  const out = Array.isArray(arr) ? arr : [];
  return Array.from(new Set(
    out.map((s: any) => String(s ?? '').trim()).filter(Boolean)
  )).slice(0, n);
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
    if (limited(`svc:${auth.user.id}:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    let industry = (body.industry ?? '').toString().trim();
    let city = (body.city ?? '').toString().trim();
    let state = (body.state ?? '').toString().trim();

    if (body.template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, city, state')
        .eq('id', body.template_id)
        .single();
      industry = (data?.industry ?? industry).toString().trim();
      city = (data?.city ?? city).toString().trim();
      state = (data?.state ?? state).toString().trim();
    }

    const count = Math.max(3, Math.min(12, Number(body.count) || 6));
    if (!industry) {
      return new Response(JSON.stringify({ services: [] }), { status: 200 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const sys =
      'You are a local-services naming helper. Return STRICT JSON: {"services":["...","..."]}. ' +
      'Each item is 1–4 words, customer-facing, no numbering, no emojis. No duplicates.';

    const userMsg = [
      `Industry: ${industry}`,
      city || state ? `Locale: ${[city, state].filter(Boolean).join(', ')}` : null,
      `Count: ${count}`,
      'Examples (do not copy; adapt to the industry): "Roadside Assistance", "Battery Jumpstart", "Lockout Service".'
    ].filter(Boolean).join('\n');

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      // response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const cleaned = cleanList(parsed?.services, count);
    return new Response(JSON.stringify({ services: cleaned }), { status: 200 });
  } catch (e: any) {
    console.error('[services/suggest] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'AI error' }), { status: 500 });
  }
}
