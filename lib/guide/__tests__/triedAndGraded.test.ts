/**
 * @jest-environment node
 */
// The guide's copy rules (docs/longevity/MULLEIN_PAGES.md). A health page is the one place a phrase
// is a claim; these fail before a page ships.
import { COMMISSION_LINE, GUIDE_PAGES, QUIT_LINE } from '@/lib/guide/triedAndGraded';

const html = (p: (typeof GUIDE_PAGES)[number]) =>
  p.blocks.map((b) => (b.kind === 'text' ? b.html : b.kind === 'hero' ? `${b.headline} ${b.subheadline}` : '')).join(' ') + ` ${p.title} ${p.description}`;
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// Affirmative claim shapes. The pages may ASK "does mullein detox your lungs?" and answer it; they
// may never assert it.
const FORBIDDEN = [
  /\b(mullein|it|this|our product)\s+(detoxes|cleanses|repairs|heals|protects|clears|strengthens|supports)\b/i,
  /\b(lung|respiratory)\s+(support|health support|cleanse|detox formula)\b/i,
  /\bclinically (proven|tested)\b/i,
  /\bproven to\b/i,
  /\bboosts? (lung|immune)\b/i,
  /\b(undo|reverse)s? (the )?(damage|effects) of smoking\b/i,
];

describe('Tried & Graded copy rules', () => {
  it('has the pages the plan names, each with a title and description', () => {
    const slugs = GUIDE_PAGES.map((p) => p.slug);
    for (const s of ['home', 'mullein-for-smokers', 'does-mullein-detox-your-lungs', 'smoking-mullein', 'does-mullein-work', 'mullein-drops-gummies-capsules-tea', 'mullein-study', 'how-we-grade']) expect(slugs).toContain(s);
    for (const p of GUIDE_PAGES) {
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.description.length).toBeGreaterThan(40);
      expect(p.description.length).toBeLessThanOrEqual(160);
    }
  });
  it('asserts no benefit claim anywhere', () => {
    const hits: string[] = [];
    for (const p of GUIDE_PAGES) for (const re of FORBIDDEN) { const m = text(html(p)).match(re); if (m) hits.push(`${p.slug}: ${m[0]}`); }
    expect(hits).toEqual([]);
  });
  it('types no grade into copy — grades come from evidence blocks', () => {
    // how-we-grade DEFINES the six labels; every other page must get a grade from a block.
    for (const p of GUIDE_PAGES.filter((x) => x.slug !== 'how-we-grade')) {
      for (const b of p.blocks) if (b.kind === 'text') expect(b.html).not.toMatch(/data-grade|>\s*(Established|Promising)\s*</);
    }
    expect(GUIDE_PAGES.find((p) => p.slug === 'mullein-for-smokers')!.blocks.some((b) => b.kind === 'evidence')).toBe(true);
  });
  it('every page that names smokers or smoking carries quit help', () => {
    for (const p of GUIDE_PAGES) if (/smok/i.test(html(p)) && p.slug !== 'home' && p.slug !== 'how-we-grade' && p.slug !== 'mullein-drops-gummies-capsules-tea' && p.slug !== 'does-mullein-work') expect(html(p)).toContain(QUIT_LINE);
  });
  it('the products page states the commission before anything else on it', () => {
    const p = GUIDE_PAGES.find((x) => x.slug === 'mullein-drops-gummies-capsules-tea')!;
    const first = p.blocks.find((b) => b.kind === 'text') as { html: string };
    expect(first.html.indexOf(COMMISSION_LINE)).toBe(first.html.indexOf('<p><em>') + '<p><em>'.length);
  });
  it('the study page never says it is open until it is', () => {
    const p = GUIDE_PAGES.find((x) => x.slug === 'mullein-study')!;
    expect(html(p)).toMatch(/The study is not open yet/);
    expect(text(html(p))).not.toMatch(/\b(sign up now|join now|enroll now|enrol now)\b/i);
  });
});
