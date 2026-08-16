import { heroPrompt } from '../paintHero';
import { prefersPainterlyHero, PAINTERLY_HERO_INDUSTRIES } from '@/lib/theme/heroPool';
import { NO_PEOPLE_NO_TEXT_CLAUSE } from '@/lib/images/noPeople';

describe('heroPrompt', () => {
  it('carries the shared no-people/no-text clause verbatim', () => {
    // ⚠️ Imported, never hand-written — a hand-rolled "no people" string is how rule 9 rots
    // (see lib/images/noPeople.ts).
    expect(heroPrompt({ industryKey: 'lemonade_stand' })).toContain(NO_PEOPLE_NO_TEXT_CLAUSE);
  });

  it('describes a SCENE, never the business — a named business summons a signboard', () => {
    // "EUGENE PRÈSSURE WASHING" and "PEST CONTROL" both got painted into images because the
    // prompt named the business. The lemonade subject names a table, a pitcher and lemons.
    const p = heroPrompt({ industryKey: 'lemonade_stand' });
    expect(p).toMatch(/pitcher/i);
    expect(p).not.toMatch(/\blemonade stand\b/i);
  });

  it('asks for a focal illustration, not the backdrop treatment', () => {
    // Reusing backdropPrompt here would ask for low contrast and no focal subject, which is a
    // washed-out nothing at the top of a page.
    const p = heroPrompt({ industryKey: 'garage_sale' });
    expect(p).toMatch(/painterly/i);
    expect(p).not.toMatch(/low contrast/i);
    expect(p).not.toMatch(/distant backdrop/i);
  });

  it('leaves room for the headline rather than centring the subject', () => {
    expect(heroPrompt({ industryKey: 'yard_sale' })).toMatch(/offset to one side|open area/i);
  });

  it('falls back to a generic scene for an industry with no written subject', () => {
    const p = heroPrompt({ industryKey: 'not_a_real_industry', industryLabel: 'Dog Grooming' });
    expect(p).toMatch(/dog grooming/i);
    expect(p).toContain(NO_PEOPLE_NO_TEXT_CLAUSE);
  });

  it('accepts an explicit subject over everything else', () => {
    expect(heroPrompt({ industryKey: 'lemonade_stand', subject: 'a rowing boat on a still lake' }))
      .toMatch(/rowing boat/i);
  });
});

describe('which verticals default to painterly', () => {
  it('covers the sellers with no photograph of their own', () => {
    expect(prefersPainterlyHero('lemonade_stand')).toBe(true);
    expect(prefersPainterlyHero('garage_sale')).toBe(true);
    expect(prefersPainterlyHero('yard_sale')).toBe(true);
  });

  it('excludes restaurants deliberately', () => {
    // A painted dish beside a real menu implies food the kitchen may not serve — the
    // invented-menu failure in nicer clothes.
    expect(prefersPainterlyHero('restaurant')).toBe(false);
    expect(PAINTERLY_HERO_INDUSTRIES.has('restaurant')).toBe(false);
  });

  it('is off for anything unknown, null or empty', () => {
    expect(prefersPainterlyHero('plumbing')).toBe(false);
    expect(prefersPainterlyHero(null)).toBe(false);
    expect(prefersPainterlyHero(undefined)).toBe(false);
    expect(prefersPainterlyHero('')).toBe(false);
  });
});
