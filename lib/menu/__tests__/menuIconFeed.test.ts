/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildMenuFeed, iconsForNames } from '@/lib/menu/menuIconFeed';
import { FOOD_ICONS } from '@/lib/menu/foodIcons';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const data = {
  meta: { menu_icons: { set: 'line' } },
  pages: [{ blocks: [{ type: 'menu', content: { currency: 'EUR', sections: [
    { name: 'Primi', description: 'Pasta fresca', items: [{ name: 'Spaghetti alla carbonara', price: '€ 13', tags: ['Popolare'] }, { name: 'Ribollita', price: '€ 11', tags: ['V'] }] },
    { name: 'Dolci', items: [{ name: 'Tiramisù', price: '€ 8' }, { name: '   ', price: '€ 0' }] },
    { name: 'Empty', items: [] },
  ] } }] }],
};

describe('buildMenuFeed', () => {
  const feed = buildMenuFeed(data);
  it('keeps the menu\'s own sections and order, drops blank items and empty sections', () => {
    expect(feed.sections.map((s) => s.name)).toEqual(['Primi', 'Dolci']);
    expect(feed.sections[0].description).toBe('Pasta fresca');
    expect(feed.sections[1].items.map((i) => i.name)).toEqual(['Tiramisù']);
    expect(feed.currency).toBe('EUR');
    expect(feed.icon_set).toBe('line');
  });
  it('matches the renderer\'s icon per dish and says null, never a filler, when nothing matches', () => {
    const primi = feed.sections[0].items;
    expect(primi[0].icon_key).toBe('pasta'); // Spaghetti alla carbonara
    expect(primi[1].icon_key).toBe('soup'); // Ribollita (Italian terms added 2026-10-15)
    expect(feed.sections[1].items[0].icon_key).toBe('cake'); // Tiramisù — diacritic folded, then matched
  });
  it('the dictionary carries only used icons, as currentColor SVG + emoji', () => {
    for (const k of Object.keys(feed.icons)) {
      expect(FOOD_ICONS[k]).toBeDefined();
      expect(feed.icons[k].svg).toBe(FOOD_ICONS[k].path);
      expect(feed.icons[k].emoji).toBe(FOOD_ICONS[k].emoji);
    }
    const used = new Set(feed.sections.flatMap((s) => s.items.map((i) => i.icon_key)).filter(Boolean));
    expect(new Set(Object.keys(feed.icons))).toEqual(used);
  });
});

describe('iconsForNames — the ingredient reading by default', () => {
  it('ingredients get ingredient icons; unknown ingredients get nothing', () => {
    const r = iconsForNames([{ name: 'Strawberry Juice' }, { name: 'Guanciale' }, { name: 'Cheddar cheese' }, { name: '' }]);
    expect(r.matches[0].icon_key).toBe('strawberry');
    expect(r.matches[1].icon_key).toBeNull(); // Guanciale: no icon claims to know what it is
    expect(r.matches[2].icon_key).toBe('cheese');
    expect(r.matches[3]).toEqual({ name: '', icon_key: null });
    expect(iconsForNames([{ name: 'Strawberry Juice', prefer: 'dish' }]).matches[0].icon_key).toBe('juice');
  });
});

describe('the routes', () => {
  it.each(['menu', 'menu/icons'])('%s is owner-session or partner-signed, and a partner needs a linked site', (r) => {
    const src = read(`app/api/booking/[templateId]/${r}/route.ts`);
    expect(src).toMatch(/requireTemplateOwner\(templateId\)/);
    expect(src).toMatch(/isPartnerLinked\(templateId\)/);
    expect(src).toMatch(/'not_linked'/);
  });
});
