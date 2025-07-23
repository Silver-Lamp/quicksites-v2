import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function cacheOgImage(slug: string, page: string, buffer: Buffer) {
  const filename = `og-${slug}-${page}.png`;
  const output = await sharp(buffer).resize(1200, 630).png().toBuffer();

  await supabase.storage
    .from('public')
    .upload(`og-cache/${filename}`, output, { contentType: 'image/png', upsert: true });

  const { data } = supabase.storage.from('public').getPublicUrl(`og-cache/${filename}`);
  return data.publicUrl;
}
