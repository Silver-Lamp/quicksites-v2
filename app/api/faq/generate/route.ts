// app/api/faq/generate/route.ts
import OpenAI from 'openai';
import { lazyClient } from '@/lib/lazyClient';
import { z } from 'zod';
import { enforceGuestAiLimit, guestLimitBody } from '@/lib/ai/guestGuard';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CookieOptionsWithName, createServerClient } from '@supabase/ssr';
import { parseJsonBody } from '@/lib/api/parseJson';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = lazyClient(() => new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }));

// ---------- simple in-memory rate limiter (per instance) ----------
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiFaqRateBuckets || new Map<string, Bucket>();
(globalThis as any).__aiFaqRateBuckets = mem;

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
// -----------------------------------------------------------------

// Permissive by design: every field is optional and the handler defaults/coerces
// each one, so this only rejects a non-object body or grossly wrong field types
// (e.g. services that isn't an array) — it won't break existing flexible callers.
const ReqSchema = z
  .object({
    prompt: z.string().optional(),
    tone: z.string().optional(),
    count: z.union([z.number(), z.string()]).optional(),
    template_id: z.string().optional(),
    site_slug: z.string().optional(),
    industry: z.string().optional(),
    services: z.array(z.string()).optional(),
  })
  .passthrough();
type ReqBody = z.infer<typeof ReqSchema>;

function normServices(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((s) => String(s ?? '').trim()).filter(Boolean)));
}

export async function POST(req: Request) {
  try {
    // Auth (Supabase)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // New SSR cookies API: getAll / setAll
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptionsWithName }) => {
              // next/headers supports both object and (name,value,options) signatures
              cookieStore.set(name, value, options);
            });
          },
        },
        cookieEncoding: 'base64url',
      }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      '0.0.0.0';
    const key = `ai-faq:${userRes.user.id}:${ip}`;
    if (limited(key)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const guard = await enforceGuestAiLimit(userRes.user, 'faq');
    if (!guard.ok) return NextResponse.json(guestLimitBody(guard.limit), { status: 429 });

    const parsedBody = await parseJsonBody(req, ReqSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body: ReqBody = parsedBody.data;
    const { prompt = '', tone = 'friendly' } = body;
    const safeCount = Math.max(1, Math.min(10, Number(body.count) || 5));

    // Pull industry/services from DB (preferred)
    let dbIndustry: string | null = null;
    let dbServices: string[] = [];

    if (body.template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services, slug')
        .eq('id', body.template_id)
        .single();
      dbIndustry = (data?.industry as string) ?? null;
      dbServices = normServices(data?.services);
    } else if (body.site_slug) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services, slug')
        .eq('slug', body.site_slug)
        .single();
      dbIndustry = (data?.industry as string) ?? null;
      dbServices = normServices(data?.services);
    }

    const finalIndustry = (dbIndustry ?? body.industry ?? 'services').toString().trim();
    const finalServices = dbServices.length ? dbServices : normServices(body.services);

    // Build prompt
    const sys = [
      `You write concise, practical FAQs for small-business websites.`,
      `Return STRICT JSON: {"faqs":[{"question":"...","answer":"..."}]}`,
      `- Answer in 1–3 sentences, clear and non-legalistic.`,
      `- If helpful, naturally reference the industry and specific services.`,
      `- Avoid duplicate questions; vary topics (pricing, availability, response time, process, guarantees, coverage areas, etc.).`,
    ].join(' ');

    const userMsg = [
      `Industry: ${finalIndustry}`,
      finalServices.length ? `Service offerings to reference: ${finalServices.join(', ')}` : null,
      `Tone: ${tone}`,
      prompt ? `Extra notes: ${prompt}` : null,
      `Count: ${safeCount}`,
    ]
      .filter(Boolean)
      .join('\n');

    let raw: string;
    try {
      raw = await meterLLMCall(
        { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', route: '/api/faq/generate' },
        async () => {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            // response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: userMsg },
            ],
            temperature: 0.7,
          });
          return {
            value: completion.choices?.[0]?.message?.content || '{}',
            usage: {
              input_tokens: completion.usage?.prompt_tokens,
              output_tokens: completion.usage?.completion_tokens,
            },
          };
        },
      );
    } catch (e) {
      if (e instanceof LLMBudgetExceededError) {
        return NextResponse.json({ error: 'AI budget reached, please try again later.' }, { status: 429 });
      }
      throw e;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Minimal fallback if model returns non-JSON
      parsed = {
        faqs: [
          {
            question: 'What services do you offer?',
            answer: 'We provide a range of services tailored to your needs. Contact us for details.',
          },
        ],
      };
    }

    const faqs = Array.isArray(parsed?.faqs) ? parsed.faqs : [];
    const cleaned = faqs
      .slice(0, safeCount)
      .map((f: any) => ({
        question: String(f?.question || '').trim().replace(/\s+/g, ' '),
        answer: String(f?.answer || '').trim().replace(/\s+/g, ' '),
      }))
      .filter((f: any) => f.question && f.answer);

    return NextResponse.json({
      faqs: cleaned,
      meta: { industry: finalIndustry, services: finalServices },
    });
  } catch (e: any) {
    console.error('AI FAQ error:', e);
    return NextResponse.json({ error: 'Failed to generate FAQs' }, { status: 500 });
  }
}
