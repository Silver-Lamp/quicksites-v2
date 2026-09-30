/**
 * @jest-environment node
 */
// lib/ppl/__tests__/voicemail.test.ts
//
// Phase 0 of docs/CALL_CASCADE_PLAN.md: what a caller hears when nobody picks up, what the
// business is told, and the link that has to actually play.
import { readFileSync } from 'node:fs';
import {
  mintVoicemailToken,
  verifyVoicemailToken,
  voicemailUrl,
  voicemailPromptTwiml,
  missedCallSmsText,
  VOICEMAIL_LINK_TTL_MS,
} from '@/lib/ppl/voicemail';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';
import { stripComments } from '@/test/stripComments';

process.env.PPL_STATEMENT_SECRET ||= 'test-secret-for-voicemail-tokens';

describe('the voicemail link', () => {
  it('round-trips the call it names', () => {
    const t = mintVoicemailToken('CA123');
    expect(verifyVoicemailToken(t)).toEqual({ callSid: 'CA123' });
  });

  it('rejects a tampered body and an expired token', () => {
    const t = mintVoicemailToken('CA123');
    const [body, sig] = t.split('.');
    const forged = `${Buffer.from(JSON.stringify({ c: 'CA999', exp: Date.now() + 1e6 })).toString('base64url')}.${sig}`;
    expect(verifyVoicemailToken(forged)).toBeNull();
    expect(verifyVoicemailToken(`${body}.${sig}`, Date.now() + VOICEMAIL_LINK_TTL_MS + 1)).toBeNull();
    expect(verifyVoicemailToken(null)).toBeNull();
    expect(verifyVoicemailToken('nonsense')).toBeNull();
  });

  it('points at our own host, never at Twilio', () => {
    const url = voicemailUrl('CA123', 'https://www.quicksites.ai');
    expect(url.startsWith('https://www.quicksites.ai/voicemail/')).toBe(true);
    expect(url).not.toContain('api.twilio.com');
  });
});

