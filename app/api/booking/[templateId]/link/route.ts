// /api/booking/<templateId>/link — the OWNER's side of linking a booking site to HiveJournal.
//   GET  → { status, linked_at, partner_ref, unlinked_at } (owner/admin session)
//   POST → mints a one-time code (15 min, single use) and returns it ONCE with a deep link
//          (owner/admin session; a guest-build session may not share a site it has not claimed)
// The partner's half is ./verify; unlink is ./unlink. lib/booking/partnerLink.ts.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { currentLink, mintLinkCode, hjConnectUrl } from '@/lib/booking/partnerLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;
  const link = await currentLink(templateId);
  return NextResponse.json({ ok: true, status: link?.status ?? 'none', linked_at: link?.linked_at ?? null, partner_ref: link?.partner_ref ?? null, unlinked_at: link?.unlinked_at ?? null, code_expires_at: link?.status === 'pending' && !link.code_used_at ? link.code_expires_at : null });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;
  if (gate.isAnonymous) return NextResponse.json({ error: 'needs_signup' }, { status: 403 });
  const link = await currentLink(templateId);
  if (link?.status === 'linked') return NextResponse.json({ error: 'already_linked', linked_at: link.linked_at }, { status: 409 });
  const { code, expiresAt } = await mintLinkCode({ templateId, ownerId: gate.userId });
  return NextResponse.json({ ok: true, code, expires_at: expiresAt, connect_url: hjConnectUrl(templateId, code) }, { status: 201 });
}
