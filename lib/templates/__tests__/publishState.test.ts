/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, contentDiffers, publishStateFor } from '@/lib/templates/publishState';
import { stripComments } from '@/test/stripComments';

const draft = { meta: { business_name: 'B Hard', noindex: true }, pages: [{ slug: 'home', blocks: [{ type: 'hero', content: { headline: 'B Hard' } }] }], headerBlock: { content: { nav_items: [] } }, color_mode: 'dark' };

describe('publishStateFor', () => {
  it('never published', () => {
    expect(publishStateFor({ draft, platform: null })).toEqual({ status: 'not_published', changedWhere: [], publishedAt: null });
  });
  it('up to date when every served copy matches, regardless of key order', () => {
    const reordered = { color_mode: 'dark', headerBlock: { content: { nav_items: [] } }, pages: draft.pages, meta: { noindex: true, business_name: 'B Hard' } };
    expect(publishStateFor({ draft, platform: reordered, domain: reordered, publishedAt: 't' })).toEqual({ status: 'up_to_date', changedWhere: [], publishedAt: 't' });
  });
  it('changed on the platform copy only, on the domain copy only, or both — and says which', () => {
    const edited = { ...draft, pages: [{ slug: 'home', blocks: [{ type: 'hero', content: { headline: 'B Hard!' } }] }] };
    expect(publishStateFor({ draft: edited, platform: draft, domain: edited }).changedWhere).toEqual(['platform']);
    expect(publishStateFor({ draft: edited, platform: edited, domain: draft }).changedWhere).toEqual(['domain']);
    expect(publishStateFor({ draft: edited, platform: draft, domain: draft })).toMatchObject({ status: 'changed', changedWhere: ['platform', 'domain'] });
  });
  it('ignores keys a visitor cannot see and undefined values', () => {
    expect(contentDiffers(draft, { ...draft, some_internal_counter: 5, meta: { ...draft.meta, extra: undefined } })).toBe(false);
    expect(contentDiffers(draft, { ...draft, meta: { ...draft.meta, noindex: false } })).toBe(true);
  });
  it('canonicalJson sorts keys at every level', () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: [{ z: 1, y: 2 }] })).toBe('{"a":[{"y":2,"z":1}],"b":{"c":2,"d":1}}');
  });
});

describe('the route and the pill', () => {
  it('the route is owner-gated and read-only', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/api/templates/[id]/publish-state/route.ts'), 'utf8'));
    expect(src).toMatch(/requireTemplateOwner\(id\)/);
    expect(src).not.toMatch(/\.(update|insert|upsert|delete|rpc)\(/);
    expect(src).toMatch(/published_sites/);
    expect(src).toMatch(/published_snapshot_id/);
  });
  it('the toolbar mounts the pill and refreshes it on save and publish', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/template-editor-toolbar.tsx'), 'utf8'));
    expect(src).toMatch(/<PublishStatePill/);
    expect(src).toMatch(/refreshKey=\{publishStateKey\}/);
  });
});
