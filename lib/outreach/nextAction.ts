// lib/outreach/nextAction.ts
//
// Pure "work the lead" cadence engine: the single next-best outreach action for a
// geo-campaign — postcard / SMS / call / email / wait / stop — timing- and cost-aware.
// See docs/GEO_RECOMMENDATIONS_PLAN.md.

export type NextActionKind =
  | 'send_postcard'
  | 'send_sms'
  | 'call'
  | 'send_email'
  | 'reach_out_now'
  | 'wait'
  | 'cold'
  | 'rent_pitch'
  | 'nurture';

export type NextAction = {
  action: NextActionKind;
  reason: string;
  waitUntil?: string | null; // ISO, when action === 'wait'
  priority: number;
};

export type NextActionInput = {
  now: number; // ms epoch
  draftBuiltAt: string | null;
  lastPostcardAt: string | null;
  lastSmsAt: string | null;
  claimed: boolean;
  subscriptionStatus: string | null;
  callCount: number;
  claimVisits: number;
  rankStatus: string | null;
  channels: { mail: boolean; sms: boolean };
  hasPhone: boolean;
  hasAddress: boolean;
  hasEmail: boolean;
};

const DAY = 86_400_000;
const POSTCARD_FOLLOWUP_DAYS = 7; // wait this long after a postcard before nudging
const COLD_DAYS = 30; // silent this long after both touches → cold

const daysSince = (iso: string | null, now: number): number | null =>
  iso ? (now - new Date(iso).getTime()) / DAY : null;

/** The single next-best outreach action for a campaign. Pure + deterministic. */
export function nextOutreachAction(i: NextActionInput): NextAction {
  const postcardAge = daysSince(i.lastPostcardAt, i.now);
  const smsAge = daysSince(i.lastSmsAt, i.now);
  const touched = i.lastPostcardAt || i.lastSmsAt;

  // Already rented → nurture, nothing to sell.
  if (i.subscriptionStatus === 'active') {
    return { action: 'nurture', reason: 'Rented and active — watch rank + call volume; no outreach needed.', priority: 10 };
  }

  // Claimed but not rented → pitch the rental (email if we have it, else call).
  if (i.claimed) {
    if (i.hasEmail) return { action: 'send_email', reason: 'Claimed but not renting yet — email the rental pitch.', priority: 80 };
    return { action: 'call', reason: 'Claimed but not renting yet — call to close the rental (no email on file).', priority: 80 };
  }

  // High-intent triggers override the cadence: reach out NOW, with proof.
  const clicked = i.claimVisits > 0;
  const rankedNow = i.rankStatus === 'page1';
  const gettingCalls = i.callCount > 0;
  if (clicked || rankedNow || gettingCalls) {
    const proof =
      rankedNow ? "it's on Google's first page" :
      gettingCalls ? `it already sent ${i.callCount} call${i.callCount === 1 ? '' : 's'}` :
      'someone opened the claim link';
    const action: NextActionKind = i.channels.sms && i.hasPhone ? 'send_sms' : 'call';
    return { action, reason: `Hot lead — ${proof}. Reach out now with that proof.`, priority: 95 };
  }

  // No touch yet → first postcard (tangible), else SMS.
  if (!touched) {
    if (i.channels.mail && i.hasAddress) return { action: 'send_postcard', reason: 'No outreach yet — send the competition postcard (tangible first touch).', priority: 70 };
    if (i.channels.sms && i.hasPhone) return { action: 'send_sms', reason: 'No outreach yet, no mailing address — text the claim link.', priority: 65 };
    return { action: 'wait', reason: 'No enabled outreach channel with a valid contact — enable postcards/SMS or add a phone.', priority: 20 };
  }

  // Postcard sent recently → wait.
  if (postcardAge != null && postcardAge < POSTCARD_FOLLOWUP_DAYS && smsAge == null) {
    const until = new Date(new Date(i.lastPostcardAt!).getTime() + POSTCARD_FOLLOWUP_DAYS * DAY).toISOString();
    return { action: 'wait', reason: `Postcard sent ${Math.floor(postcardAge)}d ago — give it time to arrive before following up.`, waitUntil: until, priority: 25 };
  }

  // Postcard landed, still silent → follow up by SMS.
  if (postcardAge != null && postcardAge >= POSTCARD_FOLLOWUP_DAYS && smsAge == null) {
    if (i.channels.sms && i.hasPhone) return { action: 'send_sms', reason: `Postcard sent ${Math.floor(postcardAge)}d ago with no response — follow up by text.`, priority: 60 };
    return { action: 'call', reason: `Postcard sent ${Math.floor(postcardAge)}d ago with no response — follow up with a call.`, priority: 55 };
  }

  // Both touches sent and long silent → cold, move to a runner-up.
  const newestTouchAge = Math.min(...[postcardAge, smsAge].filter((x): x is number => x != null));
  if (newestTouchAge >= COLD_DAYS) {
    return { action: 'cold', reason: `No response ${Math.floor(newestTouchAge)}d after outreach — mark cold and pitch a runner-up.`, priority: 40 };
  }

  // SMS sent recently → wait it out.
  return { action: 'wait', reason: 'Recently contacted — give it a few days before the next touch.', priority: 20 };
}
