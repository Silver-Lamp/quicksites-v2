/**
 * @jest-environment node
 */
// The editor canvas must load the theme's typeface stylesheet, not only set --font-heading,
// or the editor shows plain sans while the live site shows the pairing (2026-10-22).
import { readFileSync } from 'fs';
import path from 'path';

it('the editor canvas renders the font pairing stylesheet', () => {
  const src = readFileSync(path.join(process.cwd(), 'components/editor/live-editor/LiveEditorPreviewFrame.tsx'), 'utf8');
  expect(src).toMatch(/<link rel="stylesheet" href=\{resolvedTheme\.fontHref\}/);
});
