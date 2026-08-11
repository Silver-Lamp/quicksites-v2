/**
 * @jest-environment node
 */
// House spelling: "artifact", with the British spelling banned.
//
// ⚠️ THE FIRST VERSION FAILED ON ITSELF — three times in one afternoon this repo has written a
// check whose own explanatory text is the thing it forbids (the ™ rule, the `required` comment, and
// now this). A guard that must name the banned string cannot also scan itself, so this file is
// excluded below and never writes the banned spelling out in full.
//
// The word appears constantly in this codebase — it is the noun in the rule the whole verify/
// subsystem exists for ("check the received artifact, not the inputs"), and it reached a public
// page as an h1. Both spellings are correct English; we use the US one, and consistency matters
// more than the choice does. A single guard is cheaper than noticing it in review forever.
//
// ⚠️ Scoped to prose we author. It does NOT scan node_modules — a dependency's spelling is not ours
// to police, and sweeping one in is how a count stops measuring what its sentence claims (see
// app/testing/__tests__/testingPageFigures.test.ts, where exactly that shipped a wrong number to
// a live page).
import { execSync } from 'node:child_process';

const DIRS = ['app', 'lib', 'components', 'docs', 'scripts'];

/** This file itself — it must name the banned spelling to test for it. */
const SELF = 'spellingArtifact.test.ts';

function scan(pattern: string): string[] {
  const out = execSync(
    `grep -rn "${pattern}" --include=*.ts --include=*.tsx --include=*.md ${DIRS.join(' ')} 2>/dev/null || true`,
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).filter((l) => !l.includes(SELF));
}

describe('house spelling: artifact', () => {
  // ⚠️ A scan matching nothing reports success. If these directories are ever renamed, this proves
  // the scan still reaches real files before the assertion below is allowed to mean anything.
  it('is scanning a non-empty set of files', () => {
    expect(scan('artifact').length).toBeGreaterThan(0);
  });

  it('never uses the British spelling', () => {
    // Built at runtime so the banned word is not written in this file.
    const hits = scan(['art', 'efact'].join(''));
    expect(hits.length === 0 ? 'clean' : `use "artifact":\n${hits.join('\n')}`).toBe('clean');
  });
});
