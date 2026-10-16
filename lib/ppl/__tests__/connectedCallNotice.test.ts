// lib/ppl/__tests__/connectedCallNotice.test.ts — after a taken call, the business gets the number.
import fs from 'node:fs';
import path from 'node:path';
import { connectedCallDecision, connectedCallSmsText } from '@/lib/ppl/connectedCallNotice';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const base = { handling: 'forward', call_status: 'dial-completed', call_duration: 30, forwarded_to: '+12532170639', from_number: '+12533451344', connected_notified_at: null };

describe('connectedCallDecision', () => {
  it('texts the destination after a connected call (the 2:53 pm renton-towing call)', () => {
    expect(connectedCallDecision(base)).toEqual({ send: true, to: '+12532170639' });
  });
  it('a brief exchange still gets the number', () => {
    expect(connectedCallDecision({ ...base, call_duration: 5 })).toEqual({ send: true, to: '+12532170639' });
  });
  it('a ring-out is the missed-call text\'s job; a business ringing itself gets nothing here', () => {
    expect(connectedCallDecision({ ...base, call_status: 'dial-no-answer', call_duration: null })).toEqual({ send: false, reason: 'not_taken' });
    expect(connectedCallDecision({ ...base, from_number: '+12532170639' })).toEqual({ send: false, reason: 'own_business' });
  });
  it('once per call; forwards only; needs a caller and a destination', () => {
    expect(connectedCallDecision({ ...base, connected_notified_at: '2026-10-16T22:00:00Z' })).toEqual({ send: false, reason: 'already_notified' });
    expect(connectedCallDecision({ ...base, handling: 'screened' })).toEqual({ send: false, reason: 'not_a_forward' });
    expect(connectedCallDecision({ ...base, forwarded_to: null })).toEqual({ send: false, reason: 'no_destination' });
    expect(connectedCallDecision({ ...base, from_number: 'anonymous' })).toEqual({ send: false, reason: 'no_caller' });
    expect(connectedCallDecision(null)).toEqual({ send: false, reason: 'no_row' });
  });
});

describe('connectedCallSmsText', () => {
  it('names the site, the number in display form, the time and length; explains why their phone shows our number', () => {
    const t = connectedCallSmsText({ domain: 'renton-towing.com', callerPhone: '+12533451344', durationSeconds: 30, at: '2026-10-16T21:53:33Z' });
    expect(t).toBe('renton-towing.com: the call you just took (2:53 PM, 30 s) came from (253) 345-1344. Call them back on that number — your phone shows our forwarding line instead.');
    expect(t).not.toMatch(/lead/i);
  });
});

describe('the wiring (source guards)', () => {
  it('the after-dial route decides from the re-read row, claims before sending, honours STOP, and runs it in after()', () => {
    const src = read('app/api/twilio/geo/[campaignId]/after-dial/route.ts');
    expect(src).toMatch(/after\(\(\) => notifyConnectedCall\(/);
    expect(src).toMatch(/connectedCallDecision\(row\)/);
    expect(src).toMatch(/\.update\(\{ connected_notified_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*\.is\('connected_notified_at', null\)/);
    expect(src).toMatch(/isOptedOut\(decision\.to\)/);
    expect(src).toMatch(/connected_notify_result/);
  });
  it('the migration adds both columns idempotently', () => {
    const sql = read('supabase/migrations/20260892_call_logs_connected_notice.sql');
    expect(sql).toMatch(/add column if not exists connected_notified_at timestamptz/);
    expect(sql).toMatch(/add column if not exists connected_notify_result jsonb/);
  });
});
