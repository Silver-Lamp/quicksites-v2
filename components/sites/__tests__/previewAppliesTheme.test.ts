/**
 * @jest-environment node
 */
// /preview renders through EditorSiteRenderer, which returned a bare <main> — so "Shuffle the
// look" changed and saved the theme while the preview showed none of it (2026-10-23).
import { readFileSync } from 'fs';
import path from 'path';

it('the preview renderer wraps its page in TemplateThemeWrapper, with the viewer\'s colour mode', () => {
  const src = readFileSync(path.join(process.cwd(), 'components/sites/editor-site-renderer.tsx'), 'utf8');
  expect(src).toMatch(/<TemplateThemeWrapper[^>]*template=\{themed/);
  expect(src).toMatch(/color_mode: colorMode/);
});
