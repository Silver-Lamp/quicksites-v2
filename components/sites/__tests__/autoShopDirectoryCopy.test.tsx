/**
 * @jest-environment node
 */
// The directory must not promise a capability that is switched off.
//
// ⚠️ THE PAGE FRONTS A DOMAIN WE PAY FOR AND SEND MECHANICS TO. Its subhead described SecondSet —
// "a photo of the actual problem and the tech's note, so you approve the repair before it happens"
// — while SECONDSET_ENABLED is false. That is the scaffold-FAQ failure (#787) on a public page: a
// claim a reader can rely on and we cannot honour.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'components/sites/auto-shop-competition-directory.tsx'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

describe('SecondSet copy is gated', () => {
  it('reads the flag rather than hardcoding the claim', () => {
    expect(CODE).toMatch(/SECONDSET_ENABLED/);
    expect(CODE).toMatch(/secondsetLive/);
  });

  it('puts every SecondSet promise behind the flag', () => {
    // Each phrase must appear only inside a `secondsetLive ?` branch.
    for (const phrase of ['show you the work', 'with SecondSet']) {
      const i = CODE.indexOf(phrase);
      expect(i).toBeGreaterThan(-1);
      const before = CODE.slice(Math.max(0, i - 400), i);
      expect(before).toMatch(/secondsetLive/);
    }
  });

  it('has a fallback that claims only what the page does', () => {
    expect(CODE).toMatch(/own page — hours, directions and a phone/);
    // ⚠️ The fallback must not smuggle the promise back in.
    const at = CODE.indexOf('own page — hours');
    const fallback = CODE.slice(at, at + 300);
    expect(fallback).not.toMatch(/SecondSet|show you the work|approve the repair/);
  });

  it('is actually scanning the component', () => {
    expect(CODE).toMatch(/Trusted auto shops in/);
  });
});

describe('the call line names who answers (2026-10-16, paterson-auto-repair.com)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { callLineFor } = require('@/lib/outreach/autoShopCompetitionDirectory');
  it('exists only with a number AND a named forward-to', () => {
    expect(callLineFor({ tracking_number: '+18565432146', forward_to: '+19738072255', forward_to_name: 'River auto Tech and Tire shop LLC' })).toEqual({ number: '+18565432146', display: '(856) 543-2146', answeredBy: 'River auto Tech and Tire shop LLC' });
    expect(callLineFor({ tracking_number: '+18565432146', forward_to: '+19738072255', forward_to_name: null })).toBeNull();
    expect(callLineFor({ tracking_number: null, forward_to: '+19738072255', forward_to_name: 'x' })).toBeNull();
  });
  it('the page says who answers next to the number and never calls it the directory\'s own', () => {
    expect(CODE).toMatch(/data-directory-call-line/);
    const at = CODE.indexOf('data-directory-call-line');
    const block = CODE.slice(at, at + 900);
    expect(block).toMatch(/tel:\$\{dir\.callLine\.number\}/);
    expect(block).toMatch(/Answered by .*\{dir\.callLine\.answeredBy\}/s);
    expect(block).not.toMatch(/our (number|line|team)|call us/i);
    expect(CODE).toMatch(/dir\.callLine \? \(/);
  });
});
