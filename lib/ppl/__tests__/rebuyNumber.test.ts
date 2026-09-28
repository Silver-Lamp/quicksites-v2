/**
 * @jest-environment node
 *
 * REPLACING A BADLY-LOCATED TRACKING NUMBER.
 *
 * ⚠️ seatac-towing.com was given +1 419 557 4374 — Toledo, Ohio — because 206 was sold out and
 * provisioning fell back to "any US number" silently. There was no way to undo it:
 * `releaseTrackingNumber` had sat in the library with ZERO callers, so a wrong number could be
 * bought from the admin and never released from it.
 *
 * ⚠️ BUY FIRST, RELEASE SECOND is the safety property. Releasing first leaves a market with no
 * number at all and a live site advertising one that now belongs to nobody — strictly worse than
 * the wrong area code it replaced.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import { isAreaCodeMismatch } from '@/components/admin/ppl-rebuy-number';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const ROUTE = read('app/api/admin/prospects/geo-campaign/rebuy-number/route.ts');

describe('isAreaCodeMismatch', () => {
  it('flags the real SeaTac case', () => {
    // Tracking 419 (Ohio) vs a 206 forward-to.
    expect(isAreaCodeMismatch('+14195574374', '+12064141000')).toBe(true);
  });

  it('does not flag the markets that are fine', () => {
    expect(isAreaCodeMismatch('+12536552016', '+12534425373')).toBe(false); // South Hill
    expect(isAreaCodeMismatch('+12066392584', '+12064873600')).toBe(false); // Maple Valley
    expect(isAreaCodeMismatch('+12533568119', '+12532170639')).toBe(false); // Renton towing
  });

  it('stays silent when either side is unknown', () => {
    // No opinion beats a wrong one; the operator sees nothing rather than a bogus warning.
    expect(isAreaCodeMismatch('+14195574374', null)).toBe(false);
    expect(isAreaCodeMismatch('', '+12064141000')).toBe(false);
    expect(isAreaCodeMismatch('555', '+12064141000')).toBe(false);
  });

  it('compares against the FORWARD-TO, not a hardcoded table', () => {
    // The forward-to is a real business in that market, so its area code is the market's —
    // no code→state map to maintain, and overlays (938 for Cullman) work for free.
    expect(isAreaCodeMismatch('+12566854977', '+12568417882')).toBe(false); // Cullman 256/256
    expect(isAreaCodeMismatch('+19388003858', '+12568417882')).toBe(true); // 938 vs 256, flagged
  });
});

describe('the rebuy route', () => {
  it('buys BEFORE releasing', () => {
    const buy = ROUTE.indexOf('provisionTrackingNumber({');
    const rel = ROUTE.indexOf('releaseTrackingNumber(');
    expect(buy).toBeGreaterThan(-1);
    expect(rel).toBeGreaterThan(buy);
  });

  it('keeps the old number when no local one is available', () => {
    expect(ROUTE).toContain('no_local_inventory');
    expect(ROUTE).toMatch(/kept:\s*oldNumber/);
  });

  it('never allows an out-of-area purchase — that is the bug it fixes', () => {
    expect(ROUTE).not.toMatch(/allowAnywhere/);
  });

  it('pushes the new number to the site', () => {
    expect(ROUTE).toContain('pushTrackingNumberToSite');
  });

  it('reports a failed release rather than swallowing it', () => {
    // A number that is not released keeps billing.
    expect(ROUTE).toMatch(/could NOT release/);
  });

  it('refuses when there is no number to replace', () => {
    expect(ROUTE).toMatch(/no number to replace/);
  });
});
