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

/** The file with comments stripped — what the page actually SHIPS. Use this for any rule about
 *  what the page says, so a comment explaining the rule can never trip it. */
const shipped = src
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n');

/** The figure as the visitor reads it — not as JSX writes it. */
function claims(n: number | string): boolean {
  return src.includes(String(n));
}

describe('/testing — the counts it states', () => {
  // ⚠️ THIS TEST BROKE THE PAGE BY EXISTING. The page said "507 test files"; adding this file made
  // it 508. An exact count would have gone red on every new test forever — a check that fires on
  // correct code, which is the failure rule 4 on the page itself warns about. So the page states a
  // FLOOR, and the assertion is that the floor is still true and not so stale that the page is
  // badly understating itself.
  //
  // ⚠️ AND THEN IT CAUGHT A REAL ONE, WHICH IS THE ONLY REASON THE PAGE'S FIGURE IS HONEST. The
  // original command was `find . -path ./node_modules -prune -o -name '*.test.ts' …`, which prunes
  // ONE node_modules — the top-level one. `admin/node_modules` was not pruned, so the count included
  // zod's, react-day-picker's and msw's own test suites: 309 of the 507 were other people's tests.
  // It read as 507 locally and 198 in CI, where a fresh checkout has a different tree, and the page
  // went out claiming "more than 500". CI went red twenty minutes after it shipped.
  //
  // The fix is not a better prune. It is counting the right population: `git ls-files` is what "our
  // test files" MEANS, it is identical on every machine, and it cannot be polluted by anything a
  // dependency ships. A count that differs between two environments was never measuring the thing
  // the sentence claimed.
  it('states a test-file floor that is true, and counts only OUR tests', () => {
    const out = execSync(`git ls-files | grep -cE '\\.(test|spec)\\.(ts|tsx)$'`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: '/bin/bash',
    });
    const actual = Number(out.trim());
    expect(actual).toBeGreaterThan(0); // a count of zero would pass vacuously against a typo

    // Nothing outside the repo may contribute to the number on the page.
    expect(
      execSync(`git ls-files | grep -E '\\.(test|spec)\\.(ts|tsx)$' | grep -c node_modules || true`, {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: '/bin/bash',
      }).trim(),
    ).toBe('0');

    const stated = Number(src.match(/More than (\d+) test files of our own/)?.[1]);
    expect(Number.isFinite(stated)).toBe(true);
    expect(actual).toBeGreaterThan(stated);
    // Understating by more than half means the sentence has stopped describing the codebase.
    expect(actual).toBeLessThan(stated * 2);
  });

  // The page now tells this story as an incident. If the story stops matching the code, the page is
  // recounting a bug it no longer has — which is its own §8 failure mode.
  it('the incident it now describes matches the figures it now states', () => {
    expect(src).toContain('309 of those 507 files');
    expect(src).toContain('The real figure is 198');
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

describe('/testing — the pipeline diagram states real cadences', () => {
  // ⚠️ A diagram is a claim too, and the easy lie is drawing the layer you WISH ran automatically
  // as if it did. Ours marks the render gate "on demand" because it is a script nobody has wired.
  // If it ever gets wired, this test fails and the diagram must be corrected upward — the pleasant
  // direction, but still a correction.
  it('the render gate is genuinely not wired to CI or a cron', () => {
    const wired = execSync(
      `grep -rl "verify-rendered\\|runRenderGate" .github vercel.json 2>/dev/null || true`,
      { cwd: process.cwd(), encoding: 'utf8' },
    ).trim();
    expect(
      wired.length === 0
        ? 'not wired — "on demand" is accurate'
        : `render gate IS wired (${wired.split('\n').join(', ')}) — the diagram now understates it`,
    ).toBe('not wired — "on demand" is accurate');
    expect(src).toMatch(/cadence: 'on demand'/);
  });

  it('every CI gate the diagram names actually runs in CI', () => {
    const ci = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    for (const step of ['typecheck', 'lint', 'verify:assets', 'build']) {
      expect(ci).toContain(step);
    }
  });
});

describe('/testing — the persona row is attributed, not annexed', () => {
  // ⚠️ AI Personas is HiveJournal's product. On a QuickSites page, "a product we ship" would be
  // false — the exact small deception `components/promo/persona-testing-promo.tsx` was written to
  // prevent, since a reader clicking through lands on a different product with its own billing.
  it('names whose product it is', () => {
    expect(src).toMatch(/brand: 'HiveJournal'/);
  });

  it('uses the canonical URL constant rather than a hand-written link', () => {
    expect(src).toContain("import { PERSONA_TESTING_URL }");
    expect(src).toMatch(/href: PERSONA_TESTING_URL/);
    // The literal must appear nowhere else on the page — that is how the shared copy rots.
    expect(src).not.toMatch(/hivejournal\.com\/persona-testing/);
  });

  // ⚠️ A ™ is a legal claim. I was asked to brand this row and declined the symbol: I have no
  // evidence of a registered mark, and asserting one on a page about unverified claims would be
  // the page contradicting itself in its own diagram.
  //
  // ⚠️ CHECKS `shipped`, NOT `src`. The first version failed on the comment ABOVE, which contains a
  // ™ in the sentence explaining why the page has none — a test firing on correct code, and the
  // third time that exact shape has bitten this repo (see components/ui/__tests__/sectionShellColor).
  // A rule about what the page SAYS must read what the page ships.
  it('claims no trademark it cannot evidence', () => {
    expect(shipped).not.toContain('™');
  });

  // Rule 8's prose and the diagram row must agree about what these are. "AI personas" is the
  // network-standard phrasing — never "real people", which asserts humans did the testing.
  it('calls them AI personas in both places', () => {
    expect(src).toMatch(/AI [Pp]ersonas/);
    expect(src).not.toMatch(/with real people|by real people/);
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
