// The value of a PDF upload is entirely in whether the text comes out in the right ORDER.
// Extraction that returns every word but scrambles them is worse than no upload at all: the
// person gets a page built from a plausible-looking job history that isn't theirs, and the
// deterministic parser downstream — which exists precisely so nothing about someone's
// employment gets invented — faithfully preserves the scramble.
//
// (Imported from pdfLines, the pure half — pdfText.ts sets a worker URL via import.meta.url,
// which the test runner can't require. That split is why this test can exist at all.)
// So these tests feed pdfjs-shaped glyph runs (a string plus a 6-element transform whose
// [4] and [5] are x and y) and assert the reading order, not the character count.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linesFromItems, classifyExtraction, THIN_CHARS_PER_PAGE, type TextItemLike } from '../pdfLines';
import { profileFromResume } from '../importResume';

/** pdfjs transform: [a, b, c, d, x, y]. Only x/y matter to us. */
const at = (str: string, x: number, y: number): TextItemLike => ({ str, transform: [1, 0, 0, 1, x, y] });

describe('linesFromItems', () => {
  it('reads top-down, because PDF y grows upward', () => {
    // Supplied bottom-first to prove we sort rather than trusting document order.
    expect(linesFromItems([at('Bottom', 0, 100), at('Top', 0, 700)])).toEqual(['Top', 'Bottom']);
  });

  it('reads left-to-right within a line', () => {
    expect(linesFromItems([at('World', 200, 700), at('Hello', 10, 700)])).toEqual(['Hello World']);
  });

  it('treats glyph runs a couple of points apart as one line', () => {
    // Sub/superscripts and font switches jitter the baseline; 700 and 701 are one visual line.
    expect(linesFromItems([at('Senior', 10, 700), at('Engineer', 60, 701)])).toEqual(['Senior Engineer']);
  });

  it('does NOT merge separate lines', () => {
    expect(linesFromItems([at('One', 10, 700), at('Two', 10, 680)])).toEqual(['One', 'Two']);
  });

  // ⚠️ THE BUG THIS FUNCTION EXISTS FOR. A two-column résumé stores runs in document order,
  // which commonly alternates columns. Naive concatenation yields
  // "Acme Corp 2019–2022 Senior Engineer Built the thing" — a real employer glued to the wrong
  // dates. This is the regression to keep.
  it('keeps a two-column layout in reading order despite interleaved document order', () => {
    const scrambled: TextItemLike[] = [
      at('Acme Corp', 40, 700), // left column, row 1
      at('2019–2022', 400, 700), // right column, row 1
      at('Senior Engineer', 40, 680), // left column, row 2
      at('Remote', 400, 680), // right column, row 2
    ];
    expect(linesFromItems(scrambled)).toEqual(['Acme Corp 2019–2022', 'Senior Engineer Remote']);
  });

  it('survives items missing a transform without throwing', () => {
    // Real PDFs contain marked-content and whitespace items with odd shapes.
    expect(linesFromItems([{ str: 'Kept' } as TextItemLike, { str: '   ' }, {}])).toEqual(['Kept']);
  });

  it('drops whitespace-only runs instead of emitting blank lines', () => {
    expect(linesFromItems([at('  ', 10, 700), at('Real', 10, 680)])).toEqual(['Real']);
  });

  it('collapses runs of internal whitespace', () => {
    expect(linesFromItems([at('A   B', 10, 700)])).toEqual(['A B']);
  });
});

// The upload is only worth shipping if extracted text reaches the existing parser intact — the
// point of routing a PDF into the same textarea is that nothing downstream had to change.
describe('extracted text feeds the résumé parser unchanged', () => {
  it('round-trips a plausible PDF into a profile', () => {
    const items: TextItemLike[] = [
      at('Dana Okafor — Staff Engineer', 40, 760),
      at('dana@example.com', 40, 740),
      at('Skills', 40, 700),
      at('Mobile: React Native · Expo · Swift', 40, 680),
      at('Experience', 40, 640),
      at('Acme Corp', 40, 620),
      at('2019–2022', 400, 620),
    ];
    const text = linesFromItems(items).join('\n');
    const profile = profileFromResume({ resumeText: text });

    expect(profile.name).toBe('Dana Okafor');
    expect((profile as any).email).toBe('dana@example.com');
    // The category prefix is stripped, and the right-column dates stayed with their employer.
    expect((profile as any).skills).toEqual(expect.arrayContaining(['React Native', 'Expo', 'Swift']));
    expect(JSON.stringify((profile as any).experience)).toContain('2019–2022');
  });

  it('still refuses to invent a name when the PDF has none', () => {
    // An image-only or headerless PDF must not produce a confidently wrong About-Me page.
    const text = linesFromItems([at('Skills', 40, 700), at('Rust · Go', 40, 680)]).join('\n');
    expect(profileFromResume({ resumeText: text }).name).toBeNull();
  });
});

