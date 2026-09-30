// lib/sms/sendSms.ts
//
// Thin Twilio SMS wrapper (first generic sender in the repo). Prefers a Messaging
// Service SID when set, else a from-number. Returns a result rather than throwing so
// callers can degrade (e.g. offer a manual-verify fallback). Never logs the body/number.
import twilio from 'twilio';

export type SendSmsResult = { ok: boolean; error?: string };

/**
 * Can this environment send an SMS at all?
 *
 * Exported so a caller can refuse BEFORE doing the thing the message was meant to accompany.
 * `sendSms` already reports `sms_not_configured`, but by then the write has happened — and for
 * a forwarding re-point that means a business receiving a stranger's calls with no explanation.
 * Mirrors the check inside `sendSms` exactly; the two must not drift.
 */
export function smsConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  return !!sid && !!token && (!!from || !!messagingServiceSid);
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Uses the exported predicate rather than repeating it, so the pre-flight a caller runs and
  // the check that actually gates the send are the same expression.
  if (!smsConfigured()) {
    return { ok: false, error: 'sms_not_configured' };
  }

  try {
    const client = twilio(sid, token);
    await client.messages.create(
      messagingServiceSid ? { to, body, messagingServiceSid } : { to, body, from: from! },
    );
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}
