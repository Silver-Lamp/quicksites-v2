/** @jest-environment node */
//
// A menu block's payload lives under `content` OR `props` depending on what last touched it —
// the Zod block schema (admin/lib/zod/blockSchema.ts) emits the schema shape, everything else
// writes `content`. The renderer already reads both. The EDITOR read only `content`, so an owner
// whose page visibly showed three priced drinks opened the editor and saw an empty menu with
// "Create 0 products & enable ordering".
//
// Measured on the live fleet at the time: 172 imported restaurant menus carried `content`, one
// carried `props`. A 1-in-173 shape is exactly the kind that survives every manual test.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'components/admin/templates/block-editors/menu-editor.tsx'),
  'utf8',
);

describe('the menu editor tolerates both block shapes', () => {
  it('falls back to props when content is absent or empty', () => {
    // An empty `content: {}` must NOT win over a populated `props` — that is the exact row that
    // produced the empty editor.
    expect(src).toMatch(/content && Object\.keys\(\(block as any\)\.content\)\.length/);
    expect(src).toMatch(/\(block as any\)\?\.props/);
  });

  it('writes both keys on save, so neither copy goes stale', () => {
    const commit = src.slice(src.indexOf('const commit ='), src.indexOf('const commit =') + 900);
    expect(commit).toContain('content: next');
    expect(commit).toContain('props: next');
  });

  it('records why, so nobody simplifies it back to one key', () => {
    expect(src).toMatch(/Create 0 products|blockSchema/);
  });
});
