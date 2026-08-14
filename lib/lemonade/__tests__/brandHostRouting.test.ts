/** @jest-environment node */
//
// The brand hosts (lemonyum.com, yardsalesites.com) sit in front of the same app, and both
// decide "is this path a tenant, or ours?". Getting that wrong is invisible in code and obvious
// in a browser: `/admin/templates/new` on lemonyum.com was read as a stand named "admin" and
// 404'd — the first CTA on the page, dead the moment the domain went live.
process.env.NEXT_PUBLIC_LEMONYUM_BASE_DOMAIN = 'lemonyum.com';
process.env.NEXT_PUBLIC_YARDSALE_BASE_DOMAIN = 'yardsalesites.com';
process.env.NEXT_PUBLIC_APP_URL = 'https://www.quicksites.ai';

import { lemonYumAppRedirect, lemonYumPathSlug } from '@/lib/lemonade/lemonYum';
import { yardSaleAppRedirect, yardSaleCodeFromPath } from '@/lib/garageSales/yardSaleSites';

describe('app routes escape the brand hosts', () => {
  // The exact URL that 404'd in production.
  it('sends the builder CTA to the app, not to a stand lookup', () => {
    expect(lemonYumAppRedirect('/admin/templates/new', '?industry=lemonade_stand')).toBe(
      'https://www.quicksites.ai/admin/templates/new?industry=lemonade_stand',
    );
  });

  it.each(['admin', 'login', 'signup', 'build', 'merchant', 'dashboard', 'account'])(
    'escapes /%s from both brand hosts',
    (seg) => {
      expect(lemonYumAppRedirect(`/${seg}`, '')).toContain('quicksites.ai');
      expect(yardSaleAppRedirect(`/${seg}/x`, '')).toContain('quicksites.ai');
    },
  );

  it('leaves real tenant paths alone', () => {
    // A stand called "ellie" must still resolve as a stand, not leak to the app.
    expect(lemonYumAppRedirect('/ellie', '')).toBeNull();
    expect(lemonYumPathSlug('/ellie')).toBe('ellie');
    expect(yardSaleAppRedirect('/5BCGP8', '')).toBeNull();
    expect(yardSaleCodeFromPath('/5BC-GP8')).toBe('5BCGP8');
  });

  it('is case-insensitive, because a pasted link is not', () => {
    expect(lemonYumAppRedirect('/Admin/templates', '')).toContain('quicksites.ai');
  });
});

describe('the CTA does not depend on the reserved list being complete', () => {
  it('the page links to an absolute builder URL', () => {
    // Belt-and-braces: middleware now redirects app segments, but a CTA built from a
    // root-relative path breaks again the next time someone adds a route to the app.
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/lemonade-stands/page.tsx'),
      'utf8',
    );
    expect(src).not.toContain('href="/admin/templates/new');
    expect(src).toContain('BUILDER_URL');
  });
});
