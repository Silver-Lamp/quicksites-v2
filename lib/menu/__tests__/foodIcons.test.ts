import { matchFoodIcon, FOOD_ICONS, readMenuIconSet, writeMenuIconSet, isMenuIconSet } from '../foodIcons';

describe('matchFoodIcon — what it recognises', () => {
  it.each([
    ['Lemonade - Homemade Freshly Sqeezed', 'lemonade'],
    ['Iced Coffee', 'coffee'],
    ['Vanilla Latte', 'coffee'],
    ['Margherita Pizza', 'pizza'],
    ['Carne Asada Tacos', 'taco'],
    ['Turkey Club Sandwich', 'sandwich'],
    ['Garden Salad', 'salad'],
    ['Chicken Noodle Soup', 'soup'],
    ['Spaghetti Bolognese', 'pasta'],
    ['Two Eggs Any Style', 'egg'],
    ['Buttermilk Pancakes', 'pancakes'],
    ['New York Cheesecake', 'cake'],
    ['Chocolate Chip Cookie', 'cookie'],
    ['Strawberry Ice Cream', 'icecream'],
  ])('%s → %s', (name, expected) => {
    expect(matchFoodIcon(name)).toBe(expected);
  });
});

describe('matchFoodIcon — the longest term wins', () => {
  it('"Iced Tea" is a cold drink, not a pot of tea', () => {
    // Both 'tea' and 'iced tea' match; specificity has to decide or the icon is wrong.
    expect(matchFoodIcon('Iced Tea')).toBe('soda');
    expect(matchFoodIcon('Earl Grey Tea')).toBe('tea');
  });

  it('"Hot Dog" is a hot dog', () => {
    expect(matchFoodIcon('Hot Dog')).toBe('hotdog');
  });

  it('"Ice Cream Sandwich" is ice cream, not a sandwich', () => {
    expect(matchFoodIcon('Ice Cream Sandwich')).toBe('icecream');
  });
});

describe('matchFoodIcon — null is a result, not a failure', () => {
  // ⚠️ An icon in front of a dish is a claim about that dish on a page presenting as the
  // business's own. Rendering nothing is always available and always true.
  it.each([
    'Chef Special',
    'Market Price Item',
    'Ask your server',
    'Item',
    '',
    '   ',
  ])('%s → no icon', (name) => {
    expect(matchFoodIcon(name)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(matchFoodIcon(null)).toBeNull();
    expect(matchFoodIcon(undefined)).toBeNull();
  });

  it('has no catch-all — an icon meaning "food" would carry no information', () => {
    const keys = Object.keys(FOOD_ICONS);
    expect(keys).not.toContain('food');
    expect(keys).not.toContain('generic');
    expect(keys).not.toContain('other');
  });
});

describe('matchFoodIcon — word boundaries', () => {
  it('does not match a term embedded in another word', () => {
    // 'beefsteak tomato' must not become a steak; 'cod' must not fire inside 'cod-like' words.
    expect(matchFoodIcon('Beefsteak Tomato Plate')).toBeNull();
    expect(matchFoodIcon('Scodgy')).toBeNull();
  });

  it('matches across punctuation, the way real menus are written', () => {
    expect(matchFoodIcon('Lemonade—Fresh')).toBe('lemonade');
    expect(matchFoodIcon('Pizza, Slice')).toBe('pizza');
  });
});

describe('matchFoodIcon — tags are a second pass', () => {
  it('uses a whole tag when the name says nothing', () => {
    expect(matchFoodIcon('House Special', ['pizza'])).toBe('pizza');
  });

  it('never matches a tag by substring', () => {
    expect(matchFoodIcon('House Special', ['pizzeria-style'])).toBeNull();
  });

  it('prefers the name over the tags', () => {
    expect(matchFoodIcon('Cheese Pizza', ['salad'])).toBe('pizza');
  });
});

describe('icon definitions', () => {
  it('every icon has a path, an emoji, a label and terms', () => {
    for (const [key, icon] of Object.entries(FOOD_ICONS)) {
      expect(typeof icon.path).toBe('string');
      expect(icon.path.length).toBeGreaterThan(10);
      expect(icon.emoji.length).toBeGreaterThan(0);
      expect(icon.label.length).toBeGreaterThan(0);
      expect(icon.terms.length).toBeGreaterThan(0);
      expect(key).toMatch(/^[a-z]+$/);
    }
  });

  it('uses currentColor only — never a hardcoded hex, so it tints with the site theme', () => {
    for (const [key, icon] of Object.entries(FOOD_ICONS)) {
      expect(icon.path).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(icon.path).not.toMatch(/rgb\(/i);
      expect(icon.path).toContain('currentColor');
      expect(key).toBeTruthy();
    }
  });

  it('no term is claimed by two icons — an ambiguous term belongs to neither', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [key, icon] of Object.entries(FOOD_ICONS)) {
      for (const t of icon.terms) {
        const prev = owner.get(t);
        if (prev && prev !== key) clashes.push(`"${t}" claimed by ${prev} and ${key}`);
        owner.set(t, key);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('set selection', () => {
  it('defaults to none — icons are opt-in', () => {
    expect(readMenuIconSet({})).toBe('none');
    expect(readMenuIconSet(null)).toBe('none');
    expect(readMenuIconSet({ meta: {} })).toBe('none');
  });

  it('round-trips a chosen set', () => {
    const next = writeMenuIconSet({ meta: { siteTitle: 'Renton Lemonade' } }, 'emoji');
    expect(readMenuIconSet(next)).toBe('emoji');
    expect(next.meta.siteTitle).toBe('Renton Lemonade');
  });

  it('ignores a set it does not know', () => {
    expect(readMenuIconSet({ meta: { menu_icons: { set: 'sparkles' } } })).toBe('none');
    expect(isMenuIconSet('sparkles')).toBe(false);
  });
});

describe('add-ons prefer the ingredient, not the dish', () => {
  const addon = (n: string) => matchFoodIcon(n, null, { prefer: 'ingredient' });

  it('gives two "... Juice" add-ons DIFFERENT icons', () => {
    // ⚠️ The reason this mode exists. Dish-first resolves both of these to `juice`, and two
    // different add-ons wearing one icon does not merely fail to inform — it says they are
    // the same thing. Observed on the live lemonade stand: both add-ons rendered 🧃.
    expect(addon('Strawberry Juice - Freshly Pressed')).toBe('strawberry');
    expect(addon('Blueberry Juice - Freshly Pressed')).toBe('blueberry');
    expect(addon('Strawberry Juice')).not.toBe(addon('Blueberry Juice'));
  });

  it('still finds the dish when an add-on names no ingredient', () => {
    expect(addon('Side Salad')).toBe('salad');
    expect(addon('Extra Fries')).toBe('fries');
  });

  it('picks the ingredient on a bare topping', () => {
    expect(addon('Extra Cheese')).toBe('cheese');
    expect(addon('Add Chicken')).toBe('chicken');
  });

  it('leaves ITEM names alone — the dish is still the head there', () => {
    // The flip is scoped to add-ons. An item is unchanged.
    expect(matchFoodIcon('Chicken Noodle Soup')).toBe('soup');
    expect(matchFoodIcon('Strawberry Ice Cream')).toBe('icecream');
  });

  it('still renders nothing when nothing fits', () => {
    expect(addon('Make it special')).toBeNull();
    expect(addon('')).toBeNull();
  });
});
