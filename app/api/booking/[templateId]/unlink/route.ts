// POST /api/booking/<templateId>/unlink { reason? } — either side ends the link: the owner
// (session) or HiveJournal (partner-signed over the raw body). The partner routes answer 403
// `not_linked` from the next call. The row stays, with who and why (lib/booking/partnerLink.ts).
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { unlinkTemplate } from '@/lib/booking/partnerLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const raw = await req.text();
  const partnerCheck = checkBookingPartner(req, raw);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  let by: 'owner' | 'partner' = 'partner';
  if (partnerCheck !== 'ok') {
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;
    by = 'owner';
  }
  let body: any = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    body = {};
  }
  const ok = await unlinkTemplate({ templateId, by, reason: typeof body.reason === 'string' ? body.reason : null });
  return NextResponse.json({ ok, by }, { status: ok ? 200 : 404 });
}
