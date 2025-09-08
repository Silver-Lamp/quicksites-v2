// app/api/services/suggest/route.ts
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id?: string;
  industry?: string;        // canonical key or label
  industry_key?: string;    // preferred canonical key
  industry_label?: string;  // human label
  city?: string;
  state?: string;
  count?: number; // default 6
  debug?: boolean;
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

const normalize = (v: any) => (v == null ? '' : String(v).trim().toLowerCase());

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const wantDebug = Boolean(body.debug);

    // Auth + rate limit
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
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    if (limited(`svc:${auth.user.id}:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    // Prefer request-provided industry; only fall back to DB if absent
    const providedIndustry = normalize(body.industry_key ?? body.industry ?? body.industry_label);
    let industry = providedIndustry;

    let city = String(body.city ?? '').trim();
    let state = String(body.state ?? '').trim();

    let dbIndustryCandidate = '';
    if ((!industry || industry === 'general') && body.template_id) {
      // Pull from templates; also look inside data.meta.*
      const { data: tpl } = await supabase
        .from('templates')
        .select('industry, data')
        .eq('id', body.template_id)
        .single();

      dbIndustryCandidate = normalize((tpl as any)?.industry ?? (tpl as any)?.data?.meta?.industry);
      if (!city)  city  = String((tpl as any)?.data?.meta?.contact?.city  ?? '').trim();
      if (!state) state = String((tpl as any)?.data?.meta?.contact?.state ?? '').trim();

      if (!industry && dbIndustryCandidate) industry = dbIndustryCandidate;
    }

    const count = Math.max(3, Math.min(12, Number(body.count) || 6));

    if (!industry) {
      return new Response(JSON.stringify({
        services: [],
        ...(wantDebug ? { debug: {
          industry_in: providedIndustry || null,
          industry_from_template: dbIndustryCandidate || null,
          industry_used: null,
          city: city || null,
          state: state || null,
          template_id: body.template_id || null,
        }} : {})
      }), { status: 200 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const sys =
      'You are a local-services naming helper. Return STRICT JSON: {"services":["...","..."]}. ' +
      'Each item is 1–4 words, customer-facing, no numbering, no emojis. No duplicates.';

    const userMsg = [
      `Industry: ${industry}`,                         // ← now the canonical, not overwritten
      city || state ? `Locale: ${[city, state].filter(Boolean).join(', ')}` : null,
      `Count: ${count}`,
      // Anchor with towing-like examples but generic enough; the model should adapt anyway
      'Examples (do not copy verbatim; adapt to the industry): "Roadside Assistance", "Battery Jumpstart", "Lockout Service".'
    ].filter(Boolean).join('\n');

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' }, // ask for strict JSON
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    let cleaned = cleanList(parsed?.services, count);

    // Tiny safety net: if the model somehow ignored JSON, try to salvage simple comma/line lists
    if (cleaned.length === 0 && typeof raw === 'string') {
      const fallback = raw
        .replace(/[\{\}\[\]"]/g, '')
        .split(/[\n,]/g)
        .map((s) => s.trim())
        .filter((s) => s && !/services?\s*:$/i.test(s));
      cleaned = cleanList(fallback, count);
    }

    return new Response(JSON.stringify({
      services: cleaned,
      ...(wantDebug ? { debug: {
        industry_in: providedIndustry || null,
        industry_from_template: dbIndustryCandidate || null,
        industry_used: industry,
        city: city || null,
        state: state || null,
        template_id: body.template_id || null,
      }} : {})
    }), { status: 200 });

  } catch (e: any) {
    console.error('[services/suggest] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'AI error' }), { status: 500 });
  }
}
