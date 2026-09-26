/**
 * @jest-environment node
 *
 * BOTH COMPARISON PHRASINGS HAVE TO SURVIVE IN THE METADATA, NOT JUST IN A COMMENT.
 *
 * ⚠️ The failure this exists to prevent already happened, silently, for the life of the cluster.
 * `app/compare/[slug]/page.tsx` said in its header that these were the pages for "wix alternative".
 * They were not — the word appeared in that comment and nowhere a crawler reads. Nothing failed,
 * because a comment compiles.
 *
 * Search Console settled it 2026-09-26: across 394 distinct queries, **zero** impressions for any
 * `<vendor> alternative`, while `duda vs wix` alone drew 94. That zero was the absence of a page.
 *
 * ⚠️ Comments are stripped before matching (test/stripComments.ts) — otherwise this test would pass
 * on the very comment whose lie it exists to catch, which is the entire point.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import { COMPETITORS } from '@/lib/compare/competitors';

const root = process.cwd();
const PAGE = stripComments(readFileSync(join(root, 'app/compare/[slug]/page.tsx'), 'utf8'));

describe('the source actually says it', () => {
  it('did not strip away the whole file', () => {
    // A stripper that ate its input would make every assertion below vacuously true.
    expect(PAGE.length).toBeGreaterThan(2000);
    expect(PAGE).toContain('generateMetadata');
  });

  it('the <title> carries BOTH "<Name> alternative" and "QuickSites vs <Name>"', () => {
    // One page, two intents. Someone searching "duda vs wix" is choosing between two products that
    // are not us; someone searching "duda alternative" has already decided to leave. The second is
    // the audience, and it was the one we were not addressing.
    expect(PAGE).toMatch(/title: `\$\{c\.name\} alternative — QuickSites vs \$\{c\.name\}/);
  });

  it('the description opens on the switching intent', () => {
    expect(PAGE).toMatch(/description: `Looking for a \$\{c\.name\} alternative\?/);
  });

  it('the body says it too, as a sentence a person would write', () => {
    // Metadata alone is thin; the phrase has to appear in rendered copy. But it is deliberately
    // NOT jammed into the H1 — the H1 states what the page is.
    expect(PAGE).toMatch(/Looking for a/);
    expect(PAGE).toMatch(/alternative/);
  });

  // ⚠️ THE PHRASE MUST BE ONE TEXT NODE. `{c.name} alternative` looks identical in the source and
  // renders as `Duda<!-- --> alternative`: React inserts a comment between an expression and the
  // text beside it. A browser parses that back into one phrase, so the page is not broken — but
  // the raw HTML no longer CONTAINS the string, so no grep, audit or source guard of ours can see
  // it. That is the tag-boundary failure from CLAUDE.md §8, where a live-claim sweep missed 20
  // strings for the same reason. A single interpolated template literal emits one text node.
  it('builds "<Name> alternative" as ONE interpolated string, not an expression beside text', () => {
    expect(PAGE).toMatch(/\{`\$\{c\.name\} alternative`\}/);
    expect(PAGE).not.toMatch(/>\{c\.name\} alternative</);
  });

  it('keeps the H1 as the comparison, not a keyword sandwich', () => {
    expect(PAGE).toMatch(/<h1[\s\S]{0,200}QuickSites <span[^>]*>vs<\/span> \{c\.name\}/);
    // If "alternative" ever lands inside the h1 element, someone has started stuffing.
    const h1 = PAGE.slice(PAGE.indexOf('<h1'), PAGE.indexOf('</h1>'));
    expect(h1).not.toMatch(/alternative/i);
  });
});

describe('it applies to every competitor, because it is generated', () => {
  it('there are competitors to generate for', () => {
    expect(COMPETITORS.length).toBeGreaterThanOrEqual(9);
  });

  it('every competitor has a name the phrasing can be built from', () => {
    for (const c of COMPETITORS) {
      expect(typeof c.name).toBe('string');
      expect(c.name.trim().length).toBeGreaterThan(1);
      // "<Name> alternative" has to read as English. A name ending in punctuation would not.
      expect(c.name).not.toMatch(/[.,;:]$/);
    }
  });
});
