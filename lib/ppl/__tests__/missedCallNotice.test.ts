/**
 * @jest-environment node
 */
// lib/ppl/__tests__/missedCallNotice.test.ts
//
// A forwarded call that rang out with no message must reach the business anyway — and nothing
// else may. 2026-10-07: a caller rang renton-electrical.com twice, got no answer twice, left no
// message, and the business was told nothing because the only text we sent came from the
// voicemail webhook.
import fs from 'node:fs';
import path from 'node:path';
import { missedCallDecision, MISSED_CALL_SETTLE_MS, type MissedCallRow } from '@/lib/ppl/missedCallNotice';
import { missedCallSuffix, handlingLabel, type CallRow } from '@/lib/ppl/callAlert';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const row = (over: Partial<MissedCallRow> = {}): MissedCallRow => ({
  handling: 'forward',
  call_status: 'dial-no-answer',
  call_duration: null,
  forwarded_to: '+14259029422',
  recording_url: null,
  voicemail_notified_at: null,
  missed_call_notified_at: null,
  ...over,
});

describe('missedCallDecision', () => {
  it('texts the destination for a forward that rang out with no message (the 2026-10-07 call)', () => {
    expect(missedCallDecision(row(), { status: 'completed' })).toEqual({ send: true, to: '+14259029422' });
    for (const s of ['dial-busy', 'dial-failed', 'dial-canceled']) {
      expect(missedCallDecision(row({ call_status: s }), { status: 'completed' })).toEqual({ send: true, to: '+14259029422' });
    }
  });

  // The voicemail webhook claims its row before it texts "they left a message"; a second text
  // saying "they didn't" would contradict it.
  it('defers to the voicemail path when a message was left', () => {
    expect(missedCallDecision(row({ recording_url: 'https://api.twilio.com/x/RE1' }), { status: 'completed' })).toEqual({ send: false, reason: 'message_left' });
    expect(missedCallDecision(row({ voicemail_notified_at: '2026-10-07T19:43:00Z' }), { status: 'completed' })).toEqual({ send: false, reason: 'message_left' });
  });

  // `abandoned`: the business was never rung. `brief`/`connected`: something picked up.
  it('never texts about a call the business was not rung on, or one it took', () => {
    expect(missedCallDecision(row({ call_status: 'abandoned', call_duration: 5 }), { status: 'completed' })).toEqual({ send: false, reason: 'not_unanswered' });
    expect(missedCallDecision(row({ call_status: 'ringing' }), { status: 'completed' })).toEqual({ send: false, reason: 'not_unanswered' });
    expect(missedCallDecision(row({ call_status: 'dial-completed', call_duration: 3 }), { status: 'completed' })).toEqual({ send: false, reason: 'not_unanswered' });
    expect(missedCallDecision(row({ call_status: 'dial-completed', call_duration: 40 }), { status: 'completed' })).toEqual({ send: false, reason: 'not_unanswered' });
  });

  it('only ever runs for a forward with a recorded destination', () => {
    expect(missedCallDecision(row({ handling: 'voicemail_first' }), { status: 'completed' })).toEqual({ send: false, reason: 'not_a_forward' });
    expect(missedCallDecision(row({ handling: 'ppl' }), { status: 'completed' })).toEqual({ send: false, reason: 'not_a_forward' });
    expect(missedCallDecision(row({ forwarded_to: null }), { status: 'completed' })).toEqual({ send: false, reason: 'no_destination' });
  });

  it('is idempotent on the claim column and waits for a terminal parent status', () => {
    expect(missedCallDecision(row({ missed_call_notified_at: '2026-10-07T19:44:00Z' }), { status: 'completed' })).toEqual({ send: false, reason: 'already_notified' });
    expect(missedCallDecision(row(), { status: 'in-progress' })).toEqual({ send: false, reason: 'call_not_over' });
    expect(missedCallDecision(null, { status: 'completed' })).toEqual({ send: false, reason: 'no_row' });
  });

  it('settles long enough for the voicemail claim to land, and not so long the lead goes cold', () => {
    expect(MISSED_CALL_SETTLE_MS).toBeGreaterThanOrEqual(5_000);
    expect(MISSED_CALL_SETTLE_MS).toBeLessThanOrEqual(20_000);
  });
});

describe('the status route wires it correctly', () => {
  const src = read('app/api/twilio/geo/[campaignId]/status/route.ts');

  it('runs the notice in after(), so Twilio gets its response first', () => {
    expect(src).toMatch(/import \{ after \} from 'next\/server'/);
    expect(src).toMatch(/after\(\(\) => notifyMissedCall\(/);
    expect(src).toMatch(/missedCallDecision\(/);
  });

  it('settles and RE-READS the row before deciding, then claims before sending', () => {
    expect(src).toMatch(/setTimeout\(r, MISSED_CALL_SETTLE_MS\)/);
    // The claim: update … is('missed_call_notified_at', null) … and bail when nothing claimed.
    expect(src).toMatch(/\.is\('missed_call_notified_at', null\)/);
    expect(src).toMatch(/if \(!claimed\?\.length\) return/);
    // Opt-out still outranks the dial.
    expect(src).toMatch(/isOptedOut\(decision\.to\)/);
    // The text says "no message" and carries no link — there is no recording on this branch.
    expect(src).toMatch(/hasRecording: false/);
  });

  it('records the outcome, not just the attempt', () => {
    expect(src).toMatch(/missed_call_notify_result: result/);
    expect(src).toMatch(/business_sms: true/);
  });

  it('still never upserts — a status callback must not mint a row the entry route refused', () => {
    expect(src).not.toMatch(/\.upsert\(/);
  });
});

describe('the operator email says whether the business was told', () => {
  const base: CallRow = {
    id: 'r1',
    call_sid: 'CA1',
    from_number: '+12067102328',
    to_number: '+14255374849',
    forwarded_to: '+14259029422',
    call_status: 'dial-no-answer',
    call_duration: null,
    handling: 'forward',
    custom_domain: 'renton-electrical.com',
    created_at: '2026-10-07T19:42:50.000Z',
  };

  it('asserts "texted" only on a confirmed send', () => {
    expect(missedCallSuffix(base)).toBe('');
    expect(missedCallSuffix({ ...base, missed_call_notified_at: 't', missed_call_notify_result: { business_sms: true } })).toContain('texted them');
    expect(missedCallSuffix({ ...base, missed_call_notified_at: 't', missed_call_notify_result: { business_sms: false, error: 'x' } })).toContain('not confirmed');
    expect(missedCallSuffix({ ...base, missed_call_notified_at: 't', missed_call_notify_result: null })).toContain('not confirmed');
    expect(missedCallSuffix({ ...base, missed_call_notified_at: 't', missed_call_notify_result: { skipped: 'opted_out' } })).toContain('opted out');
  });

  it('reaches the handling line of the email, and the cron selects the columns it needs', () => {
    expect(handlingLabel({ ...base, missed_call_notified_at: 't', missed_call_notify_result: { business_sms: true } })).toBe(
      'Forwarded to (425) 902-9422 · texted them the caller’s number',
    );
    const cron = read('app/api/cron/call-alert/route.ts');
    expect(cron).toMatch(/missed_call_notified_at, missed_call_notify_result/);
  });
});
