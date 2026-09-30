/**
 * @jest-environment node
 */
// lib/ppl/__tests__/forwardHealth.test.ts
//
// The classifier that decides whether a forwarded call reached anybody, and the notice check
// that decides whether the destination has been told. Both were wrong on 2026-09-30 in the same
// direction — toward "everything is fine" — which is why covingtontow.com dropped two real leads
// with the evidence already on screen.
import { readFileSync } from 'node:fs';
import { classifyDial, suggestsUnresponsive, ANSWERED_MIN_SECONDS } from '@/lib/ppl/forwardHealth';
import { noticeAlreadySent } from '@/lib/ppl/forwardNotice';
import { recommendForwardTargets, type ForwardProspect } from '@/lib/ppl/forwardCandidates';
import { usE164 } from '@/lib/phone/formatUs';
import { stripComments } from '@/test/stripComments';

describe('classifyDial', () => {
  it('counts the statuses that mean nobody took the call', () => {
    for (const s of ['dial-no-answer', 'dial-busy', 'dial-failed', 'dial-canceled']) {
      expect(classifyDial(s, null)).toBe('unanswered');
    }
  });

  // ⚠️ The case that made this necessary. Twilio's `completed` means the dialled leg ended
  // normally, which is ALSO what voicemail answering looks like. Reading it as "answered" turns
  // a dead line into a delivered lead.
  it('does not read a short "completed" dial as a person picking up', () => {
    expect(classifyDial('dial-completed', 4)).toBe('brief');
    expect(classifyDial('dial-completed', ANSWERED_MIN_SECONDS - 1)).toBe('brief');
    expect(classifyDial('dial-completed', ANSWERED_MIN_SECONDS)).toBe('answered');
    expect(classifyDial('dial-completed', 120)).toBe('answered');
  });

  // An unknown status is missing information, not a failure. If Twilio renames an outcome we
  // must not start writing businesses onto the unresponsive list because of it.
  it('treats an unrecognised or in-flight status as no verdict, never as a failure', () => {
    expect(classifyDial('ringing', null)).toBe('in_progress');
    expect(classifyDial('queued', null)).toBe('in_progress');
    expect(classifyDial(null, null)).toBe('in_progress');
    expect(classifyDial('some-future-twilio-status', null)).toBe('in_progress');
  });
});

describe('suggestsUnresponsive', () => {
  it('needs a run of failures, not a bad morning', () => {
    expect(suggestsUnresponsive({ answered: 0, brief: 0, unanswered: 2 })).toBe(false);
    expect(suggestsUnresponsive({ answered: 0, brief: 0, unanswered: 3 })).toBe(true);
  });

  // One answered call means the line works and somebody is there. Whatever else is happening,
  // it is not "this business never picks up" — the claim the flag would be making.
  it('is cleared by a single answered call, however many failures surround it', () => {
    expect(suggestsUnresponsive({ answered: 1, brief: 0, unanswered: 20 })).toBe(false);
  });

  // `brief` is voicemail-shaped. It proves the line is alive, which is exactly why it must not
  // be counted as evidence of a person — and equally must not count as a failure.
  it('does not let voicemail pickups vouch for a business or condemn one', () => {
    expect(suggestsUnresponsive({ answered: 0, brief: 5, unanswered: 1 })).toBe(false);
    expect(suggestsUnresponsive({ answered: 0, brief: 5, unanswered: 3 })).toBe(true);
  });
});

describe('noticeAlreadySent', () => {
  it('is about the destination, not the campaign', () => {
    expect(noticeAlreadySent('+12533265555', '+12533265555', '2026-09-28T00:00:00Z')).toBe(true);
    // The bug: re-pointed campaign, stale timestamp, new business told nothing.
    expect(noticeAlreadySent('+12533265555', '+12532347959', '2026-09-28T00:00:00Z')).toBe(false);
  });

  it('compares digits, so a display-format number is not a different destination', () => {
    expect(noticeAlreadySent('+12533265555', '(253) 326-5555', '2026-09-28T00:00:00Z')).toBe(true);
    expect(noticeAlreadySent('2533265555', '+12533265555', null)).toBe(true);
  });

  // ⚠️ Rows written before 20260861 carry a timestamp and no subject. Treating those as
  // unnotified would re-text twelve businesses that were told two days ago — spam we would have
  // caused by improving our own bookkeeping.
  it('honours a legacy timestamp with no recorded destination', () => {
    expect(noticeAlreadySent('+12533265555', null, '2026-09-28T00:00:00Z')).toBe(true);
    expect(noticeAlreadySent('+12533265555', null, null)).toBe(false);
  });
});

