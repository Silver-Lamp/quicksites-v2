// lib/repo/__tests__/publicLinks.test.ts
//
// ⚠️ THIS REPO IS PUBLIC, and its README pointed at a GitHub org path that does not exist.
// Four of nine links were dead: three said `Silver-Lamp/quicksites-core` (this repo is
// `quicksites-v2` — the npm package is named quicksites-core, the GitHub path never was) and the
// CI badges also named workflow files that do not exist, so they rendered as broken images. To a
// visitor a broken build badge reads as "this project is broken", not "this badge is wrong".
//
// Deliberately a STRING test, not a link checker. A job that fetches external URLs goes red for
// reasons no pull request caused — rate limits, someone else's outage — and a check that is often
// red gets ignored, which is the failure it exists to prevent. This catches the recurrence class
// (wrong repo path, non-existent workflow) deterministically and offline. Whether a live URL still
// resolves is a different question, and one a scheduled probe should answer, not a unit test.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readme = readFileSync(join(root, 'README.md'), 'utf8');

/** Strip HTML comments — this file's own explanation names the forbidden string, and so does the
 *  README's. Without this, the rule would fail on the note explaining the rule. */
const shipped = readme.replace(/<!--[\s\S]*?-->/g, '');

describe('public README does not advertise things that do not exist', () => {
  it('scans a real README', () => {
    expect(shipped.length).toBeGreaterThan(500);
  });

  it('never links to a github.com/Silver-Lamp/quicksites-core path', () => {
    const hits = shipped.split('\n').filter((l) => /github\.com\/[^/]+\/quicksites-core/.test(l));
    expect(hits).toEqual([]);
  });

  it('every workflow badge names a workflow file that exists', () => {
    const badges = [...shipped.matchAll(/actions\/workflows\/([A-Za-z0-9._-]+\.ya?ml)\/badge\.svg/g)].map((m) => m[1]);
    // A badge-less README is fine; a badge naming a missing file is not.
    for (const file of badges) {
      expect(existsSync(join(root, '.github/workflows', file))).toBe(true);
    }
  });

  it('does not link to GitHub Discussions while Discussions are disabled', () => {
    // Repointing a dead discussions link at the right repo would move the 404, not fix it.
    expect(shipped).not.toMatch(/github\.com\/[^/]+\/[^/]+\/discussions/);
  });

  it('relative doc links resolve on disk', () => {
    const rels = [...shipped.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)].map((m) => m[1].split('#')[0]);
    const missing = rels.filter((r) => r && !existsSync(join(root, r)));
    expect(missing).toEqual([]);
  });
});
