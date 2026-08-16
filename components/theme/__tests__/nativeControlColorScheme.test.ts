// Native controls are painted by the browser, not by our tokens.
//
// A checkbox, radio, scrollbar or date picker takes its colours from the CSS `color-scheme`
// property. No semantic token reaches them, so a site can have every `bg-card` and
// `text-foreground` perfectly correct and still render a BLACK checkbox on a white menu —
// which is exactly what was reported on the lemonade stand's add-ons.
//
// app/layout.tsx declares `<meta name="color-scheme" content="light dark">` at the document
// level, and the app chrome is always dark, so anything that does not scope `color-scheme`
// itself inherits dark. Every wrapper that establishes a SITE's theme must therefore set both:
// `data-theme` for what we draw, `colorScheme` for what the browser draws.
//
// This is the same blind spot as the cart FAB and SectionShell — invisible while the fleet is
// dark — now in a third layer, which is why it gets a test rather than a comment.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

/** Wrappers whose job is to establish a tenant site's light/dark. */
const THEME_SCOPES = [
  'components/theme/template-theme-wrapper.tsx',
  'components/sites/site-theme-shell.tsx',
];

describe('site theme scopes set color-scheme for native controls', () => {
  it.each(THEME_SCOPES)('%s sets colorScheme from the site mode', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    // It must set colorScheme...
    expect(src).toMatch(/colorScheme:/);
    // ...from the resolved mode, not pinned to a literal. A hardcoded 'light' or 'dark' here
    // would be the original bug with a different default.
    expect(src).toMatch(/colorScheme:\s*colorMode/);
    expect(src).not.toMatch(/colorScheme:\s*['"](light|dark)['"]/);
  });

  it('every scope that sets data-theme also sets colorScheme', () => {
    // The pairing is the invariant: one governs what we draw, the other what the browser draws.
    // A scope with only the first looks right until a native control appears inside it.
    for (const rel of THEME_SCOPES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).toMatch(/data-theme=/);
      expect(src).toMatch(/colorScheme/);
    }
  });
});
