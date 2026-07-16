// lib/builder/__tests__/restaurantUxRefresh.test.ts
//
// "Refresh UX" transform: re-applies scaffold improvements to old restaurant drafts —
// idempotent, and NEVER clobbers operator-customized values.

import { applyRestaurantUxRefresh } from '../restaurantUxRefresh';

const block = (type: string, content: any = {}) => ({ _id: `${type}-1`, type, content });

function oldDraft() {
  return {
    data: {
      pages: [
        {
          slug: 'index',
          blocks: [
            block('hero', { headline: 'Eyman’s Pizza', cta_text: 'View Menu', cta_link: '' }),
            block('menu', { title: 'Our Menu', sections: [{ name: 'Pizza', items: [] }] }),
            block('location', { business_name: 'Eyman’s Pizza', phone: '(425) 555-0100' }),
            block('hours', {}),
            block('faq', { items: [{ q: 'Q', a: 'A' }] }),
            block('contact_form', { title: 'Contact Us' }),
            block('order_bar', {}),
          ],
        },
      ],
    },
    headerBlock: {
      type: 'header',
      content: {
        logo_url: '',
        nav_items: [
          { label: 'Home', href: '/', appearance: 'default' },
          { label: 'Services', href: '/services', appearance: 'default' },
          { label: 'Contact', href: '/contact', appearance: 'default' },
        ],
      },
    },
    footerBlock: {
      type: 'footer',
      content: { logo_url: '', links: [{ label: 'Contact', href: '/contact', appearance: 'default' }] },
    },
  };
}

describe('applyRestaurantUxRefresh', () => {
  it('upgrades an old draft: drops FAQ, anchors nav/CTA, catering title, tap-to-call footer', () => {
    const r = applyRestaurantUxRefresh(oldDraft());
    expect(r.changed).toBe(true);
    expect(r.applied.sort()).toEqual(
      ['contact_catering_title', 'footer_anchor_nav', 'footer_tap_to_call', 'header_anchor_nav', 'hero_cta_menu', 'removed_faq'].sort(),
    );

    const types = r.data.pages[0].blocks.map((b: any) => b.type);
    expect(types).not.toContain('faq');
    expect(r.data.pages[0].blocks[0].content.cta_link).toBe('#menu');
    expect(r.data.pages[0].blocks.find((b: any) => b.type === 'contact_form').content.title).toBe(
      'Questions? Catering? Get in touch',
    );
    expect(r.headerBlock.content.nav_items.map((l: any) => l.href)).toEqual(['#menu', '#location', '#contact']);
    const footerHrefs = r.footerBlock.content.links.map((l: any) => l.href);
    expect(footerHrefs.slice(0, 3)).toEqual(['#menu', '#location', '#contact']);
    expect(footerHrefs[3]).toBe('tel:4255550100');
  });

  it('is idempotent: running the refreshed output again is a no-op', () => {
    const first = applyRestaurantUxRefresh(oldDraft());
    const second = applyRestaurantUxRefresh({
      data: first.data,
      headerBlock: first.headerBlock,
      footerBlock: first.footerBlock,
    });
    expect(second.changed).toBe(false);
    expect(second.applied).toEqual([]);
  });

  it('respects operator edits: customized nav, CTA, and title are left alone', () => {
    const d = oldDraft();
    d.headerBlock.content.nav_items = [{ label: 'Specials', href: '/specials', appearance: 'default' }]; // custom page
    d.data.pages[0].blocks[0].content.cta_link = '/order'; // custom CTA
    d.data.pages[0].blocks.find((b: any) => b.type === 'contact_form')!.content.title = 'Book our food truck';
    const r = applyRestaurantUxRefresh(d);
    expect(r.applied).not.toContain('header_anchor_nav');
    expect(r.applied).not.toContain('hero_cta_menu');
    expect(r.applied).not.toContain('contact_catering_title');
    expect(r.headerBlock.content.nav_items[0].href).toBe('/specials');
    expect(r.data.pages[0].blocks[0].content.cta_link).toBe('/order');
    // FAQ removal + footer fixes still fire (footer had a stale /contact link).
    expect(r.applied).toContain('removed_faq');
  });
});
