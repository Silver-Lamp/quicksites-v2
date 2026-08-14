// lib/theme/__tests__/blockMass.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blockMass } from '@/lib/theme/blockMass';

describe('blockMass', () => {
  it('calls a one-service block thin — the shape that started this', () => {
    // A Google listing with a single category yields exactly one service, and the block resolves
    // it from template.data.services, not from its own content. Getting that resolution order
    // wrong would silently classify every listing-imported site as `normal`.
    const block = { type: 'services', content: {} };
    const template = { data: { services: ['Car Repair'] } };
    expect(blockMass(block, template)).toBe('thin');
  });

  it('calls a real service list normal', () => {
    const template = { data: { services: ['Brakes', 'Oil change', 'Diagnostics'] } };
    expect(blockMass({ type: 'services', content: {} }, template)).toBe('normal');
  });

  it('reads the block-level list when the site has no services', () => {
    expect(blockMass({ type: 'services', content: { items: ['A', 'B'] } }, {})).toBe('normal');
    expect(blockMass({ type: 'services', content: { items: ['A'] } }, {})).toBe('thin');
  });

  it('always calls a CTA thin — it is one link by construction', () => {
    expect(blockMass({ type: 'cta', content: { label: 'Contact Us', href: '/' } }, {})).toBe('thin');
  });

  it('measures prose in words, not items', () => {
    const short = { type: 'text', content: { value: 'Open six days a week.' } };
    const long = { type: 'text', content: { value: 'word '.repeat(60) } };
    expect(blockMass(short, {})).toBe('thin');
    expect(blockMass(long, {})).toBe('normal');
  });

  it('never thins a block that owns its own vertical rhythm', () => {
    // A hero with one headline is not a thin block, and a menu block fetches its own rows —
    // thinning either on a field count would crush real content.
    for (const type of ['hero', 'header', 'footer', 'contact_form', 'menu', 'about_that']) {
      expect(blockMass({ type, content: {} }, {})).toBe('normal');
    }
  });

  it('defaults an unrecognised block to normal', () => {
    // The failure direction matters: `normal` is today's behaviour, so a block type nobody
    // added here renders exactly as it does now rather than being silently cramped.
    expect(blockMass({ type: 'some_future_block', content: {} }, {})).toBe('normal');
    expect(blockMass({ type: '' }, {})).toBe('normal');
    expect(blockMass(null, undefined)).toBe('normal');
  });

  it('treats an empty services block as thin, not as a crash', () => {
    expect(blockMass({ type: 'services', content: {} }, {})).toBe('thin');
    expect(blockMass({ type: 'faq', content: {} }, {})).toBe('thin');
  });
});

describe('the spacing rules address the section wrapper, not every section', () => {
  const css = readFileSync(join(process.cwd(), 'styles/globals.css'), 'utf8');
  // Every selector line that introduces a mass/density rule.
  const rules = css
    .split('\n')
    .filter((l) => /^\[data-(mass|density)=/.test(l.trim()))
    .map((l) => l.trim());

  it('finds the rules at all', () => {
    // A sweep that matches nothing passes everything below it.
    expect(rules.length).toBeGreaterThanOrEqual(3);
  });

  it.each(rules)('targets .qs-section, never a bare element: %s', (rule) => {
    // ⚠️ THE FIRST VERSION OF THESE RULES SAID `section`, AND IT WAS QUIETLY WRONG.
    // Blocks nest their own <section> elements, several with deliberately zero padding, so
    // "any section" reached inside blocks the rule was never about — it added 128px to the
    // contact block while shrinking the two it was aimed at, and the page got TALLER overall.
    // The net height barely moved, which is exactly what makes it easy to miss: the number
    // you would sanity-check looked roughly unchanged because two real errors cancelled.
    expect(rule).toContain('.qs-section');
    expect(rule).not.toMatch(/(^|[\s,])section[\s,{:]/);
  });

  it('leaves a compact section alone — its caller already chose the spacing', () => {
    const density = rules.filter((r) => r.startsWith('[data-density='));
    expect(density.length).toBeGreaterThan(0);
    for (const rule of density) expect(rule).toContain(':not([data-compact])');
  });

  it('SectionShell emits the hook the rules depend on', () => {
    const shell = readFileSync(join(process.cwd(), 'components/ui/section-shell.tsx'), 'utf8');
    expect(shell).toContain("'qs-section'");
    expect(shell).toContain("data-compact={compact ? '' : undefined}");
  });
});
