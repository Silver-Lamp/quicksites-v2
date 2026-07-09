/**
 * @jest-environment node
 */
// L3 page-composition archetypes: variety + validity guards.
import { buildIndustryStarter, pickArchetype } from '@/lib/builder/industryScaffold';

const KNOWN = new Set([
  'hero', 'services', 'faq', 'contact_form', 'story', 'testimonial', 'cta',
  'menu', 'location', 'hours', 'order_bar', 'products_grid', 'section', 'text',
]);

const types = (tpl: any): string[] => tpl.data.pages[0].blocks.map((b: any) => b.type);

describe('pickArchetype', () => {
  it('rng→0 selects the highest-weighted archetype for the category', () => {
    expect(pickArchetype('editorial', () => 0)).toBe('story_led');
    expect(pickArchetype('professional', () => 0)).toBe('classic');
    expect(pickArchetype('rugged', () => 0)).toBe('classic');
    expect(pickArchetype('neon', () => 0)).toBe('conversion');
  });

  it('always returns a valid archetype', () => {
    for (const cat of ['editorial', 'warm', 'professional', 'playful', 'neon', 'rugged'] as const) {
      for (let i = 0; i < 20; i++) {
        const a = pickArchetype(cat, () => i / 20);
        expect(['classic', 'story_led', 'proof_led', 'conversion']).toContain(a);
      }
    }
  });
});

describe('buildIndustryStarter composition', () => {
  it('a service business always has hero-first, services, contact, and only known block types', () => {
    for (let i = 0; i < 40; i++) {
      const tpl = buildIndustryStarter({ businessName: 'Grafton', industryKey: 'towing' });
      const t = types(tpl);
      expect(t[0]).toBe('hero');
      expect(t).toContain('services');
      expect(t).toContain('contact_form');
      expect(t).not.toContain('menu');
      for (const bt of t) expect(KNOWN.has(bt)).toBe(true);
    }
  });

  it('produces more than one distinct composition across runs (variety)', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 60; i++) {
      shapes.add(types(buildIndustryStarter({ businessName: 'Grafton', industryKey: 'painting' })).join(','));
    }
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('stamps the theme layout personality so the renderer can vary structure', () => {
    const tpl = buildIndustryStarter({ businessName: 'Grafton', industryKey: 'auto_repair', themeId: 'ironworks' });
    expect(tpl.data.meta.theme.layout).toMatchObject({ rhythm: 'banded', featureVariant: 'rows' });
  });

  it('split-layout themes get a real 2-column section after the hero', () => {
    // meridian = professional → heroLayout 'split'
    const tpl = buildIndustryStarter({ businessName: 'Grafton', industryKey: 'legal', themeId: 'meridian' });
    const blocks = tpl.data.pages[0].blocks;
    const section = blocks.find((b: any) => b.type === 'section');
    expect(section).toBeTruthy();
    expect(Array.isArray(section.content.columns)).toBe(true);
    expect(section.content.columns.length).toBe(2);
    // each column holds child blocks
    expect(section.content.columns[0].items.length).toBeGreaterThan(0);
    // and it sits right after the hero
    expect(blocks[0].type).toBe('hero');
    expect(blocks[1].type).toBe('section');
  });
});
