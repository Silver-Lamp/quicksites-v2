// app/api/comments/route.ts
//
// The comments block's public API. GET returns APPROVED comments for a block; POST
// submits a new comment. Anti-abuse is layered and structural:
//   1. per-IP rate limit (rateLimitOr429)
//   2. plain-text only (toPlainText strips all markup — no injection)
//   3. prohibited-content screen (lib/safety/prohibitedContent) — illegal content refused
//   4. link-spam guard (strip URLs/emails unless the block allows links)
//   5. moderation state: unless the block turns moderation off, comments land 'pending'
//      and NEVER render publicly until the owner approves (approve-before-publish)
//   6. recipient (owner notification) + all settings read SERVER-SIDE from the stored
//      block — never trusted from the client (no open relay).
// Deny-default RLS on site_comments → all access is via the service-role admin client here.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { clientIp } from '@/lib/rateLimit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { screenListing } from '@/lib/safety/prohibitedContent';
import { toPlainText, containsLinks, stripLinks } from '@/lib/comments/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function findCommentsBlock(data: any, blockId: string): any | null {
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    for (const b of blocks) {
      if (b?.type === 'comments' && (b?._id === blockId || b?.id === blockId)) return b;
    }
  }
  return null;
}

/** GET ?templateId=&blockId= → approved comments (public read). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get('templateId') || '';
  const blockId = url.searchParams.get('blockId') || '';
  if (!templateId || !blockId) return NextResponse.json({ error: 'Missing block reference.' }, { status: 400 });

  const { data } = await supabaseAdmin
    .from('site_comments')
    .select('id, author_name, body, created_at')
    .eq('template_id', templateId)
    .eq('block_id', blockId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(200);
  return NextResponse.json({ ok: true, comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'comment-post', 6, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  // Honeypot: a hidden field real users never see. A filled `website` = a bot →
  // pretend success (don't tip the bot off) and drop silently.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true, status: 'pending' });
  }

  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  const blockId = typeof body.blockId === 'string' ? body.blockId : '';
  const author = toPlainText(typeof body.author === 'string' ? body.author : '', 80);
  let text = toPlainText(typeof body.body === 'string' ? body.body : '', 2000);

  if (!templateId || !blockId) return NextResponse.json({ error: 'Missing block reference.' }, { status: 400 });
  if (!author || text.length < 2) return NextResponse.json({ error: 'Add your name and a comment.' }, { status: 400 });

  // All settings come from the STORED block (never the client).
  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const block = findCommentsBlock((t as any).data, blockId);
  if (!block) return NextResponse.json({ error: 'Comments are not enabled here.' }, { status: 404 });
  const c: any = block.content ?? {};
  if (c.closed === true) return NextResponse.json({ error: 'This thread is closed.' }, { status: 403 });

  // Prohibited content → refuse outright (never store, never notify).
  const screen = screenListing({ title: author, description: text });
  if (!screen.ok && screen.severity === 'block') {
    return NextResponse.json({ error: 'That comment can’t be posted.', code: 'prohibited_content' }, { status: 422 });
  }
  // Link-spam guard: strip links unless the block explicitly allows them.
  if (c.allow_links !== true && containsLinks(text)) text = stripLinks(text);
  if (text.length < 2) return NextResponse.json({ error: 'Add a comment (links aren’t allowed here).' }, { status: 400 });

  // Duplicate-flood guard: the same body on the same block within the last hour is
  // spam (or a double-submit) — drop silently rather than store a dupe.
  const sinceIso = new Date(Date.now() - 3600_000).toISOString();
  const { data: dupe } = await supabaseAdmin
    .from('site_comments')
    .select('id')
    .eq('template_id', templateId)
    .eq('block_id', blockId)
    .eq('body', text)
    .gte('created_at', sinceIso)
    .limit(1)
    .maybeSingle();
  if (dupe) return NextResponse.json({ ok: true, status: 'pending' });

  // Approve-before-publish is the default; only an explicit moderation:false auto-approves.
  const moderationOn = c.moderation !== false;
  const status = moderationOn ? 'pending' : 'approved';

  const { data: inserted, error } = await supabaseAdmin
    .from('site_comments')
    .insert({
      template_id: templateId,
      block_id: blockId,
      author_name: author,
      body: text,
      status,
      created_ip: clientIp(req),
    })
    .select('id')
    .single();
  if (error || !inserted) return NextResponse.json({ error: 'Could not post the comment.' }, { status: 500 });

  // Notify the owner (recipient from the stored block; best-effort, never blocks).
  const notify = typeof c.notify_email === 'string' && EMAIL_RX.test(c.notify_email.trim()) ? c.notify_email.trim() : '';
  if (notify) {
    const base = (process.env.APP_BASE_URL || 'https://quicksites.ai').replace(/\/+$/, '');
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    void sendEmail({
      to: notify,
      subject: moderationOn ? `New comment awaiting approval — ${(t as any).template_name ?? (t as any).slug}` : `New comment on your site`,
      html: [
        `<p><b>${esc(author)}</b> commented:</p><blockquote>${esc(text)}</blockquote>`,
        moderationOn
          ? `<p>It’s pending your approval — <a href="${base}/admin/templates/${templateId}">open the editor</a> to approve or reject.</p>`
          : `<p>It’s live on your site.</p>`,
      ].join('\n'),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status });
}
