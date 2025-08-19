import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Any = any;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name: string | undefined = body?.name || body?.prompt || 'chef special';
    const cuisine: string | undefined = body?.cuisine;
    const style: 'photo' | 'illustration' = (body?.style === 'illustration' ? 'illustration' : 'photo');
    const size: '256x256' | '512x512' | '1024x1024' = (['256x256','512x512','1024x1024'].includes(body?.size) ? body?.size : '512x512');

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const styleLine = style === 'illustration'
      ? 'flat vector illustration, soft gradients'
      : 'studio-lit food photo, overhead or 45-degree angle, shallow depth of field';
    const cuisineLine = cuisine ? `, ${cuisine} cuisine` : '';
    const prompt =
      `Create a ${styleLine} of "${name}"${cuisineLine}. Natural plating, clean dishware, neutral backdrop, 
       no text, no watermark, no hands, no brand logos, composition centered for a square crop.`
        .replace(/\s+/g, ' ')
        .trim();

    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image data from OpenAI' }, { status: 502 });
    const buffer = Buffer.from(b64, 'base64');

    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side upload
    const bucket = process.env.MEAL_IMAGES_BUCKET || process.env.PROFILE_IMAGES_BUCKET || 'public';

    if (supaUrl && supaKey) {
      const supabase = createClient(supaUrl, supaKey);
      const path = `meals/generated/${randomUUID()}.png`;
      const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: 'image/png',
        upsert: false,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return NextResponse.json({ imageUrl: data.publicUrl, uploaded: true });
    }

    return NextResponse.json({ dataUrl: `data:image/png;base64,${b64}`, uploaded: false });
  } catch (e: Any) {
    return NextResponse.json({ error: e?.message || 'Meal image generation failed' }, { status: 500 });
  }
}
