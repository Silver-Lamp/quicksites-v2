/**
 * @jest-environment node
 */
// Who may be written to. The disqualifiers are the load-bearing part — an eligible list that is
// slightly too long is how a real business gets told we built them a page showing food they do not
// serve.
import {
  disqualify,
  toCandidate,
  rankCandidates,
  summarizeExclusions,
  missingWeekdays,
  countItems,
  MIN_MENU_ITEMS,
} from '../candidates';
import { PLACEHOLDER_ITEM_NAMES } from '../../menu/menuBlocks';

/** A draft in the shape the importer actually writes. */
function draft(opts: {
  id?: string;
  items?: Array<{ name: string; price?: string }>;
  phone?: string | null;
  sections?: number;
}) {
  const items = opts.items ?? [{ name: 'Banh Mi' }];
  return {
    id: opts.id ?? 'id-1',
    slug: 'somewhere-abc12',
    template_name: 'Somewhere',
    data: {
      meta: { contact: { phone: opts.phone === undefined ? '(206) 555-0100' : opts.phone } },
      pages: [{ content_blocks: [{ type: 'menu', content: { sections: [{ name: 'Menu', items }] } }] }],
    },
  };
}

const realMenu = Array.from({ length: 12 }, (_, i) => ({ name: `Dish ${i}` }));

describe('disqualify', () => {
  it('passes a draft with a real menu and a phone', () => {
    expect(disqualify(draft({ items: realMenu }))).toBeNull();
  });

  // ⚠️ THE ONE THAT MATTERS. Eleven live drafts carry the food scaffold's invented menu under a real
  // restaurant's name. Texting one of them is the worst artifact this pipeline can produce.
  it('rejects the scaffold placeholder menu', () => {
    const placeholders = [...PLACEHOLDER_ITEM_NAMES].map((name) => ({ name }));
    expect(disqualify(draft({ items: placeholders }))).toBe('placeholder-menu');
  });

  // ⚠️ ORDER IS DELIBERATE. "no-phone" reads as "go find a number and proceed", which for a
  // placeholder draft is exactly the wrong next step. The defect in OUR artifact is reported first.
  it('reports a placeholder menu even when the phone is also missing', () => {
    const placeholders = [...PLACEHOLDER_ITEM_NAMES].map((name) => ({ name }));
    expect(disqualify(draft({ items: placeholders, phone: null }))).toBe('placeholder-menu');
  });

  it('rejects a draft with nobody to call', () => {
    expect(disqualify(draft({ items: realMenu, phone: null }))).toBe('no-phone');
  });

  it('rejects a menu too thin to look like theirs', () => {
    expect(disqualify(draft({ items: [{ name: 'One' }, { name: 'Two' }] }))).toBe('menu-too-thin');
    expect(MIN_MENU_ITEMS).toBeGreaterThan(1);
  });

  it('rejects a draft with no menu at all', () => {
    const d = { id: 'x', slug: null, template_name: null, data: { pages: [{ content_blocks: [] }] } };
    expect(disqualify(d)).toBe('no-menu');
  });

  // Derived from outreach_touches at call time, never a hardcoded list — a pasted array of ids is
  // correct exactly once and silently wrong on the next run.
  it('rejects someone already written to', () => {
    expect(disqualify(draft({ id: 'sent-1', items: realMenu }), { contactedIds: new Set(['sent-1']) })).toBe(
      'already-contacted',
    );
  });
});

describe('missingWeekdays', () => {
  const day = (key: string, closed = false) => ({ key, label: key, closed, periods: [] });

  // ⚠️ THE REGRESSION THIS FILE WAS WRITTEN FOR. `days` is an ARRAY of {key,label,closed}. The first
  // implementation used Object.keys(), got "0".."6", and reported all seven days missing on a
  // restaurant open every day. A check that fires on correct data trains you to ignore it — and it
  // would have buried the single real Monday gap in six false ones.
  it('reports nothing for a restaurant open seven days', () => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => day(d));
    expect(missingWeekdays({ days })).toEqual([]);
  });

  it('reports the day that is genuinely absent', () => {
    const days = ['sun', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => day(d));
    expect(missingWeekdays({ days })).toEqual(['mon']);
  });

  // Absent ≠ closed. An explicitly-closed day is a stated fact and needs no question; an absent one
  // is the thing worth asking about. Collapsing them loses the whole hook.
  it('treats an explicitly closed day as missing, because the page shows nothing for it', () => {
    const days = ['sun', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => day(d));
    days.push(day('mon', true));
    expect(missingWeekdays({ days })).toEqual(['mon']);
  });

  it('is quiet when there is no hours block rather than claiming all seven', () => {
    expect(missingWeekdays(null)).toEqual([]);
    expect(missingWeekdays({})).toEqual([]);
    expect(missingWeekdays({ days: 'nonsense' })).toEqual([]);
  });
});

