// Every call gets a stored analysis (owner, 2026-10-12). The pure halves: the PostHog rows →
// visit events in the window, the model's JSON → a read, the facts the model sees carrying no
// caller number, and the line the email shows. Source guards: the cron writes it, the webhook
// paths never read it (the analysis gates nothing).
import fs from 'fs';
import path from 'path';
import {
  areaCodeOf,
  operatorLast10s,
  visitEventsFromRows,
  parseAnalysis,
  factsForModel,
  analysisLine,
  ANALYSIS_SYSTEM_PROMPT,
  type CallFacts,
} from '@/lib/ppl/callAnalysis';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const CALL_AT = '2026-10-12T17:26:23.411Z';

describe('operatorLast10s', () => {
  it('reads any formatting and ignores junk; unset means no list', () => {
    expect(operatorLast10s('(262) 302-8118, +1 206 555 0100,, x')).toEqual(['2623028118', '2065550100']);
    expect(operatorLast10s(undefined)).toEqual([]);
  });
});

describe('areaCodeOf', () => {
  it('reads a NANP area code and nothing else', () => {
    expect(areaCodeOf('+19046383607')).toBe('904');
    expect(areaCodeOf('2064639401')).toBe('206');
    expect(areaCodeOf('+442012345')).toBeNull();
    expect(areaCodeOf('anonymous')).toBeNull();
    expect(areaCodeOf(null)).toBeNull();
  });
});

describe('visitEventsFromRows — the vashon-landscaping call', () => {
  const rows: unknown[][] = [
    ['2026-10-12 17:21:03.864000', '$pageview', 'https://vashon-landscaping.com/', 'Quezon City', '00', 'PH', 'Desktop', '$direct', null],
    ['2026-10-12 17:25:42.844000', '$autocapture', 'https://vashon-landscaping.com/', 'Quezon City', '00', 'PH', 'Desktop', '$direct', 'Contact'],
    ['2026-10-12 17:26:28.182000', '$pageleave', 'https://vashon-landscaping.com/#contact', 'Quezon City', '00', 'PH', 'Desktop', '$direct', null],
    // An hour earlier: outside the window, dropped.
    ['2026-10-12 16:10:00.000000', '$pageview', 'https://vashon-landscaping.com/', 'Boardman', 'OR', 'US', 'Desktop', '$direct', null],
  ];
  it('keeps the window, oldest first, with seconds-before-call and the click text', () => {
    const ev = visitEventsFromRows(rows, CALL_AT);
    expect(ev.map((e) => e.event)).toEqual(['$pageview', '$autocapture', '$pageleave']);
    expect(ev[1].secondsBeforeCall).toBe(41);
    expect(ev[1].clicked).toBe('Contact');
    expect(ev[2].secondsBeforeCall).toBe(-5);
    expect(ev[0].city).toBe('Quezon City');
  });
  it('treats a zone-less PostHog timestamp as UTC', () => {
    const ev = visitEventsFromRows([['2026-10-12 17:26:00', '$pageview', null, null, null, null, null, null, null]], CALL_AT);
    expect(ev).toHaveLength(1);
    expect(ev[0].secondsBeforeCall).toBe(23);
  });
});

describe('parseAnalysis', () => {
  it('reads a well-formed answer', () => {
    expect(parseAnalysis('{"read":"vendor_or_sales","confidence":"medium","summary":"A desktop in Quezon City clicked Contact 41 s before the call.","next_step":"Nothing to relay."}')).toEqual({
      read: 'vendor_or_sales',
      confidence: 'medium',
      summary: 'A desktop in Quezon City clicked Contact 41 s before the call.',
      nextStep: 'Nothing to relay.',
    });
  });
  it('anything malformed is unknown at low confidence, never a guess', () => {
    expect(parseAnalysis('nope')).toMatchObject({ read: 'unknown', confidence: 'low' });
    expect(parseAnalysis('{"read":"spam","summary":"x"}')).toMatchObject({ read: 'unknown' });
    expect(parseAnalysis('{"read":"customer","confidence":"very","summary":"needs a tow"}')).toMatchObject({ read: 'customer', confidence: 'low' });
  });
});

