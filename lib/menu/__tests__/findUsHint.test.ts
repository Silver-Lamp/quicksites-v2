/**
 * @jest-environment node
 */
// The "How to find us" line: schema, renderer, and the rule that it is never generated.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(process.cwd(), 'admin/lib/zod/blockSchema.ts'), 'utf8');
const render = readFileSync(
  join(process.cwd(), 'components/admin/templates/render-blocks/location.tsx'),
  'utf8',
);
const editor = readFileSync(
  join(process.cwd(), 'components/admin/templates/block-editors/location-editor.tsx'),
  'utf8',
);

describe('find_us_hint', () => {
  it('is on the location schema and defaults to empty', () => {
    expect(schema).toMatch(/find_us_hint:\s*z\.string\(\)\.optional\(\)\.default\(''\)/);
  });

  // ⚠️ Absent unless the owner wrote one. A guessed landmark is a wrong direction printed as fact
  // — the invented-menu failure with a person driving somewhere as the consequence.
  it('renders only when set, and directly under the address it corrects', () => {
    expect(render).toMatch(/\{hint && \(/);
    const addressAt = render.indexOf('{address}');
    const hintAt = render.indexOf('{hint}');
    expect(addressAt).toBeGreaterThan(-1);
    expect(hintAt).toBeGreaterThan(addressAt);
  });

  it('has a real editor rather than the JSON fallback', () => {
    expect(editor).toMatch(/How to find us/);
    expect(
      readFileSync(join(process.cwd(), 'components/admin/templates/block-editors/index.ts'), 'utf8'),
    ).toMatch(/location: wrapDynamic/);
  });

  it('nudges only when the address has a unit marker and no hint yet', () => {
    expect(editor).toMatch(/looksHardToFind/);
    expect(editor).toMatch(/looksHardToFind && !local\.find_us_hint/);
  });
});
