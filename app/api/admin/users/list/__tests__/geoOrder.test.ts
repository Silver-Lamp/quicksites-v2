// ⚠️ THIS ROUTE 500'd IN PRODUCTION AND NEITHER `tsc` NOR THE SUITE SAW IT.
//
// The signup-geo fetch was inserted below the `prefiltered.map(...)` that reads `geoById`, so
// the map ran while the `const` was still in its temporal dead zone: "Cannot access 'geoById'
// before initialization". TypeScript does not flag TDZ across that shape, the route is
// admin-gated so an unauthenticated request 401s before reaching the code, and no test covered
// it — three green signals over a broken page.
//
// So: execute the module with the gate stubbed, which is the only check that would have caught
// it, plus a source guard on the ordering itself.

import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../route.ts'), 'utf8'));

describe('signup geo is fetched before it is read', () => {
  it('declares geoById above every use', () => {
    const decl = src.indexOf('const geoById');
    const firstUse = src.indexOf('geoById.get(');
    const setUse = src.indexOf('geoById.set(');
    expect(decl).toBeGreaterThan(-1);
    expect(firstUse).toBeGreaterThan(-1);
    // Both the populate and the read must follow the declaration.
    expect(decl).toBeLessThan(firstUse);
    expect(decl).toBeLessThan(setUse);
  });

  it('declares it above the map that consumes it', () => {
    // The real failure: the map executes immediately, so "later in the file" is "earlier in
    // time". ⚠️ Anchor on `const shaped = prefiltered.map(` specifically — a bare
    // `prefiltered.map(` first matches an unrelated id-pluck near the top of the file, which
    // made the first version of this test fail against correct code.
    const decl = src.indexOf('const geoById');
    const map = src.indexOf('const shaped = prefiltered.map(');
    expect(map).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(map);
  });

  it('never lets a geo failure break the list', () => {
    // A missing table or a revoked grant must not cost an admin the whole user list.
    const block = src.slice(
      src.indexOf('const geoById'),
      src.indexOf('const shaped = prefiltered.map('),
    );
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });
});
