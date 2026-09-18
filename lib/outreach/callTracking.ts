// lib/outreach/callTracking.ts
//
// Provision + release Twilio tracking numbers for geo-domain campaigns. A tracked
// number on each geo-site forwards to the business and logs every call, so we can PROVE
// lead volume (the sales/retention engine behind the rental model — see
// docs/GEO_DOMAIN_MONETIZATION.md).
//
// GATED behind CALL_TRACKING_ENABLED (+ Twilio creds): buying a number costs money, so
// a campaign never provisions one by accident.

import twilio from 'twilio';

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
export function callTrackingEnabled(): boolean {
  return (
    (process.env.CALL_TRACKING_ENABLED === '1' || process.env.CALL_TRACKING_ENABLED === 'true') &&
    twilioConfigured()
  );
}

function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

/** Extract a US area code from a loose/E.164 phone, else undefined. */
export function areaCodeFromPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/[^\d]/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1, 4);
  if (d.length === 10) return d.slice(0, 3);
  return undefined;
}

/**
 * Buy a local US number (near `areaCode` when possible) whose voice webhook points at
 * `voiceUrl`. Returns the E.164 number + its SID. Throws if none is available.
 */
export async function provisionTrackingNumber(opts: {
  voiceUrl: string;
  areaCode?: string;
  /** Inbound SMS webhook (STOP handling). */
  smsUrl?: string;
}): Promise<{ phoneNumber: string; sid: string }> {
  const c = client();
  let candidate: string | undefined;
  try {
    const list = await c.availablePhoneNumbers('US').local.list({
      areaCode: opts.areaCode ? Number(opts.areaCode) : undefined,
      voiceEnabled: true,
      limit: 5,
    });
    candidate = list?.[0]?.phoneNumber;
  } catch {
    /* fall through to a broader search */
  }
  if (!candidate) {
    const list = await c.availablePhoneNumbers('US').local.list({ voiceEnabled: true, limit: 5 });
    candidate = list?.[0]?.phoneNumber;
  }
  if (!candidate) throw new Error('No available phone numbers to provision.');

  const bought = await c.incomingPhoneNumbers.create({
    phoneNumber: candidate,
    voiceUrl: opts.voiceUrl,
    voiceMethod: 'GET',
    ...(opts.smsUrl ? { smsUrl: opts.smsUrl, smsMethod: 'POST' as const } : {}),
  });
  return { phoneNumber: bought.phoneNumber, sid: bought.sid };
}

export async function releaseTrackingNumber(sid?: string | null): Promise<void> {
  if (!sid) return;
  try {
    await client().incomingPhoneNumbers(sid).remove();
  } catch {
    /* best-effort — a failed release just leaves the number billing until cleaned up */
  }
}

export type TwilioNumberSummary = {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  voiceUrl: string | null;
  voiceApplicationSid: string | null;
  smsUrl: string | null;
};

/**
 * Every number on the account and where its voice/SMS webhooks point — read-only. The ops page
 * shows this so "what does Twilio have" is answered from the running process, never from a
 * screenshot or a memory. Returns [] when Twilio is not configured.
 */
export async function listTrackingNumbers(): Promise<TwilioNumberSummary[]> {
  if (!twilioConfigured()) return [];
  const list = await client().incomingPhoneNumbers.list({ limit: 200 });
  return list.map((n) => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName ?? null,
    voiceUrl: n.voiceUrl || null,
    voiceApplicationSid: n.voiceApplicationSid || null,
    smsUrl: n.smsUrl || null,
  }));
}

/**
 * Point an EXISTING number (bought by hand, or one already forwarding) at a campaign's voice
 * route. Costs nothing, so it is gated only on Twilio being configured — not on
 * CALL_TRACKING_ENABLED, which guards purchases. Returns the number's SID and what it pointed
 * at before, so the change can be undone by hand if a call stops arriving.
 */
export async function attachTrackingNumber(opts: {
  phoneNumber: string;
  voiceUrl: string;
  /** Inbound SMS webhook (STOP handling). Optional so a caller can leave an existing SMS route alone. */
  smsUrl?: string;
}): Promise<{
  sid: string;
  previousVoiceUrl: string | null;
  previousVoiceApplicationSid: string | null;
}> {
  if (!twilioConfigured()) throw new Error('Twilio is not configured.');
  const c = client();
  const matches = await c.incomingPhoneNumbers.list({ phoneNumber: opts.phoneNumber, limit: 1 });
  const n = matches[0];
  if (!n) throw new Error(`${opts.phoneNumber} is not a number on this Twilio account.`);
  const previousVoiceUrl = n.voiceUrl || null;
  const previousVoiceApplicationSid = n.voiceApplicationSid || null;
  await c.incomingPhoneNumbers(n.sid).update({
    voiceUrl: opts.voiceUrl,
    voiceMethod: 'GET',
    // A Studio flow is bound through voiceApplicationSid; clearing it is what actually moves
    // the number off the flow. The flow itself is left in place as a fallback.
    voiceApplicationSid: '',
    ...(opts.smsUrl
      ? { smsUrl: opts.smsUrl, smsMethod: 'POST' as const, smsApplicationSid: '' }
      : {}),
  });
  return { sid: n.sid, previousVoiceUrl, previousVoiceApplicationSid };
}
