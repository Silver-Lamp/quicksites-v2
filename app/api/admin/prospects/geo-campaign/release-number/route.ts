// POST /api/admin/prospects/geo-campaign/release-number — give a tracking number back to Twilio
// and clear the line on the campaign. Built 2026-10-16 for paterson-auto-repair.com: an
// auto_shop_competition row with no pitch site bought a number nobody could ever dial. The
// sibling routes buy and replace; nothing could let go. Admin-only; the campaign keeps its
// forward_to_name history cleared too, because a name with no number is a stale announcement
// waiting to happen.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { releaseTrackingNumber, twilioConfigured } from '@/lib/outreach/callTracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ campaignId: z.string().uuid(), reason: z.string().max(300).optional() });

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  if (!twilioConfigured()) return NextResponse.json({ error: 'Twilio is not configured.', code: 'not_configured' }, { status: 501 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const campaign = await getGeoCampaign(parsed.data.campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  const number = campaign.tracking_number;
  const sid = (campaign as { tracking_number_sid?: string | null }).tracking_number_sid ?? null;
  if (!number) return NextResponse.json({ error: 'This campaign has no number.' }, { status: 400 });

  // Twilio first, then the row: a row cleared before the release leaves a paid number nobody can see.
  try {
    await releaseTrackingNumber(sid);
  } catch (e) {
    return NextResponse.json({ error: `Twilio refused the release: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  const { error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({ tracking_number: null, tracking_number_sid: null, forward_to: null, forward_to_name: null, updated_at: new Date().toISOString() })
    .eq('id', campaign.id);
  if (error) return NextResponse.json({ error: `released at Twilio but the row did not clear: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, released: number, domain: campaign.domain ?? null, reason: parsed.data.reason ?? null, by: gate.user.email ?? gate.user.id });
}
