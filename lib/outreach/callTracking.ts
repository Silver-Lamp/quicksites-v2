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
/**
 * Buy a local US number for a campaign.
 *
 * ⚠️ THE OLD FALLBACK BOUGHT A NUMBER IN ANY STATE, SILENTLY, AND THAT IS WORSE THAN FAILING.
 * It asked for the requested area code and, on an empty result, retried with NO filter at all —
 * so `seatac-towing.com` (206 requested, none available) was given **+1 419 557 4374, Ohio**,
 * and the route returned `{ ok: true }` with nothing to say it had missed. A geo rank-and-rent
 * site's entire pitch is "the local people"; an out-of-state area code on the page undercuts
 * that before anyone dials, and nobody finds out because the purchase looked clean.
 *
 * Now it narrows in steps and REPORTS which one it landed on:
 *   1. the exact area code
 *   2. any number in the same STATE (`inRegion`) — a neighbouring area code still reads local
 *   3. near the market's coordinates, when the campaign has them
 *   4. anywhere — only if the caller explicitly allows it
 *
 * `locality` tells the caller what it got, so a non-local number can be surfaced instead of
 * discovered later on a live page.
 */
export type ProvisionedNumber = {
  phoneNumber: string;
  sid: string;
  /** How close the number is to the market it was bought for. */
  locality: 'area_code' | 'same_state' | 'nearby' | 'anywhere';
};

export async function provisionTrackingNumber(opts: {
  voiceUrl: string;
  areaCode?: string;
  /** Two-letter state, used when the exact area code is sold out. */
  region?: string | null;
  /** Market centre, used when the state has nothing either. */
  lat?: number | null;
  lon?: number | null;
  /**
   * Buy a number anywhere in the US rather than fail. Default FALSE: an Ohio number on a
   * Washington towing site is not a lesser success, it is a different (worse) product.
   */
  allowAnywhere?: boolean;
  /** Inbound SMS webhook (STOP handling). */
  smsUrl?: string;
}): Promise<ProvisionedNumber> {
  const c = client();
  const pick = async (params: Record<string, unknown>): Promise<string | undefined> => {
    try {
      const list = await c.availablePhoneNumbers('US').local.list({
        voiceEnabled: true,
        limit: 5,
        ...params,
      } as any);
      return list?.[0]?.phoneNumber;
    } catch {
      return undefined;
    }
  };

  let candidate: string | undefined;
  let locality: ProvisionedNumber['locality'] = 'area_code';

  if (opts.areaCode) candidate = await pick({ areaCode: Number(opts.areaCode) });
  if (!candidate && opts.region) {
    candidate = await pick({ inRegion: String(opts.region).toUpperCase() });
    if (candidate) locality = 'same_state';
  }
  if (!candidate && Number.isFinite(opts.lat) && Number.isFinite(opts.lon)) {
    candidate = await pick({ nearLatLong: `${opts.lat},${opts.lon}`, distance: 100 });
    if (candidate) locality = 'nearby';
  }
  if (!candidate && opts.allowAnywhere) {
    candidate = await pick({});
    if (candidate) locality = 'anywhere';
  }
  if (!candidate) {
    throw new Error(
      `No number available near ${opts.areaCode ?? opts.region ?? 'that market'}. ` +
        'Refusing to buy an out-of-area number — pass allowAnywhere to override.',
    );
  }

  const bought = await c.incomingPhoneNumbers.create({
    phoneNumber: candidate,
    voiceUrl: opts.voiceUrl,
    voiceMethod: 'GET',
    ...(opts.smsUrl ? { smsUrl: opts.smsUrl, smsMethod: 'POST' as const } : {}),
  });
  return { phoneNumber: bought.phoneNumber, sid: bought.sid, locality };
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
