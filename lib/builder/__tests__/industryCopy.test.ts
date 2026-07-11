import { pickHeroCopy } from '../industryCopy';
import { industryStyle } from '../industryStyle';

describe('industryStyle', () => {
  it('classifies representative industries', () => {
    expect(industryStyle('towing')).toBe('urgency');
    expect(industryStyle('legal')).toBe('trust');
    expect(industryStyle('landscaping')).toBe('visual');
    expect(industryStyle('author')).toBe('generic');
    expect(industryStyle(null)).toBe('generic');
  });
});

describe('pickHeroCopy', () => {
  it('substitutes {label}/{business} and never leaves placeholders', () => {
    const c = pickHeroCopy({ industryKey: 'towing' as any, label: 'Towing', businessName: 'Acme Tow', rng: () => 0 });
    expect(c.subheadline).not.toMatch(/\{label\}|\{business\}/);
    expect(c.subheadline.toLowerCase()).toContain('towing');
    expect(c.ctaText.length).toBeGreaterThan(0);
  });

  it('produces several distinct subheadlines + CTAs across runs (copy variety)', () => {
    const subs = new Set<string>();
    const ctas = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = pickHeroCopy({ industryKey: 'landscaping' as any, label: 'Landscaping', businessName: `Biz ${i}` });
      subs.add(c.subheadline);
      ctas.add(c.ctaText);
    }
    expect(subs.size).toBeGreaterThanOrEqual(4);
    expect(ctas.size).toBeGreaterThanOrEqual(3);
  });

  it('can surface style-appropriate CTAs (e.g. "Call Now" for urgency trades)', () => {
    const ctas = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = (i + 0.5) / 200;
      ctas.add(pickHeroCopy({ industryKey: 'towing' as any, label: 'Towing', rng: () => r }).ctaText);
    }
    expect(ctas.has('Call Now')).toBe(true);
  });
});
