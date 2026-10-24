/**
 * @jest-environment node
 */
import { detailFor, detailsForRows, readServiceDetails, servicePageHtml, servicePageSlug, serviceKey } from '@/lib/sites/serviceDetails';

it('keys a service by name, ignoring case, spacing and a "— $price" suffix', () => {
  expect(serviceKey('  Website Design & Development ')).toBe('website design & development');
  expect(serviceKey('Tune-Up — $89')).toBe('tune-up');
  const d = readServiceDetails({ meta: { service_details: { 'Tune-Up': { description: 'A check.' } } } });
  expect(detailFor(d, 'tune-up — $89')?.description).toBe('A check.');
});

it('drops empty and malformed details', () => {
  expect(readServiceDetails({ meta: { service_details: { A: {}, B: 'x', C: { description: '  ' } } } })).toEqual({});
  expect(detailsForRows([{ name: '', description: 'x' }, { name: 'Support', description: '' }])).toEqual({});
});

it('a renamed row carries its description and page to the new name', () => {
  const d = detailsForRows([{ name: 'SEO & Online Visibility', description: 'Be found.', page_slug: 'seo' }]);
  expect(d).toEqual({ 'seo & online visibility': { description: 'Be found.', page_slug: 'seo' } });
});

it('a service page slug is URL-safe and never collides', () => {
  expect(servicePageSlug('Website Design & Development', [])).toBe('website-design-and-development');
  expect(servicePageSlug('Support', ['support', 'support-2'])).toBe('support-3');
});

it('the page starts with the service as a heading and the description as escaped paragraphs', () => {
  expect(servicePageHtml('Data <Center>', 'Line one\n\nLine "two"')).toBe('<h2>Data &lt;Center&gt;</h2><p>Line one</p><p>Line &quot;two&quot;</p>');
});
