// lib/menu/foodIcons.ts
//
// A small drawn icon in front of a menu item — opt-in, per site.
//
// ⚠️ DRAWN AND MATCHED, NOT GENERATED AND NOT GUESSED. Same three reasons as the industry
// marks (lib/brand/industryMarks.ts), plus one that is specific to menus:
//
//   • Cost: a generated image per dish is ~$0.04 × every item on every menu. These are paths;
//     they cost nothing and render at first paint.
//   • Crispness + colour: a 20px path is exact and inherits `currentColor`, so it tints with
//     the site's own theme on light and dark. A raster is mush and is stuck with its palette.
//   • ⚠️ HONESTY: an icon in front of a dish is a CLAIM ABOUT THAT DISH on a page presenting
//     as the business's own. A fish beside "Chicken Parmesan" is a small lie with someone
//     else's name on it, and it is the kind nobody reports — it just makes the menu feel
//     careless. So the matcher is conservative and NO MATCH RENDERS NOTHING. The rule is the
//     same one the backdrops and the menu prices already follow: an absent decoration is a
//     plain row, never a wrong one.
//
// Adding an icon is one entry — no asset, no build step, no spend. Adding a synonym is one
// string. Both are cheap precisely so that "close enough" is never the tempting option.

export type MenuIconSet = 'none' | 'line' | 'badge' | 'emoji';

export const MENU_ICON_SETS: { key: MenuIconSet; label: string; hint: string }[] = [
  { key: 'none', label: 'None', hint: 'Text only' },
  { key: 'line', label: 'Line', hint: 'Drawn outlines, tinted with your theme' },
  { key: 'badge', label: 'Badge', hint: 'The same marks on a tinted chip' },
  { key: 'emoji', label: 'Emoji', hint: 'Friendly and instantly readable' },
];

export function isMenuIconSet(v: any): v is MenuIconSet {
  return v === 'none' || v === 'line' || v === 'badge' || v === 'emoji';
}

const S = 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';

export type FoodIcon = {
  /** Inner SVG markup on a 24×24 viewBox. Strokes use currentColor. */
  path: string;
  /** The emoji set's counterpart. */
  emoji: string;
  /** Human label — becomes the icon's aria-label. */
  label: string;
  /**
   * Words that mean this icon. Matched on word boundaries against the item name.
   * Keep them UNAMBIGUOUS: a term that plausibly belongs to two dishes belongs to neither.
   */
  terms: string[];
  /**
   * True when this icon names an INGREDIENT rather than a dish.
   *
   * ⚠️ THIS IS THE RULE THAT MAKES THE MATCHER CORRECT, and it was found by the tests rather
   * than by design. Ranking purely by term length gives "Chicken Noodle Soup" → chicken,
   * "Strawberry Ice Cream" → fruit, and "Cheese Pizza" → cheese: in each case the longer word
   * is the filling and the shorter one is the dish. An ingredient mentioned in a name is a
   * weaker signal than a dish type, always, so dishes outrank ingredients before length is
   * ever consulted.
   */
  ingredient?: true;
};

