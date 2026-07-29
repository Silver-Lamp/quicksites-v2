import { isBuffetLike, assessOrderingFit } from '../orderingFit';

describe('orderingFit', () => {
  it('excludes an obvious buffet by name', () => {
    expect(isBuffetLike({ name: 'King Buffet' })).toBe(true);
    expect(isBuffetLike({ name: 'Golden Corral Buffet & Grill' })).toBe(true);
    expect(isBuffetLike({ name: 'HomeTown Buffets' })).toBe(true);
  });

  it('excludes all-you-can-eat phrasing', () => {
    expect(isBuffetLike({ name: 'Sakura All You Can Eat Sushi' })).toBe(true);
    expect(isBuffetLike({ name: 'Tokyo All-You-Can-Eat' })).toBe(true);
  });

  it('excludes on category even when the name is neutral', () => {
    expect(isBuffetLike({ name: 'Golden Dragon', categories: ['buffet_restaurant'] })).toBe(true);
    expect(isBuffetLike({ name: 'Golden Dragon', categories: ['Buffet Restaurant'] })).toBe(true);
  });

  // The case a substring match gets wrong: "Buffett" is a surname, and a Buffett-themed bar
  // is an ordinary takeaway restaurant. Dropping it would be a silent wrong answer on a list
  // nobody inspects.
  it('does NOT exclude the surname Buffett', () => {
    expect(isBuffetLike({ name: "Jimmy Buffett's Margaritaville" })).toBe(false);
    expect(isBuffetLike({ name: 'Buffett Bar & Grill' })).toBe(false);
  });

  it('keeps ordinary restaurants', () => {
    expect(isBuffetLike({ name: "Eyman's Pizza" })).toBe(false);
    expect(isBuffetLike({ name: 'The Local 907', categories: ['bar', 'brunch_restaurant'] })).toBe(false);
    expect(isBuffetLike({ name: '' })).toBe(false);
  });

  it('gives a printable reason when it excludes', () => {
    const r = assessOrderingFit({ name: 'King Buffet' });
    expect(r.fits).toBe(false);
    expect(r.reason).toMatch(/dine-in/);
    expect(assessOrderingFit({ name: "Eyman's Pizza" })).toEqual({ fits: true });
  });
});
