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

// The MIRROR of the bug above, which bit on 2026-08-09: a renderer hard-coding the DARK palette.
//
// `menu_finder` used text-zinc-100/300/400 and bg-zinc-900/60 throughout. On the dark sites it was
// written against it looked right; on `renton-restaurant`, a LIGHT tenant site, the search input
// became a grey slab with dark text inside it and the confirmation message was pale green on
// near-white. Same root cause as SectionShell's `text-white`, same invisibility to tsc — and the
// same reason: a tenant site is not always dark, only the admin chrome is.
//
// ⚠️ THE CHECK IS FILE-LEVEL, ON PURPOSE, BECAUSE A PER-CLASS RULE WOULD CRY WOLF. Six renderers
// legitimately use `text-neutral-300` and friends — every one of them pairs it with a `dark:`
// variant or a `colorMode`/`dark ?` ternary, which is the documented correct pattern. Flagging the
// utility itself would fail all six and train everyone to ignore the output, which the test above
// already learned the hard way. What is actually diagnostic is a file that reaches for the dark
// palette while showing NO awareness that a light theme exists.
describe('block renderers do not hard-code the dark palette either', () => {
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

  /** Light-theme text on a dark-only neutral — invisible on a light tenant site. */
  const DARK_ONLY_TEXT = /\btext-(zinc|slate|gray|neutral)-(100|200|300)\b/;
  /**
   * Any sign the file knows a light theme exists.
   *
   * ⚠️ A DECLARED-BUT-UNUSED `colorMode` DOES NOT COUNT, and finding that out is the reason this
   * test is worth having. The first version of it passed on the very file that caused the bug:
   * `menu-finder` declared `colorMode?: 'light' | 'dark'` in its props and never read it once, so
   * a substring match for "colorMode" said theme-aware while every colour in the file was
   * hard-coded dark. That is the same unused-prop trap SectionShell fell into — an unused prop
   * that appears to control colour is worse than no prop, because it answers the question a
   * reviewer was about to ask. So a mode name must appear at least TWICE (a declaration plus a
   * use); `dark:` is real use by definition.
   */
  const MODE_NAMES = /\b(colorMode|isDark|effectiveMode)\b/g;
  const REAL_DARK_VARIANT = /\bdark:|\bdark\s*\?/;

  function isThemeAware(body: string): boolean {
    if (REAL_DARK_VARIANT.test(body)) return true;
    return (body.match(MODE_NAMES) ?? []).length >= 2;
  }

  it.each(files as string[])('%s pairs any dark-palette text with a light path', (f) => {
    const body = readFileSync(String(f), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    if (!DARK_ONLY_TEXT.test(body)) return; // nothing to check
    expect(isThemeAware(body)).toBe(true);
  });

  // ⚠️ The guard must be able to go red. Asserting that live code passes proves nothing about
  // whether the check works — this replays the actual pre-fix file shape and requires a failure.
  it('fails the shape that caused the bug (a dark palette + an unused colorMode)', () => {
    const preFix = `
      type Props = { colorMode?: 'light' | 'dark' };
      export default function Block() {
        return <div className="bg-zinc-900/60 text-zinc-300"><p className="text-zinc-100">hi</p></div>;
      }`;
    expect(DARK_ONLY_TEXT.test(preFix)).toBe(true);
    expect(isThemeAware(preFix)).toBe(false);
  });
});

// ⚠️ `dark:` DOES NOT WORK IN A TENANT BLOCK RENDERER, AND IT FAILS SILENTLY IN THE WRONG
// DIRECTION. `app/providers.tsx` puts `.dark` on <html> for the whole app, so on a LIGHT tenant
// site — measured on renton-restaurant.delivered.menu, `html.className === "dark"` while the
// site's own scope is `data-theme="light"` — every `dark:` utility is pinned ON. A block pairing
// `text-sky-800 dark:text-sky-200` therefore renders the pale shade on a white page, which is
// exactly the contrast bug the pairing was supposed to prevent. CLAUDE.md §7 states this for a
// page with its own toggle; it is true of every tenant renderer, because a tenant theme is set by
// a `data-theme` wrapper and never by the `.dark` class.
//
// The fix is theme TOKENS (`text-foreground`, `text-primary`), which follow the scope. Alpha tints
// still carry the accent colour; only the text needs a token.
describe('block renderers do not rely on dark: to fix contrast', () => {
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

  // ⚠️ ZERO, and it got here by being FIXED rather than by the baseline being generous. The
  // frozen count was 10 — all of them light-first pairs like `text-emerald-600
  // dark:text-emerald-300`, which is the documented-correct pattern everywhere EXCEPT a tenant
  // site, where `app/providers.tsx` pins `.dark` on <html> and the dark shade therefore always
  // wins. On a light tenant page each of those rendered its pale variant on a pale tint: the
  // exact contrast bug the pairing exists to prevent. Now theme tokens, which follow the site's
  // own `data-theme` scope.
  const KNOWN_DARK_VARIANT_USERS = 0;

  const users = files.filter((f) =>
    /\bdark:(text|bg|border)-/.test(
      readFileSync(String(f), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n'),
    ),
  );

  it('does not grow the number of renderers betting on dark:', () => {
    expect(users.length).toBeLessThanOrEqual(KNOWN_DARK_VARIANT_USERS);
  });

  it('menu-finder in particular uses tokens, not dark: (the file this was found on)', () => {
    const body = readFileSync(
      join(process.cwd(), 'components/admin/templates/render-blocks/menu-finder.tsx'),
      'utf8',
    );
    expect(body).not.toMatch(/\bdark:(text|bg|border)-/);
  });
});
