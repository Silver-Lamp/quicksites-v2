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

// small helpers
const trim = (s: any) => String(s ?? '').trim();
const cap = (s: string) => s.replace(/\s+/g, ' ').trim();

type SiteType = 'small_business' | 'portfolio' | 'blog' | 'about_me';

function defaultsFor(type: SiteType, name?: string) {
  const you = trim(name) || 'I';
  switch (type) {
    case 'portfolio':
      return {
        headline: 'Work That Speaks',
        subheadline: 'A curated selection of recent projects and collaborations.',
        cta_text: 'View Portfolio',
      };
    case 'blog':
      return {
        headline: 'Ideas in Progress',
        subheadline: 'Notes, essays, and updates on what I’m building and learning.',
        cta_text: 'Read the Blog',
      };
    case 'about_me':
      return {
        headline: `Hi, I’m ${you === 'I' ? '' : you}`.trim().replace(/\s+$/, ''),
        subheadline: 'A simple page about who I am, what I do, and how to reach me.',
        cta_text: 'Get In Touch',
      };
    default: // small_business
      return {
        headline: 'Your Trusted Local Service',
        subheadline: 'Fast, reliable solutions tailored to your needs in the community.',
        cta_text: 'Get Started Today',
      };
  }
}

function systemFor(type: SiteType) {
  const baseLines = [
    'You write concise, punchy website hero copy.',
    'Return STRICT JSON: {"headline":"...", "subheadline":"...", "cta_text":"..."}',
    'Do not add commentary or markdown. No code fences. No placeholders.',
  ];
  const constraintsSB = [
    'Constraints:',
    '- Headline ≤ 7 words, no ending period.',
    '- Subheadline 8–20 words.',
    '- CTA in 2–4 words (e.g., "Get Help Now").',
  ];
  const constraintsTight = [
    'Constraints:',
    '- Headline ≤ 5 words, no ending period.',
    '- Subheadline 10–18 words.',
    '- CTA in 2–3 words (e.g., "View Portfolio", "Read Blog").',
  ];
  switch (type) {
    case 'portfolio':
      return [...baseLines,
        'Voice: confident, minimal, craft-forward. Focus on outcomes, not buzzwords.',
        ...constraintsTight].join(' ');
    case 'blog':
      return [...baseLines,
        'Voice: approachable, curious. Emphasize ideas and cadence of writing.',
        ...constraintsTight].join(' ');
    case 'about_me':
      return [...baseLines,
        'Voice: friendly and human. Keep it simple; invite contact.',
        ...constraintsTight].join(' ');
    default:
      return [...baseLines,
        'Voice: trustworthy, benefit-led, local.',
        ...constraintsSB].join(' ');
  }
}

function normalizeModelJson(obj: any) {
  // Accept common variants the model might emit
  const headline =
    trim(obj?.headline) || trim(obj?.heading) || trim(obj?.title);
  const subheadline =
    trim(obj?.subheadline) || trim(obj?.subheading) || trim(obj?.tagline) || trim(obj?.description);
  const cta =
    trim(obj?.cta_text) || trim(obj?.ctaLabel) || trim(obj?.cta);
  return { headline, subheadline, cta_text: cta };
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
    const {
      template_id,
      industry,             // label; may be "Portfolio" / "Blog" etc when not small business
      site_type,            // 'small_business' | 'portfolio' | 'blog' | 'about_me'
      services = [],
      business_name,
      city,
      state,
    } = body || {};

    // Prefer DB lookup (also pull data.meta.site_type if available)
    let db: any = {};
    if (template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services, business_name, city, state, data')
        .eq('id', template_id)
        .single();
      db = data || {};
    }

    const dbSiteType: SiteType | null =
      (db?.data?.meta?.site_type as SiteType | undefined) ??
      (db?.site_type as SiteType | undefined) ??
      null;

    const finalSiteType: SiteType =
      (site_type as SiteType) ||
      dbSiteType ||
      // if they already chose a concrete industry previously, treat as small business
      ((db?.industry && db.industry !== 'other') ? 'small_business' : 'small_business');

    // For small business, this will be a real industry label; for others, it can be "Portfolio"/etc
    const finalIndustryLabel = cap(db?.industry ?? industry ?? (
      finalSiteType === 'small_business' ? 'Local Services' : finalSiteType.replace('_', ' ')
    ));

    const finalServices = Array.isArray(db?.services) && db.services.length ? db.services : services;
    const biz = trim(db?.business_name ?? business_name);
    const loc = [trim(db?.city ?? city), trim(db?.state ?? state)].filter(Boolean).join(', ');

    const sys = systemFor(finalSiteType);

    const userMsg = [
      `Site Type: ${finalSiteType}`,
      `Label/Industry: ${finalIndustryLabel}`,
      biz ? `Business: ${biz}` : null,
      finalServices?.length ? `Services: ${finalServices.join(', ')}` : null,
      loc ? `Location: ${loc}` : null,
      finalSiteType === 'small_business'
        ? 'Audience: local customers seeking quick, trustworthy service.'
        : finalSiteType === 'portfolio'
          ? 'Audience: prospective clients reviewing past work.'
          : finalSiteType === 'blog'
            ? 'Audience: readers interested in your ideas and updates.'
            : 'Audience: people who want to know who you are and how to contact you.',
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
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {}

    const norm = normalizeModelJson(parsed);
    const fallbacks = defaultsFor(finalSiteType, biz || undefined);

    // choose normalized or defaults; also normalize whitespace and stray punctuation
    const headline = cap(norm.headline || fallbacks.headline).replace(/\.$/, '');
    const subheadline = cap(norm.subheadline || fallbacks.subheadline);
    const cta_text = cap(norm.cta_text || fallbacks.cta_text);

    return NextResponse.json({ headline, subheadline, cta_text });
  } catch (e: any) {
    console.error('hero/suggest error', e);
    return NextResponse.json({ error: 'Failed to suggest copy' }, { status: 500 });
  }
}
