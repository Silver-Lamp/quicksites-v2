import { generatePageMetadata } from '../generateMetadata';

const site: any = {
  slug: 'acme-plumbing',
  template_name: 'Acme Plumbing',
  data: {
    pages: [
      { slug: 'index', title: 'Home', meta: { title: 'Acme Plumbing — Fast, Local', description: 'Trusted plumbing.' } },
    ],
  },
};

describe('generatePageMetadata', () => {
  const md: any = generatePageMetadata({ site, pageSlug: 'index', baseUrl: 'https://acme.quicksites.ai' });

  it('sets title + description from the page meta', () => {
    expect(md.title).toBe('Acme Plumbing — Fast, Local');
    expect(md.description).toBe('Trusted plumbing.');
  });

  it('sets a canonical URL', () => {
    expect(md.alternates.canonical).toBe('https://acme.quicksites.ai/index');
  });

  it('produces a complete OpenGraph object (type/siteName/url/image)', () => {
    expect(md.openGraph.type).toBe('website');
    expect(md.openGraph.siteName).toBe('Acme Plumbing');
    expect(md.openGraph.url).toBe('https://acme.quicksites.ai/index');
    expect(md.openGraph.images[0]).toContain('/og/acme-plumbing');
  });

  it('produces a summary_large_image Twitter card', () => {
    expect(md.twitter.card).toBe('summary_large_image');
    expect(md.twitter.title).toBe('Acme Plumbing — Fast, Local');
    expect(md.twitter.images[0]).toContain('/og/acme-plumbing');
  });

  it('falls back gracefully when page meta is missing', () => {
    const bare: any = generatePageMetadata({ site: { slug: 's' } as any, pageSlug: 'x', baseUrl: 'https://s.quicksites.ai' });
    expect(bare.title).toBe('QuickSites');
    expect(bare.twitter.card).toBe('summary_large_image');
  });

  // ⚠️ CHANGED DELIBERATELY 2026-08-09. This used to assert a description was always present, and
  // the value satisfying it was the string "A site built with QuickSites." — served live on
  // www.graftontowing.com, a paying customer, as the sentence Google may print under their
  // business name. An ABSENT description lets a search engine pull a snippet from the page, which
  // beats a sentence advertising their vendor. The old assertion was green the whole time.
  it('emits no description rather than advertising us on a customer page', () => {
    const bare: any = generatePageMetadata({ site: { slug: 's' } as any, pageSlug: 'x', baseUrl: 'https://s.quicksites.ai' });
    expect(bare.description).toBeUndefined();
  });
});