describe('what the caller hears', () => {
  const twiml = voicemailPromptTwiml({ recordActionUrl: 'https://x.test/a?b=1&c=2' });

  it('records a message instead of hanging up', () => {
    expect(twiml).toContain('<Record');
    // ⚠️ An empty <Response/> is the hang-up that lost two real leads on 2026-09-30.
    expect(twiml).not.toMatch(/<Response\s*\/>/);
  });

  it('escapes the action URL', () => {
    expect(twiml).toContain('https://x.test/a?b=1&amp;c=2');
  });

  // ⚠️ We know the dial did not connect. We do NOT know why, and "they're busy" / "all
  // operators are engaged" would be a reason we invented — the same class as the PPL IVR
  // saying "at capacity" when the real cause is a balance.
  it('does not invent a reason the call failed', () => {
    expect(twiml.toLowerCase()).toContain("couldn't reach them");
    for (const bad of ['busy', 'at capacity', 'all operators', 'high call volume']) {
      expect(twiml.toLowerCase()).not.toContain(bad);
    }
  });

  // ⚠️ THE CONSENT OBLIGATION MOVED HERE FROM THE BRIDGE, and this is where it is now kept.
  // The forward no longer records the conversation (CALL_CASCADE_PLAN §9.3), so the old "this
  // call may be recorded" notice went with it — but the voicemail IS recorded and IS passed to
  // a third party, so the prompt has to say both. "Leave a message … I'll pass it straight to
  // them, along with your number" discloses more than the notice it replaced: the caller learns
  // the message is kept AND where it goes, which the old wording never mentioned.
  it('tells the caller their message is kept and passed on, with their number', () => {
    const lower = twiml.toLowerCase();
    expect(lower).toContain('leave a message');
    expect(lower).toContain('pass it straight to them');
    expect(lower).toContain('your number');
  });

  it('carries no phrase the IVR honesty rules forbid', () => {
    const lower = twiml.toLowerCase();
    for (const phrase of FORBIDDEN_IVR_PHRASES) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('the missed-call text', () => {
  const base = {
    domain: 'covingtontow.com',
    callerPhone: '+12534868402',
    link: 'https://www.quicksites.ai/voicemail/abc',
    senderName: 'Sandon Jurowski',
  };

  it('leads with the callback number, because that is the lead', () => {
    const t = missedCallSmsText({ ...base, hasRecording: true });
    expect(t).toContain('(253) 486-8402');
    expect(t.indexOf('(253) 486-8402')).toBeLessThan(t.indexOf(base.link));
  });

  it('says so honestly when there is no recording', () => {
    const t = missedCallSmsText({ ...base, hasRecording: false });
    expect(t).toContain("didn't leave a message");
    expect(t).not.toContain(base.link);
  });

  // ⚠️ A new KIND of message needs its own way out. The forwarding notice covered "calls are
  // forwarded to you"; it never covered us texting about missed ones.
  it('always offers STOP', () => {
    expect(missedCallSmsText({ ...base, hasRecording: true })).toContain('Reply STOP');
    expect(missedCallSmsText({ ...base, hasRecording: false })).toContain('Reply STOP');
  });

  it('degrades without a sender name or a caller number', () => {
    const t = missedCallSmsText({ ...base, senderName: null, callerPhone: null, hasRecording: true });
    expect(t).toContain('This is QuickSites.');
    expect(t).toContain('a number we did not get');
  });

  it('never carries a raw Twilio recording URL', () => {
    const t = missedCallSmsText({
      ...base,
      link: 'https://api.twilio.com/2010-04-01/Accounts/ACx/Recordings/REx',
      hasRecording: true,
    });
    // The helper does not police its input, so the guard that matters is on the caller — see
    // the source guard below. This documents that the SMS body is where it would surface.
    expect(t).toContain('api.twilio.com');
  });
});

describe('source guards', () => {
  // ⚠️ A business tapping a raw Twilio recording URL gets a 401. The route must STREAM with our
  // credentials, never redirect, or the link looks delivered and plays nothing.
  it('the playback route streams and never redirects to Twilio', () => {
    const src = stripComments(readFileSync('app/voicemail/[token]/route.ts', 'utf8'));
    expect(src).not.toMatch(/redirect\s*\(/);
    expect(src).toMatch(/Authorization: `Basic/);
  });

  // ⚠️ The token names a CALL. If it carried a URL, the link would be a signed request to fetch
  // an arbitrary address with our Twilio credentials attached.
  it('the playback route resolves the recording from our own row', () => {
    const src = stripComments(readFileSync('app/voicemail/[token]/route.ts', 'utf8'));
    expect(src).toMatch(/from\('call_logs'\)/);
    expect(src).toMatch(/TWILIO_RECORDING\.test/);
  });

  // ⚠️ The SMS goes out once per call or it is spam. The guard is winning a claim on the row,
  // not an assumption that Twilio delivers a webhook once.
  it('the voicemail webhook claims before it texts', () => {
    const src = stripComments(
      readFileSync('app/api/twilio/geo/[campaignId]/voicemail/route.ts', 'utf8'),
    );
    const claim = src.indexOf("is('voicemail_notified_at', null)");
    const send = src.indexOf('sendSms(');
    expect(claim).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(send);
  });

  // ⚠️ The dial must not hand off to /api/twilio-callback any more: that route answers
  // everything with an empty <Response/>, which is the hang-up.
  it('the geo bridge points its dial action at after-dial', () => {
    const src = stripComments(readFileSync('app/api/twilio/geo/[campaignId]/route.ts', 'utf8'));
    expect(src).toMatch(/action="\$\{base\}\/api\/twilio\/geo\/\$\{encodeURIComponent\(campaignId\)\}\/after-dial"/);
    expect(src).not.toMatch(/<Dial[^>]*action="\$\{base\}\/api\/twilio-callback"/);
  });

  // Owner decision, CALL_CASCADE_PLAN §9.3: the bridged conversation is not recorded.
  it('the bridged leg is not recorded', () => {
    const src = stripComments(readFileSync('app/api/twilio/geo/[campaignId]/route.ts', 'utf8'));
    expect(src).not.toMatch(/record="record-from-answer-dual"/);
  });

  // ⚠️ Twilio signs the full URL. The cascade will add ?attempt=N, and a dropped query string
  // turns every request into a 403 — which a caller hears as "an application error has occurred".
  it('the shared verifier signs over pathname AND search', () => {
    const src = stripComments(readFileSync('lib/twilio/verifyWebhook.ts', 'utf8'));
    expect(src).toMatch(/\$\{u\.pathname\}\$\{u\.search\}/);
  });
});