describe('the recommender honours an unresponsive destination', () => {
  const campaign = {
    id: 'c1',
    domain: 'covingtontow.com',
    city: 'Covington',
    region: 'WA',
    industry_key: 'towing',
    center_lat: 47.3657791,
    center_lon: -122.100222,
  };
  const prospect = (over: Partial<ForwardProspect>): ForwardProspect => ({
    id: 'p',
    business_name: 'A Towing',
    phone: '(253) 234-7959',
    website: null,
    city: 'Covington',
    region: 'WA',
    industry_key: 'towing',
    rating: 5,
    review_count: 71,
    status: 'draft_built',
    created_at: '2026-09-27T00:00:00Z',
    last_seen_at: '2026-09-27T00:00:00Z',
    address_lat: 47.3705492,
    address_lon: -122.1038709,
    ...over,
  });

  const pool = [
    prospect({ id: 'alram', business_name: 'AL Ram Towing', phone: '(253) 234-7959' }),
    prospect({ id: 'prime', business_name: 'Prime Towing', phone: '(253) 326-5555', rating: 5, review_count: 10 }),
  ];
  const now = new Date('2026-09-30T15:00:00Z');

  it('would otherwise rank the non-answering business first', () => {
    const r = recommendForwardTargets(campaign, pool, { now });
    expect(r.ranked[0].prospect.business_name).toBe('AL Ram Towing');
  });

  it('drops it once observed unresponsive, and says that is why', () => {
    const r = recommendForwardTargets(campaign, pool, {
      now,
      unresponsive: new Set(['2532347959']),
    });
    expect(r.ranked.map((c) => c.prospect.business_name)).toEqual(['Prime Towing']);
    expect(r.disqualified).toContainEqual(
      expect.objectContaining({ reason: 'unresponsive' }),
    );
  });

  // ⚠️ The two exclusions are different facts and the report must not blur them: an opt-out is
  // the business's decision, unresponsive is our conclusion from our evidence.
  it('reports an opt-out and an observation as different reasons', () => {
    const optedOut = recommendForwardTargets(campaign, pool, {
      now,
      optedOut: new Set(['2532347959']),
    });
    expect(optedOut.disqualified.find((d) => d.prospect.id === 'alram')?.reason).toBe('opted_out');
    const unresponsive = recommendForwardTargets(campaign, pool, {
      now,
      unresponsive: new Set(['2532347959']),
    });
    expect(unresponsive.disqualified.find((d) => d.prospect.id === 'alram')?.reason).toBe(
      'unresponsive',
    );
  });
});

describe('usE164 — the format an operator should never have to type', () => {
  it('accepts every shape our own data and a human produce', () => {
    for (const raw of ['(253) 326-5555', '253-326-5555', '2533265555', '+12533265555', '1 253 326 5555']) {
      expect(usE164(raw)).toBe('+12533265555');
    }
  });

  // ⚠️ null, never a best effort: this value is DIALLED. `formatUsPhone` can safely echo its
  // input because a human reads the result; a half-parsed number here is a call to the wrong
  // person. The truncation bug in formatUs.ts's header is the same mistake with a screen
  // instead of a dialer.
  it('refuses rather than guesses', () => {
    for (const raw of ['', null, undefined, '555', '253326555', '0253265555', '1253265555x']) {
      expect(usE164(raw as string)).toBeNull();
    }
  });
});

