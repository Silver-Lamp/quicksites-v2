/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  vendorVoicemailMatch,
  shouldAutoScreen,
  screenKey,
  screenPromptTwiml,
  SCREEN_PROMPT,
  rejectTwiml,
  repeatPatternDecision,
  REPEAT_MIN_CALLS,
  REPEAT_CONNECTED_SECONDS,
  type PriorCall,
} from '@/lib/ppl/callerScreen';
import { missedCallDecision } from '@/lib/ppl/missedCallNotice';
import { parentEndWrite } from '@/lib/ppl/parentCallEnd';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const NOW = Date.parse('2026-10-21T19:00:00Z');
const short = (daysAgo: number, to: string, over: Partial<PriorCall> = {}): PriorCall => ({
  to_number: to,
  call_status: 'abandoned',
  call_duration: 4,
  handling: 'forward',
  recording_url: null,
  voicemail_speech: null,
  created_at: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  ...over,
});

describe('repeatPatternDecision — our own records prove a dialer, never the AI read', () => {
  it('blocks +12067102328\'s shape: many sub-5-second abandoned calls across two lines, no message', () => {
    const prior = [short(9, '+1A'), short(7, '+1B'), short(3, '+1A'), short(0.2, '+1B'), short(0.1, '+1A'), short(0.05, '+1A')];
    const v = repeatPatternDecision(prior, NOW);
    expect(v.block).toBe(true);
    if (v.block) expect(v.evidence).toMatch(/6 calls to 2 of our lines/);
  });
  it('a business rung five times on ONE line is a customer trying, not a dialer', () => {
    const prior = Array.from({ length: REPEAT_MIN_CALLS + 1 }, (_, i) => short(i, '+1A'));
    expect(repeatPatternDecision(prior, NOW)).toEqual({ block: false, reason: 'one_line' });
  });
  it('one connected call disqualifies the pattern', () => {
    const prior = [short(5, '+1A'), short(4, '+1B'), short(3, '+1A'), short(2, '+1B'), short(1, '+1A', { call_status: 'dial-completed', call_duration: REPEAT_CONNECTED_SECONDS + 30 })];
    expect(repeatPatternDecision(prior, NOW)).toEqual({ block: false, reason: 'a_call_connected' });
  });
  it('one spoken voicemail disqualifies the pattern; a no-speech recording (fax tone) does not', () => {
    const base = [short(5, '+1A'), short(4, '+1B'), short(3, '+1A'), short(2, '+1B')];
    expect(repeatPatternDecision([...base, short(1, '+1A', { recording_url: 'https://r', voicemail_speech: 'speech' })], NOW)).toEqual({ block: false, reason: 'a_message_was_left' });
    expect(repeatPatternDecision([...base, short(1, '+1A', { recording_url: 'https://r', voicemail_speech: 'no_speech' })], NOW).block).toBe(true);
    // An un-transcribed recording is unknown, not "no speech": never block on it.
    expect(repeatPatternDecision([...base, short(1, '+1A', { recording_url: 'https://r', voicemail_speech: null })], NOW)).toEqual({ block: false, reason: 'a_message_was_left' });
  });
  it('too few calls in the window, and calls outside it do not count', () => {
    expect(repeatPatternDecision([short(1, '+1A'), short(2, '+1B'), short(3, '+1A'), short(4, '+1B')], NOW)).toEqual({ block: false, reason: 'too_few_calls' });
    expect(repeatPatternDecision([short(1, '+1A'), short(2, '+1B'), short(3, '+1A'), short(4, '+1B'), short(40, '+1A')], NOW)).toEqual({ block: false, reason: 'too_few_calls' });
  });
  it('calls we already blocked are not evidence (they prove only that we blocked them)', () => {
    const prior = [short(5, '+1A'), short(4, '+1B'), short(3, '+1A'), short(2, '+1B'), short(1, '+1A', { handling: 'blocked' })];
    expect(repeatPatternDecision(prior, NOW)).toEqual({ block: false, reason: 'too_few_calls' });
  });
});

