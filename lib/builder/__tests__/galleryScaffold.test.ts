/**
 * @jest-environment node
 */
// ⚠️ node, not jsdom: the scaffold calls `crypto.randomUUID`, which jsdom does not provide.
// Same reason scaffoldValidates.test.ts pins the environment.
//
// THE BUG THIS GUARDS: the gallery block had a schema, a renderer, an editor AND a scaffold
// line, and appeared on ZERO of ~2,800 live templates — gated on `industry === 'photography'`
// when we have no photography sites. Built and unreachable.
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
const types = (k: string) =>
  (buildIndustryStarter({ businessName: 'Test Co', industryKey: k as any }) as any)
    .data.pages[0].blocks.map((b: any) => b.type);

describe('selected work reaches the credit-driven verticals', () => {
  const types = (k: string) =>
    (buildIndustryStarter({ businessName: 'Test Co', industryKey: k as any }) as any)
      .data.pages[0].blocks.map((b: any) => b.type);

  it.each(['personal', 'photography', 'author'])('%s gets a work index', (k) => {
    expect(types(k)).toContain('selected_work');
  });

  // ⚠️ Above the marketing tail. `personal` has no services and no faq, so an anchor list
  // without `cta` put the work index AFTER the call to action — asking for the click before
  // showing the work. Ordering, not an index: other blocks splice around it.
  it.each(['personal', 'photography', 'author'])('%s shows the work before asking', (k) => {
    const t = types(k);
    const at = t.indexOf('selected_work');
    expect(at).toBeGreaterThan(0);
    for (const tail of ['cta', 'contact_form']) {
      const ti = t.indexOf(tail);
      if (ti >= 0) expect(at).toBeLessThan(ti);
    }
  });

  it.each(['towing', 'restaurant'])('%s does not get one', (k) => {
    expect(types(k)).not.toContain('selected_work');
  });
});

describe('gallery reaches visual trades', () => {
  it.each(['photography','concrete','landscaping','painting','deck_builder','fencing','paving','epoxy_flooring','general_contractor'])(
    '%s gets a gallery', (k) => { expect(types(k)).toContain('gallery'); });

  // ⚠️ Not everywhere: a towing or restaurant site has no portfolio to show, and an empty
  // block in every editor is clutter rather than discovery.
  it.each(['towing','restaurant','general'])('%s does NOT', (k) => {
    expect(types(k)).not.toContain('gallery');
  });

  // ⚠️ "Near the top", not a fixed index. Other industry blocks (deck_estimate, section) also
  // splice at 1, so asserting an exact position fails on correct output — a check that fires
  // on working code trains you to ignore it. What matters is that the portfolio is above the
  // fold-ish and below the hero, not that it is element [1].
  it.each(['photography', 'landscaping', 'concrete', 'deck_builder'])(
    'puts the gallery high on the page for %s',
    (k) => {
      const t = types(k);
      expect(t[0]).toBe('hero');
      // ⚠️ NO INDEX BOUND. I wrote the comment above about not asserting a fixed position and
      // then left `<= 3` in it — deck_builder measured 3 one run and 4 the next, because other
      // industry blocks splice in around it. The property that actually matters is ORDERING:
      // the portfolio leads the pitch rather than trailing it.
      const at = t.indexOf('gallery');
      expect(at).toBeGreaterThan(0); // never above the hero
      expect(at).toBeLessThan(t.indexOf('services'));
      expect(at).toBeLessThan(t.indexOf('contact_form'));
    },
  );
});
