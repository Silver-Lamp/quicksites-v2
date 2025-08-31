// app/api/testimonials/generate/route.ts
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// --- simple in-memory limiter (per instance) ---
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiRateBuckets || new Map<string, Bucket>();
(globalThis as any).__aiRateBuckets = mem;
function limited(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) {
    mem.set(key, { start: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

type ReqBody = {
  prompt?: string;
  industry?: string; // optional fallback
  services?: string[]; // optional fallback
  tone?: 'friendly' | 'professional' | 'enthusiastic' | 'matter-of-fact';
  count?: number;
  template_id?: string; // ✅ prefer this to fetch DB row
  site_slug?: string;   // optional alternate lookup
};

function normServices(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map(s => String(s ?? '').trim()).filter(Boolean)));
}

export async function POST(req: Request) {
  try {
    // Auth (Supabase)
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // ✅ New API shape (SSR >= 0.13)
        cookies: {
          getAll() {
            // next/headers returns { name, value }[]
            return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          },
        },
        // optional, but matches default
        cookieEncoding: 'base64url',
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    const key = `ai-testimonials:${user.id}:${ip}`;
    if (limited(key)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const body = (await req.json()) as ReqBody;
    const { prompt = '', tone = 'friendly' } = body;
    const safeCount = Math.max(1, Math.min(6, Number(body.count) || 1));

    // ✅ Pull industry/services from the DB (preferred)
    let dbIndustry: string | null = null;
    let dbServices: string[] = [];

    if (body.template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services')
        .eq('id', body.template_id)
        .single();
      dbIndustry = data?.industry ?? null;
      dbServices = normServices(data?.services);
    } else if (body.site_slug) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services')
        .eq('slug', body.site_slug)
        .single();
      dbIndustry = data?.industry ?? null;
      dbServices = normServices(data?.services);
    }

    const finalIndustry = (dbIndustry ?? body.industry ?? 'services').toString().trim();
    const finalServices =
      dbServices.length > 0 ? dbServices : normServices(body.services);

    const sys = [
      `You write short, realistic customer testimonials (1–2 sentences each).`,
      `Return STRICT JSON: {"testimonials":[{"quote":"...", "attribution":"...", "rating":5, "avatar_url":null}]}`,
      `- rating is integer 4 or 5`,
      `- No newlines in quote`,
      `- Attribution should be first-name + last initial (e.g., "Morgan T.")`,
      `When possible, naturally reference the industry and a specific service performed.`,
      `Vary which service is mentioned across testimonials and avoid sounding templated.`,
    ].join(' ');

    const userMsg = [
      `Industry: ${finalIndustry}`,
      finalServices.length ? `Service offerings to reference: ${finalServices.join(', ')}` : null,
      `Tone: ${tone}`,
      prompt ? `Extra notes: ${prompt}` : null,
      `Count: ${safeCount}`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      // response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.8,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      parsed = { testimonials: [{ quote: raw.trim().replace(/\s+/g, ' '), attribution: 'Customer', rating: 5, avatar_url: null }] };
    }

    const testimonials = Array.isArray(parsed?.testimonials) ? parsed.testimonials : [];
    const cleaned = testimonials.slice(0, safeCount).map((t: any) => ({
      quote: String(t?.quote || '').trim().replace(/\n+/g, ' '),
      attribution: t?.attribution ? String(t.attribution).trim() : null,
      rating: Number.isFinite(Number(t?.rating)) ? Math.max(1, Math.min(5, Number(t.rating))) : 5,
      avatar_url: t?.avatar_url ? String(t.avatar_url) : null,
    })).filter((t: any) => t.quote);

    // extra meta (non-breaking) for debugging
    return NextResponse.json({ testimonials: cleaned, meta: { industry: finalIndustry, services: finalServices } });
  } catch (e: any) {
    console.error('AI testimonial error:', e);
    return NextResponse.json({ error: 'Failed to generate testimonials' }, { status: 500 });
  }
}
