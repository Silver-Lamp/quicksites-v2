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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return Response.json({ error: 'Missing slug' }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !campaign) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { count } = await supabase
    .from('block_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', campaign.block_id)
    .eq('action', campaign.target_action);

  return Response.json({ ...campaign, count: count || 0 });
}
