// The users table's column structure.
//
// ⚠️ THIS EXISTS BECAUSE THE BUG LOOKED LIKE CSS AND WAS NOT. A `<div>` wrapped each
// `<TableRow>` directly inside `<tbody>`. A div is not a permitted child of tbody, so the HTML
// parser foster-parents it OUT of the table — the column structure collapses and the headers
// stop lining up with the cells. No stylesheet could have fixed it, and `tsc` cannot see it.

import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const src = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../users-plans-manager.tsx'), 'utf8'),
);

describe('users table', () => {
  it('puts no element other than a row directly inside the body', () => {
    const body = src.slice(src.indexOf('<TableBody>'), src.indexOf('</TableBody>'));
    expect(body).not.toMatch(/\n\s{20}<div[\s>]/);
    expect(body).toContain('<React.Fragment key=');
  });

  it('has as many body cells per row as there are header cells', () => {
    const head = src.slice(src.indexOf('<TableHeader>'), src.indexOf('</TableHeader>'));
    const headerCells =
      (head.match(/<TableHead[\s>]/g) ?? []).length + (head.match(/<SortHead[\s>]/g) ?? []).length;

    const rowStart = src.indexOf('<TableRow className="align-top');
    const rowEnd = src.indexOf('</TableRow>', rowStart);
    const row = src.slice(rowStart, rowEnd);
    const bodyCells = (row.match(/<TableCell[\s>]/g) ?? []).length;

    expect(headerCells).toBeGreaterThan(5); // the matcher is not inert
    expect(bodyCells).toBe(headerCells);
  });

  it('shows signup origin, and distinguishes "not captured" from "unknown"', () => {
    expect(src).toContain('Signed up from');
    expect(src).toContain('<SignupGeoCell');
    expect(src).toMatch(/Not captured/i);
  });
});
