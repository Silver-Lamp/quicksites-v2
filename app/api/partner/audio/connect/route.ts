// app/api/partner/audio/connect/route.ts
//
// Owner-facing "Connect QuickSites" backend for HiveJournal audio provisioning
// (contract: partner-provisioning.md). The owner mints a grant token in their HJ
// dashboard and hands it to us here; we store it encrypted, keyed to their QS user (and
// optionally a specific site). GET lists their active connections; DELETE revokes one.
//
// Owner-gated (real users only — no anon). Flag-gated: 503 until provisioning is enabled.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { partnerAudioEnabled } from '@/lib/partners/audioProvisioning/config';
import { storeGrant, listGrantsForUser, revokeGrant } from '@/lib/partners/audioProvisioning/grants';
import type { BillingMode } from '@/lib/partners/audioProvisioning/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<Response> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  if (!partnerAudioEnabled()) {
    return NextResponse.json({ error: 'audio provisioning not enabled', code: 'disabled' }, { status: 503 });
  }

  let body: { hjEmbedId?: string; token?: string; templateId?: string | null; billingMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const hjEmbedId = String(body.hjEmbedId ?? '').trim();
  const token = String(body.token ?? '').trim();
  const templateId = body.templateId ? String(body.templateId).trim() : null;
  const billingMode: BillingMode = body.billingMode === 'partner' ? 'partner' : 'owner';

  if (!UUID_RX.test(hjEmbedId)) return NextResponse.json({ error: 'hjEmbedId must be a uuid' }, { status: 400 });
  if (token.length < 8) return NextResponse.json({ error: 'token missing' }, { status: 400 });

  // If a site is named, the caller must own it (platform admins pass too).
  if (templateId) {
    const owner = await requireTemplateOwner(templateId);
    if (!owner.ok) return owner.response;
  }

  try {
    const grant = await storeGrant({ userId: gate.user.id, hjEmbedId, token, templateId, billingMode });
    return NextResponse.json({
      ok: true,
      grant: { id: grant.id, hjEmbedId: grant.hjEmbedId, templateId: grant.templateId, billingMode: grant.billingMode },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const grants = await listGrantsForUser(gate.user.id);
  // Never returns tokens — metadata only.
  return NextResponse.json({
    grants: grants.map((g) => ({ id: g.id, hjEmbedId: g.hjEmbedId, templateId: g.templateId, billingMode: g.billingMode })),
  });
}

export async function DELETE(req: Request): Promise<Response> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const url = new URL(req.url);
  const hjEmbedId = String(url.searchParams.get('hjEmbedId') ?? '').trim();
  if (!UUID_RX.test(hjEmbedId)) return NextResponse.json({ error: 'hjEmbedId must be a uuid' }, { status: 400 });
  await revokeGrant(gate.user.id, hjEmbedId);
  return NextResponse.json({ ok: true });
}
