// lib/rebuild/menuEvidence.ts
//
// A menu item survives only if the restaurant's own site says it exists.
//
// ⚠️ BUILT ON A FALSE ALARM, KEPT AS A CHECK (2026-10-10). Rock Island Pizza's first draft
// carried "Lasagna $16.65"; a Chrome-UA fetch of the (Wix) site showed no lasagna and the draft
// was declared invented and deleted. The scraper's bot UA is served the full text, where the
// lasagna is — the grep was true about the wrong rendering. The invented-menu class (#738: 11
// of 26 listing drafts) is real, the prompt's "no prices unless verbatim" is only a request, and
// a check costs nothing when the model is right. Its measured false drop so far: "Roast Beef
// Sandwich", a real item the site lists as "Roast Beef, Turkey, or Ham". To verify a built
// menu, search THIS corpus (evidenceCorpus of the scraper's output), never a browser fetch.
//
// Rule, in the order it is applied:
//   1. an item whose NAME is not in the scraped text is DROPPED (an unconfirmed dish is a claim);
//   2. an item whose name is confirmed but whose PRICE is not in the text keeps the dish and
//      loses the price ("drop the price, never the dish" — lib/menu/menuFreshness.ts);
//   3. a section left with no items is dropped.
// Matching is on normalised text (case, accents, punctuation and spaces removed) so "T.B.C" and
// "Chocolate Chunk Cookies" survive their own formatting. The corpus is everything the scraper
// kept — homepage body, headings, nav, and the menu subpages — which is TRUNCATED (6000 chars a
// page), so a real dish past the cut is dropped too. That is the right direction of error: an
// omitted real dish costs a line on a draft the owner reviews; an invented one costs the claim.

import type { MenuSectionSpec } from '@/lib/rebuild/inferSiteSpec';

export function normalizeForEvidence(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** "$19.65" / "19.65" / "19,65" → "19.65"; null when there is no number. */
function priceKey(p: string | undefined | null): string | null {
  const m = String(p ?? '').replace(',', '.').match(/\d+(?:\.\d{1,2})?/);
  return m ? m[0] : null;
}

export type MenuEvidenceResult = {
  menu: { sections: MenuSectionSpec[] } | undefined;
  kept: number;
  droppedItems: string[];
  droppedPrices: string[];
};

const MIN_NAME_CHARS = 3;

export function filterMenuToEvidence(menu: { sections: MenuSectionSpec[] } | undefined, corpus: string): MenuEvidenceResult {
  if (!menu?.sections?.length) return { menu, kept: 0, droppedItems: [], droppedPrices: [] };
  const norm = normalizeForEvidence(corpus);
  const raw = corpus;
  const droppedItems: string[] = [];
  const droppedPrices: string[] = [];
  let kept = 0;
  const sections: MenuSectionSpec[] = [];
  for (const s of menu.sections) {
    const items = [];
    for (const it of s.items ?? []) {
      const name = String(it.name ?? '').trim();
      const key = normalizeForEvidence(name);
      if (key.length < MIN_NAME_CHARS || !norm.includes(key)) {
        droppedItems.push(name);
        continue;
      }
      const pk = priceKey(it.price);
      if (pk && !raw.includes(pk)) {
        droppedPrices.push(`${name} ${it.price}`);
        items.push({ ...it, price: undefined });
      } else {
        items.push(it);
      }
      kept += 1;
    }
    if (items.length) sections.push({ ...s, items });
  }
  return { menu: sections.length ? { sections } : undefined, kept, droppedItems, droppedPrices };
}

/** Everything the scraper kept, joined — the only text a dish may be confirmed against. */
export function evidenceCorpus(scraped: { bodyText: string; headings: string[]; navLabels: string[] }, menuPages: Array<{ text: string }>): string {
  return [scraped.bodyText, ...scraped.headings, ...scraped.navLabels, ...menuPages.map((p) => p.text)].join('\n');
}
