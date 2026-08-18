// lib/ci/prClaims.ts
//
// Does this PR body say what it is betting on?
//
// ⚠️ THIS CHECK IS DELIBERATELY SATISFIABLE BY THE AUTHOR ALONE, AND THAT IS NOT AN OVERSIGHT.
// A check you can clear by writing one honest line is trivially "gameable", and someone
// conscientious will eventually want to harden it into something a second party must satisfy.
// Don't. `main`'s ruleset already carries a rule that CANNOT be satisfied — there is one human, so
// `required_approvals=1` is unmeetable — and the observable result is that `gh pr merge --admin`
// became routine. A rule that can only ever be bypassed teaches bypassing, and the cost is not the
// PR it waved through; it's that the bypass stops feeling like an exception.
//
// So the goal here is DELIBERATION, not enforcement. The check exists to make you spend ten seconds
// naming your weakest assumption, because across a month of this mesh's actual mistakes, the
// failures were not code defects — they were *claims that didn't survive someone who didn't share
// the assumption*: a true count of the wrong population, a claim about a query set rather than the
// data, correct advice aimed at the wrong noun. None of those is catchable by reading a diff. All of
// them are catchable by reading a sentence someone was willing to write down.
//
// ⚠️ It also cannot actually block anything, and you should know that before trusting it: the
// ruleset's `bypass_actors` are `OrganizationAdmin/always` and `RepositoryRole/always`, so `--admin`
// bypasses required status checks too — not just approvals. Every gate available to us is a speed
// bump whose entire value is that stepping over it is a visible, deliberate act. That argues for few
// gates that each mean something, rather than a graded system nobody reads.
//
// Convention: a `## Claims` heading followed by at least one non-empty, non-comment line.
// `none` is a legal and expected value for a typo fix — visible, cheap, and legible later if it
// turns up on a money-path PR.

export type ClaimsVerdict =
  | { ok: true; claims: string[] }
  | { ok: false; reason: 'missing_heading' | 'empty_section' };

/** Strip HTML comments so the template's own guidance can't satisfy the rule it explains. */
function stripComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Read the `## Claims` section out of a PR body.
 *
 * Accepts any heading level (`#`–`######`) and any capitalisation, because rejecting a PR over
 * `### claims` would be the check fighting the author instead of prompting them.
 */
export function readClaims(body: string | null | undefined): ClaimsVerdict {
  const text = stripComments(body ?? '');
  const lines = text.split(/\r?\n/);

  const start = lines.findIndex((l) => /^\s{0,3}#{1,6}\s*claims\b/i.test(l));
  if (start === -1) return { ok: false, reason: 'missing_heading' };

  const claims: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // Stop at the next heading of any level — the section is over.
    if (/^\s{0,3}#{1,6}\s/.test(line)) break;
    const cleaned = line
      .replace(/^\s*[-*+]\s+/, '')   // bullet
      .replace(/^\s*\d+[.)]\s+/, '') // ordered item
      .trim();
    // A lone checkbox skeleton from a template is not a claim.
    if (!cleaned || /^\[[ xX]?\]$/.test(cleaned)) continue;
    claims.push(cleaned);
  }

  if (claims.length === 0) return { ok: false, reason: 'empty_section' };
  return { ok: true, claims };
}

/** Message shown in CI. Says what to do, not merely what went wrong. */
export function explain(v: ClaimsVerdict): string {
  if (v.ok) {
    const n = v.claims.length;
    return `Claims block found (${n} ${n === 1 ? 'line' : 'lines'}).`;
  }
  const why =
    v.reason === 'missing_heading'
      ? 'No `## Claims` section in the PR description.'
      : 'The `## Claims` section is empty.';
  return [
    why,
    '',
    'Add a `## Claims` section saying what this PR is betting on — one to three lines,',
    'each one something a reader could go and check. For example:',
    '',
    '    ## Claims',
    '    - Refund events carry no payment id, so leaving it undefined is correct, not an omission.',
    '    - No existing rows violate the new uniqueness key (checked against prod).',
    '',
    'If the change genuinely bets on nothing, that is a legal answer:',
    '',
    '    ## Claims',
    '    none',
    '',
    'This is satisfiable by you alone, on purpose — the point is to name your weakest',
    'assumption, not to get permission. See lib/ci/prClaims.ts for why it is built that way.',
  ].join('\n');
}