export const FOOD_ICONS: Record<string, FoodIcon> = {
  lemonade: {
    label: 'Lemonade',
    emoji: '🍋',
    terms: ['lemonade', 'limeade'],
    // A tumbler with a wedge on the rim.
    path: `<path ${S} d="M7 7h10l-1.2 12.2a1.5 1.5 0 0 1-1.5 1.3h-4.6a1.5 1.5 0 0 1-1.5-1.3z"/><path ${S} d="M8 12h8"/><path ${S} d="M14.5 4.2a2.6 2.6 0 1 1 3.6 3.6z"/>`,
  },
  coffee: {
    label: 'Coffee',
    emoji: '☕',
    terms: ['coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'cortado', 'brew'],
    path: `<path ${S} d="M4 8h13v6.5a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 14.5z"/><path ${S} d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path ${S} d="M7 5V3.5M10.5 5V3.5M14 5V3.5"/>`,
  },
  tea: {
    label: 'Tea',
    emoji: '🍵',
    terms: ['tea', 'chai', 'matcha'],
    path: `<path ${S} d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path ${S} d="M16 10.5h1.6a2.2 2.2 0 0 1 0 4.4H16"/><path ${S} d="M4 20.5h13"/>`,
  },
  juice: {
    label: 'Juice',
    emoji: '🧃',
    terms: ['juice', 'smoothie', 'nectar'],
    path: `<path ${S} d="M6.5 8h11v11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z"/><path ${S} d="M9 8V4.5h6V8"/><path ${S} d="M12 4.5V2.8"/>`,
  },
  soda: {
    label: 'Cold drink',
    emoji: '🥤',
    terms: ['soda', 'pop', 'cola', 'root beer', 'iced tea', 'slush', 'milkshake', 'shake'],
    path: `<path ${S} d="M6.5 8h11l-1.3 11.4a1.6 1.6 0 0 1-1.6 1.4H9.4a1.6 1.6 0 0 1-1.6-1.4z"/><path ${S} d="M5.5 8h13"/><path ${S} d="M14.5 8l2-5.2"/>`,
  },
  water: {
    label: 'Water',
    emoji: '💧',
    terms: ['water', 'sparkling water', 'seltzer'],
    path: `<path ${S} d="M12 3.5s6 6.4 6 10.2a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>`,
  },
  burger: {
    label: 'Burger',
    emoji: '🍔',
    terms: ['burger', 'cheeseburger', 'hamburger', 'patty melt', 'smash burger'],
    path: `<path ${S} d="M4 9.5c0-3 3.6-5 8-5s8 2 8 5z"/><path ${S} d="M4 12.5h16"/><path ${S} d="M4 15.5h16"/><path ${S} d="M4.5 18.5h15"/>`,
  },
  pizza: {
    label: 'Pizza',
    emoji: '🍕',
    terms: ['pizza', 'calzone', 'flatbread'],
    path: `<path ${S} d="M12 3.5 20.5 20a1 1 0 0 1-1.2 1.4 22 22 0 0 1-14.6 0A1 1 0 0 1 3.5 20z"/><path ${S} d="M10 11h.01M14 13h.01M11.5 16.5h.01"/>`,
  },
  taco: {
    label: 'Taco',
    emoji: '🌮',
    terms: ['taco', 'burrito', 'quesadilla', 'tostada', 'enchilada', 'fajita'],
    path: `<path ${S} d="M3 17a9 9 0 0 1 18 0z"/><path ${S} d="M3 17h18"/><path ${S} d="M8 13.5c1.2-1 2.6-1 3.8 0M13 12.5c1.2-1 2.4-.8 3.4.3"/>`,
  },
  sandwich: {
    label: 'Sandwich',
    emoji: '🥪',
    terms: ['sandwich', 'sub', 'hoagie', 'panini', 'wrap', 'blt', 'club'],
    path: `<path ${S} d="M3.5 8.5 12 4.5l8.5 4-8.5 4z"/><path ${S} d="M3.5 12.5 12 16.5l8.5-4"/><path ${S} d="M3.5 16 12 20l8.5-4"/>`,
  },
  hotdog: {
    label: 'Hot dog',
    emoji: '🌭',
    terms: ['hot dog', 'hotdog', 'corn dog', 'bratwurst', 'sausage'],
    path: `<path ${S} d="M4 15.5a4 4 0 0 1 4-4h8a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4z"/><path ${S} d="M7.5 15.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0"/>`,
  },
  fries: {
    label: 'Fries',
    emoji: '🍟',
    terms: ['fries', 'french fries', 'chips', 'tots', 'tater tots'],
    path: `<path ${S} d="M6.5 11h11l-1 8.5a1.5 1.5 0 0 1-1.5 1.3H9a1.5 1.5 0 0 1-1.5-1.3z"/><path ${S} d="M9 11V5.5M12 11V4M15 11V6"/>`,
  },
  salad: {
    label: 'Salad',
    emoji: '🥗',
    terms: ['salad', 'greens', 'slaw', 'coleslaw'],
    path: `<path ${S} d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z"/><path ${S} d="M8 12.5c-.5-2.5.8-4.6 3-5.2M13 12.5c.6-2.2 2.3-3.4 4.2-3.3"/>`,
  },
  soup: {
    label: 'Soup',
    emoji: '🍲',
    terms: ['soup', 'chowder', 'bisque', 'stew', 'chili', 'pho', 'ramen'],
    path: `<path ${S} d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path ${S} d="M9 7.5c0-1 1-1.4 1-2.4M13 7.5c0-1 1-1.4 1-2.4"/><path ${S} d="M2.5 20.5h19"/>`,
  },
  pasta: {
    label: 'Pasta',
    emoji: '🍝',
    terms: ['pasta', 'spaghetti', 'linguine', 'penne', 'lasagna', 'noodles', 'alfredo', 'carbonara'],
    path: `<path ${S} d="M3.5 13h17a8.5 8.5 0 0 1-17 0z"/><path ${S} d="M7 13c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6"/><path ${S} d="M2.5 20.5h19"/>`,
  },
  sushi: {
    label: 'Sushi',
    emoji: '🍣',
    terms: ['sushi', 'sashimi', 'nigiri', 'maki', 'poke'],
    path: `<path ${S} d="M4.5 12.5h15v5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z"/><path ${S} d="M6.5 12.5a5.5 5.5 0 0 1 11 0"/><path ${S} d="M12 7v5.5"/>`,
  },
  chicken: {
    ingredient: true,
    label: 'Chicken',
    emoji: '🍗',
    terms: ['chicken', 'wings', 'drumstick', 'nuggets', 'tenders'],
    path: `<path ${S} d="M14.5 4.5a5 5 0 0 1 3.5 8.5l-5.5 5.5-3-3 5.5-5.5"/><path ${S} d="M9.5 15.5 6 19l-2-2 3.5-3.5z"/>`,
  },
  fish: {
    ingredient: true,
    label: 'Fish',
    emoji: '🐟',
    terms: ['fish', 'salmon', 'cod', 'tilapia', 'halibut', 'tuna'],
    path: `<path ${S} d="M3 12c3-4 6.5-6 10-6s6.5 2 8 6c-1.5 4-4.5 6-8 6s-7-2-10-6z"/><path ${S} d="M16.5 12h.01"/>`,
  },
  steak: {
    ingredient: true,
    label: 'Steak',
    emoji: '🥩',
    terms: ['steak', 'ribeye', 'sirloin', 'brisket', 'ribs', 'barbecue', 'bbq'],
    path: `<path ${S} d="M4.5 10c1.5-3.5 5-5.5 9-5.5 3 0 5.5 2 5.5 5s-2 5-5 6-5.5 3-8 3-2.5-4-1.5-8.5z"/><path ${S} d="M14.5 9.5h.01"/>`,
  },
  egg: {
    ingredient: true,
    label: 'Eggs',
    emoji: '🍳',
    terms: ['egg', 'eggs', 'omelet', 'omelette', 'frittata', 'scramble', 'benedict'],
    path: `<path ${S} d="M12 3.5c3.5 0 6.5 5 6.5 9a6.5 6.5 0 0 1-13 0c0-4 3-9 6.5-9z"/><path ${S} d="M12 9.5a3 3 0 1 0 .01 0"/>`,
  },
  pancakes: {
    label: 'Pancakes',
    emoji: '🥞',
    terms: ['pancake', 'pancakes', 'waffle', 'waffles', 'french toast', 'crepe', 'crepes'],
    path: `<path ${S} d="M4 15.5a8 8 0 0 0 16 0"/><path ${S} d="M4 12.5a8 8 0 0 0 16 0"/><path ${S} d="M4 9.5a8 8 0 0 1 16 0"/><path ${S} d="M12 6.5V4.5"/>`,
  },
  bread: {
    label: 'Bread',
    emoji: '🥖',
    terms: ['bread', 'baguette', 'roll', 'rolls', 'toast', 'biscuit', 'bagel', 'croissant'],
    path: `<path ${S} d="M5 16.5 16.5 5A3.5 3.5 0 0 1 19 11L7.5 22.5z" transform="translate(0,-2)"/><path ${S} d="M9 10.5l1.5 1.5M11.5 8l1.5 1.5M14 5.5 15.5 7"/>`,
  },
  cake: {
    label: 'Cake',
    emoji: '🍰',
    terms: ['cake', 'cheesecake', 'pie', 'tart', 'brownie', 'dessert'],
    path: `<path ${S} d="M4 20.5v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7z"/><path ${S} d="M4 15.5c1.4 1.2 2.9 1.2 4.3 0s2.9-1.2 4.3 0 2.9 1.2 4.3 0l3.1-.1"/><path ${S} d="M12 11.5V8"/>`,
  },
  cookie: {
    label: 'Cookie',
    emoji: '🍪',
    terms: ['cookie', 'cookies', 'biscotti', 'macaron'],
    path: `<path ${S} d="M12 4a8 8 0 1 0 8 8 4.5 4.5 0 0 1-4.4-3.6A4.5 4.5 0 0 1 12 4z"/><path ${S} d="M9.5 12h.01M13 15h.01M10 16h.01"/>`,
  },
  icecream: {
    label: 'Ice cream',
    emoji: '🍦',
    terms: ['ice cream', 'gelato', 'sundae', 'soft serve', 'popsicle', 'sorbet'],
    path: `<path ${S} d="M8 10.5a4 4 0 1 1 8 0z"/><path ${S} d="M7.5 10.5h9L12 21z"/>`,
  },
  donut: {
    label: 'Donut',
    emoji: '🍩',
    terms: ['donut', 'doughnut'],
    path: `<path ${S} d="M12 4a8 8 0 1 0 .01 0z"/><path ${S} d="M12 9.5a2.5 2.5 0 1 0 .01 0z"/>`,
  },
  fruit: {
    ingredient: true,
    label: 'Fruit',
    emoji: '🍎',
    terms: ['apple', 'berry', 'berries', 'strawberry', 'blueberry', 'peach', 'fruit'],
    path: `<path ${S} d="M12 7.5c-3.5-2.5-8 0-8 5 0 4 3 8 5.5 8 1.2 0 1.8-.6 2.5-.6s1.3.6 2.5.6c2.5 0 5.5-4 5.5-8 0-5-4.5-7.5-8-5z"/><path ${S} d="M12 7.5V5a2.5 2.5 0 0 1 2.5-2.5"/>`,
  },
  veg: {
    ingredient: true,
    label: 'Vegetarian',
    emoji: '🥦',
    terms: ['vegetable', 'veggie', 'broccoli', 'tofu'],
    path: `<path ${S} d="M12 21v-7"/><path ${S} d="M8.5 14a3.5 3.5 0 0 1-1-6.6A3.5 3.5 0 0 1 14 5.6a3.5 3.5 0 0 1 1.5 8.4z"/>`,
  },
  bowl: {
    label: 'Bowl',
    emoji: '🥣',
    terms: ['bowl', 'rice', 'grain bowl', 'burrito bowl', 'oatmeal', 'porridge'],
    path: `<path ${S} d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path ${S} d="M2.5 20.5h19"/>`,
  },
  cheese: {
    ingredient: true,
    label: 'Cheese',
    emoji: '🧀',
    terms: ['cheese', 'mac and cheese', 'nachos', 'queso'],
    path: `<path ${S} d="M3.5 12 13 5.5 20.5 12z"/><path ${S} d="M3.5 12v5.5h17V12"/><path ${S} d="M8 15h.01M13 14.5h.01M17 15.5h.01"/>`,
  },
};

/**
 * Match an item name to an icon key, or null when nothing is clearly right.
 *
 * ⚠️ NULL IS A RESULT, NOT A FAILURE. An unmatched dish renders no icon, which is the correct
 * output — see the honesty note at the top. Never add a catch-all "food" fallback: an icon that
 * means "this is a thing you eat" carries no information and costs the set its credibility.
 *
 * Matching is on WORD BOUNDARIES so "beefsteak tomato" does not become a steak, and the longest
 * term wins so "iced tea" beats "tea" and "hot dog" beats "dog".
 */
export function matchFoodIcon(name: string | null | undefined, tags?: string[] | null): string | null {
  const haystack = ` ${String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  if (haystack.trim().length < 2) return null;

  let best: { key: string; len: number; dish: boolean } | null = null;
  for (const [key, icon] of Object.entries(FOOD_ICONS)) {
    for (const term of icon.terms) {
      const lower = term.toLowerCase();
      // Menus pluralise freely — "Tacos", "Wings", "Cookies". Accept a trailing s so a set
      // does not need two entries per food, which is how a synonym list rots.
      const at = Math.max(haystack.indexOf(` ${lower} `), haystack.indexOf(` ${lower}s `));
      if (at < 0) continue;
      const cand = { key, len: lower.length, dish: !icon.ingredient };
      if (!best) { best = cand; continue; }
      // Dish beats ingredient outright; only then does the longer term win.
      if (cand.dish !== best.dish) { if (cand.dish) best = cand; continue; }
      if (cand.len > best.len) best = cand;
    }
  }
  if (best) return best.key;

  // Tags are the owner's own words about the dish, so they are a legitimate second pass —
  // but only as whole-tag matches, never substrings.
  for (const raw of tags ?? []) {
    const tag = String(raw ?? '').toLowerCase().trim();
    if (!tag) continue;
    for (const [key, icon] of Object.entries(FOOD_ICONS)) {
      if (icon.terms.some((t) => t.toLowerCase() === tag)) return key;
    }
  }
  return null;
}

/** Read the site's chosen set. 'none' unless an owner opted in. */
export function readMenuIconSet(data: any): MenuIconSet {
  const v = data?.meta?.menu_icons?.set ?? data?.meta?.menuIcons?.set;
  return isMenuIconSet(v) ? v : 'none';
}

/** Write the chosen set into a template data blob (pure). */
export function writeMenuIconSet(data: any, set: MenuIconSet): any {
  const meta = data?.meta ?? {};
  return { ...(data ?? {}), meta: { ...meta, menu_icons: { ...(meta.menu_icons ?? {}), set } } };
}
