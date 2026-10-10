/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/menuEvidence.test.ts
//
// A synthetic fixture shaped like a pizzeria menu. ⚠️ It is NOT a record that Rock Island
// Pizza's draft invented lasagna — that was declared on 2026-10-10 and was wrong (the dish is on
// the site; a browser-UA fetch had returned the JS shell). The rule it pins still holds: an item
// whose name the scraped corpus does not contain is dropped, an unconfirmed price is dropped
// with the dish kept, an emptied section goes.
import fs from 'node:fs';
import path from 'node:path';
import { filterMenuToEvidence, normalizeForEvidence, evidenceCorpus } from '@/lib/rebuild/menuEvidence';
import { stripComments } from '@/test/stripComments';

const SITE = `
Specialty Pizzas. Greek $19.65. Veggie $19.65. Western $31.55.
Sandwiches: Roast Beef Sandwich 9.95 · The T.B.C 10.95
Desserts — Chocolate Chunk Cookies, Chocolate Cake
Pasta: spaghetti with meat sauce
`;

const MENU = {
  sections: [
    { name: 'Specialty Pizzas', items: [{ name: 'Greek', price: '$19.65' }, { name: 'Western', price: '$31.55' }] },
    { name: 'Pasta', items: [{ name: 'Spaghetti', price: '$14.65' }, { name: 'Lasagna', price: '$16.65' }] },
    { name: 'Sandwiches', items: [{ name: 'The T.B.C', price: '$10.95' }] },
    { name: 'Desserts', items: [{ name: 'Chocolate Chunk Cookies', price: 'N/A' }] },
    { name: 'Chef specials', items: [{ name: 'Truffle Risotto', price: '$24' }] },
  ],
};

describe('filterMenuToEvidence', () => {
  const r = filterMenuToEvidence(MENU, SITE);

  it('drops a dish the site never mentions, and the section it emptied', () => {
    expect(r.droppedItems).toEqual(['Lasagna', 'Truffle Risotto']);
    expect(r.menu!.sections.map((s) => s.name)).toEqual(['Specialty Pizzas', 'Pasta', 'Sandwiches', 'Desserts']);
  });

  it('keeps a confirmed dish and drops only its unconfirmed price', () => {
    const pasta = r.menu!.sections.find((s) => s.name === 'Pasta')!;
    expect(pasta.items).toEqual([{ name: 'Spaghetti', price: undefined }]);
    expect(r.droppedPrices).toEqual(['Spaghetti $14.65']);
  });

  it('keeps confirmed dishes with confirmed prices, through their own punctuation', () => {
    expect(r.menu!.sections[0].items).toEqual([{ name: 'Greek', price: '$19.65' }, { name: 'Western', price: '$31.55' }]);
    expect(r.menu!.sections.find((s) => s.name === 'Sandwiches')!.items).toEqual([{ name: 'The T.B.C', price: '$10.95' }]);
    expect(r.kept).toBe(5);
  });

  it('an empty or missing menu passes through', () => {
    expect(filterMenuToEvidence(undefined, SITE).menu).toBeUndefined();
    expect(filterMenuToEvidence({ sections: [] }, SITE).kept).toBe(0);
  });

  it('normalisation strips case, accents and punctuation', () => {
    expect(normalizeForEvidence('Crème Brûlée!')).toBe('cremebrulee');
    expect(normalizeForEvidence('The T.B.C')).toBe('thetbc');
  });

  it('the corpus is everything the scraper kept', () => {
    const c = evidenceCorpus({ bodyText: 'a', headings: ['b'], navLabels: ['c'] }, [{ text: 'd' }]);
    expect(c.split('\n')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('a from-site menu is dated the day it was read', () => {
  it('stampMenuSourcedAt writes sourced_at on every copy of every menu block, and the freshness rule reads it', async () => {
    const { stampMenuSourcedAt } = await import('@/lib/outreach/buildDraftFromSite');
    const { assessFreshness } = await import('@/lib/menu/menuFreshness');
    const data = { pages: [{ blocks: [{ type: 'menu', content: { sections: [] }, props: { sections: [] } }, { type: 'hero', content: {} }], content_blocks: [{ type: 'menu', content: { sections: [] } }] }] };
    expect(stampMenuSourcedAt(data, '2026-10-10T20:00:00Z')).toBe(3);
    expect(assessFreshness(data.pages[0].blocks[0].content, new Date('2026-10-11T00:00:00Z')).pricesStale).toBe(false);
    expect(assessFreshness({ sections: [] }).pricesStale).toBe(true);
  });
});

describe('source guard — the from-site builder applies it', () => {
  it('buildDraftFromSite filters the inferred menu against the scraped corpus before assembling', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'lib/outreach/buildDraftFromSite.ts'), 'utf8'));
    expect(src).toMatch(/filterMenuToEvidence\(/);
    expect(src).toMatch(/evidenceCorpus\(/);
    // The filter must run BEFORE the template is assembled, or the invented dish is already in the data.
    expect(src.indexOf('filterMenuToEvidence(')).toBeLessThan(src.indexOf('buildRebuildTemplate('));
    expect(src).toMatch(/stampMenuSourcedAt\(tpl\.data/);
  });
});
