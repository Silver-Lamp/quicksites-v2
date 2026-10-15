/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { vendorVoicemailMatch, shouldAutoScreen, screenKey, screenPromptTwiml, SCREEN_PROMPT } from '@/lib/ppl/callerScreen';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

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
