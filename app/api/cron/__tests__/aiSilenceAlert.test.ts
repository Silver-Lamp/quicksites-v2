/**
 * @jest-environment node
 *
 * ⚠️ WE ALARMED WHEN AI COST TOO MUCH AND NEVER WHEN IT STOPPED WORKING.
 *
 * `ai-cost-alert` fired on spend crossing a ceiling. AI spending exactly $0.00 was, to it, a
 * quiet day. Found 2026-09-26: the last successful call in `ai_usage_events` was 2026-09-18 —
 * eight days of zero after a steady 6–47/day, with this cron running 96 times a day throughout
 * and saying nothing. The first anyone knew was a person clicking "Suggest" and getting a 500.
 *
 * `/status` read `ai: ready` the entire time, because the gate checks the key is PRESENT, not
 * that it WORKS — the same distinction that hid PostHog for the life of that feature.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));
const CRON = read('app/api/cron/ai-cost-alert/route.ts');
const HEALTH = read('lib/config/health.ts');

describe('the silence floor', () => {
  it('reads a real file', () => {
    expect(CRON.length).toBeGreaterThan(2000);
  });

  it('alerts when there have been NO calls, not only when spend is high', () => {
    expect(CRON).toMatch(/AI_ALERT_SILENCE_HOURS/);
    expect(CRON).toMatch(/NO AI CALLS/);
  });

  it('still alerts on the ceiling — the floor is additional, not a replacement', () => {
    expect(CRON).toMatch(/AI_ALERT_HOURLY_USD/);
    expect(CRON).toMatch(/AI_ALERT_DAILY_USD/);
  });

  it('names when AI last worked, so the mail is actionable at 3am', () => {
    expect(CRON).toMatch(/last successful call/);
  });

  it('says a different subject when it is silence rather than overspend', () => {
    // "AI spend alert" on an email about AI being DOWN would read as the opposite problem.
    expect(CRON).toMatch(/appears to be DOWN/);
  });
});

describe('⚠️ the config gate stays a presence check, on purpose', () => {
  it('does not probe the API from /status', () => {
    // A public endpoint calling a paid API on every request is a cost and DoS amplifier — the
    // rule at the top of health.ts. The detector belongs on a cron, and now is one.
    expect(HEALTH).not.toMatch(/openai\.com/);
    expect(HEALTH).toMatch(/requires: \['OPENAI_API_KEY'\]/);
  });

  it('warns in `breaks` that a revoked key still reads ready', () => {
    expect(HEALTH).toMatch(/only checks the key is SET/);
  });
});

// ⚠️ THE ALERT HAS TO REACH A HUMAN, AND IT DID NOT.
//
// Straight after shipping the AI-outage alert: ADMIN_EMAILS is unset in production, and TEN call
// sites read it to reach a person — lead disputes, domain watch, showcase link health,
// design-partner nudges, order notifications, and this watchdog. Each composes an email, finds no
// recipient, and returns quietly. An alerter with nowhere to send is worse than none, because it
// is believed.
describe('⚠️ the alert channel is itself gated', () => {
  it('ADMIN_EMAILS has a config gate, so /status reports an alerter with no recipient', () => {
    expect(HEALTH).toMatch(/key: 'admin_alerts'/);
    expect(HEALTH).toMatch(/requires: \['ADMIN_EMAILS'\]/);
  });

  it("the gate's breaks text names what actually goes nowhere", () => {
    // "Misconfigured" is not actionable at 3am; the list of dead alerts is.
    expect(HEALTH).toMatch(/sends it to nobody/);
    expect(HEALTH).toMatch(/Sentry still gets them/);
  });

  it('the cron still degrades rather than throwing when there is no recipient', () => {
    // It must not start failing the job — Sentry is a real, if quieter, destination.
    expect(CRON).toMatch(/if \(admins\.length\)/);
  });
});
