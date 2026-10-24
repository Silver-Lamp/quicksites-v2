/**
 * @jest-environment node
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import BodyMapRender from '@/components/admin/templates/render-blocks/body-map';

it('renders the outline, a hotspot per body region, the lungs panel by default, and derived grades', () => {
  const html = renderToString(<BodyMapRender block={{ type: 'body_map', content: {} }} />);
  expect(html).toMatch(/data-body-map="1"/);
  for (const r of ['head', 'ears', 'nose', 'throat', 'lungs', 'heart', 'immune', 'muscles', 'skin']) expect(html).toContain(`data-region="${r}"`);
  expect(html).toMatch(/Lungs &amp; chest/);
  expect(html).toMatch(/Sea moss clears, cleanses or &#x27;detoxes&#x27; a smoker&#x27;s lungs/);
  expect(html).toMatch(/data-grade="no_evidence"/);
});
