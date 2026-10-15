// GET /api/booking/<templateId>/menu — the site's menu grouped by its own sections, each dish
// with the icon key the delivered.menu renderer would draw, plus the icon dictionary (24×24 SVG
// on currentColor + emoji) and the site's chosen icon set. For HiveJournal's food-cost planner
// (lib/menu/menuIconFeed.ts). Owner/admin session, or HiveJournal partner-signed over
// `pathname + search` — and, as for every partner read, only for a LINKED site (demo exempt).
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { isPartnerLinked } from '@/lib/booking/partnerLink';
import { buildMenuFeed } from '@/lib/menu/menuIconFeed';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const partnerCheck = checkBookingPartner(req, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  if (partnerCheck === 'ok') {
    if (!(await isPartnerLinked(templateId))) return NextResponse.json({ error: 'not_linked' }, { status: 403 });
  } else {
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;
  }
  const { data } = await supabaseAdmin.from('templates').select('data, business_name').eq('id', templateId).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const feed = buildMenuFeed((data as { data: unknown }).data);
  return NextResponse.json({ ok: true, template_id: templateId, site_name: (data as any).business_name ?? null, ...feed });
}
