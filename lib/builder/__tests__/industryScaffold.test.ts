/** @jest-environment node */
import { pickArchetype, buildIndustryStarter, type Archetype } from '../industryScaffold';
import { CURATED_THEMES } from '../../theme/curatedThemes';
import { ACCENT_HSL } from '../../theme/accentHsl';
import { FONT_PAIRINGS } from '../../theme/fontPairings';

const ALL_ARCHETYPES: Archetype[] = [
  'classic', 'story_led', 'proof_led', 'conversion', 'showcase', 'benefits_led', 'trust_first',
];
const CATEGORIES = ['editorial', 'warm', 'professional', 'playful', 'neon', 'rugged'] as const;

describe('pickArchetype', () => {
  it('every archetype (incl. the new showcase/benefits_led/trust_first) is reachable', () => {
    const seen = new Set<Archetype>();
    for (const cat of CATEGORIES) {
      for (let i = 0; i < 200; i++) {
        const r = (i + 0.5) / 200; // deterministic sweep of [0,1)
        seen.add(pickArchetype(cat as any, () => r));
      }
    }
    for (const a of ALL_ARCHETYPES) expect(seen.has(a)).toBe(true);
  });
});

describe('curated themes', () => {
  it('has an expanded catalog (20+) with valid accent + font references', () => {
    expect(CURATED_THEMES.length).toBeGreaterThanOrEqual(20);
    for (const t of CURATED_THEMES) {
      expect(ACCENT_HSL[t.accentColor]).toBeTruthy();
      expect(ACCENT_HSL[t.accent2Color]).toBeTruthy();
      expect(FONT_PAIRINGS[t.fontPair]).toBeTruthy();
    }
  });
});

describe('industry archetype bias', () => {
  it('injects industry-appropriate archetypes a theme category alone would not offer', () => {
    // neon base = {conversion, proof_led, trust_first}; a visual trade (landscaping)
    // should make showcase/story_led reachable via the bias.
    const seen = new Set<Archetype>();
    for (let i = 0; i < 300; i++) {
      const r = (i + 0.5) / 300;
      seen.add(pickArchetype('neon', 'landscaping', () => r));
    }
    expect(seen.has('showcase')).toBe(true);
    expect(seen.has('story_led')).toBe(true);
  });
});

describe('buildIndustryStarter', () => {
  it('builds a valid home page (hero first, contact present)', () => {
    const out: any = buildIndustryStarter({ businessName: 'Acme Co', industryKey: 'towing' as any });
    const blocks = out.data.pages[0].blocks;
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks[0].type).toBe('hero');
    expect(blocks.some((b: any) => b.type === 'contact_form')).toBe(true);
  });

  it('yields several distinct layouts across runs (more variety)', () => {
    const sigs = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const out: any = buildIndustryStarter({ businessName: `Biz ${i}`, industryKey: 'towing' as any });
      sigs.add(out.data.pages[0].blocks.map((b: any) => b.type).join('>'));
    }
    // Old system topped out around the 4 base archetypes; the expanded set +
    // themes should comfortably exceed that.
    expect(sigs.size).toBeGreaterThanOrEqual(5);
  });
});
