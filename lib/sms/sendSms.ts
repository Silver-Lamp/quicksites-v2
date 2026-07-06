// lib/sms/sendSms.ts
//
// Thin Twilio SMS wrapper (first generic sender in the repo). Prefers a Messaging
// Service SID when set, else a from-number. Returns a result rather than throwing so
// callers can degrade (e.g. offer a manual-verify fallback). Never logs the body/number.
import twilio from 'twilio';

export type SendSmsResult = { ok: boolean; error?: string };

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !messagingServiceSid)) {
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
