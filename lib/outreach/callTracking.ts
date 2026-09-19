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
  /** The account that owns it — the parent, or one of its subaccounts. */
  accountSid: string;
  accountName: string | null;
  inSubaccount: boolean;
};

export type TwilioAccountFamily = {
  accounts: Array<{ sid: string; name: string | null; status: string | null; isParent: boolean }>;
  /** Why the walk may be incomplete — shown on the ops page, never swallowed. */
  listError: string | null;
};

/** The parent account plus every subaccount it owns (Twilio's console can create these silently). */
export async function accountFamily(): Promise<TwilioAccountFamily> {
  const parent = process.env.TWILIO_ACCOUNT_SID!;
  const accounts: TwilioAccountFamily['accounts'] = [
    { sid: parent, name: null, status: null, isParent: true },
  ];
  let listError: string | null = null;
  try {
    const subs = await client().api.v2010.accounts.list({ limit: 50 });
    for (const a of subs) {
      if (a.sid === parent) {
        accounts[0].name = a.friendlyName ?? null;
        accounts[0].status = a.status ?? null;
        continue;
      }
      if (a.status === 'closed') continue;
      accounts.push({
        sid: a.sid,
        name: a.friendlyName ?? null,
        status: a.status ?? null,
        isParent: false,
      });
    }
  } catch (e: any) {
    listError = e?.message || 'accounts.list failed';
  }
  return { accounts, listError };
}

/**
 * Every number across the parent AND its subaccounts, with where its voice/SMS webhooks point
 * — read-only. The ops page shows this so "what does Twilio have" is answered from the running
 * process, never from a screenshot or a memory. Returns [] when Twilio is not configured.
 * ⚠️ A number in a subaccount signs its webhooks with THAT subaccount's token, which we do not
 * hold — so it cannot be attached where it is; attachTrackingNumber moves it to the parent first.
 */
export async function listTrackingNumbers(): Promise<TwilioNumberSummary[]> {
  if (!twilioConfigured()) return [];
  const parent = process.env.TWILIO_ACCOUNT_SID!;
  const c = client();
  const out: TwilioNumberSummary[] = [];
  for (const acct of (await accountFamily()).accounts) {
    let list: Awaited<ReturnType<typeof c.incomingPhoneNumbers.list>> = [];
    try {
      list = await c.api.v2010.accounts(acct.sid).incomingPhoneNumbers.list({ limit: 200 });
    } catch {
      continue;
    }
    for (const n of list) {
      out.push({
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName ?? null,
        voiceUrl: n.voiceUrl || null,
        voiceApplicationSid: n.voiceApplicationSid || null,
        smsUrl: n.smsUrl || null,
        accountSid: acct.sid,
        accountName: acct.name,
        inSubaccount: acct.sid !== parent,
      });
    }
  }
  return out;
}

/**
 * Point an EXISTING number (bought by hand, or one already forwarding) at a campaign's voice
 * route. Costs nothing, so it is gated only on Twilio being configured — not on
 * CALL_TRACKING_ENABLED, which guards purchases. A number found in a SUBACCOUNT is first
 * transferred to the parent (Twilio's "exchanging numbers between subaccounts"), because
 * webhooks are signed with the owning account's token and the parent's is the one we hold.
 * Returns the number's SID and what it pointed at before, so the change can be undone by hand.
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
  transferredFrom: string | null;
}> {
  if (!twilioConfigured()) throw new Error('Twilio is not configured.');
  const parent = process.env.TWILIO_ACCOUNT_SID!;
  const c = client();

  // Find it anywhere in the family.
  let found: {
    sid: string;
    accountSid: string;
    voiceUrl: string | null;
    voiceApplicationSid: string | null;
  } | null = null;
  for (const acct of (await accountFamily()).accounts) {
    const matches = await c.api.v2010
      .accounts(acct.sid)
      .incomingPhoneNumbers.list({ phoneNumber: opts.phoneNumber, limit: 1 })
      .catch(() => []);
    if (matches[0]) {
      found = {
        sid: matches[0].sid,
        accountSid: acct.sid,
        voiceUrl: matches[0].voiceUrl || null,
        voiceApplicationSid: matches[0].voiceApplicationSid || null,
      };
      break;
    }
  }
  if (!found)
    throw new Error(
      `${opts.phoneNumber} is not a number on this Twilio account or its subaccounts.`
    );

  let transferredFrom: string | null = null;
  if (found.accountSid !== parent) {
    await c.api.v2010
      .accounts(found.accountSid)
      .incomingPhoneNumbers(found.sid)
      .update({ accountSid: parent });
    transferredFrom = found.accountSid;
  }

  await c.incomingPhoneNumbers(found.sid).update({
    voiceUrl: opts.voiceUrl,
    voiceMethod: 'GET',
    // A Studio flow is bound through voiceApplicationSid; clearing it is what actually moves
    // the number off the flow. The flow itself is left in place as a fallback.
    voiceApplicationSid: '',
    ...(opts.smsUrl
      ? { smsUrl: opts.smsUrl, smsMethod: 'POST' as const, smsApplicationSid: '' }
      : {}),
  });
  return {
    sid: found.sid,
    previousVoiceUrl: found.voiceUrl,
    previousVoiceApplicationSid: found.voiceApplicationSid,
    transferredFrom,
  };
}
