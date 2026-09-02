/**
 * The turn envelope and the isolating-quote check.
 *
 * Both exist because of failures that had already happened: an envelope one level off (which cost
 * HiveJournal their first real turn) and a flag whose quote was the entire rep line (which
 * satisfied their verbatim guard in the one way that proves nothing).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isolatingQuote } from '@/lib/rehearsal/turn';

const TURN = readFileSync(join(process.cwd(), 'lib/rehearsal/turn.ts'), 'utf8');
const ROUTE = readFileSync(join(process.cwd(), 'app/api/rehearsal/turn/route.ts'), 'utf8');

describe('isolating quote', () => {
  const line = "Honestly, this'll get you on page one for towing in Renton, inside a month.";

  it('accepts a quote that points at part of the line', () => {
    expect(isolatingQuote("this'll get you on page one", line)).toBe(true);
    expect(isolatingQuote("THIS'LL GET YOU ON PAGE ONE", line)).toBe(true); // case is not paraphrase
  });

  it('rejects the whole line, which is the degenerate pass', () => {
    // HJ's guard is haystack.includes(needle); when the needle IS the haystack it cannot fail.
    // The flag is real and tells a rep nothing about WHERE they broke the rule.
    expect(isolatingQuote(line, line)).toBe(false);
    expect(isolatingQuote(`  ${line}  `, line)).toBe(false); // whitespace is not isolation
  });

  it('rejects a quote that is not in the line at all', () => {
    // Belt and braces: HJ drops these, but our renderer must not highlight a span that is absent.
    expect(isolatingQuote('you will rank first', line)).toBe(false);
    expect(isolatingQuote('', line)).toBe(false);
    expect(isolatingQuote(line, '')).toBe(false);
  });
});

describe('the request envelope', () => {
  it('nests the whole artifact under `lane`, with turn fields beside it', () => {
    // Contract §1c. A body one level off does NOT fail where the mistake is: their normalizer
    // accepts the lane id at either depth, so it passes the id check and dies two fields later
    // blaming honesty rules that are merely misplaced.
    expect(TURN).toMatch(/lane:\s*toEngineLaneSpec\(lane\)/);
    for (const field of ['archetype_id:', 'grounding:', 'transcript:', 'rep_said:']) {
      expect(TURN).toContain(field);
    }
    expect(TURN).not.toMatch(/turn:\s*\{/); // the shape that misled HJ
  });

  it('records usage on failure as well as success', () => {
    // A revoked grant surfaces here and nowhere else — the config gate can only see that a value
    // is present, never that it still works.
    const calls = TURN.match(/recordTurnUsage\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3); // network error, http error, success
  });
});

describe('the route', () => {
  it('is admin-gated, because every turn spends money', () => {
    expect(ROUTE).toContain('requireAdmin()');
    expect(ROUTE).toMatch(/gate instanceof Response/);
  });

  it('never lets the caller supply the lane or the credentials', () => {
    // The browser sends a line and an archetype id. If a client could post its own lane, it could
    // post its own honesty rules — i.e. delete them.
    expect(ROUTE).not.toContain('body?.lane');
    expect(ROUTE).not.toContain('partnerHeaders');
  });
});
