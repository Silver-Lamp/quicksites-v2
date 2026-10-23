/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import path from 'path';
import { applyMetaMerge, metaOnlyMerge } from '@/lib/editor/metaMerge';

describe('meta-only template merges', () => {
  it('accepts exactly { meta: {...} } and nothing else', () => {
    expect(metaOnlyMerge({ meta: { industry: 'other', industry_other: 'Consulting' } })).toEqual({ industry: 'other', industry_other: 'Consulting' });
    expect(metaOnlyMerge({ data: { meta: {} } })).toBeNull();
    expect(metaOnlyMerge({ id: 'x', data: {}, meta: {} })).toBeNull(); // a whole server template
    expect(metaOnlyMerge({ meta: [] })).toBeNull();
    expect(metaOnlyMerge(null)).toBeNull();
  });
  it('merges one level into data.meta and keeps pages', () => {
    const data = { pages: [{ id: 'p' }], meta: { site_type: 'small_business', theme: { a: 1 } } };
    expect(applyMetaMerge(data, { industry_other: 'Consulting' })).toEqual({
      pages: [{ id: 'p' }],
      meta: { site_type: 'small_business', theme: { a: 1 }, industry_other: 'Consulting' },
    });
  });
  it('the editor toolbar listens for it (a dispatcher with no listener fails silently)', () => {
    const src = readFileSync(path.join(process.cwd(), 'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx'), 'utf8');
    expect(src).toMatch(/addEventListener\('qs:template:merge'/);
    expect(src).toMatch(/metaOnlyMerge\(/);
  });
});
