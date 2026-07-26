import { getOpenAI } from '@/lib/ai/openaiClient';
import { lazyClient } from '@/lib/lazyClient';
import { enforceGuestAiLimit, guestLimitBody } from '@/lib/ai/guestGuard';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';
import { NO_PEOPLE_INSTRUCTION, NO_PEOPLE_NEGATIVES } from '@/lib/images/noPeople';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-image-1 generation is slow (measured ~20s at 'medium', ~55s at 'high'). The
// default serverless timeout (~10–15s) was killing every request → 500. Give the
// function room; 60s is the max on Hobby and well within Pro.
export const maxDuration = 60;

const openai = lazyClient(() => getOpenAI('image'));

// simple in-memory limiter
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiHeroImgBucket || new Map<string, Bucket>();
(globalThis as any).__aiHeroImgBucket = mem;
function limited(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

/** Subject presets that bias toward *service outcome/equipment*, not people */
function presetSubjectFor(industry: string, services: string[] = []) {
  const s = (industry || '').toLowerCase();
  if (s.includes('landscap')) return 'lush green lawn with mowing stripes, tidy garden beds and stone edging, fresh mulch, tools or mower nearby, clean background';
  if (s.includes('window'))   return 'close-up squeegee wiping a large window with sparkling reflection of a home exterior, clean edges';
  if (s.includes('towing'))   return 'tow truck assisting a sedan on roadside at dusk, hazard lights, safe shoulder, highway backdrop';
  if (s.includes('roof'))     return 'freshly cleaned roof with streak-free shingles, gutter line visible, blue sky';
  if (s.includes('hvac'))     return 'modern HVAC condenser unit next to a home with neat landscaping, subtle depth of field';
  const first = services?.[0];
  return `clean, modern banner depicting ${first || industry} results and equipment, wide exterior scene`;
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
    if (limited(`hero-img:${auth.user.id}:${ip}`)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const guard = await enforceGuestAiLimit(auth.user, 'hero-image');
    if (!guard.ok) return NextResponse.json(guestLimitBody(guard.limit), { status: 429 });

    const body = await req.json();
    const {
      template_id,
      industry,
      services = [],
      business_name,
      city,
      state,
      subject,               // plain subject string (optional)
      style = 'photo',
      aspect = 'wide',
      // NEW optional fields from the editor:
      prompt: extraPrompt,   // richer guidance
      negative,              // “no faces, no text...” etc.
      prompt_context,        // arbitrary context if you want to log/extend
    } = body || {};
    // NOTE: `include_people` used to be an opt-in here. It was removed 2026-07-26 —
    // the mesh painterly-backdrop standard (crosstalk/contracts/painterly-backdrop.md,
    // rule 9) bans generated people network-wide. A body still sending the flag is
    // silently ignored rather than rejected, so old clients don't break.

    // Prefer DB context if template_id present
    let db: any = {};
    if (template_id) {
      const { data } = await supabase
        .from('templates')
        .select('industry, services, business_name, city, state')
        .eq('id', template_id)
        .maybeSingle();
      db = data || {};
    }

    const finalIndustry = (db?.industry ?? industry ?? 'Local Services').toString();
    const finalServices = Array.isArray(db?.services) && db.services.length ? db.services : services;
    const biz = (db?.business_name ?? business_name ?? '').toString();
    const loc = [db?.city ?? city, db?.state ?? state].filter(Boolean).join(', ');

    const size =
      aspect === 'wide' ? '1536x1024'
      : aspect === 'tall' ? '1024x1792'
      : '1024x1024';

    const stylePrompt =
      style === 'illustration' ? 'flat illustration, vector style, clean lines'
      : style === '3d'         ? '3D render, realistic lighting, soft shadows'
      : style === 'minimal'    ? 'minimal, lots of negative space, subtle gradients'
      : 'high-quality photo, cinematic lighting, crisp focus';

    const serviceHint = finalServices?.length ? `Show context of: ${finalServices.join(', ')}.` : '';
    const locHint = loc ? `Location vibe: ${loc}.` : '';
    const brandHint = biz ? `Subtle brand alignment for "${biz}".` : '';

    // Build a *banner-specific* prompt. Treat "hero" as website header, not a person.
    const subjectOrPreset = (subject && String(subject).trim()) || presetSubjectFor(finalIndustry, finalServices);
    const peopleInstruction = NO_PEOPLE_INSTRUCTION;

    // Fold in optional negatives (OpenAI images API has no separate negative param,
    // so bake them into the instruction text).
    const negatives = [
      NO_PEOPLE_NEGATIVES,
      negative ? String(negative) : '',
    ].filter(Boolean).join('; ');

    const base = [
      `Website hero/header banner for a ${finalIndustry} small business.`,
      subjectOrPreset + '.',
      stylePrompt + '.',
      'Wide composition with clear copy space for headline and subheadline.',
      'Clean modern background. No heavy overlaid text in the image.',
      peopleInstruction,
      serviceHint,
      locHint,
      brandHint,
      extraPrompt ? String(extraPrompt) : '',
      negatives ? `Avoid: ${negatives}.` : '',
    ].filter(Boolean).join(' ');

    // Generate image
    let img;
    try {
      img = await meterLLMCall(
        { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', route: '/api/hero/generate-image' },
        async () => {
          const result = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: base,
            size,
            // 'medium' finishes in ~20s (vs ~55s for 'high') — keeps us safely
            // under maxDuration and still looks great as a hero background.
            quality: 'medium',
            // response_format: 'b64_json',
          });
          return { value: result, usage: { images: result.data?.length ?? 1, metadata: { size: String(size) } } };
        },
      );
    } catch (e) {
      if (e instanceof LLMBudgetExceededError) {
        return NextResponse.json({ error: 'AI budget reached, please try again later.' }, { status: 429 });
      }
      throw e;
    }

    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

    return NextResponse.json({ image_base64: b64 });
  } catch (e: any) {
    console.error('hero/generate-image error', e);
    // OpenAI's safety system can reject a prompt (intermittently). Surface a clear,
    // actionable message instead of a generic 500 so the user knows to retry/reword.
    const code = e?.code ?? e?.error?.code;
    const msg = String(e?.message ?? e?.error?.message ?? '');
    if (code === 'moderation_blocked' || /safety system|content policy/i.test(msg)) {
      return NextResponse.json(
        { error: 'That image request was blocked by the safety system — try a different subject or wording.', code: 'moderation_blocked' },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
