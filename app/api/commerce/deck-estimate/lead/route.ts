// app/api/commerce/deck-estimate/lead/route.ts
//
// The SEPARATE lead-capture step for the deck_estimate block
// (crosstalk/contracts/deck-estimate-embed.md → "Lead ownership"). The homeowner's
// name/email/phone belongs to the BUILDER (QS's customer), so it never touches the
// DeckSketch endpoint — it fires QuickSites' hardened submission rail to the site
// owner. SECURITY: the recipient email is read from the STORED block server-side
// (never trusted from the client) — same open-relay-proof posture as /api/jobs/apply.
// Public + per-IP rate-limited + content-screened.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { screenListing } from '@/lib/safety/prohibitedContent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function findDeckBlock(data: any, blockId: string): any | null {
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks: any[] = Array.isArray(p?.blocks) ? p.blocks : Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    for (const b of blocks) {
      if (b?.type === 'deck_estimate' && (b?._id === blockId || b?.id === blockId)) return b;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'deck-estimate-lead', 8, 3600);
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
  // The estimate the homeowner is asking a real quote for (display only — recomputed by the builder).
  const estimateLabel = typeof body.estimateLabel === 'string' ? body.estimateLabel.trim().slice(0, 200) : '';
  const specs = typeof body.specs === 'string' ? body.specs.trim().slice(0, 400) : '';

  if (!templateId || !blockId) return NextResponse.json({ error: 'Missing reference.' }, { status: 400 });
  if (!name || !contact) return NextResponse.json({ error: 'Add your name and how to reach you.' }, { status: 400 });

  // Recipient comes from the STORED block, never the client (no open relay).
  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
  const block = findDeckBlock((t as any).data, blockId);
  if (!block) return NextResponse.json({ error: 'Estimate widget not found.' }, { status: 404 });

  const c: any = block.content ?? {};

  // Defense in depth: screen the homeowner's free-text note.
  const screen = screenListing({ title: 'deck estimate request', description: note });
  if (!screen.ok && screen.severity === 'block') {
    return NextResponse.json({ error: 'Message could not be sent.', code: 'prohibited_content' }, { status: 422 });
  }

  const recipient =
    typeof c.recipient_email === 'string' && EMAIL_RX.test(c.recipient_email.trim())
      ? c.recipient_email.trim()
      : '';
  if (!recipient) {
    // No configured recipient — accept the lead so the UI still confirms, but nothing to send.
    return NextResponse.json({ ok: true, delivered: false });
  }

  const siteName = (t as any).template_name ?? (t as any).slug ?? '';
  const lines = [
    `<p>New deck-estimate lead from <b>${esc(siteName)}</b>:</p>`,
    `<p><b>${esc(name)}</b> · ${esc(contact)}</p>`,
    estimateLabel ? `<p>Ballpark shown: <b>${esc(estimateLabel)}</b></p>` : '',
    specs ? `<p>Details: ${esc(specs)}</p>` : '',
    note ? `<p>${esc(note)}</p>` : '',
    `<p style="color:#888;font-size:12px">Ballpark from the on-site estimator (materials only) — confirm the real quote yourself.</p>`,
  ].filter(Boolean);

  let delivered = false;
  try {
    await sendEmail({ to: recipient, subject: `Deck estimate request — ${name}`, html: lines.join('\n') });
    delivered = true;
  } catch {
    delivered = false;
  }

  return NextResponse.json({ ok: true, delivered });
}
