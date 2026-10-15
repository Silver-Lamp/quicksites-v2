// POST /api/booking/<templateId>/link/verify { code, partner_ref? } — HiveJournal, partner-signed
// over the raw body (lib/booking/partnerAuth.ts), consumes the owner's one-time code and links the
// template. 200 { template_id, site_name, tz, locale, linked_at }; 404 no_code; 410 expired;
// 409 used | already_linked. Owner sessions cannot call this: the two halves are deliberately on
// two sides, so a link always needs both an owner and the partner.
import { NextRequest, NextResponse } from 'next/server';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { verifyLinkCode } from '@/lib/booking/partnerLink';
import { loadBookingSite } from '@/lib/booking/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const raw = await req.text();
  const partnerCheck = checkBookingPartner(req, raw);
  if (partnerCheck !== 'ok') return NextResponse.json({ error: partnerCheck === 'bad_signature' ? 'bad_signature' : 'partner_required' }, { status: 403 });
  let body: any = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const code = String(body.code ?? '').trim();
  if (!/^[A-Z2-9]{5}-?[A-Z2-9]{5}$/i.test(code)) return NextResponse.json({ error: 'no_code' }, { status: 404 });
  const site = await loadBookingSite(templateId);
  if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const r = await verifyLinkCode({ templateId, code: code.replace('-', '').replace(/^(.{5})(.{5})$/, '$1-$2'), partnerRef: typeof body.partner_ref === 'string' ? body.partner_ref : null });
  if (!r.ok) {
    const status = r.error === 'no_code' ? 404 : r.error === 'expired' ? 410 : 409;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ ok: true, template_id: templateId, site_name: site.name, tz: site.settings.tz, locale: site.settings.locale, linked_at: r.link.linked_at });
}
