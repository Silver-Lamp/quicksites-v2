// app/api/cron/ppl-outcome-survey/route.ts
//
// Hourly: for every call a business TOOK that ran at least the billable floor, once the trade's
// own delay has passed, text the business ONE "did it become a job? Y / N / NOT YET — this
// changes nothing on your bill" (lib/ppl/outcomeSurvey.ts). Claimed on the row before the send
// (a retried cron must not ask twice), STOP honoured, outcome written back. Flag-gated OFF:
// PPL_OUTCOME_SURVEY_ENABLED.
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendSms, smsConfigured } from '@/lib/sms/sendSms';
import { isOptedOut } from '@/lib/ppl/forwardNotice';
import { outcomeSurveyDecision, outcomeSurveySmsText, outcomeSurveyEnabled, OUTCOME_MAX_AGE_HOURS, type OutcomeSurveyRow } from '@/lib/ppl/outcomeSurvey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PER_RUN = 25;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('ppl-outcome-survey', async () => {
    if (!outcomeSurveyEnabled()) return NextResponse.json({ ok: true, skipped: 'disabled' });
    if (!smsConfigured()) return NextResponse.json({ ok: true, skipped: 'sms_not_configured' });
    const since = new Date(Date.now() - OUTCOME_MAX_AGE_HOURS * 3_600_000).toISOString();
    const { data: calls, error } = await supabaseAdmin
      .from('call_logs')
      .select('id, call_sid, geo_campaign_id, handling, call_status, call_duration, forwarded_to, from_number, created_at, outcome_survey_sent_at, analysis, custom_domain')
      .eq('handling', 'forward')
      .is('outcome_survey_sent_at', null)
      .gte('created_at', since)
      .not('geo_campaign_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const campaignIds = Array.from(new Set((calls ?? []).map((c: any) => c.geo_campaign_id).filter(Boolean)));
    const { data: camps } = campaignIds.length
      ? await supabaseAdmin.from('geo_industry_campaigns').select('id, domain, industry_key').in('id', campaignIds)
      : { data: [] as any[] };
    const campById = new Map((camps ?? []).map((c: any) => [c.id, c]));

    let sent = 0, waiting = 0, skipped = 0, optedOut = 0, failed = 0;
    for (const c of calls ?? []) {
      if (sent >= MAX_PER_RUN) break;
      const camp = campById.get(c.geo_campaign_id);
      const row: OutcomeSurveyRow = { ...c, read: typeof c.analysis?.read === 'string' ? c.analysis.read : null };
      const d = outcomeSurveyDecision(row, { industry: camp?.industry_key ?? null });
      if (!d.send) { if (d.reason === 'wait') waiting += 1; else skipped += 1; continue; }
      if (await isOptedOut(d.to).catch(() => false)) { optedOut += 1; continue; }
      // Claim before the send: a cron that re-runs after a timeout must not ask twice.
      const { data: claimed } = await supabaseAdmin
        .from('call_logs')
        .update({ outcome_survey_sent_at: new Date().toISOString() })
        .eq('id', c.id)
        .is('outcome_survey_sent_at', null)
        .select('id');
      if (!claimed?.length) continue;
      const body = outcomeSurveySmsText({ domain: camp?.domain ?? c.custom_domain ?? 'the site', callerPhone: c.from_number, at: c.created_at });
      const r = await sendSms(d.to, body, { reason: 'outcome_survey', campaignId: c.geo_campaign_id }).catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
      await supabaseAdmin.from('call_logs').update({ outcome_survey_result: { ok: r.ok, error: r.ok ? null : r.error ?? null, to: d.to, at: new Date().toISOString() } }).eq('id', c.id);
      if (r.ok) sent += 1; else failed += 1;
    }
    return NextResponse.json({ ok: true, sent, waiting, skipped, optedOut, failed, considered: (calls ?? []).length });
  });
}
