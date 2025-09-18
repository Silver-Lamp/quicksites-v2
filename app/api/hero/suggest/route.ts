// app/api/hero/suggest/route.ts
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { resolveIndustryKey, toIndustryLabel } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ───────────────────────────────── Rate limit (in-memory) ─────────────────────────────────
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

// ───────────────────────────────── helpers ─────────────────────────────────
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
  const headline = trim(obj?.headline) || trim(obj?.heading) || trim(obj?.title);
  const subheadline = trim(obj?.subheadline) || trim(obj?.subheading) || trim(obj?.tagline) || trim(obj?.description);
  const cta = trim(obj?.cta_text) || trim(obj?.ctaLabel) || trim(obj?.cta);
  return { headline, subheadline, cta_text: cta };
}

// ──────────────────────────────── industry derivation ────────────────────────────────
type Incoming = {
  template_id?: string;
  industry?: string;     // human label (may be "", "Other")
  industry_key?: string; // canonical key like "windshield_repair" | "other"
  site_type?: SiteType;
  services?: string[];
  business_name?: string;
  city?: string;
  state?: string;
};

function labelFromKey(key: string) {
  const k = resolveIndustryKey(key);
  return k && k !== 'other' ? toIndustryLabel(k) : '';
}

/**
 * Decide on a specific industry label, preferring:
 *   1) body.industry_key (when not 'other')
 *   2) body.industry label (when non-empty and not literally "Other")
 *   3) template.data.meta: industry_other → label, or industry key → mapped label
 *   4) template columns: industry_label (unless "Other")
 * If nothing found, return '' to indicate "generic".
 */
function deriveIndustryLabelFrom(db: any, body: Incoming): string {
  // #1: explicit key from request
  const bodyKey = trim(body.industry_key);
  if (bodyKey && bodyKey !== 'other') {
    const lbl = labelFromKey(bodyKey);
    if (lbl) return lbl;
  }
  // #2: explicit human label from request
  const bodyLabel = trim(body.industry);
  if (bodyLabel && bodyLabel.toLowerCase() !== 'other') return bodyLabel;

  // Pull from template meta/columns
  const meta = (db?.data as any)?.meta ?? {};
  const metaOther = trim(meta.industry_other);
  if (metaOther) return metaOther;

  const metaKey = trim(meta.industry);
  if (metaKey && metaKey !== 'other') {
    const lbl = labelFromKey(metaKey);
    if (lbl) return lbl;
  }

  const colKey = trim(db?.industry);
  if (colKey && colKey !== 'other') {
    const lbl = labelFromKey(colKey);
    if (lbl) return lbl;
  }

  const colLabel = trim(meta.industry_label ?? db?.industry_label);
  if (colLabel && colLabel.toLowerCase() !== 'other') return colLabel;

  return '';
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

    const body = (await req.json()) as Incoming;

    // Prefer one DB fetch that we can reuse for both meta and context
    let db: any = {};
    if (body.template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, industry_label, services, business_name, city, state, data, site_type')
        .eq('id', body.template_id)
        .maybeSingle();
      db = data || {};
    }

    // Determine site type (prefer request, then meta, then column, then sensible default)
    const dbSiteType: SiteType | null =
      (db?.data?.meta?.site_type as SiteType | undefined) ??
      (db?.site_type as SiteType | undefined) ??
      null;

    const finalSiteType: SiteType =
      (body.site_type as SiteType) ||
      dbSiteType ||
      'small_business';

    // 🔧 Hardened industry derivation
    const finalIndustryLabel = deriveIndustryLabelFrom(db, body); // '' means "generic"

    // Context for prompt
    const finalServices =
      (Array.isArray(db?.services) && db.services.length ? db.services : body.services) ?? [];
    const biz = trim(db?.business_name ?? body.business_name);
    const loc = [trim(db?.city ?? body.city), trim(db?.state ?? body.state)]
      .filter(Boolean)
      .join(', ');

    const sys = systemFor(finalSiteType);

    const contextLines: string[] = [
      `Site Type: ${finalSiteType}`,
    ];
    if (finalIndustryLabel) contextLines.push(`Label/Industry: ${finalIndustryLabel}`);
    if (biz) contextLines.push(`Business: ${biz}`);
    if (finalServices.length) contextLines.push(`Services: ${finalServices.join(', ')}`);
    if (loc) contextLines.push(`Location: ${loc}`);
    contextLines.push(
      finalSiteType === 'small_business'
        ? 'Audience: local customers seeking quick, trustworthy service.'
        : finalSiteType === 'portfolio'
          ? 'Audience: prospective clients reviewing past work.'
          : finalSiteType === 'blog'
            ? 'Audience: readers interested in your ideas and updates.'
            : 'Audience: people who want to know who you are and how to contact you.'
    );

    const userMsg = contextLines.join('\n');

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

    const headline = cap((norm.headline || fallbacks.headline)).replace(/\.$/, '');
    const subheadline = cap(norm.subheadline || fallbacks.subheadline);
    const cta_text = cap(norm.cta_text || fallbacks.cta_text);

    return NextResponse.json({
      headline,
      subheadline,
      cta_text,
      generic: !finalIndustryLabel, // helpful flag for debugging/UX
    });
  } catch (e: any) {
    console.error('hero/suggest error', e);
    return NextResponse.json({ error: 'Failed to suggest copy' }, { status: 500 });
  }
}
