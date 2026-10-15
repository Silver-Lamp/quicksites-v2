// POST /api/booking/<templateId>/menu/icons { names: [{ name, tags?, prefer? }] } — the icon the
// delivered.menu set would draw for arbitrary names (a food-cost planner's ingredients: "Guanciale",
// "Pecorino", "Strawberry Juice"), defaulting to the INGREDIENT reading. No match → null, and the
// planner draws nothing. Same gates as the menu read: owner session, or HiveJournal partner-signed
// over the raw body on a linked site. lib/menu/menuIconFeed.ts.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { isPartnerLinked } from '@/lib/booking/partnerLink';
import { iconsForNames, type NameQuery } from '@/lib/menu/menuIconFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const raw = await req.text();
  const partnerCheck = checkBookingPartner(req, raw);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  if (partnerCheck === 'ok') {
    if (!(await isPartnerLinked(templateId))) return NextResponse.json({ error: 'not_linked' }, { status: 403 });
  } else {
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;
  }
  let body: any = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const names: NameQuery[] = Array.isArray(body.names)
    ? body.names.map((n: any) => (typeof n === 'string' ? { name: n } : { name: String(n?.name ?? ''), tags: Array.isArray(n?.tags) ? n.tags.map(String) : undefined, prefer: n?.prefer === 'dish' ? 'dish' : 'ingredient' }))
    : [];
  if (!names.length) return NextResponse.json({ error: 'names_required' }, { status: 400 });
  return NextResponse.json({ ok: true, ...iconsForNames(names) });
}
