// app/api/cron/site-created-alert/route.ts
//
// Every 15 minutes: for each site a USER created ~30+ minutes ago that the owner has not been
// told about, analyse where they left off and email it (owner, 2026-10-05).
//
// ⚠️ A SETTLE DELAY, ON PURPOSE. At creation there is nothing to say; thirty minutes later the
// saves, the AI calls and the sign-up events have either happened or not, and that is the email.
// ⚠️ OUR OWN TRAFFIC IS RECORDED, NOT EMAILED. The operator's accounts, the owner's +alias test
// accounts and the demo recorder's guest builds all land in `templates` looking like strangers;
// they get a `site_creation_alerts` row with a skipped_reason so the admin page can show them and
// the owner is never emailed about himself.
// ⚠️ THE MARK IS WRITTEN AFTER THE SEND RESOLVES (call-alert's rule): marking first turns one
// transient Resend failure into a site nobody hears about.
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { alertRecipients } from '@/lib/ppl/callAlert';
import { collectSiteProgress } from '@/lib/sites/siteProgressServer';
import { buildSiteCreatedEmail } from '@/lib/notifications/siteCreatedEmail';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Minutes after creation before a site is worth describing. */
const SETTLE_MINUTES = Number(process.env.SITE_ALERT_SETTLE_MINUTES ?? '30') || 30;
/** A never-alerted site older than this is history, not news. */
const LOOKBACK_HOURS = Number(process.env.SITE_ALERT_LOOKBACK_HOURS ?? '48') || 48;
const MAX_PER_RUN = 10;

/**
 * Sources that are OUR pipelines, not a person making a site. The fleet's vocabulary on
 * 2026-10-05: null (editor) 2480 · listing_import 634 · guest_build 76 · demo_seed 21 ·
 * directory 19 · resume_import 8 · ai_rebuild 8 · operator_draft 6 · persona_build 2.
 * guest_build / resume_import / ai_rebuild / null are people; the rest are us.
 */
const MACHINE_SOURCES = new Set(['listing_import', 'demo_seed', 'directory', 'operator_draft', 'persona_build']);

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('site-created-alert', async () => {
    const to = alertRecipients();
    if (to.length === 0) return NextResponse.json({ ok: true, skipped: 'ADMIN_EMAILS is not set' });

    const db = supabaseAdmin as any;
    const now = Date.now();
    const settledBefore = new Date(now - SETTLE_MINUTES * 60_000).toISOString();
    const notOlderThan = new Date(now - LOOKBACK_HOURS * 3_600_000).toISOString();

    const { data: candidates, error } = await db
      .from('templates')
      .select('id, owner_id, claim_source, created_at')
      .gte('created_at', notOlderThan)
      .lt('created_at', settledBefore)
      .not('owner_id', 'is', null)
      .eq('archived', false)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw new Error(`templates read failed: ${error.message}`);

    const ids = (candidates ?? []).map((c: any) => c.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, alerted: 0, skipped: 0 });
    const { data: done } = await db.from('site_creation_alerts').select('template_id').in('template_id', ids);
    const doneIds = new Set((done ?? []).map((d: any) => d.template_id));

    const todo = (candidates ?? [])
      .filter((c: any) => !doneIds.has(c.id) && !MACHINE_SOURCES.has(c.claim_source ?? ''))
      .slice(0, MAX_PER_RUN);

    let alerted = 0;
    let skipped = 0;
    const sent: string[] = [];
    for (const c of todo) {
      const report = await collectSiteProgress(c.id);
      if (!report) continue;
      if (report.testTraffic) {
        await db.from('site_creation_alerts').insert({ template_id: c.id, owner_id: c.owner_id, skipped_reason: report.testTraffic, progress: report.progress });
        skipped += 1;
        continue;
      }
      const { subject, html } = buildSiteCreatedEmail(report, publicBaseUrl());
      await sendEmail({ to: to.join(','), subject, html });
      const { error: markErr } = await db
        .from('site_creation_alerts')
        .insert({ template_id: c.id, owner_id: c.owner_id, alerted_at: new Date().toISOString(), progress: report.progress });
      if (markErr) throw new Error(`site_creation_alerts write failed after sending: ${markErr.message}`);
      alerted += 1;
      sent.push(subject);
    }
    return NextResponse.json({ ok: true, alerted, skipped, remaining: Math.max(0, (candidates ?? []).length - doneIds.size - todo.length), sent });
  });
}

export const GET = handle;
export const POST = handle;
