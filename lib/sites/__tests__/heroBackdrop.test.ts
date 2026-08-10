import { APEX_FOOD_BACKDROP, heroBackdropFor } from '../heroBackdrop';
import { PORTFOLIO_HERO_BACKDROP } from '../portfolioTheme';

describe('heroBackdropFor', () => {
  it('gives the restaurant apex its own painting, top-scrimmed for its negative space', () => {
    const b = heroBackdropFor({ meta: { site_type: 'restaurant_apex' } });
    expect(b).toEqual({ src: APEX_FOOD_BACKDROP, scrim: 'top', opacity: 0.4 });
  });

  it('gives a person site the portfolio painting', () => {
    expect(heroBackdropFor({ meta: { industry: 'personal' } })?.src).toBe(PORTFOLIO_HERO_BACKDROP);
  });

  // ⚠️ A restaurant's OWN site is deliberately absent: a generated picture behind a real named
  // business reads as a photograph of that business (rule 9's logic, one layer up).
  it('gives an ordinary business site nothing', () => {
    expect(heroBackdropFor({ meta: { industry: 'towing' } })).toBeNull();
    expect(heroBackdropFor({ meta: { industry: 'restaurant' } })).toBeNull();
    expect(heroBackdropFor({})).toBeNull();
    expect(heroBackdropFor(null)).toBeNull();
  });

  it('honours an explicit override and an explicit opt-out', () => {
    expect(heroBackdropFor({ meta: { site_type: 'restaurant_apex', hero_backdrop: false } })).toBeNull();
    expect(
      heroBackdropFor({ meta: { industry: 'towing', hero_backdrop: '/brand/mine.webp', hero_backdrop_scrim: 'bottom' } }),
    ).toEqual({ src: '/brand/mine.webp', scrim: 'bottom', opacity: 0.45 });
  });
});

describe('hasImage — the null trap that hid the apex backdrop', () => {
  // The live shape: `image_url: null` on the apex hero.
  const hasImageOld = (u: any) => (u as string)?.trim() !== '';
  const hasImageNew = (u: any) => typeof u === 'string' && u.trim() !== '';

  it('the old expression claimed a null image was an image', () => {
    expect(hasImageOld(null)).toBe(true); // ← the bug: undefined !== ''
    expect(hasImageOld('')).toBe(false);
  });

  it('the new expression is false for null, undefined and blank', () => {
    for (const v of [null, undefined, '', '   ']) expect(hasImageNew(v)).toBe(false);
    expect(hasImageNew('/x.png')).toBe(true);
  });
});
