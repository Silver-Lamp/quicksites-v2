/**
 * @jest-environment node
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import BodyMapRender from '@/components/admin/templates/render-blocks/body-map';

it('renders a hotspot per body region, the lungs panel by default, and derived grades', () => {
  const html = renderToString(<BodyMapRender block={{ type: 'body_map', content: {} }} />);
  expect(html).toMatch(/data-body-map="1"/);
  for (const r of ['head', 'ears', 'nose', 'throat', 'lungs', 'heart', 'immune', 'muscles', 'joints', 'skin', 'gut']) expect(html).toContain(`data-region="${r}"`);
  expect(html).toMatch(/Lungs &amp; chest/);
  expect(html).toMatch(/Sea moss clears, cleanses or &#x27;detoxes&#x27; a smoker&#x27;s lungs/);
  expect(html).toMatch(/data-grade="no_evidence"/);
});

it('draws the blueprint underlay from a file that exists, and every hotspot lies on the drawing', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  const { BODY_DRAWING } = require('@/components/admin/templates/render-blocks/body-map');
  expect(fs.existsSync(`public${BODY_DRAWING.src}`)).toBe(true);
  const html = renderToString(<BodyMapRender block={{ type: 'body_map', content: {} }} />);
  expect(html).toContain(`href="${BODY_DRAWING.src}"`);
  const spots = [...html.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="22"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  expect(spots.length).toBe(11);
  for (const [x, y] of spots) {
    expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(BODY_DRAWING.w);
    expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(BODY_DRAWING.h);
  }
});
