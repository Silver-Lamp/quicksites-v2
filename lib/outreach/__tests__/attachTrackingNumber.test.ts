/**
 * @jest-environment node
 */
// Source guards for the attach-number path (docs/PPL_VERTICAL.md §8 step 1c):
//  - attaching an EXISTING number is free, so it must not sit behind CALL_TRACKING_ENABLED
//    (that flag guards purchases — putting attach behind it would block the Grafton repoint
//    on a spend decision that does not apply);
//  - moving a number off a Studio flow requires clearing voiceApplicationSid, not just setting
//    voiceUrl — a number bound to a flow ignores its voiceUrl.
import { readFileSync } from 'node:fs';

const lib = readFileSync('lib/outreach/callTracking.ts', 'utf8');
const route = readFileSync('app/api/admin/prospects/geo-campaign/attach-number/route.ts', 'utf8');

describe('attachTrackingNumber', () => {
  it('is gated on Twilio being configured, not on the purchase flag', () => {
    const fn = lib.slice(lib.indexOf('export async function attachTrackingNumber'));
    expect(fn).toContain('twilioConfigured()');
    expect(fn).not.toContain('callTrackingEnabled()');
    expect(route).not.toContain('callTrackingEnabled');
  });
  it('clears the Studio flow binding when it sets the voice URL', () => {
    const fn = lib.slice(lib.indexOf('export async function attachTrackingNumber'));
    expect(fn).toMatch(/voiceApplicationSid:\s*''/);
    expect(fn).toContain("voiceMethod: 'GET'");
  });
  it('the route records what the number pointed at before, so the change is reversible', () => {
    expect(route).toContain('previousVoiceUrl');
    expect(route).toContain('previousVoiceApplicationSid');
  });
  it('the route refuses to silently replace a different tracking number', () => {
    expect(route).toContain("code: 'already_tracked'");
  });
});
