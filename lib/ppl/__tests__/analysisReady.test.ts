// The per-call read must wait for the call to be OVER. A 259 s customer call was read at 90 s,
// while still ringing, and filed unknown/low for good (vashon-plumbing.com, 2026-10-17).
import fs from 'node:fs';
import path from 'node:path';
import { analysisReady, ANALYSIS_STALE_AFTER_MS } from '@/lib/ppl/callAnalysis';

const now = Date.parse('2026-10-17T21:20:00Z');
const row = (call_status: string | null, agoMs: number, recording_url: string | null = null) => ({ call_status, recording_url, created_at: new Date(now - agoMs).toISOString() });

it('a call still ringing is not ready, however settled the clock says it is', () => {
  expect(analysisReady(row('ringing', 100_000), now)).toBe(false);
  expect(analysisReady(row('in-progress', 100_000), now)).toBe(false);
  expect(analysisReady(row(null, 100_000), now)).toBe(false);
});
it('an outcome, a parent end, or a voicemail makes it ready', () => {
  expect(analysisReady(row('dial-completed', 10_000), now)).toBe(true);
  expect(analysisReady(row('dial-no-answer', 10_000), now)).toBe(true);
  expect(analysisReady(row('abandoned', 10_000), now)).toBe(true);
  expect(analysisReady(row('ringing', 10_000, 'https://x/rec'), now)).toBe(true);
});
it('a row with no outcome for half an hour is read anyway — the missing outcome is the fact', () => {
  expect(analysisReady(row('ringing', ANALYSIS_STALE_AFTER_MS + 1), now)).toBe(true);
});
it('the cron applies it, and the taken-call text counts as "business texted"', () => {
  const cron = fs.readFileSync(path.join(process.cwd(), 'app/api/cron/call-alert/route.ts'), 'utf8');
  expect(cron).toMatch(/if \(!analysisReady\(row, Date\.now\(\)\)\) continue;/);
  expect(cron).toMatch(/connected_notify_result'/);
  const lib = fs.readFileSync(path.join(process.cwd(), 'lib/ppl/callAnalysis.ts'), 'utf8');
  expect(lib).toMatch(/row\.connected_notify_result as \{ business_sms\?: unknown \}/);
});
