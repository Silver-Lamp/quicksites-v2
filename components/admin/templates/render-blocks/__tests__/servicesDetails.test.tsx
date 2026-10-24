/**
 * @jest-environment node
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ServicesRender from '@/components/admin/templates/render-blocks/services';

const template = {
  data: {
    services: ['Website Design', 'SEO', 'Support'],
    meta: { service_details: { 'website design': { description: 'Sites that load fast.', page_slug: 'website-design' }, seo: { page_slug: 'seo' } } },
  },
};

it('a described service is a button (pop-up closed until tapped/hovered); a page-only one is a link; a plain one is text', () => {
  const html = renderToString(<ServicesRender block={{ type: 'services', content: { variant: 'grid' } } as any} template={template} />);
  expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Website Design<\/button>/);
  expect(html).not.toContain('Sites that load fast.');
  expect(html).toMatch(/<a href="\/seo"[^>]*>SEO<\/a>/);
  expect(html).toMatch(/>Support</);
});
