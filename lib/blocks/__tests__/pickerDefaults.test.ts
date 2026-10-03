/**
 * @jest-environment node
 */
// lib/blocks/__tests__/pickerDefaults.test.ts
//
// Every block type the "Add a block" picker offers must have a default that validates. The picker
// renders a preview tile per type by calling createDefaultBlock(type) INSIDE render, and that call
// throws on a bad default — so a type listed without a valid default is not a broken tile, it is
// "Application error" over the whole editor the moment anyone presses "Add a block below"
// (2026-10-02, `quote`; found by the demo recorder, not by a report).
import fs from 'node:fs';
import path from 'node:path';
import { allPickerTypes, PICKER_GROUPS, QUICK_PICKS } from '@/lib/blocks/pickerTypes';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

describe('every block type the picker offers has a default that validates', () => {
  const types = allPickerTypes();

  it('offers a non-empty set', () => {
    expect(types.length).toBeGreaterThan(5);
    expect(types).toContain('quote');
  });

  for (const type of types) {
    it(`createDefaultBlock("${type}") does not throw`, () => {
      const block = createDefaultBlock(type as any);
      expect(block).toBeTruthy();
      expect(block.type).toBe(type);
    });
  }

  it('quick picks are a subset of the grouped types', () => {
    const grouped = new Set(Object.values(PICKER_GROUPS).flatMap((g) => g.types));
    for (const q of QUICK_PICKS) expect(grouped.has(q.type)).toBe(true);
  });
});

describe('source guards', () => {
  it('the picker reads its lists from pickerTypes.ts and guards the preview', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/admin/block-adder-grouped.tsx'), 'utf8');
    expect(src).toMatch(/from '@\/lib\/blocks\/pickerTypes'/);
    expect(src).toMatch(/previewBlockFor\(/);
    // A bare createDefaultBlock(type) inside JSX is the crash restored.
    expect(src).not.toMatch(/block=\{createDefaultBlock\(/);
  });
});
