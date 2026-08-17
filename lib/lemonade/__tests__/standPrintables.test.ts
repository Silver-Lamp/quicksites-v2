/** @jest-environment node */
// The printed sheets are the part of a lemonade stand that actually does the work — a customer
// standing in a driveway with no cash cannot be helped by a website they have not opened. So
// these assertions are about what reaches paper.

import { renderStandSignHtml, standUrlFor } from '../standSign';

const MENU = [
  { name: 'Drinks', items: [{ name: 'Lemonade', price: '$3' }, { name: 'Iced Tea', price: '$2.50' }] },
];

describe('stand printables', () => {
  it('prints the menu with the owner’s own prices, unreformatted', async () => {
    // ⚠️ A printed price is a promise to a stranger at a table. "$2.50" must not become "$2.5"
    // and "$3" must not become "$3.00" — the owner honours what they typed, and a sheet that
    // quietly restates it is us making a claim on their behalf.
    const html = await renderStandSignHtml({ standUrl: 'https://x.quicksites.ai', standName: 'S', menu: MENU });
    expect(html).toContain('$2.50');
    expect(html).toContain('$3');
    expect(html).not.toContain('$2.5<');
  });

  it('omits the board entirely when there is no menu', async () => {
    // A board printed with headings and no dishes is worse than no board: it looks like the
    // stand forgot to fill it in, in front of the customer.
    const html = await renderStandSignHtml({ standUrl: 'https://x.quicksites.ai', standName: 'S' });
    // ⚠️ Assert on MARKUP, not on the class name — `.board-heading { … }` is in the stylesheet
    // of every document, so `not.toContain('board-heading')` fails on correct output. Third
    // time today a source-scanning assertion matched the wrong copy of its own subject.
    expect(html).not.toContain('class="board-heading"');
    expect(html).not.toContain('class="board-name"');
    expect(html).toContain('sign-qr'); // the table sign still prints
  });

  it('prints a kerbside code larger than the table sign’s', async () => {
    // Not redundant: 4.6in reads across a table, and the kerbside sheet is read from a car.
    const html = await renderStandSignHtml({ standUrl: 'https://x.quicksites.ai', standName: 'S', menu: MENU });
    expect(html).toContain('huge-qr');
    const sign = /\.sign-qr \{ width: ([\d.]+)in/.exec(html)?.[1];
    const huge = /\.huge-qr \{ width: ([\d.]+)in/.exec(html)?.[1];
    expect(Number(huge)).toBeGreaterThan(Number(sign));
  });

  it('always prints the address as text beside every code', async () => {
    // A sheet that only works for people whose camera cooperates fails exactly the customer it
    // exists for. Every QR on every sheet is accompanied by something typeable.
    const html = await renderStandSignHtml({ standUrl: 'https://corner-stand.quicksites.ai/', standName: 'S', menu: MENU });
    const typeable = 'corner-stand.quicksites.ai';
    expect(html.split(typeable).length - 1).toBeGreaterThanOrEqual(3); // board, sign, kerbside
  });

  it('never prints a child’s name, photo or address — there is no parameter for one', async () => {
    const html = await renderStandSignHtml({
      standUrl: 'https://x.quicksites.ai',
      standName: 'The Corner Stand',
      cause: 'Saving for a bike',
      menu: MENU,
    });
    expect(html).not.toMatch(/\baddress\b/i);
    expect(html).not.toMatch(/<img[^>]+src="(?!data:image)/); // every image is an inlined QR
  });

  it('escapes a stand name rather than injecting it', async () => {
    const html = await renderStandSignHtml({ standUrl: 'https://x.quicksites.ai', standName: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('standUrlFor', () => {
  it('prefers a custom domain, then the slug', () => {
    expect(standUrlFor({ custom_domain: 'thestand.com' })).toBe('https://thestand.com');
    expect(standUrlFor({ slug: 'corner-stand' })).toMatch(/corner-stand/);
  });

  it('returns null with nothing to encode', () => {
    // A QR encoding "null" prints, scans, and fails in front of a customer.
    expect(standUrlFor({})).toBeNull();
    expect(standUrlFor({ slug: '' })).toBeNull();
  });
});