describe('ranking and reporting', () => {
  it('ranks eligible candidates by menu size and drops the rest', () => {
    const cands = [
      toCandidate(draft({ id: 'a', items: realMenu })),
      toCandidate(draft({ id: 'b', items: [...realMenu, { name: 'Extra' }] })),
      toCandidate(draft({ id: 'c', items: realMenu, phone: null })),
    ];
    const ranked = rankCandidates(cands);
    expect(ranked.map((c) => c.id)).toEqual(['b', 'a']);
  });

  // The number that stops a mistake: "26 drafts" and "2 people I may write to" are different facts,
  // and only one of them is about outreach.
  it('counts exclusions by reason so the real inventory is visible', () => {
    const placeholders = [...PLACEHOLDER_ITEM_NAMES].map((name) => ({ name }));
    const sum = summarizeExclusions([
      toCandidate(draft({ id: 'a', items: realMenu })),
      toCandidate(draft({ id: 'b', items: placeholders })),
      toCandidate(draft({ id: 'c', items: placeholders })),
      toCandidate(draft({ id: 'd', items: realMenu, phone: null })),
    ]);
    expect(sum).toEqual({ total: 4, eligible: 1, byReason: { 'placeholder-menu': 2, 'no-phone': 1 } });
  });

  it('counts items across sections', () => {
    expect(countItems([{ items: [{}, {}] }, { items: [{}] }, {}])).toBe(3);
  });
});

// ── industry-aware eligibility ─────────────────────────────────────────────────────────────────
// ⚠️ THE BUG: MIN_MENU_ITEMS encodes "enough of their own material", which for a restaurant is the
// menu and for an auto shop is nothing of the sort. Running the qualifier over 204 real auto shops
// returned ZERO — a rule written for food had silently become the definition of eligible.
import { needsMenu } from '../candidates';

function serviceDraft(opts: { phone?: string | null; name?: string | null; items?: any[] } = {}) {
  return {
    id: 'svc-1',
    slug: 'carlos-auto-abc12',
    template_name: opts.name === undefined ? 'Carlos Auto Repair' : opts.name,
    industry: 'auto_repair',
    data: {
      meta: { contact: { phone: opts.phone === undefined ? '(973) 555-0100' : opts.phone } },
      pages: [{ content_blocks: opts.items ? [{ type: 'menu', content: { sections: [{ name: 'M', items: opts.items }] } }] : [] }],
    },
  };
}

describe('which industries are judged on a menu', () => {
  it('treats food as menu-based and everything else as not', () => {
    expect(needsMenu('restaurant')).toBe(true);
    expect(needsMenu('bakery')).toBe(true);
    expect(needsMenu('auto_repair')).toBe(false);
    expect(needsMenu('roofing')).toBe(false);
  });

  // Old callers pass no industry at all; they must keep the restaurant rule.
  it('defaults to the menu rule when industry is absent', () => {
    expect(needsMenu(undefined)).toBe(true);
    expect(needsMenu(null)).toBe(true);
  });
});

describe('a service business qualifies on reachability', () => {
  it('is eligible with just a name and a phone', () => {
    expect(disqualify(serviceDraft())).toBeNull();
  });

  it('is still rejected with nobody to call', () => {
    expect(disqualify(serviceDraft({ phone: null }))).toBe('no-phone');
  });

  it('is rejected with no name — there is nothing to address', () => {
    expect(disqualify(serviceDraft({ name: '' }))).toBe('no-name');
  });

  // ⚠️ The one rule that must NOT become industry-specific. A mis-inferred industry can put the food
  // scaffold's invented dishes on an auto shop, and shipping that is the worst artifact regardless
  // of what the business sells.
  it('still rejects a placeholder menu on a NON-food draft', () => {
    const placeholders = [...PLACEHOLDER_ITEM_NAMES].map((name) => ({ name }));
    expect(disqualify(serviceDraft({ items: placeholders }))).toBe('placeholder-menu');
  });

  it('does not demand 8 items from a business that has no menu', () => {
    expect(disqualify(serviceDraft({ items: [{ name: 'Oil Change' }] }))).toBeNull();
  });
});
