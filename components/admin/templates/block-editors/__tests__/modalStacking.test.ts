import fs from 'node:fs';
import path from 'node:path';

/**
 * The hero image "wouldn't save" because the modal's Save button was UNDER the floating editor
 * toolbar. Not the save path — the button. This guards the ordering, because the failure is
 * invisible to every other check: the markup is correct, the handler is correct, tsc is happy,
 * and the operator simply cannot reach the control.
 */
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const topZ = (src: string): number => {
  const hits = [...src.matchAll(/z-\[(\d+)\]/g)].map((m) => Number(m[1]));
  return hits.length ? Math.max(...hits) : 0;
};

describe('a block-editor modal outranks the floating toolbar', () => {
  const TOOLBARS = [
    'components/admin/templates/page-manager-toolbar.tsx',
    'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx',
  ];
  const MODALS = ['components/admin/templates/block-editors/hero-editor.tsx'];

  it('scans a non-empty set — a sweep that matches nothing reports success', () => {
    expect(TOOLBARS.length + MODALS.length).toBeGreaterThan(0);
    for (const f of [...TOOLBARS, ...MODALS]) expect(read(f).length).toBeGreaterThan(100);
  });

  it('every editor modal sits at or above every floating toolbar', () => {
    const toolbarMax = Math.max(...TOOLBARS.map((f) => topZ(read(f))));
    expect(toolbarMax).toBeGreaterThan(0); // the guard is meaningless if we found no toolbar z
    for (const m of MODALS) {
      expect({ modal: m, z: topZ(read(m)) }).toEqual({ modal: m, z: expect.any(Number) });
      expect(topZ(read(m))).toBeGreaterThanOrEqual(toolbarMax);
    }
  });
});
