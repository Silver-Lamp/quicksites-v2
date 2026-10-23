/**
 * @jest-environment node
 */
import { blockMatchesQuery } from '@/lib/editor/blockSearch';
import { blockMeta } from '@/admin/lib/zod/blockSchema';

it('"about" finds a block that can be an About section', () => {
  expect(blockMatchesQuery('story', 'Story Sections', 'about')).toBe(true);
  expect(blockMatchesQuery('text', 'Text Block', 'About')).toBe(true);
  expect(blockMatchesQuery('menu', 'Menu', 'about')).toBe(false);
});
it('label and type still match directly, and plurals fold', () => {
  expect(blockMatchesQuery('contact_form', 'Contact Form', 'contact f')).toBe(true);
  expect(blockMatchesQuery('gallery', 'Photo Gallery', 'pictures')).toBe(true);
  expect(blockMatchesQuery('scheduler', 'Service Scheduler', 'appointments')).toBe(true);
});
it('every synonym target is a real block type', () => {
  const src = require('fs').readFileSync(require('path').join(process.cwd(), 'lib/editor/blockSearch.ts'), 'utf8');
  const body = src.slice(src.indexOf('const SYNONYMS'), src.indexOf('};', src.indexOf('const SYNONYMS')));
  const targets = new Set(Array.from(body.matchAll(/'([a-z_]+)'(?=[,\]])/g), (m: RegExpMatchArray) => m[1]));
  for (const t of targets) expect(Object.keys(blockMeta)).toContain(t);
});
