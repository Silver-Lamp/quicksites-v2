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

describe('panels with a bottom action bar clear the floating toolbar', () => {
  const editor = read('components/admin/templates/block-editors/hero-editor.tsx');

  // ⚠️ EVERY panel that can be open while the editor toolbar is on screen, not just the hero.
  // This bug has now been reported three times, each on a different surface, each as "it won't
  // save" when the save path was fine. A per-file fix is how it kept coming back.
  it.each([
    ['components/admin/templates/block-editors/hero-editor.tsx'],
    ['components/admin/templates/block-editors/menu-editor.tsx'],
    ['components/admin/templates/block-editors/footer-editor.tsx'],
    ['components/admin/template-settings-panel/sidebar-settings.tsx'],
  ])('%s reserves toolbar clearance', (file) => {
    const src = read(file);
    expect(src).toMatch(/TOOLBAR_CLEARANCE(_PADDING)?/);
    expect(src).toContain('lib/ui/toolbarClearance');
  });

  it('the clearance is spacing, never a z-index', () => {
    // The ordinal fix already failed once: the modal was raised to INT32_MAX and a toolbar was
    // later given the same value, so the tie broke on DOM order.
    //
    // ⚠️ Strip comments before asserting. The first version failed because this file's own
    // explanation NAMES the z-index it forbids — a source-scan matching prose rather than code.
    // Third time today; these tests need their subject narrowed, not their pattern widened.
    const util = read('lib/ui/toolbarClearance.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(util).toMatch(/mb-24/);
    expect(util).toMatch(/pb-24/);
    expect(util).not.toMatch(/z-\[/);
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
