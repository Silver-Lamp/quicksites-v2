import { pickHeroCopy, pickFaqItems, pickTestimonials } from '../industryCopy';
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

describe('pickFaqItems', () => {
  it('returns 3 well-formed items with no leftover placeholders', () => {
    const items = pickFaqItems({ industryKey: 'towing' as any, businessName: 'Acme Tow', label: 'Towing' });
    expect(items).toHaveLength(3);
    for (const it of items) {
      expect(it.question.length).toBeGreaterThan(0);
      expect(it.answer).not.toMatch(/\{business\}|\{label\}/);
      expect(it.appearance).toBe('default');
    }
  });
  it('leads with a style-appropriate question for the industry', () => {
    const qs = new Set<string>();
    for (let i = 0; i < 60; i++) {
      for (const it of pickFaqItems({ industryKey: 'towing' as any, label: 'Towing' })) qs.add(it.question);
    }
    expect([...qs].some((q) => /emergency|same-day|fast/i.test(q))).toBe(true);
  });
});

describe('pickTestimonials', () => {
  it('returns 2 seeded testimonials with no leftover placeholders', () => {
    const t = pickTestimonials({ industryKey: 'landscaping' as any, businessName: 'Green Co' });
    expect(t).toHaveLength(2);
    for (const q of t) {
      expect(q.quote).not.toMatch(/\{business\}/);
      expect(q.rating).toBe(5);
      expect(q.avatar_url).toBe('');
    }
  });
});
