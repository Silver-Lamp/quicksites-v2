// ⚠️ DORMANT — unlaunched "support campaigns" feature; `support_campaigns` has never had a row.
// Ten API routes + /posters/<slug> + app/admin/tools/print-all.tsx form the whole feature. No nav
// link, not in the sitemap. Real work stopped 2025-06; every commit since was a repo-wide types or
// build sweep, so it compiles out of diligence, not maintenance.
// KEPT DELIBERATELY (owner decision, 2026-08-17): don't prune it as dead code — and don't assume
// it works, because none of it has ever run against real data. Building on it? Ask first.
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function GET(_req: NextRequest) {
  const { data: campaigns } = await supabase
    .from('support_campaigns')
    .select('id, slug, headline, target_action, created_by, created_at');

  const results = [];

  for (const c of campaigns || []) {
    const { count } = await supabase
      .from('block_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', c.id)
      .eq('action', c.target_action);

    results.push({
      slug: c.slug,
      headline: c.headline,
      action: c.target_action,
      created_by: c.created_by,
      created_at: c.created_at,
      count,
    });
  }

  const header = 'slug,headline,action,created_by,created_at,count';
  const rows = results.map((r) =>
    [r.slug, r.headline, r.action, r.created_by, r.created_at, r.count].join(',')
  );

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="campaign-analytics.csv"',
    },
  });
}
