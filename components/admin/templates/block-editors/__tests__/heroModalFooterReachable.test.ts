/** @jest-environment node */
//
// "The hero image won't save" has now been reported TWICE from real use, and both times the save
// path was fine — the Save BUTTON was underneath the floating editor toolbar. An operator picks
// an image, sees it in the preview, and the only reachable action is closing the modal, which
// discards local state. The database fingerprint both times: a hero block with no `image_url`
// key at all, because handleSave never ran.
//
// The first fix raised the modal to z-[2147483647] with the toolbar one below. That is INT32_MAX
// — there is no higher number — so when another toolbar was later given the same value, the tie
// broke on DOM order and the footer was covered again.
//
// This test guards the SPATIAL fix, because the ordinal one cannot be guarded: any component may
// legally claim the ceiling, and the modal cannot outrank it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the hero editor Save button cannot be covered by a floating toolbar', () => {
  const editor = read('components/admin/templates/block-editors/hero-editor.tsx');

  it('keeps the footer clear of the bottom toolbar strip', () => {
    const footer = editor.split('\n').find((l) => l.includes('sticky bottom-0') && l.includes('flex justify-end'));
    expect(footer).toBeDefined();
    // Clearance, not stacking. Without it the footer sits exactly where the toolbar renders.
    expect(footer).toMatch(/\bmb-24\b/);
  });

  it('documents why spacing rather than a higher z-index', () => {
    expect(editor).toMatch(/INT32_MAX|2147483647/);
  });

  it('at least one floating toolbar really does sit at the ceiling', () => {
    // If this ever stops being true the comment above is stale — but the mb-24 is still correct,
    // so this asserts the PREMISE rather than the fix, and fails loudly if the world changed.
    const toolbar = read('components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx');
    expect(toolbar).toContain('z-[2147483647]');
  });
});
