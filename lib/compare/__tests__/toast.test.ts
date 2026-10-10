/**
 * @jest-environment node
 */
// lib/compare/__tests__/toast.test.ts
//
// The Toast comparison's promise is narrower than the rest of the cluster's and easier to break:
// it says "cheaper below N orders a month", never "cheaper". Three things pinned here:
//   1. the math — our fee is applied with the real floor, and the break-even is where the two
//      restaurant-paid costs actually cross;
//   2. the two classes of figure stay apart — a vendor-read number and a blog-reported number are
//      never rendered in the same list, and the page says which is which;
//   3. the page carries no blanket "cheaper than Toast", and no figure is retyped into the JSX —
//      every dollar and percent is read from the module (so a constant change moves the page).
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import {
  TOAST,
  TOAST_PRICES_VERIFIED,
  QUICKSITES_RESTAURANT,
  quicksitesMonthlyCents,
  toastMonthly,
  breakEvenOrders,
  TICKETS_CENTS,
} from '@/lib/compare/toast';
import { RESTAURANT_FEE_MIN_CENTS, RESTAURANT_FEE_PERCENT } from '@/lib/commerce/pricingDefaults';
import { COMPARE_REGISTRY } from '@/lib/compare/registry';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
const PAGE = read('app/compare/toast/page.tsx');

describe('the math', () => {
  it('our monthly cost applies the real fee with its floor and no monthly', () => {
    // $25 ticket → 8% = $2.00 > 60¢ floor
    expect(quicksitesMonthlyCents({ orders: 10, ticketCents: 2500 })).toBe(10 * Math.floor(2500 * RESTAURANT_FEE_PERCENT));
    // $5 ticket → 8% = 40¢ < floor → floor applies
    expect(quicksitesMonthlyCents({ orders: 10, ticketCents: 500 })).toBe(10 * RESTAURANT_FEE_MIN_CENTS);
    expect(quicksitesMonthlyCents({ orders: 0, ticketCents: 2500 })).toBe(0);
  });

  it("Toast's restaurant cost is per-order processing plus the fixed add-on; the guest fee is separate", () => {
    const t = toastMonthly({ orders: 100, ticketCents: 2000 });
    const perOrder = Math.floor(2000 * TOAST.reported.onlinePct) + TOAST.reported.onlineCents;
    expect(t.fixedCents).toBe(TOAST.reported.onlineOrderingAddonMonthly * 100);
    expect(t.restaurantCents).toBe(100 * perOrder + t.fixedCents);
    expect(t.guestCents).toBe(100 * TOAST.reported.guestFeeCentsLow);
    expect(toastMonthly({ orders: 100, ticketCents: 2000 }, 'pos').fixedCents).toBe((TOAST.published.posMonthly + TOAST.reported.onlineOrderingAddonMonthly) * 100);
  });

  it('the break-even is where the two restaurant-paid costs cross', () => {
    for (const ticket of TICKETS_CENTS) {
      const n = breakEvenOrders(ticket);
      expect(n).not.toBeNull();
      const below = n! - 1;
      expect(quicksitesMonthlyCents({ orders: below, ticketCents: ticket })).toBeLessThan(toastMonthly({ orders: below, ticketCents: ticket }).restaurantCents);
      expect(quicksitesMonthlyCents({ orders: n!, ticketCents: ticket })).toBeGreaterThanOrEqual(toastMonthly({ orders: n!, ticketCents: ticket }).restaurantCents);
    }
    // With today's constants a $20 ticket crosses in the low hundreds — the page's whole point.
    const n20 = breakEvenOrders(2000)!;
    expect(n20).toBeGreaterThan(50);
    expect(n20).toBeLessThan(300);
  });
});

describe('two classes of figure', () => {
  it('vendor-read and reported figures are separate objects, and the sources say which is which', () => {
    expect(Object.keys(TOAST.published)).not.toContain('onlinePct');
    expect(Object.keys(TOAST.reported)).not.toContain('posMonthly');
    const kinds = new Set(TOAST.sources.map((s) => s.kind));
    expect(kinds).toEqual(new Set(['vendor', 'third-party']));
    for (const s of TOAST.sources) expect(s.url).toMatch(/^https:\/\//);
    expect(TOAST_PRICES_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('the page labels the reported figures as reported, and renders them from the module', () => {
    expect(PAGE).toMatch(/TOAST\.reported\b/);
    expect(PAGE).toMatch(/TOAST\.published\b/);
    expect(PAGE).toMatch(/does not publish/i);
    expect(PAGE).toMatch(/third-party/i);
  });

  it('our fee is read from the module, and the page says processing is inside it', () => {
    expect(PAGE).toMatch(/QUICKSITES_RESTAURANT/);
    expect(QUICKSITES_RESTAURANT.processingIncluded).toBe(true);
    expect(PAGE).toMatch(/processing/i);
  });
});

describe('what the page may not say', () => {
  it('no literal dollar amount or percentage is typed into the page', () => {
    // Every figure comes through dollars()/pct() or the constants. A "$69" in the JSX is a number
    // that stops moving when the module does.
    expect(PAGE).not.toMatch(/\$\d/);
    expect(PAGE).not.toMatch(/\d\s?%/);
    expect(PAGE).not.toMatch(/\d+\s?¢/);
  });

  it('never a blanket "cheaper than Toast" — the volume is the claim', () => {
    expect(PAGE).not.toMatch(/cheaper than Toast/i);
    expect(PAGE).not.toMatch(/beats Toast/i);
    expect(PAGE).toMatch(/breakEvenOrders/);
  });

  it('never says we replace a point-of-sale, and tells a Toast POS restaurant to keep it', () => {
    expect(PAGE).not.toMatch(/replace(s)? (your )?(POS|point[- ]of[- ]sale)/i);
    expect(PAGE).toMatch(/keep it/i);
  });

  it('carries both search phrasings as one text node each, and the H1 stays the comparison', () => {
    expect(PAGE).toMatch(/title: 'Toast alternative — QuickSites vs Toast/);
    expect(PAGE).toMatch(/Looking for a/);
    expect(PAGE).toMatch(/Toast alternative/);
    const h1 = PAGE.slice(PAGE.indexOf('<h1'), PAGE.indexOf('</h1>'));
    expect(h1).not.toMatch(/alternative/i);
  });
});

describe('the audit cron covers it', () => {
  it('the registry lists the restaurant-ordering cluster with the same read date', () => {
    const e = COMPARE_REGISTRY.find((x) => x.key === 'restaurant-ordering');
    expect(e).toBeDefined();
    expect(e!.status).toBe('live');
    expect(e!.competitors).toEqual(['toast']);
    expect(e!.pricesVerified).toBe(TOAST_PRICES_VERIFIED);
    expect(e!.clusterPath).toBe('/compare/toast');
  });
});