const FACTS: CallFacts = {
  version: 1,
  call: {
    at: CALL_AT,
    outcome: 'unanswered',
    status: 'dial-no-answer',
    durationSec: null,
    handling: 'forward',
    forwardedToName: "Herb's Land Improvement Co",
    voicemail: { hasRecording: false, speech: null, transcript: null, verdict: null, verdictReason: null },
    businessTexted: true,
  },
  caller: { areaCode: '904', priorCalls: { count: 0, domains: [], lastOutcome: null, lastVoicemail: null, lastRead: null }, knownBusiness: null, isForwardTo: false, isOperator: null },
  site: { domain: 'vashon-landscaping.com', city: 'Vashon', region: 'WA', industry: 'Landscaping', campaignStatus: 'draft', rankStatus: 'unranked', rankPosition: null, ageDays: 4, gsc: { impressions: 0, clicks: 0 } },
  visit: {
    source: 'posthog',
    windowMinutesBefore: 20,
    windowMinutesAfter: 3,
    events: [{ at: '2026-10-12T17:25:42.844Z', secondsBeforeCall: 41, event: '$autocapture', url: 'https://vashon-landscaping.com/', city: 'Quezon City', region: '00', country: 'PH', device: 'Desktop', referrer: '$direct', clicked: 'Contact' }],
  },
};

describe('what the model sees', () => {
  it('carries the area code and the visit, never a phone number', () => {
    const text = factsForModel(FACTS);
    expect(text).toMatch(/area code 904/);
    expect(text).toMatch(/41s · \$autocapture .* clicked "Contact"/);
    expect(text).not.toMatch(/\+1\d{10}|\(\d{3}\) \d{3}-\d{4}/);
  });
  it('says whether an operator phone list exists, so "not the operator" is never implied by its absence', () => {
    expect(factsForModel(FACTS)).toMatch(/no operator phone list is configured/);
    expect(factsForModel({ ...FACTS, caller: { ...FACTS.caller, isOperator: true } })).toMatch(/IS the operator's own phone/);
  });
  it('says when visit data is unavailable instead of "none"', () => {
    const text = factsForModel({ ...FACTS, visit: { ...FACTS.visit, events: [], unavailable: 'POSTHOG_PERSONAL_API_KEY is not set' } });
    expect(text).toMatch(/unavailable \(POSTHOG_PERSONAL_API_KEY is not set\)/);
    expect(text).not.toMatch(/none recorded/);
  });
  it('the prompt labels geolocation as inference and prefers unknown to a guess', () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/call them inferences, never facts/);
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/answer "unknown" with low confidence rather than guess/);
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/Never claim a person answered/);
  });
});

describe('analysisLine', () => {
  it('leads with the read and its confidence, labelled AI', () => {
    expect(analysisLine({ analysis_summary: 'Quezon City desktop clicked Contact 41 s before.', analysis: { read: 'vendor_or_sales', confidence: 'medium' } })).toBe(
      'AI read: likely a vendor or sales call (medium confidence). Quezon City desktop clicked Contact 41 s before.',
    );
    expect(analysisLine({ analysis_summary: null })).toBeNull();
  });
});

describe('where it runs', () => {
  it('the call-alert cron analyses before it emails and stores the result on the row', () => {
    const cron = read('app/api/cron/call-alert/route.ts');
    expect(cron).toMatch(/analyzeAndStore\(/);
    expect(cron.indexOf('analyzeAndStore(')).toBeLessThan(cron.indexOf('buildCallAlertEmail('));
    expect(cron).toMatch(/analysis_summary/);
  });
  it('the analysis gates nothing: no Twilio webhook reads it', () => {
    for (const p of [
      'app/api/twilio/geo/[campaignId]/voicemail/route.ts',
      'app/api/twilio/geo/[campaignId]/status/route.ts',
      'app/api/twilio/geo/[campaignId]/after-dial/route.ts',
      'app/api/twilio/geo/[campaignId]/route.ts',
    ]) {
      expect(read(p)).not.toMatch(/callAnalysis|analyzeAndStore|analysis_summary/);
    }
  });
  it('the alert email and the call-logs page show the line', () => {
    expect(read('lib/ppl/callAlert.ts')).toMatch(/analysisLine\(/);
    expect(read('app/admin/call-logs/page.tsx')).toMatch(/analysisLine\(/);
  });
});
