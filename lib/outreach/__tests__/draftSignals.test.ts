/**
 * @jest-environment node
 */
// What's notable about a draft.
//
// ⚠️ THIS FILE'S REASON TO EXIST, IN ONE STORY. Validating the detector against twenty hooks I had
// written BY HAND, it disagreed with me once — it refused to report "numbered items with no
// description" for Georgetown Shell Chicken & Deli. The detector was right: those items carry
// descriptions ("2 Thighs & 1 Jo Jo", "1 Breast & 1 Leg"), the template was created 2026-08-09 and
// never edited, and the message telling that owner their menu had none went out on 2026-08-12.
//
// I had read the absence of descriptions in MY OWN SCRIPT'S OUTPUT — which printed name and price
// only — as absence in their data. A real check, pointed at the wrong thing, reads exactly like an
// answer. Every case below is therefore built from the real shape a draft stores, not from what a
// convenient fixture would look like.
import { detectSignals, sortSignals, missingWeekdays } from '../draftSignals';

/** A draft in the shape the importer writes — menu under content_blocks, hours as a days ARRAY. */
function draft(items: any[], opts: { sections?: number; hours?: any[]; sectionName?: string } = {}) {
  const sections =
    opts.sections === 2
      ? [
          { name: 'One', items: items.slice(0, Math.ceil(items.length / 2)) },
          { name: 'Two', items: items.slice(Math.ceil(items.length / 2)) },
        ]
      : [{ name: opts.sectionName ?? 'Menu', items }];
  const blocks: any[] = [{ type: 'menu', content: { sections } }];
  if (opts.hours) blocks.push({ type: 'hours', content: { days: opts.hours } });
  return { pages: [{ content_blocks: blocks }] };
}

const day = (key: string, closed = false) => ({ key, label: key, closed });
const allWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => day(d));
const kinds = (d: any) => detectSignals(d).map((s) => s.kind);

describe('our parse failures', () => {
  // ⚠️ Taqueria Del Sol stores "$" — a currency symbol with no number — for all 28 dishes. Counting
  // that as "priced" reported "every item is the same price: $", which is wrong AND hid the real
  // finding. A signal that mislabels real data is worse than a missing one: it gets believed.
  it('treats a bare currency symbol as no price at all', () => {
    const d = draft(Array.from({ length: 8 }, (_, i) => ({ name: `Dish ${i}`, price: '$' })));
    expect(kinds(d)).toContain('no_prices');
    expect(kinds(d)).not.toContain('all_same_price');
  });

  it('flags a menu where every item really is the same price', () => {
    const d = draft(Array.from({ length: 8 }, (_, i) => ({ name: `Dish ${i}`, price: '$14' })));
    expect(kinds(d)).toContain('all_same_price');
  });

  // ⚠️ On a 3-item menu, one price is a coincidence rather than a bug. A rule that fires there
  // cries wolf on correct data, which is how a checklist stops being read.
  it('does not call a tiny menu a parse failure', () => {
    const d = draft([
      { name: 'A', price: '$9' },
      { name: 'B', price: '$9' },
    ]);
    expect(kinds(d)).not.toContain('all_same_price');
  });

  it('flags a mostly-unpriced menu without calling it empty', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ name: `D${i}`, price: i < 2 ? '$8' : '' }));
    const k = kinds(draft(items));
    expect(k).toContain('partial_prices');
    expect(k).not.toContain('no_prices');
  });

  // #1 Hawaiian BBQ stores both sizes in one field: "Mini 10.45 Reg. 12.95".
  it('flags two prices packed into one field', () => {
    const d = draft([
      { name: 'Kalua Pork', price: 'Mini 10.45 Reg. 12.95' },
      { name: 'Lau Lau', price: 'Mini 12.45 Reg. 17.95' },
    ]);
    expect(kinds(d)).toContain('packed_price');
  });

  // Pho Bac Cafe: the pho sizes landed as their own dishes beside Phở Tái.
  it('flags portion sizes parsed as dishes', () => {
    const d = draft([
      { name: 'Phở Tái', price: '' },
      { name: 'Small', price: '$13' },
      { name: 'Large', price: '$15' },
      { name: 'X-Large', price: '$20' },
    ]);
    expect(kinds(d)).toContain('sizes_as_dishes');
  });

  it('flags tax-inclusive-looking prices', () => {
    const d = draft([
      { name: 'Taco Plate', price: '$12.16' },
      { name: 'Torta', price: '$11.11' },
      { name: 'Burrito', price: '$13.80' },
    ]);
    expect(kinds(d)).toContain('odd_prices');
  });

  // ⚠️ Ordinary menu pricing must stay silent, or the signal is noise on every healthy draft.
  it('says nothing about normal .99/.95/.50 prices', () => {
    const d = draft([
      { name: 'A', price: '$13.99' },
      { name: 'B', price: '$14.95' },
      { name: 'C', price: '$10.50' },
      { name: 'D', price: '$9.00' },
    ]);
    expect(kinds(d)).not.toContain('odd_prices');
  });

  it('flags the doubled dollar sign', () => {
    const d = draft([
      { name: 'A', price: '$$8.95' },
      { name: 'B', price: '$$9.95' },
    ]);
    expect(kinds(d)).toContain('doubled_currency');
  });
});

