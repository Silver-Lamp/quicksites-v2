// app/api/comments/moderate/route.ts
//
// Owner/admin comment moderation for a comments block. requireTemplateOwner-gated
// (only the site owner or a platform admin). GET lists PENDING comments for a block
// (so the editor can show them); POST approves/rejects one. Service-role writes
// (deny-default RLS on site_comments).
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?templateId=&blockId= → pending comments (owner-gated). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get('templateId') || '';
  const blockId = url.searchParams.get('blockId') || '';
  if (!templateId) return NextResponse.json({ error: 'templateId required.' }, { status: 400 });
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  let q = supabaseAdmin
    .from('site_comments')
    .select('id, block_id, author_name, body, created_at, report_count')
    .eq('template_id', templateId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200);
  if (blockId) q = q.eq('block_id', blockId);
  const { data } = await q;
  return NextResponse.json({ ok: true, pending: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  const commentId = typeof body.commentId === 'string' ? body.commentId : '';
  const action = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : '';
  if (!templateId || !commentId || !action) {
    return NextResponse.json({ error: 'templateId, commentId, action(approve|reject) required.' }, { status: 400 });
  }
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  // Scope the update to this template so an owner can only moderate their own comments.
  // Approving also DISMISSES any accumulated reports (clears report_count/reported_at)
  // so a re-approved comment doesn't linger in the "reported" queue.
  const { error } = await supabaseAdmin
    .from('site_comments')
    .update({
      status: action,
      moderated_by: gate.userId,
      moderated_at: new Date().toISOString(),
      ...(action === 'approved' ? { report_count: 0, reported_at: null } : {}),
    })
    .eq('id', commentId)
    .eq('template_id', templateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: action });
}
