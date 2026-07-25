// app/api/partner/audio/attach/route.ts
//
// Put a connected HiveJournal embed onto one of the caller's sites — the last mile of audio
// provisioning (contract: partner-provisioning.md). Points the site's `about_that` player at
// the embed, inserting the block if the site doesn't have one yet, so the owner never copies
// a uuid into the editor by hand.
//
// Doubly authorized: the caller must own the ACTIVE GRANT for the embed (authorized against
// the stored grant's user_id, never the client's claim) AND own the target template. Not
// flag-gated: this writes only our own template JSON and makes no HJ call, so it stays useful
// for a site whose grant was stored before provisioning was switched on.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { getActiveGrant } from '@/lib/partners/audioProvisioning/grants';
import { attachEmbedToSite } from '@/lib/partners/audioProvisioning/attachEmbedToSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<Response> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  let body: { hjEmbedId?: string; templateId?: string; insertIfMissing?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const hjEmbedId = String(body.hjEmbedId ?? '').trim();
  const templateId = String(body.templateId ?? '').trim();
  if (!UUID_RX.test(hjEmbedId)) return NextResponse.json({ error: 'hjEmbedId must be a uuid' }, { status: 400 });
  if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

  const grant = await getActiveGrant(hjEmbedId);
  if (!grant) {
    return NextResponse.json({ error: 'no active connection for this embed', code: 'no_grant' }, { status: 409 });
  }
  if (grant.userId !== gate.user.id) {
    return NextResponse.json({ error: 'forbidden', code: 'not_owner' }, { status: 403 });
  }

  const owner = await requireTemplateOwner(templateId);
  if (!owner.ok) return owner.response;

  const res = await attachEmbedToSite({
    templateId,
    hjEmbedId,
    actorId: gate.user.id,
    // The owner asked for the player explicitly by calling this route, so creating the block
    // is the expected outcome rather than a surprise edit.
    insertIfMissing: body.insertIfMissing !== false,
  });

  if (!res.ok) {
    const status = res.reason === 'no_template' ? 404 : 500;
    return NextResponse.json({ error: res.error || res.reason || 'attach failed' }, { status });
  }

  return NextResponse.json({ ok: true, changed: res.changed, action: res.action });
}
