// app/api/services/suggest/route.ts
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  template_id?: string;
  industry?: string;          // canonical key or label
  industry_key?: string;      // preferred canonical key
  industry_label?: string;    // human label (e.g., "Furniture Assembly")
  industry_other?: string;    // user-typed "Other" value (preferred topic)
  site_type?: string | null;  // 'portfolio' | 'blog' | 'about_me' | 'small_business'
  city?: string;
  state?: string;
  count?: number;             // default 6
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

const norm = (v: any) => (v == null ? '' : String(v).trim().toLowerCase());
const isMissingOrOther = (k: string) => !k || k === 'other' || k === 'general';

const SITE_LABEL: Record<string, string> = {
  small_business: 'Small Business',
  portfolio: 'Portfolio',
  blog: 'Blog',
  about_me: 'About Me',
};

// Try to extract a typed "other" industry from typical template JSON shapes
function pluckIndustryOther(tplData: any): string | null {
  const d = tplData ?? {};
  const candidates = [
    d?.identity?.industry_other,
    d?.identity?.industry_label,
    d?.meta?.identity?.industry_other,
    d?.meta?.identity?.industry_label,
    d?.meta?.industry_other,
    d?.meta?.industry_label,
  ];
  for (const v of candidates) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  }
  return null;
}

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

    // Inputs (request)
    const providedIndustryKeyOrLabel = norm(body.industry_key ?? body.industry ?? body.industry_label);
    const providedSiteType = norm(body.site_type);
    const providedTypedOther = String(body.industry_other ?? '').trim();

    let industryKey = providedIndustryKeyOrLabel;
    let siteType = providedSiteType;
    let typedOther = providedTypedOther; // preferred human topic if present

    let city = String(body.city ?? '').trim();
    let state = String(body.state ?? '').trim();

    // Optional DB lookups (only if we need them)
    let dbIndustryCandidate = '';
    let dbSiteTypeCandidate = '';
    let dbTypedOtherCandidate: string | null = null;

    if ((isMissingOrOther(industryKey) || !siteType || !typedOther) && body.template_id) {
      const { data: tpl } = await supabase
        .from('templates')
        .select('industry, data')
        .eq('id', body.template_id)
        .single();

      dbIndustryCandidate = norm((tpl as any)?.industry ?? (tpl as any)?.data?.meta?.industry);
      dbSiteTypeCandidate = norm((tpl as any)?.data?.meta?.site_type);
      dbTypedOtherCandidate = pluckIndustryOther((tpl as any)?.data);

      if (!city)  city  = String((tpl as any)?.data?.meta?.contact?.city  ?? '').trim();
      if (!state) state = String((tpl as any)?.data?.meta?.contact?.state ?? '').trim();

      if (isMissingOrOther(industryKey) && dbIndustryCandidate) industryKey = dbIndustryCandidate;
      if (!siteType && dbSiteTypeCandidate) siteType = dbSiteTypeCandidate;
      if (!typedOther && dbTypedOtherCandidate) typedOther = dbTypedOtherCandidate;
    }

    const count = Math.max(3, Math.min(12, Number(body.count) || 6));

    // ── Choose primary topic / basis ─────────────────────────────────────────
    // 1) Use typed "Other" string if present (best signal for specificity)
    // 2) Else use industry label/key if not "other"
    // 3) Else fall back to site_type
    let basis: 'typed_other' | 'industry' | 'site_type' = 'site_type';
    let topic = '';       // human topic the model will see (e.g., "Furniture Assembly")
    let effectiveKey = ''; // kept for debug parity

    if (typedOther) {
      basis = 'typed_other';
      topic = typedOther;
      effectiveKey = norm(typedOther);
    } else if (!isMissingOrOther(industryKey)) {
      basis = 'industry';
      topic = body.industry_label?.trim() || industryKey || SITE_LABEL[siteType] || 'Small Business';
      effectiveKey = industryKey;
    } else {
      basis = 'site_type';
      topic = SITE_LABEL[siteType] || 'Small Business';
      effectiveKey = siteType;
    }

    // If still empty, we have nothing to go on
    if (!topic) {
      return new Response(JSON.stringify({
        services: [],
        ...(wantDebug ? { debug: {
          industry_in: providedIndustryKeyOrLabel || null,
          site_type_in: providedSiteType || null,
          industry_other_in: providedTypedOther || null,
          industry_from_template: dbIndustryCandidate || null,
          site_type_from_template: dbSiteTypeCandidate || null,
          industry_other_from_template: dbTypedOtherCandidate || null,
          basis_used: null,
          effective_key_used: null,
          topic_used: null,
          city: city || null,
          state: state || null,
          template_id: body.template_id || null,
        }} : {})
      }), { status: 200 });
    }

    // ── Build the prompt ─────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const siteTypeGuidance = (t: string) => {
      switch (t) {
        case 'portfolio':
          return 'If site type is Portfolio, treat this as a creative/freelance studio. Suggest offerings like "Web Design", "Brand Identity", "Product Photography", "Case Study Writing", "UI/UX Audit", "Logo Design".';
        case 'blog':
          return 'If site type is Blog, suggest monetizable or supportable offerings (not posts): "Editorial Consulting", "Newsletter Setup", "Content Strategy", "Sponsorship Packages", "SEO Audit", "Writing Coaching".';
        case 'about_me':
          return 'If site type is About Me, suggest simple personal offerings: "Consulting", "Speaking", "Coaching", "Advisory Sessions", "Workshop Facilitation".';
        default:
          return 'For small businesses, suggest customer-facing services relevant to the trade (e.g., "Roadside Assistance", "Lockout Service").';
      }
    };

    const sys =
      'You generate concise customer-facing "services" / "offerings" for a website. ' +
      'Return STRICT JSON: {"services":["...","..."]}. ' +
      'Each item is 1–4 words, Title Case, no numbering, no emojis, no duplicates. ' +
      siteTypeGuidance(siteType || '');

    // Compose user message with the chosen topic + location context
    const lines: string[] = [];
    lines.push(`Topic: ${topic}`); // ← this is the main thing the model sees
    // Keep hints for extra specificity
    if (basis !== 'industry' && !isMissingOrOther(industryKey)) lines.push(`Industry key: ${industryKey}`);
    if (siteType) lines.push(`Site Type: ${siteType}`);
    if (body.industry_label?.trim()) lines.push(`Human Label: ${body.industry_label.trim()}`);
    if (city || state) lines.push(`Locale: ${[city, state].filter(Boolean).join(', ')}`);
    lines.push(`Count: ${count}`);

    const userMsg = lines.join('\n');

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
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

    // Tiny safety net if model ignored JSON
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
        industry_in: providedIndustryKeyOrLabel || null,
        site_type_in: providedSiteType || null,
        industry_other_in: providedTypedOther || null,
        industry_from_template: dbIndustryCandidate || null,
        site_type_from_template: dbSiteTypeCandidate || null,
        industry_other_from_template: dbTypedOtherCandidate || null,
        basis_used: basis,                // 'typed_other' | 'industry' | 'site_type'
        effective_key_used: effectiveKey, // normalized form
        topic_used: topic,                // human topic the model saw
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
