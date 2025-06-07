import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req, res) {
  const { data: campaigns } = await supabase
    .from('support_campaigns')
    .select('id, slug, headline, target_action, created_by, created_at');

  const results = [];

  for (const c of campaigns) {
    const { count } = await supabase
      .from('block_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', c.block_id)
      .eq('action', c.target_action);

    results.push({
      slug: c.slug,
      headline: c.headline,
      action: c.target_action,
      created_by: c.created_by,
      created_at: c.created_at,
      count
    });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="campaign-analytics.csv"');

  const header = 'slug,headline,action,created_by,created_at,count';
  const rows = results.map(r =>
    [r.slug, r.headline, r.action, r.created_by, r.created_at, r.count].join(',')
  );

  res.send([header, ...rows].join('
'));
}
