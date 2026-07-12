// app/api/admin/prospects/geo-campaign/mark-refined/route.ts
//
// Operator sign-off that a geo-campaign's pitch site is refined enough to mail. Admin-gated.
// Recomputes readiness fresh (the operator may have just edited the site) and refuses to
// mark ready while a HARD blocker remains. When the readiness gate is on
// (OUTREACH_READINESS_GATE_ENABLED), Mail/Text send routes require outreach_ready_at.
//   POST { campaignId, ready: true }  → sign off (409 if hard-blocked, with the blockers)
//   POST { campaignId, ready: false } → clear the sign-off
// See docs/RANKED_TARGETING_PLAN.md §5.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { analyzeReadiness } from '@/lib/outreach/readiness';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });
  const ready = body.ready !== false; // default to marking ready

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  // Fresh readiness from the current pitch-site content.
  let data: any = {};
  if (campaign.template_id) {
    const { data: t } = await supabaseAdmin.from('templates').select('data').eq('id', campaign.template_id).maybeSingle();
    data = (t as any)?.data ?? {};
  }
  const readiness = analyzeReadiness(data, campaign.industry_key);

  if (ready && readiness.hardBlocked) {
    return NextResponse.json(
      {
        error: 'Refine the site before marking it ready.',
        code: 'hard_blocked',
        blockers: readiness.blockers,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      outreach_ready_at: ready ? now : null,
      outreach_reviewed_by: ready ? operator.id : null,
      outreach_blockers: readiness.blockers,
      updated_at: now,
    })
    .eq('id', campaignId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ready, blockers: readiness.blockers });
}
