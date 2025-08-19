// app/actions/generateChefAvatar.ts
'use server';

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

type Options = {
  seedName?: string;         // use the typed name for flavor in prompt
  style?: 'photo' | 'illustration';
  size?: '256x256' | '512x512' | '1024x1024';
};

export async function generateChefAvatar(opts: Options = {}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Build a safe, generic portrait prompt (no real person, no logos)
  const styleLine = opts.style === 'illustration'
    ? "friendly vector illustration, soft edges, flat background"
    : "natural-light headshot photo, shallow depth of field";
  const nameFlavor = opts.seedName ? ` of a home cook named ${opts.seedName}` : "";
  const prompt =
    `Create a ${styleLine}${nameFlavor}. Subject facing camera, slight smile, 
     simple neutral background, wearing a plain apron (no text or logos), 
     composition centered, cropping works at 120x120.`.replace(/\s+/g,' ').trim();

  const size = opts.size ?? '512x512';

  // Generate image (base64 for easy upload)
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI did not return image data.');
  const buffer = Buffer.from(b64, 'base64');

  // If Supabase env is present, upload and return public URL
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.PROFILE_IMAGES_BUCKET || 'profile-images';

  if (supaUrl && supaKey) {
    const supabase = createClient(supaUrl, supaKey);
    const path = `chef-avatars/${randomUUID()}.png`;
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'image/png',
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { imageUrl: data.publicUrl, uploaded: true as const, dataUrl: undefined };
  }

  // Fallback: return a data URL (works fine for previews/forms)
  const dataUrl = `data:image/png;base64,${b64}`;
  return { imageUrl: undefined, uploaded: false as const, dataUrl };
}