// ⚠️ EVERY TEST ABOVE FEEDS SYNTHETIC ITEMS, WHICH MEANS THEY ALL ENCODE ONE ASSUMPTION: that
// pdfjs returns `{ str, transform }` with x at transform[4] and y at transform[5]. If that
// assumption is wrong — or a later pdfjs major changes it — the synthetic suite keeps passing
// while the feature is broken for every real user. A suite that only tests my own beliefs about
// a library verifies nothing about the library.
//
// So this drives the REAL library over a REAL PDF: fixtures/two-column-resume.pdf, generated
// with pdfkit, whose employer sits at x=50 and dates at x=400 on a shared baseline. pdfjs is
// ESM-only and the runner is CJS, so it runs in a subprocess (scripts/pdf-items-probe.mjs) —
// the same approach verify-image-assets.mjs uses for its self-test.
describe('real pdfjs over a real PDF', () => {
  const fixture = join(__dirname, 'fixtures/two-column-resume.pdf');
  const probe = join(process.cwd(), 'scripts/pdf-items-probe.mjs');

  let out: { numPages: number; pages: TextItemLike[][] };
  beforeAll(() => {
    const res = spawnSync('node', [probe, fixture], { encoding: 'utf8', timeout: 60_000 });
    // Fail loudly rather than skipping: a probe that silently stops running would quietly
    // return this file to synthetic-only coverage, which is the exact gap it exists to close.
    expect(res.status).toBe(0);
    out = JSON.parse(res.stdout);
  }, 60_000);

  it('returns the item shape the reconstruction depends on', () => {
    expect(out.numPages).toBe(1);
    const items = out.pages[0];
    expect(items.length).toBeGreaterThan(0);
    expect(typeof items[0].str).toBe('string');
    expect(items[0].transform).toHaveLength(6);
    expect(typeof items[0].transform![4]).toBe('number'); // x
    expect(typeof items[0].transform![5]).toBe('number'); // y
  });

  it('reconstructs the two-column rows and parses to the right person', () => {
    const lines = linesFromItems(out.pages[0]);
    // Employer and dates share a baseline, so they must land on ONE line together — and the
    // employer must not have collected the next row's job title.
    expect(lines).toContain('Acme Corp 2019–2022');
    expect(lines).toContain('Senior Engineer Remote');

    const profile = profileFromResume({ resumeText: lines.join('\n') });
    expect(profile.name).toBe('Dana Okafor');
    expect((profile as any).email).toBe('dana@example.com');
    expect((profile as any).skills).toEqual(expect.arrayContaining(['React Native', 'Expo', 'Swift']));
  });
});

// ⚠️ THE REGRESSION THAT ALREADY HAPPENED ONCE. The first version of this feature classified
// anything under 200 characters as "looks like a scan", and the UI responded by DISCARDING the
// extracted text and telling the person their file had no text in it. It met a real 142-character
// résumé — which it had just extracted perfectly — and did exactly that. Twelve passing tests
// didn't catch it, because they all tested reconstruction and none tested what we then SAID
// about the result. These tests hold the two rules that came out of it.
describe('classifyExtraction reports a measurement, not a diagnosis', () => {
  it('calls it empty only when there is genuinely nothing', () => {
    expect(classifyExtraction('', 1)).toBe('empty');
    expect(classifyExtraction('   \n\t ', 1)).toBe('empty');
  });

  it('does NOT call a short-but-real résumé empty', () => {
    // The exact shape of the bug: 142 real characters must never be reported as no-text, because
    // the caller is entitled to keep and show anything that isn't 'empty'.
    const real = 'Dana Okafor — Staff Engineer dana@example.com Skills Mobile: React Native · Expo · Swift Experience Acme Corp 2019–2022 Senior Engineer Remote';
    expect(real.length).toBeLessThan(THIN_CHARS_PER_PAGE);
    expect(classifyExtraction(real, 1)).toBe('thin');
    expect(classifyExtraction(real, 1)).not.toBe('empty');
  });

  it('scales with page count, because "thin" is relative to how much page there was', () => {
    const text = 'x'.repeat(300);
    expect(classifyExtraction(text, 1)).toBe('ok'); // plenty for one page
    expect(classifyExtraction(text, 4)).toBe('thin'); // sparse across four
  });

  it('never divides by zero on a malformed page count', () => {
    expect(classifyExtraction('x'.repeat(300), 0)).toBe('ok');
  });
});

// Rule 1 is enforced at the call site, so assert the call site. A future edit that "tidies" the
// handler by discarding short text would pass every test above and reintroduce the whole bug.
describe('the intake never throws away extracted text', () => {
  const src = readFileSync(join(process.cwd(), 'app/verbatim/intake.tsx'), 'utf8');

  it('bails out only on the empty case', () => {
    // A bare `return` inside the handler is how text gets dropped. There must be exactly one...
    const handler = src.slice(src.indexOf('const onPickPdf'), src.indexOf('} finally {'));
    expect(handler.match(/^\s+return;$/gm) ?? []).toHaveLength(1);

    // ...and the condition guarding it must test empty AND NOTHING ELSE. Asserting merely that
    // the string "quality === 'empty'" appears is too weak: widening the guard to
    // `quality === 'empty' || quality === 'thin'` — which is precisely the original bug —
    // leaves that substring intact and sails past. Verified by making that exact edit and
    // watching this test go red.
    const at = handler.indexOf('if (quality');
    const cond = handler.slice(at, handler.indexOf('\n', at)).trim();
    expect(cond).toBe("if (quality === 'empty') {");
  });

  it('sets the text for anything that is not empty', () => {
    const handler = src.slice(src.indexOf('const onPickPdf'), src.indexOf('} finally {'));
    // setResumeText must come after the empty-guard, unconditionally.
    expect(handler.indexOf("quality === 'empty'")).toBeLessThan(handler.indexOf('setResumeText(text)'));
  });

  it('does not claim a scan when it only knows the text was short', () => {
    const thin = src.slice(src.indexOf("quality === 'thin'"), src.indexOf("PDFs don’t always"));
    expect(thin).not.toMatch(/scan|image/i);
  });
});
