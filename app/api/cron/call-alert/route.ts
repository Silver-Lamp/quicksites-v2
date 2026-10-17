// app/api/cron/call-alert/route.ts
//
// Email the admins when a call comes in, so a real lead cannot sit unnoticed in a dashboard
// nobody opened. Every 5 minutes.
//
// ⚠️ WHY NOT THE TWILIO WEBHOOK. That handler's job is returning TwiML fast enough to connect a
// human; an email send in front of it is latency and a new failure mode on the one path that
// must not break. It also fires on `ringing`, before an outcome exists. A sweep knows how the
// call ended, and cannot delay a single ring.
//
// ⚠️ TWO GUARDS, AND BOTH ARE LOAD-BEARING:
//   1. `alerted_at IS NULL` — the dedupe lives in the row, so a deploy or an outage cannot
//      re-send the world or silently skip what arrived while it was down.
//   2. A lookback WINDOW — `alerted_at` was deliberately not backfilled, so every historical
//      row is NULL. Without the window the first run emails the entire call history.
// A settle delay sits in front of both: a call still ringing has no outcome worth reporting yet.

import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
// ⚠️ The UNTYPED service-role client on purpose. `types/supabase.ts` predates
// `call_logs.forwarded_to` (20260861) and `alerted_at` (20260870), so the typed client rejects
// both as "column does not exist" — a stale generated file, not a real schema problem
// (CLAUDE.md §8). The repo's documented answer is the untyped admin client.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { buildCallAlertEmail, alertRecipients, type CallRow } from '@/lib/ppl/callAlert';
import { analyzeAndStore, analysisReady, type CallLogForAnalysis } from '@/lib/ppl/callAnalysis';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A few model calls + PostHog queries per run; the default serverless budget is not enough.
export const maxDuration = 120;

/** Wall-clock budget for the analysis pass; anything left over waits for the next run. */
const ANALYSIS_BUDGET_MS = 70_000;
const ANALYSIS_COLS =
  'id, call_sid, from_number, call_status, call_duration, handling, custom_domain, geo_campaign_id, created_at, recording_url, voicemail_speech, voicemail_transcript, voicemail_verdict, voicemail_verdict_reason, voicemail_notify_result, missed_call_notify_result, connected_notify_result';

/** Don't report a call that may still be ringing. */
const SETTLE_SECONDS = Number(process.env.CALL_ALERT_SETTLE_SECONDS ?? '90') || 90;
/** How far back a never-alerted call is still worth an email. */
const LOOKBACK_HOURS = Number(process.env.CALL_ALERT_LOOKBACK_HOURS ?? '6') || 6;
/** A sane ceiling, so a backlog cannot produce a wall of text. */
const MAX_PER_RUN = 25;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('call-alert', async () => {
    const to = alertRecipients();
    if (to.length === 0) {
      // Not an error: an unconfigured alerter is off, and saying so beats a silent no-op.
      return NextResponse.json({ ok: true, skipped: 'ADMIN_EMAILS is not set' });
    }

    const db = supabaseAdmin;
    const now = Date.now();
    const settledBefore = new Date(now - SETTLE_SECONDS * 1000).toISOString();
    const notOlderThan = new Date(now - LOOKBACK_HOURS * 3600 * 1000).toISOString();

    // 0) Analyse every settled call that has no analysis yet (lib/ppl/callAnalysis.ts), so the
    // email below can carry the read. ⚠️ Independent of `alerted_at` on purpose: a failed
    // analysis is retried next run while the alert still goes out; and it gates NOTHING — the
    // business was texted (or not) minutes ago by the webhook's own decision.
    const analysed: { id: string; read: string; error?: string }[] = [];
    {
      const { data: todo } = await db
        .from('call_logs')
        .select(ANALYSIS_COLS)
        .is('analyzed_at', null)
        .lt('created_at', settledBefore)
        .gte('created_at', notOlderThan)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_RUN);
      const started = Date.now();
      for (const row of (todo ?? []) as CallLogForAnalysis[]) {
        if (Date.now() - started > ANALYSIS_BUDGET_MS) break;
        // ⚠️ Settled since it STARTED is not over: a 4-minute call is still ringing at 90 s. Leave
        // a call with no outcome yet for the next run (lib/ppl/callAnalysis.ts#analysisReady).
        if (!analysisReady(row, Date.now())) continue;
        try {
          const r = await analyzeAndStore(db, row);
          analysed.push({ id: row.id, read: r.read, ...(r.error ? { error: r.error } : {}) });
        } catch (e) {
          analysed.push({ id: row.id, read: 'unknown', error: e instanceof Error ? e.message.slice(0, 160) : 'error' });
        }
      }
    }

    const { data, error } = await db
      .from('call_logs')
      .select(
        'id, call_sid, from_number, to_number, forwarded_to, call_status, call_duration, handling, custom_domain, created_at, voicemail_speech, voicemail_transcript, voicemail_verdict, voicemail_verdict_reason, missed_call_notified_at, missed_call_notify_result, analysis_summary, analysis',
      )
      .is('alerted_at', null)
      .lt('created_at', settledBefore)
      .gte('created_at', notOlderThan)
      .order('created_at', { ascending: false })
      .limit(MAX_PER_RUN);
    if (error) throw new Error(`call_logs read failed: ${error.message}`);

    const rows = (data ?? []) as CallRow[];
    if (rows.length === 0) return NextResponse.json({ ok: true, alerted: 0, analysed });

    // `text` is built too, but sendEmail takes only html — it is returned below so a cron_runs
    // record shows what went out without digging through the provider.
    const { subject, html, text } = buildCallAlertEmail(rows, publicBaseUrl());
    await sendEmail({ to: to.join(','), subject, html });

    // ⚠️ Marked only AFTER the send resolves. Marking first would turn one transient Resend
    // failure into a lead nobody ever hears about — the exact outcome this cron exists to stop.
    const { error: markErr } = await db
      .from('call_logs')
      .update({ alerted_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    if (markErr) throw new Error(`alerted_at write failed after sending: ${markErr.message}`);

    return NextResponse.json({
      ok: true,
      alerted: rows.length,
      analysed,
      to: to.length,
      subject,
      preview: text.slice(0, 500),
    });
  });
}

export const GET = handle;
export const POST = handle;
