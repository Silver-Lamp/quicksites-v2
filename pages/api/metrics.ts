import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const [{ count: claimed }, { count: published }, { count: forks }, views] =
    await Promise.all([
      supabase.from('domains').select('*', { count: 'exact', head: true }),
      supabase.from('public_sites').select('*', { count: 'exact', head: true }),
      supabase
        .from('public_sites')
        .select('*', { count: 'exact', head: true })
        .neq('template_id', null),
      supabase
        .from('published_site_views')
        .select('*', { count: 'exact', head: true })
        .gte('viewed_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

  return json({
    claimed: claimed ?? 0,
    published: published ?? 0,
    forks: forks ?? 0,
    views7d: views?.count ?? 0,
  });
}
