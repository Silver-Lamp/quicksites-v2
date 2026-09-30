/**
 * @jest-environment node
 */
// lib/ppl/__tests__/cascade.test.ts
//
// Phase 1 of docs/CALL_CASCADE_PLAN.md. The cascade's whole reason for existing is that Twilio
// counts a voicemail pickup as an answer, so most of these tests are about refusing to believe
// `DialCallStatus`.
import { readFileSync } from 'node:fs';
import {
  orderCascade,
  nextCascadeStep,
  isAccepted,
  cascadeGreetingTwiml,
  cascadeWhisperTwiml,
  cascadeExhaustedTwiml,
  CASCADE_MAX_ATTEMPTS,
  type CascadeCandidate,
} from '@/lib/ppl/cascade';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';
import { stripComments } from '@/test/stripComments';

const c = (over: Partial<CascadeCandidate> & { phone: string }): CascadeCandidate => ({
  prospectId: 'p',
  businessName: 'A Towing',
  answered: null,
  unanswered: null,
  ...over,
});

describe('orderCascade', () => {
  it('puts businesses that have answered us first and never-answered last', () => {
    const out = orderCascade([
      c({ phone: '+12530000003', businessName: 'Never', answered: 0, unanswered: 4 }),
      c({ phone: '+12530000001', businessName: 'Unknown' }),
      c({ phone: '+12530000002', businessName: 'Answers', answered: 3, unanswered: 1 }),
    ]);
    expect(out.map((x) => x.businessName)).toEqual(['Answers', 'Unknown', 'Never']);
  });

  // ⚠️ Unknown sits BETWEEN, deliberately. Last means a freshly-swept market never gets rung;
  // first means one lucky answer outranks a business with a real record. Most of any pool is
  // unknown at any moment.
  it('sorts unknown between known-good and known-bad', () => {
    const out = orderCascade([
      c({ phone: '+12530000001', businessName: 'Unknown' }),
      c({ phone: '+12530000002', businessName: 'Bad', answered: 0, unanswered: 9 }),
    ]);
    expect(out[0].businessName).toBe('Unknown');
  });

  it('is stable — the same pool always produces the same order', () => {
    const pool = [
      c({ phone: '+12530000002', businessName: 'Beta' }),
      c({ phone: '+12530000001', businessName: 'Alpha' }),
    ];
    expect(orderCascade(pool).map((x) => x.businessName)).toEqual(
      orderCascade([...pool].reverse()).map((x) => x.businessName),
    );
  });
});

describe('nextCascadeStep', () => {
  const pool = orderCascade([
    c({ phone: '+12530000001', businessName: 'One' }),
    c({ phone: '+12530000002', businessName: 'Two' }),
    c({ phone: '+12530000003', businessName: 'Three' }),
  ]);

  // Asserted against the ORDERED pool, not against hard-coded numbers. All three candidates are
  // unknown here, so they tie and fall to the stable name tiebreak — which sorts One, Three,
  // Two. Hard-coding "+…002" would have been asserting my own assumption about the ordering
  // rather than the walk, and it failed for exactly that reason on the first run.
  it('walks the ordered pool, one at a time', () => {
    const s1 = nextCascadeStep(pool, []);
    expect(s1).toMatchObject({ kind: 'ring', attempt: 1 });
    expect((s1 as { candidate: CascadeCandidate }).candidate.phone).toBe(pool[0].phone);

    const s2 = nextCascadeStep(pool, [{ phone: pool[0].phone, accepted: false }]);
    expect(s2).toMatchObject({ kind: 'ring', attempt: 2 });
    expect((s2 as { candidate: CascadeCandidate }).candidate.phone).toBe(pool[1].phone);
  });

  // ⚠️ One operator appears twice in the fleet's own data under two listings on one number.
  // Ringing the same phone twice burns two of five attempts while the caller holds.
  it('never rings the same phone twice, whatever format it was stored in', () => {
    const dupes = orderCascade([
      c({ phone: '+12530000001', businessName: 'One' }),
      c({ phone: '+12530000002', businessName: 'Two' }),
    ]);
    const step = nextCascadeStep(dupes, [{ phone: '(253) 000-0001', accepted: false }]);
    expect((step as { candidate: CascadeCandidate }).candidate.phone).toBe('+12530000002');
  });

  it('gives up at the cap rather than ringing forever', () => {
    const tried = Array.from({ length: CASCADE_MAX_ATTEMPTS }, (_, i) => ({
      phone: `+1253000000${i}`,
      accepted: false,
    }));
    expect(nextCascadeStep(pool, tried)).toEqual({
      kind: 'exhausted',
      tried: CASCADE_MAX_ATTEMPTS,
    });
  });

  it('is exhausted immediately on an empty market', () => {
    expect(nextCascadeStep([], [])).toEqual({ kind: 'exhausted', tried: 0 });
  });
});

describe('isAccepted', () => {
  it('is true only when a business actually pressed 1', () => {
    expect(isAccepted([{ phone: '+1', accepted: false }])).toBe(false);
    expect(isAccepted([{ phone: '+1', accepted: false }, { phone: '+2', accepted: true }])).toBe(true);
  });
});

