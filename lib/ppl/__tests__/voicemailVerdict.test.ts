// A voicemail is judged before anyone is told to relay it (owner, 2026-10-12). The pure halves:
// parsing the model's answer, and who gets told for each answer. Plus source guards that the
// route actually gates the business text on the decision and that the operator hears the verdict.
import fs from 'fs';
import path from 'path';
import { parseVerdict, decideVoicemailRelay, verdictLine, VERDICT_SYSTEM_PROMPT } from '@/lib/ppl/voicemailVerdict';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('parseVerdict', () => {
  it('reads the three answers and keeps the reason', () => {
    expect(parseVerdict('{"verdict":"not_lead","reason":"A home-care agency calling about an account."}')).toEqual({ verdict: 'not_lead', reason: 'A home-care agency calling about an account.' });
    expect(parseVerdict({ verdict: 'LEAD', reason: 'Needs a tow tonight' })).toEqual({ verdict: 'lead', reason: 'Needs a tow tonight' });
    expect(parseVerdict('{"verdict":"unclear","reason":""}').verdict).toBe('unclear');
  });
  it('anything malformed is unclear, never a guess', () => {
    expect(parseVerdict('nope').verdict).toBe('unclear');
    expect(parseVerdict('{"verdict":"spam"}').verdict).toBe('unclear');
    expect(parseVerdict(null).verdict).toBe('unclear');
  });
});

describe('decideVoicemailRelay — fail open toward the business, closed on a non-lead', () => {
  it.each([
    ['speech', 'lead', true, null],
    ['speech', 'unclear', true, null],
    ['speech', null, true, null],
    ['unknown', null, true, null],
    ['speech', 'not_lead', false, 'not_lead'],
    ['no_speech', null, false, 'no_speech'],
    ['no_speech', 'lead', false, 'no_speech'],
  ] as const)('speech=%s verdict=%s → text business %s', (speech, verdict, text, skipped) => {
    expect(decideVoicemailRelay({ speech, verdict })).toEqual({ textBusiness: text, skipped });
  });
});

describe('the words', () => {
  it('the prompt judges by what was said and prefers unclear to a guess; the lines say what happened', () => {
    expect(VERDICT_SYSTEM_PROMPT).toMatch(/Judge only from the words/);
    expect(VERDICT_SYSTEM_PROMPT).toMatch(/Prefer "unclear" over a confident guess/);
    expect(verdictLine({ verdict: 'not_lead', reason: 'vendor' })).toMatch(/NOT a lead.*was not texted/);
    expect(verdictLine({ verdict: 'unclear', reason: 'judge failed: timeout' })).toMatch(/could not judge.*business was texted/);
    expect(verdictLine(null)).toBeNull();
  });
});

describe('the route and the emails use it', () => {
  const route = read('app/api/twilio/geo/[campaignId]/voicemail/route.ts');
  it('judges a spoken transcript, stores the verdict, and gates the business text on the decision', () => {
    expect(route).toMatch(/judgeVoicemail\(/);
    expect(route).toMatch(/voicemail_verdict: /);
    expect(route).toMatch(/decideVoicemailRelay\(\{ speech, verdict/);
    // The text goes out only inside the decision's branch — never unconditionally after a transcript.
    expect(route.indexOf('missedCallSmsText(')).toBeGreaterThan(route.indexOf('decideVoicemailRelay('));
    // The caller's number is not part of what the model sees.
    const judgeCall = route.slice(route.indexOf('judgeVoicemail('), route.indexOf(')', route.indexOf('judgeVoicemail(')) + 1);
    expect(judgeCall).not.toMatch(/callerPhone|from_number/);
  });
  it('the operator email and the alert digest carry the verdict', () => {
    expect(read('lib/ppl/voicemail.ts')).toMatch(/verdictLine\(/);
    expect(read('lib/ppl/callAlert.ts')).toMatch(/voicemail_verdict/);
  });
});
