// app/api/admin/products/suggest/route.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  email?: string;
  hint?: string | null;
  product_type?: 'service' | 'physical' | 'digital' | 'meal';
  template_id?: string;
  industry?: string;
  city?: string;
  state?: string;
  currency?: string;        // default 'USD'
  default_qty?: number;     // default 25
  min_price_cents?: number; // soft bounds (optional)
  max_price_cents?: number;
  debug?: boolean;
};

// simple per-instance limiter
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__prodSuggestBucket || new Map<string, Bucket>();
(globalThis as any).__prodSuggestBucket = mem;
function limited(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

const norm = (v: unknown) => (v == null ? '' : String(v).trim());
const normLower = (v: unknown) => norm(v).toLowerCase();

const DEFAULTS = {
  currency: 'USD',
  default_qty: 25,
  service:  { min: 4900, max: 19900 }, // $49–$199
  physical: { min: 1500, max:  9900 }, // $15–$99
  digital:  { min:  900, max:  4900 }, // $9–$49
  meal:     { min:  999, max:  2999 }, // $9.99–$29.99
};

/** Industry-aware soft ranges (only applied when caller didn't explicitly set min/max). */
const INDUSTRY_SOFT: Array<{
  keywords: string[];
  service?: { min: number; max: number };
}> = [
  { keywords: ['towing','roadside','tow'],              service: { min:  7900, max: 19900 } }, // $79–$199
  { keywords: ['locksmith','lockout'],                  service: { min:  6900, max: 14900 } }, // $69–$149
  { keywords: ['plumb'],                                service: { min:  9900, max: 29900 } }, // $99–$299
  { keywords: ['hvac','heating','air','furnace','ac'],  service: { min:  8900, max: 24900 } }, // $89–$249
  { keywords: ['pest','extermin'],                      service: { min:  5900, max: 14900 } }, // $59–$149
  { keywords: ['clean'],                                service: { min:  7900, max: 19900 } }, // $79–$199
  { keywords: ['landscap','lawn','tree'],               service: { min:  4900, max: 14900 } }, // $49–$149
  { keywords: ['roof'],                                 service: { min:  9900, max: 24900 } }, // $99–$249
  { keywords: ['move','movers'],                        service: { min:  9900, max: 24900 } }, // $99–$249
  { keywords: ['photo','photography'],                  service: { min: 14900, max: 39900 } }, // $149–$399
  { keywords: ['salon','barber','hair'],                service: { min:  2500, max:  8500 } }, // $25–$85
  { keywords: ['massage','spa'],                        service: { min:  6000, max: 15000 } }, // $60–$150
  { keywords: ['trainer','fitness'],                    service: { min:  4000, max: 12000 } }, // $40–$120
  { keywords: ['pet groom'],                            service: { min:  4000, max: 12000 } }, // $40–$120
  { keywords: ['vet','veterinary'],                     service: { min:  6900, max: 19900 } }, // $69–$199
  { keywords: ['auto repair','mechanic'],               service: { min:  7900, max: 29900 } }, // $79–$299
  { keywords: ['detail'],                               service: { min:  9900, max: 24900 } }, // $99–$249
  { keywords: ['taxi','rideshare'],                     service: { min:  4900, max: 14900 } }, // $49–$149
  { keywords: ['handyman'],                             service: { min:  7900, max: 19900 } }, // $79–$199
  { keywords: ['electric'],                             service: { min:  8900, max: 24900 } }, // $89–$249
  { keywords: ['appliance'],                            service: { min:  7900, max: 19900 } }, // $79–$199
];

function applyIndustrySoftRange(
  industryLower: string,
  productType: Body['product_type'],
  soft: { min: number; max: number },
  explicitMin: boolean,
  explicitMax: boolean
) {
  if (!industryLower || productType !== 'service') return soft;
  const row = INDUSTRY_SOFT.find(r => r.keywords.some(k => industryLower.includes(k)));
  if (!row?.service) return soft;
  return {
    min: explicitMin ? soft.min : row.service.min,
    max: explicitMax ? soft.max : row.service.max,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const wantDebug = !!body.debug;

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
    if (!auth?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    if (limited(`prod:${auth.user.id}:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    // Context (prefer body, fall back to template)
    let industry = normLower(body.industry);
    let city     = norm(body.city);
    let state    = norm(body.state);

    if ((!industry || industry === 'general') && body.template_id) {
      const { data: tpl } = await supabase
        .from('templates')
        .select('industry, data')
        .eq('id', body.template_id)
        .single();

      industry ||= normLower((tpl as any)?.industry ?? (tpl as any)?.data?.meta?.industry);
      city     ||= norm((tpl as any)?.data?.meta?.contact?.city);
      state    ||= norm((tpl as any)?.data?.meta?.contact?.state);
    }

    const productType = (body.product_type ?? 'service') as NonNullable<Body['product_type']>;
    const currency    = body.currency || DEFAULTS.currency;
    const defaultQty  = Number.isFinite(body.default_qty) ? Math.max(1, Number(body.default_qty)) : DEFAULTS.default_qty;

    // Soft range (caller can override either bound)
    const explicitMin = Number.isFinite(body.min_price_cents);
    const explicitMax = Number.isFinite(body.max_price_cents);
    let soft = {
      min: explicitMin ? Math.max(0, Number(body.min_price_cents)) : (DEFAULTS as any)[productType].min,
      max: explicitMax ? Math.max(0, Number(body.max_price_cents)) : (DEFAULTS as any)[productType].max,
    };
    soft = applyIndustrySoftRange(industry, productType, soft, explicitMin, explicitMax);

    // 1) Try to seed a concrete service title via your /api/services/suggest (service only)
    let seedTitle = '';
    if (productType === 'service') {
      try {
        const base = new URL(req.url).origin;
        const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');
        const svcRes = await fetch(`${base}/api/services/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          cache: 'no-store',
          body: JSON.stringify({
            template_id: body.template_id,
            industry,
            city,
            state,
            count: 1,
          }),
        });
        const svcJson = await svcRes.json().catch(() => ({}));
        const list = Array.isArray(svcJson?.services) ? svcJson.services : [];
        if (list.length > 0) seedTitle = String(list[0]).trim();
      } catch { /* ignore; fallback to LLM only */ }
    }

    // 2) Call OpenAI (JSON mode) to produce the structured suggestion
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const sys =
      'You are a product/service suggestion helper for local small businesses. ' +
      'Return STRICT JSON with keys: {"title": "...", "price_cents": 1234, "qty_available": 25, "image_url": "", "product_type": "service|physical|digital|meal"}. ' +
      'Rules:\n' +
      '- title <= 60 chars, clear and customer-facing; no emojis; no quotes; no trailing punctuation.\n' +
      '- price_cents is an integer in cents.\n' +
      `- qty_available is a positive integer (default ${defaultQty}).\n` +
      '- image_url may be empty string.\n' +
      '- product_type must be one of: service, physical, digital, meal.\n' +
      'No extra keys. No markdown.';

    const lines: string[] = [];
    if (industry) lines.push(`Industry: ${industry}`);
    if (city || state) lines.push(`Locale: ${[city, state].filter(Boolean).join(', ')}`);
    lines.push(`Product type: ${productType}`);
    lines.push(`Currency: ${currency}`);
    lines.push(`Soft price range (cents): ${soft.min}-${soft.max}`);
    if (body.hint)  lines.push(`Hint: ${norm(body.hint)}`);
    if (seedTitle)  lines.push(`Use this service title or a close variant: ${seedTitle}`);

    switch (productType) {
      case 'service':
        lines.push('Style: concise service offering. Examples: Battery Jumpstart (60 min), Emergency Lockout.');
        break;
      case 'physical':
        lines.push('Style: product name with one key attribute. Example: Branded T-Shirt (Cotton).');
        break;
      case 'digital':
        lines.push('Style: downloadable/subscription offering. Example: PDF Guide: Winter Prep Checklist.');
        break;
      case 'meal':
        lines.push('Style: short meal name. Example: BBQ Chicken Plate.');
        break;
    }

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: lines.join('\n') },
      ],
    });

    let out: any = {};
    try { out = JSON.parse(resp.choices?.[0]?.message?.content || '{}'); } catch {}

    // Defensive fill
    let title = norm(out.title) || seedTitle || (productType === 'service' ? 'Service' : 'Product');
    let price_cents = Number(out.price_cents);
    if (!Number.isFinite(price_cents) || price_cents < 0) {
      price_cents = Math.round((soft.min + soft.max) / 2);
    }
    let qty_available = Number(out.qty_available);
    if (!Number.isFinite(qty_available) || qty_available < 1) {
      qty_available = defaultQty;
    }
    const image_url = typeof out.image_url === 'string' ? out.image_url : '';
    const typeOut = (out.product_type as Body['product_type']) || productType;

    const payload = { title, price_cents, qty_available, image_url, product_type: typeOut };

    return new Response(JSON.stringify({
      ...payload,
      ...(wantDebug ? { debug: { industry, city, state, seedTitle: seedTitle || null, productType, soft } } : {}),
    }), { status: 200 });

  } catch (e: any) {
    console.error('[admin/products/suggest] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'AI error' }), { status: 500 });
  }
}
