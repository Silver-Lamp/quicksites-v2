// app/api/comments/report/route.ts
//
// Community moderation: a visitor reports an APPROVED comment as abusive. Reports
// accumulate on the comment; at REPORT_THRESHOLD the comment auto-hides back to
// 'pending' for owner re-review (a THRESHOLD, not a single report — so one actor can't
// censor a comment they dislike) and the owner is notified. Public + per-IP
// rate-limited; deny-default RLS → service-role writes only. No PII, no content in the
// request (just the comment id).
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPORT_THRESHOLD = 3;
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function findCommentsBlock(data: any, blockId: string): any | null {
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    for (const b of blocks) if (b?.type === 'comments' && (b?._id === blockId || b?.id === blockId)) return b;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'comment-report', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const commentId = typeof body.commentId === 'string' ? body.commentId : '';
  if (!commentId) return NextResponse.json({ error: 'commentId required.' }, { status: 400 });

  // Only an APPROVED comment can be reported (can't report what isn't public).
  const { data: cm } = await supabaseAdmin
    .from('site_comments')
    .select('id, template_id, block_id, status, report_count')
    .eq('id', commentId)
    .eq('status', 'approved')
    .maybeSingle();
  if (!cm) return NextResponse.json({ ok: true }); // opaque: don't reveal existence/status

  const next = Number((cm as any).report_count || 0) + 1;
  const hide = next >= REPORT_THRESHOLD;
  await supabaseAdmin
    .from('site_comments')
    .update({
      report_count: next,
      reported_at: new Date().toISOString(),
      ...(hide ? { status: 'pending' } : {}), // auto-hide at threshold for re-review
    })
    .eq('id', commentId)
    .eq('status', 'approved');

  // Notify the owner (recipient from the stored block, server-side). On first report
  // and again when it auto-hides.
  if (next === 1 || hide) {
    const { data: t } = await supabaseAdmin
      .from('templates')
      .select('id, slug, template_name, data')
      .eq('id', (cm as any).template_id)
      .maybeSingle();
    const block = t ? findCommentsBlock((t as any).data, (cm as any).block_id) : null;
    const notify = block?.content?.notify_email;
    if (typeof notify === 'string' && EMAIL_RX.test(notify.trim())) {
      const base = (process.env.APP_BASE_URL || 'https://quicksites.ai').replace(/\/+$/, '');
      void sendEmail({
        to: notify.trim(),
        subject: hide ? 'A comment was hidden after multiple reports' : 'A comment on your site was reported',
        html: [
          `<p>A comment on <b>${(t as any)?.template_name ?? (t as any)?.slug ?? 'your site'}</b> was reported (${next}×).</p>`,
          hide
            ? `<p>It’s been hidden pending your review — <a href="${base}/admin/templates/${(cm as any).template_id}">open the editor</a> to approve or reject it.</p>`
            : `<p><a href="${base}/admin/templates/${(cm as any).template_id}">Review it in the editor.</a></p>`,
        ].join('\n'),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, hidden: hide });
}
