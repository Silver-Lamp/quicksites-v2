import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function invalidateCachedOgImage(slug: string, page: string) {
  const path = `og-cache/og-${slug}-${page}.png`;
  await supabase.storage.from('public').remove([path]);
}
