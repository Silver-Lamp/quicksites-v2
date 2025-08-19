// /app/api/chef/meals/generate-image/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { sizeFromAspect } from "@/lib/images/sizeFromAspect";


export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

const {
  title,
  description,
  cuisines = [],
  style = 'photo', // 'photo' | 'illustration'
  aspect = 'landscape', // 'landscape' | 'portrait' | 'square' | 'auto'
  bucket = process.env.MEAL_IMAGES_BUCKET || process.env.PROFILE_IMAGES_BUCKET || 'meals',
  } = body ?? {};
  
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  
  
  const parts = [
  style === 'photo' ? 'High-quality food photograph' : 'Stylized food illustration',
  title ? `Dish: ${title}.` : '',
  description ? `Description: ${description}.` : '',
  cuisines?.length ? `Cuisine: ${cuisines.join(', ')}.` : '',
  'Natural plating, appetizing, studio lighting, no text, no watermark.'
  ].filter(Boolean);
  
  
  const size = sizeFromAspect(aspect); // 1536x1024 (landscape) by default
  
  
  const result = await openai.images.generate({
  model: 'gpt-image-1',
  prompt: parts.join(' '),
  size,
  n: 1,
  });
  
  
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
  
  
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const id = randomUUID();
  const path = `meal-images/${id}.png`;
  
  
  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(b64, 'base64'), {
  contentType: 'image/png',
  upsert: false,
  });
  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  
  
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Image generation failed' }, { status: 500 });
  }
}