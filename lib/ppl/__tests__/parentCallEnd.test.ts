/**
 * @jest-environment node
 */
// lib/ppl/__tests__/parentCallEnd.test.ts
//
// A caller who hangs up before the bridge must be recorded as such, and must never overwrite a
// real dial outcome. 2026-10-05: a five-second robocall sat at `ringing` for an hour because only
// the Dial action wrote outcomes and the Dial never started.
import fs from 'node:fs';
import path from 'node:path';
import { parentEndWrite } from '@/lib/ppl/parentCallEnd';
import { classifyDial } from '@/lib/ppl/forwardHealth';
import { statusCallbackFor } from '@/lib/outreach/callTracking';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('parentEndWrite', () => {
  it('marks a forward that never got a dial outcome as abandoned, with the parent duration', () => {
    expect(parentEndWrite({ call_status: 'ringing', handling: 'forward' }, { status: 'completed', durationSec: 5 })).toEqual({
      call_status: 'abandoned',
      call_duration: 5,
    });
  });

  it('marks a voicemail-first call as ended, not abandoned — it never dials by design', () => {
    expect(parentEndWrite({ call_status: 'ringing', handling: 'voicemail_first' }, { status: 'completed', durationSec: 40 })).toEqual({
      call_status: 'ended',
      call_duration: 40,
    });
  });

  // THE ONE THAT MATTERS. The parent's `completed` arrives a moment after /after-dial wrote the
  // leg outcome; replacing it would erase the destination-health signal on every connected call.
  it('never overwrites a dial outcome', () => {
    for (const s of ['dial-completed', 'dial-no-answer', 'dial-busy', 'completed', 'answered']) {
      expect(parentEndWrite({ call_status: s, handling: 'forward' }, { status: 'completed', durationSec: 30 })).toBeNull();
    }
  });

  it('does nothing on a non-terminal parent status or its own earlier write', () => {
    expect(parentEndWrite({ call_status: 'ringing', handling: 'forward' }, { status: 'in-progress', durationSec: null })).toBeNull();
    expect(parentEndWrite({ call_status: 'abandoned', handling: 'forward' }, { status: 'completed', durationSec: 5 })).toBeNull();
  });

  it('treats a missing row as open (the entry route may not have written yet)', () => {
    expect(parentEndWrite(null, { status: 'completed', durationSec: 3 })).toEqual({ call_status: 'abandoned', call_duration: 3 });
  });
});

describe('classifyDial knows abandoned, and it is not a destination verdict', () => {
  it('maps the two parent-end statuses to abandoned', () => {
    expect(classifyDial('abandoned', 5)).toBe('abandoned');
    expect(classifyDial('ended', 40)).toBe('abandoned');
  });

  it('still reads an unknown status as in_progress, never as a failure', () => {
    expect(classifyDial('something-new', null)).toBe('in_progress');
  });

  it('is counted nowhere in destination health', () => {
    const src = strip(read('lib/ppl/forwardHealth.ts'));
    expect(src).toMatch(/outcome !== 'abandoned'\) acc\.inProgress \+= 1/);
  });
});

describe('every number we buy or attach gets the status callback', () => {
  it('derives the callback from the voice URL', () => {
    expect(statusCallbackFor('https://www.quicksites.ai/api/twilio/geo/abc')).toBe('https://www.quicksites.ai/api/twilio/geo/abc/status');
    expect(statusCallbackFor('https://www.quicksites.ai/api/twilio/geo/abc/')).toBe('https://www.quicksites.ai/api/twilio/geo/abc/status');
  });

  it('is set on purchase AND on attach — a number configured by either path records hang-ups', () => {
    const src = strip(read('lib/outreach/callTracking.ts'));
    const occurrences = src.match(/statusCallback: statusCallbackFor\(opts\.voiceUrl\)/g) ?? [];
    expect(occurrences.length).toBe(2);
    expect((src.match(/statusCallbackMethod: 'POST'/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('the status route verifies the Twilio signature and applies the pure decision', () => {
    const src = strip(read('app/api/twilio/geo/[campaignId]/status/route.ts'));
    expect(src).toMatch(/verifyTwilioWebhook\(req\)/);
    expect(src).toMatch(/if \(!v\.ok\) return rejectedTwiml\(\)/);
    expect(src).toMatch(/parentEndWrite\(/);
    // Only ever an UPDATE keyed on call_sid — never an upsert that could mint a row for a call
    // the entry route refused.
    expect(src).not.toMatch(/\.upsert\(/);
  });

  it('the backfill route is admin-gated and idempotent by construction', () => {
    const src = strip(read('app/api/admin/prospects/geo-campaign/sync-status-callbacks/route.ts'));
    expect(src).toMatch(/requireAdmin\(\)/);
    expect(src).toMatch(/syncNumberStatusCallback\(/);
    const lib = strip(read('lib/outreach/callTracking.ts'));
    expect(lib).toMatch(/if \(previous !== statusCallback\)/);
  });
});
