// lib/ppl/__tests__/outcomeSurvey.test.ts
//
// The did-it-become-a-job text: asked of the business only, after a call it took that ran at
// least the billable floor, on the trade's clock, once; the copy says it changes nothing on the
// bill and carries no IVR-forbidden claim; replies parse to exactly three answers.
import fs from 'node:fs';
import path from 'node:path';
import { outcomeSurveyDecision, outcomeSurveySmsText, parseOutcomeReply, outcomeStats, outcomeSentence, outcomeDelayHours, OUTCOME_DELAY_DEFAULT_HOURS, type OutcomeSurveyRow } from '@/lib/ppl/outcomeSurvey';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';

const ROOT = path.resolve(__dirname, '../../..');
const T0 = Date.parse('2026-10-17T21:53:00Z');
const row = (p: Partial<OutcomeSurveyRow> = {}): OutcomeSurveyRow => ({
  handling: 'forward', call_status: 'completed', call_duration: 259, forwarded_to: '+12068170891', from_number: '+12533451344',
  created_at: new Date(T0).toISOString(), outcome_survey_sent_at: null, read: 'customer', ...p,
});

describe('decision', () => {
  it('waits the trade\'s delay, then sends once', () => {
    const d1 = outcomeSurveyDecision(row(), { industry: 'plumbing', nowMs: T0 + 2 * 3_600_000 });
    expect(d1).toEqual({ send: false, reason: 'wait', dueAt: new Date(T0 + OUTCOME_DELAY_DEFAULT_HOURS * 3_600_000).toISOString() });
    expect(outcomeSurveyDecision(row(), { industry: 'plumbing', nowMs: T0 + 8 * 24 * 3_600_000 })).toEqual({ send: true, to: '+12068170891' });
    expect(outcomeSurveyDecision(row({ outcome_survey_sent_at: '2026-10-25T00:00:00Z' }), { industry: 'plumbing', nowMs: T0 + 9 * 24 * 3_600_000 })).toEqual({ send: false, reason: 'already_asked' });
  });
  it('a tow is asked after a day, a plumber after a week', () => {
    expect(outcomeDelayHours('towing')).toBe(24);
    expect(outcomeDelayHours('plumbing')).toBe(7 * 24);
    expect(outcomeSurveyDecision(row(), { industry: 'towing', nowMs: T0 + 25 * 3_600_000 }).send).toBe(true);
  });
  it('asks only about a call the business TOOK for at least the floor — never a ring-out, a short one, junk, or itself', () => {
    const later = T0 + 8 * 24 * 3_600_000;
    expect(outcomeSurveyDecision(row({ call_status: 'no-answer', call_duration: null }), { industry: 'plumbing', nowMs: later })).toEqual({ send: false, reason: 'not_taken' });
    expect(outcomeSurveyDecision(row({ call_duration: 45 }), { industry: 'plumbing', nowMs: later })).toEqual({ send: false, reason: 'under_floor' });
    expect(outcomeSurveyDecision(row({ read: 'vendor_or_sales' }), { industry: 'plumbing', nowMs: later })).toEqual({ send: false, reason: 'junk_read' });
    expect(outcomeSurveyDecision(row({ from_number: '+12068170891' }), { industry: 'plumbing', nowMs: later })).toEqual({ send: false, reason: 'own_business' });
    expect(outcomeSurveyDecision(row({ handling: 'screened' }), { industry: 'plumbing', nowMs: later })).toEqual({ send: false, reason: 'not_a_forward' });
    expect(outcomeSurveyDecision(row(), { industry: 'plumbing', nowMs: T0 + 40 * 24 * 3_600_000 })).toEqual({ send: false, reason: 'too_old' });
  });
});

describe('the text', () => {
  const text = outcomeSurveySmsText({ domain: 'vashon-plumbing.com', callerPhone: '+12533451344', at: new Date(T0).toISOString() });
  it('says it is for the record, names the call, offers three replies and STOP', () => {
    expect(text).toContain('for our records only');
    expect(text).toContain('changes nothing on your bill');
    expect(text).toContain('(253) 345-1344');
    expect(text).toMatch(/Saturday/);
    expect(text).toContain('Reply Y, N or NOT YET');
    expect(text).toContain('STOP');
    expect(text.length).toBeLessThan(320);
  });
  it.each(FORBIDDEN_IVR_PHRASES)('never says "%s"', (w) => {
    expect(text.toLowerCase()).not.toContain(w.toLowerCase());
  });
});

describe('replies', () => {
  it('parses the three answers and nothing else', () => {
    expect(parseOutcomeReply('Y')).toBe('job');
    expect(parseOutcomeReply(' yes! ')).toBe('job');
    expect(parseOutcomeReply('Booked')).toBe('job');
    expect(parseOutcomeReply('n')).toBe('no_job');
    expect(parseOutcomeReply('No job')).toBe('no_job');
    expect(parseOutcomeReply('not yet')).toBe('not_yet');
    expect(parseOutcomeReply('NOTYET')).toBe('not_yet');
    expect(parseOutcomeReply('who is this')).toBeNull();
    expect(parseOutcomeReply('')).toBeNull();
    expect(parseOutcomeReply('STOP')).toBeNull();
  });
  it('tallies and says only what they told us', () => {
    const s = outcomeStats([
      { outcome_survey_sent_at: 'x', outcome_reported: 'job' },
      { outcome_survey_sent_at: 'x', outcome_reported: 'no_job' },
      { outcome_survey_sent_at: 'x', outcome_reported: null },
      { outcome_survey_sent_at: null, outcome_reported: null },
    ]);
    expect(s).toEqual({ asked: 3, answered: 2, jobs: 1, noJobs: 1, notYet: 0 });
    expect(outcomeSentence(s)).toBe('You told us: of 2 calls asked about, 1 became a job, 1 did not.');
    expect(outcomeSentence({ asked: 0, answered: 0, jobs: 0, noJobs: 0, notYet: 0 })).toBeNull();
    expect(outcomeSentence({ asked: 2, answered: 0, jobs: 0, noJobs: 0, notYet: 0 })).toBe('We asked about 2 calls; no answer yet.');
  });
});

describe('source guards', () => {
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  it('the cron claims the row BEFORE sending, and never texts the caller', () => {
    const src = read('app/api/cron/ppl-outcome-survey/route.ts');
    expect(src.indexOf("update({ outcome_survey_sent_at")).toBeLessThan(src.indexOf('sendSms(d.to'));
    expect(src).not.toMatch(/sendSms\([^)]*from_number/);
    expect(src).toMatch(/isOptedOut\(/);
    expect(src).toMatch(/outcomeSurveyEnabled\(\)/);
  });
  it('the inbound route records a reply only against a call we asked about', () => {
    expect(read('lib/ppl/outcomeSurveyDb.ts')).toMatch(/\.not\('outcome_survey_sent_at', 'is', null\)/);
    expect(read('app/api/twilio/sms/inbound/route.ts')).toMatch(/parseOutcomeReply\(/);
  });
  it('the flag is declared and gated', () => {
    expect(read('.env.example')).toMatch(/PPL_OUTCOME_SURVEY_ENABLED/);
    expect(read('lib/config/health.ts')).toMatch(/enabledBy: 'PPL_OUTCOME_SURVEY_ENABLED'/);
    expect(read('vercel.json')).toMatch(/ppl-outcome-survey/);
  });
});
