// app/api/admin/prospects/geo-campaign/set-forward/route.ts
//
// Point an existing campaign's tracking number at a DIFFERENT business (docs/PPL_VERTICAL.md §9).
//
// The sibling routes all change a NUMBER and take the forward-to along for the ride;
// this one changes only the destination, which is the thing that actually goes wrong. Found
// needed on 2026-09-30, when covingtontow.com rang out on two real leads at a business that had
// been notified two days earlier and had not replied STOP — it simply does not pick up.
//
// ⚠️ THE NOTICE IS NOT OPTIONAL HERE IN THE WAY IT IS ON `attach-number`. There, `sendNotice:
// false` covers a business that agreed in person. Here the whole operation is "start ringing
// someone new", so a silent re-point is the one outcome the flag must not produce by accident:
// the route refuses when SMS is unconfigured rather than repointing and reporting a warning.
// A business finding out it is receiving a stranger's towing calls by receiving one is exactly
// what the notice exists to prevent.
//
// ⚠️ MARKING THE OLD DESTINATION IS A SEPARATE, EXPLICIT FLAG. Re-pointing does not imply the
// previous business is bad — the operator may simply have found a better fit — and writing them
// onto the unresponsive list as a side effect would be a judgement nobody asked for.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { setCampaignForwardTo } from '@/lib/outreach/geoCampaigns';
import { sendForwardNotice, isOptedOut } from '@/lib/ppl/forwardNotice';
import { smsConfigured } from '@/lib/sms/sendSms';
import {
  markUnresponsive,
  clearUnresponsive,
  loadCampaignForwardHealth,
} from '@/lib/ppl/forwardHealth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  campaignId: z.string().uuid().optional(),
  domain: z.string().min(3).optional(),
  forwardTo: z.string().regex(/^\+[1-9]\d{7,14}$/, 'E.164 phone'),
  /** Record that the destination being replaced does not answer. Default false. */
  markPreviousUnresponsive: z.boolean().optional(),
  /** Why, in the operator's words — stored on the unresponsive row. */
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;

  let campaignId = b.campaignId ?? null;
  if (!campaignId && b.domain) {
    const { data } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('id')
      .eq('domain', b.domain)
      .maybeSingle();
    campaignId = (data as { id: string } | null)?.id ?? null;
  }
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId or a known domain is required' }, { status: 400 });
  }

  // Refuse before writing, not after. A repoint that cannot notify is the failure mode.
  if (!smsConfigured()) {
    return NextResponse.json(
      {
        error:
          'SMS is not configured in this environment, so the new business cannot be notified. ' +
          'Not repointing — calls would start arriving unannounced.',
        code: 'sms_not_configured',
      },
      { status: 503 },
    );
  }

  // The destination's own STOP outranks anything an operator picks in the UI.
  if (await isOptedOut(b.forwardTo)) {
    return NextResponse.json(
      { error: `${b.forwardTo} has opted out of forwarded calls.`, code: 'opted_out' },
      { status: 409 },
    );
  }

  // Gather the old destination's record BEFORE the write, while `forwarded_to` on the call rows
  // still lines up with the campaign — after the repoint the campaign no longer names it.
  const previousHealth = b.markPreviousUnresponsive
    ? (await loadCampaignForwardHealth({ sinceDays: 90 })).rows.filter((r) => r.campaignId === campaignId)
    : [];

  const { from, to } = await setCampaignForwardTo(campaignId, b.forwardTo);

  // Repointing TO a number previously written off is a deliberate second chance; record it as
  // one rather than leaving a stale row that would disqualify it from every future suggestion.
  await clearUnresponsive(to, 'repointed to this destination by an operator').catch(() => {});

  let previous:
    | { phone: string; marked: boolean; unanswered: number | null; connected: number | null }
    | null = null;
  if (b.markPreviousUnresponsive && from) {
    // ⚠️ `?? null`, NOT `?? 0`. When no call row could be attributed to this destination the
    // honest record is "unknown", and the operator's note carries the evidence instead. The
    // first real re-point filed AL Ram Towing as `0 unanswered` on a morning it missed two
    // leads, purely because those rows predate `call_logs.forwarded_to` — a zero that reads as
    // "we checked and found nothing" beside a note saying the opposite. See 20260862.
    const h = previousHealth.find((r) => r.phone === from) ?? null;
    await markUnresponsive(from, {
      unanswered: h ? h.unanswered : null,
      connected: h ? h.connected : null,
      source: 'operator',
      note: b.note ?? null,
    });
    previous = {
      phone: from,
      marked: true,
      unanswered: h ? h.unanswered : null,
      connected: h ? h.connected : null,
    };
  } else if (from) {
    previous = { phone: from, marked: false, unanswered: null, connected: null };
  }

  const notice = await sendForwardNotice(campaignId);

  // ⚠️ REPORTED, NOT BLOCKED. One operator legitimately covers two towns, so two of our domains
  // ringing one phone is a judgement call — but it is also something a caller can notice, and
  // the re-point box can suggest the same business to several campaigns at once (they are
  // hypotheticals until pressed, so deconfliction deliberately leaves them alone). Saying it
  // out loud after the fact costs nothing; refusing would strand a market with one real business.
  const { data: shared } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('domain')
    .eq('forward_to', to)
    .neq('id', campaignId);
  const alsoForwardsFor = (shared ?? []).map((r) => (r as { domain: string }).domain);

  return NextResponse.json({ ok: true, campaignId, from, to, previous, notice, alsoForwardsFor });
}
