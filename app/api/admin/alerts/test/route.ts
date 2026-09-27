// app/api/admin/alerts/test/route.ts
//
// PROVE THE ALERT CHANNEL, rather than trusting a green config gate.
//
// ⚠️ Three outbound channels were found silently dead in a single day (2026-09-26): PostHog was
// never configured, the OpenAI key had been revoked for nine days, and ADMIN_EMAILS was unset so
// every operator alert — including the AI-outage alert written that morning — composed an email
// and sent it to nobody. Each hid for the same reason: the code degrades gracefully and nothing
// checked that the OUTPUT EVER ARRIVES.
//
// `/status` answers "is it configured". Nothing answered "does it work". This does, for the
// channel whose whole job is telling us when something else has stopped.
//
// ⚠️ IT USES THE REAL PATH ON PURPOSE — the same `sendEmail`, the same ADMIN_EMAILS recipients,
// the same Sentry call as `ai-cost-alert`. A test that exercises a parallel code path proves the
// parallel path. If this succeeds, a real alert will too.
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAdmin } from '@/lib/auth/requireUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Show enough to recognise the address, never the whole thing in a response body. */
function mask(addr: string): string {
  const [user, domain] = addr.split('@');
  if (!domain) return '***';
  return `${(user || '').slice(0, 2)}***@${domain}`;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  // Admin-only already, but this sends real mail — a slip on the button should not fan out.
  const limited = await rateLimitOr429(req, 'alert-test', 6, 3600);
  if (limited) return limited;

  const admins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (admins.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        delivery: 'no_recipients',
        detail:
          'ADMIN_EMAILS is empty, so every operator alert is composed and discarded. ' +
          'Set it in Vercel and REDEPLOY — env is attached at deploy time, so an already-built ' +
          'deployment never sees a new value.',
      },
      { status: 503 },
    );
  }

  const subject = '✅ QuickSites alert channel test';
  const html = `
    <h2>This is a test of the operator alert channel</h2>
    <p>If you are reading this, a real outage alert would have reached you too — it travels the
    same path: <code>sendEmail</code> → Resend → ADMIN_EMAILS.</p>
    <p>Sent ${new Date().toISOString()} by an admin from <code>/api/admin/alerts/test</code>.</p>
    <p>The alerts that use this channel: AI outage + overspend, domain expiry watch, showcase link
    health, lead disputes, design-partner nudges, new-order notifications.</p>`;

  let delivery: 'accepted' | 'dev_noop' | 'failed' = 'failed';
  let providerId: string | null = null;
  let error: string | null = null;

  try {
    const res: any = await sendEmail({ to: admins, subject, html });
    if (!res?.ok) {
      error = String(res?.error?.message ?? res?.error ?? 'unknown');
    } else if (res.id === 'dev') {
      // ⚠️ THE TRAP THIS ROUTE EXISTS TO CATCH. With no RESEND_API_KEY, sendEmail logs to the
      // console and returns { ok: true, id: 'dev' } — success, without sending. Every caller that
      // checks `ok` believes it went out. Reporting that as "sent" here would make the one tool
      // built to prove delivery the most convincing liar in the system.
      delivery = 'dev_noop';
    } else {
      delivery = 'accepted';
      providerId = res.id ?? null;
    }
  } catch (e: any) {
    error = e?.message || String(e);
  }

  // The fallback destination is equally unproven, so exercise it in the same click.
  let sentryOk = false;
  try {
    Sentry.captureMessage('QuickSites alert channel test', { level: 'info' } as any);
    sentryOk = true;
  } catch {
    /* reported below as false */
  }

  return NextResponse.json({
    ok: delivery === 'accepted',
    delivery,
    // ⚠️ "accepted" is Resend taking the message, NOT proof it landed in an inbox. A bounce, a
    // spam folder or an unverified sending domain all look like success from here. The only real
    // confirmation is a human seeing it, which is why the response says so out loud.
    caveat:
      delivery === 'accepted'
        ? 'Resend accepted the message. That is not proof of delivery — check the inbox, and Resend’s dashboard if it does not arrive.'
        : delivery === 'dev_noop'
          ? 'NOT SENT. RESEND_API_KEY is unset, so sendEmail logged to the console and returned success. This is the failure mode the route exists to expose.'
          : 'Send failed — see error.',
    recipients: admins.map(mask),
    recipientCount: admins.length,
    providerId,
    sentryCaptured: sentryOk,
    error,
  });
}