describe('a blocked call touches nothing downstream', () => {
  it('rejects unanswered: no Say, no Record', () => {
    const x = rejectTwiml();
    expect(x).toContain('<Reject');
    expect(x).not.toMatch(/<Say|<Record|<Dial/);
  });
  it('the missed-call text never fires for a blocked row', () => {
    const row = { handling: 'blocked', call_status: 'ended', call_duration: 0, forwarded_to: null, recording_url: null, voicemail_notified_at: null, missed_call_notified_at: null };
    expect(missedCallDecision(row, { status: 'completed' })).toEqual({ send: false, reason: 'not_a_forward' });
  });
  it('the parent end is `ended`, never `abandoned` — nobody was offered a bridge', () => {
    expect(parentEndWrite({ call_status: 'ringing', handling: 'blocked' }, { status: 'busy', durationSec: 0 })?.call_status).toBe('ended');
    expect(parentEndWrite({ call_status: 'ringing', handling: 'screened' }, { status: 'completed', durationSec: 20 })?.call_status).toBe('ended');
  });
  it('the entry route rejects a block BEFORE the PPL gate and runs the repeat check; the alert cron never emails or analyses a blocked row', () => {
    const route = read('app/api/twilio/geo/[campaignId]/route.ts');
    const blockAt = route.indexOf("screen.mode === 'block'");
    const pplAt = route.indexOf('pplEnabled(');
    expect(blockAt).toBeGreaterThan(0);
    expect(pplAt).toBeGreaterThan(blockAt);
    expect(route).toMatch(/blockIfRepeatPattern\(/);
    const cron = read('app/api/cron/call-alert/route.ts');
    expect(cron.match(/handling\.is\.null,handling\.neq\.blocked/g)?.length).toBe(2);
    expect(cron).toMatch(/\.eq\('handling', 'blocked'\)[\s\S]*?\.is\('alerted_at', null\)/);
  });
});

describe('vendorVoicemailMatch — the vendor must name itself in the caller\'s own words', () => {
  it('matches the two Angi voicemails we actually received', () => {
    expect(vendorVoicemailMatch('Hi, this is Marlena over at Angie. Please give me a call 303-963-7254. Thank you.')?.vendor).toBe('Angi');
    expect(vendorVoicemailMatch("Hi there. This is Heidi giving you a call from Angie on a recorded line. I am actually looking for a qualified contractor in your area")?.vendor).toBe('Angi');
    expect(vendorVoicemailMatch("calling from Angie's List about leads in your area")?.vendor).toBe('Angi');
  });
  it('a customer named Angie is NOT a vendor', () => {
    expect(vendorVoicemailMatch('Hi, this is Angie, my sink is leaking, can you call me back at 206-555-0100')).toBeNull();
    expect(vendorVoicemailMatch("It's Angie again, still no hot water")).toBeNull();
  });
  it('other lead-gen vendors', () => {
    expect(vendorVoicemailMatch('This is Tom with HomeAdvisor, we have homeowners in Vashon looking for')?.vendor).toBe('HomeAdvisor');
    expect(vendorVoicemailMatch('calling from Thumbtack about your profile')?.vendor).toBe('Thumbtack');
    expect(vendorVoicemailMatch('I need to verify your Google business listing before it is removed')?.vendor).toBe('Google listing sales');
    expect(vendorVoicemailMatch('my porch light is out, can someone come look')).toBeNull(); // "porch" alone is a porch
    expect(vendorVoicemailMatch('')).toBeNull();
    expect(vendorVoicemailMatch(null)).toBeNull();
  });
});

describe('shouldAutoScreen — the verdict alone never screens; the vendor name alone never screens', () => {
  const angi = 'Hi, this is Marlena over at Angie. Please give me a call.';
  it('needs not_lead AND a vendor match', () => {
    expect(shouldAutoScreen({ verdict: 'not_lead', transcript: angi })?.vendor).toBe('Angi');
    expect(shouldAutoScreen({ verdict: 'unclear', transcript: angi })).toBeNull();
    expect(shouldAutoScreen({ verdict: 'lead', transcript: angi })).toBeNull();
    expect(shouldAutoScreen({ verdict: 'not_lead', transcript: 'calling about your account' })).toBeNull();
    expect(shouldAutoScreen({ verdict: null, transcript: angi })).toBeNull();
  });
});

describe('screenKey', () => {
  it('normalises to E.164', () => {
    expect(screenKey('+1 (206) 555-0100')).toBe('+12065550100');
    expect(screenKey('2065550100')).toBe('+12065550100');
    expect(screenKey('+12065550100')).toBe('+12065550100');
    expect(screenKey('')).toBeNull();
    expect(screenKey('123')).toBeNull();
  });
});

describe('the screened caller\'s prompt', () => {
  it('says what the line does, keeps the customer path open, and records to the voicemail handler', () => {
    const x = screenPromptTwiml({ recordActionUrl: 'https://x/api/twilio/geo/abc/voicemail' });
    expect(x).toContain('<Record');
    expect(x).toContain('https://x/api/twilio/geo/abc/voicemail');
    expect(SCREEN_PROMPT).toMatch(/If you are a customer, leave a message/);
    expect(SCREEN_PROMPT).not.toMatch(/spam|scam|blocked|banned/i); // we screen, we do not accuse
  });
});

describe('the routes', () => {
  it('the entry route checks the screen FIRST, best-effort, and logs it as handling=screened', () => {
    const src = read('app/api/twilio/geo/[campaignId]/route.ts');
    const i = src.indexOf('activeScreen(searchParams.get(\'From\'))');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(src.indexOf("pricing_model === 'ppl'"));
    expect(i).toBeLessThan(src.indexOf("handling: 'forward'"));
    const block = src.slice(src.lastIndexOf('try {', i), src.indexOf('catch', i) + 60);
    expect(block).toMatch(/handling: 'screened'/);
    expect(block).toMatch(/screenPromptTwiml\(/);
    expect(src).toMatch(/activeScreen\(searchParams\.get\('From'\)\)[^]*?catch \{\s*\}/); // comments are stripped: an empty catch = fall through
  });
  it('the voicemail route auto-screens only through shouldAutoScreen, after the verdict', () => {
    const src = read('app/api/twilio/geo/[campaignId]/voicemail/route.ts');
    expect(src).toMatch(/shouldAutoScreen\(\{ verdict: verdict\?\.verdict \?\? null, transcript \}\)/);
    expect(src.indexOf('shouldAutoScreen(')).toBeGreaterThan(src.indexOf('judgeVoicemail('));
    expect(src).toMatch(/reason: 'vendor_voicemail'/);
  });
  it('the admin route is admin-gated and a screen is lifted, never deleted', () => {
    const src = read('app/api/admin/caller-screens/route.ts');
    expect((src.match(/requireAdmin\(\)/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/\.delete\(/);
    expect(read('lib/ppl/callerScreenDb.ts')).not.toMatch(/\.delete\(/);
  });
  it('the alert email names a screened call for what it is', () => {
    expect(read('lib/ppl/callAlert.ts')).toMatch(/case 'screened'/);
  });
});
