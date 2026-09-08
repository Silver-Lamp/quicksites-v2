/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makesOperationalClaim } from '@/lib/rebuild/scrubInventedClaims';
import {
  REWRITES,
  READER_ADVICE,
  PLACEHOLDER,
  PLACEHOLDER_NAMES,
  SCAFFOLD_HIGHLIGHTS_BEFORE,
  SCAFFOLD_HIGHLIGHTS_HTML,
} from '@/lib/rebuild/liveClaimRewrites';

describe('every rewrite narrows what a page asserts', () => {
  it.each(REWRITES.map((r) => [r.why, r]))('%s: the target is a claim, the replacement is not', (_why, r) => {
    const rw = r as (typeof REWRITES)[number];
    // A rewrite whose `from` claims nothing would be editing honest copy for no reason.
    expect(makesOperationalClaim(rw.from)).toBe(true);
    // A fix that reintroduces a claim is not a fix. Never empty — a nameless service is #906's trap.
    expect(rw.to.trim().length).toBeGreaterThan(0);
    expect(makesOperationalClaim(rw.to)).toBe(false);
    expect(rw.to).not.toContain(PLACEHOLDER);
    expect(rw.from).not.toBe(rw.to);
  });

  it('a renamed service keeps its name', () => {
    const name = REWRITES.find((r) => r.from === '24/7 Emergency Towing');
    expect(name?.to).toBe('Emergency Towing');
  });
});

describe('the scaffold no longer ships the bullets the rewrite removes', () => {
  const SRC = readFileSync(join(process.cwd(), 'lib/builder/industryScaffold.ts'), 'utf8');
  // Strip comments so the note explaining the old bullets cannot trip the check that bans them.
  const CODE = SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

  it('does not contain the old list', () => {
    expect(CODE).not.toMatch(/Licensed &amp; insured/);
    expect(CODE).not.toMatch(/Satisfaction guaranteed/);
  });

  it('still builds the column, so the scan is not passing over nothing', () => {
    expect(CODE).toMatch(/SCAFFOLD_HIGHLIGHTS_HTML/);
    expect(SCAFFOLD_HIGHLIGHTS_HTML).toMatch(/Why choose us/);
    expect(makesOperationalClaim(SCAFFOLD_HIGHLIGHTS_HTML)).toBe(false);
    expect(makesOperationalClaim(SCAFFOLD_HIGHLIGHTS_BEFORE)).toBe(true);
  });
});

describe('editor instructions never ship on a public page', () => {
  const { PLACEHOLDER_REWRITES } = require('@/lib/rebuild/liveClaimRewrites');
  it('the leaked sentence is removed, and it was never a claim to begin with', () => {
    for (const r of PLACEHOLDER_REWRITES) {
      expect(makesOperationalClaim(r.from)).toBe(false);
      expect(r.to).toBe('');
    }
  });
  it('the scaffold no longer emits it', () => {
    const SRC = readFileSync(join(process.cwd(), 'lib/builder/industryScaffold.ts'), 'utf8');
    const CODE = SRC.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(CODE).not.toMatch(/Share your story and what sets you apart here/);
    expect(CODE).toMatch(/dedicated to quality work and honest, dependable service\./);
  });
});

describe('placeholders are filled only where a name is known', () => {
  it('every name is a real business name, not the placeholder or a slug', () => {
    for (const [slug, name] of Object.entries(PLACEHOLDER_NAMES)) {
      expect(name).not.toContain('[');
      expect(name).not.toBe(slug);
      expect(name).toMatch(/\s/); // "Grafton Towing", never "graftontowing"
    }
  });
});

describe('reader-advice exclusions are live, not rotted', () => {
  // An exclusion that no longer matches the regex is dead weight AND hides that the copy changed.
  it.each(READER_ADVICE.map((r) => [r.why, r.text]))('%s still trips the claim regex', (_why, text) => {
    expect(makesOperationalClaim(text as string)).toBe(true);
  });
});
