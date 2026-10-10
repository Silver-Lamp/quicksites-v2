/**
 * @jest-environment node
 */
// lib/editor/__tests__/isEditorContext.test.ts
//
// "Inside an iframe" must never be the editor signal on its own: the Evolve page frames a
// draft as an exhibit and the owner saw "Paste your embed ID" (2026-10-10).
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { isEditorParentPath } from '@/lib/editor/isEditorContext';

describe('isEditorContext', () => {
  it('only an /admin/ parent counts as the editor', () => {
    expect(isEditorParentPath('/admin/templates/abc')).toBe(true);
    expect(isEditorParentPath('/evolve/abc')).toBe(false);
    expect(isEditorParentPath('/')).toBe(false);
    expect(isEditorParentPath(null)).toBe(false);
  });
  it('the source no longer returns true for a bare iframe', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'lib/editor/isEditorContext.ts'), 'utf8'));
    expect(src).not.toMatch(/return inIframe \|\|/);
    expect(src).toMatch(/window\.parent\.location\.pathname/);
    expect(src).toMatch(/catch/);
  });
});
