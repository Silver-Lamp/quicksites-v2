/**
 * @jest-environment node
 */
// The routes a site OWNER's editor calls must gate on ownership — not on platform admin (which
// locks the customer out: Amy's Save & Publish returned "forbidden", 2026-10-22) and not on
// nothing (history and diff answered anyone; favicon upload trusted "can read" on public sites).
// Source guards, because the defect is a gate's absence or the wrong gate, which no unit test of
// the route's happy path can see.
import { readFileSync } from 'fs';
import path from 'path';

const read = (p: string) =>
  readFileSync(path.join(process.cwd(), p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const OWNER_ROUTES = [
  'app/api/admin/snapshots/create/route.ts',
  'app/api/admin/sites/publish/route.ts',
  'app/api/admin/sites/restore/route.ts',
  'app/api/admin/sites/unpublish/route.ts',
  'app/api/templates/[id]/history/route.ts',
  'app/api/templates/diff/route.ts',
  'app/api/favicon/upload/route.ts',
];

describe('editor routes gate on template ownership', () => {
  it.each(OWNER_ROUTES)('%s calls requireTemplateOwner and no admin-only gate', (p) => {
    const src = read(p);
    expect(src).toMatch(/requireTemplateOwner\(/);
    expect(src).not.toMatch(/\brequireAdmin\(|\bgetAdminUser\(|\bassertAdmin\(/);
  });

  it('restore writes through the sanctioned RPC and only restores this template’s own version', () => {
    const src = read('app/api/admin/sites/restore/route.ts');
    expect(src).toMatch(/commitTemplatePatch\(/);
    expect(src).not.toMatch(/from\('templates'\)\s*\.update\(/);
    expect(src).toMatch(/\.eq\('id', snapshotId\)\s*\.eq\('template_id', templateId\)/);
  });

  it('diff never reads a snapshot outside the requested template', () => {
    expect(read('app/api/templates/diff/route.ts')).toMatch(/\.eq\('id', ref\)\.eq\('template_id', templateId\)/);
  });

  it('favicon upload writes a sibling template only when it has the same owner', () => {
    expect(read('app/api/favicon/upload/route.ts')).toMatch(/\.eq\('owner_id'/);
  });
});
