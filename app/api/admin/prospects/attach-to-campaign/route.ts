// app/api/admin/prospects/attach-to-campaign/route.ts
// Attach swept prospects to a geo campaign — the step between "I swept a city" and "I can mail
// someone" (admin-gated).
//   POST -> { campaignId, prospectIds, reassign? } -> { ok, attached, alreadyHere, offCity }
//
// Building a site for a prospect does not attach it to a campaign; only the launch flow did, and a
// domain adopted via "make rentable" starts with no cohort at all. Without this, mail-postcards
// finds zero recipients while the workspace shows a screenful of businesses.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getGeoCampaign, linkProspectsToCampaign } from '@/lib/outreach/geoCampaigns';
import { planAttachment } from '@/lib/outreach/attachProspects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const campaignId = String(body.campaignId ?? '');
  const prospectIds: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.map(String).filter(Boolean) : [];
  const reassign = body.reassign === true;
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });
  if (!prospectIds.length) return NextResponse.json({ error: 'Select at least one prospect.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  const { data: rows, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, address, city, geo_campaign_id')
    .in('id', prospectIds);
  if (error) return NextResponse.json({ error: `Could not load prospects: ${error.message}` }, { status: 500 });

  const plan = planAttachment((rows ?? []) as any[], { id: campaign.id, city: campaign.city });

  // ⚠️ Moving a prospect off another city's campaign takes a recipient away from that campaign.
  // Never silent — the operator has to ask for it, and is told whose cohort it comes from.
  if (plan.elsewhere.length && !reassign) {
    return NextResponse.json(
      {
        error:
          `${plan.elsewhere.length} of these already belong to another campaign. Attaching them here ` +
          `removes them from that one.`,
        code: 'would_reassign',
        names: plan.elsewhere.map((p) => p.business_name).filter(Boolean).slice(0, 10),
        hint: 'Send reassign:true to move them anyway.',
      },
      { status: 409 },
    );
  }

  const toAttach = [...plan.free, ...(reassign ? plan.elsewhere : [])].map((p) => p.id);
  if (toAttach.length) await linkProspectsToCampaign(campaign.id, toAttach);

  return NextResponse.json({
    ok: true,
    attached: toAttach.length,
    alreadyHere: plan.alreadyHere.length,
    reassigned: reassign ? plan.elsewhere.length : 0,
    // Advisory: an exact-match geo domain is worth nothing to a business in another town.
    offCity: plan.offCity.map((p) => ({ name: p.business_name, address: p.address })),
    campaign: { id: campaign.id, domain: campaign.domain, city: campaign.city },
  });
}
