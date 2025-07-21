import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function tryUseCachedOgImage(slug: string, page: string): Promise<string | null> {
  const path = `og-cache/og-${slug}-${page}.png`;
  const { data } = supabase.storage.from('public').getPublicUrl(path);

  try {
    const head = await fetch(data.publicUrl, { method: 'HEAD' });
    return head.ok ? data.publicUrl : null;
  } catch {
    return null;
  }
}