describe('what people hear', () => {
  const greeting = cascadeGreetingTwiml({ trade: 'Towing', city: 'Covington', nextUrl: 'https://x/y?a=1&b=2' });
  const whisper = cascadeWhisperTwiml({
    trade: 'Towing',
    city: 'Covington',
    domain: 'covingtontow.com',
    acceptUrl: 'https://x/accept?attempt=1',
  });

  // ⚠️ The disclosure IS the product. Ringing several businesses behind a caller's back is done
  // TO them; saying so up front makes it a service they are choosing to wait for.
  it('tells the caller up front that several businesses will be rung', () => {
    expect(greeting).toMatch(/ring Towing companies in Covington until one picks up/i);
    expect(greeting).toMatch(/stay on the line/i);
  });

  it('escapes URLs into the TwiML', () => {
    expect(greeting).toContain('https://x/y?a=1&amp;b=2');
  });

  // ⚠️ These businesses have mostly never spoken to us.
  it('never claims the businesses are vetted, partnered or ours', () => {
    for (const s of [greeting, whisper]) {
      const lower = s.toLowerCase();
      for (const bad of ['our network', 'our partners', 'approved', 'vetted', 'trusted', 'certified']) {
        expect(lower).not.toContain(bad);
      }
      for (const phrase of FORBIDDEN_IVR_PHRASES) {
        expect(lower).not.toContain(phrase.toLowerCase());
      }
    }
  });

  // ⚠️ The keypress is the whole design: a voicemail cannot press 1, and no digit must fall
  // through to a hangup so the cascade advances.
  it('requires a keypress and hangs up when none comes', () => {
    expect(whisper).toContain('<Gather numDigits="1"');
    expect(whisper).toMatch(/press 1 to take the call/i);
    expect(whisper.indexOf('</Gather>')).toBeLessThan(whisper.indexOf('<Hangup/>'));
  });

  it('tells the business it is a real member of the public and where they came from', () => {
    expect(whisper).toMatch(/a customer is on the line/i);
    expect(whisper).toContain('covingtontow.com');
  });
});

describe('when nobody takes it', () => {
  // ⚠️ The pitch is "I'll ring until one picks up". When we stop, we say we stopped — ninety
  // seconds of hold followed by silence is worse than the five-second silence this replaced.
  it('says that we stopped, and takes a message', () => {
    const t = cascadeExhaustedTwiml({ tried: 5, recordActionUrl: 'https://x/vm' });
    expect(t).toMatch(/I tried 5 and couldn't reach anyone/i);
    expect(t).toContain('<Record');
    expect(t).not.toMatch(/<Response\s*\/>/);
  });

  // "I tried 0" is a machine reading a variable aloud, and it claims attempts that never
  // happened. An empty pool is a real state.
  it('does not claim attempts it never made', () => {
    const t = cascadeExhaustedTwiml({ tried: 0, recordActionUrl: 'https://x/vm' });
    expect(t).not.toContain('I tried 0');
    expect(t).toMatch(/couldn't reach anyone right now/i);
    expect(cascadeExhaustedTwiml({ tried: 1, recordActionUrl: 'x' })).toMatch(/I tried one/i);
  });
});

describe('source guards', () => {
  // ⚠️ THE ONE THAT MATTERS MOST. Acceptance may only be written by the keypress webhook.
  // Anything that sets it from DialCallStatus re-creates the bug the cascade exists to fix.
  it('only the accept route records an acceptance', () => {
    const store = stripComments(readFileSync('lib/ppl/cascadeStore.ts', 'utf8'));
    expect(store).toContain('export async function recordAcceptance');
    const callers = ['cascade', 'cascade-leg', 'whisper', 'voicemail', 'after-dial']
      .map((r) => {
        try {
          return stripComments(
            readFileSync(`app/api/twilio/geo/[campaignId]/${r}/route.ts`, 'utf8'),
          );
        } catch {
          return '';
        }
      })
      .join('\n');
    expect(callers).not.toContain('recordAcceptance');
    const accept = stripComments(
      readFileSync('app/api/twilio/geo/[campaignId]/accept/route.ts', 'utf8'),
    );
    expect(accept).toContain('recordAcceptance');
    // And only for digit 1.
    expect(accept).toMatch(/digits !== '1'/);
  });

  // ⚠️ `getGeoCampaign` does NOT select center_lat/center_lon, so passing its result to the
  // pool loader would silently fall back to city-NAME matching — the bug distance matching was
  // built to kill (1 of 13 real candidates qualified in Maple Valley).
  it('the pool loads the campaign centres itself', () => {
    const src = stripComments(readFileSync('lib/ppl/cascadeStore.ts', 'utf8'));
    expect(src).toMatch(/select\('id, city, region, industry_key, center_lat, center_lon'\)/);
    expect(src).toMatch(/loadCascadePool\(campaignId: string\)/);
  });

  // A STOP is the business's decision and is absolute; "does not answer" is our observation and
  // belongs in the ORDER, not the filter — striking it off shrinks a thin market permanently.
  it('honours opt-outs but does not exclude unresponsive businesses', () => {
    const src = stripComments(readFileSync('lib/ppl/cascadeStore.ts', 'utf8'));
    expect(src).toContain("from('forward_opt_outs')");
    expect(src).toMatch(/optedOut\.has\(key\)/);
    expect(src).not.toMatch(/unresponsive\.has\(key\)\s*\)\s*continue/);
  });

  it('is flag-gated off by default', () => {
    const src = stripComments(readFileSync('lib/ppl/cascadeFlag.ts', 'utf8'));
    expect(src).toContain("CALL_CASCADE_ENABLED === '1'");
    expect(readFileSync('.env.example', 'utf8')).toContain('CALL_CASCADE_ENABLED=0');
  });
});
