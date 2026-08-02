/**
 * @jest-environment node
 */
// SectionShell must not decide text colour.
//
// It used to: `colorMode = 'dark'` emitted a hard-coded `text-white`, and a survey of the
// eleven call sites found NOT ONE passed the prop — so every block built on this shell rendered
// white text regardless of the site's theme. It looked fine only because new sites default to
// dark (CLAUDE.md §7).
//
// On a light-surfaced site the block vanished. That is how it was caught: a published résumé
// page showed forty bullet points with no text next to them. The skills were all in the DOM and
// `innerText` returned them — they were white on a white card. Invisible to `tsc`, obvious in a
// screenshot.
//
// The fix is to emit NO colour, not a different one. `TemplateThemeWrapper` already sets
// `color: hsl(var(--foreground))` inline, so blocks inherit correctly; and a block painting its
// own surface states `text-card-foreground` itself.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL = join(process.cwd(), 'components/ui/section-shell.tsx');
const src = readFileSync(SHELL, 'utf8');
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

describe('SectionShell does not decide text colour', () => {
  it('emits no literal colour utility', () => {
    expect(code).not.toMatch(/'text-white'/);
    expect(code).not.toMatch(/'text-black'/);
  });

  // ⚠️ Not even a semantic one. `text-foreground` and `text-card-foreground` are both
  // single-class utilities of EQUAL specificity, so which wins is decided by Tailwind's compiled
  // order, not the class attribute. Emitting one here re-runs the coin flip that caused the bug
  // — a block on a card surface could lose its `text-card-foreground` again.
  it('does not emit a semantic colour utility either', () => {
    expect(code).not.toMatch(/'text-foreground'/);
  });

  it('has no colorMode prop left to resurrect the default', () => {
    // An unused prop that silently controls colour is how this happened the first time.
    expect(code).not.toContain('colorMode');
  });

  it('still renders a section wrapper and passes className through', () => {
    expect(code).toContain('className');
    expect(code).toContain('<section');
  });
});

// The same hard-coded-colour trap, checked across every block renderer. CLAUDE.md §7 calls this
// out as a bug that never shows up in tsc, only in a screenshot.
describe('block renderers do not hard-code a light surface', () => {
  // ⚠️ BOTH renderer directories. This scanned only the shared block library, so a bespoke
  // whole-page block written for ONE client (`components/sites/render-blocks/`) escaped it —
  // exactly the file most likely to hard-code a colour, since it was designed against one
  // client's palette rather than the theme tokens. A scan scoped by directory misses whatever
  // someone puts in the folder next door.
  const dirs = [
    join(process.cwd(), 'components/admin/templates/render-blocks'),
    join(process.cwd(), 'components/sites/render-blocks'),
  ];
  const files: string[] = dirs.flatMap((d) =>
    require('node:fs')
      .readdirSync(d)
      .filter((f: string) => f.endsWith('.tsx'))
      .map((f: string) => join(d, f)),
  );

  it('scans a real set of renderers (a scan matching nothing reports success)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('covers the bespoke-client renderers too', () => {
    expect(files.some((f) => f.includes('components/sites/render-blocks'))).toBe(true);
  });

  it.each(files as string[])('%s uses no bg-white / literal light fills', (f) => {
    const body = readFileSync(String(f), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    // ⚠️ OPAQUE fills only. An ALPHA tint is the recommended pattern, not the bug — §7 says
    // "prefer alpha tints for colored accents… a tint reads on either theme". The first version
    // of this test used `\bbg-white\b`, which flags `bg-white/90` and `hover:bg-white/20`
    // because `/` counts as a word boundary, and it failed on two files that were doing exactly
    // the right thing (a slider divider, some editor-chrome hover states).
    //
    // Worth knowing: the ready-made grep in CLAUDE.md §7 has the same flaw, so it will cry wolf
    // on correct code too. The negative lookahead is what makes it mean "opaque".
    expect(body).not.toMatch(/className="[^"]*\bbg-white(?![/\w-])/);
    expect(body).not.toMatch(/className="[^"]*\bbg-(zinc|slate|gray)-(50|100)(?![/\w-])/);
  });
});
