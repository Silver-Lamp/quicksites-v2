// app/api/jobs/apply/route.ts
//
// Apply/submit to a job_listing gig (crosstalk ideas.md §10 odd-jobs board;
// contract: crosstalk/contracts/aisleask-catalog-gig.md). v0 = no payments; this is
// the apply + submit rail. SECURITY: the recipient + submit_url are read from the
// STORED block server-side (never trusted from the client) — same hardened posture as
// the contact relay, so this can't be an open relay. Public + per-IP rate-limited.
//
// For an AisleAsk cataloging gig (deliverable='ordered_sections') the walker's
// deliverable is an ordered list of section names; if the gig carries a submit_url
// (HJ's catalog-token endpoint) we best-effort POST { sections } there for auto-ingest,
// AND always deliver the application to the poster's recipient_email.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function findJobBlock(data: any, blockId: string): any | null {
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    for (const b of blocks) {
      if (b?.type === 'job_listing' && (b?._id === blockId || b?.id === blockId)) return b;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'job-apply', 8, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  const blockId = typeof body.blockId === 'string' ? body.blockId : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 160) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
  const sections = Array.isArray(body.sections)
    ? body.sections.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 80)
    : [];

  if (!templateId || !blockId) return NextResponse.json({ error: 'Missing gig reference.' }, { status: 400 });
  if (!name || !contact) return NextResponse.json({ error: 'Add your name and how to reach you.' }, { status: 400 });

  // Recipient + submit target come from the STORED block, never the client.
  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: 'Gig not found.' }, { status: 404 });
  const block = findJobBlock((t as any).data, blockId);
  if (!block) return NextResponse.json({ error: 'Gig not found.' }, { status: 404 });

  const c: any = block.content ?? {};
  const recipient = typeof c.recipient_email === 'string' && EMAIL_RX.test(c.recipient_email.trim())
    ? c.recipient_email.trim()
    : '';
  const submitUrl = typeof c.submit_url === 'string' ? c.submit_url.trim() : '';
  const deliverable = c.deliverable === 'ordered_sections' ? 'ordered_sections' : 'message';
  const gigTitle = c.store_name || c.title || 'Gig';

  // 1) Structured auto-ingest for cataloging gigs (best-effort; never fails the apply).
  let forwarded = false;
  if (deliverable === 'ordered_sections' && sections.length && /^https:\/\//i.test(submitUrl)) {
    try {
      const r = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      forwarded = r.ok;
    } catch {
      forwarded = false;
    }
  }

  // 2) Always deliver the application to the poster (the human/ops recipient).
  let emailed = false;
  if (recipient) {
    const lines = [
      `<p>New application for <b>${esc(gigTitle)}</b> (${esc((t as any).template_name ?? (t as any).slug ?? '')}):</p>`,
      `<p><b>${esc(name)}</b> · ${esc(contact)}</p>`,
      note ? `<p>${esc(note)}</p>` : '',
      deliverable === 'ordered_sections' && sections.length
        ? `<p>Submitted walk order (${sections.length} sections):</p><ol>${sections.map((s: string) => `<li>${esc(s)}</li>`).join('')}</ol>`
        : '',
      forwarded ? `<p><i>Auto-ingested to the catalog endpoint ✓</i></p>` : '',
    ].filter(Boolean);
    try {
      await sendEmail({ to: recipient, subject: `Gig application: ${gigTitle}`, html: lines.join('\n') });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  if (!emailed && !forwarded) {
    // Nothing reached the poster — tell the applicant honestly rather than pretending.
    return NextResponse.json({ error: 'This gig isn’t accepting applications right now.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, forwarded });
}
