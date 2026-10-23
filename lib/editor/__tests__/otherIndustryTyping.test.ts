/**
 * @jest-environment node
 */
// The hero editor's "Other (if not in the list)" box must not save while someone is typing —
// a timer there committed "Co" on the way to "Consulting" (owner, 2026-10-23). The value is
// held and committed on blur / Enter / Next.
import { readFileSync } from 'fs';
import path from 'path';

const src = readFileSync(path.join(process.cwd(), 'components/admin/templates/block-editors/hero-editor.tsx'), 'utf8');
const input = src.slice(src.indexOf('<label className="text-xs text-neutral-300">Other (if not in the list)</label>'), src.indexOf('id="industry-other-input"'));

it('the Other box holds its value on change and commits on blur and Enter', () => {
  const onChange = input.slice(input.indexOf('onChange='), input.indexOf('onBlur='));
  expect(onChange).toMatch(/mergeLater\(/);
  expect(onChange).not.toMatch(/mergeSoon\(|saveSoon\(|saveNow\(|flushSave\(/);
  expect(input.slice(input.indexOf('onBlur='))).toMatch(/flushMerge\(\);\s*flushSave\(\);/);
});