describe('notes about their business', () => {
  // ⚠️ THE GEORGETOWN CASE. Codes WITH descriptions are a normal menu, and calling them
  // undescribed put a false claim in a message to a real business.
  it('does not flag numbered items that have descriptions', () => {
    const d = draft([
      { name: '#1', price: '$5.99', description: '2 Thighs & 1 Jo Jo' },
      { name: '#2', price: '$9.99', description: '2 Piece Meal w/ Mashed Potatoes' },
      { name: '#3', price: '$6.59', description: '1 Breast & 1 Leg' },
      { name: '#4', price: '$8.99', description: '4 Pieces' },
    ]);
    expect(kinds(d)).not.toContain('undescribed_codes');
  });

  it('flags numbered items that genuinely have none', () => {
    const d = draft([
      { name: '#1', price: '$5.99' },
      { name: '#2', price: '$9.99' },
      { name: '#3', price: '$6.59' },
    ]);
    expect(kinds(d)).toContain('undescribed_codes');
  });

  it('flags a menu that is only one section', () => {
    const d = draft(Array.from({ length: 6 }, (_, i) => ({ name: `D${i}`, price: '$8' })), {
      sectionName: 'Happy Hour',
    });
    expect(kinds(d)).toContain('single_section');
  });

  it('flags day-named specials', () => {
    const d = draft([
      { name: 'Tuesday - Himitsu Combo', price: '$15.99' },
      { name: 'Wednesday - Chicken Katsu', price: '$15.99' },
    ]);
    expect(kinds(d)).toContain('day_named_items');
  });
});

describe('hours', () => {
  it('is silent for a seven-day restaurant', () => {
    expect(missingWeekdays({ days: allWeek })).toEqual([]);
  });

  it('names the day that is absent', () => {
    expect(missingWeekdays({ days: allWeek.filter((d) => d.key !== 'mon') })).toEqual(['mon']);
  });

  it('is silent when there is no hours block rather than claiming all seven', () => {
    expect(missingWeekdays(null)).toEqual([]);
    expect(missingWeekdays({ days: 'nonsense' })).toEqual([]);
  });

  it('surfaces the gap as a signal on a real draft', () => {
    const d = draft([{ name: 'A', price: '$9' }], { hours: allWeek.filter((x) => x.key !== 'sun') });
    expect(kinds(d)).toContain('hours_missing_days');
  });
});

describe('shape', () => {
  it('says nothing at all about a draft with no menu', () => {
    expect(detectSignals({ pages: [{ content_blocks: [] }] })).toEqual([]);
    expect(detectSignals(null)).toEqual([]);
  });

  it('puts defects before notes — those are wrong on a page an owner may open', () => {
    const d = draft(
      [
        { name: 'A', price: '$' },
        { name: 'B', price: '$' },
        { name: 'C', price: '$' },
      ],
      { hours: allWeek.filter((x) => x.key !== 'mon') },
    );
    const sorted = sortSignals(detectSignals(d));
    expect(sorted[0].severity).toBe('defect');
    expect(sorted[sorted.length - 1].severity).toBe('note');
  });

  // ⚠️ The line this module must not cross: it reports observations, never sentences to send.
  it('emits no ready-made copy', () => {
    const d = draft([{ name: 'A', price: '$' }, { name: 'B', price: '$' }]);
    for (const s of detectSignals(d)) {
      expect(Object.keys(s).sort()).toEqual(['detail', 'kind', 'label', 'severity']);
    }
  });
});
