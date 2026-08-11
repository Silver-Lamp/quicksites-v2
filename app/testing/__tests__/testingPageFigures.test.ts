/**
 * @jest-environment node
 */
// The numbers on /testing must still be true.
//
// ⚠️ THE PAGE'S OWN HEADER SAYS "every number is real and checkable in this repo". That sentence
// is worth nothing unless something checks it — a public page asserting its own rigour, drifting
// quietly out of date, would be the exact failure the page is about.
//
// Written after three figures in the FIRST DRAFT were wrong: 502 test files (507), 17 config gates
// (14), 159 baselined env keys (109). A fourth — "1.71:1 contrast across all 98 published sites" —
// was not stale, it was INVENTED: plausible, specific, and matching nothing anywhere in the repo.
// It survived a re-read because a fabricated number reads exactly like a remembered one. It was
// caught by grepping for it, which is the only reason this file exists.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const PAGE = join(process.cwd(), 'app/testing/page.tsx');
const src = readFileSync(PAGE, 'utf8');

/** The figure as the visitor reads it — not as JSX writes it. */
function claims(n: number | string): boolean {
  return src.includes(String(n));
}

describe('/testing — the counts it states', () => {
  // ⚠️ THIS TEST BROKE THE PAGE BY EXISTING. The page said "507 test files"; adding this file made
  // it 508. An exact count would have gone red on every new test forever — a check that fires on
  // correct code, which is the failure rule 4 on the page itself warns about. So the page states a
  // FLOOR ("more than 500"), and the assertion is that the floor is still true and not so stale
  // that the page is badly understating itself.
  it('states a test-file floor that is true and not badly out of date', () => {
    const out = execSync(
      `find . -path ./node_modules -prune -o \\( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \\) -print | wc -l`,
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const actual = Number(out.trim());
    expect(actual).toBeGreaterThan(0); // a count of zero would pass vacuously against a typo

    const stated = Number(src.match(/More than (\d+) test files/)?.[1]);
    expect(Number.isFinite(stated)).toBe(true);
    expect(actual).toBeGreaterThan(stated);
    // Understating by more than half means the sentence has stopped describing the codebase.
    expect(actual).toBeLessThan(stated * 2);
  });

  it('states the real number of config gates', () => {
    const health = readFileSync(join(process.cwd(), 'lib/config/health.ts'), 'utf8');
    const gates = [...health.matchAll(/key: ['"]([^'"]+)['"]/g)].length;
    expect(gates).toBeGreaterThan(0);
    expect(claims(`${gates} features`)).toBe(true);
  });

  it('states the real size of the undeclared-env baseline', () => {
    const decl = readFileSync(
      join(process.cwd(), 'lib/config/__tests__/declarations.test.ts'),
      'utf8',
    );
    const block = decl.slice(decl.indexOf('const KNOWN_UNDECLARED'));
    const size = block.slice(0, block.indexOf('\n];')).split('\n').filter((l) => /^\s*'/.test(l)).length;
    expect(size).toBeGreaterThan(0);
    expect(claims(`${size} known-undeclared`)).toBe(true);
  });
});

describe('/testing — the incidents it describes still exist as code', () => {
  // Each of these is a specific claim the page makes about this repo. If the mechanism is deleted
  // or renamed, the page becomes a story about a system we no longer run.
  it('the render gate is real and its rules are the four named', () => {
    const gate = readFileSync(join(process.cwd(), 'lib/verify/renderGate.ts'), 'utf8');
    for (const rule of ['copy_present', 'order', 'no_owner_strings', 'min_contrast']) {
      expect(gate).toContain(rule);
    }
  });

  it('the asset verifier still has the selftest the page credits', () => {
    const verify = execSync(
      `grep -rl "selftest" scripts 2>/dev/null || true`,
      { cwd: process.cwd(), encoding: 'utf8' },
    ).trim();
    expect(verify.length).toBeGreaterThan(0);
  });

  it('SectionShell still emits no colour (the forty-invisible-bullets fix)', () => {
    const shell = readFileSync(join(process.cwd(), 'components/ui/section-shell.tsx'), 'utf8');
    expect(shell).not.toMatch(/'text-white'/);
  });

  it('the /status route the page points at exists', () => {
    expect(existsSync(join(process.cwd(), 'app/status/route.ts'))
      || existsSync(join(process.cwd(), 'app/status/page.tsx'))).toBe(true);
  });

  it('the export route it uses as the worked example exists', () => {
    expect(existsSync(join(process.cwd(), 'app/api/sites/[id]/export/route.ts'))).toBe(true);
  });
});

describe('/testing — reachability, which is rule 2 applied to itself', () => {
  it('is linked from the shared footer, not only from its sibling', () => {
    const footer = readFileSync(join(process.cwd(), 'components/site/site-footer.tsx'), 'utf8');
    expect(footer).toMatch(/href: '\/testing'/);
  });

  // ⚠️ NOT a fetch. A test that pings hivejournal.com would fail on a plane and go red for a
  // reason having nothing to do with this repo — a check that cries wolf is rule 4. The URL was
  // verified live (200, server-rendered) when the link was added; this only guards the shape.
  it('cross-links the other half by absolute URL', () => {
    expect(src).toContain('https://www.hivejournal.com/how-we-test');
  });
});

describe('/testing — no figure that matches nothing', () => {
  // The invented-statistic case. Any "N.NN : 1" or "N published sites" style claim must be
  // greppable somewhere in the repo, or it is a number someone made up.
  it('makes no contrast-ratio claim that is not recorded in code', () => {
    const ratios = [...src.matchAll(/(\d\.\d{2})\s*:\s*1/g)].map((m) => m[1]);
    for (const r of ratios) {
      const found = execSync(
        `grep -rl "${r}" --include='*.ts' --include='*.tsx' --include='*.md' lib components docs scripts 2>/dev/null || true`,
        { cwd: process.cwd(), encoding: 'utf8' },
      ).trim();
      expect(found.length > 0 ? 'recorded' : `${r}:1 appears nowhere in the repo`).toBe('recorded');
    }
  });
});
