/**
 * @jest-environment node
 *
 * ⚠️ The hero editor opened on EDIT, which shows an image URL in a text field.
 *
 * The hero's whole payload is an image and a headline, and "Suggest All" generates both — so the
 * moment a ~20s generation finally landed, the result was invisible unless you knew to click a
 * tab. A gpt-image-1 call costs $0.05; the least we can do is show it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

describe('hero editor', () => {
  const HERO = read('components/admin/templates/block-editors/hero-editor.tsx');

  it('reads a real file', () => {
    expect(HERO.length).toBeGreaterThan(10000);
  });

  it('opens on Preview, so a generated image is visible', () => {
    expect(HERO).toMatch(/useState<'edit' \| 'preview'>\('preview'\)/);
  });

  it('still offers Edit — this moves the default, it does not remove a mode', () => {
    expect(HERO).toMatch(/\(\['edit', 'preview'\] as const\)/);
  });
});

describe('⚠️ the header editor is deliberately NOT changed', () => {
  const HEADER = read('components/admin/templates/block-editors/header-editor.tsx');

  it('still opens on Edit', () => {
    // A header is links and a logo. There is no generated result to reveal, so a preview-first
    // default would only add a click before the fields. Same control, different content, so the
    // right default differs — worth pinning so "consistency" does not quietly flip it.
    expect(HEADER).toMatch(/useState<'edit' \| 'preview'>\('edit'\)/);
  });
});
