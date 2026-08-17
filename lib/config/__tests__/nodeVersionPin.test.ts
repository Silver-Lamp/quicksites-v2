// lib/config/__tests__/nodeVersionPin.test.ts
//
// The Node pin has to be RESOLVABLE, not just correct.
//
// ⚠️ WHY THIS EXISTS. `.nvmrc` pinned the exact patch `20.17.0`, which was not installed on the
// machine — so `nvm use` exited **3**. That matters more than it sounds:
//
//   1. `nvm use` is the FIRST command in the README quick start, CONTRIBUTING, docs/DEVELOPMENT,
//      docs/contributing/ONBOARDING and CLAUDE.md §3. Every new contributor's first command failed.
//   2. A session hit it inside `nvm use >/dev/null 2>&1 && npm install` and got **exit 3 with
//      completely empty output** — the `&&` chain died at the version step and the silencing ate the
//      one line that explained why. It read as "npm install failed mysteriously."
//   3. `quickpush.sh` prefix-matches `v$(cat .nvmrc)*` against `node -v`, so an exact pin that
//      doesn't match the installed patch printed a spurious mismatch warning telling you to run the
//      `nvm use` that could not work.
//
// A major-only pin (`20`) resolves to whatever 20.x is installed, satisfies `engines: 20.x`, and
// matches what CI already does literally (`node-version: 20`). Reproducibility is not lost where it
// mattered: CI pins its own version and `engines` is the real constraint.
//
// This test asserts the three places agree, because they have drifted before — CI ran Node 18 for
// weeks against a repo pinning 20, and the mismatch was invisible until it wasn't.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const nvmrc = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('.nvmrc', () => {
  it('is a major-only pin, so `nvm use` resolves to any installed 20.x', () => {
    // ⚠️ The failure this prevents: re-pinning an exact patch. It looks more rigorous and it rots
    // the moment that exact patch isn't installed — silently, with exit 3 and no output.
    expect(nvmrc).not.toMatch(/^\d+\.\d+\.\d+$/);
    expect(nvmrc).toMatch(/^\d+$/);
  });

  it('agrees with package.json engines', () => {
    const engines = String(pkg.engines?.node ?? '');
    expect(engines).toBeTruthy();
    expect(engines).toMatch(new RegExp(`^${nvmrc}\\.`)); // "20." from "20.x"
  });
});

describe('CI workflows pin the same major', () => {
  const dir = join(root, '.github/workflows');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)) : [];

  it('scans a non-empty set of workflows', () => {
    // A sweep that matches nothing reports success — the repo's own convention (verify:assets).
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(['node-version'])('every %s is the major in .nvmrc', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/node-version:\s*['"]?(\d+)/g)) {
        if (m[1] !== nvmrc) offenders.push(`${f}: node-version ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
