/**
 * @jest-environment node
 */

/**
 * ⚠️ WHY THIS TEST EXISTS.
 *
 * Two nightly workflows failed on EVERY run from 2026-02-13 to 2026-09-24 — 60+ consecutive
 * failures each — and nothing told anyone, because the alerting was broken in three independent
 * ways at once:
 *
 *   1. `Nightly Analytics Export` had no failure alerting at all.
 *   2. `Nightly Sitemap Snapshot`'s Slack step needed a `SLACK_WEBHOOK` secret that was never set.
 *      The action logged its own "Secret `SLACK_WEBHOOK` is missing" error and carried on.
 *   3. Its email step was addressed to the literal placeholder `your@email.com`.
 *
 * Each of those is individually easy to miss and none of them is a syntax error, so nothing in CI
 * objected. The failure mode is the one CLAUDE.md §9 keeps naming: a permanently-red row trains you
 * to stop reading the column, and here the alarm that would have broken the habit was itself dead.
 *
 * So: scheduled workflows must alert through a channel that cannot be defeated by unset config, and
 * no workflow may contain a placeholder recipient. A unit test cannot notice an alert that never
 * fires — reading the files can.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), '.github/workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** Workflows that run unattended on a timer — the ones nobody is watching when they break. */
const scheduled = files.filter((f) => /^\s*schedule:/m.test(read(f)));

describe('the workflow set is actually being scanned', () => {
  // A sweep that matches nothing reports success. Both guards below would "pass" on an empty list.
  it('finds workflows, including scheduled ones', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(scheduled.length).toBeGreaterThan(0);
  });
});

describe('no workflow carries a placeholder recipient', () => {
  // `to: your@email.com` sat in a failure-notification step for seven months. It is not a syntax
  // error, it is not a missing secret, and it silently guaranteed the alert went nowhere.
  //
  // ⚠️ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT A CONVENIENCE. The first run of this guard
  // failed on `snapshot-sitemaps.yml` — because the comment explaining that the placeholder was
  // REMOVED quotes the placeholder. That is the precise failure CLAUDE.md §4 records about
  // `ROUTER_STRATEGY.md`: a corrected document trips a mentions-it check by explaining its own
  // correction, and an audit then records "still broken" about something already fixed. The repo's
  // `publicLinks.test.ts` strips comments for the same reason.
  const stripComments = (src: string) =>
    src
      .split('\n')
      .map((l) => l.replace(/(^|\s)#.*$/, ''))
      .join('\n');
  const PLACEHOLDERS = [
    /your@email\.com/i,
    /you@example\.com/i,
    /someone@example\.com/i,
    /changeme@/i,
    /<your[- ]email>/i,
  ];

  it.each(files)('%s', (f) => {
    const src = stripComments(read(f));
    for (const p of PLACEHOLDERS) {
      expect(src).not.toMatch(p);
    }
  });
});

describe('every scheduled workflow alerts through a channel that needs no secret', () => {
  /**
   * The rule is the GUARANTEE, not the mechanism: a job nobody watches must report its own failure
   * without depending on configuration somebody has to remember. Two implementations satisfy it —
   * the shared `./.github/actions/notify-failure`, and `Content Probe`'s inline `gh issue` steps,
   * which predate it and do the same thing. Both use only the built-in token.
   *
   * ⚠️ The first version of this test demanded the shared action by path, and `Content Probe` failed
   * it while being MORE correct than the workflows this test was written for. A guard that fails on
   * correct code is the same trap as the `bg-white` regex CLAUDE.md §7 describes: it trains you to
   * skip the output.
   *
   * ⚠️ Deliberately NOT satisfied by a Slack or email step. Those are fine as extra channels, but
   * they fail open — unset webhook, wrong address, expired token — and failing open is exactly how
   * two jobs ran red for seven months without telling anyone.
   */
  const opensAnIssue = (src: string) =>
    src.includes('.github/actions/notify-failure') || /gh issue create/.test(src);
  const runsOnFailure = (src: string) =>
    /if:\s*\$\{\{\s*failure\(\)\s*\}\}/.test(src) || /outcome\s*==\s*'failure'/.test(src);

  it.each(scheduled)('%s reports its own failure', (f) => {
    const src = read(f);
    expect(opensAnIssue(src)).toBe(true);
    expect(runsOnFailure(src)).toBe(true);
  });

  it.each(scheduled)('%s can open an issue', (f) => {
    // Without `issues: write` the notify step 403s — an alert that fails to alert.
    expect(read(f)).toMatch(/issues:\s*write/);
  });
});

describe('the notify action itself', () => {
  const action = readFileSync(
    join(process.cwd(), '.github/actions/notify-failure/action.yml'),
    'utf8'
  );

  it('reuses one issue instead of opening one per night', () => {
    // These run daily. Opening an issue per failure would have produced ~220 of them over the
    // period this was broken — which is its own kind of silence, the kind you mute.
    expect(action).toContain('gh issue list');
    expect(action).toContain('gh issue comment');
  });

  it('uses only the built-in token', () => {
    expect(action).toContain('GITHUB_TOKEN');
    expect(action).not.toMatch(/secrets\.SLACK_WEBHOOK|secrets\.EMAIL_/);
  });
});
