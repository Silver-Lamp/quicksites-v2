// lib/ppl/__tests__/callAlert.test.ts

import fs from 'node:fs';
import path from 'node:path';
import {
  prettyPhone,
  outcomeLine,
  outcomeOf,
  handlingLabel,
  buildCallAlertEmail,
  type CallRow,
} from '@/lib/ppl/callAlert';
import { stripComments } from '@/test/stripComments';

const row = (over: Partial<CallRow> = {}): CallRow => ({
  id: 'r1',
  call_sid: 'CA1',
  from_number: '+12532225220',
  to_number: '+12536552016',
  forwarded_to: '+12534425373',
  call_status: 'dial-completed',
  call_duration: 15,
  handling: 'forward',
  custom_domain: 'southhilltowing.com',
  created_at: '2026-10-01T23:55:00.000Z',
  ...over,
});

describe('prettyPhone', () => {
  it('formats NANP numbers and passes anything else through', () => {
    expect(prettyPhone('+12532225220')).toBe('(253) 222-5220');
    expect(prettyPhone('2532225220')).toBe('(253) 222-5220');
    expect(prettyPhone('+442071838750')).toBe('+442071838750');
    expect(prettyPhone(null)).toBe('unknown');
  });
});

describe('outcomeOf', () => {
  it('uses classifyDial rather than the raw status', () => {
    expect(outcomeOf(row({ call_duration: 15 }))).toBe('connected');
    expect(outcomeOf(row({ call_duration: 3 }))).toBe('brief');
    expect(outcomeOf(row({ call_status: 'no-answer', call_duration: null }))).toBe('unanswered');
  });
});

describe('handlingLabel', () => {
  // ⚠️ Read from `handling`, never inferred from `forwarded_to IS NULL` — that is true of four
  // different populations, which is why the column exists (20260865).
  it('distinguishes voicemail-first from a forward', () => {
    expect(handlingLabel(row({ handling: 'voicemail_first', forwarded_to: null }))).toMatch(/voicemail/i);
    expect(handlingLabel(row())).toBe('Forwarded to (253) 442-5373');
  });

  it('says so when handling was never recorded, rather than guessing', () => {
    expect(handlingLabel(row({ handling: null, forwarded_to: null }))).toBe('Handling not recorded');
  });
});

describe('outcomeLine', () => {
  // ⚠️ A voicemail-first call NEVER DIALS, so its status stays `ringing` and classifyDial
  // honestly says `in_progress` — which rendered as "Still in progress when we looked" on a
  // call from the previous day, contradicting the "Sent to voicemail" line beneath it. Found by
  // rendering the email against real rows; every unit case here had used a forwarded call.
  it('is null when there was no dial to describe', () => {
    expect(outcomeLine(row({ handling: 'voicemail_first', forwarded_to: null, call_status: 'ringing' })))
      .toBeNull();
  });

  it('describes a real forward', () => {
    expect(outcomeLine(row())).toBe('Line open 15s or longer · 15s');
  });
});

describe('buildCallAlertEmail', () => {
  it('omits the outcome row entirely for a voicemail-first call', () => {
    const { text } = buildCallAlertEmail(
      [row({ handling: 'voicemail_first', forwarded_to: null, call_status: 'ringing' })],
      'https://x',
    );
    expect(text).not.toMatch(/in progress/i);
    expect(text).toMatch(/Sent to voicemail/);
  });

  it('names the caller and the site in the subject for a single call', () => {
    const { subject } = buildCallAlertEmail([row()], 'https://www.quicksites.ai');
    expect(subject).toContain('(253) 222-5220');
    expect(subject).toContain('southhilltowing.com');
  });

  it('batches several calls into one email', () => {
    const { subject, html } = buildCallAlertEmail(
      [row(), row({ id: 'r2', from_number: '+12065550100' })],
      'https://www.quicksites.ai',
    );
    expect(subject).toMatch(/^2 calls/);
    expect(html).toContain('(206) 555-0100');
  });

  // ⚠️ THE HONESTY LINE. "Connected" is a duration fact, not a claim that a person picked up —
  // a voicemail the caller talked to is indistinguishable from here, and this repo spent a
  // morning on exactly that confusion. The email must never say "answered".
  it('never claims a human answered', () => {
    // ⚠️ The assertion is about the OUTCOME WORDING, not the word "answered" anywhere: the
    // disclaimer necessarily contains it ("does not mean a person answered"). A blanket ban
    // made this test contradict its own last line — the loose version of a rule can forbid the
    // very sentence that enforces it.
    const outcomes = (['connected', 'brief', 'unanswered', 'in_progress'] as const).map((o) => {
      const dur = o === 'connected' ? 20 : o === 'brief' ? 3 : null;
      const status = o === 'unanswered' ? 'no-answer' : o === 'in_progress' ? 'ringing' : 'completed';
      return buildCallAlertEmail([row({ call_status: status, call_duration: dur })], 'https://x').text;
    });
    for (const t of outcomes) {
      const body = t.toLowerCase();
      expect(body).not.toMatch(/\b(someone|a person|they|customer) answered\b/);
      expect(body).not.toMatch(/\banswered the call\b/);
      expect(body).not.toContain('picked up by a person');
    }
    // And the caveat is present, in as many words.
    expect(buildCallAlertEmail([row()], 'https://x').html)
      .toMatch(/does not mean a person\s+answered/i);
  });

  it('links to the call log', () => {
    const { html } = buildCallAlertEmail([row()], 'https://www.quicksites.ai');
    expect(html).toContain('https://www.quicksites.ai/admin/call-logs');
  });

  it('escapes values rather than interpolating them into HTML raw', () => {
    const { html } = buildCallAlertEmail(
      [row({ custom_domain: '<script>alert(1)</script>' })],
      'https://x',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('the cron (source)', () => {
  const src = stripComments(
    fs.readFileSync(path.resolve(__dirname, '../../../app/api/cron/call-alert/route.ts'), 'utf8'),
  );

  // ⚠️ Marking before the send turns one transient Resend failure into a lead nobody hears
  // about — the exact outcome this cron exists to prevent.
  it('marks alerted_at only after sendEmail resolves', () => {
    const send = src.indexOf('await sendEmail(');
    const mark = src.indexOf("alerted_at: new Date()");
    expect(send).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(send);
  });

  it('filters on alerted_at IS NULL and a lookback window', () => {
    // Both guards matter: without the window, the first run emails the entire call history,
    // because alerted_at was deliberately not backfilled.
    expect(src).toContain(".is('alerted_at', null)");
    expect(src).toContain("gte('created_at', notOlderThan)");
  });

  it('waits for the call to settle before reporting an outcome', () => {
    expect(src).toContain("lt('created_at', settledBefore)");
  });

  it('is authorised like every other cron', () => {
    expect(src).toContain('isCronAuthorized(req)');
  });
});