describe('the current destination is not its own replacement', () => {
  const campaign = {
    id: 'c1',
    domain: 'covingtontow.com',
    city: 'Covington',
    region: 'WA',
    industry_key: 'towing',
    center_lat: 47.3657791,
    center_lon: -122.100222,
  };
  const p = (id: string, name: string, phone: string): ForwardProspect => ({
    id, business_name: name, phone, website: null, city: 'Covington', region: 'WA',
    industry_key: 'towing', rating: 5, review_count: 71, status: 'draft_built',
    created_at: '2026-09-27T00:00:00Z', last_seen_at: '2026-09-27T00:00:00Z',
    address_lat: 47.3705492, address_lon: -122.1038709,
  });
  const pool = [p('alram', 'AL Ram Towing', '(253) 234-7959'), p('prime', 'Prime Towing', '(253) 326-5555')];
  const now = new Date('2026-09-30T15:00:00Z');

  it('drops the incumbent and says which reason it was', () => {
    const r = recommendForwardTargets(campaign, pool, { now, currentDestination: '+12532347959' });
    expect(r.ranked.map((c) => c.prospect.business_name)).toEqual(['Prime Towing']);
    expect(r.disqualified.find((d) => d.prospect.id === 'alram')?.reason).toBe('current_destination');
  });

  // Display format in, E.164 in the campaign row — the comparison has to survive both.
  it('matches the incumbent whichever format it is stored in', () => {
    for (const cur of ['+12532347959', '(253) 234-7959', '2532347959']) {
      const r = recommendForwardTargets(campaign, pool, { now, currentDestination: cur });
      expect(r.ranked.map((c) => c.prospect.id)).toEqual(['prime']);
    }
  });
});

describe('source guards', () => {
  // A unit test cannot see a hard-coded colour. The reason "Dial-No-Answer" read as a success
  // for as long as it did is that the status cell was painted `text-green-400` unconditionally.
  it('the call-log status colour is derived, not fixed', () => {
    const src = stripComments(readFileSync('app/admin/call-logs/page.tsx', 'utf8'));
    expect(src).toContain('classifyDial');
    expect(src).not.toMatch(/className=\{?["'`][^"'`]*text-green-400/);
  });

  // The repoint route must refuse rather than proceed when it cannot notify. Checking after the
  // write would mean a business already receiving calls it was never told about.
  it('set-forward refuses before writing when SMS is unconfigured', () => {
    const src = stripComments(
      readFileSync('app/api/admin/prospects/geo-campaign/set-forward/route.ts', 'utf8'),
    );
    const guard = src.indexOf('smsConfigured()');
    const write = src.indexOf('setCampaignForwardTo(');
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(write);
  });

  // `forwarded_to` is the whole basis of per-destination attribution. If the bridge stops
  // writing it, every answer rate silently becomes a claim about the wrong business.
  it('the geo bridge records the number it dialled', () => {
    const src = stripComments(readFileSync('app/api/twilio/geo/[campaignId]/route.ts', 'utf8'));
    expect(src).toMatch(/forwarded_to:/);
  });

  // ⚠️ Deconfliction reserves a business for the campaign closest to it. A campaign that already
  // forwards somewhere is not competing for anyone, so including it makes it hoard a candidate
  // for a re-point that will never happen. When `includeAssigned` was first added, Covington —
  // the one campaign actually needing a destination — lost Prime Towing, Hook Towing AND
  // Affordable Towing Issaquah to three campaigns with working forward-tos, and fell through to
  // an unrated row last seen 79 days earlier.
  it('deconfliction runs only over campaigns with nowhere to send calls', () => {
    const src = stripComments(readFileSync('lib/ppl/forwardSuggestions.ts', 'utf8'));
    expect(src).toMatch(/deconflictTopPicks\(unassigned\)/);
    expect(src).not.toMatch(/deconflictTopPicks\(recommendations\)/);
  });

  // The empty field was answered with a format complaint while the box displayed a grey number
  // that reads as a value. Both halves have to stay fixed: a distinct empty-state message, and
  // a placeholder that cannot be mistaken for input.
  it('the repoint box distinguishes an empty field from a malformed one', () => {
    const src = stripComments(readFileSync('components/admin/ppl-repoint-forward.tsx', 'utf8'));
    expect(src).toMatch(/the box is empty/);
    expect(src).not.toMatch(/placeholder="\+\d/);
  });
});
