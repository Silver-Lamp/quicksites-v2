// app/api/cron/design-partner-nudges/route.ts
//
// Daily design-partner nudge digest. Reads the Design Partners CRM, computes who needs attention
// (overdue/soon next-step, or an in-progress partner gone quiet), and emails ADMIN_EMAILS a short
// digest — once per cooldown window, only when there's something to say. Flag-gated OFF by default
// (DESIGN_PARTNER_NUDGES_ENABLED) so it never emails until the owner turns it on. See
// lib/admin/designPartnerNudges.ts.
//
// Config: DESIGN_PARTNER_NUDGES_ENABLED · DESIGN_PARTNER_NUDGE_STALE_DAYS (7) ·
//         DESIGN_PARTNER_NUDGE_DUE_SOON_DAYS (3) · DESIGN_PARTNER_NUDGE_COOLDOWN_HOURS (20) ·
//         ADMIN_EMAILS (comma-separated) · APP_BASE_URL/NEXT_PUBLIC_APP_URL (for the link)

import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { sendEmail } from '@/lib/email';
import { listDesignPartners } from '@/lib/admin/designPartners';
import {
  computeNudges,
  nudgeLine,
  NUDGES_ENABLED,
  STALE_DAYS,
} from '@/lib/admin/designPartnerNudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_SENT_KEY = 'design_partner_nudge_last_sent';

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('design-partner-nudges', async () => {
    if (!NUDGES_ENABLED()) return { skipped: 'disabled' };

    const partners = await listDesignPartners();
    const nudges = computeNudges(partners, { nowMs: Date.now() });
    if (!nudges.length) return { nudges: 0 };

    // Cooldown so a daily run doesn't double-send if triggered twice.
    const cooldownHrs = Number(process.env.DESIGN_PARTNER_NUDGE_COOLDOWN_HOURS ?? '20') || 20;
    const lastSent = await getSiteSetting<string | null>(LAST_SENT_KEY, null);
    if (lastSent && Date.now() - Date.parse(lastSent) < cooldownHrs * 3600_000) {
      return { nudges: nudges.length, skipped: 'cooldown' };
    }

    const admins = String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!admins.length) return { nudges: nudges.length, skipped: 'no_admin_emails' };

    const base = (
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.quicksites.ai'
    ).replace(/\/+$/, '');
    const staleDays = STALE_DAYS();
    const lines = nudges.map((n) => `<li>${escapeHtml(nudgeLine(n, staleDays))}</li>`).join('');
    const html = `
      <h2>Design partners needing a nudge (${nudges.length})</h2>
      <ul>${lines}</ul>
      <p><a href="${base}/admin/design-partners">Open Design Partners →</a></p>
      <p style="color:#888;font-size:12px">You're getting this because DESIGN_PARTNER_NUDGES_ENABLED is on. It sends at most once per ${process.env.DESIGN_PARTNER_NUDGE_COOLDOWN_HOURS ?? 20}h and only when something needs attention.</p>`;

    await sendEmail({
      to: admins,
      subject: `🤝 ${nudges.length} design partner${nudges.length === 1 ? '' : 's'} need a nudge`,
      html,
    });
    await setSiteSetting(LAST_SENT_KEY, new Date().toISOString(), null);

    return { nudges: nudges.length, emailed: admins.length };
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
