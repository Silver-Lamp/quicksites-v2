/**
 * @jest-environment node
 */
// The Twilio callback is a <Dial action> URL. Its response is parsed as TwiML; JSON is a parse
// error and the CALLER hears "an application error has occurred, goodbye". That is what the
// first real call through a tracking number got (graftontowing.com, 2026-09-19). Source guards,
// because a unit test cannot see what Twilio does with a content type.
import { readFileSync } from 'node:fs';

const src = readFileSync('app/api/twilio-callback/route.ts', 'utf8');

describe('twilio-callback answers Twilio in TwiML', () => {
  it('returns text/xml with an empty <Response/>, never NextResponse.json', () => {
    expect(src).toContain("'Content-Type': 'text/xml'");
    expect(src).toContain('<Response/>');
    // The only remaining JSON response is the 403 for a bad signature, which is correct:
    // an unsigned request is not Twilio and gets no TwiML.
    const jsonReturns = src.match(/NextResponse\.json\(/g) ?? [];
    expect(jsonReturns.length).toBe(1);
  });
  it('reads the <Dial action> fields, not only status-callback ones', () => {
    expect(src).toContain('DialCallStatus');
    expect(src).toContain('DialCallDuration');
    expect(src).toContain('RecordingUrl');
  });
  it('never overwrites a logged value with undefined', () => {
    expect(src).not.toMatch(/call_status:\s*CallStatus,/);
    expect(src).toMatch(/if \(status\) row\.call_status = status;/);
  });
});
