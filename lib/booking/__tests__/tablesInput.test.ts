/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseTablesInput, MAX_TABLES_PER_CALL } from '@/lib/booking/tablesInput';
import { stripComments } from '@/test/stripComments';

describe('parseTablesInput', () => {
  it('accepts a clean proposal and normalises labels', () => {
    const r = parseTablesInput({ tables: [{ ref: 'a', label: '  Table   1 ', seats: 4 }, { ref: 'b', label: 'Finestra', seats: '2' }] });
    expect(r).toEqual({ ok: true, tables: [{ ref: 'a', label: 'Table 1', seats: 4 }, { ref: 'b', label: 'Finestra', seats: 2 }] });
  });
  it('seats are required and bounded — a table the photo could not count is never defaulted', () => {
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1', seats: null }] })).toEqual({ ok: false, error: 'seats_invalid', index: 0 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1' }] })).toEqual({ ok: false, error: 'seats_invalid', index: 0 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1', seats: 0 }] })).toEqual({ ok: false, error: 'seats_invalid', index: 0 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1', seats: 41 }] })).toEqual({ ok: false, error: 'seats_invalid', index: 0 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1', seats: 2.5 }] })).toEqual({ ok: false, error: 'seats_invalid', index: 0 });
  });
  it('refs and labels must be present and unique within the call', () => {
    expect(parseTablesInput({ tables: [{ label: 'T1', seats: 2 }] })).toEqual({ ok: false, error: 'ref_required', index: 0 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 'T1', seats: 2 }, { ref: 'a', label: 'T2', seats: 2 }] })).toEqual({ ok: false, error: 'ref_duplicate', index: 1 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: 't1', seats: 2 }, { ref: 'b', label: 'T1', seats: 2 }] })).toEqual({ ok: false, error: 'label_duplicate', index: 1 });
    expect(parseTablesInput({ tables: [{ ref: 'a', label: '', seats: 2 }] })).toEqual({ ok: false, error: 'label_invalid', index: 0 });
  });
  it('empty or oversized calls are refused', () => {
    expect(parseTablesInput({})).toEqual({ ok: false, error: 'tables_required' });
    expect(parseTablesInput({ tables: [] })).toEqual({ ok: false, error: 'tables_required' });
    const many = Array.from({ length: MAX_TABLES_PER_CALL + 1 }, (_, i) => ({ ref: `r${i}`, label: `T${i}`, seats: 2 }));
    expect(parseTablesInput({ tables: many })).toEqual({ ok: false, error: 'too_many' });
  });
});

describe('the tables route', () => {
  const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/api/booking/[templateId]/tables/route.ts'), 'utf8'));
  it('is owner- or partner-gated, signs the raw body, verifies before parse', () => {
    expect(src).toMatch(/requireTemplateOwner\(templateId\)/);
    expect(src).toMatch(/checkBookingPartner\(req, signedInput\)/);
    expect(src).toMatch(/const raw = await req\.text\(\)/);
    expect(src.indexOf('gate(req, templateId, raw)')).toBeLessThan(src.indexOf('JSON.parse(raw'));
  });
  it('an existing label is returned as the same table and its seats are left alone', () => {
    expect(src).toMatch(/existing: true/);
    expect(src).not.toMatch(/\.update\(/);
  });
});
