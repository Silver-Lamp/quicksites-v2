// lib/notifications/newSignupEmail.ts
//
// Email the platform admins when a brand-new user signs up. Best-effort + non-blocking:
// called right after captureSignupIfNew from the two auth-landing routes (magic-link
// set-session + OAuth callback), and never throws into the auth flow.
//
// Uses the SAME freshness gate as the SIGNUP funnel event (a user created <2 min ago at
// first session-establishment is a genuine signup, not a returning login), and SKIPS
// anonymous users so a guest-build session never triggers a notification.
//
// Recipients: SIGNUP_NOTIFY_EMAILS (comma list) → ADMIN_EMAILS → a safe default. Sending
// goes through the shared Resend helper (dev-logs when RESEND_API_KEY is unset).

import { sendEmail } from '@/lib/email';

const SIGNUP_FRESHNESS_MS = 2 * 60 * 1000;

type SignupUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  is_anonymous?: boolean | null;
  app_metadata?: { provider?: string | null; providers?: string[] | null } | null;
};

function recipients(): string[] {
  const raw =
    process.env.SIGNUP_NOTIFY_EMAILS ||
    process.env.ADMIN_EMAILS ||
    'sandonjurowski@gmail.com';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Notify admins of a new signup. Best-effort — swallows all errors. */
export async function notifyNewSignup(user: SignupUser | null | undefined): Promise<void> {
  try {
    if (!user?.id || !user.created_at) return;
    if (user.is_anonymous) return; // guest-build anon session, not a real signup
    const createdMs = new Date(user.created_at).getTime();
    if (!Number.isFinite(createdMs)) return;
    if (Date.now() - createdMs > SIGNUP_FRESHNESS_MS) return; // returning login, not a signup

    const to = recipients();
    if (!to.length) return;

    const email = (user.email || '').trim() || '(no email on record)';
    const provider =
      user.app_metadata?.provider ||
      (Array.isArray(user.app_metadata?.providers) ? user.app_metadata?.providers?.[0] : '') ||
      'email';
    const when = new Date(createdMs).toISOString();
    const base = (process.env.APP_BASE_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');

    await sendEmail({
      to,
      subject: `🎉 New QuickSites signup: ${email}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#111;line-height:1.5">
          <h2 style="margin:0 0 12px">New user signed up</h2>
          <table style="border-collapse:collapse">
            <tr><td style="padding:2px 16px 2px 0;color:#666">Email</td><td><strong>${esc(email)}</strong></td></tr>
            <tr><td style="padding:2px 16px 2px 0;color:#666">Method</td><td>${esc(String(provider))}</td></tr>
            <tr><td style="padding:2px 16px 2px 0;color:#666">Signed up</td><td>${esc(when)}</td></tr>
            <tr><td style="padding:2px 16px 2px 0;color:#666">User ID</td><td style="font-family:monospace;font-size:12px">${esc(user.id)}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="${esc(base)}/admin">Open the admin →</a></p>
          <p style="margin-top:24px;color:#999;font-size:12px">You're receiving this because your address is in SIGNUP_NOTIFY_EMAILS / ADMIN_EMAILS.</p>
        </div>`,
    });
  } catch {
    // best-effort — never block or throw into the auth flow
  }
}
