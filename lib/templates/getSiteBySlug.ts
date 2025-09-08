import { getServerSupabase } from '@/lib/supabase/server';

export async function getSiteBySlug(slug: string) {
  const sb = await getServerSupabase();

  // Prefer `sites`
  {
    const { data, error } = await sb
      .from('sites')
      .select('*')
      .eq('slug', slug)
      .limit(1);
    if (!error && data?.length) return data[0];
  }

  // Fallback `templates`
  {
    const { data, error } = await sb
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .order('is_site', { ascending: false })
      .limit(1);
    if (!error && data?.length) return data[0];
  }

  return null;
}
