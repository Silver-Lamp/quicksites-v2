import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AI cost-abuse watchdog. Aggregates ai_usage_events spend over a rolling hour +
// day (with an anonymous/guest breakdown) and — if either crosses its threshold —
// alerts admins by email AND Sentry, once per cooldown window. Runs every 15 min.
//
// Thresholds (USD; 0 disables that window):
//   AI_ALERT_HOURLY_USD (default 5) · AI_ALERT_DAILY_USD (default 40)
//   AI_ALERT_COOLDOWN_MINUTES (default 60) · ADMIN_EMAILS (comma-separated)
const LAST_SENT_KEY = 'ai_cost_alert_last_sent';
const usd = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('ai-cost-alert', async () => {
    const db = await getServerSupabase({ serviceRole: true });
    const hourlyLimit = Number(process.env.AI_ALERT_HOURLY_USD ?? '5') || 0;
    const dailyLimit = Number(process.env.AI_ALERT_DAILY_USD ?? '40') || 0;
    const cooldownMin = Number(process.env.AI_ALERT_COOLDOWN_MINUTES ?? '60') || 60;

    const sinceHour = new Date(Date.now() - 60 * 60_000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const [{ data: hour }, { data: day }] = await Promise.all([
      (db as any).rpc('ai_spend_report', { p_since: sinceHour }),
      (db as any).rpc('ai_spend_report', { p_since: sinceDay }),
    ]);

    const breaches: string[] = [];
    if (hourlyLimit > 0 && Number(hour?.total_usd || 0) >= hourlyLimit) {
      breaches.push(`Last hour ${usd(hour.total_usd)} ≥ ${usd(hourlyLimit)} threshold (${hour.calls} calls, ${usd(hour.anon_usd)} from ${hour.distinct_anon} guest user(s))`);
    }
    if (dailyLimit > 0 && Number(day?.total_usd || 0) >= dailyLimit) {
      breaches.push(`Last 24h ${usd(day.total_usd)} ≥ ${usd(dailyLimit)} threshold (${day.calls} calls, ${usd(day.anon_usd)} from ${day.distinct_anon} guest user(s))`);
    }

    // Housekeeping: prune old rate-limit rows so that table can't grow unbounded.
    try { await (db as any).from('ratelimit_events').delete().lt('ts', new Date(Date.now() - 24 * 60 * 60_000).toISOString()); } catch {}

    if (!breaches.length) {
      return NextResponse.json({ ok: true, alerted: false, hour, day });
    }

    // Cooldown: don't re-alert within the window.
    const lastSent = await getSiteSetting<string | null>(LAST_SENT_KEY, null);
    const withinCooldown = !!lastSent && Date.now() - new Date(lastSent).getTime() < cooldownMin * 60_000;
    if (withinCooldown) {
      return NextResponse.json({ ok: true, alerted: false, reason: 'cooldown', breaches, hour, day });
    }

    const admins = String(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const subject = `⚠ QuickSites AI spend alert — ${breaches.length} threshold(s) crossed`;
    const html = `
      <h2>AI spend threshold crossed</h2>
      <ul>${breaches.map((b) => `<li>${b}</li>`).join('')}</ul>
      <p><strong>Last hour:</strong> ${usd(hour?.total_usd)} · top route ${hour?.top_route ?? '—'}<br/>
      <strong>Last 24h:</strong> ${usd(day?.total_usd)} · ${day?.calls} calls · guests ${usd(day?.anon_usd)}</p>
      <p>Investigate: /admin/ai-costs. If this is guest abuse, lower GUEST_AI_CALL_LIMIT / GUEST_DRAFT_HOURLY_LIMIT_PER_IP or disable GUEST_BUILD_ENABLED.</p>`;

    // Sentry (always) + email (if admins configured). Best-effort; never throw.
    try {
      Sentry.captureMessage(`AI spend alert: ${breaches.join(' | ')}`, { level: 'warning', extra: { hour, day } } as any);
    } catch (e) { console.warn('sentry alert failed:', (e as any)?.message || e); }
    if (admins.length) {
      try { await sendEmail({ to: admins, subject, html }); }
      catch (e) { console.warn('cost-alert email failed:', (e as any)?.message || e); }
    }

    await setSiteSetting(LAST_SENT_KEY, new Date().toISOString());
    return NextResponse.json({ ok: true, alerted: true, breaches, emailed: admins.length, hour, day });
  });
}

export const GET = handle;
export const POST = handle;
