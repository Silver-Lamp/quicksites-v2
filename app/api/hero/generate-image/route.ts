import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

    const body = await req.json();
    const { template_id, industry, services = [], business_name, city, state, subject, style = 'photo', aspect = 'wide' } = body || {};

    // prefer DB
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

    const size = aspect === 'wide' ? '1536x1024' : aspect === 'tall' ? '1024x1792' : '1024x1024';

    const stylePrompt =
      style === 'illustration' ? 'flat illustration, vector style, clean lines' :
      style === '3d' ? '3D render, realistic lighting, soft shadows' :
      style === 'minimal' ? 'minimal, lots of negative space, subtle gradients' :
      'high-quality photo, cinematic lighting, crisp focus';

    const serviceHint = finalServices?.length ? `Show context of: ${finalServices.join(', ')}.` : '';
    const locHint = loc ? `Location vibe: ${loc}.` : '';

    const prompt = [
      subject || `${finalIndustry} hero image`,
      stylePrompt,
      'Wide hero aspect, safe composition for overlay text, no heavy text in image.',
      serviceHint,
      locHint,
      biz ? `Subtle brand alignment for "${biz}".` : '',
    ].filter(Boolean).join(' ');

    // Generate image
    const img = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
      quality: 'high', // optional
      // background: 'transparent', // optional
      // response_format: 'b64_json',
    });

    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

    return NextResponse.json({ image_base64: b64 });
  } catch (e: any) {
    console.error('hero/generate-image error', e);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
