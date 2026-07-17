// lib/walker/gigPosts.ts
//
// Data access for gig_posts — the record of where each cataloging gig has been cross-posted
// to recruit taskers, so the operator sees which gigs are live on which channels and doesn't
// double-post. Service-role only (deny-default RLS), behind admin routes. See
// docs/AISLEASK_OPS_PLAN.md Feature B #4.

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PostChannel } from '@/lib/walker/gigPost';

export type GigPost = {
  id: string;
  gig_id: string;
  channel: PostChannel;
  posted_at: string;
  posted_by: string | null;
  url: string | null;
  note: string | null;
};

const COLS = 'id, gig_id, channel, posted_at, posted_by, url, note';

/** Record a cross-post. For assisted channels this fires when the operator confirms "posted". */
export async function recordGigPost(input: {
  gigId: string;
  channel: PostChannel;
  postedBy?: string | null;
  url?: string | null;
  note?: string | null;
}): Promise<GigPost | null> {
  const row: Record<string, unknown> = { gig_id: input.gigId, channel: input.channel };
  if (input.postedBy) row.posted_by = input.postedBy;
  if (input.url) row.url = input.url.trim().slice(0, 500);
  if (input.note) row.note = input.note.trim().slice(0, 500);
  const { data } = await supabaseAdmin.from('gig_posts').insert(row).select(COLS).maybeSingle();
  return (data as GigPost) ?? null;
}

/** All posts for a set of gigs — keyed by gig_id, for the coverage table's "posted where" column. */
export async function postsByGig(gigIds: string[]): Promise<Record<string, GigPost[]>> {
  if (!gigIds.length) return {};
  const { data } = await supabaseAdmin
    .from('gig_posts')
    .select(COLS)
    .in('gig_id', gigIds)
    .order('posted_at', { ascending: false });
  const out: Record<string, GigPost[]> = {};
  for (const p of (data as GigPost[]) ?? []) {
    (out[p.gig_id] ??= []).push(p);
  }
  return out;
}
