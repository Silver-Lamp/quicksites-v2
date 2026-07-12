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
}): Promise<{ phoneNumber: string; sid: string }> {
  const c = client();
  let candidate: string | undefined;
  try {
    const list = await c
      .availablePhoneNumbers('US')
      .local.list({ areaCode: opts.areaCode ? Number(opts.areaCode) : undefined, voiceEnabled: true, limit: 5 });
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
