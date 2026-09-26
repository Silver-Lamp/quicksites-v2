/**
 * @jest-environment node
 *
 * THE STRIPPER THAT EVERY SOURCE GUARD DEPENDS ON.
 *
 * ⚠️ It had two defects in one afternoon, and the second is the frightening kind: a stripper that
 * silently deletes CODE makes every `expect(src).not.toMatch(forbidden)` pass for the wrong
 * reason. The guard reports the file is clean because half of it is gone. Both are pinned here.
 */
import { stripComments } from '@/test/stripComments';

describe('what it removes', () => {
  it('removes line comments', () => {
    expect(stripComments('const a = 1;\n// secret\nconst b = 2;')).not.toMatch(/secret/);
  });

  it('removes block comments', () => {
    expect(stripComments('const a = 1;\n/* secret */\nconst b = 2;')).not.toMatch(/secret/);
  });

  it('removes a JSX comment body', () => {
    const out = stripComments('<a/>\n{/* secret */}\n<b/>');
    expect(out).not.toMatch(/secret/);
    expect(out).toMatch(/<a\/>/);
    expect(out).toMatch(/<b\/>/);
  });
});

describe('⚠️ what it must NEVER remove', () => {
  // DEFECT 1. A TypeScript type literal whose first member carries a JSDoc comment opens exactly
  // like a JSX comment: `{` + whitespace + `/*`. A rule that also ate the braces matched from
  // there to the next `*/}` anywhere later in the file. On industry-picker.tsx that removed
  // 3,387 of 6,829 characters, including a keyboard handler under test.
  it('keeps code between a JSDoc-ed props type and a later JSX comment', () => {
    const src = [
      '}: {',
      '  /** Current industry key. */',
      '  value: string;',
      '}) {',
      "  const KEEP_ME = 'ArrowDown';",
      '  return <div>{/* a jsx comment */}</div>;',
      '}',
    ].join('\n');
    const out = stripComments(src);
    expect(out).toContain('ArrowDown');
    expect(out).toContain('value: string;');
    expect(out).not.toMatch(/Current industry key/);
    expect(out).not.toMatch(/a jsx comment/);
  });

  // DEFECT 2. A line comment may legitimately CONTAIN `/*`. Stripping blocks first turns it into
  // a phantom comment opener that runs to the next real `*/`, taking the code between with it.
  // The real instance: "// One page, not a second /alternatives/* route: …".
  it('keeps code after a line comment that contains a block-comment opener', () => {
    const src = [
      '// One page, not a second /alternatives/* route: Google ranks one URL for both',
      "const TITLE = 'alternative — QuickSites';",
      '<div>{/* later jsx comment */}</div>',
      "const AFTER = 'still here';",
    ].join('\n');
    const out = stripComments(src);
    expect(out).toContain('alternative — QuickSites');
    expect(out).toContain('still here');
    expect(out).not.toMatch(/One page, not a second/);
  });

  it('does not eat a URL, because the line rule is anchored', () => {
    const src = "const u = 'https://example.com/x';\nconst v = 2;";
    expect(stripComments(src)).toContain('https://example.com/x');
    expect(stripComments(src)).toContain('const v = 2;');
  });
});

describe('⚠️ the property that makes a silent failure loud', () => {
  it('never returns dramatically less than it was given, for comment-light source', () => {
    // A guard that reads a mostly-stripped file passes vacuously. Callers are told to assert a
    // minimum length for this reason; this is the same check on the helper itself.
    const src = Array.from({ length: 40 }, (_, i) => `const x${i} = ${i};`).join('\n');
    expect(stripComments(src).replace(/\s/g, '').length).toBeGreaterThan(
      src.replace(/\s/g, '').length * 0.9,
    );
  });
});
