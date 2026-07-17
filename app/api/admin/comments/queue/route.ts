// app/api/admin/comments/queue/route.ts
//
// The platform moderation cockpit's data: every comment needing attention across ALL
// sites, in one admin view. Two buckets:
//   - pending: awaiting approval (approve-before-publish, or auto-hidden by reports)
//   - reported: still-approved comments that have been flagged (below the auto-hide
//     threshold) — surfaced so an operator can act before the threshold trips.
// Admin-gated (requireAdmin). Per-site owners already moderate inline in the block
// editor; this is the operator's cross-site sweep. Service-role reads (deny-default RLS).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  template_id: string;
  block_id: string;
  author_name: string;
  body: string;
  status: string;
  report_count: number | null;
  created_at: string;
  reported_at: string | null;
};

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const [{ data: pending }, { data: reported }] = await Promise.all([
    supabaseAdmin
      .from('site_comments')
      .select('id, template_id, block_id, author_name, body, status, report_count, created_at, reported_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(300),
    supabaseAdmin
      .from('site_comments')
      .select('id, template_id, block_id, author_name, body, status, report_count, created_at, reported_at')
      .eq('status', 'approved')
      .gt('report_count', 0)
      .order('reported_at', { ascending: false })
      .limit(100),
  ]);

  const rows = [...((pending ?? []) as Row[]), ...((reported ?? []) as Row[])];
  const ids = Array.from(new Set(rows.map((r) => r.template_id)));
  const nameById = new Map<string, { name: string; slug: string }>();
  if (ids.length) {
    const { data: tpls } = await supabaseAdmin
      .from('templates')
      .select('id, template_name, slug')
      .in('id', ids);
    for (const t of (tpls ?? []) as any[]) {
      nameById.set(t.id, { name: t.template_name ?? t.slug ?? t.id, slug: t.slug ?? '' });
    }
  }
  const decorate = (r: Row) => ({
    ...r,
    site: nameById.get(r.template_id)?.name ?? r.template_id,
    slug: nameById.get(r.template_id)?.slug ?? '',
  });

  return NextResponse.json({
    ok: true,
    pending: ((pending ?? []) as Row[]).map(decorate),
    reported: ((reported ?? []) as Row[]).map(decorate),
    counts: { pending: (pending ?? []).length, reported: (reported ?? []).length },
  });
}
