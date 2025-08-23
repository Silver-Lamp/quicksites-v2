import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// simple in-memory limiter
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiHeroSuggestBucket || new Map<string, Bucket>();
(globalThis as any).__aiHeroSuggestBucket = mem;
function limited(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

export async function POST(req: Request) {
  try {
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
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    if (limited(`hero-suggest:${auth.user.id}:${ip}`)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const { template_id, industry, services = [], business_name, city, state } = body || {};

    // Prefer DB lookup
    let db: any = {};
    if (template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services, business_name, city, state')
        .eq('id', template_id)
        .single();
      db = data || {};
    }

    const finalIndustry = (db.industry ?? industry ?? 'Local Services').toString();
    const finalServices = Array.isArray(db.services) && db.services.length ? db.services : services;
    const biz = (db.business_name ?? business_name ?? '').toString();
    const loc = [db.city ?? city, db.state ?? state].filter(Boolean).join(', ');

    const sys = [
      'You write concise, punchy website hero copy.',
      'Return STRICT JSON: {"headline":"...", "subheadline":"...", "cta_text":"..."}',
      'Constraints:',
      '- Headline ≤ 7 words, no ending period.',
      '- Subheadline 8–20 words.',
      '- CTA in 2–4 words (e.g., "Get Help Now").',
    ].join(' ');

    const userMsg = [
      `Business: ${biz || 'N/A'}`,
      `Industry: ${finalIndustry}`,
      finalServices?.length ? `Services: ${finalServices.join(', ')}` : null,
      loc ? `Location: ${loc}` : null,
      `Audience: local customers seeking quick, trustworthy service.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return NextResponse.json({
      headline: String(parsed.headline || '').trim(),
      subheadline: String(parsed.subheadline || '').trim(),
      cta_text: String(parsed.cta_text || '').trim(),
    });
  } catch (e: any) {
    console.error('hero/suggest error', e);
    return NextResponse.json({ error: 'Failed to suggest copy' }, { status: 500 });
  }
}
